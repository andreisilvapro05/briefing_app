"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getAdminUser } from "@/lib/admin";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  hasFullAccess,
  hasTaskScopedRole,
  isDeveloper,
  telaInicialDe,
  type Member,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createClickUpBriefingTask } from "@/lib/clickup";
import { htmlMagicLink, sendEmail } from "@/lib/email";
import { getServerEnv } from "@/lib/env";
import { generateMagicSlug } from "@/lib/slug";
import { parseValorBR } from "@/lib/payment-receipts";
import {
  buildClientePayload,
  sendDashboardWebhook,
} from "@/lib/dashboard-webhook";
import { createClientFolders } from "@/lib/google-drive";
import { createAdminNotification } from "@/lib/notifications";
import { logServerError } from "@/lib/api-helpers";
import { notifyMember, nomeDoMembro } from "@/lib/member-notifications";
import { listTaskLinkTargets, type LinkTarget } from "@/lib/task-links";
import type { EntregaDocumento } from "@/lib/entrega";
import type { Moodboard } from "@/lib/moodboard";
import {
  EISENHOWER_VALUES,
  ESFORCO_VALUES,
  RECORRENCIA_VALUES,
  proximaOcorrencia,
  DEFAULT_PROJECT_TASKS,
  DEFAULT_TASK_STATUS,
  PROJECT_STATUS_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_GROUP,
  TASK_PRIORITY_OPTIONS,
  TEAM_MEMBERS,
  AREA_VALUES,
  donoPadraoDe,
  type TaskStatus,
} from "@/lib/project-tasks";
import type { ProjectType } from "@/lib/types";
import { formatDiaMesCurto, hojeEmBrasilia } from "@/lib/datas";

function keyParamOf(formData: FormData): string | null {
  return String(formData.get("key") ?? "") || null;
}

/**
 * Ação operacional (projeto/tarefas/moodboard/drive/etc — não financeira):
 * "basico" só pode mexer em clientes que está marcado (mesma regra que já
 * restringe leitura via getVisibleClientIds, agora também nas escritas).
 * admin/avancado/legacy passam direto. Pedido do usuário 2026-09-01:
 * "designer só a parte de projetos".
 */
async function requireClientAccess(
  formData: FormData,
  clientId: string
): Promise<Member> {
  const urlKey = keyParamOf(formData);
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // O desenvolvedor tem tarefa no cliente, então passaria no escopo — mas
  // moodboard, entrega, etapa do projeto e Drive não são dele. A tela ele
  // nunca vê (AdminShell barra a seção); a Server Action, porém, é um POST
  // próprio que não passa pelo shell. Achado da revisão de 22/09.
  if (isDeveloper(member)) {
    redirect(
      `${telaInicialDe(member)}${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`
    );
  }
  if (!hasFullAccess(member)) {
    const visible = await getVisibleClientIds(member);
    if (visible && !visible.has(clientId)) {
      redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
    }
  }
  return member;
}

/**
 * Ação financeira/contrato/dados sensíveis (pagamento, CPF, endereço) — além
 * do escopo por cliente, exige hasFinanceAccess. "basico" nunca passa,
 * mesmo pro próprio cliente. Pedido do usuário: "bloqueia a parte do valor
 * do pagamento cliente, contrato... dados sensíveis".
 */
async function requireClientFinanceAccess(
  formData: FormData,
  clientId: string
): Promise<Member> {
  const member = await requireClientAccess(formData, clientId);
  if (!hasFinanceAccess(member)) {
    const urlKey = keyParamOf(formData);
    redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }
  return member;
}

/**
 * Reenviar magic link para o cliente (acionado pelo admin).
 */
