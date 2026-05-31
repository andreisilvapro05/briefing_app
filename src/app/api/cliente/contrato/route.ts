import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";
import { generateMagicSlug } from "@/lib/slug";
import { createClientFolders } from "@/lib/google-drive";

/**
 * Salva os dados de contrato do cliente.
 *
 * Aceita dois modos:
 *   1) Cliente existente — passa clientId e atualiza o registro.
 *   2) Cliente novo (link público /contrato) — passa nome + whatsapp e cria
 *      um cliente novo com os dados do contrato. Dedup por WhatsApp: se já
 *      existe um cliente com esse número, reusa o registro.
 *
 * Em ambos os casos, responde com os dados básicos do cliente pra que o
 * frontend hidrate o localStorage e leve direto pro /dashboard.
 */

const Body = z
  .object({
    clientId: z.string().uuid().optional(),
    // Quando criando um novo cliente via /contrato público:
    nome: z.string().min(1).optional(),
    whatsapp: z.string().min(1).optional(),
    // Movidos da Tela 1 pra cá:
    email: z.string().email(),
    empresa: z.string().min(1),
    // Dados específicos do contrato:
    endereco: z.string().min(1),
    cep: z.string().min(1),
    cpf: z.string().min(1),
    como_conheceu: z.string().min(1),
    rg: z.string().optional(),
    cnpj: z.string().optional(),
    razao_social: z.string().optional(),
  })
  .refine(
    (v) => v.clientId || (v.nome && v.whatsapp),
    "Informe clientId OU nome+whatsapp."
  );

export async function POST(request: NextRequest) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return NextResponse.json({ mode: "demo", ok: true });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  const service = createSupabaseServiceRoleClient();

  // Resolve o cliente: ou existente (clientId), ou cria/reusa por WhatsApp.
  let clientId: string;
  let isNewClient = false;
  let existingEmail: string | null = null;

  if (parsed.clientId) {
    const { data: existing } = await service
      .from("clients")
      .select("id, email")
      .eq("id", parsed.clientId)
      .maybeSingle();
    if (!existing) return errorResponse("client-not-found", 404);
    clientId = existing.id;
    existingEmail = existing.email ?? null;
  } else {
    // Modo público — dedup por WhatsApp (normalizado pra dígitos).
    const nome = parsed.nome!;
    const whatsapp = parsed.whatsapp!;
    const digits = whatsapp.replace(/\D/g, "");

    const { data: candidates } = await service
      .from("clients")
      .select("id, whatsapp, email");
    const found = (candidates ?? []).find(
      (c) => (c.whatsapp ?? "").replace(/\D/g, "") === digits
    );

    if (found) {
      clientId = found.id;
      existingEmail = found.email ?? null;
    } else {
      const { data: created, error: insertErr } = await service
        .from("clients")
        .insert({
          nome,
          whatsapp,
          email: parsed.email,
          empresa: parsed.empresa,
          status: "em-andamento",
          magic_slug: generateMagicSlug({ nome, empresa: parsed.empresa }),
        })
        .select("id")
        .single();
      if (insertErr || !created) {
        logServerError("cliente.contrato.create", insertErr);
        return errorResponse("create-failed", 500, insertErr);
      }
      clientId = created.id;
      isNewClient = true;

      // Cria pasta no Google Drive (no-op se envs não configuradas).
      try {
        const folders = await createClientFolders(nome, created.id);
        if (folders) {
          await service
            .from("clients")
            .update({
              fysi_drive_link: folders.rootUrl,
              google_drive_folders: folders,
            })
            .eq("id", created.id);
        }
      } catch (err) {
        console.warn("[contrato] Drive folder failed:", err);
      }
    }
  }

  const emailWasEmpty = !existingEmail;

  const { error } = await service
    .from("clients")
    .update({
      email: parsed.email,
      empresa: parsed.empresa,
      endereco: parsed.endereco,
      cep: parsed.cep,
      cpf: parsed.cpf,
      como_conheceu: parsed.como_conheceu,
      rg: parsed.rg ?? null,
      cnpj: parsed.cnpj ?? null,
      razao_social: parsed.razao_social ?? null,
      contrato_preenchido_at: new Date().toISOString(),
      last_client_activity_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (error) {
    logServerError("cliente.contrato", error);
    return errorResponse("save-failed", 500, error);
  }

  // Se o cliente não tinha email antes (ou é novo), dispara o magic link
  // pra retomar a sessão de outro dispositivo.
  if (emailWasEmpty || isNewClient) {
    try {
      await service.auth.signInWithOtp({
        email: parsed.email,
        options: {
          emailRedirectTo: `${env.appUrl}/auth/callback`,
          shouldCreateUser: true,
          data: {
            client_id: clientId,
            nome: parsed.nome ?? parsed.empresa,
          },
        },
      });
    } catch (err) {
      logServerError("cliente.contrato.otp", err);
      // Não bloqueia o save — só falha o magic link.
    }
  }

  // Devolve dados básicos pra que o frontend hidrate o localStorage e leve
  // o cliente direto pro /dashboard.
  const { data: full } = await service
    .from("clients")
    .select("id, nome, whatsapp, email, empresa, project_type")
    .eq("id", clientId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    isNewClient,
    client: full
      ? {
          id: full.id,
          nome: full.nome,
          whatsapp: full.whatsapp,
          email: full.email,
          empresa: full.empresa,
          projectType: full.project_type,
        }
      : null,
  });
}
