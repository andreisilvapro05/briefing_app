import { redirect } from "next/navigation";
import { Eyebrow, Pill } from "@/components/ui/pill";
import {
  getCurrentMember,
  isAdmin,
  ROLE_LABELS,
  ROLE_HINT,
  type MemberRole,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { AdminShell } from "@/components/admin/admin-shell";
import { AutoSubmitSelect } from "@/components/admin/auto-submit-select";
import { SubmitButton, SubmitTextButton } from "@/components/admin/submit-button";
import { MemberAccessLinkButton } from "@/components/admin/member-access-link-button";
import { MemberPasswordButton } from "@/components/admin/member-password-button";
import { TEAM_MEMBERS } from "@/lib/project-tasks";
import {
  inviteMemberAction,
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

export default async function MembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  /**
   * O login por senha compartilhada ainda está aberto? Ver
   * `loginCompartilhado` em src/lib/env.ts — é o que decide se a conta
   * individual de cada pessoa realmente limita o que ela vê.
   */
  let loginCompartilhadoLigado = true;
  try {
    loginCompartilhadoLigado = getServerEnv().loginCompartilhado;
  } catch {
    // Sem env (dev sem .env): o aviso aparece, que é o lado seguro.
  }
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
    <AdminShell active="membros" keyParam={keyParam} userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}>
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
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
        <p className="text-[0.7rem] text-fysi-muted mt-2 max-w-2xl">
          O papel <strong>Desenvolvedor</strong> é mais fechado ainda: ele vê
          uma tela só, <strong>Desenvolvimento</strong>, com as tarefas dele e,
          em cada uma, o que precisa pra montar a página — acessos do cliente,
          Figma, links de botão e pixel. Nada de financeiro, contratos,
          briefings, lista de clientes ou demandas internas. Sem o vínculo de
          tarefas abaixo ele não enxerga projeto nenhum.
        </p>
      </header>

      <div className="mb-6 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-900 font-medium mb-1">
          O envio de e-mail está em modo de teste
        </p>
        <p className="text-xs text-amber-800 leading-relaxed">
          O Resend só entrega e-mail pra conta dona (fysilabdigital@gmail.com)
          até um domínio ser verificado em resend.com/domains. Enquanto isso,
          use o botão <strong>&quot;Gerar link de acesso&quot;</strong> em
          cada membro pra mandar o link direto por WhatsApp — funciona em
          qualquer aparelho, sem depender do e-mail.
        </p>
      </div>

      {/* ---- O login compartilhado anula a conta individual ----
          Karine (06/10): "preciso de uma conta para cada usuário". As
          contas existem nesta tela desde 31/08, mas quem digita a senha
          compartilhada vira admin, qualquer que seja o papel dele aqui —
          então o recorte da designer e do desenvolvedor não vale nada
          enquanto esse caminho estiver aberto. */}
      {loginCompartilhadoLigado ? (
        <section className="bg-amber-50/70 border border-amber-200 rounded-[20px] p-5 mb-6">
          <Eyebrow>A senha compartilhada ainda funciona</Eyebrow>
          <p className="text-sm text-fysi-deep mt-2">
            Quem entra com a senha antiga do painel vira <strong>sócio</strong>,
            mesmo tendo papel de designer ou desenvolvedor aqui. Enquanto ela
            existir, as contas individuais desta tela não limitam ninguém.
          </p>
          <p className="text-sm text-fysi-muted mt-2">
            Quando todo mundo abaixo já tiver conta própria e senha,
            desligue-a: no Vercel, variável{" "}
            <code className="bg-white border border-fysi-line rounded px-1">
              ADMIN_SHARED_LOGIN
            </code>{" "}
            com valor{" "}
            <code className="bg-white border border-fysi-line rounded px-1">
              off
            </code>
            . Os links antigos com <code>?key=</code> param de funcionar junto
            — é o mesmo caminho.
          </p>
        </section>
      ) : (
        <section className="bg-fysi-mint/30 border border-fysi-mint rounded-[20px] p-5 mb-6">
          <Eyebrow>Só conta individual</Eyebrow>
          <p className="text-sm text-fysi-deep mt-2">
            A senha compartilhada está desligada. Cada pessoa entra com a conta
            dela, e o papel definido aqui é o que vale.
          </p>
        </section>
      )}

      {/* Convidar novo membro */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-6">
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
          <SubmitButton size="sm" pendingLabel="Convidando…">
            Convidar
          </SubmitButton>
        </form>
        <p className="text-[0.7rem] text-fysi-muted mt-2">
          O vínculo de tarefas é o que decide o que o papel <strong>Básico</strong>{" "}
          enxerga — clientes com pelo menos uma tarefa atribuída a essa pessoa.
        </p>
      </section>

      {/* Lista de membros */}
      <div className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card overflow-x-auto">
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
                      <MemberPasswordButton
                        memberId={m.id}
                        memberName={m.name}
                        urlKey={urlKey}
                      />
                      {!m.last_login_at ? (
                        <MemberAccessLinkButton memberId={m.id} urlKey={urlKey} />
                      ) : null}
                      <form action={toggleMemberActiveAction}>
                        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                        <input type="hidden" name="memberId" value={m.id} />
                        <input type="hidden" name="active" value={m.active ? "1" : "0"} />
                        <SubmitTextButton
                          danger
                          confirm={
                            m.active
                              ? `Desativar ${m.name}? A pessoa perde o acesso ao painel.`
                              : undefined
                          }
                        >
                          {m.active ? "Desativar" : "Reativar"}
                        </SubmitTextButton>
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
