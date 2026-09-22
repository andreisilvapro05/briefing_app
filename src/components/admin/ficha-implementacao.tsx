"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";
import { SubmitButton } from "./submit-button";
import { salvarFichaAction } from "@/app/admin/desenvolvimento/actions";
import {
  hostDe,
  type BotaoPagina,
  type FichaImplementacao,
  type PixelPagina,
} from "@/lib/ficha-implementacao";
import type { CredencialItem } from "@/lib/briefing-credenciais";

/**
 * A ficha de implementação de uma página: acessos, Figma, links de botão e
 * pixel — os quatro itens que a Karine pediu (2026-09-22) pra quem implementa
 * não precisar caçar pela ficha do cliente.
 *
 * Dois modos no mesmo arquivo, e não dois componentes soltos, porque a
 * ordem e os rótulos têm de ser os mesmos: quem preenche e quem usa estão
 * olhando pra mesma coisa, e a lista de campos não pode divergir com o tempo.
 */

function Secao({
  titulo,
  hint,
  children,
}: {
  titulo: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-fysi-line pt-4 mt-4 first:border-0 first:pt-0 first:mt-0">
      <h3 className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold">
        {titulo}
      </h3>
      {hint ? <p className="text-xs text-fysi-muted mt-0.5">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-fysi-muted italic">{children}</p>;
}

// ---------------------------------------------------------------------------
// Leitura — o que o desenvolvedor vê
// ---------------------------------------------------------------------------

function FichaView({ ficha }: { ficha: FichaImplementacao }) {
  return (
    <div>
      <Secao
        titulo="Acessos do cliente"
        hint="Domínio, hospedagem, WordPress. Só de quem você tem tarefa — e nunca vai pro link público do briefing."
      >
        {ficha.acessos.length === 0 ? (
          <Vazio>Nenhum acesso cadastrado ainda. Peça pra equipe.</Vazio>
        ) : (
          <ul className="flex flex-col gap-2">
            {ficha.acessos.map((c, i) => (
              <li
                key={`${c.contexto}-${c.rotulo}-${i}`}
                className="bg-white border border-amber-200 rounded-[12px] px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1"
              >
                <span className="text-xs uppercase tracking-[0.1em] text-fysi-muted">
                  {c.contexto}
                </span>
                <span className="text-sm font-medium text-fysi-deep">
                  {c.rotulo}
                </span>
                <code className="text-sm font-mono text-fysi-deep break-all flex-1 min-w-0">
                  {c.valor}
                </code>
                <CopyButton value={c.valor} label="Copiar" />
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Figma" hint="O design a implementar.">
        {ficha.figmaUrl ? (
          <a
            href={ficha.figmaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-fysi-deep underline break-all hover:text-fysi-deep/70"
          >
            {ficha.figmaUrl}
          </a>
        ) : (
          <Vazio>Sem link do Figma nesta Estrutura Inicial.</Vazio>
        )}
      </Secao>

      <Secao titulo="Links de botão" hint="Pra onde cada botão da página leva.">
        {ficha.botoes.length === 0 ? (
          <Vazio>Nenhum link de botão cadastrado.</Vazio>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ficha.botoes.map((b, i) => {
              const host = hostDe(b.destino);
              return (
                <li
                  key={`${b.rotulo}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-fysi-cream/50 border border-fysi-line rounded-[10px] px-3 py-2"
                >
                  <span className="text-sm font-medium text-fysi-deep">
                    {b.rotulo || "Botão sem nome"}
                  </span>
                  <span className="text-fysi-muted text-xs">→</span>
                  {/^https?:\/\//.test(b.destino) ? (
                    <a
                      href={b.destino}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-fysi-deep underline break-all"
                      title={b.destino}
                    >
                      {host ?? b.destino}
                    </a>
                  ) : (
                    <code className="text-sm font-mono text-fysi-deep break-all">
                      {b.destino}
                    </code>
                  )}
                  {b.destino ? (
                    <CopyButton value={b.destino} label="Copiar" />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      <Secao titulo="Pixel" hint="Rastreamento a instalar, quando houver.">
        {ficha.pixels.length === 0 ? (
          <Vazio>Sem pixel nesta página.</Vazio>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ficha.pixels.map((p, i) => (
              <li
                key={`${p.tipo}-${i}`}
                className="bg-fysi-cream/50 border border-fysi-line rounded-[10px] px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-fysi-deep">
                    {p.tipo || "Pixel"}
                  </span>
                  <code className="text-sm font-mono text-fysi-deep break-all flex-1 min-w-0">
                    {p.identificador}
                  </code>
                  {p.identificador ? (
                    <CopyButton value={p.identificador} label="Copiar" />
                  ) : null}
                </div>
                {p.observacao ? (
                  <p className="text-xs text-fysi-muted mt-1">{p.observacao}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edição — o que a equipe preenche
// ---------------------------------------------------------------------------

const INPUT =
  "w-full rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep placeholder:text-fysi-muted/70 focus:outline-none focus:border-fysi-deep";

function LinhaBotao({
  item,
  onChange,
  onRemove,
}: {
  item: BotaoPagina;
  onChange: (v: BotaoPagina) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col sm:flex-row gap-2 items-start">
      <input
        className={`${INPUT} sm:w-[36%]`}
        value={item.rotulo}
        placeholder="Nome do botão (ex: Quero agendar)"
        onChange={(e) => onChange({ ...item, rotulo: e.target.value })}
      />
      <input
        className={`${INPUT} flex-1`}
        value={item.destino}
        placeholder="Destino (https://wa.me/… ou #formulario)"
        onChange={(e) => onChange({ ...item, destino: e.target.value })}
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-xs font-medium text-red-700 hover:underline shrink-0 py-2"
      >
        Remover
      </button>
    </li>
  );
}

function FichaEditor({
  ficha,
  urlKey,
  voltarPara,
}: {
  ficha: FichaImplementacao;
  urlKey: string | null;
  voltarPara: string;
}) {
  const [figmaUrl, setFigmaUrl] = useState(ficha.figmaUrl ?? "");
  const [botoes, setBotoes] = useState<BotaoPagina[]>(ficha.botoes);
  const [pixels, setPixels] = useState<PixelPagina[]>(ficha.pixels);
  const [acessos, setAcessos] = useState<CredencialItem[]>(ficha.acessos);

  return (
    <form action={salvarFichaAction}>
      <input type="hidden" name="docId" value={ficha.docId} />
      <input type="hidden" name="voltarPara" value={voltarPara} />
      {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
      {/* As três listas viajam como JSON: o FormData não tem como
          representar uma lista de objetos que cresce e encolhe na tela. */}
      <input type="hidden" name="botoes" value={JSON.stringify(botoes)} />
      <input type="hidden" name="pixels" value={JSON.stringify(pixels)} />
      <input type="hidden" name="acessos" value={JSON.stringify(acessos)} />

      <Secao
        titulo="Acessos do cliente"
        hint="Domínio, hospedagem, WordPress. Ficam fora do corpo do documento — nunca vão pro link público do briefing, e só quem tem tarefa no projeto enxerga."
      >
        <ul className="flex flex-col gap-2">
          {acessos.map((c, i) => (
            <li key={i} className="flex flex-col sm:flex-row gap-2 items-start">
              <input
                className={`${INPUT} sm:w-[26%]`}
                value={c.contexto}
                placeholder="Onde (Hospedagem)"
                onChange={(e) =>
                  setAcessos(
                    acessos.map((x, j) =>
                      j === i ? { ...x, contexto: e.target.value } : x
                    )
                  )
                }
              />
              <input
                className={`${INPUT} sm:w-[22%]`}
                value={c.rotulo}
                placeholder="O quê (Senha)"
                onChange={(e) =>
                  setAcessos(
                    acessos.map((x, j) =>
                      j === i ? { ...x, rotulo: e.target.value } : x
                    )
                  )
                }
              />
              <input
                className={`${INPUT} flex-1 font-mono`}
                value={c.valor}
                placeholder="Valor"
                onChange={(e) =>
                  setAcessos(
                    acessos.map((x, j) =>
                      j === i ? { ...x, valor: e.target.value } : x
                    )
                  )
                }
              />
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Remover este acesso? O valor guardado aqui será apagado."
                    )
                  ) {
                    setAcessos(acessos.filter((_, j) => j !== i));
                  }
                }}
                className="text-xs font-medium text-red-700 hover:underline shrink-0 py-2"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            setAcessos([
              ...acessos,
              { contexto: "Acessos", rotulo: "", valor: "" },
            ])
          }
          className="text-xs font-medium text-fysi-deep hover:underline mt-2"
        >
          + Acesso
        </button>
      </Secao>

      <Secao titulo="Figma" hint="O design a implementar.">
        <input
          className={INPUT}
          name="figmaUrl"
          value={figmaUrl}
          placeholder="https://figma.com/design/…"
          onChange={(e) => setFigmaUrl(e.target.value)}
        />
      </Secao>

      <Secao titulo="Links de botão" hint="Pra onde cada botão da página leva.">
        <ul className="flex flex-col gap-2">
          {botoes.map((b, i) => (
            <LinhaBotao
              key={i}
              item={b}
              onChange={(v) => setBotoes(botoes.map((x, j) => (j === i ? v : x)))}
              onRemove={() => setBotoes(botoes.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setBotoes([...botoes, { rotulo: "", destino: "" }])}
          className="text-xs font-medium text-fysi-deep hover:underline mt-2"
        >
          + Botão
        </button>
      </Secao>

      <Secao titulo="Pixel" hint="Rastreamento a instalar, quando houver.">
        <ul className="flex flex-col gap-2">
          {pixels.map((p, i) => (
            <li key={i} className="flex flex-col sm:flex-row gap-2 items-start">
              <input
                className={`${INPUT} sm:w-[22%]`}
                value={p.tipo}
                placeholder="Meta, GA4…"
                onChange={(e) =>
                  setPixels(
                    pixels.map((x, j) =>
                      j === i ? { ...x, tipo: e.target.value } : x
                    )
                  )
                }
              />
              <input
                className={`${INPUT} sm:w-[30%] font-mono`}
                value={p.identificador}
                placeholder="ID do pixel"
                onChange={(e) =>
                  setPixels(
                    pixels.map((x, j) =>
                      j === i ? { ...x, identificador: e.target.value } : x
                    )
                  )
                }
              />
              <input
                className={`${INPUT} flex-1`}
                value={p.observacao}
                placeholder="Onde instalar / evento"
                onChange={(e) =>
                  setPixels(
                    pixels.map((x, j) =>
                      j === i ? { ...x, observacao: e.target.value } : x
                    )
                  )
                }
              />
              <button
                type="button"
                onClick={() => setPixels(pixels.filter((_, j) => j !== i))}
                className="text-xs font-medium text-red-700 hover:underline shrink-0 py-2"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            setPixels([
              ...pixels,
              { tipo: "", identificador: "", observacao: "" },
            ])
          }
          className="text-xs font-medium text-fysi-deep hover:underline mt-2"
        >
          + Pixel
        </button>
      </Secao>

      <div className="mt-5">
        <SubmitButton>Salvar ficha</SubmitButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

export function FichaImplementacaoPainel({
  ficha,
  podeEditar,
  urlKey,
  voltarPara,
}: {
  ficha: FichaImplementacao;
  /** false = papel "desenvolvedor" (ou fora do escopo): lê, não escreve. */
  podeEditar: boolean;
  urlKey: string | null;
  /** Rota a revalidar depois de salvar — a tela de onde a ficha foi aberta. */
  voltarPara: string;
}) {
  return (
    <div className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-5">
      {podeEditar ? (
        <FichaEditor ficha={ficha} urlKey={urlKey} voltarPara={voltarPara} />
      ) : (
        <FichaView ficha={ficha} />
      )}
    </div>
  );
}
