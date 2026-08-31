import { NextResponse, type NextRequest } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-session";

/**
 * Limpa o cookie de sessão admin. Só em POST.
 *
 * Só aceitava GET antes ("pra facilitar link no header") — mas GET é
 * prefetchado automaticamente pelo <Link> do Next assim que o link "sair"
 * entra na viewport, então TODO carregamento de página deslogava o admin
 * silenciosamente em background. Isso ficava mascarado enquanto o ?key= na
 * URL reautenticava a cada navegação — parou de mascarar assim que o proxy
 * passou a limpar o ?key= (ver src/proxy.ts), e virou "clicar em qualquer
 * aba manda pro login".
 */
async function logout(request: NextRequest) {
  await clearAdminSessionCookie();
  // 303 força GET no redirect — evita re-submit. Deriva do request.url em
  // vez de NEXT_PUBLIC_APP_URL (que apontava pro domínio *.vercel.app cru,
  // não pro domínio customizado — causava um redirect cross-origin que
  // falhava por CORS).
  return NextResponse.redirect(new URL("/admin/login", request.url), {
    status: 303,
  });
}

export async function POST(request: NextRequest) {
  return logout(request);
}
