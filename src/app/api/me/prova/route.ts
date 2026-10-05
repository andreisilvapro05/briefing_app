import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";
import {
  NIVEIS,
  TERMO_POR_NIVEL,
  problemaNaResposta,
  type NivelAutorizacao,
} from "@/lib/prova";
import { provaDoCliente } from "@/lib/prova-server";

/**
 * "Como foi trabalhar com a Fysi" — o bloco do painel do cliente.
 *
 * GET-equivalente (POST com clientId, como as outras rotas de /api/me):
 * devolve se há prova esperando resposta. PUT: grava o depoimento e a
 * autorização.
 *
 * ⚠️ Mesma chave das outras rotas de /api/me: o `clientId` que o navegador
 * guarda. Isso NÃO é login, e está anotado como a decisão de fundo em
 * aberto (ver memory/URGENTE_tomada_de_conta_cliente). Usar aqui um
 * esquema diferente do resto não fecharia nada e deixaria o painel com
 * dois jeitos de autenticar.
 */

const Body = z.object({ clientId: z.string().uuid() });

const Resposta = z.object({
  clientId: z.string().uuid(),
  depoimento: z.string().max(4000).optional().default(""),
  nota: z.string().max(4).optional().default(""),
  nivel: z.string().max(2),
});

export async function POST(request: NextRequest) {
  try {
    getServerEnv();
  } catch {
    return NextResponse.json({ prova: null });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  const prova = await provaDoCliente(parsed.clientId);
  if (!prova) return NextResponse.json({ prova: null });

  return NextResponse.json({
    prova: {
      id: prova.id,
      // O que já foi respondido — pra tela dizer "obrigada" em vez de
      // pedir de novo o que a pessoa já mandou.
      jaRespondeu: prova.autorizacaoNivel !== null,
      nivel: prova.autorizacaoNivel,
      depoimento: prova.depoimentoTexto,
      nota: prova.nota,
    },
    niveis: NIVEIS,
    termos: TERMO_POR_NIVEL,
  });
}

export async function PUT(request: NextRequest) {
  try {
    getServerEnv();
  } catch {
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  let parsed: z.infer<typeof Resposta>;
  try {
    parsed = Resposta.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  const problema = problemaNaResposta({
    depoimento: parsed.depoimento,
    nota: parsed.nota,
    nivel: parsed.nivel,
  });
  if (problema) {
    return NextResponse.json({ ok: false, erro: problema }, { status: 400 });
  }

  const prova = await provaDoCliente(parsed.clientId);
  if (!prova) return errorResponse("prova-nao-encontrada", 404);

  const nivel = Number(parsed.nivel) as NivelAutorizacao;
  const depoimento = parsed.depoimento.trim();
  const nota = parsed.nota.trim() ? Number(parsed.nota) : null;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("proof_items")
    .update({
      depoimento_texto: depoimento || null,
      nota,
      autorizacao_nivel: nivel,
      /**
       * O termo é GRAVADO, não referenciado.
       *
       * Se o texto mudar amanhã, esta autorização continua mostrando o que
       * a pessoa realmente aceitou — senão uma edição de palavras
       * reescreveria o passado de todo mundo.
       */
      autorizacao_termo: TERMO_POR_NIVEL[nivel],
      autorizado_por: "cliente",
      autorizado_em: new Date().toISOString(),
      // O cliente respondeu: sai de "a coletar" e vai pra fila da equipe.
      status: "coletado",
      updated_at: new Date().toISOString(),
    })
    .eq("id", prova.id);

  if (error) {
    logServerError("me.prova.responder", error);
    return errorResponse("save-failed", 500, error);
  }

  return NextResponse.json({ ok: true });
}
