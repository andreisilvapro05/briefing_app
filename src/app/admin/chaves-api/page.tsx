import { redirect } from "next/navigation";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { SubmitTextButton } from "@/components/admin/submit-button";
import { CopyButton } from "@/components/admin/copy-button";
import { getCurrentMember, hasFinanceAccess, isAdmin } from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { TEAM_MEMBERS } from "@/lib/project-tasks";
import { criarChaveApiAction, revogarChaveApiAction } from "./actions";

export const dynamic = "force-dynamic";

interface ChaveRow {
  id: string;
  nome: string;
  responsavel: string | null;
  escopo: string;
  revogada_at: string | null;
  last_used_at: string | null;
  criada_por: string | null;
  created_at: string;
}

function quando(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Chaves de API só-leitura, pra apps externos lerem as demandas sem receber
 * a senha do painel.
 *
 * A chave em claro aparece UMA vez, logo depois de criada. Não fica no
 * banco (só o SHA-256) e não passa por lugar nenhum além desta tela — de
 * propósito: o repositório é público e este projeto já teve segredo vazado.
 */
export default async function ChavesApiPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; nova?: string; erro?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!isAdmin(member)) redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const nova = params.nova ?? null;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("api_keys")
    .select("id, nome, responsavel, escopo, revogada_at, last_used_at, criada_por, created_at")
    .order("created_at", { ascending: false });
  const chaves = (data as ChaveRow[] | null) ?? [];
  const ativas = chaves.filter((c) => !c.revogada_at);

  return (
    <AdminShell
      active="chaves-api"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Chaves de API
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Acesso só-leitura às demandas, pra outro app consumir. Cada chave
          enxerga só o trabalho de uma pessoa, e revogar uma não derruba as
          outras.
        </p>
      </header>

      {nova ? (
        <section className="bg-fysi-yellow/30 border border-fysi-yellow rounded-[20px] p-6 mb-6">
          <Eyebrow>Chave criada — copie agora</Eyebrow>
          <p className="text-sm text-fysi-deep mt-2 mb-3">
            Esta é a única vez que ela aparece. Não fica guardada em lugar
            nenhum: se perder, revogue e gere outra.
          </p>
          <div className="flex items-center gap-2 bg-white border border-fysi-line rounded-[12px] p-3">
            <code className="text-sm text-fysi-deep break-all flex-1 font-mono">
              {nova}
            </code>
            <CopyButton value={nova} label="Copiar" />
          </div>
          <div className="mt-4 text-sm text-fysi-deep">
            <p className="font-medium mb-1">Cole nos dois lugares:</p>
            <ul className="list-disc pl-5 text-fysi-muted space-y-0.5">
              <li>
                o arquivo <code className="font-mono">.env.local</code> aqui
              </li>
              <li>as variáveis do projeto na Vercel</li>
            </ul>
            <pre className="mt-3 bg-white border border-fysi-line rounded-[12px] p-3 text-xs overflow-x-auto font-mono text-fysi-deep">
{`DEMANDAS_API_URL=https://app.fysilabdigital.com.br/api/demandas
DEMANDAS_API_KEY=${nova}`}
            </pre>
          </div>
        </section>
      ) : null}

      {params.erro === "nome" ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-4">
          Dê um nome pra chave — é como você vai saber qual revogar depois.
        </p>
      ) : null}
      {params.erro === "banco" ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-4">
          Não consegui gravar a chave. Tente de novo.
        </p>
      ) : null}

      <form
        action={criarChaveApiAction}
        className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end"
      >
        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <label className="text-sm font-medium text-fysi-deep" htmlFor="nome">
            Nome da chave
          </label>
          <input
            id="nome"
            name="nome"
            required
            placeholder="Ex: Segundo cérebro"
            className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-fysi-deep" htmlFor="responsavel">
            Demandas de quem
          </label>
          <select
            id="responsavel"
            name="responsavel"
            defaultValue={member.taskValue ?? ""}
            className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
          >
            <option value="">Nenhuma (chave inerte)</option>
            {TEAM_MEMBERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <SubmitTextButton
          className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 whitespace-nowrap disabled:opacity-50"
          pendingLabel="Gerando…"
        >
          Gerar chave
        </SubmitTextButton>
      </form>

      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-6">
        <Eyebrow className="mb-2 block">Como o outro app chama</Eyebrow>
        <pre className="bg-fysi-cream/50 border border-fysi-line rounded-[12px] p-3 text-xs overflow-x-auto font-mono text-fysi-deep">
{`GET /api/demandas
Authorization: Bearer <chave>

→ { "demandas": [ { "id", "titulo", "cliente",
                    "status", "prazo", "url" } ] }`}
        </pre>
        <p className="text-xs text-fysi-muted mt-2">
          Devolve no máximo 200 demandas abertas. Sem chave responde 401; sem
          nada pra mostrar responde 200 com lista vazia. Não tem CORS — quem
          chama é servidor, não navegador.
        </p>
      </section>

      {chaves.length === 0 ? (
        <div className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center text-fysi-muted text-sm">
          Nenhuma chave criada ainda.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {chaves.map((c) => {
            const revogada = Boolean(c.revogada_at);
            const pessoa = TEAM_MEMBERS.find((t) => t.value === c.responsavel);
            return (
              <li
                key={c.id}
                className={`bg-white border rounded-[14px] shadow-fysi-card px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                  revogada ? "border-fysi-line opacity-60" : "border-fysi-line"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-fysi-deep truncate">
                      {c.nome}
                    </p>
                    {revogada ? (
                      <Pill tone="muted">revogada</Pill>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-fysi-mint text-fysi-deep">
                        <span className="h-1.5 w-1.5 rounded-full bg-fysi-deep" />
                        ativa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-fysi-muted mt-1">
                    {pessoa ? `demandas de ${pessoa.label}` : "sem pessoa — não devolve nada"}
                    {" · "}criada {quando(c.created_at)}
                    {" · "}último uso {quando(c.last_used_at)}
                  </p>
                </div>
                {!revogada ? (
                  <form action={revogarChaveApiAction}>
                    {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitTextButton
                      className="rounded-full border border-red-200 text-red-700 text-sm font-medium px-4 py-2 hover:bg-red-50 whitespace-nowrap disabled:opacity-50"
                      pendingLabel="Revogando…"
                    >
                      Revogar
                    </SubmitTextButton>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {ativas.length > 0 ? (
        <p className="text-xs text-fysi-muted mt-4">
          {ativas.length} chave{ativas.length === 1 ? "" : "s"} ativa
          {ativas.length === 1 ? "" : "s"}. Revogue qualquer uma que não
          estiver em uso — o efeito é imediato.
        </p>
      ) : null}
    </AdminShell>
  );
}
