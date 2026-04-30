import { NextResponse } from "next/server";

/**
 * Em produção, mensagens de erro pro client devem ser genéricas pra não vazar
 * detalhes do Postgres/SDK/etc. Em dev mantém o detalhe pra facilitar debug.
 */
export function errorResponse(
  code: string,
  status: number,
  details?: unknown
) {
  const body: Record<string, unknown> = { error: code };
  if (process.env.NODE_ENV !== "production") {
    body.details =
      details instanceof Error ? details.message : String(details ?? "");
  }
  return NextResponse.json(body, { status });
}

export const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Sanitiza erro para log: não imprime payload bruto.
 */
export function logServerError(scope: string, err: unknown) {
  if (err instanceof Error) {
    console.error(`[${scope}]`, err.message);
  } else {
    console.error(`[${scope}]`, "unknown error");
  }
}
