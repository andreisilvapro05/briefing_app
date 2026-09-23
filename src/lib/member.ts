import { cache } from "react";
// As regras puras de autorização moram em ./permissoes.ts pra poderem ser
// testadas fora do Next — este arquivo puxa o Supabase, que puxa
// next/headers. Reexportadas aqui pra quem já importava daqui não mudar.
export * from "./permissoes";
import { hasFullAccess, type Member, type MemberRole } from "./permissoes";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "./supabase/server";
import { getServerEnv } from "./env";
import { hasValidAdminSession } from "./admin-session";

/**
 * Identidade por pessoa (Caixa 0 — ver docs/superpowers/specs/
 * 2026-07-06-caixa-0-membros-papeis-design.md). Evolução de
 * `getAdminUser()` (mantido em `./admin.ts` como wrapper fino, pros ~20
 * call-sites existentes migrarem aos poucos): agora resolve pra um membro
 * real (`team_members`) quando logado via Supabase Auth, e cai pro modo
 * legado (sessão por senha compartilhada) enquanto isso não é 100%
 * migrado — os dois modos funcionam ao mesmo tempo durante a transição.
 */


interface TeamMemberRow {
  id: string;
  auth_user_id: string | null;
  email: string;
  name: string;
  role: MemberRole;
  active: boolean;
  task_value: string | null;
  foto_url: string | null;
}

function legacyMember(source: "password-legacy" | "url-key-legacy"): Member {
  return {
    id: "legacy",
    authUserId: null,
    email: "admin@fysilab",
    name: "Equipe Fysi (sessão compartilhada)",
    role: "admin",
    source,
    legacy: true,
    taskValue: null,
    fotoUrl: null,
  };
}

/**
 * Identifica a pessoa (ou sessão legada) por trás da request. Ordem de
 * resolução espelha a de `getAdminUser()`: Supabase Auth primeiro (pessoa
 * real), depois cookie de senha compartilhada, depois `?key=` na URL.
 */
export async function getCurrentMember(opts?: {
  urlKey?: string | null;
}): Promise<Member | null> {
  // Deduplica dentro da MESMA renderização: getCurrentMember roda na page e
  // de novo em helpers/actions, e cada chamada custa um auth.getUser() de
  // rede + uma consulta em team_members. A chave é primitiva (string), não o
  // objeto de opções — cache() compara argumentos por identidade.
  return getCurrentMemberCached(opts?.urlKey ?? null);
}

const getCurrentMemberCached = cache(async function getCurrentMemberUncached(
  urlKeyArg: string | null
): Promise<Member | null> {
  const opts = { urlKey: urlKeyArg };
  // Caminho 1: Supabase Auth — identidade real da pessoa, via team_members.
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    supabase = null;
  }
  if (supabase) {
    // Uma falha de rede aqui (auth.getUser ou a query em team_members) não
    // pode derrubar a página inteira — cai pros caminhos legados abaixo em
    // vez de propagar a exceção pra quem chamou (getCurrentMember roda em
    // TODA página do admin).
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (user?.email) {
        const service = createSupabaseServiceRoleClient();
        const { data: row } = await service
          .from("team_members")
          .select(
            "id, auth_user_id, email, name, role, active, task_value, foto_url"
          )
          .eq("auth_user_id", user.id)
          .maybeSingle();
        const member = row as TeamMemberRow | null;
        if (member?.active) {
          return {
            id: member.id,
            authUserId: member.auth_user_id,
            email: member.email,
            name: member.name,
            role: member.role,
            source: "supabase",
            legacy: false,
            taskValue: member.task_value,
            fotoUrl: member.foto_url,
          };
        }
      }
    } catch {
      // segue pros caminhos legados abaixo
    }
  }

  // Caminho 2: cookie de sessão admin (login por senha compartilhada).
  if (await hasValidAdminSession()) {
    return legacyMember("password-legacy");
  }

  // Caminho 3: chave passada como query param (?key=...).
  if (opts?.urlKey) {
    let env: ReturnType<typeof getServerEnv>;
    try {
      env = getServerEnv();
    } catch {
      return null;
    }
    if (env.adminPassword && opts.urlKey === env.adminPassword) {
      return legacyMember("url-key-legacy");
    }
  }

  return null;
});


/**
 * IDs de cliente que este membro pode ver. `null` = acesso total (não
 * filtrar). Pra `basico` e `desenvolvedor` sem `taskValue` ligado, retorna
 * um Set vazio — mais seguro que mostrar tudo por engano quando o vínculo
 * não foi configurado ainda em /admin/membros.
 *
 * É esta função que garante que o desenvolvedor só vê o acesso (senha de
 * hospedagem, WordPress) do cliente em que ele TEM TAREFA: a lista sai de
 * project_tasks.responsavel, não de uma marcação à parte que alguém possa
 * esquecer de tirar.
 */
export async function getVisibleClientIds(
  member: Member
): Promise<Set<string> | null> {
  if (hasFullAccess(member)) return null;
  if (!member.taskValue) return new Set();

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("client_id")
    .eq("responsavel", member.taskValue);
  return new Set(((data as { client_id: string }[]) ?? []).map((r) => r.client_id));
}

/**
 * Exige um membro autenticado (opcionalmente com um papel específico).
 * Lança se não houver sessão válida ou o papel não bater — quem chama
 * decide o que fazer com o erro (redirect, 403, etc).
 */
export async function requireMember(opts?: {
  urlKey?: string | null;
  role?: MemberRole;
}): Promise<Member> {
  const member = await getCurrentMember(opts);
  if (!member) throw new Error("unauthorized");
  if (opts?.role && member.role !== opts.role) throw new Error("forbidden");
  return member;
}

/**
 * Wrapper fino de compatibilidade — mantém o shape antigo `{ email, source }`
 * pros call-sites que ainda não migraram pra `getCurrentMember()`. Exportado
 * de `./admin.ts` (nome histórico) pra não tocar nos ~20 imports existentes.
 */
export async function getAdminUserCompat(opts?: {
  urlKey?: string | null;
}): Promise<{
  email: string;
  source: "password" | "supabase" | "url-key";
} | null> {
  const member = await getCurrentMember(opts);
  if (!member) return null;
  const source =
    member.source === "password-legacy"
      ? "password"
      : member.source === "url-key-legacy"
        ? "url-key"
        : "supabase";
  return { email: member.email, source };
}
