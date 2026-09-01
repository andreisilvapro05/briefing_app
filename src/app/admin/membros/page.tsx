import { redirect } from "next/navigation";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { getCurrentMember, isAdmin, type MemberRole } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { AutoSubmitSelect } from "@/components/admin/auto-submit-select";
import { TEAM_MEMBERS } from "@/lib/project-tasks";
import {
  inviteMemberAction,
  resendInviteAction,
  setMemberRoleAction,
  setMemberTaskValueAction,
  toggleMemberActiveAction,
} from "./actions";

export const dynamic = "force-dynamic";

interface TeamMemberRow {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
  active: boolean;
  invited_at: string | null;
  last_login_at: string | null;
  task_value: string | null;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Admin (sócio)",
  avancado: "Avançado",
  basico: "Básico",
  desenvolvedor: "Desenvolvedor",
};

const ROLE_HINT: Record<MemberRole, string> = {
  admin: "acesso total, gerencia membros",
  avancado: "acesso completo, não é sócio",
  basico: "restrito aos projetos em que está marcado",
  desenvolvedor: "reservado",
};

export default async function MembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!isAdmin(member)) redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("team_members")
    .select("id, email, name, role, active, invited_at, last_login_at, task_value")
    .order("created_at", { ascending: true });
  const members = (data as TeamMemberRow[]) ?? [];

  return (
    <AdminShell active="membros" keyParam={keyParam} userEmail={member.email}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
          Membros da equipe
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Cada pessoa entra com o próprio e-mail (magic link). O login por
          senha compartilhada continua funcionando em paralelo durante a
          transição.
        </p>
        <p className="text-[0.7rem] text-fysi-muted mt-3 max-w-2xl">
          O papel <strong>Básico</strong> restringe todas as telas do admin
          (Clientes, ficha do cliente, Lista por status, Quadro, Visão
          Geral, Relatórios, Tarefas, Contratos, Cobranças e Estruturas
          Iniciais) aos projetos em que a pessoa está marcada — configure o
          vínculo de tarefas abaixo.
        </p>
      </header>

      {/* Convidar novo membro */}
      <section className="bg-white border border-fysi-line rounded-[20px] p-5 mb-6">
        <Eyebrow>Convidar</Eyebrow>
        <form
          action={inviteMemberAction}
          className="grid sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-3 mt-3"
        >
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <input
            type="text"
            name="name"
            required
            placeholder="Nome"
            className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
          />
          <input
            type="email"
            name="email"
            required
            placeholder="email@fysilab.com.br"
            className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
          />
          <select
            name="role"
            defaultValue="basico"
            className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
          >
            {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select
            name="taskValue"
            defaultValue=""
            title="Liga essa pessoa às tarefas dela em project_tasks — decide o que aparece pro papel Básico"
            className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
          >
            <option value="">Sem vínculo de tarefas</option>
            {TEAM_MEMBERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
          >
            Convidar
          </button>
        </form>
        <p className="text-[0.7rem] text-fysi-muted mt-2">
          O vínculo de tarefas é o que decide o que o papel <strong>Básico</strong>{" "}
          enxerga — clientes com pelo menos uma tarefa atribuída a essa pessoa.
        </p>
      </section>

      {/* Lista de membros */}
      <div className="bg-white border border-fysi-line rounded-[20px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-fysi-cream/60 text-left text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Pessoa</th>
              <th className="px-5 py-3 font-medium">Papel</th>
              <th className="px-5 py-3 font-medium">Vínculo de tarefas</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Último login</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-fysi-muted">
                  Nenhum membro cadastrado ainda — convide o primeiro acima.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="border-t border-fysi-line">
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-fysi-deep">{m.name}</span>
                      <span className="text-xs text-fysi-muted">{m.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <form action={setMemberRoleAction} className="inline-flex flex-col gap-0.5">
                      {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                      <input type="hidden" name="memberId" value={m.id} />
                      <AutoSubmitSelect
                        name="role"
                        defaultValue={m.role}
                        className="rounded-full border border-fysi-line bg-white text-xs px-3 py-1 focus:outline-none focus:border-fysi-deep/40"
                      >
                        {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </AutoSubmitSelect>
                      <span className="text-xs text-fysi-muted">{ROLE_HINT[m.role]}</span>
                    </form>
                  </td>
                  <td className="px-5 py-4">
                    <form action={setMemberTaskValueAction}>
                      {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                      <input type="hidden" name="memberId" value={m.id} />
                      <AutoSubmitSelect
                        name="taskValue"
                        defaultValue={m.task_value ?? ""}
                        className="rounded-full border border-fysi-line bg-white text-xs px-3 py-1 focus:outline-none focus:border-fysi-deep/40"
                      >
                        <option value="">Sem vínculo</option>
                        {TEAM_MEMBERS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </AutoSubmitSelect>
                    </form>
                  </td>
                  <td className="px-5 py-4">
                    <Pill tone={m.active ? "mint" : "muted"}>
                      {m.active ? "Ativo" : "Desativado"}
                    </Pill>
                  </td>
                  <td className="px-5 py-4 text-xs text-fysi-muted">
                    {m.last_login_at
                      ? new Date(m.last_login_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                      : m.invited_at
                        ? "Convidado, ainda não entrou"
                        : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-3">
                      {!m.last_login_at ? (
                        <form action={resendInviteAction}>
                          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                          <input type="hidden" name="memberId" value={m.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-fysi-deep hover:underline"
                          >
                            Reenviar convite
                          </button>
                        </form>
                      ) : null}
                      <form action={toggleMemberActiveAction}>
                        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                        <input type="hidden" name="memberId" value={m.id} />
                        <input type="hidden" name="active" value={m.active ? "1" : "0"} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-700 hover:underline"
                        >
                          {m.active ? "Desativar" : "Reativar"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
