import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { listCustomQuestions } from "@/lib/custom-questions-server";

/**
 * Perguntas específicas do cliente (pro briefing renderizar o bloco extra).
 * Segue o padrão dos outros /api/cliente/*: identifica por clientId, sem sessão.
 * Só devolve label/hint — nada sensível.
 */
export async function GET(request: NextRequest) {
  try {
    getServerEnv();
  } catch {
    return NextResponse.json({ questions: [] });
  }

  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ questions: [] });

  const questions = await listCustomQuestions(clientId);
  return NextResponse.json({
    questions: questions.map((q) => ({
      id: q.id,
      label: q.label,
      hint: q.hint,
      tipo: q.tipo,
      opcoes: q.opcoes,
    })),
  });
}
