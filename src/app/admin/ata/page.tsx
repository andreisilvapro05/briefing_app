import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  isAdmin,
  isDeveloper,
  telaInicialDe,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { SubmitButton } from "@/components/admin/submit-button";
import { ViewTabs } from "@/components/admin/view-tabs";
import { hojeEmBrasilia } from "@/lib/datas";
import { agruparPorData, contarAtivas, separarAtas, separarLinhas } from "@/lib/atas";
import { listarAtas } from "@/lib/atas-server";
import { criarAtaAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Atas de acompanhamento — a tela do gestor de projetos.
 *
 * UMA ATA = UMA REUNIÃO, com vários clientes dentro. Karine (05/10): "não
 * é pra ser individual de cada cliente, e sim tudo num documento só, poder
 * puxar todos os clientes dentro de um mesmo documento". O gesto do Andrei
 * é sentar uma vez e passar por todos os projetos.
 *
 * A lista é agrupada por DIA, mais recente primeiro — "precisa ter os
 * documentos por datas" é o eixo do pedido, não um detalhe de ordenação.
 */
export default async function AtasPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; ver?: string; erro?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  // O AdminShell também barraria (a seção "ata" não está em
  // SECOES_DESENVOLVEDOR), mas sair antes de consultar o banco evita
  // montar a tela inteira pra depois jogar fora.
  if (isDeveloper(member)) redirect(`${telaInicialDe(member)}${kp}`);

  const visibleIds = await getVisibleClientIds(member);
  const atas = await listarAtas(visibleIds);

  const { ativas, arquivadas } = separarAtas(atas);
  const verArquivo = params.ver === "arquivo";
  const lista = verArquivo ? arquivadas : ativas;
  const hoje = hojeEmBrasilia();
  const grupos = agruparPorData(lista, hoje);

  const sep = kp ? "&" : "?";

  return (
    <AdminShell
      active="ata"
      keyParam={kp}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-5">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Atas de acompanhamento
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Uma ata por reunião, com todos os projetos dentro. O status de cada
          um é o do projeto: quando vira concluído, aquele cliente sai da
          lista da ata — sem apagar o que foi anotado.
        </p>
      </header>

      {params.erro === "criar" ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-4">
          Não consegui abrir a ata. Tente de novo em alguns segundos.
        </p>
      ) : null}

      <NovaAta urlKey={urlKey} hoje={hoje} />

      <div className="mb-4">
        <ViewTabs
          ariaLabel="Atas em andamento ou no arquivo"
          ativo={verArquivo ? "arquivo" : ""}
          items={[
            {
              value: "",
              label: "Em andamento",
              count: ativas.length,
              href: `/admin/ata${kp}`,
            },
            {
              value: "arquivo",
              label: "Arquivo",
              count: arquivadas.length,
              href: `/admin/ata${kp}${sep}ver=arquivo`,
            },
          ]}
        />
      </div>

      {grupos.length === 0 ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-10 text-center">
          <p className="text-fysi-deep font-medium mb-1">
            {verArquivo ? "Nada no arquivo ainda" : "Nenhuma ata em andamento"}
          </p>
          <p className="text-sm text-fysi-muted max-w-md mx-auto">
            {verArquivo
              ? "Aqui ficam as atas que alguém tirou da frente à mão."
              : "Abra a ata da reunião acima. Dentro dela você puxa os clientes, um a um."}
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map((g) => (
            <section key={g.data}>
              {/* A data é o cabeçalho do grupo, não uma coluna da linha:
                  é por ela que se procura uma ata. */}
              <h2 className="text-xs uppercase tracking-[0.12em] text-fysi-muted font-semibold mb-2 flex items-center gap-2">
                {g.rotulo}
                <span className="h-px flex-1 bg-fysi-line" aria-hidden />
                <span className="tabular-nums normal-case tracking-normal font-normal">
                  {g.atas.length}
                </span>
              </h2>
              <ul className="flex flex-col gap-2">
                {g.atas.map((a) => {
                  const emAndamento = contarAtivas(a);
                  const encerrados = a.linhas.length - emAndamento;
                  return (
                    <li
                      key={a.id}
                      className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          href={`/admin/ata/${a.id}${kp}`}
                          className="font-medium text-fysi-deep hover:underline min-w-0 truncate"
                        >
                          {a.titulo}
                        </Link>
                        <span className="text-xs text-fysi-muted tabular-nums shrink-0">
                          {emAndamento}{" "}
                          {emAndamento === 1 ? "projeto" : "projetos"}
                          {encerrados > 0 ? ` · ${encerrados} encerrado${encerrados === 1 ? "" : "s"}` : ""}
                        </span>
                        <Link
                          href={`/admin/ata/${a.id}${kp}`}
                          className="ml-auto shrink-0 text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
                        >
                          abrir ata →
                        </Link>
                      </div>
                      {/* Os nomes de quem está na ata, pra reconhecer a
                          reunião sem abrir. */}
                      {a.linhas.length > 0 ? (
                        <p className="text-sm text-fysi-muted mt-1.5 truncate">
                          {separarLinhas(a.linhas)
                            .ativas.map((l) => l.cliente)
                            .join(" · ") || "Todos os projetos desta ata já encerraram."}
                        </p>
                      ) : (
                        <p className="text-sm text-fysi-muted/70 mt-1.5 italic">
                          Nenhum cliente puxado ainda.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

/**
 * Abrir a ata de uma reunião. Fica no topo e sempre aberta (não atrás de
 * um "+ Nova"): é a ação da tela, e a ata costuma ser escrita durante ou
 * logo depois da reunião — um clique a menos importa aí.
 *
 * Não pede cliente: os clientes entram DENTRO da ata, que é o pedido.
 *
 * O `SubmitButton` (useFormStatus) é filho do `<form>`, como manda o
 * padrão do projeto: é o que desabilita o botão e evita a ata duplicada
 * por clique duplo.
 */
function NovaAta({ urlKey, hoje }: { urlKey: string | null; hoje: string }) {
  return (
    <form
      action={criarAtaAction}
      className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-4 mb-5 flex flex-wrap items-end gap-3"
    >
      {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
      <label className="flex flex-col gap-1 min-w-[14rem] flex-[2]">
        <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
          Título da reunião
        </span>
        <input
          type="text"
          name="titulo"
          maxLength={160}
          placeholder="Reunião de segunda"
          className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
          Data
        </span>
        {/* Começa em hoje: a ata quase sempre é da reunião que acabou. */}
        <input
          type="date"
          name="dia"
          defaultValue={hoje}
          className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
        />
      </label>
      <SubmitButton size="sm" pendingLabel="Abrindo…">
        Abrir ata
      </SubmitButton>
    </form>
  );
}
