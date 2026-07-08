"use client";

import type { EIData } from "@/lib/ei-template";

/**
 * Vista de DOCUMENTO da Estrutura Inicial (só leitura). É o que a equipe abre
 * pra montar a página: dados de acesso, materiais, referências e a copy por
 * seção — com o link do Drive em destaque no topo. Edição fica no EIEditor.
 */

function Campo({ label, value }: { label: string; value?: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="py-2.5 border-t border-fysi-line first:border-t-0">
      <div className="text-[0.66rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold">
        {label}
      </div>
      <div className="text-sm text-fysi-deep whitespace-pre-wrap mt-1 leading-relaxed">
        {value}
      </div>
    </div>
  );
}

export function EIDocument({
  data,
  clientName,
  empresa,
  atualizadoAt,
  fallbackDrive,
}: {
  data: EIData | null;
  clientName: string | null;
  empresa: string | null;
  atualizadoAt: string | null;
  /** Drive do cadastro do cliente, usado se a EI ainda não tem link próprio. */
  fallbackDrive?: string | null;
}) {
  const titulo = empresa || clientName || "Cliente";
  const drive = (data?.driveLink || fallbackDrive || "").trim();

  if (!data) {
    return (
      <section className="bg-white border border-fysi-line rounded-[20px] p-8 text-center">
        <p className="text-fysi-deep font-medium">Estrutura Inicial ainda não montada.</p>
        <p className="text-sm text-fysi-muted mt-1">
          Clique em <strong>Editar</strong> pra preencher a partir do briefing.
        </p>
        {drive ? (
          <a
            href={drive}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 rounded-full bg-fysi-mint border border-fysi-mint-vivid text-fysi-deep text-sm font-semibold px-4 py-2"
          >
            📁 Abrir pasta no Drive
          </a>
        ) : null}
      </section>
    );
  }

  const secoesComConteudo = data.secoes.filter(
    (s) => s.titulo || s.texto || s.cta || s.obs
  );

  return (
    <article className="bg-white border border-fysi-line rounded-[20px] p-6 sm:p-8 max-w-3xl">
      <header className="mb-5">
        <div className="text-[0.66rem] uppercase tracking-[0.14em] text-fysi-muted font-semibold">
          Estrutura Inicial · documento de produção
        </div>
        <h2 className="text-2xl font-semibold text-fysi-deep tracking-tight mt-1">
          {titulo}
        </h2>
        {atualizadoAt ? (
          <p className="text-xs text-fysi-muted mt-1">
            Atualizado em{" "}
            {new Date(atualizadoAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        ) : null}
      </header>

      {drive ? (
        <a
          href={drive}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-[14px] bg-fysi-mint border border-fysi-mint-vivid px-4 py-3 mb-6 hover:opacity-90 transition"
        >
          <span className="text-lg">📁</span>
          <span className="min-w-0">
            <span className="block text-[0.66rem] uppercase tracking-[0.1em] text-fysi-deep/70 font-semibold">
              Pasta no Drive
            </span>
            <span className="block text-sm text-fysi-deep font-medium truncate">
              {drive}
            </span>
          </span>
          <span className="ml-auto text-fysi-deep font-semibold text-sm shrink-0">
            Abrir →
          </span>
        </a>
      ) : null}

      <section className="mb-6">
        <h3 className="text-sm font-semibold text-fysi-deep mb-1">
          Acesso &amp; materiais
        </h3>
        <div>
          <Campo label="Dados de acesso (domínio / hospedagem / WP)" value={data.dadosAcesso} />
          <Campo label="Briefing" value={data.briefingLink} />
          <Campo label="Logo" value={data.logo} />
          <Campo label="Imagens" value={data.imagens} />
          <Campo label="Fonte" value={data.fonteLetra} />
          <Campo label="Cores" value={data.cores} />
          <Campo label="Páginas de referência" value={data.paginasReferencia} />
          <Campo label="Referências gerais" value={data.referenciasGerais} />
          <Campo label="Copy / infos que o cliente enviou" value={data.copyExterno} />
          <Campo label="Menu" value={data.menuTem} />
        </div>
      </section>

      {secoesComConteudo.length > 0 ? (
        <section className="mb-2">
          <h3 className="text-sm font-semibold text-fysi-deep mb-3">
            Copy por seção da página
          </h3>
          <div className="flex flex-col gap-4">
            {secoesComConteudo.map((s, i) => (
              <div
                key={i}
                className="rounded-[12px] border border-fysi-line bg-fysi-cream/40 p-4"
              >
                <div className="text-[0.66rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold">
                  {s.nome}
                </div>
                {s.obs ? (
                  <div className="text-xs text-fysi-muted italic mt-1">obs: {s.obs}</div>
                ) : null}
                {s.ref ? (
                  <a
                    href={s.ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-fysi-green underline break-all mt-1 inline-block"
                  >
                    ref: {s.ref}
                  </a>
                ) : null}
                {s.titulo ? (
                  <p className="text-base font-semibold text-fysi-deep mt-2">{s.titulo}</p>
                ) : null}
                {s.texto ? (
                  <p className="text-sm text-fysi-deep whitespace-pre-wrap mt-1 leading-relaxed">
                    {s.texto}
                  </p>
                ) : null}
                {s.cta ? (
                  <p className="text-sm mt-2">
                    <span className="text-fysi-muted">CTA: </span>
                    <span className="font-medium text-fysi-deep">{s.cta}</span>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Campo label="Rodapé" value={data.rodape} />
    </article>
  );
}