export async function resendClientLinkAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const email = String(formData.get("email") ?? "");
  if (!email) return;

  const env = getServerEnv();
  const service = createSupabaseServiceRoleClient();

  try {
    await service.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${env.appUrl}/auth/callback`,
        shouldCreateUser: false,
      },
    });
  } catch {
    // Best-effort — não derruba a tela se a API de auth falhar aqui.
  }

  // Também enviamos um e-mail "humano" via Resend (Supabase já manda o magic-link
  // automático; este é um aviso complementar).
  try {
    await sendEmail({
      to: email,
      subject: "Seu link de acesso · Fysi Lab",
      html: htmlMagicLink({
        nome: "",
        link: `${env.appUrl}/entrar`,
      }),
    });
  } catch {
    // Best-effort
  }
}

/**
 * Cria a tarefa no ClickUp para o cliente.
 * Útil quando o auto-envio na conclusão falhou ou ainda não rodou.
 */
export async function sendToClickupAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  const service = createSupabaseServiceRoleClient();
  const [{ data: client }, { data: responses }] = await Promise.all([
    service.from("clients").select("*").eq("id", clientId).maybeSingle(),
    service
      .from("briefing_responses")
      .select("field_id, value")
      .eq("client_id", clientId),
  ]);

  if (!client) return;

  const responsesMap: Record<string, unknown> = {};
  for (const r of (responses ?? []) as { field_id: string; value: unknown }[]) {
    responsesMap[r.field_id] = r.value;
  }

  const env = getServerEnv();
  const result = await createClickUpBriefingTask({
    cliente: {
      id: client.id,
      nome: client.nome,
      email: client.email,
      empresa: client.empresa,
      whatsapp: client.whatsapp,
      projectType: client.project_type,
      createdAt: client.created_at,
      updatedAt: client.updated_at,
    },
    responses: responsesMap,
    publicLinkParaPainelAdmin: `${env.appUrl}/admin/${client.id}`,
  });

  if (result.taskId) {
    const { error: escritaErr } = await service
      .from("clients")
      .update({ clickup_task_id: result.taskId })
      .eq("id", clientId);
    if (escritaErr) logServerError("cliente.escrita", escritaErr);
  }

  revalidatePath(`/admin/${clientId}`);
}


/**
 * Avança ou retrocede o stage do projeto. Aceita 'next', 'prev' ou número absoluto.
 */
export async function setStageAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  const direction = String(formData.get("direction") ?? "");
  const targetStr = String(formData.get("target") ?? "");

  const service = createSupabaseServiceRoleClient();
  const { data: client } = await service
    .from("clients")
    .select("current_stage_index, project_type")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return;

  // Calcula stage máximo a partir do project_type (sem chamada cara).
  // landing-sem-copy & outro = índices até length-1; demais = 5.
  const maxIndex =
    client.project_type === "landing-sem-copy"
      ? 4
      : client.project_type === "outro"
        ? 3
        : 5;

  let next = client.current_stage_index ?? 0;
  if (direction === "next") next = Math.min(maxIndex, next + 1);
  else if (direction === "prev") next = Math.max(0, next - 1);
  else if (targetStr) {
    const target = parseInt(targetStr, 10);
    if (!Number.isNaN(target)) next = Math.max(0, Math.min(maxIndex, target));
  }

  if (next === (client.current_stage_index ?? 0)) {
    revalidatePath(`/admin/${clientId}`);
    return;
  }

  const { error: escritaErr } = await service
    .from("clients")
    .update({ current_stage_index: next })
    .eq("id", clientId);
  if (escritaErr) logServerError("cliente.escrita", escritaErr);

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin");
}

/**
 * Define ou troca o tipo de projeto do cliente. Faz o pipeline do projeto
 * aparecer (e ficar editável) no admin, e o dashboard do cliente passa a
 * mostrar a timeline correta.
 */
export async function setProjectTypeAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const projectType = String(formData.get("projectType") ?? "");
  const allowed = [
    "landing-com-copy",
    "landing-sem-copy",
    "site-completo",
    "seo",
    "outro",
  ];
  if (!clientId || !allowed.includes(projectType)) return;
  await requireClientAccess(formData, clientId);

  const service = createSupabaseServiceRoleClient();

  // Ao trocar pra um tipo com timeline mais curta, faz clamp do stage atual
  // pra não deixar current_stage_index fora da faixa — senão a timeline do
  // cliente aparece 100% concluída indevidamente. Mesma lógica de maxIndex
  // do setStageAction.
  const maxIndex =
    projectType === "landing-sem-copy"
      ? 4
      : projectType === "outro"
        ? 3
        : 5;
  const { data: current } = await service
    .from("clients")
    .select("current_stage_index")
    .eq("id", clientId)
    .maybeSingle();
  const clamped = Math.min(
    (current as { current_stage_index: number | null } | null)
      ?.current_stage_index ?? 0,
    maxIndex
  );

  const { error: escritaErr } = await service
    .from("clients")
    .update({ project_type: projectType, current_stage_index: clamped })
    .eq("id", clientId);
  if (escritaErr) logServerError("cliente.escrita", escritaErr);

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin");
}

/**
 * Edita os dados do cliente (usados pra montar o contrato). Permite o admin
 * preencher tudo sem depender do cliente passar por /contrato — útil pra
 * onboarding manual.
 *
 * Se email + cpf + endereço ficarem preenchidos, marca contrato_preenchido_at
 * (assim o dashboard do cliente mostra a Etapa 01 como pronta).
 */
export async function setClientContractDataAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientFinanceAccess(formData, clientId);

  function val(key: string): string {
    return String(formData.get(key) ?? "").trim();
  }

  const nome = val("nome");
  const email = val("email");
  const empresa = val("empresa");
  const endereco = val("endereco");
  const cep = val("cep");
  const cpf = val("cpf");
  const rg = val("rg");
  const cnpj = val("cnpj");
  const razaoSocial = val("razao_social");

  const update: Record<string, string | null> = {
    email: email || null,
    empresa: empresa || null,
    endereco: endereco || null,
    cep: cep || null,
    cpf: cpf || null,
    rg: rg || null,
    cnpj: cnpj || null,
    razao_social: razaoSocial || null,
  };
  if (nome) update.nome = nome;

  const service = createSupabaseServiceRoleClient();

  // Se os dados mínimos pro contrato estão preenchidos, marca como pronto
  // (espelha o que o /api/cliente/contrato faz quando o cliente preenche).
  const { data: current } = await service
    .from("clients")
    .select("contrato_preenchido_at")
    .eq("id", clientId)
    .maybeSingle();

  if (
    email &&
    cpf &&
    endereco &&
    !(current as { contrato_preenchido_at: string | null } | null)
      ?.contrato_preenchido_at
  ) {
    (update as Record<string, unknown>).contrato_preenchido_at =
      new Date().toISOString();
  }

  const { error: updErr } = await service
    .from("clients")
    .update(update)
    .eq("id", clientId);
  if (updErr) logServerError("cliente.update", updErr);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Salva os links de Drive (manual). Pode salvar um ou os dois.
 * Aceita string vazia pra limpar; valida URL simples.
 */
export async function setDriveLinksAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  const fysiRaw = String(formData.get("fysiDriveLink") ?? "").trim();
  const clienteRaw = String(formData.get("clienteDriveLink") ?? "").trim();

  // Sanitização leve: vazio limpa; se veio sem protocolo (ex: colou
  // "drive.google.com/…"), prefixa https:// em vez de descartar em silêncio
  // (antes o link sumia e a UI dizia "salvo" — mesma classe de bug já
  // corrigida no copy_review_link).
  function clean(v: string): string | null {
    if (!v) return null;
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    return withProto.slice(0, 1000);
  }

  const update: Record<string, string | null> = {};
  if (formData.has("fysiDriveLink")) update.fysi_drive_link = clean(fysiRaw);
  if (formData.has("clienteDriveLink"))
    update.cliente_drive_link = clean(clienteRaw);

  if (Object.keys(update).length === 0) return;

  const service = createSupabaseServiceRoleClient();
  const { error: updErr } = await service
    .from("clients")
    .update(update)
    .eq("id", clientId);
  if (updErr) logServerError("cliente.update", updErr);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Cria a pasta do cliente no Drive da Fysi sob demanda (idempotente — se já
 * existe uma pasta com esse nome, reaproveita em vez de duplicar). Pra
 * clientes que não passaram pelo "novo cliente" do admin (ex: vieram do
 * onboarding público, que não cria pasta automaticamente).
 */
export async function createDriveFoldersAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  const service = createSupabaseServiceRoleClient();
  const { data: client } = await service
    .from("clients")
    .select("nome, empresa")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return;

  const nome = (client.empresa as string | null) || (client.nome as string | null) || "Cliente";

  try {
    const folders = await createClientFolders(nome, clientId);
    if (folders) {
      const { error: escritaErr } = await service
        .from("clients")
        .update({
          fysi_drive_link: folders.rootUrl,
          google_drive_folders: folders,
        })
        .eq("id", clientId);
      if (escritaErr) logServerError("cliente.escrita", escritaErr);
    }
  } catch (err) {
    logServerError("drive.create-folders", err);
  }

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Atualiza os campos de pagamento (total, pago, observação) do cliente.
 * Valores aceitam string com vírgula ou ponto — normalizamos pra ponto antes.
 */
export async function setPaymentAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientFinanceAccess(formData, clientId);

  function parseMoney(raw: string): number | null {
    const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
    if (!cleaned) return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  }

  const total = parseMoney(String(formData.get("pagamentoTotal") ?? ""));
  const pago = parseMoney(String(formData.get("pagamentoPago") ?? ""));
  const obs = String(formData.get("pagamentoObservacao") ?? "").trim();

  const service = createSupabaseServiceRoleClient();
  const { error: escritaErr } = await service
    .from("clients")
    .update({
      pagamento_total: total,
      pagamento_pago: pago ?? 0,
      pagamento_observacao: obs || null,
      pagamento_atualizado_at: new Date().toISOString(),
    })
    .eq("id", clientId);
  if (escritaErr) logServerError("cliente.escrita", escritaErr);

  // Webhook outbound: avisa o dashboard financeiro do novo estado.
  const { data: fresh } = await service
    .from("clients")
    .select(
      "id, nome, email, empresa, whatsapp, cpf, cnpj, razao_social, endereco, cep, project_type"
    )
    .eq("id", clientId)
    .maybeSingle();
  if (fresh) {
    const totalNum = total ?? 0;
    const pagoNum = pago ?? 0;
    // "pagamento.recebido" também estava no enum sem nenhum produtor. Só
    // avisa quando o valor pago SUBIU — salvar o formulário sem mexer no
    // valor não é notícia.
    const pagoAntes = Number(
      (fresh as { pagamento_pago?: number | null }).pagamento_pago ?? 0
    );
    if (pagoNum > 0 && pagoNum !== pagoAntes) {
      after(async () => {
        await createAdminNotification({
          clientId,
          kind: "pagamento.recebido",
          title: `Pagamento de ${(fresh as { empresa?: string | null; nome?: string | null }).empresa || (fresh as { nome?: string | null }).nome || "cliente"}`,
          message:
            totalNum > 0
              ? `${Math.round((pagoNum / totalNum) * 100)}% do total recebido`
              : "valor atualizado",
        });
      });
    }
    void sendDashboardWebhook({
      event: "pagamento.atualizado",
      emittedAt: new Date().toISOString(),
      source: "briefing_app",
      clientId,
      cliente: buildClientePayload(fresh),
      pagamento: {
        total: total,
        pago: pagoNum,
        pendente: Math.max(0, totalNum - pagoNum),
        observacao: obs || null,
      },
    });
  }

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Apaga o cliente e tudo associado (briefing_responses, briefing_files via
 * CASCADE no FK). Não toca em arquivos do Supabase Storage — admin pode
 * limpar manualmente se quiser.
 *
 * Redireciona pra /admin depois — então invocado a partir de /admin/[id].
 */
export async function deleteClientAction(formData: FormData) {
  const urlKey = keyParamOf(formData);
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Destrutivo — "basico" nunca apaga cliente, nem os que estão marcados
  // pra ele (diferente das ações operacionais, que só restringem por
  // visibilidade). Exige acesso total mesmo.
  if (!hasFullAccess(member)) {
    redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const service = createSupabaseServiceRoleClient();
  // Sem checar o erro, um delete barrado por FK/RLS ainda redirecionava pra
  // lista "como se" tivesse apagado — e o cliente continuava lá.
  const { error: delErr } = await service
    .from("clients")
    .delete()
    .eq("id", clientId);
  if (delErr) {
    logServerError("deleteClientAction", delErr);
    redirect(
      `/admin/${clientId}?erro=nao-apagou${urlKey ? `&key=${encodeURIComponent(urlKey)}` : ""}`
    );
  }

  revalidatePath("/admin");
  redirect(
    `/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`
  );
}

/**
 * Cria um cliente manualmente pelo admin (pra cliente que não vai
 * passar pelo fluxo público / Tela 1). Faz dedup por WhatsApp normalizado:
 * se já existe um cliente com o mesmo número, redireciona pra ele.
 *
 * Redireciona pra /admin/[novo-id] depois.
 */
export async function createClientAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Mesma regra da tela /admin/novo: criar cliente é ato comercial.
  if (!hasFullAccess(member))
    redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);

  function val(key: string): string {
    return String(formData.get(key) ?? "").trim();
  }

  const nome = val("nome");
  const whatsapp = val("whatsapp");
  if (!nome || !whatsapp) return;

  const email = val("email");
  const empresa = val("empresa");
  const projectTypeRaw = val("project_type");
  const allowedTypes = [
    "landing-com-copy",
    "landing-sem-copy",
    "site-completo",
    "seo",
    "outro",
  ];
  const projectType = allowedTypes.includes(projectTypeRaw)
    ? projectTypeRaw
    : null;

  const service = createSupabaseServiceRoleClient();
  const keySuffix = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  // Dedup por WhatsApp normalizado (só dígitos)
  const digits = whatsapp.replace(/\D/g, "");
  const { data: candidates } = await service
    .from("clients")
    .select("id, whatsapp");
  const found = (candidates ?? []).find(
    (c) => (c.whatsapp ?? "").replace(/\D/g, "") === digits
  );

  if (found) {
    revalidatePath("/admin");
    redirect(`/admin/${found.id}${keySuffix}`);
  }

  const { data: created, error: insertErr } = await service
    .from("clients")
    .insert({
      nome,
      email: email || "",
      empresa: empresa || "",
      whatsapp,
      project_type: projectType,
      magic_slug: generateMagicSlug({ nome, empresa: empresa || null }),
    })
    .select("id")
    .single();

  if (insertErr || !created) {
    // Volta pro form com ?erro= pra a tela explicar o que houve — antes
    // voltava mudo e o admin via o form em branco sem saber por quê.
    logServerError("createClient.insert", insertErr);
    const sep = keySuffix ? "&" : "?";
    redirect(`/admin/novo${keySuffix}${sep}erro=criar`);
  }

  // Cria pasta no Google Drive (no-op se envs não configuradas).
  // Fire-and-forget no caminho feliz — não bloqueia o redirect.
  try {
    const folders = await createClientFolders(nome, created!.id);
    if (folders) {
      const { error: escritaErr } = await service
        .from("clients")
        .update({
          fysi_drive_link: folders.rootUrl,
          google_drive_folders: folders,
        })
        .eq("id", created!.id);
      if (escritaErr) logServerError("cliente.escrita", escritaErr);
    }
  } catch (err) {
    console.warn("[createClient] Drive folder failed:", err);
  }

  // Webhook outbound: novo cliente cadastrado.
  const { data: fresh } = await service
    .from("clients")
    .select(
      "id, nome, email, empresa, whatsapp, cpf, cnpj, razao_social, endereco, cep, project_type"
    )
    .eq("id", created!.id)
    .maybeSingle();
  if (fresh) {
    void sendDashboardWebhook({
      event: "cliente.criado",
      emittedAt: new Date().toISOString(),
      source: "briefing_app",
      clientId: created!.id,
      cliente: buildClientePayload(fresh),
    });
  }

  // Avisa o admin: projeto novo (gatilho pra postar nos Stories). after()
  // garante que roda mesmo após o redirect() (que lança internamente).
  const finalClientId = created!.id;
  const titulo = empresa || nome;
  after(async () => {
    await createAdminNotification({
      clientId: finalClientId,
      kind: "projeto.novo",
      title: `Novo projeto: ${titulo}`,
      message: "Tap pra ver os dados",
    });
  });

  revalidatePath("/admin");
  redirect(`/admin/${created!.id}${keySuffix}`);
}

/**
 * Toggle do chamada_agendada_at (admin marca/desmarca chamada como feita).
 */
export async function toggleChamadaFeitaAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("chamada_agendada_at")
    .eq("id", clientId)
    .maybeSingle();
  const { error: escritaErr } = await service
    .from("clients")
    .update({
      chamada_agendada_at: (data as { chamada_agendada_at: string | null })
        ?.chamada_agendada_at
        ? null
        : new Date().toISOString(),
    })
    .eq("id", clientId);
  if (escritaErr) logServerError("cliente.escrita", escritaErr);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Toggle do briefing_submitted_at (admin marca/desmarca briefing como concluído).
 */
export async function toggleBriefingConcluidoAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("briefing_submitted_at")
    .eq("id", clientId)
    .maybeSingle();
  const wasSubmitted = !!(
    data as { briefing_submitted_at: string | null } | null
  )?.briefing_submitted_at;

  const { error: escritaErr } = await service
    .from("clients")
    .update({
      briefing_submitted_at: wasSubmitted ? null : new Date().toISOString(),
    })
    .eq("id", clientId);
  if (escritaErr) logServerError("cliente.escrita", escritaErr);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Salva o moodboard do projeto. Opcional — só projetos que precisam de
 * alinhamento de mood antes do design.
 */
export async function setMoodboardAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  const raw = String(formData.get("moodboardJson") ?? "").trim();
  if (!raw) return;

  let parsed: Moodboard;
  try {
    parsed = JSON.parse(raw) as Moodboard;
  } catch (err) {
    // JSON malformado: nada é gravado. Sem log isso sumia — e a tela ainda
    // mostrava "Salvo ✓".
    logServerError("moodboard.json-invalido", err);
    return;
  }

  const service = createSupabaseServiceRoleClient();
  const { error: escritaErr } = await service
    .from("clients")
    .update({
      moodboard_data: parsed,
      moodboard_atualizado_at: new Date().toISOString(),
    })
    .eq("id", clientId);
  if (escritaErr) logServerError("cliente.escrita", escritaErr);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Salva o Documento de Entrega (acessos, tutoriais, backups, garantia).
 * Quando o admin marca "Finalizar entrega", também preenche
 * entrega_finalizada_at — gatilho que mostra o doc no painel do cliente.
 */
export async function setEntregaAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  const raw = String(formData.get("entregaJson") ?? "").trim();
  const finalizar = formData.get("finalizar") === "1";
  if (!raw && !finalizar) return;

  const updates: Record<string, unknown> = {};

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as EntregaDocumento;
      updates.entrega_documento = parsed;
    } catch (err) {
      logServerError("entrega.json-invalido", err);
      return;
    }
  }

  if (finalizar) {
    updates.entrega_finalizada_at = new Date().toISOString();
    updates.status = "completo-entregue";
  } else if (formData.get("desfazerFinalizacao") === "1") {
    updates.entrega_finalizada_at = null;
  }

  if (Object.keys(updates).length === 0) return;

  const service = createSupabaseServiceRoleClient();
  const { error: entregaErr } = await service
    .from("clients")
    .update(updates)
    .eq("id", clientId);
  if (entregaErr) logServerError("setEntregaAction", entregaErr);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Salva o link da copy pra cliente revisar (aparece no dashboard, na etapa
 * "Criação da copy" da timeline).
 */
export async function setCopyReviewLinkAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  let link = String(formData.get("copyReviewLink") ?? "").trim();
  // Se veio sem protocolo (ex: "docs.google.com/..."), prefixa https:// —
  // antes esse caso era descartado silenciosamente (salvava null) enquanto a
  // UI dizia "salvo". Vazio limpa o link.
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  const value = link ? link.slice(0, 1000) : null;

  const service = createSupabaseServiceRoleClient();
  const { error: escritaErr } = await service
    .from("clients")
    .update({ copy_review_link: value })
    .eq("id", clientId);
  if (escritaErr) logServerError("cliente.escrita", escritaErr);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Atualiza o status do projeto principal do cliente — mesma taxonomia de 14
 * valores usada pelas tarefas internas (TASK_STATUS_OPTIONS).
 */
export async function setClientStatusAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const status = String(formData.get("status") ?? "");
  // Lista de PROJETO, não a geral: "em-andamento" é só de demanda interna e
  // o CHECK de clients.status o recusa.
  if (!clientId || !PROJECT_STATUS_VALUES.includes(status as TaskStatus)) return;
  await requireClientAccess(formData, clientId);

  const service = createSupabaseServiceRoleClient();
  const { error: escritaErr } = await service
    .from("clients")
    .update({ status })
    .eq("id", clientId);
  if (escritaErr) logServerError("cliente.escrita", escritaErr);

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin");
}

/** Lê label/hint/tipo/opcoes do formulário de pergunta específica. */
function parseCustomQuestionFields(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const hint = String(formData.get("hint") ?? "").trim();
  const tipoRaw = String(formData.get("tipo") ?? "texto-longo");
  const tipo =
    tipoRaw === "texto-curto" || tipoRaw === "escolha"
      ? tipoRaw
      : "texto-longo";
  // Opções: uma por linha, só usadas quando tipo = "escolha".
  const opcoes =
    tipo === "escolha"
      ? String(formData.get("opcoes") ?? "")
          .split("\n")
          .map((o) => o.trim())
          .filter(Boolean)
      : [];
  return { label, hint, tipo, opcoes };
}

/**
 * Perguntas específicas do cliente — adiciona uma pergunta sob medida que vai
 * aparecer como bloco extra no briefing daquele cliente.
 */
export async function addCustomQuestionAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const { label, hint, tipo, opcoes } = parseCustomQuestionFields(formData);
  if (!clientId || !label) return;
  await requireClientAccess(formData, clientId);

  const service = createSupabaseServiceRoleClient();
  // (maior ordem) + 1 — count subestimaria se houver buracos de deletes.
  const { data: maxRow } = await service
    .from("client_custom_questions")
    .select("ordem")
    .eq("client_id", clientId)
    .order("ordem", { ascending: false })
    .limit(1);
  const nextOrdem =
    (Array.isArray(maxRow) && maxRow.length
      ? Number((maxRow[0] as { ordem: number }).ordem ?? -1)
      : -1) + 1;

  const { error: perguntaErr } = await service
    .from("client_custom_questions")
    .insert({
      client_id: clientId,
      label,
      hint: hint || null,
      tipo,
      opcoes,
      ordem: nextOrdem,
    });
  // Pergunta que não entrou nunca chega ao briefing do cliente.
  if (perguntaErr) logServerError("addCustomQuestionAction", perguntaErr);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Perguntas específicas do cliente — edita uma pergunta existente.
 */
export async function updateCustomQuestionAction(formData: FormData) {
  const questionId = String(formData.get("questionId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const { label, hint, tipo, opcoes } = parseCustomQuestionFields(formData);
  if (!questionId || !label) return;
  if (clientId) await requireClientAccess(formData, clientId);
  else {
    const urlKey = keyParamOf(formData);
    if (!(await getCurrentMember({ urlKey }))) redirect("/admin/login");
  }

  const service = createSupabaseServiceRoleClient();
  const { error: escritaErr } = await service
    .from("client_custom_questions")
    .update({ label, hint: hint || null, tipo, opcoes })
    .eq("id", questionId);
  if (escritaErr) logServerError("cliente.escrita", escritaErr);

  if (clientId) revalidatePath(`/admin/${clientId}`);
}

/**
 * Perguntas específicas — move uma pergunta pra cima/baixo. Renumera a lista
 * (ordem = índice) pra manter a sequência limpa.
 */
export async function moveCustomQuestionAction(formData: FormData) {
  const questionId = String(formData.get("questionId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (clientId) await requireClientAccess(formData, clientId);
  else {
    const urlKey = keyParamOf(formData);
    if (!(await getCurrentMember({ urlKey }))) redirect("/admin/login");
  }
  const direction = String(formData.get("direction") ?? "");
  if (
    !questionId ||
    !clientId ||
    (direction !== "up" && direction !== "down")
  ) {
    return;
  }

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("client_custom_questions")
    .select("id, ordem")
    .eq("client_id", clientId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  const list = (data as { id: string; ordem: number }[] | null) ?? [];
  const idx = list.findIndex((q) => q.id === questionId);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return;

  const reordered = [...list];
  const tmp = reordered[idx];
  reordered[idx] = reordered[swapIdx];
  reordered[swapIdx] = tmp;

  for (let i = 0; i < reordered.length; i++) {
    if (reordered[i].ordem !== i) {
      const { error: escritaErr } = await service
        .from("client_custom_questions")
        .update({ ordem: i })
        .eq("id", reordered[i].id);
      if (escritaErr) logServerError("cliente.escrita", escritaErr);
    }
  }

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Perguntas específicas do cliente — remove uma pergunta.
 */
export async function deleteCustomQuestionAction(formData: FormData) {
  const questionId = String(formData.get("questionId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!questionId) return;
  if (clientId) await requireClientAccess(formData, clientId);
  else {
    const urlKey = keyParamOf(formData);
    if (!(await getCurrentMember({ urlKey }))) redirect("/admin/login");
  }

  const service = createSupabaseServiceRoleClient();
  const { error: escritaErr } = await service
    .from("client_custom_questions")
    .delete()
    .eq("id", questionId);
  if (escritaErr) logServerError("cliente.escrita", escritaErr);

  if (clientId) revalidatePath(`/admin/${clientId}`);
}

const TASK_STATUS_VALUES = TASK_STATUS_OPTIONS.map((o) => o.value);
const PROJECT_STATUS_VALUES = PROJECT_STATUS_OPTIONS.map((o) => o.value);
const TASK_PRIORITY_VALUES = TASK_PRIORITY_OPTIONS.map((o) => o.value).filter(
  Boolean
);
const TEAM_MEMBER_VALUES = TEAM_MEMBERS.map((m) => m.value);

/** Status inicial não-default por título do template — ver DEFAULT_PROJECT_TASKS. */
const SEED_STATUS_OVERRIDES: Partial<Record<string, TaskStatus>> = {
  "Envio Contrato": "onboarding",
  Pagamento: "onboarding",
  "Informações Iniciais": "envio-informacoes",
};

/**
 * Gera as tarefas do template a partir do project_type do cliente.
 * Idempotente: não faz nada se já houver alguma tarefa (evita duplicar
 * se o admin clicar duas vezes ou o tipo mudar depois).
 */
export async function seedProjectTasksAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  const service = createSupabaseServiceRoleClient();

  const { data: client } = await service
    .from("clients")
    .select("project_type")
    .eq("id", clientId)
    .maybeSingle();
  const projectType = (
    client as { project_type: ProjectType | null } | null
  )?.project_type;
  if (!projectType) return;

  const { count } = await service
    .from("project_tasks")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  if ((count ?? 0) > 0) return;

  const titulos = DEFAULT_PROJECT_TASKS[projectType] ?? [];
  if (titulos.length === 0) return;

  const { error: seedErr } = await service.from("project_tasks").insert(
    titulos.map((titulo, i) => ({
      client_id: clientId,
      titulo,
      ordem: i,
      origem: "template" as const,
      status: SEED_STATUS_OVERRIDES[titulo] ?? DEFAULT_TASK_STATUS,
    }))
  );
  // Sem isto, "Gerar tarefas do template" não gerava nada e a tela ficava
  // igual — dava pra clicar de novo e de novo sem entender.
  if (seedErr) logServerError("seedProjectTasksAction", seedErr);

  revalidatePath(`/admin/${clientId}`);
}

export type AddProjectTaskResult =
  | { ok: true; id: string }
  | { ok: false; erro: string };

const TASK_TITLE_MAX = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Cria uma tarefa ad-hoc (fora do template), já com responsável, prazo e
 * prioridade — como o "+ Add task" do ClickUp. Antes só aceitava o título:
 * a tarefa nascia sem dono e sem data, e cada campo virava um segundo clique
 * na linha recém-criada.
 *
 * `clientId` vazio = demanda interna da agência (sem ficha de cliente).
 *
 * Devolve resultado em vez de falhar em silêncio: quem digitou precisa saber
 * se a tarefa existe ou não.
 */
export async function addProjectTaskAction(
  formData: FormData
): Promise<AddProjectTaskResult> {
  const clientId = String(formData.get("clientId") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return { ok: false, erro: "Dê um nome pra tarefa." };
  if (titulo.length > TASK_TITLE_MAX) {
    return { ok: false, erro: `Nome muito longo (máx. ${TASK_TITLE_MAX}).` };
  }

  const member = clientId
    ? await requireClientAccess(formData, clientId)
    : await getCurrentMember({ urlKey: keyParamOf(formData) });
  if (!member) redirect("/admin/login");

  let responsavel = String(formData.get("responsavel") ?? "").trim();
  if (responsavel && !TEAM_MEMBER_VALUES.includes(responsavel)) {
    return { ok: false, erro: "Responsável inválido." };
  }
  // Papel com escopo por tarefa ("basico", "desenvolvedor") só edita tarefa
  // em que ELE é o responsável (canEditTask). Criar pra outra pessoa — ou
  // sem dono — geraria uma tarefa que ele mesmo não consegue mais mexer.
  if (hasTaskScopedRole(member)) {
    if (!member.taskValue) {
      return {
        ok: false,
        erro: "Sua conta não está ligada a um responsável de tarefas.",
      };
    }
    responsavel = member.taskValue;
  }
  if (!responsavel) responsavel = donoPadraoDe(titulo) ?? "";

  const prioridade = String(formData.get("prioridade") ?? "").trim();
  if (prioridade && !TASK_PRIORITY_VALUES.includes(prioridade)) {
    return { ok: false, erro: "Prioridade inválida." };
  }

  const dataVencimento = String(formData.get("dataVencimento") ?? "").trim();
  if (dataVencimento && !DATE_RE.test(dataVencimento)) {
    return { ok: false, erro: "Data de vencimento inválida." };
  }

  // Matriz de Eisenhower e tamanho da tarefa — os dois opcionais.
  const eisenhower = String(formData.get("eisenhower") ?? "").trim();
  if (eisenhower && !EISENHOWER_VALUES.includes(eisenhower)) {
    return { ok: false, erro: "Quadrante inválido." };
  }
  const esforco = String(formData.get("esforco") ?? "").trim();
  if (esforco && !ESFORCO_VALUES.includes(esforco)) {
    return { ok: false, erro: "Tamanho de tarefa inválido." };
  }
  // Repetição é de trabalho interno: tarefa de projeto acontece uma vez só.
  const recorrencia = String(formData.get("recorrencia") ?? "").trim();
  if (recorrencia && !RECORRENCIA_VALUES.includes(recorrencia)) {
    return { ok: false, erro: "Cadência inválida." };
  }
  if (recorrencia && clientId) {
    return { ok: false, erro: "Tarefa de cliente não se repete." };
  }

  // Área só existe pra demanda INTERNA. Numa demanda de cliente ela seria
  // uma segunda classificação concorrendo com o próprio cliente.
  const area = String(formData.get("area") ?? "").trim();
  if (area && !AREA_VALUES.includes(area)) {
    return { ok: false, erro: "Área inválida." };
  }
  if (area && clientId) {
    return {
      ok: false,
      erro: "Demanda de cliente não tem área — a área é do trabalho interno.",
    };
  }

  const service = createSupabaseServiceRoleClient();
  const ordemQuery = service.from("project_tasks").select("ordem");
  const { data: maxRow } = await (clientId
    ? ordemQuery.eq("client_id", clientId)
    : ordemQuery.is("client_id", null)
  )
    .order("ordem", { ascending: false })
    .limit(1);
  const nextOrdem =
    (Array.isArray(maxRow) && maxRow.length
      ? Number((maxRow[0] as { ordem: number }).ordem ?? -1)
      : -1) + 1;

  const { data, error } = await service
    .from("project_tasks")
    .insert({
      client_id: clientId || null,
      titulo,
      ordem: nextOrdem,
      origem: "manual",
      responsavel: responsavel || null,
      prioridade: prioridade || null,
      data_vencimento: dataVencimento || null,
      area: clientId ? null : area || null,
      eisenhower: eisenhower || null,
      esforco: esforco || null,
      recorrencia: clientId ? null : recorrencia || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    logServerError("addProjectTaskAction", error ?? new Error("sem linha"));
    return { ok: false, erro: "Não consegui salvar a tarefa. Tente de novo." };
  }

  const novaId = String((data as { id: string }).id);
  if (responsavel && responsavel !== member.taskValue) {
    const quem = member.taskValue;
    after(async () => {
      const onde = await nomeDoCliente(clientId || null);
      await notifyMember({
        recipient: responsavel,
        actor: quem,
        kind: "tarefa.atribuida",
        taskId: novaId,
        clientId: clientId || null,
        title: titulo,
        message: `${nomeDoMembro(quem)} criou esta demanda pra você · ${onde}`,
      });
    });
  }

  if (clientId) revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin/tarefas");
  revalidatePath("/admin/meu-trabalho");
  revalidatePath("/admin/lista");
  revalidatePath("/admin/visao-geral");
  revalidatePath("/admin/demandas");
  return { ok: true, id: novaId };
}

/**
 * Um membro "basico" (ex: designer) só edita/apaga/comenta tarefas em que
 * ELE é o responsável — outras tarefas do mesmo projeto (de outra pessoa)
 * ficam só-leitura pra ele, mesmo que o projeto em si seja visível.
 * Pedido do usuário (2026-08-31): "quem pode editar vs só ver".
 * admin/avancado/legacy sempre podem editar.
 */
async function canEditTask(
  member: Member,
  taskId: string
): Promise<boolean> {
  if (!hasTaskScopedRole(member)) return true;
  if (!member.taskValue) return false;
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("responsavel")
    .eq("id", taskId)
    .maybeSingle();
  return (data as { responsavel: string | null } | null)?.responsavel === member.taskValue;
}

/** Nome curto do cliente pra mensagem do aviso ("— interno —" sem cliente). */
async function nomeDoCliente(clientId: string | null): Promise<string> {
  if (!clientId) return "demanda interna";
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("nome, empresa")
    .eq("id", clientId)
    .maybeSingle();
  const c = data as { nome: string | null; empresa: string | null } | null;
  return c?.empresa || c?.nome || "cliente";
}

/**
 * Remove uma tarefa.
 */
export type RemoveTaskResult = { ok: true } | { ok: false; erro: string };

/**
 * Apaga uma tarefa. Pedido da Karine (22/09): "poder excluir tarefas
 * erradas" — o botão existia só na tabela de Tarefas; Demandas internas e
 * Meu Trabalho não tinham como.
 *
 * Devolve resultado em vez de void: recusa de permissão e erro de banco
 * voltavam em silêncio, e a linha sumia da tela pra reaparecer no
 * próximo carregamento.
 */
export async function removeProjectTaskAction(
  formData: FormData
): Promise<RemoveTaskResult> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const taskId = String(formData.get("taskId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!taskId) return { ok: false, erro: "Tarefa não identificada." };
  if (!(await canEditTask(member, taskId))) {
    return { ok: false, erro: "Você só apaga tarefa em que é o responsável." };
  }

  const service = createSupabaseServiceRoleClient();
  const { error: remErr } = await service
    .from("project_tasks")
    .delete()
    .eq("id", taskId);
  if (remErr) {
    logServerError("removeProjectTaskAction", remErr);
    return { ok: false, erro: "Não consegui apagar. Confira a conexão e tente de novo." };
  }

  if (clientId) revalidatePath(`/admin/${clientId}`);
  // Demanda interna não tem cliente — mora nestas telas.
  revalidatePath("/admin/demandas");
  revalidatePath("/admin/meu-trabalho");
  revalidatePath("/admin/tarefas");
  return { ok: true };
}

/**
 * Atualização parcial de uma tarefa — só grava os campos presentes no
 * FormData (mesmo padrão de setClientContractDataAction). Usado pra editar
 * status/prioridade/responsável/datas inline, um de cada vez.
 */
/**
 * Resultado da edição de um campo da tarefa.
 *
 * Antes isto devolvia `void` e cada recusa era um `return` seco: papel sem
 * permissão, valor fora da lista, erro do banco — tudo terminava igual, em
 * silêncio. Quem editava via o campo com o valor novo na tela e ia embora
 * achando que tinha salvado; só descobria no próximo carregamento, quando o
 * valor antigo voltava. Agora a recusa tem nome e a tela desfaz.
 */
export type UpdateTaskResult =
  /** `proximaEm` vem preenchido quando concluir gerou a próxima ocorrência. */
  | { ok: true; proximaEm?: string }
  | { ok: false; erro: string };

export async function updateProjectTaskAction(
  formData: FormData
): Promise<UpdateTaskResult> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const taskId = String(formData.get("taskId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!taskId) return { ok: false, erro: "Tarefa não identificada." };
  if (!(await canEditTask(member, taskId))) {
    return { ok: false, erro: "Você só edita tarefa em que é o responsável." };
  }

  // Estado anterior: é a diferença que vira aviso ("passou pra você",
  // "mudou o prazo"). Sem ele não dá pra saber o que de fato mudou.
  const antes = await (async () => {
    const service = createSupabaseServiceRoleClient();
    const { data } = await service
      .from("project_tasks")
      .select(
        "titulo, client_id, responsavel, status, data_vencimento, area, prioridade, eisenhower, esforco, ordem, recorrencia, recorrencia_origem, observacoes"
      )
      .eq("id", taskId)
      .maybeSingle();
    return data as {
      titulo: string;
      client_id: string | null;
      responsavel: string | null;
      status: string | null;
      data_vencimento: string | null;
      area: string | null;
      prioridade: string | null;
      eisenhower: string | null;
      esforco: string | null;
      ordem: number | null;
      recorrencia: string | null;
      recorrencia_origem: string | null;
      observacoes: string | null;
    } | null;
  })();

  const update: Record<string, unknown> = {};

  // Renomear — antes o título só existia na criação; pra corrigir um erro de
  // digitação era preciso apagar a tarefa (e perder comentários e datas).
  if (formData.has("titulo")) {
    const titulo = String(formData.get("titulo") ?? "").trim();
    if (!titulo || titulo.length > TASK_TITLE_MAX) {
      return { ok: false, erro: `O nome precisa ter de 1 a ${TASK_TITLE_MAX} caracteres.` };
    }
    update.titulo = titulo;
  }

  if (formData.has("status")) {
    const status = String(formData.get("status") ?? "");
    if (!TASK_STATUS_VALUES.includes(status as TaskStatus)) {
      return { ok: false, erro: "Status inválido." };
    }
    update.status = status;
    // Grupo "fechado" (hoje só "completo-entregue") marca concluida_em e é
    // o que faz a data de vencimento parar de ser destacada como atrasada
    // na UI (ver TaskRow no Task 5). Fechar != arquivar — não existe
    // arquivamento nesta rodada.
    update.concluida_em =
      TASK_STATUS_GROUP[status as TaskStatus] === "fechado"
        ? new Date().toISOString()
        : null;
  }

  if (formData.has("prioridade")) {
    const prioridade = String(formData.get("prioridade") ?? "");
    if (prioridade && !TASK_PRIORITY_VALUES.includes(prioridade)) {
      return { ok: false, erro: "Prioridade inválida." };
    }
    update.prioridade = prioridade || null;
  }

  if (formData.has("responsavel")) {
    const responsavel = String(formData.get("responsavel") ?? "");
    if (responsavel && !TEAM_MEMBER_VALUES.includes(responsavel)) {
      return { ok: false, erro: "Responsável inválido." };
    }
    update.responsavel = responsavel || null;
  }

  if (formData.has("dataInicial")) {
    update.data_inicial = String(formData.get("dataInicial") ?? "").trim() || null;
  }

  if (formData.has("dataVencimento")) {
    update.data_vencimento =
      String(formData.get("dataVencimento") ?? "").trim() || null;
  }

  if (formData.has("area")) {
    const area = String(formData.get("area") ?? "").trim();
    if (area && !AREA_VALUES.includes(area)) {
      return { ok: false, erro: "Área inválida." };
    }
    // Nunca deixa uma demanda de cliente ganhar área (ver addProjectTaskAction).
    if (area && antes?.client_id) {
      return { ok: false, erro: "Demanda de cliente não tem área." };
    }
    update.area = area || null;
  }

  if (formData.has("eisenhower")) {
    const q = String(formData.get("eisenhower") ?? "").trim();
    if (q && !EISENHOWER_VALUES.includes(q)) {
      return { ok: false, erro: "Quadrante inválido." };
    }
    update.eisenhower = q || null;
  }

  if (formData.has("esforco")) {
    const e = String(formData.get("esforco") ?? "").trim();
    if (e && !ESFORCO_VALUES.includes(e)) {
      return { ok: false, erro: "Tamanho de tarefa inválido." };
    }
    update.esforco = e || null;
  }

  if (formData.has("recorrencia")) {
    const r = String(formData.get("recorrencia") ?? "").trim();
    if (r && !RECORRENCIA_VALUES.includes(r)) {
      return { ok: false, erro: "Cadência inválida." };
    }
    // Repetição é de trabalho interno da agência: uma tarefa de PROJETO não
    // se repete, ela acontece uma vez por projeto.
    if (r && antes?.client_id) {
      return { ok: false, erro: "Tarefa de cliente não se repete." };
    }
    update.recorrencia = r || null;
  }

  if (formData.has("observacoes")) {
    update.observacoes = String(formData.get("observacoes") ?? "").trim() || null;
  }

  // Nada mudou: não é erro, é toque sem efeito.
  if (Object.keys(update).length === 0) return { ok: true };

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("project_tasks")
    .update(update)
    .eq("id", taskId);
  if (error) {
    logServerError("updateProjectTaskAction", error);
    return { ok: false, erro: "Não consegui salvar. Confira a conexão e tente de novo." };
  }

  // Demanda recorrente concluída gera a próxima. Aqui e não num agendador
  // porque o app não tem cron; e não ao abrir a tela porque isso seria
  // efeito colateral num GET, que o prefetch do <Link> dispararia sozinho.
  const virouFechada =
    typeof update.status === "string" &&
    TASK_STATUS_GROUP[update.status as TaskStatus] === "fechado" &&
    antes?.status != null &&
    TASK_STATUS_GROUP[antes.status as TaskStatus] !== "fechado";

  let proximaCriada: string | null = null;
  if (virouFechada && antes?.recorrencia && !antes.client_id) {
    const proxima = proximaOcorrencia(
      antes.recorrencia,
      antes.data_vencimento,
      hojeEmBrasilia()
    );
    if (proxima) {
      // A série aponta sempre pra PRIMEIRA demanda: seguir a corrente elo a
      // elo se perderia se alguém apagasse uma ocorrência do meio.
      const origem = antes.recorrencia_origem ?? taskId;
      const { error: erroProxima } = await service.from("project_tasks").insert({
        client_id: null,
        titulo: antes.titulo,
        area: antes.area,
        ordem: antes.ordem ?? 0,
        origem: "manual",
        status: DEFAULT_TASK_STATUS,
        responsavel: antes.responsavel,
        prioridade: antes.prioridade,
        eisenhower: antes.eisenhower,
        esforco: antes.esforco,
        observacoes: antes.observacoes,
        data_vencimento: proxima,
        recorrencia: antes.recorrencia,
        recorrencia_origem: origem,
      });
      // Índice único (recorrencia_origem, data_vencimento) barra a segunda
      // cópia quando alguém reabre e conclui a mesma ocorrência de novo.
      // Isso NÃO é erro: é a guarda funcionando.
      if (erroProxima && erroProxima.code !== "23505") {
        logServerError("updateProjectTaskAction.recorrencia", erroProxima);
      } else if (!erroProxima) {
        proximaCriada = proxima;
      }
    }
  }

  // Avisos da demanda — depois de gravar, e só do que mudou de verdade.
  // `after()` porque o aviso não pode atrasar a resposta do campo editado.
  if (!error && antes) {
    const quem = member.taskValue;
    after(async () => {
      const onde = await nomeDoCliente(antes.client_id);
      const novoResp = update.responsavel as string | null | undefined;
      if (novoResp !== undefined && novoResp !== antes.responsavel) {
        await notifyMember({
          recipient: novoResp,
          actor: quem,
          kind: "tarefa.atribuida",
          taskId,
          clientId: antes.client_id,
          title: antes.titulo,
          message: `${nomeDoMembro(quem)} passou esta demanda pra você · ${onde}`,
        });
      }
      // Status e prazo avisam QUEM É DONO da tarefa (o responsável que ficou
      // valendo), não o de antes — se acabou de trocar de mão, o aviso de
      // atribuição acima já cobre.
      const dono = (novoResp ?? antes.responsavel) as string | null;
      if (novoResp === undefined || novoResp === antes.responsavel) {
        if (update.status && update.status !== antes.status) {
          await notifyMember({
            recipient: dono,
            actor: quem,
            kind: "tarefa.status",
            taskId,
            clientId: antes.client_id,
            title: antes.titulo,
            message: `${nomeDoMembro(quem)} mudou o status para "${statusLabel(String(update.status))}" · ${onde}`,
          });
        }
        if (
          "data_vencimento" in update &&
          update.data_vencimento !== antes.data_vencimento
        ) {
          const novo = update.data_vencimento as string | null;
          await notifyMember({
            recipient: dono,
            actor: quem,
            kind: "tarefa.prazo",
            taskId,
            clientId: antes.client_id,
            title: antes.titulo,
            message: novo
              ? `Prazo agora é ${formatDiaMesCurto(novo)} · ${onde}`
              : `${nomeDoMembro(quem)} removeu o prazo · ${onde}`,
          });
        }
      }
    });
  }

  if (clientId) revalidatePath(`/admin/${clientId}`);
  // Editar direto no accordion da Lista por status/Visão Geral (ver
  // status-pie-board.tsx) também precisa revalidar essas telas — status de
  // tarefa pode mudar a lane do cliente (laneForClient usa a tarefa atual).
  revalidatePath("/admin/lista");
  revalidatePath("/admin/visao-geral");
  revalidatePath("/admin/demandas");

  return proximaCriada ? { ok: true, proximaEm: proximaCriada } : { ok: true };
}

/**
 * Reordena tarefas por drag-and-drop (igual ClickUp). Recebe a nova ordem de
 * um subconjunto de tarefas do cliente (pode ser todas, ou só as "abertas")
 * e realoca a `ordem` de cada uma pro slot correspondente dentro do próprio
 * subconjunto — preserva a posição relativa de tarefas fora da lista.
 */
/**
 * Reordena as tarefas de um cliente. Devolve resultado: a tela mantém uma
 * ordem otimista enquanto salva, e recusa em silêncio deixava a lista
 * mentindo pelo resto da sessão (só um recarregamento desfazia).
 */
export type ReorderResult = { ok: true } | { ok: false; erro: string };

export async function reorderProjectTasksAction(
  formData: FormData
): Promise<ReorderResult> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  const orderedIds = formData
    .getAll("taskId")
    .map((v) => String(v))
    .filter(Boolean);
  if (!clientId || orderedIds.length < 2) return { ok: true };

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("id, ordem, responsavel")
    .eq("client_id", clientId)
    .in("id", orderedIds);
  const rows = (data ?? []) as {
    id: string;
    ordem: number;
    responsavel: string | null;
  }[];
  if (rows.length !== orderedIds.length) {
    return { ok: false, erro: "A lista mudou enquanto você arrastava. Recarregue." };
  }
  // "basico" só reordena entre tarefas que são todas dele — misturar com
  // tarefa de outra pessoa no mesmo arrasto é rejeitado inteiro (mais
  // simples e seguro do que reordenar parcialmente).
  if (
    hasTaskScopedRole(member) &&
    (!member.taskValue || rows.some((r) => r.responsavel !== member.taskValue))
  ) {
    return { ok: false, erro: "Você só reordena entre tarefas suas." };
  }

  const slots = rows.map((r) => r.ordem).sort((a, b) => a - b);
  const byId = new Map(rows.map((r) => [r.id, r]));

  await Promise.all(
    orderedIds.map((id, i) => {
      const row = byId.get(id);
      if (!row || row.ordem === slots[i]) return null;
      return service
        .from("project_tasks")
        .update({ ordem: slots[i] })
        .eq("id", id);
    })
  );

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin/lista");
  revalidatePath("/admin/visao-geral");
  revalidatePath("/admin/tarefas");

  return { ok: true };
}

export interface ProjectTaskComment {
  id: string;
  task_id: string;
  author: string;
  body: string;
  created_at: string;
}

/**
 * Confere se o membro pode ver o cliente dono da tarefa — sem isso, dava
 * pra ler/postar comentário de qualquer tarefa só estando logado, mesmo
 * fora do escopo de clientes visíveis do papel "basico" (buscava a tarefa
 * real pelo id em vez de confiar no clientId enviado pelo form).
 */
async function canAccessTaskClient(
  member: Awaited<ReturnType<typeof getCurrentMember>>,
  taskId: string
): Promise<{ clientId: string | null } | null> {
  if (!member) return null;
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("client_id, responsavel")
    .eq("id", taskId)
    .maybeSingle();
  const task = data as {
    client_id: string | null;
    responsavel: string | null;
  } | null;
  if (!task) return null;

  // Demanda interna (sem cliente) não tem ficha pra servir de escopo: vale a
  // mesma regra do "Meu Trabalho" — visão da equipe, ou é o próprio dono.
  // Antes caía no `return null` e comentário em tarefa interna nunca abria.
  if (!task.client_id) {
    const dono = !!member.taskValue && task.responsavel === member.taskValue;
    return hasFullAccess(member) || dono ? { clientId: null } : null;
  }

  const visibleIds = await getVisibleClientIds(member);
  if (visibleIds && !visibleIds.has(task.client_id)) return null;
  return { clientId: task.client_id };
}

/** Lê os comentários de uma tarefa — buscado sob demanda ao abrir o painel de informações. */
export async function getProjectTaskCommentsAction(
  taskId: string,
  urlKey?: string | null
): Promise<ProjectTaskComment[]> {
  const member = await getCurrentMember({ urlKey: urlKey ?? null });
  if (!member || !taskId) return [];
  if (!(await canAccessTaskClient(member, taskId))) return [];

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_task_comments")
    .select("id, task_id, author, body, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  return (data as ProjectTaskComment[] | null) ?? [];
}

/** Adiciona um comentário — autor é o membro logado (Caixa 0), não um campo livre. */
export async function addProjectTaskCommentAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const taskId = String(formData.get("taskId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!taskId || !body) return;

  const acesso = await canAccessTaskClient(member, taskId);
  if (!acesso) return;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("project_task_comments").insert({
    task_id: taskId,
    author: member.name,
    body,
  });
  if (error) logServerError("addProjectTaskCommentAction", error);

  // Comentário sem aviso é recado deixado num mural que ninguém olha.
  if (!error) {
    const { data: t } = await service
      .from("project_tasks")
      .select("titulo, responsavel, client_id")
      .eq("id", taskId)
      .maybeSingle();
    const tarefa = t as {
      titulo: string;
      responsavel: string | null;
      client_id: string | null;
    } | null;
    if (tarefa) {
      const quem = member.taskValue;
      after(async () => {
        await notifyMember({
          recipient: tarefa.responsavel,
          actor: quem,
          kind: "tarefa.comentario",
          taskId,
          clientId: tarefa.client_id,
          title: tarefa.titulo,
          message: `${nomeDoMembro(quem)}: ${body.length > 90 ? `${body.slice(0, 90)}…` : body}`,
        });
      });
    }
  }

  if (acesso.clientId) revalidatePath(`/admin/${acesso.clientId}`);
}

/** Remove um comentário. */
export async function deleteProjectTaskCommentAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const commentId = String(formData.get("commentId") ?? "");
  if (!commentId) return;

  const service = createSupabaseServiceRoleClient();
  const { data: comment } = await service
    .from("project_task_comments")
    .select("task_id")
    .eq("id", commentId)
    .maybeSingle();
  const taskId = (comment as { task_id: string } | null)?.task_id;
  if (!taskId) return;

  const acesso = await canAccessTaskClient(member, taskId);
  if (!acesso) return;

  const { error } = await service
    .from("project_task_comments")
    .delete()
    .eq("id", commentId);
  if (error) logServerError("deleteProjectTaskCommentAction", error);

  if (acesso.clientId) revalidatePath(`/admin/${acesso.clientId}`);
}

/* ------------------------------------------------------------------ *
 * Comprovantes de pagamento
 *
 * Cliente que paga no Pix manda o print no WhatsApp e o comprovante se
 * perde na conversa — semanas depois ninguém sabe se pagou. Aqui o
 * comprovante fica anexado ao pagamento, E o valor recebido do cliente é
 * atualizado no mesmo gesto (era o que deixava o sistema desatualizado).
 * ------------------------------------------------------------------ */

const COMPROVANTES_BUCKET = "comprovantes";
const MAX_COMPROVANTE_BYTES = 10 * 1024 * 1024;
const TIPOS_COMPROVANTE = ["image/", "application/pdf"];

export async function addPaymentReceiptAction(
  formData: FormData
): Promise<void> {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  const member = await requireClientFinanceAccess(formData, clientId);

  const valor = parseValorBR(String(formData.get("valor") ?? ""));
  if (valor <= 0) return;

  const pagoEm =
    String(formData.get("pagoEm") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const forma = String(formData.get("forma") ?? "pix");
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  const service = createSupabaseServiceRoleClient();

  // Anexo é opcional: registrar o recebimento já vale mais que não registrar
  // nada só porque o print não estava à mão na hora.
  let arquivoPath: string | null = null;
  let arquivoNome: string | null = null;
  let arquivoTipo: string | null = null;

  const file = formData.get("arquivo");
  if (file instanceof File && file.size > 0) {
    const tipoOk = TIPOS_COMPROVANTE.some((t) => file.type.startsWith(t));
    if (!tipoOk || file.size > MAX_COMPROVANTE_BYTES) {
      logServerError(
        "comprovante.arquivo-invalido",
        new Error(`tipo=${file.type} tamanho=${file.size}`)
      );
      return;
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
    const path = `${clientId}/${Date.now()}-${safe}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await service.storage
      .from(COMPROVANTES_BUCKET)
      .upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      logServerError("comprovante.upload", upErr);
      return;
    }
    arquivoPath = path;
    arquivoNome = file.name.slice(0, 200);
    arquivoTipo = file.type || null;
  }

  const { error: insErr } = await service.from("payment_receipts").insert({
    client_id: clientId,
    valor,
    pago_em: pagoEm,
    forma,
    arquivo_path: arquivoPath,
    arquivo_nome: arquivoNome,
    arquivo_tipo: arquivoTipo,
    observacao,
    registrado_por: member.name || member.email,
  });
  if (insErr) {
    logServerError("comprovante.insert", insErr);
    return;
  }

  // Mantém `pagamento_pago` em dia — é o número que a tela do cliente e as
  // Cobranças usam. Somar os comprovantes evita o passo manual que a equipe
  // esquecia de fazer.
  const { data: recibos } = await service
    .from("payment_receipts")
    .select("valor")
    .eq("client_id", clientId);
  const somaRecibos = ((recibos as { valor: number }[] | null) ?? []).reduce(
    (s, r) => s + Number(r.valor || 0),
    0
  );

  const { data: atual } = await service
    .from("clients")
    .select("pagamento_pago")
    .eq("id", clientId)
    .maybeSingle();
  const pagoAtual = Number(
    (atual as { pagamento_pago: number | null } | null)?.pagamento_pago ?? 0
  );

  // Nunca DIMINUIR: pagamentos lançados à mão antes desta tela existir não
  // têm comprovante e sumiriam do total se a soma virasse a verdade.
  const novoPago = Math.max(pagoAtual, somaRecibos);
  if (novoPago !== pagoAtual) {
    const { error: updErr } = await service
      .from("clients")
      .update({
        pagamento_pago: novoPago,
        pagamento_atualizado_at: new Date().toISOString(),
      })
      .eq("id", clientId);
    if (updErr) logServerError("comprovante.sync-pago", updErr);
  }

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin/cobrancas");
}

