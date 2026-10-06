"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClientStatusAction } from "@/app/admin/[id]/actions";
import {
  DEFAULT_TASK_STATUS,
  PROJECT_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  type TaskStatus,
} from "@/lib/project-tasks";

/**
 * Altera o status do projeto principal direto na listagem do admin (sem
 * abrir). Mesma taxonomia de 14 valores usada pelas tarefas internas
 * (project_tasks) — os status reais do ClickUp da equipe. Otimista: reflete
 * a escolha na hora; a action revalida o /admin.
 */

export function StatusChanger({
  clientId,
  status,
  urlKey,
  somenteLeitura = false,
}: {
  clientId: string;
  status: string;
  urlKey?: string;
  /** Papel com escopo por tarefa só lê — o servidor também recusa. */
  somenteLeitura?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [erro, setErro] = useState<string | null>(null);
  /**
   * Salvou no app, mas não chegou ao ClickUp. É AVISO, não erro: a
   * mudança valeu. Âmbar, não vermelho — vermelho é pro que deu errado.
   */
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    if (next === current) return;
    const anterior = current;
    setCurrent(next);
    setErro(null);
    setAviso(null);
    const fd = new FormData();
    fd.append("clientId", clientId);
    fd.append("status", next);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      /**
       * Reverte quando o servidor recusa.
       *
       * A action devolvia `void` e só logava: um status que não salvou
       * ficava pintado na tela indefinidamente, porque `router.refresh()`
       * re-renderiza o servidor mas não mexe neste `useState` (a linha não
       * é remontada — a key é o id do cliente). Só um F5 revelava.
       */
      try {
        const r = await setClientStatusAction(fd);
        if (!r.ok) {
          setCurrent(anterior);
          setErro(r.erro);
          return;
        }
        /**
         * Salvou aqui, mas não chegou ao ClickUp.
         *
         * NÃO reverte: registrar no app continua valendo mais do que não
         * registrar. Mas precisa aparecer — senão o cron das 9h traz o
         * status antigo de volta e parece que a mudança nunca aconteceu,
         * que é exatamente a reclamação da Karine (06/10).
         */
        if (r.avisoClickUp) {
          setAviso(r.avisoClickUp);
          router.refresh();
          return;
        }
      } catch {
        setCurrent(anterior);
        setErro("Não consegui salvar. Confira a conexão.");
        return;
      }
      // Re-renderiza a página atual (força-dinâmica) pra o item reagrupar
      // na hora — ex: na Lista por status, muda de grupo ao trocar o status.
      router.refresh();
    });
  }

  const rotulo =
    PROJECT_STATUS_OPTIONS.find((o) => o.value === current)?.label ?? current;

  return (
    // max-w-full/min-w-0: a largura natural de um <select> é a da opção mais
    // longa ("Validação implementação"), que estourava a coluna de 150px da
    // Lista — a pílula ficava cortada no meio, com o canto direito quadrado.
    <span
      className="relative inline-flex max-w-full min-w-0"
      title={erro ?? aviso ?? rotulo}
    >
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        disabled={pending || somenteLeitura}
        aria-label="Alterar status"
        className={`w-full min-w-0 truncate appearance-none rounded-full border text-xs font-medium pl-3 pr-6 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-fysi-deep/30 disabled:opacity-50 ${
          TASK_STATUS_TONE[current as TaskStatus] ?? TASK_STATUS_TONE[DEFAULT_TASK_STATUS]
        } ${erro ? "ring-1 ring-red-400" : aviso ? "ring-1 ring-amber-400" : ""}`}
      >
        {PROJECT_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-60"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
