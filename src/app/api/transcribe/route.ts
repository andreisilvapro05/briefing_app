import { NextResponse, type NextRequest } from "next/server";
import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, isProduction, logServerError } from "@/lib/api-helpers";

/**
 * Transcreve áudio via OpenAI Whisper.
 *
 * Em PRODUÇÃO: exige usuário autenticado (cookie Supabase). Sem auth, 401.
 * Em DEV: permite chamada anônima para desenvolvimento local.
 *
 * SEGURANÇA / CUSTO:
 * - Limite de 25 MB (Whisper API exige).
 * - Apenas MIME audio/* aceito.
 * - Cada chamada custa centavos de USD — em produção, considere
 *   adicionar rate-limit por IP via Vercel KV / Upstash Redis.
 */

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return errorResponse("server-not-configured", 503);
  }

  // Em produção, exigir auth pra evitar abuso (cada call custa USD)
  if (isProduction()) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        return errorResponse("unauthenticated", 401);
      }
    } catch (err) {
      logServerError("transcribe.auth", err);
      return errorResponse("auth-failed", 500);
    }
  }

  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return errorResponse("invalid-audio", 400);
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return errorResponse("audio-too-large", 413);
  }

  if (audio.type && !audio.type.startsWith("audio/")) {
    return errorResponse("unsupported-mime", 415);
  }

  if (!env.openaiKey) {
    // Modo demo — devolve transcrição simulada para que o fluxo siga.
    return NextResponse.json({
      text: "[modo demo] Áudio recebido. Configure OPENAI_API_KEY para ativar transcrição real.",
    });
  }

  const openai = new OpenAI({ apiKey: env.openaiKey });

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: env.openaiTranscribeModel,
      language: "pt",
      response_format: "text",
    });

    const text =
      typeof transcription === "string"
        ? transcription
        : (transcription as { text?: string }).text || "";

    return NextResponse.json({ text });
  } catch (err) {
    logServerError("transcribe.openai", err);
    return errorResponse("transcribe-failed", 500, err);
  }
}