export async function deletePaymentReceiptAction(
  formData: FormData
): Promise<void> {
  const clientId = String(formData.get("clientId") ?? "");
  const receiptId = String(formData.get("receiptId") ?? "");
  if (!clientId || !receiptId) return;
  await requireClientFinanceAccess(formData, clientId);

  const service = createSupabaseServiceRoleClient();
  const { data: row } = await service
    .from("payment_receipts")
    .select("arquivo_path, client_id")
    .eq("id", receiptId)
    .maybeSingle();
  const recibo = row as { arquivo_path: string | null; client_id: string } | null;
  // Não deixa apagar comprovante de outro cliente passando outro clientId.
  if (!recibo || recibo.client_id !== clientId) return;

  if (recibo.arquivo_path) {
    const { error: rmErr } = await service.storage
      .from(COMPROVANTES_BUCKET)
      .remove([recibo.arquivo_path]);
    if (rmErr) logServerError("comprovante.remove-arquivo", rmErr);
  }

  const { error: delErr } = await service
    .from("payment_receipts")
    .delete()
    .eq("id", receiptId);
  if (delErr) logServerError("comprovante.delete", delErr);

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin/cobrancas");
}

/**
 * De onde o cliente veio. Grava em `como_conheceu` — a coluna que o próprio
 * cliente preenche na etapa de dados do contrato e que o relatório de
 * origem agrupa. O time corrige aqui quando descobre na conversa.
 */
