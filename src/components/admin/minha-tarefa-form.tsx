"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import {
  atualizarMinhaTarefaAction,
  type ResultadoMinhaTarefa,
} from "@/app/admin/desenvolvimento/actions";

/**
 * Os dois formulários de "Minha tarefa" na ficha de implementação (status e
 * observações), com o erro do servidor à vista.
 *
 * Antes eram <form action={...}> direto no Server Component, e a action
 * devolvia void: recusa de permissão, status inválido, erro de banco — tudo
 * terminava com o select mostrando "Salvo ✓" e nada gravado. Quem
 * implementa marcava "concluído", fechava a aba e a tarefa seguia aberta
 * pra equipe. Achado da revisão de 22/09.
 *
 * `useActionState` é o jeito documentado do Next 16 de um formulário ler o
 * que a action devolveu (ver node_modules/next/dist/docs/01-app/…/forms).
 */
const INICIAL: ResultadoMinhaTarefa = { ok: true };

export function MinhaTarefaForm({
  taskId,
  urlKey,
  className,
  children,
}: {
  taskId: string;
  urlKey: string | null;
  className?: string;
  children: ReactNode;
}) {
  const [estado, agir] = useActionState(
    async (_anterior: ResultadoMinhaTarefa, fd: FormData) =>
      atualizarMinhaTarefaAction(fd),
    INICIAL
  );

  return (
    <form action={agir} className={className}>
      <input type="hidden" name="taskId" value={taskId} />
      {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
      {children}
      {!estado.ok ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          Não salvou: {estado.erro}
        </p>
      ) : null}
    </form>
  );
}
