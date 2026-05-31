import { Eyebrow, Pill } from "@/components/ui/pill";
import { fieldLabel } from "@/lib/briefing-labels";
import {
  CATEGORY_DEFS,
  CATEGORY_TONE_CLASSES,
  categorizeFile,
  type FileCategory,
} from "@/lib/file-categories";

interface BriefingFile {
  field_id: string;
  file_name: string;
  public_url: string;
  size_bytes: number | null;
  mime_type: string | null;
}

/**
 * Painel "Materiais" no /admin/[id]: agrupa todos os anexos do briefing por
 * categoria (Logo, Identidade, Imagens, Depoimentos, Áudios, Documentos,
 * Outros), mostra preview de imagens em grid e oferece "Baixar tudo" como
 * ZIP organizado.
 */
export function MateriaisPainel({
  files,
  clientId,
  urlKey,
}: {
  files: BriefingFile[];
  clientId: string;
  urlKey: string | null;
}) {
  // Agrupa por categoria mantendo a ordem definida em CATEGORY_DEFS
  const groups = new Map<FileCategory, BriefingFile[]>();
  CATEGORY_DEFS.forEach((c) => groups.set(c.id, []));
  files.forEach((f) => {
    const cat = categorizeFile(f.field_id ?? "", f.mime_type ?? null);
    groups.get(cat)?.push(f);
  });

  const totalBytes = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
  const keySuffix = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const zipUrl = `/api/admin/files/zip/${clientId}${keySuffix}`;

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <div>
          <Eyebrow>Materiais do cliente</Eyebrow>
          <p className="text-xs text-fysi-muted mt-1">
            {files.length} arquivo{files.length === 1 ? "" : "s"} ·{" "}
            {formatBytes(totalBytes)} no total
          </p>
        </div>
        <a
          href={zipUrl}
          className="inline-flex items-center gap-1.5 rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3 py-2 hover:bg-fysi-deep/90"
        >
          ⬇ Baixar tudo (.zip)
        </a>
      </div>

      <div className="flex flex-col gap-4">
        {CATEGORY_DEFS.map((cat) => {
          const items = groups.get(cat.id) ?? [];
          if (items.length === 0) return null;
          const tone = CATEGORY_TONE_CLASSES[cat.tone];
          return (
            <div key={cat.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                <span className="text-[0.7rem] uppercase tracking-[0.08em] font-semibold text-fysi-deep">
                  {cat.emoji} {cat.label}
                </span>
                <span className="text-[0.65rem] text-fysi-muted">
                  · {items.length}
                </span>
              </div>

              {/* Grid de preview pra imagens; lista pro resto */}
              {cat.id === "imagens" || cat.id === "logo" ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {items.map((f, i) => (
                    <ImageCard key={i} file={f} />
                  ))}
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {items.map((f, i) => (
                    <FileRow key={i} file={f} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ImageCard({ file }: { file: BriefingFile }) {
  const isImage = (file.mime_type ?? "").startsWith("image/");
  return (
    <a
      href={file.public_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block aspect-square rounded-[12px] border border-fysi-line overflow-hidden bg-fysi-cream/40 hover:border-fysi-deep/40 transition relative"
      title={file.file_name}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.public_url}
          alt={file.file_name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 text-center">
          <span className="text-2xl">📎</span>
          <span className="text-[0.65rem] text-fysi-muted truncate w-full">
            {file.file_name}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition px-2 py-1">
        <p className="text-[0.65rem] text-white truncate">{file.file_name}</p>
      </div>
    </a>
  );
}

function FileRow({ file }: { file: BriefingFile }) {
  return (
    <li className="flex items-center justify-between gap-3 border border-fysi-line rounded-[10px] px-3 py-2 hover:border-fysi-deep/30 transition">
      <div className="flex flex-col min-w-0 flex-1">
        <a
          href={file.public_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-fysi-deep font-medium hover:underline truncate"
        >
          {file.file_name}
        </a>
        <span className="text-[0.65rem] text-fysi-muted">
          {fieldLabel(file.field_id)} · {file.mime_type ?? "—"}
        </span>
      </div>
      <Pill tone="outline">{formatBytes(file.size_bytes ?? 0)}</Pill>
    </li>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
