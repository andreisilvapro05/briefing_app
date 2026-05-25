import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";
import {
  buildClientTemplateVars,
  fillDocxTemplate,
} from "@/lib/contract-template";
import { createDocument } from "@/lib/autentique";

/**
 * Gera o contrato pra um cliente:
 * 1) Baixa o template .docx do storage.
 * 2) Preenche as tags com os dados do cliente + dados que o admin digitou
 *    (pacote, valor, prazo).
 * 3) Manda pro Autentique, que dispara o e-mail de assinatura pro cliente.
 * 4) Salva o autentique_document_id e marca status='pendente'.
 *
 * Admin-only.
 */

const Body = z.object({
  pacoteNome: z.string().min(1).max(200),
  valorParcelamento: z.string().min(1).max(500),
  prazoExecucao: z.string().min(1).max(200),
  escopoProjeto: z.string().min(1).max(5000),
  linkParcelamento: z.string().min(1).max(500),
  // Email do signatário. Se omitido, usa client.email do banco. Útil pro admin
  // mandar o contrato pra um cliente que ainda não preencheu o /contrato.
  recipientEmail: z.string().email().optional(),
  // Nome completo do signatário (vai pro template e pro Autentique).
  // Se omitido, usa client.nome do banco.
  signerName: z.string().min(1).max(200).optional(),
});

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const admin = await getAdminUser({
    urlKey: url.searchParams.get("key"),
  });
  if (!admin) return errorResponse("unauthenticated", 401);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  const service = createSupabaseServiceRoleClient();

  // Cliente
  const { data: client, error: clientErr } = await service
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (clientErr) {
    logServerError("contracts.send.client", clientErr);
    return errorResponse("client-query-failed", 500, clientErr);
  }
  if (!client) return errorResponse("client-not-found", 404);

  // Prioriza email digitado pelo admin no form; fallback pro cadastrado.
  const signerEmail =
    body.recipientEmail?.trim() || (client.email ?? "").trim();
  if (!signerEmail) {
    return errorResponse("recipient-email-missing", 400);
  }

  // Nome completo pro contrato/Autentique. Admin digita no form; fallback no cadastro.
  const effectiveNome =
    body.signerName?.trim() || (client.nome ?? "").trim();
  if (!effectiveNome) {
    return errorResponse("signer-name-missing", 400);
  }

  // Template
  const { data: tplBlob, error: tplErr } = await service.storage
    .from("contracts-templates")
    .download("modelo.docx");
  if (tplErr || !tplBlob) {
    return errorResponse("template-not-uploaded", 412);
  }
  const tplBuffer = Buffer.from(await tplBlob.arrayBuffer());

  // Vars (cliente + dados que o admin digitou). signerName e recipientEmail
  // sobrescrevem o que vem do banco — admin tem a palavra final.
  const vars = {
    ...buildClientTemplateVars(client),
    nome_cliente: effectiveNome,
    email_cliente: signerEmail,
    pacote_nome: body.pacoteNome,
    valor_parcelamento: body.valorParcelamento,
    prazo_execucao: body.prazoExecucao,
    escopo_projeto: body.escopoProjeto,
    link_parcelamento: body.linkParcelamento,
  };

  // Preenche o .docx
  let filledBuffer: Buffer;
  try {
    filledBuffer = fillDocxTemplate(tplBuffer, vars);
  } catch (err) {
    logServerError("contracts.send.fill", err);
    return errorResponse("template-fill-failed", 500, err);
  }

  // Envia ao Autentique — Fysi assina primeiro (sortable), depois cliente.
  const env = getServerEnv();
  let result;
  try {
    result = await createDocument({
      name: `Contrato Fysi — ${client.empresa || effectiveNome}`,
      file: filledBuffer,
      fileName: `contrato-${client.id}.docx`,
      fileMime: DOCX_MIME,
      sortable: true,
      signers: [
        {
          email: env.fysiSignerEmail,
          name: env.fysiSignerName,
          action: "SIGN",
        },
        { email: signerEmail, name: effectiveNome, action: "SIGN" },
      ],
    });
  } catch (err) {
    logServerError("contracts.send.autentique", err);
    return errorResponse("autentique-failed", 502, err);
  }

  // Persiste. Se o admin digitou um nome/email diferente do cadastro, salva
  // pra ficar refletido no painel também (próxima geração não precisa digitar).
  const updatePayload: Record<string, unknown> = {
    autentique_document_id: result.id,
    contrato_status: "pendente",
    contrato_dados: vars,
  };
  if (body.recipientEmail && body.recipientEmail.trim() !== client.email) {
    updatePayload.email = body.recipientEmail.trim();
  }
  if (body.signerName && body.signerName.trim() !== client.nome) {
    updatePayload.nome = body.signerName.trim();
  }

  const { error: updErr } = await service
    .from("clients")
    .update(updatePayload)
    .eq("id", id);
  if (updErr) {
    logServerError("contracts.send.persist", updErr);
    return errorResponse("save-failed", 500, updErr);
  }

  return NextResponse.json({
    ok: true,
    autentiqueDocumentId: result.id,
    name: result.name,
    originalUrl: result.originalUrl,
  });
}