export async function setClientOrigemAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await requireClientAccess(formData, clientId);

  const origem = String(formData.get("origem") ?? "").trim().slice(0, 60) || null;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("clients")
    .update({ como_conheceu: origem })
    .eq("id", clientId);
  if (error) logServerError("cliente.origem", error);

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin/clientes");
}

/** Rótulo humano de um status de tarefa ("design-pagina" → "Design da página"). */
function statusLabel(value: string): string {
  return TASK_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/**
 * Páginas do app que a demanda pode apontar — alimenta os chips de vínculo e
 * o menu do atalho "/" no campo de observações.
 *
 * Buscado sob demanda (ao abrir a demanda), não no payload da lista: são
 * duas consultas por cliente, e a tela de Tarefas mostra dezenas de linhas.
 */
export async function getTaskLinkTargetsAction(
  clientId: string | null,
  urlKey?: string | null
): Promise<LinkTarget[]> {
  const member = await getCurrentMember({ urlKey: urlKey ?? null });
  if (!member) return [];
  // Escopo por papel: "basico" não recebe atalho pra cliente que não vê.
  if (clientId) {
    const visiveis = await getVisibleClientIds(member);
    if (visiveis && !visiveis.has(clientId)) return [];
  }
  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  return listTaskLinkTargets(clientId, keyParam);
}
