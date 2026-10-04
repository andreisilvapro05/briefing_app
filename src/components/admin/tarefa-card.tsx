"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  addProjectTaskCommentAction,
  deleteProjectTaskCommentAction,
  getProjectTaskCommentsAction,
  type ProjectTaskComment,
} from "@/app/admin/[id]/actions";
import { extrairLinks } from "@/lib/links-de-nota";
import {
  areaLabel,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  type ProjectTask,
  type TaskStatus,
} from "@/lib/project-tasks";
import { AnexosDemanda } from "./anexos-demanda";
import { TaskComposer } from "./task-composer";
import { TaskLinks } from "./task-links-row";
import { TaskNotes } from "./task-notes";
import {
  AssigneePicker,
  DueDatePicker,
  EisenhowerPicker,
  EsforcoPicker,
  PriorityPicker,
} from "./task-pickers";
import { useFocusTrap } from "./use-focus-trap";

/**
 * A tarefa aberta como CARTÃO em cima da tela, igual ClickUp.
 *
 * Karine (04/10): "a parte interna de cada tarefa precisa ser o mais
 * parecida com o ClickUp possível, ele abre como card na tela, pop up".
 *
 * Antes, clicar no nome expandia uma linha <tr> embaixo da própria tarefa:
 * tudo (observações, quadrante, comentários) tinha que caber na largura da
 * tabela, e na Lista por status a tabela já vive dentro de um accordion
 * estreito. O cartão sai da tabela e ganha as duas colunas do ClickUp —
 * conteúdo à esquerda, atividade à direita.
 *
 * NÃO guarda estado de campo nenhum: quem edita continua sendo a linha
 * (TaskRow), que já grava otimista e desfaz quando o servidor recusa. O
 * cartão recebe cada campo como { valor, definir } — assim existe UM lugar
 * com a regra de rollback, e abrir/fechar o cartão não perde digitação.
 */

/** Campo de um clique (status, prioridade, responsável, datas, marcadores). */
export interface CampoDaTarefa<T extends string = string> {
  valor: T;
  /** Grava otimista; desfaz o estado local se o servidor recusar. */
  definir: (v: T) => void;
}

/** Campo digitado: o estado muda a cada tecla e só grava ao sair do campo. */
export interface CampoDeTexto {
  valor: string;
  /** Digitação — mexe só no estado local. */
  digitar: (v: string) => void;
  /** Fim da edição: grava se mudou (com rollback), senão volta ao servidor. */
  confirmar: () => void;
}

export interface CamposDaTarefa {
  titulo: CampoDeTexto;
  descricao: CampoDeTexto;
  status: CampoDaTarefa<TaskStatus>;
  prioridade: CampoDaTarefa;
  responsavel: CampoDaTarefa;
  dataInicial: CampoDaTarefa;
  dataVencimento: CampoDaTarefa;
  eisenhower: CampoDaTarefa;
  esforco: CampoDaTarefa;
}

const ROTULO =
  "text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold";

