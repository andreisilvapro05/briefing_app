import { createSupabaseServiceRoleClient } from "./supabase/server";
import {
  normalizarFrente,
  normalizarNota,
  normalizarStatus,
  type Iniciativa,
} from "./prioridades";

/**
 * Leitura de `improvement_initiatives`. Server-only: a tabela tem RLS ligado
 * SEM policy, então nada passa a não ser pelo service-role — quem autoriza é
 * quem chama (a sessão da equipe, conferida na page e em cada Server Action).
 */

interface Row {
  id: string;
  titulo: string;
  detalhe: string | null;
  frente: string;
  impacto: number;
  esforco: number;
  ganho: string | null;
  responsavel: string | null;
  status: string;
  ordem: number;
}

export const COLUNAS_INICIATIVA =
  "id, titulo, detalhe, frente, impacto, esforco, ganho, responsavel, status, ordem";

export function normalizarIniciativa(row: Row): Iniciativa {
  return {
    id: row.id,
    titulo: row.titulo,
    detalhe: row.detalhe,
    frente: normalizarFrente(row.frente),
    impacto: normalizarNota(row.impacto),
    esforco: normalizarNota(row.esforco),
    ganho: row.ganho,
    responsavel: row.responsavel,
    status: normalizarStatus(row.status),
    ordem: Number(row.ordem ?? 0),
  };
}

/** Todas as iniciativas, na ordem manual. O agrupamento por quadrante é da tela. */
export async function listarIniciativas(): Promise<Iniciativa[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("improvement_initiatives")
    .select(COLUNAS_INICIATIVA)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  return ((data as Row[] | null) ?? []).map(normalizarIniciativa);
}
