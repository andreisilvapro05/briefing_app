"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { hydrateCliente } from "@/lib/storage";
import { pullResponsesFromServer } from "@/lib/briefing-store";
import type { ProjectType } from "@/lib/types";

interface ClienteData {
  id: string;
  nome: string;
  whatsapp: string;
  email?: string;
  empresa?: string;
  projectType?: ProjectType;
}

/**
 * Hidrata localStorage com os dados do cliente e leva pro /dashboard.
 * Usado pelas rotas /painel/[slug] (link mágico sem senha) e por testes
 * de "ver como cliente" do admin.
 */
export function ClientHydrator({
  cliente,
  destino = "/dashboard",
}: {
  cliente: ClienteData;
  /** Pra onde levar após hidratar. Default: /dashboard. Use "/briefing" pra
   *  mandar o cliente direto pro briefing (link "vá direto pro briefing"). */
  destino?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      hydrateCliente(cliente);
      // Busca respostas no servidor antes de redirecionar (cliente pode
      // ter preenchido coisas em outro aparelho).
      void pullResponsesFromServer(cliente.id).finally(() => {
        router.replace(destino);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
    }
  }, [cliente, router, destino]);

  return (
    <Shell tone="cream" hideHeader>
      <ContentFrame size="md">
        <div className="text-center py-10">
          {error ? (
            <p className="text-red-700 text-sm">{error}</p>
          ) : (
            <>
              <p className="text-fysi-deep text-lg font-medium">
                Carregando seu painel…
              </p>
              <p className="text-fysi-muted text-sm mt-1">
                Olá, {cliente.nome.split(" ")[0]} 👋
              </p>
            </>
          )}
        </div>
      </ContentFrame>
    </Shell>
  );
}
