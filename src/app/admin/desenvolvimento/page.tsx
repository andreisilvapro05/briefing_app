import { redirect } from "next/navigation";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  hasTaskScopedRole,
  isAdmin,
  isDeveloper,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listarTarefasDe } from "@/lib/ficha-implementacao-server";
import {
  TASK_STATUS_GROUP,
  TASK_STATUS_TONE,
  TEAM_MEMBERS,
  type TaskStatus,
} from "@/lib/project-tasks";
import {
  hojeEmBrasilia, formatDiaMes } from "@/lib/datas";

export const dynamic = "force-dynamic";

/**
 * Desenvolvimento — a tela de trabalho de quem implementa as páginas.
 *
 * Pedido da Karine (2026-09-22): "Daniel (desenvolvedor — ele que faz as
 * implementações) precisará de um usuário só com dados de acesso e figma na
 * tarefa dele e links de botão, pixel, se tiver".
 *
 * A tela existe em vez de uma aba na ficha do cliente por causa do feedback
 * antigo de não enterrar trabalho por cliente: quem implementa pensa por
 * TAREFA ("o que eu tenho pra hoje"), não por cliente. Cada linha abre a
 * ficha de implementação daquela página — acessos, Figma, botões, pixel —
 * sem passar pela ficha do cliente, que ele não pode abrir.
 *
 * Quem enxerga o quê:
 *   • papel restrito por tarefa (desenvolvedor, basico): só as tarefas DELE,
 *     e só nos clientes em que ele tem tarefa (getVisibleClientIds);
 *   • acesso total: escolhe a pessoa pelo seletor, pra conferir o que o
 *     desenvolvedor está vendo e preencher a ficha que falta.
 */

function statusLabel(s: TaskStatus): string {
  return s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Quem a tela mostra por padrão pra quem tem acesso total. */
async function responsavelPadrao(): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("team_members")
    .select("task_value")
    .eq("role", "desenvolvedor")
    .eq("active", true)
    .not("task_value", "is", null)
    .limit(1)
    .maybeSingle();
  return (data as { task_value: string | null } | null)?.task_value ?? null;
}

export default async function DesenvolvimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; resp?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const restrito = hasTaskScopedRole(member);

  // Papel restrito NUNCA escolhe de quem são as tarefas: o valor vem da
  // conta dele, não da URL. Um `?resp=valeria` na barra de endereços não
  // pode virar a lista de outra pessoa.
  const respPedido = params.resp?.trim() || null;
  const responsavel = restrito
    ? member.taskValue
    : respPedido && TEAM_MEMBERS.some((m) => m.value === respPedido)
      ? respPedido
      : ((await responsavelPadrao()) ?? member.taskValue);

  const visibleIds = await getVisibleClientIds(member);
  const tarefas = responsavel
    ? await listarTarefasDe(responsavel, visibleIds)
    : [];

  const abertas = tarefas.filter((t) => TASK_STATUS_GROUP[t.status] === "ativo");
  const fechadas = tarefas.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "fechado"
  );
  const quem = TEAM_MEMBERS.find((m) => m.value === responsavel);

  return (
    <AdminShell
      active="desenvolvimento"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-5">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Desenvolvimento
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          {isDeveloper(member)
            ? "Suas tarefas. Abra uma pra ver tudo que precisa pra montar a página: acessos, Figma, links de botão e pixel."
            : "As tarefas de quem implementa as páginas, com a ficha de implementação de cada uma — é esta a tela que o desenvolvedor enxerga."}
        </p>
      </header>

      {/* Seletor de pessoa — só pra quem pode ver o trabalho dos outros. */}
      {restrito ? null : (
        <nav className="flex flex-wrap gap-1.5 mb-5">
          {TEAM_MEMBERS.map((m) => {
            const ativo = m.value === responsavel;
            return (
              <Link
                key={m.value}
                href={`/admin/desenvolvimento?resp=${m.value}${
                  urlKey ? `&key=${encodeURIComponent(urlKey)}` : ""
                }`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                  ativo
                    ? "bg-fysi-deep border-fysi-deep text-fysi-cream"
                    : "border-fysi-line text-fysi-muted hover:bg-fysi-cream"
                }`}
              >
                {m.label}
                {m.externo ? " (externo)" : ""}
              </Link>
            );
          })}
        </nav>
      )}

      {!responsavel ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center">
          <p className="text-fysi-deep font-medium mb-1">
            Sua conta ainda não está ligada a um responsável de tarefas
          </p>
          <p className="text-sm text-fysi-muted max-w-md mx-auto">
            Sem esse vínculo o app não sabe quais tarefas são suas — e, por
            segurança, não mostra nenhuma. Quem é sócio configura em Membros.
          </p>
        </section>
      ) : tarefas.length === 0 ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center">
          <p className="text-fysi-deep font-medium mb-1">
            Nenhuma tarefa de projeto {quem ? `pra ${quem.label}` : "por aqui"}
          </p>
          <p className="text-sm text-fysi-muted max-w-md mx-auto">
            Aparecem aqui as tarefas com cliente atribuídas a essa pessoa.
            Demanda interna da agência não entra — não há página pra montar.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          <ListaTarefas
            titulo="Em aberto"
            tarefas={abertas}
            keyParam={keyParam}
          />
          {fechadas.length > 0 ? (
            <ListaTarefas
              titulo="Entregues"
              tarefas={fechadas}
              keyParam={keyParam}
            />
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}

function ListaTarefas({
  titulo,
  tarefas,
  keyParam,
}: {
  titulo: string;
  tarefas: Awaited<ReturnType<typeof listarTarefasDe>>;
  keyParam: string;
}) {
  if (tarefas.length === 0) {
    return (
      <section>
        <h2 className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold mb-2">
          {titulo}
        </h2>
        <p className="text-sm text-fysi-muted">Nada por aqui.</p>
      </section>
    );
  }

  // Em Brasília, não em UTC: das 21h à meia-noite a data UTC já é amanhã e
  // tarefa que vence hoje aparecia atrasada. Achado da revisão de 22/09.
  const hoje = hojeEmBrasilia();

  return (
    <section>
      <h2 className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold mb-2">
        {titulo} · {tarefas.length}
      </h2>
      <ul className="flex flex-col gap-2">
        {tarefas.map((t) => {
          const atrasada =
            t.data_vencimento !== null &&
            t.data_vencimento < hoje &&
            TASK_STATUS_GROUP[t.status] === "ativo";
          return (
            <li key={t.id}>
              <Link
                href={`/admin/desenvolvimento/${t.id}${keyParam}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-white border border-fysi-line rounded-[16px] shadow-fysi-card px-4 py-3 hover:border-fysi-deep/30 transition"
              >
                <span className="text-sm font-semibold text-fysi-deep min-w-0 truncate max-w-[14rem]">
                  {t.clienteNome}
                </span>
                <span className="text-sm text-fysi-deep flex-1 min-w-0 truncate">
                  {t.titulo}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium ${TASK_STATUS_TONE[t.status]}`}
                >
                  {statusLabel(t.status)}
                </span>
                {t.data_vencimento ? (
                  <span
                    className={`text-xs font-medium ${
                      atrasada ? "text-red-700" : "text-fysi-muted"
                    }`}
                  >
                    {formatDiaMes(t.data_vencimento)}
                  </span>
                ) : null}
                {t.docId ? null : (
                  <Pill tone="muted">sem Estrutura Inicial</Pill>
                )}
                <span className="text-fysi-muted text-sm">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
