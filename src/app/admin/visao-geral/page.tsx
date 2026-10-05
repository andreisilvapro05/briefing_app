import { redirect } from "next/navigation";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/pill";
import {
  hasTaskScopedRole, getCurrentMember, getVisibleClientIds, hasFinanceAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { getLaneGroups } from "@/lib/lane-groups-server";
import { listAllProjectTasks } from "@/lib/project-tasks-server";
import { soTrabalhoAtivo } from "@/lib/trabalho-ativo";
import {
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  isClosedTaskStatus,
} from "@/lib/project-tasks";
import { StatusPieBoard } from "@/components/admin/status-pie-board";
import { abasPorPessoa, projetosDaPessoa, respValido } from "@/lib/abas-pessoa";
import { ProjetosAVencer } from "@/components/admin/projetos-a-vencer";
import { montarProjetosAVencer } from "@/lib/projetos-a-vencer";
import { hojeEmBrasilia } from "@/lib/datas";
import { agruparDemandas } from "@/lib/agrupar-demandas";
import { TEAM_MEMBERS } from "@/lib/project-tasks";

/**
 * Visão Geral — dashboard pros gestores: pizza selecionável, projetos a
 * vencer e tarefas pendentes da equipe. Pedido do usuário (2026-08-31):
 * "isso é essencial".
 *
 * Filtrada por getVisibleClientIds() (Caixa 0) — um membro "basico" só vê
 * a pizza/tarefas dos clientes em que está marcado.
 *
 * Dentro desse escopo, a barra de abas recorta por pessoa (?resp=karine):
 * a pizza mostra só os projetos em que ela tem tarefa aberta, e a lista
 * embaixo só as tarefas dela. O recorte tem endereço próprio, então
 * recarrega e pode ser mandado — como as views do ClickUp.
 */

export const dynamic = "force-dynamic";

const TAREFAS_LIMIT = 8;
/** Quantas demandas internas listar por área antes de resumir o resto. */
const INTERNAS_POR_AREA = 4;

/** Quantos dias à frente entram em "Projetos a vencer". */
const JANELA_A_VENCER = 14;
/** Quantas linhas cabem antes de virar rolagem — o resto fica em "Ver todos". */
const A_VENCER_LIMIT = 8;

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; resp?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const novoHref = `/admin/novo${keyParam}`;
  // Lido antes das consultas: entra em getLaneGroups, porque as colunas
  // Responsável/Início/Vencimento/Prioridade da linha saem da tarefa
  // daquela pessoa.
  const respDaUrl = respValido(params.resp) ? params.resp : "";

  const visibleIds = await getVisibleClientIds(member);
  const [allTasks, laneGroupsTodos] = await Promise.all([
    listAllProjectTasks(),
    getLaneGroups(visibleIds, respDaUrl || null),
  ]);

  /**
   * Cliente de TRÁFEGO não entra na lista de Projetos.
   *
   * Karine (28/09): "a Carla é de tráfego, precisaremos separar uma aba
   * para esses clientes" e "a Carla precisa sair dali". Tráfego é serviço
   * contínuo — não tem copy, design nem implementação —, então ele polui
   * um quadro cujas raias são as etapas de uma página.
   *
   * Aqui a Visão Geral só EXCLUI; quem conta e explica é a tela de
   * Projetos, que é onde a pessoa vai procurar o cliente que sumiu.
   */
  const ehTrafego = (t: string | null) => t === "trafego";
  const laneGroupsTodosSemTrafego = laneGroupsTodos.map((g) => ({
    ...g,
    clients: g.clients.filter((c) => !ehTrafego(c.projectType)),
  }));

  /**
   * Recorte por pessoa — a "Lista Karine", "Lista Andrei" do ClickUp, agora
   * também aqui. Sem isso a Visão Geral era sempre o painel da agência
   * inteira: quem quisesse ver o próprio quadro tinha que ler 43 projetos
   * e achar os seus no meio.
   *
   * Um projeto entra no recorte de alguém quando ela é a responsável DELE
   * ou tem pelo menos uma tarefa aberta nele. A primeira metade é recente:
   * até 28/09 projeto não tinha dono próprio, e quando passou a ter (o
   * Andrei, gestor de projetos, vindo do ClickUp) o recorte continuou
   * olhando só tarefa — a aba dele abria vazia com o avatar dele em toda
   * linha.
   */
  const resp = respDaUrl;

  /* Tarefa aberta de projeto JÁ ENTREGUE fica de fora das contas de
     trabalho (Karine, 04/10: "ali não deve aparecer"). Eram 24 projetos
     entregues com 158 tarefas abertas — a conta de "tarefas pendentes da
     equipe" era ficção. Ver src/lib/trabalho-ativo.ts. */
  const abertas = soTrabalhoAtivo(allTasks).filter(
    (t) => !isClosedTaskStatus(t.status)
  );

  const ativasVisiveis = abertas
    .filter((t) => t.client !== null && t.client_id !== null)
    .filter((t) => !visibleIds || visibleIds.has(t.client_id as string));

  /**
   * Demanda INTERNA da agência — a que não pertence a cliente nenhum
   * (curso, marketing, processos, ajustes técnicos). Karine (30/09):
   * "pode mostrar projetos internos".
   *
   * Esta tela descartava tudo com `client_id` nulo, então o trabalho
   * interno não existia aqui: nem na rosca, nem em tarefas pendentes,
   * nem no recorte de uma pessoa. Quem escolhia o próprio nome via só
   * metade do que tem pra fazer.
   *
   * Não entra na rosca de propósito: a rosca é a distribuição dos
   * PROJETOS de cliente pelas etapas de uma página, e demanda interna
   * não passa por elas. Vem como bloco próprio, agrupado por área.
   */
  const internasVisiveis = abertas.filter((t) => t.client_id === null);

  const abertasVisiveis = ativasVisiveis.filter((t) => Boolean(t.data_vencimento));
  const semPrazo = ativasVisiveis.length - abertasVisiveis.length;
  /** Mesma leitura de dono que a coluna "Resp." da lista mostra. */
  const projetosComDono = laneGroupsTodosSemTrafego.flatMap((g) =>
    g.clients.map((c) => ({ id: c.id, responsavel: c.linha.responsavel }))
  );
  const abas = abasPorPessoa(ativasVisiveis, "/admin/visao-geral", keyParam, resp,
    // A aba "Todos" conta o que a lista mostra, não o que tem prazo.
    projetosComDono.length, projetosComDono);
  const clientesDaPessoa = resp
    ? projetosDaPessoa(ativasVisiveis, resp, projetosComDono)
    : null;

  const laneGroups = clientesDaPessoa
    ? laneGroupsTodosSemTrafego.map((g) => ({
        ...g,
        clients: g.clients.filter((c) => clientesDaPessoa.has(c.id)),
      }))
    : laneGroupsTodosSemTrafego;

  /**
   * Projetos a vencer — pedido da Karine (24/09). A unidade é o projeto, e o
   * prazo dele é o da tarefa aberta que vence primeiro. Usa `laneGroups`, que
   * já vem recortado pela pessoa escolhida nas abas.
   */
  const aVencerTodos = montarProjetosAVencer(
    laneGroups,
    ativasVisiveis,
    hojeEmBrasilia(),
    { janelaDias: JANELA_A_VENCER }
  );
  const aVencer = {
    ...aVencerTodos,
    itens: aVencerTodos.itens.slice(0, A_VENCER_LIMIT),
  };

  // Tarefas pendentes de toda a equipe visível a este membro, mais urgentes
  // primeiro (vencimento mais próximo/atrasado; sem vencimento vai pro fim).
  const tarefasPendentes = abertasVisiveis
    .filter((t) => !resp || t.responsavel === resp)
    .sort((a, b) => {
      if (!a.data_vencimento && !b.data_vencimento) return 0;
      if (!a.data_vencimento) return 1;
      if (!b.data_vencimento) return -1;
      return (
        new Date(a.data_vencimento).getTime() -
        new Date(b.data_vencimento).getTime()
      );
    })
    .slice(0, TAREFAS_LIMIT);

  const internasDaPessoa = internasVisiveis.filter(
    (t) => !resp || t.responsavel === resp
  );
  const gavetasInternas = agruparDemandas(
    internasDaPessoa,
    "area",
    true,
    "importancia"
  ).filter((g) => g.tarefas.length > 0);

  return (
    <AdminShell active="visao-geral" keyParam={keyParam} userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)} hideFinance={!hasFinanceAccess(member)}>
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Visão Geral
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Painel de gestão — o que precisa da sua atenção agora.
        </p>
      </header>

      {/*
        Aqui havia quatro cartões de atalho (Clientes, Contratos, Estruturas
        Iniciais, Briefings). Saíram a pedido da Karine (27/09): "não faz
        sentido ficar repetindo as mesmas coisas". Os quatro eram os MESMOS
        itens do menu lateral, que fica ao lado deles na tela, em versão
        grande — e empurravam o painel de status, que é o motivo da tela,
        pra baixo da dobra.
      */}

      {/* Projetos por status — pizza selecionável + lista com accordion de
          subtarefas editável, mesmo componente completo da Lista por
          status (não uma versão resumida). */}
      <section className="mb-6">
        <StatusPieBoard
          groups={laneGroups}
          keyParam={keyParam}
          urlKey={urlKey ?? undefined}
          novoHref={novoHref}
          abasPessoa={abas}
          pessoaAtiva={resp}
          restrictToResponsavel={
            hasTaskScopedRole(member) ? member.taskValue : undefined
          }
        />
      </section>

      <ProjetosAVencer
        resumo={aVencer}
        keyParam={keyParam}
        janelaDias={JANELA_A_VENCER}
        totalNaJanela={aVencerTodos.itens.length}
      />

      {/* Demandas internas — o trabalho da agência que não é de cliente
          nenhum (Karine, 30/09: "pode mostrar projetos internos"). Ele não
          existia nesta tela: a leitura descartava tudo com client_id nulo,
          então quem escolhia o próprio nome via só metade do que tem. */}
      {gavetasInternas.length > 0 ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-6">
          <div className="flex items-baseline justify-between mb-1">
            <Eyebrow>
              {resp
                ? `Demandas internas — ${TEAM_MEMBERS.find((m) => m.value === resp)?.label ?? ""}`
                : "Demandas internas"}
            </Eyebrow>
            <Link
              href={`/admin/demandas${keyParam}`}
              className="text-xs text-fysi-deep hover:underline font-medium"
            >
              Ver todas →
            </Link>
          </div>
          <p className="text-[0.7rem] text-fysi-muted mb-3">
            Trabalho da agência que não pertence a projeto de cliente.
          </p>
          <div className="flex flex-col gap-3">
            {gavetasInternas.map((g) => (
              <div key={g.chave}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`h-3 w-1 rounded-full ${g.barra}`} aria-hidden />
                  <span className="text-[0.78rem] font-semibold text-fysi-deep">
                    {g.rotulo}
                  </span>
                  <span className="text-[0.7rem] text-fysi-muted">
                    {g.tarefas.length}
                  </span>
                </div>
                <ul className="flex flex-col gap-0.5 pl-3">
                  {g.tarefas.slice(0, INTERNAS_POR_AREA).map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-fysi-deep truncate">{t.titulo}</span>
                      <span className="flex items-center gap-2 shrink-0 text-[0.7rem] text-fysi-muted tabular-nums">
                        {t.responsavel ? <span>{t.responsavel}</span> : null}
                        {t.data_vencimento ? (
                          <span>{formatDate(t.data_vencimento)}</span>
                        ) : (
                          <span className="text-fysi-muted/70">sem prazo</span>
                        )}
                      </span>
                    </li>
                  ))}
                  {g.tarefas.length > INTERNAS_POR_AREA ? (
                    <li className="text-[0.7rem] text-fysi-muted">
                      + {g.tarefas.length - INTERNAS_POR_AREA} em {g.rotulo.toLowerCase()}
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Tarefas pendentes */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <Eyebrow>
            {resp
              ? `Tarefas pendentes — ${TEAM_MEMBERS.find((m) => m.value === resp)?.label ?? ""}`
              : "Tarefas pendentes da equipe"}
          </Eyebrow>
          <Link
            href={`/admin/tarefas${keyParam}`}
            className="text-xs text-fysi-deep hover:underline font-medium"
          >
            Ver todas →
          </Link>
        </div>
        <p className="text-[0.7rem] text-fysi-muted -mt-2 mb-3">
          {resp
            ? "Só as desta pessoa, das mais urgentes pras menos."
            : "De toda a equipe, das mais urgentes pras menos. Escolha um nome acima pra ver só as dele."}
          {semPrazo > 0 ? (
            <>
              {" · "}
              <Link
                href={`/admin/tarefas${keyParam}`}
                className="text-fysi-deep underline underline-offset-2"
              >
                {semPrazo} sem prazo
              </Link>{" "}
              não entram nesta conta
            </>
          ) : null}
        </p>
        {tarefasPendentes.length === 0 ? (
          <p className="text-sm text-fysi-muted py-6 text-center">
            Nenhuma tarefa pendente.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tarefasPendentes.map((t) => (
              <Link
                key={t.id}
                href={`/admin/${t.client_id}${keyParam}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-fysi-cream/60 transition text-sm"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-fysi-deep font-medium truncate">
                    {t.titulo}
                  </span>
                  <span className="text-[0.72rem] text-fysi-muted truncate">
                    {t.client?.empresa || t.client?.nome}
                    {t.responsavel ? ` · ${t.responsavel}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.data_vencimento ? (
                    <span className="text-[0.7rem] text-fysi-muted tabular-nums">
                      {formatDate(t.data_vencimento)}
                    </span>
                  ) : null}
                  <span
                    className={`inline-block rounded-full border text-xs font-medium px-2 py-0.5 ${TASK_STATUS_TONE[t.status]}`}
                  >
                    {TASK_STATUS_OPTIONS.find((o) => o.value === t.status)
                      ?.label ?? t.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}
