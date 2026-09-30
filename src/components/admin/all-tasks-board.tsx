"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TaskRow,
  useColumnWidths,
  ColGroup,
  ResizableTh,
  isReadOnlyFor,
  type EditRestriction,
} from "./tasks-board";
import {
  EISENHOWER,
  ESFORCOS,
  TASK_STATUS_GROUP,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  TEAM_MEMBERS,
  type ProjectTask,
  type TaskStatus,
} from "@/lib/project-tasks";
import type { ProjectTaskClient } from "@/lib/project-tasks-server";
import { TaskComposer } from "./task-composer";
import { Caret, useGruposColapsados } from "./use-grupos-colapsados";
import { ViewTabs, type ViewTabItem } from "./view-tabs";
import { naOrdemDaBarra } from "@/lib/abas-pessoa";
import { AgendarLoteBar } from "./agendar-lote-bar";
import type { ClientOption } from "./task-pickers";

/** Esta tela agrupa POR cliente, então demanda interna (client null) é
 * filtrada antes de chegar aqui — ver /admin/tarefas. */
type Task = ProjectTask & { client: ProjectTaskClient; client_id: string };

/** Valor de aba das tarefas órfãs — "" já significa "todas". */
const SEM_DONO = "__sem__";

/**
 * Visão central de todas as tarefas de todos os clientes — /admin/tarefas.
 * Ver [[feedback_nao_enterrar_por_cliente]]: Tarefas existia só por cliente
 * até 2026-08-30, sem lugar pra ver o quadro todo de uma vez.
 */
