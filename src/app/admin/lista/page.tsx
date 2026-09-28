import { redirect } from "next/navigation";
import Link from "next/link";
import {
  hasTaskScopedRole,
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { getLaneGroups } from "@/lib/lane-groups-server";
import { StatusPieBoard } from "@/components/admin/status-pie-board";
import { ClickUpSyncButton } from "@/components/admin/clickup-sync-button";
import { ProjetosIncompletos } from "@/components/admin/projetos-incompletos";
import { abasPorPessoa, projetosDaPessoa, respValido } from "@/lib/abas-pessoa";
import { listAllProjectTasks, listClientOptions } from "@/lib/project-tasks-server";
import { AllTasksBoard } from "@/components/admin/all-tasks-board";

export const dynamic = "force-dynamic";

export default async function AdminListaPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; resp?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const novoHref = `/admin/novo${keyParam}`;

  const resp = respValido(params.resp) ? params.resp : "";

  const visibleIds = await getVisibleClientIds(member);
  // `resp` entra em getLaneGroups porque as colunas Responsável/Início/
  // Vencimento/Prioridade da linha saem da tarefa DAQUELA pessoa — é o que
  // faz a "Lista Andrei" do ClickUp mostrar a data dele.
  const [todosOsGrupos, todasAsTarefas, clientOptions] = await Promise.all([
    getLaneGroups(visibleIds, resp || null),
    listAllProjectTasks(),
    listClientOptions(visibleIds),
  ]);

  // O mesmo filtro por pessoa da Visão Geral — pedido da Karine (23/09):
  // "o filtro deve ficar aqui e servir para as listas, e não ser uma coisa
  // separada". Vale nas duas telas que mostram projeto agrupado por status.
  const visiveis = todasAsTarefas.filter(
    (t) => !visibleIds || (t.client_id && visibleIds.has(t.client_id))
  );
  const abas = abasPorPessoa(visiveis, "/admin/lista", keyParam, resp,
    // A aba "Todos" conta o que a lista mostra, não o que tem prazo.
    new Set(todosOsGrupos.flatMap((g) => g.clients.map((c) => c.id))).size);
  const daPessoa = resp ? projetosDaPessoa(visiveis, resp) : null;
  const groups = daPessoa
    ? todosOsGrupos.map((g) => ({
        ...g,
        clients: g.clients.filter((c) => daPessoa.has(c.id)),
      }))
    : todosOsGrupos;

  /**
   * Escolher uma pessoa troca a visão: sai a distribuição de PROJETOS por
   * status, entram as TAREFAS dela agrupadas por status.
   *
   * É o que a "Lista Valéria" do ClickUp é — print dela em 28/09: linhas
   * são as tarefas ("Design LP Pablo", "CAPAS E-BOOK PABLO"), agrupadas
   * por status, com Responsável, Prioridade, Data inicial e Vencimento.
   *
   * A "Lista Andrei" parece diferente (linhas com nome de cliente) só
   * porque as atribuições DELE são as tarefas-mãe, que no ClickUp levam o
   * nome do cliente. Mesma visão, dados diferentes — foi o que me fez
   * desfazer isso uma vez, achando que eram duas coisas.
   *
   * "Todos" segue mostrando projetos por status, que é o que o app tem de
   * melhor que o ClickUp: lá projeto não existe como entidade.
   */
  const tarefasComCliente = visiveis.filter(
    (t): t is (typeof visiveis)[number] & {
      client: NonNullable<(typeof visiveis)[number]["client"]>;
      client_id: string;
    } => t.client !== null && t.client_id !== null
  );

  return (
    <AdminShell active="lista" keyParam={keyParam} userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)} hideFinance={!hasFinanceAccess(member)}>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
            Projetos por status
          </h1>
          <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
            Clique numa fatia da pizza pra ver os projetos daquela etapa. Mude o
            status na linha pra mover o projeto.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {hasFullAccess(member) ? (
            <ClickUpSyncButton urlKey={urlKey} />
          ) : null}
          <Link
            href={novoHref}
            className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
          >
            + Novo projeto
          </Link>
        </div>
      </header>

      {/* Antes da pizza: projeto sem tipo/sem checklist não é uma etapa do
          fluxo, é um projeto que não dá pra tocar — precisa aparecer antes
          da distribuição por status, não escondido dentro dela. */}
      <ProjetosIncompletos
        groups={groups}
        keyParam={keyParam}
        urlKey={urlKey ?? undefined}
      />

      {resp ? (
        <AllTasksBoard
          tasks={tarefasComCliente}
          urlKey={urlKey ?? undefined}
          clients={clientOptions}
          restrictToResponsavel={
            hasTaskScopedRole(member) ? member.taskValue : undefined
          }
          viewInicial={resp}
          // As abas precisam NAVEGAR aqui: é o servidor que decide entre as
          // duas visões, e o filtro no cliente só trocaria a URL sem
          // recarregar — "Todos" nunca voltaria pra visão de projetos.
          navegacao={{ base: "/admin/lista", keyParam }}
        />
      ) : (
        <StatusPieBoard
          groups={groups}
          keyParam={keyParam}
          urlKey={urlKey ?? undefined}
          novoHref={novoHref}
          abasPessoa={abas}
          pessoaAtiva={resp}
          restrictToResponsavel={
            hasTaskScopedRole(member) ? member.taskValue : undefined
          }
        />
      )}
    </AdminShell>
  );
}
