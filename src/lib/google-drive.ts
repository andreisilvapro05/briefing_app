import { google, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { getServerEnv } from "./env";

/**
 * Integração com Google Drive via Service Account.
 *
 * Comportamento offline-safe: se as envs (GOOGLE_SERVICE_ACCOUNT_KEY +
 * GOOGLE_DRIVE_PARENT_FOLDER_ID) não estiverem configuradas, todas as
 * funções viram no-op silenciosas e retornam null. A app continua
 * funcionando normalmente, só sem criar pastas automaticamente.
 *
 * SETUP no Google Cloud (uma vez):
 * 1. Console → IAM → Service Accounts → criar nova
 * 2. Habilitar Drive API no projeto
 * 3. Baixar a key como JSON
 * 4. No Drive da Fysi, criar pasta "Fysi · Clientes" e compartilhar com o
 *    email do service account (XXX@YYY.iam.gserviceaccount.com) com permissão
 *    "Editor"
 * 5. Copiar o ID da pasta raiz (último segmento da URL)
 * 6. base64 do JSON: `cat key.json | base64 | pbcopy`
 * 7. Setar GOOGLE_SERVICE_ACCOUNT_KEY (base64) + GOOGLE_DRIVE_PARENT_FOLDER_ID no Vercel
 */

const SCOPES = ["https://www.googleapis.com/auth/drive"];

// Subpastas padrão de cada cliente — alinhado com os blocos do briefing.
export const CLIENT_SUBFOLDERS = [
  "01-Logo",
  "02-Identidade Visual",
  "03-Imagens",
  "04-Depoimentos",
  "05-Briefing-respostas",
  "06-Materiais do cliente",
] as const;

export type ClientSubfolder = (typeof CLIENT_SUBFOLDERS)[number];

/**
 * Mapeia field_id do briefing pra subpasta. Usado pelo /api/upload.
 * Tudo que não bate cai em "06-Materiais do cliente".
 */
export function subfolderForField(fieldId: string): ClientSubfolder {
  const id = fieldId.toLowerCase();
  if (id.includes("logo")) return "01-Logo";
  if (
    id.includes("identidade") ||
    id.includes("manual") ||
    id.includes("brand")
  )
    return "02-Identidade Visual";
  if (id.includes("foto") || id.includes("imagem") || id.includes("image"))
    return "03-Imagens";
  if (id.includes("depoimento") || id.includes("testimonial"))
    return "04-Depoimentos";
  return "06-Materiais do cliente";
}

function isConfigured(): boolean {
  try {
    const env = getServerEnv();
    return !!env.googleServiceAccountKey && !!env.googleDriveParentFolderId;
  } catch {
    return false;
  }
}

let cachedClient: drive_v3.Drive | null = null;
function getDriveClient(): drive_v3.Drive | null {
  if (cachedClient) return cachedClient;
  if (!isConfigured()) return null;
  const env = getServerEnv();
  try {
    const decoded = Buffer.from(env.googleServiceAccountKey, "base64").toString(
      "utf-8"
    );
    const credentials = JSON.parse(decoded);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
    cachedClient = google.drive({ version: "v3", auth });
    return cachedClient;
  } catch (err) {
    console.error("[google-drive] auth failed:", err);
    return null;
  }
}

/**
 * Cria uma pasta no Drive. Idempotente: se já existe uma pasta com o mesmo
 * nome dentro do parent, devolve essa.
 */
async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<{ id: string; webViewLink: string } | null> {
  // Busca primeiro
  const q = `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const existing = await drive.files.list({
    q,
    fields: "files(id, webViewLink)",
    pageSize: 1,
  });
  if (existing.data.files?.length) {
    const f = existing.data.files[0];
    if (f.id) return { id: f.id, webViewLink: f.webViewLink ?? "" };
  }

  // Cria
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id, webViewLink",
  });
  if (!created.data.id) return null;
  return {
    id: created.data.id,
    webViewLink: created.data.webViewLink ?? "",
  };
}

/**
 * Cria a estrutura completa de pasta pra um cliente (pasta raiz + subpastas).
 * Retorna { rootId, rootUrl, subfolders: { name → id } } ou null se desativado.
 */
export interface ClientDriveFolders {
  rootId: string;
  rootUrl: string;
  subfolders: Record<ClientSubfolder, string>;
}

export async function createClientFolders(
  clientName: string,
  clientId: string
): Promise<ClientDriveFolders | null> {
  const drive = getDriveClient();
  if (!drive) return null;

  const env = getServerEnv();
  const parentId = env.googleDriveParentFolderId;

  // Nome da pasta: "Nome do Cliente — abc12345" (curto pra ler, com prefix do id)
  const shortId = clientId.slice(0, 8);
  const folderName = `${clientName.trim()} — ${shortId}`;

  const root = await findOrCreateFolder(drive, folderName, parentId);
  if (!root) return null;

  const subfolders = {} as Record<ClientSubfolder, string>;
  for (const sub of CLIENT_SUBFOLDERS) {
    const created = await findOrCreateFolder(drive, sub, root.id);
    if (created) subfolders[sub] = created.id;
  }

  return {
    rootId: root.id,
    rootUrl: root.webViewLink,
    subfolders,
  };
}

/**
 * Upload de arquivo pra uma pasta específica. Retorna { id, webViewLink }
 * ou null se o Drive estiver desativado.
 */
export async function uploadToDriveFolder(
  folderId: string,
  fileName: string,
  mimeType: string,
  data: Buffer | Uint8Array
): Promise<{ id: string; webViewLink: string } | null> {
  const drive = getDriveClient();
  if (!drive) return null;

  try {
    const stream = Readable.from(Buffer.from(data));
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: "id, webViewLink",
    });
    if (!res.data.id) return null;
    return {
      id: res.data.id,
      webViewLink: res.data.webViewLink ?? "",
    };
  } catch (err) {
    console.error("[google-drive] upload failed:", err);
    return null;
  }
}

/**
 * Status pra UI: mostra se a integração está ativa.
 */
export function driveStatus(): {
  configured: boolean;
  reason?: string;
} {
  try {
    const env = getServerEnv();
    if (!env.googleServiceAccountKey) {
      return { configured: false, reason: "GOOGLE_SERVICE_ACCOUNT_KEY ausente" };
    }
    if (!env.googleDriveParentFolderId) {
      return {
        configured: false,
        reason: "GOOGLE_DRIVE_PARENT_FOLDER_ID ausente",
      };
    }
    return { configured: true };
  } catch {
    return { configured: false, reason: "envs do servidor não carregadas" };
  }
}
