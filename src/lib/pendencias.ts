import { isActiveTaskStatus } from "./project-tasks";
import type { TaskStatus } from "./project-tasks";

/**
 * Pendências operacionais do cliente — não são mutuamente exclusivas (um
 * cliente pode estar com contrato a fazer, pagamento pendente e parado ao
 * mesmo tempo). Usado tanto pelo header da tela Clientes quanto pela aba
 * "Pendências" (`/admin/pendencias`).
 */

export const STUCK_DAYS = 7;

export interface ClientPendenciaFields {
  status: string;
  contrato_status: string | null;
  pagamento_total: number | null;
  pagamento_pago: number | null;
  last_client_activity_at: string | null;
  created_at: string;
}

export function daysSince(iso: string | null, now: number): number {
  if (!iso) return 0;
  return Math.floor((now - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/** Contrato enviado, aguardando assinatura do cliente. */
export function isContratoPendente(c: {
  contrato_status: string | null;
}): boolean {
  return c.contrato_status === "pendente";
}

/** Tem valor contratado, mas ainda não pago integralmente. */
export function isPagamentoPendente(c: {
  pagamento_total: number | null;
  pagamento_pago: number | null;
}): boolean {
  const total = Number(c.pagamento_total ?? 0);
  const pago = Number(c.pagamento_pago ?? 0);
  return total > 0 && pago < total;
}

/** Em fase ativa de produção, mas sem atividade há STUCK_DAYS+ dias. */
export function isParado(
  c: {
    status: string;
    last_client_activity_at: string | null;
    created_at: string;
  },
  now: number
): boolean {
  if (!isActiveTaskStatus(c.status as TaskStatus)) return false;
  return daysSince(c.last_client_activity_at ?? c.created_at, now) >= STUCK_DAYS;
}