export function TarefaCard({
  task,
  clientId,
  urlKey,
  campos,
  readOnly = false,
  locked,
  salvando,
  erro,
  vencida,
  caminho,
  onFechar,
  onListaMudou,
}: {
  task: ProjectTask;
  /** Dono da tarefa — "" em demanda interna, igual a linha passa pras actions. */
  clientId: string;
  urlKey?: string;
  campos: CamposDaTarefa;
  /** Papel "basico" na tarefa de outra pessoa: lê tudo, não muda nada. */
  readOnly?: boolean;
  /** readOnly OU gravando: desliga os seletores enquanto a resposta não volta. */
  locked: boolean;
  salvando: boolean;
  erro: string | null;
  /** Vencimento no passado e tarefa aberta — quem calcula é a linha. */
  vencida: boolean;
  /** Caminho no topo (o breadcrumb do ClickUp): o link do cliente, quando a tela tem um. */
  caminho?: ReactNode;
  onFechar: () => void;
  /** A lista do servidor mudou (anexo, tarefa nova) — pra tela com estado local. */
  onListaMudou?: () => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const [criandoAbaixo, setCriandoAbaixo] = useState(false);

  // Esc fecha. No BUBBLE da window, de propósito: os seletores de
  // prioridade/responsável/data escutam Escape no document em CAPTURE e dão
  // stopPropagation — assim Esc com um menu aberto fecha só o menu, e o
  // cartão continua aberto. Trocar pra capture aqui inverteria a ordem e o
  // cartão sumiria junto com o menu.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Tira o foco do campo ANTES de fechar: título e descrição gravam no
      // blur, e desmontar o cartão não dispara blur — Esc com texto
      // digitado perdia a edição em silêncio.
      const ativo = document.activeElement;
      if (ativo instanceof HTMLElement) ativo.blur();
      onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  const links = extrairLinks(campos.descricao.valor);

  const cartao = (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-[6vh] px-4 pb-4"
      onClick={onFechar}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={task.titulo}
        className="bg-white rounded-[20px] shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-fysi-line">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-fysi-muted mb-1 truncate">
              {caminho ?? (task.area ? areaLabel(task.area) : "Tarefa do projeto")}
            </p>
            {/* Título grande e editável no lugar, como no ClickUp: parece
                texto, vira campo ao focar. Enter confirma, Esc devolve o
                nome que está no servidor. */}
            <input
              type="text"
              value={campos.titulo.valor}
              maxLength={200}
              disabled={locked}
              onChange={(e) => campos.titulo.digitar(e.target.value)}
              onBlur={campos.titulo.confirmar}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  // Para aqui: senão o Esc do campo fecharia o cartão junto.
                  e.stopPropagation();
                  // Só devolve o nome do servidor, SEM dar blur: o blur é
                  // quem grava, e ele leria o `titulo` deste render — ainda
                  // o digitado. Esc acabaria salvando justamente o que
                  // devia descartar. O campo fica em foco, já corrigido.
                  campos.titulo.digitar(task.titulo);
                }
              }}
              aria-label="Nome da tarefa"
              className="w-full -mx-1.5 px-1.5 py-0.5 rounded-[8px] border border-transparent bg-transparent text-xl font-semibold text-fysi-deep leading-snug hover:border-fysi-line focus:border-fysi-deep/40 focus:bg-white focus:outline-none transition-colors disabled:hover:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {readOnly ? (
              <span
                className="text-[0.68rem] uppercase tracking-[0.08em] text-fysi-muted"
                title="Você só edita tarefa em que é o responsável"
              >
                só leitura
              </span>
            ) : null}
            {salvando ? (
              <span className="text-xs text-fysi-muted">Salvando…</span>
            ) : null}
            <button
              type="button"
              onClick={onFechar}
              // Foco inicial aqui, não no título: o focus trap focaria o
              // primeiro campo, e no celular isso abre o teclado por cima
              // do cartão que a pessoa só queria ler.
              autoFocus
              aria-label="Fechar tarefa"
              className="w-8 h-8 grid place-items-center rounded-full text-fysi-muted hover:bg-fysi-cream hover:text-fysi-deep transition"
            >
              <IconeX />
            </button>
          </div>
        </div>

        {erro ? (
          <p
            role="alert"
            className="px-6 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100"
          >
            {erro}
          </p>
        ) : null}

        {/* Duas colunas no desktop (conteúdo | atividade), empilhadas no
            celular. No empilhado quem rola é este contêiner — duas áreas de
            rolagem numa tela de telefone é armadilha. */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          <div className="flex-1 min-w-0 px-6 py-5 flex flex-col gap-5 lg:overflow-y-auto">
            {/* Grade rótulo→valor em dois pares por linha, na ordem do
                ClickUp: Status e Responsáveis em cima, Datas e Prioridade
                embaixo. */}
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-4 gap-y-3 items-center">
              <dt className={ROTULO}>Status</dt>
              <dd>
                <select
                  value={campos.status.valor}
                  disabled={locked}
                  onChange={(e) =>
                    campos.status.definir(e.target.value as TaskStatus)
                  }
                  aria-label="Status da tarefa"
                  className={`w-full max-w-[15rem] rounded-full border text-xs font-medium px-3 py-1.5 cursor-pointer focus:outline-none disabled:opacity-50 ${TASK_STATUS_TONE[campos.status.valor]}`}
                >
                  {TASK_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </dd>

              <dt className={ROTULO}>Responsáveis</dt>
              <dd>
                <AssigneePicker
                  showLabel
                  value={campos.responsavel.valor}
                  disabled={locked}
                  onChange={campos.responsavel.definir}
                />
              </dd>

              <dt className={ROTULO}>Datas</dt>
              <dd className="flex flex-wrap items-center gap-1.5">
                <DueDatePicker
                  emptyLabel="Início"
                  value={campos.dataInicial.valor}
                  disabled={locked}
                  onChange={campos.dataInicial.definir}
                />
                <span aria-hidden="true" className="text-fysi-muted">
                  →
                </span>
                <DueDatePicker
                  emptyLabel="Vencimento"
                  value={campos.dataVencimento.valor}
                  disabled={locked}
                  overdue={vencida}
                  onChange={campos.dataVencimento.definir}
                />
              </dd>

              <dt className={ROTULO}>Prioridade</dt>
              <dd>
                <PriorityPicker
                  showLabel
                  value={campos.prioridade.valor}
                  disabled={locked}
                  onChange={campos.prioridade.definir}
                />
              </dd>
            </dl>

            {/* Quadrante e tamanho: os dois são opcionais e não viraram
                coluna da tabela — o cartão é onde eles cabem. */}
            <div>
              <p className={`${ROTULO} mb-1.5`}>Como decidir</p>
              <div className="flex flex-wrap items-center gap-2">
                <EisenhowerPicker
                  showLabel
                  value={campos.eisenhower.valor}
                  disabled={locked}
                  onChange={campos.eisenhower.definir}
                />
                <EsforcoPicker
                  showLabel
                  value={campos.esforco.valor}
                  disabled={locked}
                  onChange={campos.esforco.definir}
                />
              </div>
            </div>

            {/* As páginas do app ligadas a esta tarefa — as "Páginas" que a
                tarefa carrega no ClickUp. */}
            <TaskLinks clientId={task.client_id} urlKey={urlKey} />

            <div>
              <p className={`${ROTULO} mb-1.5`}>Descrição</p>
              <TaskNotes
                value={campos.descricao.valor}
                disabled={locked}
                onChange={campos.descricao.digitar}
                onBlur={campos.descricao.confirmar}
                clientId={task.client_id}
                urlKey={urlKey}
                placeholder="Adicione uma descrição. Digite / pra vincular uma página do app."
              />
              {links.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {links.map((l, i) => (
                    <a
                      key={`${l.url}-${i}`}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-fysi-line bg-white px-2.5 py-1 text-xs text-fysi-deep hover:border-fysi-deep/40 max-w-xs"
                    >
                      <IconeLink />
                      <span className="truncate">{l.label}</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <AnexosDemanda
              taskId={task.id}
              anexos={task.anexos}
              urlKey={urlKey}
              somenteLeitura={readOnly}
              onMudou={() => onListaMudou?.()}
            />

            {/* O "+" de Subtarefas do ClickUp, sem mentir sobre hierarquia:
                project_tasks não tem parent_id (a migration foi recusada),
                então a tarefa nova nasce IRMÃ, logo abaixo desta. Fica aqui
                porque com o cartão aberto o "+" da linha está inalcançável. */}
            {readOnly ? null : (
              <div className="border-t border-fysi-line pt-4">
                {criandoAbaixo ? (
                  <TaskComposer
                    autoFocus
                    clientId={task.client_id ?? ""}
                    depoisDe={task.id}
                    defaultResponsavel={task.responsavel ?? ""}
                    defaultArea={task.area ?? ""}
                    areaFixa={!task.client_id}
                    urlKey={urlKey}
                    onClose={() => setCriandoAbaixo(false)}
                    onCriou={onListaMudou}
                    placeholder={`Nova tarefa abaixo de "${task.titulo}" (Enter adiciona)`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setCriandoAbaixo(true)}
                    className="inline-flex items-center gap-1.5 text-sm text-fysi-muted hover:text-fysi-deep transition"
                  >
                    <IconeMais />
                    Criar tarefa logo abaixo desta
                  </button>
                )}
              </div>
            )}
          </div>

          <aside className="lg:w-[20rem] shrink-0 border-t lg:border-t-0 lg:border-l border-fysi-line bg-fysi-cream/20 px-5 py-5 flex flex-col min-h-0">
            <TaskComments
              taskId={task.id}
              clientId={clientId}
              urlKey={urlKey}
              rotulo="Atividade"
              className="flex-1 min-h-0 flex flex-col"
              classeLista="lg:flex-1 lg:min-h-0 max-h-72 lg:max-h-none overflow-y-auto"
            />
          </aside>
        </div>
      </div>
    </div>
  );

  // Portal pro body: a linha vive dentro de <tbody>, e uma <div> solta ali
  // é HTML inválido — sai da tabela antes de ser pintada.
  if (typeof document === "undefined") return null;
  return createPortal(cartao, document.body);
}

export function TaskComments({
  taskId,
  clientId,
  urlKey,
  rotulo = "Comentários",
  className = "",
  classeLista = "max-h-56 overflow-y-auto",
}: {
  taskId: string;
  clientId: string;
  urlKey?: string;
  /** "Atividade" no cartão, "Comentários" nos painéis menores. */
  rotulo?: string;
  /** O cartão passa um flex-col pra caixa de escrever ficar no rodapé. */
  className?: string;
  /** Altura da lista — padrão limita; no cartão ela ocupa o painel. */
  classeLista?: string;
}) {
  const [comments, setComments] = useState<ProjectTaskComment[] | null>(null);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getProjectTaskCommentsAction(taskId, urlKey).then((data) => {
      if (active) setComments(data);
    });
    return () => {
      active = false;
    };
  }, [taskId, urlKey]);

  function refresh() {
    getProjectTaskCommentsAction(taskId, urlKey).then(setComments);
  }

  function submit() {
    const value = body.trim();
    if (!value) return;
    const fd = new FormData();
    fd.append("taskId", taskId);
    fd.append("clientId", clientId);
    fd.append("body", value);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await addProjectTaskCommentAction(fd);
      setBody("");
      refresh();
    });
  }

  function remove(commentId: string) {
    if (!window.confirm("Excluir este comentário?")) return;
    const fd = new FormData();
    fd.append("commentId", commentId);
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await deleteProjectTaskCommentAction(fd);
      refresh();
    });
  }

  return (
    <div className={className}>
      <label className="block text-xs uppercase tracking-[0.08em] text-fysi-muted font-medium mb-1">
        {rotulo}
      </label>
      {comments === null ? (
        <p className="text-xs text-fysi-muted">Carregando…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-fysi-muted mb-2">Nenhum comentário ainda.</p>
      ) : (
        <div className={`flex flex-col gap-2 mb-2 ${classeLista}`}>
          {comments.map((c) => (
            <div
              key={c.id}
              className="group/comment bg-white border border-fysi-line rounded-[8px] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-xs font-medium text-fysi-deep">
                  {c.author}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-fysi-muted tabular-nums">
                    {formatCommentDate(c.created_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    className="text-xs text-red-700 opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 hover:underline disabled:opacity-50"
                  >
                    excluir
                  </button>
                </span>
              </div>
              <p className="text-xs text-fysi-deep whitespace-pre-wrap">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-start gap-2 mt-auto">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um comentário…"
          rows={2}
          className="flex-1 min-w-0 rounded-[8px] border border-fysi-line bg-white text-xs px-3 py-2 focus:outline-none focus:border-fysi-deep/40 resize-y"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={submit}
          disabled={pending || !body.trim()}
        >
          Comentar
        </Button>
      </div>
    </div>
  );
}

function formatCommentDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

const TRACO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconeX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...TRACO}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconeMais() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...TRACO}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconeLink() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" {...TRACO} className="shrink-0">
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
