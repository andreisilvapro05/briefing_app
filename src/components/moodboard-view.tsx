import type { Moodboard, MoodboardItem, MoodboardItemTipo } from "@/lib/moodboard";

/**
 * Visualização pública (read-only) do Moodboard pro cliente.
 *
 * Renderiza os cards de referência visual (imagem, link, cor, nota) de forma
 * limpa — SEM as notas internas da equipe, sem edição e sem comentários. Usada
 * na página compartilhável /moodboard/[slug].
 */
export function MoodboardView({ moodboard }: { moodboard: Moodboard }) {
  const items = moodboard.items ?? [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="text-[0.7rem] uppercase tracking-[0.14em] font-medium text-fysi-muted">
          Direção visual
        </span>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-fysi-deep">
          {moodboard.titulo || "Moodboard"}
        </h1>
        {moodboard.descricao ? (
          <p className="text-base leading-relaxed text-fysi-deep/70 max-w-2xl">
            {moodboard.descricao}
          </p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <div className="text-center py-16 text-fysi-muted text-sm border-2 border-dashed border-fysi-line rounded-[16px]">
          Ainda não há referências neste moodboard.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <MoodboardCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function MoodboardCard({ item }: { item: MoodboardItem }) {
  return (
    <article className="flex flex-col gap-3 rounded-[16px] border border-fysi-line bg-white p-4">
      <span className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
        {tipoIcon(item.tipo)} {tipoLabel(item.tipo)}
      </span>

      {item.titulo ? (
        <h2 className="text-base font-medium leading-snug text-fysi-deep">
          {item.titulo}
        </h2>
      ) : null}

      <CardBody item={item} />
    </article>
  );
}

function CardBody({ item }: { item: MoodboardItem }) {
  if (item.tipo === "imagem") {
    if (!item.conteudo) return null;
    return (
      <div className="aspect-video rounded-[10px] overflow-hidden bg-fysi-cream border border-fysi-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.conteudo}
          alt={item.titulo || "Referência visual"}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  if (item.tipo === "link") {
    if (!item.conteudo) return null;
    return (
      <a
        href={item.conteudo}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-fysi-deep underline decoration-fysi-mint-vivid decoration-2 underline-offset-4 break-all hover:text-fysi-deep/70"
      >
        {prettyLink(item.conteudo)} ↗
      </a>
    );
  }

  if (item.tipo === "cor") {
    const hex = item.conteudo || "#042B30";
    return (
      <div className="flex items-center gap-3">
        <span
          className="h-12 w-12 shrink-0 rounded-[10px] border border-fysi-line"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        <code className="text-sm font-medium uppercase text-fysi-deep">
          {hex}
        </code>
      </div>
    );
  }

  // nota
  return (
    <p className="text-sm leading-relaxed text-fysi-deep/80 whitespace-pre-wrap">
      {item.conteudo}
    </p>
  );
}

function prettyLink(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
}

function tipoIcon(t: MoodboardItemTipo): string {
  return t === "imagem" ? "🖼️" : t === "link" ? "🔗" : t === "cor" ? "🎨" : "📝";
}

function tipoLabel(t: MoodboardItemTipo): string {
  return t === "imagem"
    ? "Imagem"
    : t === "link"
      ? "Link"
      : t === "cor"
        ? "Cor"
        : "Nota";
}
