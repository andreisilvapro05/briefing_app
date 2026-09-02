import { redirect } from "next/navigation";
import Link from "next/link";
import { Eyebrow, Pill } from "@/components/ui/pill";
import {
  getCurrentMember,
  hasFinanceAccess,
  ROLE_LABELS,
  ROLE_HINT,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProfilePhotoUploader } from "@/components/admin/profile-photo-uploader";
import { ProfileNameEditor } from "@/components/admin/profile-name-editor";
import { PasswordChanger } from "@/components/admin/password-changer";
import { TEAM_MEMBERS } from "@/lib/project-tasks";

export const dynamic = "force-dynamic";

/**
 * Meu Perfil — página própria pra cada pessoa ver/editar a própria conta
 * (foto, papel, vínculo de tarefas). Pedido do usuário 2026-09-01: o avatar
 * pequeno do topbar não era discoverable o bastante como único jeito de
 * trocar a foto.
 */
export default async function MeuPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const initials = (member.name || member.email || "F").slice(0, 2).toUpperCase();
  const taskLabel = TEAM_MEMBERS.find((t) => t.value === member.taskValue)?.label;

  return (
    <AdminShell
      active="meu-perfil"
      keyParam={keyParam}
      userEmail={member.email}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Meu Perfil
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Sua conta no painel — foto, papel e vínculo de tarefas.
        </p>
      </header>

      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
        <Eyebrow className="mb-4 block">Foto de perfil</Eyebrow>
        <ProfilePhotoUploader urlKey={urlKey} fallbackInitials={initials} />
      </section>

      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 flex flex-col gap-4">
        <Eyebrow>Sobre você</Eyebrow>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-fysi-muted uppercase tracking-[0.1em] block mb-1">
              Nome
            </span>
            <ProfileNameEditor
              initialName={
                member.legacy ? "Equipe Fysi (sessão compartilhada)" : member.name
              }
              urlKey={urlKey}
              canEdit={member.source === "supabase"}
            />
          </div>
          <div>
            <span className="text-xs text-fysi-muted uppercase tracking-[0.1em] block mb-1">
              E-mail
            </span>
            <span className="text-sm text-fysi-deep font-medium">
              {member.legacy ? "—" : member.email}
            </span>
          </div>
          <div>
            <span className="text-xs text-fysi-muted uppercase tracking-[0.1em] block mb-1">
              Papel
            </span>
            {member.legacy ? (
              <span className="text-sm text-fysi-muted">
                sessão compartilhada (acesso total)
              </span>
            ) : (
              <>
                <Pill tone="muted">{ROLE_LABELS[member.role]}</Pill>
                <p className="text-xs text-fysi-muted mt-1">
                  {ROLE_HINT[member.role]}
                </p>
              </>
            )}
          </div>
          <div>
            <span className="text-xs text-fysi-muted uppercase tracking-[0.1em] block mb-1">
              Vínculo de tarefas
            </span>
            <span className="text-sm text-fysi-deep font-medium">
              {taskLabel ?? "Sem vínculo"}
            </span>
          </div>
        </div>

        <p className="text-xs text-fysi-muted border-t border-fysi-line pt-4">
          Papel e vínculo de tarefas só um Admin pode mudar, em{" "}
          <Link href={`/admin/membros${keyParam}`} className="text-fysi-deep underline">
            Membros
          </Link>
          .
        </p>
      </section>

      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mt-6">
        <Eyebrow className="mb-3 block">Senha</Eyebrow>
        <PasswordChanger
          urlKey={urlKey}
          canChange={member.source === "supabase"}
        />
      </section>
    </AdminShell>
  );
}
