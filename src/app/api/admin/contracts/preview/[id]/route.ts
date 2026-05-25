import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import {
  buildClientTemplateVars,
  fillDocxTemplate,
} from "@/lib/contract-template";

/**
 * Pré-visualização: preenche o template e devolve o .docx pra download.
 * NÃO envia pro Autentique. Usado pelo admin pra conferir se as tags
 * substituem direito antes de mandar de verdade.
 *
 * Quando faltar algum dado do cliente (email, CPF, endereço), preenche
 * com valores de exemplo só pra preview — o contrato real exige os
 * dados verdadeiros.
 */

const Body = z.object({
  pacoteNome: z.string().min(1).max(200),
  valorParcelamento: z.string().min(1).max(500),
  prazoExecucao: z.string().min(1).max(200),
  escopoProjeto: z.string().min(1).max(5000),
  linkParcelamento: z.string().min(1).max(500),
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
  const { data: client, error: clientErr } = await service
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (clientErr || !client) return errorResponse("client-not-found", 404);

  const { data: tplBlob, error: tplErr } = await service.storage
    .from("contracts-templates")
    .download("modelo.docx");
  if (tplErr || !tplBlob) return errorResponse("template-not-uploaded", 412);

  const tplBuffer = Buffer.from(await tplBlob.arrayBuffer());

  // Substitui dados em branco por exemplos só pra preview.
  const clientVars = buildClientTemplateVars(client);
  const previewVars: Record<string, string> = {
    ...clientVars,
    email_cliente: clientVars.email_cliente || "cliente@exemplo.com",
    documento_descricao:
      clientVars.documento_descricao !== "documento"
        ? clientVars.documento_descricao
        : "CPF",
    documento_numero:
      clientVars.documento_numero || "000.000.000-00 (exemplo)",
    endereco_cliente:
      clientVars.endereco_cliente ||
      "Rua de Exemplo, 123, Cidade/UF, CEP 00000-000 (exemplo)",
    pacote_nome: body.pacoteNome,
    valor_parcelamento: body.valorParcelamento,
    prazo_execucao: body.prazoExecucao,
    escopo_projeto: body.escopoProjeto,
    link_parcelamento: body.linkParcelamento,
  };

  let filled: Buffer;
  try {
    filled = fillDocxTemplate(tplBuffer, previewVars);
  } catch (err) {
    logServerError("contracts.preview.fill", err);
    return errorResponse("template-fill-failed", 500, err);
  }

  const safeName = client.nome.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40);
  return new NextResponse(filled as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="preview-${safeName}.docx"`,
      "Content-Length": String(filled.length),
    },
  });
}
