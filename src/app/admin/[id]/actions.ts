"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createClickUpBriefingTask } from "@/lib/clickup";
import { htmlMagicLink, sendEmail } from "@/lib/email";
import { getServerEnv } from "@/lib/env";

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

  // Calcula stage máximo a partir do project_type. Sem chamada cara — números fixos.
  // landing-sem-copy = 5 stages (índices 0–4); demais = 6 stages (0–5).
  const maxIndex = client.project_type === "landing-sem-copy" ? 4 : 5;

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
  const allowed = ["landing-com-copy", "landing-sem-copy", "site-completo"];
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
    })
    .select("id")
    .single();

  if (insertErr || !created) {
    // Não há um caminho de erro elegante pra server action — re-tenta levando
    // pra /admin/novo com query (frontend pode mostrar mensagem genérica).
    redirect(`/admin/novo${keySuffix}`);
  }

  revalidatePath("/admin");
  redirect(`/admin/${created!.id}${keySuffix}`);
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
