"use client";

import { useMemo, useState } from "react";
import { TaskNotes } from "./task-notes";
import { AnexosDemanda } from "./anexos-demanda";
import { useRouter } from "next/navigation";
import {
  AREAS,
  EISENHOWER,
  TASK_STATUS_GROUP,
  TASK_STATUS_INTERNO,
  TASK_STATUS_OPTIONS,
  statusOptionsInternos,
  TASK_STATUS_TONE,
  TEAM_MEMBERS,
  type ProjectTask,
  type TaskStatus,
} from "@/lib/project-tasks";
import {
  removeProjectTaskAction,
  updateProjectTaskAction,
} from "@/app/admin/[id]/actions";
import { formatDiaMes } from "@/lib/datas";
import {
  AGRUPAMENTOS,
  SEM_VALOR,
  agruparDemandas,
  type Agrupamento,
} from "@/lib/agrupar-demandas";
import { TrashIcon } from "./tasks-board";
import { TaskComposer } from "./task-composer";
import {
  AreaPicker,
  AssigneePicker,
  DueDatePicker,
  EisenhowerPicker,
  EsforcoPicker,
  RecorrenciaPicker,
  hojeISO,
} from "./task-pickers";

/**
 * Demandas internas da agência, agrupadas por área.
 *
 * Pedido da Karine (2026-09-21): "a Tainá colocar demandas que chegam pra mim
 * mas que não são de projetos específicos e até pra ela". Antes, trabalho sem
 * cliente existia no banco mas só aparecia misturado em "Meu Trabalho", sem
 * classificação e sem um lugar para olhar o conjunto.
 *
 * Deliberadamente separado de /admin/tarefas: lá é o trabalho DE PROJETO, que
 * pertence a um cliente. Misturar os dois foi o que ela pediu pra evitar.
 */
