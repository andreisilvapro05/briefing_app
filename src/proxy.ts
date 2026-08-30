import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { adminSessionCookieOptions, isPasswordValid } from "@/lib/admin-session";

/**
 * Além do refresh de sessão Supabase (`updateSession`), resolve o
 * `?key=<senha>` que aparecia em toda URL do /admin — antes disso, a senha
 * ficava visível na barra de endereço, no histórico do navegador e em
 * qualquer link copiado/printado (foi assim que vazou numa conversa).
 *
 * Se a key bate com ADMIN_PASSWORD: seta o mesmo cookie de sessão que o
 * login por senha usa (`adminSessionCookieOptions`, ver admin-session.ts) e
 * redireciona pra mesma URL sem o "key" — a partir daí o cookie autentica
 * o resto da navegação. `getAdminUser()` continua aceitando `?key=` como
 * fallback (bookmarks antigos, cookie bloqueado) — esse proxy só evita que
 * ele fique aparecendo depois do primeiro acesso.
 *
 * Só age em GET (navegação real). Se agisse em POST também, um Server
 * Action disparado enquanto a URL ainda tem `?key=` (ex: antes do primeiro
 * redirect de limpeza) seria redirecionado pelo proxy — e o protocolo de
 * Server Actions do Next não é feito pra sobreviver a um redirect no meio
 * do caminho. Em POST, o `?key=` (se presente) segue intocado e é validado
 * do jeito de sempre, direto em `getAdminUser({ urlKey })`.
 */
export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  const { pathname, searchParams } = request.nextUrl;
  const key = searchParams.get("key");
  if (request.method !== "GET" || !pathname.startsWith("/admin") || !key) {
    return response;
  }
  if (!isPasswordValid(key)) return response;

  const cleanUrl = new URL(request.nextUrl);
  cleanUrl.searchParams.delete("key");

  const redirectResponse = NextResponse.redirect(cleanUrl);
  // Preserva os cookies que `updateSession` já tenha setado (refresh Supabase).
  response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
  redirectResponse.cookies.set(adminSessionCookieOptions());

  return redirectResponse;
}

export const config = {
  matcher: [
    // Roda em todas as rotas exceto assets e API públicas que não precisam de sessão.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
