import { Eyebrow, Pill } from "@/components/ui/pill";
import { fieldLabel } from "@/lib/briefing-labels";
import {
  CATEGORY_DEFS,
  CATEGORY_TONE_CLASSES,
  categorizeFile,
  type FileCategory,
} from "@/lib/file-categories";
import { MateriaisChecklist } from "@/components/admin/materiais-checklist";
import type { MaterialItem } from "@/lib/materiais-cliente";

interface BriefingFile {
  field_id: string;
  file_name: string;
  public_url: string;
  size_bytes: number | null;
  mime_type: string | null;
}

/**
 * Painel "Materiais" no /admin/[id] — o ÚNICO lugar de material do cliente.
 *
 * Duas metades da mesma história:
 *  1. o que ainda FALTA chegar (`MateriaisChecklist`, ligado à lista que o
 *     cliente vê no link público do briefing);
 *  2. o que JÁ chegou: os anexos do briefing agrupados por categoria (Logo,
 *     Identidade, Imagens, Depoimentos, Áudios, Documentos, Outros), com
 *     preview em grid e "Baixar tudo" como ZIP organizado.
 *
 * As duas ficam juntas de propósito: o pedido explícito da dona é que
 * gestão não vire aba espalhada. Quem abre "Materiais" quer saber o que
 * tem e o que falta na mesma olhada.
 */
export function MateriaisPainel({
  files,
  clientId,
  urlKey,
  materiais = [],
  docId,
}: {
  files: BriefingFile[];
  clientId: string;
  urlKey: string | null;
  /** Lista "o que o cliente precisa enviar" — ver `client_materials`. */
  materiais?: MaterialItem[];
  /** Briefing aberto no admin, se houver — só pra revalidar a tela certa. */
  docId?: string | null;
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
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6">
      <MateriaisChecklist
        clientId={clientId}
        urlKey={urlKey}
        docId={docId}
        itens={materiais}
      />

      <div className="border-t border-fysi-line mt-6 pt-5">
        <div className="flex items-baseline justify-between mb-4 gap-3">
          <div>
            <Eyebrow>O que já chegou pelo painel</Eyebrow>
            <p className="text-xs text-fysi-muted mt-1">
              {files.length === 0
                ? "Nenhum arquivo enviado pelo painel ainda. Material que chegar por WhatsApp ou Drive não aparece aqui — marque na lista acima."
                : `${files.length} arquivo${files.length === 1 ? "" : "s"} · ${formatBytes(totalBytes)} no total`}
            </p>
          </div>
          {files.length > 0 ? (
            <a
              href={zipUrl}
              className="inline-flex items-center gap-1.5 rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3 py-2 hover:bg-fysi-deep/90"
            >
              Baixar tudo (.zip)
            </a>
          ) : null}
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
                  {cat.label}
                </span>
                <span className="text-[0.72rem] text-fysi-muted">
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
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 text-center">
          {/* Ícone de clipe em SVG — interface da Fysi não usa emoji. */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-fysi-muted"
          >
            <path d="M21 12.5 12.5 21a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5" />
          </svg>
          <span className="text-[0.72rem] text-fysi-muted truncate w-full">
            {file.file_name}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition px-2 py-1">
        <p className="text-[0.72rem] text-white truncate">{file.file_name}</p>
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
        <span className="text-[0.72rem] text-fysi-muted">
          {fieldLabel(file.field_id ?? "")} · {file.mime_type ?? "—"}
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