export function AreasBoard({
  tasks,
  urlKey,
  meuResponsavel,
  lockResponsavel = false,
}: {
  tasks: ProjectTask[];
  urlKey?: string | null;
  meuResponsavel: string;
  lockResponsavel?: boolean;
}) {
  const router = useRouter();
  const [criandoEm, setCriandoEm] = useState<string | null>(null);
  const [mostrarFeitas, setMostrarFeitas] = useState(false);
  const [filtroPessoa, setFiltroPessoa] = useState("");
  /**
   * Filtro por status e ordenação por importância — pedido da Karine
   * (26/09): "poder filtrar por status, poder filtrar por importância...
   * geralmente mostra o que é mais importante com hierarquia; aqui fica
   * difícil; poder escolher mesmo, com opções, para facilitar".
   *
   * A ordem padrão passa a ser por IMPORTÂNCIA, não por prazo: numa lista
   * de demandas internas, quase nada tem data, então ordenar por prazo
   * deixava tudo empatado e a hierarquia sumia.
   */
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroQuadrante, setFiltroQuadrante] = useState("");
  const [ordem, setOrdem] = useState<"importancia" | "prazo" | "esforco">(
    "importancia"
  );
  const [agruparPor, setAgruparPor] = useState<Agrupamento>("area");
  const [crescente, setCrescente] = useState(true);
  /**
   * As gavetas fechadas, pelo nome do agrupamento + a chave.
   *
   * Guardadas por agrupamento: fechar "Comercial" ao ver por área não pode
   * fechar "Concluído" ao ver por status. Ficam no navegador, senão toda
   * recarga reabre tudo e o trabalho de arrumar a tela se perde.
   */
  const [fechadas, setFechadas] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const guardado = window.localStorage.getItem("demandas:gavetas-fechadas");
      return new Set<string>(guardado ? (JSON.parse(guardado) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  function alternarGaveta(id: string) {
    setFechadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      try {
        window.localStorage.setItem(
          "demandas:gavetas-fechadas",
          JSON.stringify([...proximo])
        );
      } catch {
        // Janela anônima, armazenamento bloqueado: a tela funciona sem lembrar.
      }
      return proximo;
    });
  }
  /** Data da próxima ocorrência criada ao concluir uma demanda recorrente. */
  const [proximaCriada, setProximaCriada] = useState<string | null>(null);
  const hoje = hojeISO();

  const visiveis = useMemo(() => {
    let t = tasks;
    if (filtroPessoa) t = t.filter((x) => x.responsavel === filtroPessoa);
    if (filtroStatus) t = t.filter((x) => x.status === filtroStatus);
    if (filtroQuadrante) {
      // "Sem classificar" é um recorte útil: é o que ninguém decidiu ainda.
      t =
        filtroQuadrante === "__sem__"
          ? t.filter((x) => !x.eisenhower)
          : t.filter((x) => x.eisenhower === filtroQuadrante);
    }
    if (!mostrarFeitas && !filtroStatus) {
      t = t.filter((x) => TASK_STATUS_GROUP[x.status] === "ativo");
    }
    return t;
  }, [tasks, filtroPessoa, filtroStatus, filtroQuadrante, mostrarFeitas]);

  /**
   * Uma gaveta por área, nesta ordem. Área SEM nada no recorte atual não
   * ganha cartão: com seis áreas e um filtro por pessoa, cinco cartões de
   * "nada aqui" empurravam a única gaveta com trabalho pra fora da tela
   * (Karine, 22/09).
   *
   * Elas não somem de vez, viram uma linha só no fim — clicar no nome abre
   * a barra de criar ali. Esconder por completo tiraria o único caminho de
   * lançar demanda numa área vazia, que é justamente quando ela precisa da
   * primeira. "Sem área" continua no fim, só quando existe algo lá.
   */
  /**
   * As gavetas do agrupamento escolhido, cada uma já ordenada por dentro.
   *
   * A ordem das gavetas é a canônica de cada eixo (as áreas na ordem da lista,
   * os status do começo ao fim do trabalho, os quadrantes do mais urgente ao
   * menos) — e não alfabética, que não diz nada. Quem não tem valor no eixo
   * fica sempre por último, seja qual for o sentido.
   */
  /** As gavetas do eixo escolhido, cada uma já ordenada por dentro. */
  const gavetas = useMemo(
    () => agruparDemandas(visiveis, agruparPor, crescente, ordem),
    [visiveis, agruparPor, crescente, ordem]
  );

  /**
   * Áreas sem nada no recorte atual — viram a linha compacta do rodapé.
   *
   * Só na visão por área: é ali que "lançar a primeira demanda de Curso" faz
   * sentido. Agrupado por status ou por pessoa, uma gaveta vazia não é um lugar
   * onde se cria nada.
   */
  const vazias =
    agruparPor === "area"
      ? AREAS.filter(
          (a) =>
            criandoEm !== a.value &&
            (gavetas.find((g) => g.chave === a.value)?.tarefas.length ?? 0) === 0
        )
      : [];

  const totalAbertas = tasks.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "ativo"
  ).length;
  /**
   * Quantas o recorte atual mostra. O contador exibia o total da agência
   * mesmo com filtro de pessoa ligado — dizia "6 abertas" e a tela tinha
   * uma. Agora conta o que está à vista, e o total vira complemento.
   */
  const abertasNaVista = visiveis.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "ativo"
  ).length;
  const nomeDoFiltro = TEAM_MEMBERS.find((m) => m.value === filtroPessoa)?.label;

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fysi-muted">
            <strong className="font-semibold text-fysi-deep">
              {abertasNaVista}
            </strong>{" "}
            aberta{abertasNaVista === 1 ? "" : "s"}
            {nomeDoFiltro ? (
              <>
                {" "}
                com {nomeDoFiltro}
                {totalAbertas !== abertasNaVista ? (
                  <> · {totalAbertas} no total da agência</>
                ) : null}
              </>
            ) : (
              <> · trabalho da agência, fora dos projetos de cliente</>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroPessoa}
              onChange={(e) => setFiltroPessoa(e.target.value)}
              className="rounded-[8px] border border-fysi-line bg-white text-sm px-2 py-1.5 text-fysi-deep"
            >
              <option value="">Todo mundo</option>
              {TEAM_MEMBERS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              aria-label="Filtrar por status"
              title="Filtrar por status"
              className="rounded-[8px] border border-fysi-line bg-white text-sm px-2 py-1.5 text-fysi-deep"
            >
              <option value="">Qualquer status</option>
              {TASK_STATUS_OPTIONS.filter((o) =>
                TASK_STATUS_INTERNO.includes(o.value)
              ).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <select
              value={filtroQuadrante}
              onChange={(e) => setFiltroQuadrante(e.target.value)}
              aria-label="Filtrar por importância"
              title="Filtrar por importância — matriz urgente × importante"
              className="rounded-[8px] border border-fysi-line bg-white text-sm px-2 py-1.5 text-fysi-deep"
            >
              <option value="">Qualquer importância</option>
              {EISENHOWER.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
              <option value="__sem__">Sem classificar</option>
            </select>

            {/* Agrupar por — o eixo em que a lista é partida. Ver AGRUPAMENTOS. */}
            <label className="inline-flex items-center gap-1.5 text-sm text-fysi-muted">
              Agrupar por
              <select
                value={agruparPor}
                onChange={(e) => {
                  setAgruparPor(e.target.value as Agrupamento);
                  // A barra de criar estava aberta numa área; noutro eixo ela
                  // não tem lugar, e ficaria pendurada numa gaveta qualquer.
                  setCriandoEm(null);
                }}
                aria-label="Agrupar por"
                className="rounded-[8px] border border-fysi-line bg-white text-sm px-2 py-1.5 text-fysi-deep"
              >
                {(Object.keys(AGRUPAMENTOS) as Agrupamento[]).map((k) => (
                  <option key={k} value={k}>
                    {AGRUPAMENTOS[k].label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCrescente((v) => !v)}
                title={crescente ? "Inverter a ordem das gavetas" : "Voltar à ordem normal"}
                aria-label="Inverter a ordem das gavetas"
                className="inline-flex items-center gap-1 rounded-[8px] border border-fysi-line bg-white px-2 py-1.5 text-fysi-deep hover:border-fysi-deep/40 transition"
              >
                {crescente ? "↓" : "↑"}
              </button>
            </label>

            {/* Abrir e fechar todas de uma vez: com seis gavetas, arrumar a
                tela uma a uma é trabalho demais para um olhar rápido. */}
            <button
              type="button"
              onClick={() => {
                const ids = gavetas.map((g) => `${agruparPor}:${g.chave}`);
                const todasFechadas = ids.every((id) => fechadas.has(id));
                const proximo = new Set(fechadas);
                for (const id of ids) {
                  if (todasFechadas) proximo.delete(id);
                  else proximo.add(id);
                }
                setFechadas(proximo);
                try {
                  window.localStorage.setItem(
                    "demandas:gavetas-fechadas",
                    JSON.stringify([...proximo])
                  );
                } catch {
                  // sem memória: a tela funciona do mesmo jeito nesta sessão
                }
              }}
              className="inline-flex items-center rounded-[8px] border border-fysi-line bg-white px-2.5 py-1.5 text-sm text-fysi-deep hover:border-fysi-deep/40 transition"
            >
              {gavetas.length > 0 &&
              gavetas.every((g) => fechadas.has(`${agruparPor}:${g.chave}`))
                ? "Abrir todas"
                : "Fechar todas"}
            </button>

            <label className="inline-flex items-center gap-1.5 text-sm text-fysi-muted">
              Ordenar
              <select
                value={ordem}
                onChange={(e) =>
                  setOrdem(e.target.value as "importancia" | "prazo" | "esforco")
                }
                aria-label="Ordenar por"
                className="rounded-[8px] border border-fysi-line bg-white text-sm px-2 py-1.5 text-fysi-deep"
              >
                <option value="importancia">Por importância</option>
                <option value="prazo">Por prazo</option>
                <option value="esforco">Pelo tempo que leva</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 text-sm text-fysi-muted">
              <input
                type="checkbox"
                checked={mostrarFeitas}
                onChange={(e) => setMostrarFeitas(e.target.checked)}
                className="accent-fysi-deep"
              />
              Mostrar concluídas
            </label>
          </div>
        </div>
      </section>

      {gavetas
        .filter((g) => g.tarefas.length > 0 || criandoEm === g.chave)
        .map((gaveta) => {
          const id = `${agruparPor}:${gaveta.chave}`;
          const fechada = fechadas.has(id);
          // Criar dentro da gaveta só faz sentido quando a gaveta É uma área.
          const podeCriarAqui = agruparPor === "area" && gaveta.chave !== SEM_VALOR;
          return (
            <section
              key={id}
              className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-fysi-line">
                <span className={`h-8 w-1.5 rounded-full ${gaveta.barra}`} aria-hidden />
                {/* O título inteiro abre e fecha: um alvo grande, não um
                    triangulozinho de dez pixels. */}
                <button
                  type="button"
                  onClick={() => alternarGaveta(id)}
                  aria-expanded={!fechada}
                  title={fechada ? "Abrir" : "Fechar"}
                  className="inline-flex items-center gap-2 text-left"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className={`h-3.5 w-3.5 text-fysi-muted transition-transform ${fechada ? "" : "rotate-90"}`}
                    aria-hidden
                  >
                    <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h2 className="text-[0.95rem] font-semibold text-fysi-deep">
                    {gaveta.rotulo}
                  </h2>
                  <span className="text-xs text-fysi-muted">
                    {gaveta.tarefas.length === 0
                      ? "nada aqui"
                      : `${gaveta.tarefas.length} demanda${gaveta.tarefas.length === 1 ? "" : "s"}`}
                  </span>
                </button>
                {podeCriarAqui ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCriandoEm((v) => (v === gaveta.chave ? null : gaveta.chave))
                    }
                    className="ml-auto inline-flex items-center rounded-full border border-fysi-line text-xs font-semibold text-fysi-deep px-3 h-7 hover:border-fysi-deep/40 transition"
                  >
                    {criandoEm === gaveta.chave ? "Fechar" : "+ Demanda"}
                  </button>
                ) : null}
              </div>

              {criandoEm === gaveta.chave ? (
                <div className="px-5 pt-4">
                  <TaskComposer
                    clientId=""
                    defaultArea={gaveta.chave}
                    areaFixa
                    defaultResponsavel={meuResponsavel}
                    lockResponsavel={lockResponsavel}
                    urlKey={urlKey}
                    placeholder={`Nova demanda de ${gaveta.rotulo.toLowerCase()} (Enter adiciona)`}
                    autoFocus
                    onClose={() => setCriandoEm(null)}
                  />
                </div>
              ) : null}

              {fechada || gaveta.tarefas.length === 0 ? null : (
                <ul className="divide-y divide-fysi-line">
                  {gaveta.tarefas.map((t) => (
                    <LinhaDemanda
                      key={t.id}
                      task={t}
                      hoje={hoje}
                      urlKey={urlKey}
                      onSalvo={() => router.refresh()}
                      onProximaCriada={setProximaCriada}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}

      {proximaCriada ? (
        <p
          role="status"
          className="flex items-center justify-between gap-3 rounded-[14px] border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-900"
        >
          <span>
            Demanda concluída. A próxima já está na lista, para{" "}
            <strong className="font-semibold">
              {formatDiaMes(proximaCriada)}
            </strong>
            .
          </span>
          <button
            type="button"
            onClick={() => setProximaCriada(null)}
            className="shrink-0 text-xs font-semibold text-indigo-900/70 hover:text-indigo-900"
          >
            fechar
          </button>
        </p>
      ) : null}

      {abertasNaVista === 0 && !criandoEm ? (
        <p className="text-sm text-fysi-muted px-1">
          {nomeDoFiltro
            ? `Nenhuma demanda interna com ${nomeDoFiltro} agora. Escolha uma área abaixo pra lançar a primeira.`
            : "Nenhuma demanda interna aberta. Escolha uma área abaixo pra lançar a primeira."}
        </p>
      ) : null}

      {/* As áreas sem nada agora — uma linha, não cinco cartões. Clicar no
          nome abre a barra de criar naquela área. */}
      {vazias.length > 0 ? (
        <section className="rounded-[16px] border border-dashed border-fysi-line px-5 py-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-fysi-muted">
            <span>Sem nada agora{filtroPessoa ? " pra essa pessoa" : ""}:</span>
            {vazias.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setCriandoEm(a.value)}
                title={`Lançar uma demanda de ${a.label.toLowerCase()}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-fysi-line bg-white px-2.5 py-1 text-fysi-deep hover:border-fysi-deep/40 transition"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${a.barra}`} aria-hidden />
                {a.label}
              </button>
            ))}
          </p>
        </section>
      ) : null}

    </div>
  );
}

/** Uma demanda: status, responsável, prazo e área — tudo editável na linha. */
function LinhaDemanda({
  task,
  hoje,
  urlKey,
  onSalvo,
  onProximaCriada,
}: {
  task: ProjectTask;
  hoje: string;
  urlKey?: string | null;
  onSalvo: () => void;
  /** Concluir uma demanda recorrente gerou a próxima, nesta data. */
  onProximaCriada: (dataISO: string) => void;
}) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [responsavel, setResponsavel] = useState(task.responsavel ?? "");
  const [prazo, setPrazo] = useState(task.data_vencimento ?? "");
  const [area, setArea] = useState(task.area ?? "");
  const [eisenhower, setEisenhower] = useState(task.eisenhower ?? "");
  const [esforco, setEsforco] = useState(task.esforco ?? "");
  const [recorrencia, setRecorrencia] = useState(task.recorrencia ?? "");
  const [titulo, setTitulo] = useState(task.titulo);
  const [renomeando, setRenomeando] = useState(false);
  const [aberta, setAberta] = useState(false);
  const [descricao, setDescricao] = useState(task.observacoes ?? "");
  const [erroTexto, setErroTexto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);

  const atrasada =
    !!prazo && prazo < hoje && TASK_STATUS_GROUP[status] === "ativo";

  /**
   * Apagar demanda errada. Confirmação nativa de propósito: é destrutivo e
   * sem volta, e um modal bonito aqui só atrasaria quem está limpando a
   * lista. Comentários e ocorrências futuras (se recorrente) vão junto.
   */
  async function apagar() {
    const aviso = task.recorrencia
      ? `Apagar "${task.titulo}"? Ela se repete — apagar esta NÃO cancela a série: a próxima já pode ter nascido. Não dá pra desfazer.`
      : `Apagar "${task.titulo}"? Comentários vão junto. Não dá pra desfazer.`;
    if (!window.confirm(aviso)) return;
    setSalvando(true);
    setErro(false);
    setErroTexto(null);
    const fd = new FormData();
    fd.append("taskId", task.id);
    fd.append("clientId", "");
    if (urlKey) fd.append("key", urlKey);
    try {
      const r = await removeProjectTaskAction(fd);
      if (!r.ok) {
        setErro(true);
        setErroTexto(r.erro);
        return;
      }
      onSalvo();
    } catch {
      setErro(true);
      setErroTexto("Não consegui apagar. Confira a conexão.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvar(campo: string, valor: string, reverter: () => void) {
    setSalvando(true);
    setErro(false);
    const fd = new FormData();
    fd.append("taskId", task.id);
    fd.append("clientId", "");
    fd.append(campo, valor);
    if (urlKey) fd.append("key", urlKey);
    try {
      const r = await updateProjectTaskAction(fd);
      // A recusa do servidor não é exceção: ela volta como { ok: false }.
      // Só o catch deixava passar valor recusado em silêncio.
      if (!r.ok) {
        reverter();
        setErro(true);
        return;
      }
      // Concluir uma demanda recorrente cria a próxima. Ela some desta
      // lista (fica fechada) e a nova entra com outra data — sem este aviso
      // a tela parece só ter engolido a demanda.
      if (r.proximaEm) onProximaCriada(r.proximaEm);
      onSalvo();
    } catch {
      // Reverte o que a tela já mostrava: deixar o valor novo na tela depois
      // de um erro é a tela mentindo que salvou.
      reverter();
      setErro(true);
    } finally {
      setSalvando(false);
    }
  }

  const feita = TASK_STATUS_GROUP[status] === "fechado";

  /**
   * Renomear e descrever a demanda — pedido da Karine (26/09): "na parte de
   * demandas internas, poder editar demanda e ter parte para colocar
   * descrição".
   *
   * O servidor já aceitava os dois campos (`titulo` e `observacoes` em
   * updateProjectTaskAction); só esta tela não os expunha. Quem errasse o
   * nome de uma demanda tinha que apagar e criar outra — perdendo data,
   * responsável e a série, se fosse recorrente.
   *
   * Mesmo gesto da tela de Tarefas: lápis ou duplo clique renomeia, clique
   * no nome abre a descrição.
   */
  function salvarTitulo() {
    const novo = titulo.trim();
    setRenomeando(false);
    // Vazio ou igual: volta ao que estava, sem ir ao servidor.
    if (!novo || novo === task.titulo) {
      setTitulo(task.titulo);
      return;
    }
    setTitulo(novo);
    void salvar("titulo", novo, () => setTitulo(task.titulo));
  }

  return (
    <li className="px-5 py-3 hover:bg-fysi-cream/30 transition-colors">
      <div className="flex flex-wrap items-center gap-2.5">
      {renomeando ? (
        <input
          type="text"
          value={titulo}
          autoFocus
          maxLength={200}
          onChange={(e) => setTitulo(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={salvarTitulo}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setTitulo(task.titulo);
              setRenomeando(false);
            }
          }}
          aria-label="Nome da demanda"
          className="flex-1 min-w-[12rem] rounded-[6px] border border-fysi-deep/40 bg-white text-sm text-fysi-deep px-1.5 py-0.5 focus:outline-none"
        />
      ) : (
        <span className="flex-1 min-w-[12rem] flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAberta((v) => !v)}
            onDoubleClick={() => setRenomeando(true)}
            aria-expanded={aberta}
            title={`${titulo} — clique pra ver a descrição`}
            className={`text-left text-sm truncate min-w-0 hover:underline underline-offset-2 ${
              feita ? "text-fysi-muted line-through" : "text-fysi-deep"
            }`}
          >
            {titulo}
          </button>
          {/* Um ponto discreto avisa que há descrição escrita — sem ele, a
              descrição ficaria invisível com a linha fechada. */}
          {descricao.trim() ? (
            <span
              className="h-1.5 w-1.5 rounded-full bg-fysi-line-strong shrink-0"
              title="Tem descrição"
              aria-label="Tem descrição"
            />
          ) : null}
          <button
            type="button"
            onClick={() => setRenomeando(true)}
            disabled={salvando}
            aria-label={`Renomear "${titulo}"`}
            title="Renomear"
            className="shrink-0 w-6 h-6 grid place-items-center rounded-md text-fysi-muted hover:text-fysi-deep hover:bg-fysi-cream transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 20h9" strokeLinecap="round" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinejoin="round" />
            </svg>
          </button>
        </span>
      )}

      <select
        value={status}
        disabled={salvando}
        onChange={(e) => {
          const anterior = status;
          const novo = e.target.value as TaskStatus;
          setStatus(novo);
          void salvar("status", novo, () => setStatus(anterior));
        }}
        aria-label={`Status de ${task.titulo}`}
        className={`rounded-full border text-xs font-medium px-2.5 py-1 cursor-pointer focus:outline-none disabled:opacity-50 ${TASK_STATUS_TONE[status]}`}
      >
        {/* Lista curta: numa demanda administrativa, "Onboarding" e "Design
            da página" não são escolha — são ruído. Ver TASK_STATUS_INTERNO. */}
        {statusOptionsInternos(status).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <AreaPicker
        value={area}
        disabled={salvando}
        onChange={(v) => {
          const anterior = area;
          setArea(v);
          void salvar("area", v, () => setArea(anterior));
        }}
      />

      <AssigneePicker
        value={responsavel}
        disabled={salvando}
        showLabel
        onChange={(v) => {
          const anterior = responsavel;
          setResponsavel(v);
          void salvar("responsavel", v, () => setResponsavel(anterior));
        }}
      />

      <DueDatePicker
        value={prazo}
        disabled={salvando}
        overdue={atrasada}
        onChange={(v) => {
          const anterior = prazo;
          setPrazo(v);
          void salvar("dataVencimento", v, () => setPrazo(anterior));
        }}
      />

      {/* Tamanho ao lado do prazo de propósito: "quando vence" e "quanto
          tempo leva" são a mesma pergunta vista de dois lados. */}
      <EsforcoPicker
        value={esforco}
        disabled={salvando}
        onChange={(v) => {
          const anterior = esforco;
          setEsforco(v);
          void salvar("esforco", v, () => setEsforco(anterior));
        }}
      />

      <EisenhowerPicker
        value={eisenhower}
        disabled={salvando}
        onChange={(v) => {
          const anterior = eisenhower;
          setEisenhower(v);
          void salvar("eisenhower", v, () => setEisenhower(anterior));
        }}
      />

      <RecorrenciaPicker
        value={recorrencia}
        disabled={salvando}
        onChange={(v) => {
          const anterior = recorrencia;
          setRecorrencia(v);
          void salvar("recorrencia", v, () => setRecorrencia(anterior));
        }}
      />

      <button
        type="button"
        disabled={salvando}
        onClick={apagar}
        aria-label={`Apagar "${task.titulo}"`}
        title="Apagar demanda"
        className="w-7 h-7 inline-grid place-items-center rounded-md text-fysi-muted/60 hover:text-red-700 hover:bg-red-50 transition disabled:opacity-50"
      >
        <TrashIcon />
      </button>

      {erro ? (
        <span className="text-xs text-red-700" role="alert">
          {erroTexto ?? "não salvou"}
        </span>
      ) : null}
      </div>

      {aberta ? (
        <div className="mt-2 ml-1">
          <label className="block text-[0.7rem] uppercase tracking-[0.08em] text-fysi-muted font-medium mb-1">
            Descrição
          </label>
          <TaskNotes
            value={descricao}
            disabled={salvando}
            onChange={setDescricao}
            onBlur={() => {
              if (descricao.trim() !== (task.observacoes ?? "")) {
                void salvar("observacoes", descricao, () =>
                  setDescricao(task.observacoes ?? "")
                );
              }
            }}
            clientId={null}
            urlKey={urlKey}
          />

          {/* Anexos (Karine, 30/09). Ficam junto da descrição, dentro do
              mesmo painel que se abre ao clicar no nome: são as duas
              coisas que se quer ver quando se para pra ler a demanda, e
              na linha fechada só ocupariam espaço. */}
          <div className="mt-3">
            <AnexosDemanda
              taskId={task.id}
              anexos={task.anexos}
              urlKey={urlKey}
              onMudou={onSalvo}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}
