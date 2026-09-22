"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AREAS,
  TASK_STATUS_GROUP,
  statusOptionsInternos,
  TASK_STATUS_TONE,
  TEAM_MEMBERS,
  type ProjectTask,
  type TaskStatus,
} from "@/lib/project-tasks";
import { updateProjectTaskAction } from "@/app/admin/[id]/actions";
import { TaskComposer } from "./task-composer";
import {
  AreaPicker,
  AssigneePicker,
  DueDatePicker,
  EisenhowerPicker,
  EsforcoPicker,
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
  const hoje = hojeISO();

  const visiveis = useMemo(() => {
    let t = tasks;
    if (filtroPessoa) t = t.filter((x) => x.responsavel === filtroPessoa);
    if (!mostrarFeitas) {
      t = t.filter((x) => TASK_STATUS_GROUP[x.status] === "ativo");
    }
    return t;
  }, [tasks, filtroPessoa, mostrarFeitas]);

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
    const ordenar = (arr: ProjectTask[]) =>
      arr.slice().sort((a, b) =>
        (a.data_vencimento ?? "9999").localeCompare(b.data_vencimento ?? "9999")
      );

    const out = AREAS.map((a) => ({
      area: a,
      tarefas: ordenar(porArea.get(a.value) ?? []),
    }));
    const semArea = porArea.get("") ?? [];
    return { out, semArea: ordenar(semArea) };
  }, [visiveis]);

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
                />
              ))}
            </ul>
          )}
        </section>
      ))}

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
}: {
  task: ProjectTask;
  hoje: string;
  urlKey?: string | null;
  onSalvo: () => void;
}) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [responsavel, setResponsavel] = useState(task.responsavel ?? "");
  const [prazo, setPrazo] = useState(task.data_vencimento ?? "");
  const [area, setArea] = useState(task.area ?? "");
  const [eisenhower, setEisenhower] = useState(task.eisenhower ?? "");
  const [esforco, setEsforco] = useState(task.esforco ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);

  const atrasada =
    !!prazo && prazo < hoje && TASK_STATUS_GROUP[status] === "ativo";

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

  return (
    <li className="flex flex-wrap items-center gap-2.5 px-5 py-3 hover:bg-fysi-cream/30 transition-colors">
      <span
        className={`flex-1 min-w-[12rem] text-sm ${
          feita ? "text-fysi-muted line-through" : "text-fysi-deep"
        }`}
      >
        {task.titulo}
      </span>

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

      {erro ? (
        <span className="text-xs text-red-700" role="alert">
          não salvou
        </span>
      ) : null}
    </li>
  );
}
