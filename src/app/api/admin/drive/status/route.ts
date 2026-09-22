import { NextResponse, type NextRequest } from "next/server";
import { getCurrentMember, hasFullAccess } from "@/lib/member";
import { errorResponse } from "@/lib/api-helpers";
import { driveStatus, createClientFolders } from "@/lib/google-drive";

/**
 * Diagnóstico da integração Google Drive.
 *   GET  /api/admin/drive/status?key=<admin> → status + setup checklist
 *   POST /api/admin/drive/status?key=<admin> → cria uma pasta de teste
 */

/**
 * getAdminUser aceitava qualquer membro logado, inclusive "basico" e
 * "desenvolvedor". Diagnóstico da integração e criação de pasta de teste no
 * Drive da agência é coisa de quem tem acesso completo — mesmo par que as
 * outras rotas de /api/admin ganharam em 22/09.
 */
async function exigirAcessoCompleto(request: NextRequest) {
  const url = new URL(request.url);
  const member = await getCurrentMember({ urlKey: url.searchParams.get("key") });
  if (!member) return { erro: errorResponse("unauthenticated", 401) };
  if (!hasFullAccess(member)) return { erro: errorResponse("forbidden", 403) };
  return { erro: null };
}

export async function GET(request: NextRequest) {
  const { erro } = await exigirAcessoCompleto(request);
  if (erro) return erro;

  const status = driveStatus();
  return NextResponse.json({
    ...status,
    envsNecessarias: [
      "GOOGLE_SERVICE_ACCOUNT_KEY (JSON base64'd)",
      "GOOGLE_DRIVE_PARENT_FOLDER_ID (ID da pasta raiz)",
    ],
  });
}

export async function POST(request: NextRequest) {
  const { erro } = await exigirAcessoCompleto(request);
  if (erro) return erro;

  const status = driveStatus();
  if (!status.configured) {
    return NextResponse.json(
      { ok: false, reason: status.reason ?? "drive não configurado" },
      { status: 503 }
    );
  }

  const testId = "test-" + Date.now().toString(36);
  const folders = await createClientFolders("__TESTE__", testId);
  if (!folders) {
    return NextResponse.json(
      { ok: false, reason: "createClientFolders retornou null" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    rootUrl: folders.rootUrl,
    subfolders: Object.keys(folders.subfolders),
    instrucao:
      "Confere a pasta no Drive — deve aparecer '__TESTE__ — " +
      testId.slice(0, 8) +
      "' com as 6 subpastas dentro. Pode apagar depois.",
  });
}
