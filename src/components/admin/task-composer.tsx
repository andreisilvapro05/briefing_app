"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProjectTaskAction } from "@/app/admin/[id]/actions";
import {
  AreaPicker,
  EisenhowerPicker,
  EsforcoPicker,
  RecorrenciaPicker,
  AssigneePicker,
  ClientPicker,
  DueDatePicker,
  PriorityPicker,
  type ClientChoice,
  type ClientOption,
} from "./task-pickers";

/**
 * Barra de criação de tarefa — o "+ Add task" do ClickUp: nome, e na mesma
 * linha cliente, responsável, prazo e prioridade. Enter cria e o cursor
 * continua no campo, pra lançar várias em sequência.
 *
 * Antes só existia um campo de título no rodapé da aba Tarefas da ficha do
 * cliente: a tarefa nascia sem dono e sem data (255 de 260 demandas abertas
 * estavam sem prazo em 2026-09-21), e não havia como criar demanda a partir
 * de "Meu Trabalho" nem de "Tarefas" — era preciso saber que o caminho era
 * abrir a ficha do cliente primeiro.
 */
export function TaskComposer({
  clientId,
  clients,
  defaultResponsavel = "",
  lockResponsavel = false,
  urlKey,
  autoFocus = false,
  onClose,
  notaInterno,
  defaultArea = "",
  areaFixa = false,
  placeholder = "Nova tarefa (Enter adiciona)",
}: {
  /** Cliente fixo (dentro da ficha). Sem ele, a pessoa escolhe em `clients`. */
  clientId?: string;
  clients?: ClientOption[];
  defaultResponsavel?: string;
  /** Papel "basico": só cria tarefa pra si — o servidor força o mesmo. */
  lockResponsavel?: boolean;
  urlKey?: string | null;
  autoFocus?: boolean;
  /** Quando a barra é aberta por um botão ("+ Nova demanda"), Esc fecha. */
  onClose?: () => void;
  /**
   * Aviso extra depois de criar demanda INTERNA — pra telas que não a
   * listam (Tarefas é por cliente): sem isso ela parecia não ter salvado.
   */
  notaInterno?: string;
  /** Área pré-escolhida — a tela de Demandas abre o composer já na área. */
  defaultArea?: string;
  /** Na tela de uma área específica, não faz sentido poder trocar. */
  areaFixa?: boolean;
  /** "demanda" em Demandas internas, "tarefa" nas telas de projeto. */
  placeholder?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState<ClientChoice>(clientId ?? null);
  const [responsavel, setResponsavel] = useState(defaultResponsavel);
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState("");
  // Os dois são opcionais ("se quiser", pedido da Karine): nascem vazios e
  // voltam ao vazio depois de criar, como o prazo e a prioridade.
  const [eisenhower, setEisenhower] = useState("");
  const [esforco, setEsforco] = useState("");
  /** Só demanda interna repete — tarefa de projeto acontece uma vez só. */
  const [recorrencia, setRecorrencia] = useState("");
  const [area, setArea] = useState(defaultArea);
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!criada) return;
    const t = window.setTimeout(() => setCriada(null), 4000);
    return () => window.clearTimeout(t);
  }, [criada]);

  function criar() {
    const nome = titulo.trim();
    if (!nome || pending) return;
    if (cliente === null) {
      setErro('Escolha o cliente — ou marque "Interno" se for demanda da agência.');
      return;
    }
    setErro(null);

    const fd = new FormData();
    fd.append("titulo", nome);
    fd.append("clientId", cliente);
    fd.append("responsavel", responsavel);
    fd.append("dataVencimento", prazo);
    fd.append("prioridade", prioridade);
    fd.append("eisenhower", eisenhower);
    fd.append("esforco", esforco);
    // Área só acompanha demanda interna (o servidor recusa nas de cliente).
    if (cliente === "") {
      fd.append("area", area);
      fd.append("recorrencia", recorrencia);
    }
    if (urlKey) fd.append("key", urlKey);

    startTransition(async () => {
      try {
        const r = await addProjectTaskAction(fd);
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
      } catch {
        setErro("Não consegui salvar a tarefa. Confira a conexão e tente de novo.");
        return;
      }
      // Cliente e responsável ficam: lançar 5 tarefas do mesmo projeto é o
      // caso comum. Prazo e prioridade voltam ao vazio — repetir data sem
      // querer é pior do que escolher de novo.
      setCriada(
        cliente === "" && notaInterno
          ? `"${nome}" adicionada. ${notaInterno}`
          : `"${nome}" adicionada.`
      );
      setTitulo("");
      setPrazo("");
      setPrioridade("");
      setEisenhower("");
      setEsforco("");
      // A cadência FICA: quem lança "conferir pagamentos toda semana"
      // costuma lançar a próxima recorrente logo em seguida.
      inputRef.current?.focus();
      router.refresh();
    });
  }

  return (
    <div>
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-2 rounded-[14px] border bg-white px-3 py-2 transition focus-within:border-fysi-deep/40 focus-within:shadow-fysi-card ${
          erro ? "border-red-300" : "border-fysi-line"
        }`}
      >
        <span className="text-fysi-muted shrink-0" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={titulo}
          maxLength={200}
          onChange={(e) => {
            setTitulo(e.target.value);
            if (erro) setErro(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              criar();
            } else if (e.key === "Escape" && onClose && !titulo) {
              onClose();
            }
          }}
          placeholder={placeholder}
          aria-label="Nome da nova tarefa"
          className="flex-1 min-w-[12rem] bg-transparent text-sm text-fysi-deep placeholder:text-fysi-muted focus:outline-none focus-visible:shadow-none py-1"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {clientId === undefined ? (
            <ClientPicker
              value={cliente}
              options={clients ?? []}
              onChange={(v) => {
                setCliente(v);
                if (erro) setErro(null);
              }}
              disabled={pending}
            />
          ) : null}
          {cliente === "" && !areaFixa ? (
            <AreaPicker value={area} onChange={setArea} disabled={pending} />
          ) : null}
          {cliente === "" ? (
            <RecorrenciaPicker
              value={recorrencia}
              onChange={setRecorrencia}
              disabled={pending}
              showLabel
            />
          ) : null}
          <AssigneePicker
            value={responsavel}
            onChange={setResponsavel}
            disabled={pending || lockResponsavel}
            showLabel
          />
          <DueDatePicker value={prazo} onChange={setPrazo} disabled={pending} />
          <PriorityPicker
            value={prioridade}
            onChange={setPrioridade}
            disabled={pending}
            showLabel
          />
          <EsforcoPicker
            value={esforco}
            onChange={setEsforco}
            disabled={pending}
            showLabel
          />
          <EisenhowerPicker
            value={eisenhower}
            onChange={setEisenhower}
            disabled={pending}
            showLabel
          />
          <button
            type="button"
            onClick={criar}
            disabled={pending || !titulo.trim()}
            className="h-7 rounded-full bg-fysi-deep text-fysi-cream text-xs font-semibold px-3.5 hover:bg-fysi-deep/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {pending ? "Adicionando…" : "Adicionar"}
          </button>
        </div>
      </div>
      {/* Linha de retorno com altura reservada: a lista não pula quando a
          mensagem aparece e some. */}
      <p
        className={`min-h-[1.25rem] mt-1 px-1 text-xs ${
          erro ? "text-red-700" : "text-fysi-muted"
        }`}
        role={erro ? "alert" : "status"}
        aria-live="polite"
      >
        {erro
          ? erro
          : criada
            ? criada
            : !responsavel && !lockResponsavel
              ? "Sem responsável escolhido, a tarefa recebe o dono padrão do tipo dela (copy, design, implementação…), quando houver."
              : ""}
      </p>
    </div>
  );
}
