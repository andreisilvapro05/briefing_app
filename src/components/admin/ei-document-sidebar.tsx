"use client";

import { useState } from "react";
import Link from "next/link";
import { useTransition } from "react";
import type { EIDocumentSummary } from "@/lib/ei-documents";

/**
 * Sidebar do hub de documentos (EI ou Briefing — mesma tabela ei_documents,
 * kind diferente). Genérico via props (basePath/createAction/createLabel)
 * desde 2026-09-01, quando ganhou o hub de Briefing além do de EI.
 */
export function EIDocumentSidebar({
  docs,
  activeId,
  urlKey,
  clientsWithoutDoc,
  criarDireto = false,
  basePath = "/admin/estruturas-iniciais",
  createAction,
  createLabel = "+ Nova Estrutura Inicial",
  subTabs,
  modelos = [],
}: {
  docs: EIDocumentSummary[];
  activeId: string;
  urlKey: string | null;
  /**
   * TODOS os clientes, com `jaTem` marcando quem já possui documento ativo.
   * Antes esta lista trazia só quem NÃO tinha — e, com 32 dos 44 clientes
   * já atendidos, era impossível começar um briefing novo justamente pra
   * quem mais precisa (cliente antigo, segundo projeto, chamada nova).
   */
  clientsWithoutDoc: {
    id: string;
    nome: string | null;
    empresa: string | null;
    jaTem?: boolean;
  }[];
  basePath?: string;
  createAction: (formData: FormData) => void | Promise<void>;
  createLabel?: string;
  /**
   * Criação DIRETA, sem escolher cliente — é o caso do documento em branco:
   * clicar já cria e abre, como o "+ New doc" do ClickUp. Com isso, a lista
   * de clientes nem aparece.
   */
  criarDireto?: boolean;
  /**
   * Modelos disponíveis pra este tipo de documento. Com mais de um, a
   * barra de criar pergunta de qual partir — site e landing de produto
   * começam com perguntas diferentes (Karine, 01/10).
   */
  modelos?: { id: string; nome: string }[];
  // Sub-abas no topo da sidebar (ex: Respostas / Documentos, no hub de
  // Briefing) — pedido do usuário 2026-09-01 pra "Documentos de Briefing"
  // ficar junto de "Briefings", não solto como área própria.
  subTabs?: { label: string; href: string; active: boolean }[];
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  /** "" = o modelo padrão (o mais antigo), que é o de sempre. */
  const [modeloId, setModeloId] = useState("");
  const [verArquivo, setVerArquivo] = useState(false);
  const [pending, startTransition] = useTransition();

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const busca = query.trim().toLowerCase();
  const filtered = docs.filter((d) => d.title.toLowerCase().includes(busca));
  // Ativos e arquivo em blocos separados. A BUSCA alcança os dois: quem
  // digita o nome de um ex-cliente quer achá-lo, e é justamente pra isso
  // que o arquivo existe. Sem busca, o arquivo fica recolhido — são
  // centenas de páginas importadas do ClickUp, e uma lista plana com todas
  // ficaria pior do que era antes de importar.
  const ativos = filtered.filter((d) => !d.arquivado);
  const arquivados = filtered.filter((d) => d.arquivado);
  const buscando = busca.length > 0;

  /**
   * Cria pra um cliente que ainda NÃO existe — o nome digitado na busca.
   *
   * Karine (01/10): "nem sempre tem cliente... poder adicionar eu mesmo
   * ali o nome do cliente e já fazer o briefing com ele". O briefing de
   * chamada costuma ser o primeiro contato: exigir a ficha antes obrigava
   * a sair da tela no meio da conversa.
   */
  const filtroCliente = buscaCliente.trim().toLowerCase();
  const clientesFiltrados = filtroCliente
    ? clientsWithoutDoc.filter((c) =>
        `${c.empresa ?? ""} ${c.nome ?? ""}`.toLowerCase().includes(filtroCliente)
      )
    : clientsWithoutDoc;

  function createForNome(nome: string) {
    const fd = new FormData();
    fd.append("nomeNovoCliente", nome);
    if (modeloId) fd.append("templateId", modeloId);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await createAction(fd);
    });
  }

  function createFor(clientId: string, jaTem?: boolean) {
    const fd = new FormData();
    fd.append("clientId", clientId);
    if (modeloId) fd.append("templateId", modeloId);
    // Quem já tem documento ganha um NOVO em vez de ser levado pro antigo.
    if (jaTem) fd.append("novo", "1");
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await createAction(fd);
    });
  }

  return (
    <aside className="w-[280px] shrink-0 border-r border-fysi-line bg-white flex flex-col h-full">
      {subTabs ? (
        <div className="flex gap-1 p-2 border-b border-fysi-line">
          {subTabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 text-center rounded-[8px] px-2 py-1.5 text-xs font-medium transition ${
                t.active
                  ? "bg-fysi-deep text-fysi-cream"
                  : "text-fysi-muted hover:bg-fysi-cream/60"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="p-3 border-b border-fysi-line flex flex-col gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar documento…"
          className="w-full rounded-[8px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-1.5"
        />
        {criarDireto ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => createFor("")}
            className="text-sm font-medium text-fysi-deep hover:text-fysi-green text-left disabled:opacity-50"
          >
            {pending ? "Criando…" : createLabel}
          </button>
        ) : clientsWithoutDoc.length > 0 ? (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="text-sm font-medium text-fysi-deep hover:text-fysi-green text-left"
          >
            {creating ? "Cancelar" : createLabel}
          </button>
        ) : null}
        {creating && !criarDireto ? (
          <div className="flex flex-col gap-1.5 rounded-[10px] border border-fysi-line bg-fysi-cream/30 p-2">
            <p className="text-xs uppercase tracking-[0.08em] text-fysi-muted px-1">
              Selecione o cliente
            </p>
            {/* Busca própria: com 45 clientes, rolar a lista inteira pra
                achar um nome era o caminho mais lento da tela. */}
            {/* De qual modelo parte. Só aparece com mais de um: com um
                só, a pergunta não tem resposta errada nem certa. */}
            {modelos.length > 1 ? (
              <select
                value={modeloId}
                onChange={(e) => setModeloId(e.target.value)}
                aria-label="Modelo de briefing"
                className="w-full rounded-[8px] border border-fysi-line bg-white text-sm px-2 py-1.5 text-fysi-deep"
              >
                <option value="">Modelo padrão</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              autoFocus
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
              placeholder="Buscar ou escrever um nome novo…"
              className="w-full rounded-[8px] border border-fysi-line bg-white text-sm px-2 py-1.5"
            />
            {/* Nome que não casa com ninguém vira cliente novo aqui mesmo. */}
            {buscaCliente.trim().length >= 2 && clientesFiltrados.length === 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => createForNome(buscaCliente.trim())}
                className="text-left text-sm font-medium text-fysi-deep hover:text-fysi-green disabled:opacity-50 px-1 py-1"
              >
                {pending
                  ? "Criando…"
                  : `+ Criar cliente "${buscaCliente.trim()}" e começar`}
              </button>
            ) : null}
            {clientesFiltrados.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={pending}
                onClick={() => createFor(c.id, c.jaTem)}
                title={
                  c.jaTem
                    ? "Já tem um documento — isto cria OUTRO, a partir do Modelo"
                    : "Cria a partir do Modelo"
                }
                className="flex items-center gap-1.5 text-left text-sm text-fysi-deep hover:text-fysi-green disabled:opacity-50 min-w-0"
              >
                <span className="truncate min-w-0">
                  {c.empresa || c.nome || "Sem nome"}
                </span>
                {/* Marca quem já tem: sem isso, clicar no nome parecia que
                    ia abrir o documento existente, não criar outro. */}
                {c.jaTem ? (
                  <span className="shrink-0 text-[0.62rem] uppercase tracking-[0.08em] text-fysi-muted border border-fysi-line rounded-full px-1.5">
                    outro
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {ativos.map((doc) => (
          <ItemDoc
            key={doc.id}
            doc={doc}
            ativo={doc.id === activeId}
            href={`${basePath}/${doc.id}${kp}`}
          />
        ))}

        {ativos.length === 0 && !buscando ? (
          <p className="px-3 py-2 text-xs text-fysi-muted">
            Nenhum documento ativo.
          </p>
        ) : null}

        {arquivados.length > 0 ? (
          <div className="mt-1 border-t border-fysi-line pt-1">
            <button
              type="button"
              onClick={() => setVerArquivo((v) => !v)}
              aria-expanded={buscando || verArquivo}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs uppercase tracking-[0.08em] text-fysi-muted hover:text-fysi-deep"
            >
              <span
                className={`transition-transform ${
                  buscando || verArquivo ? "" : "-rotate-90"
                }`}
                aria-hidden
              >
                <svg width="9" height="9" viewBox="0 0 10 10">
                  <path
                    d="M1 3l4 4 4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Arquivo
              <span className="ml-auto tabular-nums normal-case tracking-normal">
                {arquivados.length}
              </span>
            </button>
            {/* Buscando, o arquivo abre sozinho: quem digitou o nome de um
                ex-cliente está procurando exatamente ali. */}
            {buscando || verArquivo
              ? arquivados.map((doc) => (
                  <ItemDoc
                    key={doc.id}
                    doc={doc}
                    ativo={doc.id === activeId}
                    href={`${basePath}/${doc.id}${kp}`}
                    apagado
                  />
                ))
              : null}
          </div>
        ) : null}

        {buscando && filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-fysi-muted">
            Nada com esse nome, nem no arquivo.
          </p>
        ) : null}
      </nav>
    </aside>
  );
}

/** Uma linha da barra lateral. `apagado` = está no arquivo. */
function ItemDoc({
  doc,
  ativo,
  href,
  apagado = false,
}: {
  doc: EIDocumentSummary;
  ativo: boolean;
  href: string;
  apagado?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 text-sm truncate ${
        ativo
          ? "bg-fysi-mint/40 text-fysi-deep font-medium"
          : apagado
            ? "text-fysi-muted/70 hover:bg-fysi-cream/60 hover:text-fysi-deep"
            : "text-fysi-muted hover:bg-fysi-cream/60 hover:text-fysi-deep"
      }`}
    >
      {doc.isTemplate ? <span title="Modelo">★</span> : null}
      <span className="truncate">{doc.title}</span>
    </Link>
  );
}
