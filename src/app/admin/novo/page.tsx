import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/admin";
import { createClientAction } from "../[id]/actions";

export const dynamic = "force-dynamic";

export default async function NovoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const sp = await searchParams;
  const urlKey = sp.key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  // Sempre preserva ?key= se veio na URL (mesmo se cookie também autenticou).
  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  return (
    <AdminShell active="clientes" keyParam={keyParam} userEmail={user.email}>
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
            Novo cliente
          </h1>
          <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
            Cadastre um cliente direto pelo admin (sem ele passar pelo fluxo
            público da Tela 1). Se o WhatsApp já existe, abrimos o cliente
            existente em vez de criar duplicado.
          </p>
        </header>

        <form
          action={createClientAction}
          className="bg-white border border-fysi-line rounded-[20px] p-6 flex flex-col gap-4"
        >
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}

          <FieldGroup
            label="Nome completo *"
            name="nome"
            required
            placeholder="Maria Souza"
          />
          <FieldGroup
            label="WhatsApp *"
            name="whatsapp"
            required
            placeholder="(11) 90000-0000"
            hint="Usado como identificador. Se já existir, abrimos o cliente existente."
          />
          <FieldGroup
            label="E-mail (opcional)"
            name="email"
            type="email"
            placeholder="cliente@empresa.com"
          />
          <FieldGroup
            label="Empresa (opcional)"
            name="empresa"
            placeholder="Estúdio Maria"
          />

          <div>
            <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium block mb-1">
              Tipo de projeto (opcional)
            </label>
            <select
              name="project_type"
              defaultValue=""
              className="w-full rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
            >
              <option value="">— escolher depois —</option>
              <option value="landing-com-copy">Landing com copy</option>
              <option value="landing-sem-copy">Landing sem copy</option>
              <option value="site-completo">Site completo</option>
              <option value="seo">SEO</option>
              <option value="outro">Outro serviço</option>
            </select>
            <p className="text-[0.65rem] text-fysi-muted mt-1">
              Define a timeline. Pode definir/mudar depois no painel do cliente.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-fysi-line mt-2">
            <Button type="submit" size="md">
              Criar cliente
            </Button>
            <Link
              href={`/admin${keyParam}`}
              className="text-sm text-fysi-muted hover:text-fysi-deep"
            >
              Cancelar
            </Link>
          </div>
        </form>
    </AdminShell>
  );
}

function FieldGroup({
  label,
  name,
  type = "text",
  required,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium block mb-1">
        {label}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
      />
      {hint ? <p className="text-[0.65rem] text-fysi-muted mt-1">{hint}</p> : null}
    </div>
  );
}
