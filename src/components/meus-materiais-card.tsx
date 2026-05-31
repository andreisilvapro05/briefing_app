"use client";

import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/ui/pill";
import {
  CATEGORY_DEFS,
  CATEGORY_TONE_CLASSES,
  categorizeFile,
  type FileCategory,
} from "@/lib/file-categories";

interface ClientFile {
  field_id: string;
  file_name: string;
  public_url: string;
  mime_type: string | null;
  size_bytes: number | null;
}

/**
 * Card "Meus materiais" no /dashboard: o cliente vê tudo que já enviou,
 * organizado por categoria. Card discreto — não substitui o status do
 * briefing, só dá visibilidade do que já foi entregue.
 *
 * Click no card → leva pro bloco "materiais" do briefing pra adicionar mais.
 */
export function MeusMateriaisCard({
  clientId,
  onAddMore,
}: {
  clientId: string;
  onAddMore?: () => void;
}) {
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    })
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((data) => {
        if (cancelled) return;
        setFiles(data.files ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Agrupa por categoria
  const groups = new Map<FileCategory, ClientFile[]>();
  CATEGORY_DEFS.forEach((c) => groups.set(c.id, []));
  files.forEach((f) => {
    const cat = categorizeFile(f.field_id ?? "", f.mime_type ?? null);
    groups.get(cat)?.push(f);
  });

  const total = files.length;
  const nonEmptyCats = CATEGORY_DEFS.filter(
    (c) => (groups.get(c.id)?.length ?? 0) > 0
  );

  if (!loaded) {
    return (
      <section className="bg-white border border-fysi-line rounded-[24px] p-6">
        <Eyebrow className="mb-3 block">Meus materiais</Eyebrow>
        <p className="text-xs text-fysi-muted">Carregando…</p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-fysi-line rounded-[24px] p-6">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <Eyebrow>Meus materiais</Eyebrow>
        <span className="text-xs text-fysi-muted">
          {total} {total === 1 ? "arquivo" : "arquivos"}
        </span>
      </div>

      {total === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-fysi-muted leading-relaxed mb-3">
            Nenhum arquivo enviado ainda. Envie logo, fotos e identidade no
            primeiro bloco do briefing pra Fysi começar a produção.
          </p>
          {onAddMore ? (
            <button
              type="button"
              onClick={onAddMore}
              className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-4 py-2 hover:bg-fysi-deep/90"
            >
              Enviar materiais →
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5 mb-4">
            {nonEmptyCats.map((cat) => {
              const items = groups.get(cat.id) ?? [];
              const tone = CATEGORY_TONE_CLASSES[cat.tone];
              return (
                <li
                  key={cat.id}
                  className="flex items-center justify-between py-1.5 border-b border-fysi-line last:border-b-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    <span className="text-sm text-fysi-deep/80">
                      {cat.emoji} {cat.label}
                    </span>
                  </div>
                  <span className="text-[0.7rem] uppercase tracking-[0.1em] font-medium text-fysi-deep">
                    {items.length}
                  </span>
                </li>
              );
            })}
          </ul>
          {onAddMore ? (
            <button
              type="button"
              onClick={onAddMore}
              className="block w-full text-center text-xs font-medium text-fysi-deep hover:underline"
            >
              + Adicionar mais materiais
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
