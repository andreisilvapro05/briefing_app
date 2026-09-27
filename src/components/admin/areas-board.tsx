"use client";

import { useMemo, useState } from "react";
import { TaskNotes } from "./task-notes";
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
/**
 * Peso do quadrante de Eisenhower, do mais importante ao menos. Quem não
 * foi classificado fica antes de "Eliminar": não decidir não é o mesmo que
 * decidir que não importa.
 */
function pesoQuadrante(v: string | null): number {
  switch (v) {
    case "fazer":
      return 0;
    case "planejar":
      return 1;
    case "delegar":
      return 2;
    case "eliminar":
      return 4;
    default:
      return 3;
  }
}

/** Peso do tamanho da tarefa, do mais rápido ao mais longo. */
function pesoEsforco(v: string | null): number {
  switch (v) {
    case "rapido":
      return 0;
    case "curto":
      return 1;
    case "medio":
      return 2;
    case "longo":
      return 3;
    default:
      return 4;
  }
}

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
  const grupos = useMemo(() => {
    const porArea = new Map<string, ProjectTask[]>();
    for (const t of visiveis) {
      const k = t.area ?? "";
      const arr = porArea.get(k);
      if (arr) arr.push(t);
      else porArea.set(k, [t]);
    }
    const porPrazo = (a: ProjectTask, b: ProjectTask) =>
      (a.data_vencimento ?? "9999").localeCompare(b.data_vencimento ?? "9999");
    const ordenar = (arr: ProjectTask[]) =>
      arr.slice().sort((a, b) => {
        if (ordem === "prazo") return porPrazo(a, b);
        if (ordem === "esforco") {
          // Do mais rápido pro mais longo: é a ordem de quem quer limpar a
          // lista. Não estimado vai pro fim.
          const d = pesoEsforco(a.esforco) - pesoEsforco(b.esforco);
          return d !== 0 ? d : porPrazo(a, b);
        }
        // Importância: quadrante primeiro, prazo como desempate.
        const d = pesoQuadrante(a.eisenhower) - pesoQuadrante(b.eisenhower);
        return d !== 0 ? d : porPrazo(a, b);
      });

    const out = AREAS.map((a) => ({
      area: a,
      tarefas: ordenar(porArea.get(a.value) ?? []),
    }));
    const semArea = porArea.get("") ?? [];
    return { out, semArea: ordenar(semArea) };
  }, [visiveis, ordem]);

  /** Áreas sem nada no recorte atual — viram a linha compacta do rodapé. */
  const vazias = grupos.out
    .filter(({ area, tarefas }) => tarefas.length === 0 && criandoEm !== area.value)
    .map(({ area }) => area);

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

      {grupos.out
        .filter(({ area, tarefas }) => tarefas.length > 0 || criandoEm === area.value)
        .map(({ area, tarefas }) => (
        <section
          key={area.value}
          className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card overflow-hidden"
        >
          <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-fysi-line">
            <span className={`h-8 w-1.5 rounded-full ${area.barra}`} aria-hidden />
            <h2 className="text-[0.95rem] font-semibold text-fysi-deep">
              {area.label}
            </h2>
            <span className="text-xs text-fysi-muted">
              {tarefas.length === 0
                ? "nada aqui"
                : `${tarefas.length} demanda${tarefas.length === 1 ? "" : "s"}`}
            </span>
            <button
              type="button"
              onClick={() =>
                setCriandoEm((v) => (v === area.value ? null : area.value))
              }
              className="ml-auto inline-flex items-center rounded-full border border-fysi-line text-xs font-semibold text-fysi-deep px-3 h-7 hover:border-fysi-deep/40 transition"
            >
              {criandoEm === area.value ? "Fechar" : "+ Demanda"}
            </button>
          </div>

          {criandoEm === area.value ? (
            <div className="px-5 pt-4">
              <TaskComposer
                clientId=""
                defaultArea={area.value}
                areaFixa
                defaultResponsavel={meuResponsavel}
                lockResponsavel={lockResponsavel}
                urlKey={urlKey}
                placeholder={`Nova demanda de ${area.label.toLowerCase()} (Enter adiciona)`}
                autoFocus
                onClose={() => setCriandoEm(null)}
              />
            </div>
          ) : null}

          {tarefas.length === 0 ? null : (
            <ul className="divide-y divide-fysi-line">
              {tarefas.map((t) => (
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
      ))}

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

      {abertasNaVista === 0 && grupos.semArea.length === 0 && !criandoEm ? (
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

      {grupos.semArea.length > 0 ? (
        <section className="bg-white border border-dashed border-fysi-line-strong rounded-[20px] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-fysi-line">
            <h2 className="text-[0.95rem] font-semibold text-fysi-deep">
              Sem área
            </h2>
            <span className="text-xs text-fysi-muted">
              {grupos.semArea.length} — escolha a área pra organizar
            </span>
          </div>
          <ul className="divide-y divide-fysi-line">
            {grupos.semArea.map((t) => (
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
        </div>
      ) : null}
    </li>
  );
}
