import { cache } from "react";
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

/**
 * admin: sócio, acesso total. avancado: acesso completo sem ser sócio (ex:
 * atendimento). basico: acesso restrito aos projetos em que a pessoa está
 * marcada — o enforcement é feito por getVisibleClientIds(), aplicado em
 * todas as listas do admin.
 *
 * desenvolvedor: quem implementa as páginas (pedido da Karine, 2026-09-22).
 * Tem o MESMO escopo de clientes do "basico" (só onde tem tarefa), mas
 * enxerga menos telas que ele: uma só, /admin/desenvolvimento, onde estão as
 * tarefas dele e a ficha de implementação de cada uma. A lista de seções
 * permitidas é SECOES_DESENVOLVEDOR, e quem a aplica é o AdminShell — ver
 * podeVerSecao().
 */
export type MemberRole = "admin" | "avancado" | "basico" | "desenvolvedor";

export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Admin (sócio)",
  avancado: "Avançado",
  basico: "Básico",
  desenvolvedor: "Desenvolvedor",
};

export const ROLE_HINT: Record<MemberRole, string> = {
  admin: "acesso total, gerencia membros",
  avancado: "acesso completo, não é sócio",
  basico: "restrito aos projetos em que está marcado",
  desenvolvedor: "só as tarefas dele: acessos, Figma, botões e pixel",
};

export interface Member {
  id: string;
  authUserId: string | null;
  email: string;
  name: string;
  role: MemberRole;
  source: "supabase" | "password-legacy" | "url-key-legacy";
  /** true quando entrou pela senha compartilhada, não por identidade própria. */
  legacy: boolean;
  /** Liga esse membro a TEAM_MEMBERS (project-tasks.ts) — o valor gravado em project_tasks.responsavel. null se não ligado (ou "basico" sem tarefas suas). */
  taskValue: string | null;
  /** URL da foto de perfil (Supabase Storage). null = sem foto (mostra iniciais) ou sessão legada. */
  fotoUrl: string | null;
}

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

export function isAdmin(member: Member): boolean {
  return member.role === "admin";
}

/** Papel "desenvolvedor" — quem implementa as páginas (não é sessão legada). */
export function isDeveloper(member: Member): boolean {
  return member.role === "desenvolvedor" && !member.legacy;
}

/**
 * Papéis cujo alcance é a PRÓPRIA TAREFA, não o projeto inteiro: "basico"
 * (designer) e "desenvolvedor". Os dois veem só os clientes em que estão
 * marcados (getVisibleClientIds) e só editam tarefa em que são o
 * responsável (canEditTask, em admin/[id]/actions.ts).
 *
 * Existe como função própria porque o código checava `role === "basico"`
 * em uma dúzia de lugares: cada um desses pontos teria de ganhar um `||
 * role === "desenvolvedor"` na mão, e o esquecido falharia ABERTO — o
 * desenvolvedor passaria pelo caminho de quem tem acesso total.
 *
 * PENDENTE (2026-09-22): três guardas em `src/app/admin/[id]/actions.ts`
 * ainda comparam com a string "basico" e por isso deixam o desenvolvedor
 * passar como se tivesse acesso completo. Esse arquivo estava sendo editado
 * por outro agente quando este papel foi implementado, então a troca ficou
 * pra depois. As telas dele não usam essas ações (a escrita da tarefa dele
 * é `atualizarMinhaTarefaAction`, em admin/desenvolvimento/actions.ts), mas
 * Server Action é alcançável por POST direto — então isto é dívida de
 * segurança, não de estilo:
 *
 *   • canEditTask (~l.1231):        `if (member.role !== "basico") return true;`
 *                                   → `if (!hasTaskScopedRole(member)) return true;`
 *   • addProjectTaskAction (~l.1128): `if (member.role === "basico") {`
 *                                   → `if (hasTaskScopedRole(member)) {`
 *   • reorderProjectTasksAction (~l.1476): `member.role === "basico" &&`
 *                                   → `hasTaskScopedRole(member) &&`
 */
export function hasTaskScopedRole(member: Member): boolean {
  if (member.legacy) return false;
  return member.role === "basico" || member.role === "desenvolvedor";
}

/**
 * Acesso a Contratos/Cobranças/Projetos Fechados/Relatórios — separado de
 * `hasFullAccess` porque é sobre QUAL SEÇÃO a pessoa vê, não sobre QUAIS
 * CLIENTES. Pedido do usuário (2026-08-31): designer (role "basico") não
 * deve ver dados financeiros de nenhum cliente, nem os que ela mesma
 * atende — só o operacional (projetos, tarefas, EI, briefing).
 *
 * "desenvolvedor" entra no mesmo corte, com folga: ele não vê nem o
 * operacional completo. Além do menu, isso é o que barra as rotas de
 * contrato em /api/admin/contracts/*, que já chamam hasFinanceAccess.
 */
export function hasFinanceAccess(member: Member): boolean {
  return member.role !== "basico" && member.role !== "desenvolvedor";
}

/**
 * Seções do admin (AdminSection, em admin-shell.tsx) que o papel
 * "desenvolvedor" alcança. É uma ALLOWLIST: seção nova nasce fechada pra
 * ele, que é o padrão certo pra um papel externo à operação.
 *
 * - "desenvolvimento": as tarefas dele e a ficha de implementação de cada uma;
 * - "meu-perfil": foto, nome e senha da própria conta.
 *
 * Fora daí não entra nada — nem Processos (documentação interna da
 * agência), nem Meu Trabalho (mostra a carga da equipe e o sync do ClickUp).
 */
export const SECOES_DESENVOLVEDOR: readonly string[] = [
  "desenvolvimento",
  "meu-perfil",
];

/**
 * A pessoa pode abrir esta seção do admin? Hoje só o "desenvolvedor" é
 * recortado por seção; os outros papéis continuam sendo filtrados por
 * clientes (getVisibleClientIds) e por área financeira (hasFinanceAccess).
 *
 * Quem aplica é o AdminShell, que TODA tela do admin renderiza e que recebe
 * `active` obrigatoriamente — assim a barragem não depende de a página se
 * lembrar de chamar nada.
 */
export function podeVerSecao(member: Member, secao: string): boolean {
  if (!isDeveloper(member)) return true;
  return SECOES_DESENVOLVEDOR.includes(secao);
}

/** Pra onde mandar a pessoa quando ela cai numa tela que não é dela. */
export function telaInicialDe(member: Member): string {
  return isDeveloper(member) ? "/admin/desenvolvimento" : "/admin";
}

/**
 * Acesso completo (não restrito por projeto) — admin e avancado. `basico`
 * deveria só ver os projetos em que está marcado como responsável, mas
 * nenhuma tela ainda filtra por isso (fica pra quando existir o vínculo
 * responsável↔projeto); por ora `basico` também enxerga tudo na prática.
 */
export function hasFullAccess(member: Member): boolean {
  return member.role === "admin" || member.role === "avancado" || member.legacy;
}

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
