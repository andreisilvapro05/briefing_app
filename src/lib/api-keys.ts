import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createSupabaseServiceRoleClient } from "./supabase/server";

/**
 * Chaves de API só-leitura, pra um app externo (o "Segundo cérebro") ler as
 * demandas sem receber a senha do painel.
 *
 * Duas decisões que valem a pena registrar:
 *  - guarda SHA-256, nunca a chave crua. O repositório é público e este
 *    projeto já teve segredo vazado; se o banco for lido, a chave não serve.
 *  - o DONO da chave define o recorte. O app externo não diz quem é — quem
 *    decide o que sai é a chave. Revogar uma não derruba as outras.
 */

const PREFIXO = "fysi_ro_";

export interface ChaveValida {
  id: string;
  nome: string;
  memberId: string | null;
  /** `project_tasks.responsavel` que essa chave enxerga. */
  responsavel: string | null;
  escopo: string;
}

export function hashChave(bruta: string): string {
  return createHash("sha256").update(bruta, "utf8").digest("hex");
}

/** Gera a chave em claro — mostrada uma única vez, na criação. */
export function gerarChave(): { bruta: string; hash: string } {
  const bruta = `${PREFIXO}${randomBytes(24).toString("hex")}`;
  return { bruta, hash: hashChave(bruta) };
}

/** Lê o Bearer do header. Devolve null em qualquer formato inesperado. */
export function lerBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return null;
  const token = m[1].trim();
  return token.length >= 16 && token.length <= 200 ? token : null;
}

/**
 * Valida a chave. Comparação em tempo constante pra não vazar o prefixo do
 * hash por diferença de tempo de resposta.
 */
export async function validarChave(
  bruta: string,
  escopoExigido: string
): Promise<ChaveValida | null> {
  const hash = hashChave(bruta);
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("api_keys")
    .select("id, nome, member_id, responsavel, escopo, token_hash, revogada_at")
    .eq("token_hash", hash)
    .is("revogada_at", null)
    .maybeSingle();

  if (!data) return null;
  const linha = data as {
    id: string;
    nome: string;
    member_id: string | null;
    responsavel: string | null;
    escopo: string;
    token_hash: string;
  };

  const a = Buffer.from(linha.token_hash, "utf8");
  const b = Buffer.from(hash, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (linha.escopo !== escopoExigido) return null;

  // Carimbo de uso — ajuda a saber se uma chave ainda serve pra alguma coisa
  // antes de revogar. Não bloqueia a resposta.
  void service
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", linha.id)
    .then(() => undefined);

  return {
    id: linha.id,
    nome: linha.nome,
    memberId: linha.member_id,
    responsavel: linha.responsavel,
    escopo: linha.escopo,
  };
}
