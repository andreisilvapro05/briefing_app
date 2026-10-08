"use client";

import { useMemo, useState } from "react";
import {
  montarCSV,
  resumirPorOrigem,
  SEM_ORIGEM,
  type LinhaDeOrigem,
} from "@/lib/origem-dos-clientes";

/**
 * "De onde veio cada cliente que fechou, com data" — a aba de Relatórios.
 *
 * Karine (08/10): "preciso de um relatório de onde veio cada cliente que
 * fechou, com data", "uma aba sobre isso" e "poder baixar para enviar para
 * os dados de anúncios".
 *
 * O download é feito AQUI, no navegador, a partir dos dados que a tela já
 * tem: nenhuma rota nova, nenhuma superfície nova de autorização pra um
 * arquivo que leva e-mail e telefone de cliente.
 */
export function OrigemDosClientes({ linhas }: { linhas: LinhaDeOrigem[] }) {
  const [so, setSo] = useState<"fechados" | "todos">("fechados");

  const visiveis = useMemo(
    () => (so === "fechados" ? linhas.filter((l) => l.fechouEm) : linhas),
    [linhas, so]
  );
  const resumo = useMemo(() => resumirPorOrigem(linhas), [linhas]);
  const maior = Math.max(1, ...resumo.map((r) => r.leads));

  function baixar() {
    const csv = montarCSV(visiveis);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `origem-dos-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const semOrigem = linhas.filter((l) => l.origem === SEM_ORIGEM).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Resumo por canal ---- */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="text-lg font-medium text-fysi-deep">Por canal</h2>
          <p className="text-xs text-fysi-muted">
            &quot;Fechou&quot; = preencheu os dados do contrato. Não existe
            data de assinatura no sistema.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-fysi-muted">
              <tr className="border-b border-fysi-line">
                <th className="py-2 pr-3 font-medium">Canal</th>
                <th className="py-2 px-3 font-medium text-right">Entraram</th>
                <th className="py-2 px-3 font-medium text-right">Fecharam</th>
                <th className="py-2 px-3 font-medium text-right">Conversão</th>
                <th className="py-2 px-3 font-medium text-right">
                  Dias até fechar
                </th>
                <th className="py-2 pl-3 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((r) => (
                <tr key={r.origem} className="border-b border-fysi-line/60">
                  <td className="py-2 pr-3">
                    <span className="text-fysi-deep">{r.origem}</span>
                    {/* A barra dá a proporção sem precisar comparar números. */}
                    <span
                      className="block h-1 rounded-full bg-fysi-mint-vivid mt-1"
                      style={{ width: `${Math.round((r.leads / maior) * 100)}%` }}
                      aria-hidden
                    />
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-fysi-muted">
                    {r.leads}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-fysi-deep font-medium">
                    {r.fechados}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-fysi-muted">
                    {Math.round(r.conversao * 100)}%
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-fysi-muted">
                    {r.medianaDias === null ? "—" : r.medianaDias}
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums text-fysi-deep">
                    {r.valor > 0
                      ? r.valor.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-fysi-muted mt-3">
          Dias até fechar é a <strong>mediana</strong>, não a média: um
          cliente que demorou meses puxaria a média pra um número que não
          descreve ninguém.
          {semOrigem > 0 ? (
            <>
              {" "}
              {semOrigem} cliente{semOrigem === 1 ? "" : "s"} sem origem
              preenchida — dá pra ajustar na ficha de cada um.
            </>
          ) : null}
        </p>
      </section>

      {/* ---- Cliente a cliente ---- */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-medium text-fysi-deep">
            Cliente a cliente
            <span className="text-sm text-fysi-muted font-normal tabular-nums">
              {" "}
              {visiveis.length}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={so}
              onChange={(e) => setSo(e.target.value as typeof so)}
              aria-label="Quem mostrar"
              className="rounded-[10px] border border-fysi-line bg-white text-sm px-2.5 py-1.5 text-fysi-deep"
            >
              <option value="fechados">Só quem fechou</option>
              <option value="todos">Todos, inclusive leads</option>
            </select>
            <button
              type="button"
              onClick={baixar}
              className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
            >
              Baixar planilha
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-fysi-muted">
              <tr className="border-b border-fysi-line">
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="py-2 px-3 font-medium">Canal</th>
                <th className="py-2 px-3 font-medium">Entrou</th>
                <th className="py-2 px-3 font-medium">Fechou</th>
                <th className="py-2 px-3 font-medium text-right">Dias</th>
                <th className="py-2 pl-3 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.id} className="border-b border-fysi-line/60">
                  <td className="py-2 pr-3 text-fysi-deep">{l.cliente}</td>
                  <td className="py-2 px-3 text-fysi-muted">{l.origem}</td>
                  <td className="py-2 px-3 text-fysi-muted tabular-nums">
                    {formatarDia(l.entrouEm)}
                  </td>
                  <td className="py-2 px-3 tabular-nums">
                    {l.fechouEm ? (
                      <span className="text-fysi-deep">
                        {formatarDia(l.fechouEm)}
                        {l.contratoAssinado ? null : (
                          <span
                            className="text-fysi-muted"
                            title="Preencheu os dados, mas o contrato ainda não consta assinado"
                          >
                            {" "}
                            · sem assinatura
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-fysi-muted">ainda não</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-fysi-muted">
                    {l.diasAteFechar ?? "—"}
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums text-fysi-deep">
                    {l.valor > 0
                      ? l.valor.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visiveis.length === 0 ? (
          <p className="text-sm text-fysi-muted py-6 text-center">
            Ninguém aqui ainda.
          </p>
        ) : null}

        <p className="text-xs text-fysi-muted mt-3 border-t border-fysi-line pt-3">
          A planilha sai com e-mail e WhatsApp junto, que é o que as
          plataformas de anúncio usam pra casar a conversão. São dados
          pessoais dos seus clientes — o arquivo não deve circular além
          disso.
        </p>
      </section>
    </div>
  );
}

/** YYYY-MM-DD → DD/MM. O ano só aparece quando não é o atual. */
function formatarDia(dia: string): string {
  if (!dia) return "—";
  const [ano, mes, d] = dia.split("-");
  const anoAtual = String(new Date().getFullYear());
  return ano === anoAtual ? `${d}/${mes}` : `${d}/${mes}/${ano}`;
}
