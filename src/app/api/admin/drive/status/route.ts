import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { errorResponse } from "@/lib/api-helpers";
import { driveStatus, createClientFolders } from "@/lib/google-drive";

/**
 * Diagnóstico da integração Google Drive.
 *   GET  /api/admin/drive/status?key=<admin> → status + setup checklist
 *   POST /api/admin/drive/status?key=<admin> → cria uma pasta de teste
 */

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const admin = await getAdminUser({ urlKey: url.searchParams.get("key") });
  if (!admin) return errorResponse("unauthenticated", 401);

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
  const url = new URL(request.url);
  const admin = await getAdminUser({ urlKey: url.searchParams.get("key") });
  if (!admin) return errorResponse("unauthenticated", 401);

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
