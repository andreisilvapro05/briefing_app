"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createClickUpBriefingTask } from "@/lib/clickup";
import { htmlMagicLink, sendEmail } from "@/lib/email";
import { getServerEnv } from "@/lib/env";
import { generateMagicSlug } from "@/lib/slug";
import {
  buildClientePayload,
  sendDashboardWebhook,
} from "@/lib/dashboard-webhook";
import { createClientFolders } from "@/lib/google-drive";
import type { EIData } from "@/lib/ei-template";
import type { EntregaDocumento } from "@/lib/entrega";

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

  await service.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.appUrl}/auth/callback`,
      shouldCreateUser: false,
    },
  });

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
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

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
    await service
      .from("clients")
      .update({ clickup_task_id: result.taskId })
      .eq("id", clientId);
  }

  revalidatePath(`/admin/${clientId}`);
}


/**
 * Avança ou retrocede o stage do projeto. Aceita 'next', 'prev' ou número absoluto.
 */
export async function setStageAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const targetStr = String(formData.get("target") ?? "");

  if (!clientId) return;

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

  await service
    .from("clients")
    .update({ current_stage_index: next })
    .eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin");
}

/**
 * Define ou troca o tipo de projeto do cliente. Faz o pipeline do projeto
 * aparecer (e ficar editável) no admin, e o dashboard do cliente passa a
 * mostrar a timeline correta.
 */
export async function setProjectTypeAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

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

  const service = createSupabaseServiceRoleClient();
  await service
    .from("clients")
    .update({ project_type: projectType })
    .eq("id", clientId);

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
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

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

  await service.from("clients").update(update).eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Salva os links de Drive (manual). Pode salvar um ou os dois.
 * Aceita string vazia pra limpar; valida URL simples.
 */
export async function setDriveLinksAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const fysiRaw = String(formData.get("fysiDriveLink") ?? "").trim();
  const clienteRaw = String(formData.get("clienteDriveLink") ?? "").trim();

  // Sanitização leve: precisa começar com http(s):// ou ser vazio.
  function clean(v: string): string | null {
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) return null;
    return v.slice(0, 1000);
  }

  const update: Record<string, string | null> = {};
  if (formData.has("fysiDriveLink")) update.fysi_drive_link = clean(fysiRaw);
  if (formData.has("clienteDriveLink"))
    update.cliente_drive_link = clean(clienteRaw);

  if (Object.keys(update).length === 0) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("clients").update(update).eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Atualiza os campos de pagamento (total, pago, observação) do cliente.
 * Valores aceitam string com vírgula ou ponto — normalizamos pra ponto antes.
 */
export async function setPaymentAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

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
  await service
    .from("clients")
    .update({
      pagamento_total: total,
      pagamento_pago: pago ?? 0,
      pagamento_observacao: obs || null,
      pagamento_atualizado_at: new Date().toISOString(),
    })
    .eq("id", clientId);

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
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("clients").delete().eq("id", clientId);

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
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

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
      status: "em-andamento",
      magic_slug: generateMagicSlug({ nome, empresa: empresa || null }),
    })
    .select("id")
    .single();

  if (insertErr || !created) {
    // Não há um caminho de erro elegante pra server action — re-tenta levando
    // pra /admin/novo com query (frontend pode mostrar mensagem genérica).
    redirect(`/admin/novo${keySuffix}`);
  }

  // Cria pasta no Google Drive (no-op se envs não configuradas).
  // Fire-and-forget no caminho feliz — não bloqueia o redirect.
  try {
    const folders = await createClientFolders(nome, created!.id);
    if (folders) {
      await service
        .from("clients")
        .update({
          fysi_drive_link: folders.rootUrl,
          google_drive_folders: folders,
        })
        .eq("id", created!.id);
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

  revalidatePath("/admin");
  redirect(`/admin/${created!.id}${keySuffix}`);
}

/**
 * Toggle do chamada_agendada_at (admin marca/desmarca chamada como feita).
 */
export async function toggleChamadaFeitaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("chamada_agendada_at")
    .eq("id", clientId)
    .maybeSingle();
  await service
    .from("clients")
    .update({
      chamada_agendada_at: (data as { chamada_agendada_at: string | null })
        ?.chamada_agendada_at
        ? null
        : new Date().toISOString(),
    })
    .eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Toggle do briefing_submitted_at (admin marca/desmarca briefing como concluído).
 * Quando marca: também seta status = "concluido".
 */
export async function toggleBriefingConcluidoAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("briefing_submitted_at")
    .eq("id", clientId)
    .maybeSingle();
  const wasSubmitted = !!(
    data as { briefing_submitted_at: string | null } | null
  )?.briefing_submitted_at;

  await service
    .from("clients")
    .update({
      briefing_submitted_at: wasSubmitted ? null : new Date().toISOString(),
      status: wasSubmitted ? "em-andamento" : "concluido",
    })
    .eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Salva o EI (Estrutura Inicial) do projeto. JSON livre — schema definido
 * em lib/ei-template.ts, validado só superficialmente aqui (campo presente).
 */
export async function setEIAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const raw = String(formData.get("eiJson") ?? "").trim();
  if (!raw) return;

  let parsed: EIData;
  try {
    parsed = JSON.parse(raw) as EIData;
  } catch {
    return;
  }

  const service = createSupabaseServiceRoleClient();
  await service
    .from("clients")
    .update({
      ei_data: parsed,
      ei_atualizado_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Salva o Documento de Entrega (acessos, tutoriais, backups, garantia).
 * Quando o admin marca "Finalizar entrega", também preenche
 * entrega_finalizada_at — gatilho que mostra o doc no painel do cliente.
 */
export async function setEntregaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const raw = String(formData.get("entregaJson") ?? "").trim();
  const finalizar = formData.get("finalizar") === "1";
  if (!raw && !finalizar) return;

  const updates: Record<string, unknown> = {};

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as EntregaDocumento;
      updates.entrega_documento = parsed;
    } catch {
      return;
    }
  }

  if (finalizar) {
    updates.entrega_finalizada_at = new Date().toISOString();
    updates.status = "concluido";
  } else if (formData.get("desfazerFinalizacao") === "1") {
    updates.entrega_finalizada_at = null;
  }

  if (Object.keys(updates).length === 0) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("clients").update(updates).eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Salva o link da copy pra cliente revisar (aparece no dashboard, na etapa
 * "Criação da copy" da timeline).
 */
export async function setCopyReviewLinkAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const link = String(formData.get("copyReviewLink") ?? "").trim();
  // Aceita URL válida ou vazio (pra limpar).
  const value = link && /^https?:\/\//i.test(link) ? link.slice(0, 1000) : null;

  const service = createSupabaseServiceRoleClient();
  await service
    .from("clients")
    .update({ copy_review_link: value })
    .eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Atualiza o status geral do cliente (em-andamento/concluido/abandonado).
 */
export async function setClientStatusAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["nao-iniciado", "em-andamento", "concluido", "abandonado"];
  if (!clientId || !allowed.includes(status)) return;

  const service = createSupabaseServiceRoleClient();
  await service
    .from("clients")
    .update({ status })
    .eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin");
}
