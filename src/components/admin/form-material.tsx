"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import type { ResultadoMaterial } from "@/app/admin/[id]/materiais-actions";

/**
 * Um <form> da lista de materiais com o erro do servidor à vista.
 *
 * As sete ações devolviam void: erro de banco virava log e o botão dizia
 * "Salvo ✓". A lista é relida do banco no revalidate, então o estado final
 * não mentia — mas quem clica em "Remover" e lê "removido" espera que
 * tenha removido, e descobrir no próximo carregamento que não removeu é
 * pior do que ver o erro na hora.
 *
 * Server Action atravessa a fronteira servidor→cliente como prop: é pra
 * isso que ela existe. Por isso um invólucro só serve os oito formulários,
 * em vez de um componente cliente por botão.
 */
export function FormMaterial({
  acao,
  className,
  children,
}: {
  acao: (formData: FormData) => Promise<ResultadoMaterial>;
  className?: string;
  children: ReactNode;
}) {
  const [resultado, agir] = useActionState(
    async (_anterior: ResultadoMaterial, fd: FormData) => acao(fd),
    { ok: true } as ResultadoMaterial
  );

  return (
    <form action={agir} className={className}>
      {children}
      {!resultado.ok ? (
        <p role="alert" className="mt-1 text-[0.7rem] text-red-700">
          {resultado.erro}
        </p>
      ) : null}
    </form>
  );
}
