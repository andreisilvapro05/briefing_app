import { type NextRequest } from "next/server";
import JSZip from "jszip";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { CATEGORY_BY_ID, categorizeFile } from "@/lib/file-categories";

/**
 * Baixa TODOS os anexos de um cliente em um ZIP organizado por categoria.
 *
 *   GET /api/admin/files/zip/[id]?key=<admin>
 *
 * Estrutura do ZIP:
 *   Nome do Cliente/
 *     01-Logo/
 *     02-Identidade visual/
 *     03-Imagens e fotos/
 *     04-Depoimentos/
 *     05-Áudios/
 *     06-Documentos/
 *     07-Outros materiais/
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_ORDER: Array<{ id: string; folder: string }> = [
  { id: "logo",         folder: "01-Logo" },
  { id: "identidade",   folder: "02-Identidade visual" },
  { id: "imagens",      folder: "03-Imagens e fotos" },
  { id: "depoimentos",  folder: "04-Depoimentos" },
  { id: "audios",       folder: "05-Audios" },
  { id: "documentos",   folder: "06-Documentos" },
  { id: "outros",       folder: "07-Outros materiais" },
];

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const admin = await getAdminUser({ urlKey: url.searchParams.get("key") });
  if (!admin) return errorResponse("unauthenticated", 401);

  const service = createSupabaseServiceRoleClient();

  const [{ data: clientRow }, { data: files }] = await Promise.all([
    service.from("clients").select("nome, empresa").eq("id", id).maybeSingle(),
    service
      .from("briefing_files")
      .select("file_name, public_url, mime_type, field_id, size_bytes")
      .eq("client_id", id),
  ]);

  if (!clientRow) return errorResponse("client-not-found", 404);
  if (!files || files.length === 0) {
    return errorResponse("no-files", 404);
  }

  const zip = new JSZip();
  const baseFolder =
    (clientRow.nome ?? "cliente").trim().replace(/[\/:*?"<>|]/g, "-") || "cliente";
  const root = zip.folder(baseFolder)!;

  // Cria pré-pastas pra manter ordem mesmo se categoria não tiver arquivos
  const folderMap = new Map<string, JSZip>();
  CATEGORY_ORDER.forEach((c) => {
    folderMap.set(c.id, root.folder(c.folder)!);
  });

  // Index.txt com metadata
  const indexLines = [
    `Cliente: ${clientRow.nome ?? ""}`,
    `Empresa: ${clientRow.empresa ?? "—"}`,
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    `Total de arquivos: ${files.length}`,
    "",
    "── Conteúdo ──",
    "",
  ];

  // Baixa cada arquivo em paralelo (limitado pra não estourar memória)
  const downloads = await Promise.allSettled(
    files.map(async (f) => {
      const cat = categorizeFile(f.field_id ?? "", f.mime_type ?? null);
      const folder = folderMap.get(cat) ?? folderMap.get("outros")!;
      try {
        const res = await fetch(f.public_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const safeName = (f.file_name ?? "arquivo")
          .replace(/[\/:*?"<>|]/g, "-")
          .slice(0, 200);
        // Evita colisão de nomes — prefixa com 4 chars do hash do path
        const finalName = safeName;
        folder.file(finalName, buf);
        return { file: f, ok: true };
      } catch (err) {
        logServerError("zip.fetch", { url: f.public_url, err });
        return { file: f, ok: false, error: String(err) };
      }
    })
  );

  let okCount = 0;
  let failCount = 0;
  downloads.forEach((d) => {
    if (d.status === "fulfilled" && d.value.ok) {
      okCount++;
      const cat = categorizeFile(
        d.value.file.field_id ?? "",
        d.value.file.mime_type ?? null
      );
      indexLines.push(
        `  [${CATEGORY_BY_ID[cat]?.label ?? cat}] ${d.value.file.file_name}`
      );
    } else {
      failCount++;
      const file = d.status === "fulfilled" ? d.value.file : null;
      indexLines.push(`  [FALHA] ${file?.file_name ?? "(desconhecido)"}`);
    }
  });

  indexLines.push("");
  indexLines.push(`Baixados: ${okCount} · Falhas: ${failCount}`);
  root.file("__index.txt", indexLines.join("\n"));

  const arrayBuffer = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const filename = `${baseFolder}-materiais.zip`;
  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(arrayBuffer.byteLength),
    },
  });
}
