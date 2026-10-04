import Link from "next/link";
import { StatusChanger } from "./status-changer";
import {
  CelulaDataEditavel,
  CelulaResponsavelEditavel,
} from "./celulas-editaveis";
import {
  ordenarProjetosDoMembro,
  resumoDosProjetos,
  type ProjetoDoMembro,
} from "@/lib/meus-projetos";

/**
 * "Meus projetos" — o espaço do membro dentro de "Meu Trabalho".
 *
 * Karine (04/10): "precisa ter o espaço de cada membro, poder atualizar o
 * projeto por ali e já ficar atualizado". A tela tinha só as TAREFAS da
 * pessoa, e isso deixava de fora exatamente quem mais precisa dela: o
 * Andrei é gestor de dezenas de projetos e dono de etapa nenhuma, então o
 * "Meu Trabalho" dele abria vazio.
 *
 * Os projetos vêm de `projetosDaPessoa` — tarefa dela OU projeto sob a
 * responsabilidade dela. E o que ela muda aqui escreve no projeto de
 * verdade (`clients`), pelas MESMAS actions da Lista por status: o valor
 * aparece na hora e vale em toda tela que mostra aquele projeto.
 *
 * Server Component que monta client components — nada aqui precisa de
 * estado; quem precisa é cada célula editável.
 */
export function MeusProjetos({
  projetos,
  hoje,
  keyParam,
  urlKey,
  podeEditarCampos,
}: {
  projetos: ProjetoDoMembro[];
  hoje: string;
  keyParam: string;
  urlKey: string | null;
  /**
   * Responsável e datas do projeto são decisão de OPERAÇÃO — a action que
   * as grava exige acesso completo (mesmo critério de `ajustarProjetoAction`).
   * Sem isso, o campo apareceria editável e a escrita seria recusada em
   * silêncio: a tela prometendo o que o servidor não cumpre.
   *
   * O STATUS não entra neste corte: quem está fazendo a etapa precisa
   * poder movê-la, e é o que `setClientStatusAction` já permite a quem
   * tem o cliente no escopo.
   */
  podeEditarCampos: boolean;
}) {
  const lista = ordenarProjetosDoMembro(projetos, hoje);
  const resumo = resumoDosProjetos(projetos, hoje);

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-semibold text-fysi-deep">
            Meus projetos
          </h2>
          <p className="text-xs text-fysi-muted mt-0.5">
            Onde você está marcado — como responsável do projeto ou de uma
            etapa dele. O que mudar aqui vale em todas as telas.
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-2">
          <Chip rotulo={`${resumo.total} no total`} />
          {resumo.atrasados > 0 ? (
            <Chip rotulo={`${resumo.atrasados} em atraso`} tom="alerta" />
          ) : null}
          {resumo.vencemHoje > 0 ? (
            <Chip rotulo={`${resumo.vencemHoje} vence hoje`} tom="atencao" />
          ) : null}
          {resumo.finalizados > 0 ? (
            <Chip rotulo={`${resumo.finalizados} finalizado${resumo.finalizados === 1 ? "" : "s"}`} />
          ) : null}
        </ul>
      </header>

      {lista.length === 0 ? (
        <p className="text-sm text-fysi-muted py-4">
          Você não está marcado em nenhum projeto ainda — nem como responsável
          do projeto, nem de uma etapa. Quem organiza isso é quem tem acesso
          completo, na{" "}
          <Link href={`/admin/lista${keyParam}`} className="underline">
            Lista por status
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-separate border-spacing-y-1 px-1">
            <thead>
              <tr className="text-[0.68rem] uppercase tracking-[0.08em] text-fysi-muted text-left">
                <th className="font-semibold px-2 py-1">Projeto</th>
                <th className="font-semibold px-2 py-1">Status</th>
                <th className="font-semibold px-2 py-1">Resp.</th>
                <th className="font-semibold px-2 py-1">Início</th>
                <th className="font-semibold px-2 py-1">Vencimento</th>
                <th className="font-semibold px-2 py-1">Ata</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="bg-fysi-cream/30">
                  <td className="px-2 py-2 rounded-l-[10px] max-w-[18rem]">
                    <Link
                      href={`/admin/${p.id}${keyParam}`}
                      className="font-medium text-fysi-deep hover:underline block truncate"
                      title={p.tarefa ? `Sua etapa: ${p.tarefa}` : p.nome}
                    >
                      {p.nome}
                    </Link>
                    {p.tarefa ? (
                      <span className="text-xs text-fysi-muted block truncate">
                        {p.tarefa}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 max-w-[11rem]">
                    <StatusChanger
                      clientId={p.id}
                      status={p.status}
                      urlKey={urlKey ?? undefined}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <CelulaResponsavelEditavel
                      clientId={p.id}
                      valor={p.responsavel}
                      tarefa={p.tarefa}
                      urlKey={urlKey}
                      somenteLeitura={!podeEditarCampos}
                    />
                  </td>
                  <td className="px-2 py-2 w-[6.5rem]">
                    <CelulaDataEditavel
                      clientId={p.id}
                      campo="data_inicial"
                      iso={p.dataInicial}
                      rotulo="Data inicial"
                      urlKey={urlKey}
                      somenteLeitura={!podeEditarCampos}
                    />
                  </td>
                  <td className="px-2 py-2 w-[6.5rem]">
                    <CelulaDataEditavel
                      clientId={p.id}
                      campo="data_vencimento"
                      iso={p.dataVencimento}
                      rotulo="Vencimento"
                      urlKey={urlKey}
                      alertaSeVencida
                      somenteLeitura={!podeEditarCampos}
                    />
                  </td>
                  <td className="px-2 py-2 rounded-r-[10px] whitespace-nowrap">
                    {/* Leva pra ata mais recente do projeto; sem nenhuma,
                        leva pra tela de atas, onde ela é aberta. Nunca um
                        link que CRIA: <Link> faz prefetch e abriria ata
                        sozinha ao passar o mouse. */}
                    {p.ataId ? (
                      <Link
                        href={`/admin/ata/${p.ataId}${keyParam}`}
                        className="text-xs text-fysi-deep underline underline-offset-2"
                        title={
                          p.atas === 1
                            ? "Abrir a ata deste projeto"
                            : `Abrir a ata mais recente (${p.atas} no total)`
                        }
                      >
                        ata{p.atas > 1 ? ` · ${p.atas}` : ""}
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/ata${keyParam}`}
                        className="text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
                        title="Nenhuma ata ainda — abrir a tela de atas"
                      >
                        abrir
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Chip({
  rotulo,
  tom = "neutro",
}: {
  rotulo: string;
  tom?: "neutro" | "atencao" | "alerta";
}) {
  const classes =
    tom === "alerta"
      ? "border-red-200 bg-red-50 text-red-700"
      : tom === "atencao"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-fysi-line bg-fysi-cream/40 text-fysi-deep";
  return (
    <li
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${classes}`}
    >
      {rotulo}
    </li>
  );
}