export function AllTasksBoard({
  tasks,
  urlKey,
  clients = [],
  restrictToResponsavel,
  viewInicial = "",
  navegacao,
  semAbas = false,
}: {
  tasks: Task[];
  urlKey?: string;
  /** Clientes visíveis pra pessoa — opções do "+ Nova tarefa". */
  clients?: ClientOption[];
  restrictToResponsavel?: EditRestriction;
  /**
   * Aba aberta ao chegar, lida do `?resp=` pelo servidor. Vem por prop em
   * vez de useSearchParams pra não exigir Suspense nesta árvore.
   */
  viewInicial?: string;
  /**
   * Quando presente, as abas viram LINKS de verdade em vez de filtro no
   * cliente. Necessário em tela onde o SERVIDOR decide o que desenhar a
   * partir do `?resp=` — o filtro no cliente usa history.replaceState, que
   * troca a URL sem recarregar, e ali a página nunca voltaria pro outro
   * modo. Vem como par de strings porque função não atravessa a fronteira
   * servidor→cliente.
   */
  navegacao?: { base: string; keyParam: string };
  /** Esconde a barra de abas — quem já a desenhou acima passa isto. */
  semAbas?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [criando, setCriando] = useState(false);
  // "Agrupar por" é como o ClickUp organiza a lista — sem isso, 130 tarefas
  // de 30 clientes viram uma tabela plana em que nada salta.
  const [agruparPor, setAgruparPor] = useState<Agrupamento>("status");
  /** "" = todos; SEM_DONO = as órfãs; senão o `value` da pessoa. */
  const [responsavel, setResponsavel] = useState(viewInicial);
  const [mostrarFechados, setMostrarFechados] = useState(false);
  /**
   * Tarefa sem prazo fica fora da lista de trabalho até alguém agendar.
   *
   * Decisão da Karine (26/09): "as que não têm data não devem ter
   * importância igual às que têm" e "essa parte de filtro deve ser só em
   * tarefas com data, para aparecer o que está de fato ativo; os projetos
   * sem datas o Andrei mesmo coloca datas".
   *
   * Não é enfeite: 247 das 286 tarefas abertas não têm prazo, porque o
   * checklist gera as ~10 etapas do fluxo na criação do projeto e nove são
   * futuras. Sem esse corte, a tela mostra 286 linhas em que nada salta e
   * as 39 que estão de fato em jogo somem no meio.
   *
   * Elas não desaparecem: viram um bloco próprio, com contagem, pro Andrei
   * agendar. Escondê-las de vez seria trocar um problema por outro.
   */
  const [mostrarSemData, setMostrarSemData] = useState(false);
  const colapso = useGruposColapsados("fysi-grupos-tarefas");

  /**
   * A aba escolhida fica na URL: no ClickUp cada "Lista Valéria" é um
   * endereço próprio, que se recarrega e se manda pra alguém. `replaceState`
   * em vez de router.push porque a página é force-dynamic — empurrar pelo
   * router refaria a consulta inteira no servidor só pra filtrar no cliente.
   */
  function escolherView(v: string) {
    setResponsavel(v);
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (v) q.set("resp", v);
    else q.delete("resp");
    const busca = q.toString();
    window.history.replaceState(
      null,
      "",
      busca ? `${window.location.pathname}?${busca}` : window.location.pathname
    );
  }

  // As abas contam só o que tem prazo — é o "o que está de fato ativo".
  const abertasTotal = useMemo(
    () =>
      tasks.filter(
        (t) => TASK_STATUS_GROUP[t.status] === "ativo" && Boolean(t.data_vencimento)
      ),
    [tasks]
  );
  /**
   * As abas. Pessoa sem nenhuma tarefa aberta não vira aba — a barra mostra
   * quem tem trabalho agora, não o quadro de funcionários. A aba da pessoa
   * escolhida fica mesmo zerada, senão a aba some debaixo do clique.
   */
  const viewsDisponiveis = useMemo(() => {
    // Só "Todos" tem número — as abas de pessoa são só o nome, e o Karine
    // e o Andrei vêm na frente. Mesma regra da barra de Projetos, ver
    // src/lib/abas-pessoa.ts.
    const lista: ViewTabItem[] = [
      { value: "", label: "Todos", count: abertasTotal.length },
    ];
    for (const m of naOrdemDaBarra(TEAM_MEMBERS)) {
      const count = abertasTotal.filter((t) => t.responsavel === m.value).length;
      if (count === 0 && responsavel !== m.value) continue;
      lista.push({
        value: m.value,
        label: m.label,
        iniciais: m.iniciais,
        cor: m.cor,
      });
    }
    const orfas = abertasTotal.filter((t) => !t.responsavel).length;
    if (orfas > 0 || responsavel === SEM_DONO) {
      lista.push({ value: SEM_DONO, label: "Sem responsável" });
    }
    if (!navegacao) return lista;
    const { base, keyParam } = navegacao;
    const sep = keyParam ? "&" : "?";
    return lista.map((i) => ({
      ...i,
      href: i.value
        ? `${base}${keyParam}${sep}resp=${encodeURIComponent(i.value)}`
        : `${base}${keyParam}`,
    }));
  }, [abertasTotal, responsavel, navegacao]);

  const { widths: colWidths, total: colTotal, startResize } = useColumnWidths(
    "fysi-cols-alltasks",
    [168, 232, 182, 74, 74, 92, 124, 40]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (responsavel === SEM_DONO) {
        if (t.responsavel) return false;
      } else if (responsavel && t.responsavel !== responsavel) {
        return false;
      }
      if (!q) return true;
      const nomeCliente = (t.client.empresa || t.client.nome || "").toLowerCase();
      return (
        nomeCliente.includes(q) || t.titulo.toLowerCase().includes(q)
      );
    });
  }, [tasks, query, responsavel]);

  const ativas = filtered.filter((t) => TASK_STATUS_GROUP[t.status] === "ativo");
  const abertas = ativas.filter((t) => Boolean(t.data_vencimento));
  const semData = ativas.filter((t) => !t.data_vencimento);
  /**
   * As sem-prazo agrupadas por cliente, na ordem das etapas (`ordem`), que
   * é a ordem em que o lote recebe as datas.
   */
  const semDataPorCliente = (() => {
    const mapa = new Map<string, typeof semData>();
    for (const t of semData) {
      const arr = mapa.get(t.client_id);
      if (arr) arr.push(t);
      else mapa.set(t.client_id, [t]);
    }
    return [...mapa.entries()]
      .map(([cliente, tarefas]) => ({
        cliente,
        nome:
          tarefas[0].client.empresa?.trim() ||
          tarefas[0].client.nome ||
          "Sem nome",
        tarefas: [...tarefas].sort((a, b) => a.ordem - b.ordem),
      }))
      .sort((a, b) => b.tarefas.length - a.tarefas.length || a.nome.localeCompare(b.nome, "pt-BR"));
  })();
  const grupos = useMemo(
    () => agrupar(abertas, agruparPor),
    // `abertas` é derivado de `filtered`, que já é memoizado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, agruparPor]
  );
  const fechadas = filtered.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "fechado"
  );
  const chavesGrupos = grupos.map((g) => g.chave);
  const todosFechados =
    chavesGrupos.length > 0 &&
    colapso.totalFechados(chavesGrupos) === chavesGrupos.length;

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6">
      {/* Abas de visualização — as "Lista", "Lista Karine", "Lista Andrei"
          do ClickUp. Antes isto era um <select> mais uma fileira de pílulas
          fazendo a mesma coisa em dois lugares; a aba diz de relance em qual
          lista você está.
          `semAbas` existe porque na tela de Projetos a barra já está no
          topo, acima da lista de projetos da pessoa: duas barras iguais na
          mesma tela dariam dois lugares pra trocar a mesma coisa. */}
      {semAbas ? null : (
        <div className="-mx-6 px-6 mb-5">
          <ViewTabs
            items={viewsDisponiveis}
            ativo={responsavel}
            onSelect={navegacao ? undefined : escolherView}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-medium text-fysi-deep">
            Tarefas de todos os projetos
          </h3>
          <p className="text-sm text-fysi-muted mt-1">
            {abertas.length} com prazo · ordenado por vencimento
            {semData.length > 0 ? (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setMostrarSemData((v) => !v)}
                  className="underline underline-offset-2 hover:text-fysi-deep"
                  title="Tarefas abertas que ninguém agendou — o checklist cria as etapas futuras sem data"
                >
                  {semData.length} sem prazo
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente ou tarefa…"
            className="rounded-[8px] border border-fysi-line bg-white text-sm px-3 py-1.5 w-56"
          />
          <label className="inline-flex items-center gap-1.5 text-sm text-fysi-muted">
            Agrupar por
            <select
              value={agruparPor}
              onChange={(e) => setAgruparPor(e.target.value as Agrupamento)}
              className="rounded-[8px] border border-fysi-line bg-white text-sm px-2 py-1.5 text-fysi-deep"
            >
              <option value="status">Status</option>
              <option value="responsavel">Responsável</option>
              <option value="cliente">Cliente</option>
              <option value="eisenhower">Matriz (urgente × importante)</option>
              <option value="esforco">Tempo que leva</option>
              <option value="nenhum">Nada</option>
            </select>
          </label>
          {agruparPor !== "nenhum" && chavesGrupos.length > 1 ? (
            <button
              type="button"
              onClick={() =>
                todosFechados
                  ? colapso.abrirTodos(chavesGrupos)
                  : colapso.fecharTodos(chavesGrupos)
              }
              className="rounded-[8px] border border-fysi-line text-sm text-fysi-muted hover:text-fysi-deep px-2.5 py-1.5 transition"
            >
              {todosFechados ? "Expandir tudo" : "Recolher tudo"}
            </button>
          ) : null}
          {/* "basico" sem vínculo não cria (o servidor recusaria). */}
          {restrictToResponsavel === null ? null : (
            <button
              type="button"
              onClick={() => setCriando((v) => !v)}
              aria-expanded={criando}
              className={`inline-flex items-center rounded-full text-sm font-semibold px-4 h-9 transition ${
                criando
                  ? "border border-fysi-line text-fysi-muted hover:text-fysi-deep"
                  : "bg-fysi-deep text-fysi-cream hover:bg-fysi-deep/90"
              }`}
            >
              {criando ? "Fechar" : "+ Nova tarefa"}
            </button>
          )}
        </div>
      </div>

      {criando ? (
        <div className="mb-4">
          <TaskComposer
            clients={clients}
            defaultResponsavel={
              typeof restrictToResponsavel === "string"
                ? restrictToResponsavel
                : responsavel === SEM_DONO
                  ? ""
                  : responsavel
            }
            lockResponsavel={typeof restrictToResponsavel === "string"}
            urlKey={urlKey}
            autoFocus
            onClose={() => setCriando(false)}
            notaInterno="Demanda interna não entra nesta lista (ela é por cliente) — aparece em Meu Trabalho."
          />
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <p className="text-sm text-fysi-muted">
          Nenhuma tarefa cadastrada ainda. Crie a primeira em &ldquo;+ Nova
          tarefa&rdquo;, ou gere o checklist padrão na aba Tarefas da ficha
          do cliente.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-fysi-muted">
          Nenhuma tarefa bate com esse filtro.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table
            className="text-sm"
            style={{ width: colTotal, tableLayout: "fixed" }}
          >
            <ColGroup widths={colWidths} />
            <thead className="text-left text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted">
              <tr>
                <ResizableTh onResizeStart={startResize(0)}>Cliente</ResizableTh>
                <ResizableTh onResizeStart={startResize(1)}>Nome</ResizableTh>
                <ResizableTh onResizeStart={startResize(2)}>Status</ResizableTh>
                <ResizableTh onResizeStart={startResize(3)} title="Prioridade">Prior.</ResizableTh>
                <ResizableTh onResizeStart={startResize(4)} title="Responsável">Resp.</ResizableTh>
                <ResizableTh onResizeStart={startResize(5)}>Início</ResizableTh>
                <ResizableTh onResizeStart={startResize(6)}>Vencimento</ResizableTh>
                <ResizableTh />
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <Fragment key={g.chave}>
                  {g.titulo ? (
                    <tr className="border-t border-fysi-line">
                      <th
                        colSpan={8}
                        scope="colgroup"
                        className="bg-fysi-cream/60 px-3 py-1.5 text-left"
                      >
                        {/* Clicar no cabeçalho recolhe o grupo, como no
                            ClickUp. "Concluído: 67" empurrava pra baixo os
                            três itens que interessam. */}
                        <button
                          type="button"
                          onClick={() => colapso.alternar(g.chave)}
                          aria-expanded={!colapso.fechado(g.chave)}
                          className="inline-flex items-center gap-2 text-left group/cab"
                        >
                          <span className="text-fysi-muted group-hover/cab:text-fysi-deep">
                            <Caret aberto={!colapso.fechado(g.chave)} />
                          </span>
                          {g.tom ? (
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${g.tom}`}
                            >
                              {g.titulo}
                            </span>
                          ) : (
                            <span className="text-[0.78rem] font-semibold text-fysi-deep">
                              {g.titulo}
                            </span>
                          )}
                          <span className="text-xs text-fysi-muted">
                            {g.tarefas.length}
                          </span>
                        </button>
                      </th>
                    </tr>
                  ) : null}
                  {g.titulo && colapso.fechado(g.chave)
                    ? null
                    : g.tarefas.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          clientId={t.client_id}
                          urlKey={urlKey}
                          clienteCell={
                            <ClienteLink client={t.client} urlKey={urlKey} />
                          }
                          readOnly={isReadOnlyFor(t, restrictToResponsavel)}
                        />
                      ))}
                </Fragment>
              ))}
              {mostrarFechados
                ? fechadas.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      clientId={t.client_id}
                      urlKey={urlKey}
                      clienteCell={<ClienteLink client={t.client} urlKey={urlKey} />}
                      readOnly={isReadOnlyFor(t, restrictToResponsavel)}
                    />
                  ))
                : null}
            </tbody>
          </table>
          {semData.length > 0 ? (
            <div className="mt-4 rounded-[12px] border border-dashed border-fysi-line px-4 py-3">
              <button
                type="button"
                onClick={() => setMostrarSemData((v) => !v)}
                className="flex items-center gap-2 text-sm text-fysi-deep font-medium"
                aria-expanded={mostrarSemData}
              >
                <Caret aberto={mostrarSemData} />
                Sem prazo
                <span className="text-fysi-muted tabular-nums font-normal">
                  {semData.length}
                </span>
              </button>
              <p className="text-[0.7rem] text-fysi-muted mt-1 ml-[18px]">
                Etapas que o checklist criou junto com o projeto e ninguém agendou.
                Não entram na conta das abas nem na lista acima — dê uma data pra
                que ela volte pro trabalho.
              </p>
              {mostrarSemData ? (
                <div className="mt-3 flex flex-col gap-4">
                  {/* Agrupadas por CLIENTE porque o gesto real é agendar um
                      projeto por vez — é o que o Andrei fazia duplicando a
                      pasta no ClickUp. Uma lista misturada de 229 linhas
                      não tem onde encaixar o "agendar estas". */}
                  {semDataPorCliente.map(({ cliente, nome, tarefas }) => (
                    <div key={cliente}>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-fysi-deep">
                          {nome}
                          <span className="text-fysi-muted font-normal tabular-nums">
                            {" "}
                            {tarefas.length}
                          </span>
                        </span>
                        {isReadOnlyFor(tarefas[0], restrictToResponsavel) ? null : (
                          <AgendarLoteBar
                            taskIds={tarefas.map((t) => t.id)}
                            urlKey={urlKey}
                            onPronto={() => router.refresh()}
                          />
                        )}
                      </div>
                      <table
                        className="text-sm border-separate border-spacing-0"
                        style={{ width: colTotal, tableLayout: "fixed" }}
                      >
                        <ColGroup widths={colWidths} />
                        <tbody>
                          {tarefas.map((t) => (
                            <TaskRow
                              key={t.id}
                              task={t}
                              clientId={t.client_id}
                              urlKey={urlKey}
                              clienteCell={
                                <ClienteLink client={t.client} urlKey={urlKey} />
                              }
                              readOnly={isReadOnlyFor(t, restrictToResponsavel)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {fechadas.length > 0 ? (
            <button
              type="button"
              onClick={() => setMostrarFechados((v) => !v)}
              className="mt-3 text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
            >
              {mostrarFechados
                ? "Ocultar fechados"
                : `Mostrar ${fechadas.length} fechado${fechadas.length === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ClienteLink({
  client,
  urlKey,
}: {
  client: ProjectTaskClient;
  urlKey?: string;
}) {
  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  return (
    <Link
      href={`/admin/${client.id}${kp}`}
      className="font-medium text-fysi-deep hover:text-fysi-green underline underline-offset-2"
    >
      {client.empresa || client.nome || "Sem nome"}
    </Link>
  );
}

type Agrupamento =
  | "status"
  | "responsavel"
  | "cliente"
  | "eisenhower"
  | "esforco"
  | "nenhum";

interface Grupo {
  chave: string;
  /** null = sem cabeçalho (agrupamento "nada"). */
  titulo: string | null;
  /** Classe da pílula, quando o grupo é um status. */
  tom: string | null;
  tarefas: Task[];
}

/**
 * Agrupa a lista como o "Group by" do ClickUp. A ordem dos grupos segue a
 * ordem canônica do estágio (TASK_STATUS_OPTIONS), não a alfabética — ler
 * "A iniciar" antes de "Implementação" é o fluxo real do projeto.
 */
function agrupar(tarefas: Task[], por: Agrupamento): Grupo[] {
  if (por === "nenhum") {
    return [{ chave: "todas", titulo: null, tom: null, tarefas }];
  }

  const mapa = new Map<string, Task[]>();
  for (const t of tarefas) {
    const k =
      por === "status"
        ? t.status
        : por === "responsavel"
          ? (t.responsavel ?? "")
          : por === "eisenhower"
            ? (t.eisenhower ?? "")
            : por === "esforco"
              ? (t.esforco ?? "")
              : t.client_id;
    const arr = mapa.get(k);
    if (arr) arr.push(t);
    else mapa.set(k, [t]);
  }

  const grupos: Grupo[] = [];
  if (por === "status") {
    for (const o of TASK_STATUS_OPTIONS) {
      const arr = mapa.get(o.value);
      if (arr?.length) {
        grupos.push({
          chave: o.value,
          titulo: o.label,
          tom: TASK_STATUS_TONE[o.value as TaskStatus],
          tarefas: arr,
        });
      }
    }
    return grupos;
  }

  // Matriz: a ordem dos grupos é a da urgência — "Fazer agora" primeiro,
  // "Eliminar" no fim. É a leitura que a matriz existe pra dar.
  if (por === "eisenhower" || por === "esforco") {
    const escala: { value: string; label: string; tom: string | null }[] =
      por === "eisenhower"
        ? EISENHOWER.map((q) => ({ value: q.value, label: q.label, tom: q.tom }))
        : ESFORCOS.map((e) => ({ value: e.value, label: e.label, tom: e.tom }));
    for (const item of escala) {
      const arr = mapa.get(item.value);
      if (arr?.length) {
        grupos.push({
          chave: item.value,
          titulo: item.label,
          tom: item.tom,
          tarefas: arr,
        });
      }
    }
    const semClassificacao = mapa.get("");
    if (semClassificacao?.length) {
      grupos.push({
        // Chave por agrupamento: com uma só, recolher "Fora da matriz"
        // recolhia também "Sem estimativa" ao trocar o agrupar por.
        chave: `sem-${por}`,
        titulo:
          por === "eisenhower" ? "Fora da matriz" : "Sem estimativa de tempo",
        tom: null,
        tarefas: semClassificacao,
      });
    }
    return grupos;
  }

  if (por === "responsavel") {
    for (const m of TEAM_MEMBERS) {
      const arr = mapa.get(m.value);
      if (arr?.length) {
        grupos.push({ chave: m.value, titulo: m.label, tom: null, tarefas: arr });
      }
    }
    const semDono = mapa.get("");
    if (semDono?.length) {
      grupos.push({
        chave: "sem-dono",
        titulo: "Sem responsável",
        tom: null,
        tarefas: semDono,
      });
    }
    return grupos;
  }

  // Cliente: alfabético, que é como se procura um nome.
  return Array.from(mapa.entries())
    .map(([clientId, arr]) => ({
      chave: clientId,
      titulo: arr[0].client.empresa || arr[0].client.nome || "Sem nome",
      tom: null,
      tarefas: arr,
    }))
    .sort((a, b) => (a.titulo ?? "").localeCompare(b.titulo ?? "", "pt-BR"));
}
