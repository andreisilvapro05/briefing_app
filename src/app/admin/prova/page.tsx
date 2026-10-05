import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
  isDeveloper,
  telaInicialDe,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  PROOF_STATUS_OPTIONS,
  PROOF_STATUS_TOM,
  depoimentoDe,
  faltaParaPublico,
  filtrarProvas,
  nivelLabel,
  statusLabel,
  valoresDe,
  type ProofStatus,
} from "@/lib/prova";
import { clientesSemProva, listarProvas } from "@/lib/prova-server";
import { abrirProvaAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Banco de prova — a lista.
 *
 * PRD de 05/10: "a equipe filtra provas 'aprovadas para uso, nível 3,
 * segmento saúde' em uma tela". É o critério de aceite, e é por isso que
 * os quatro filtros ficam no topo e combinam entre si.
 */
export default async function ProvasPage({
  searchParams,
}: {
  searchParams: Promise<{
    key?: string;
    status?: string;
    segmento?: string;
    servico?: string;
    nivel?: string;
    erro?: string;
  }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  // Prova guarda depoimento, autorização de imagem e resultado de cliente:
  // é material comercial, não trabalho de execução.
  if (isDeveloper(member) || !hasFullAccess(member)) {
    redirect(`${telaInicialDe(member)}${kp}`);
  }

  const visibleIds = await getVisibleClientIds(member);
  const [todas, semProva] = await Promise.all([
    listarProvas(visibleIds),
    clientesSemProva(visibleIds),
  ]);

  const filtro = {
    status: params.status ?? "",
    segmento: params.segmento ?? "",
    servico: params.servico ?? "",
    nivel: params.nivel ?? "",
  };
  const provas = filtrarProvas(todas, filtro);
  const segmentos = valoresDe(todas, "segmento");
  const servicos = valoresDe(todas, "servico");

  return (
    <AdminShell
      active="prova"
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
          Banco de prova
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Cada projeto entregue vira prova: antes e depois, depoimento,
          resultado com fonte e a autorização do cliente. O nível de
          autorização decide onde aquela prova pode aparecer.
        </p>
      </header>

      {params.erro === "abrir" ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-4">
          Não consegui abrir a prova. Tente de novo em alguns segundos.
        </p>
      ) : null}

      {/* ---- Abrir prova de um cliente ---- */}
      {semProva.length > 0 ? (
        <form
          action={abrirProvaAction}
          className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-4 mb-5 flex flex-wrap items-end gap-3"
        >
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <label className="flex flex-col gap-1 min-w-[14rem] flex-1">
            <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
              Abrir prova de um projeto
            </span>
            <select
              name="clientId"
              required
              defaultValue=""
              className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
            >
              <option value="" disabled>
                Escolha o projeto…
              </option>
              {semProva.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton size="sm" pendingLabel="Abrindo…">
            Abrir prova
          </SubmitButton>
        </form>
      ) : null}

      {/* ---- Filtros ---- */}
      <form
        method="get"
        className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-3 mb-5 flex flex-wrap items-end gap-3"
      >
        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
        <Seletor
          nome="status"
          rotulo="Status"
          valor={filtro.status}
          opcoes={PROOF_STATUS_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
        <Seletor
          nome="nivel"
          rotulo="Autorização"
          valor={filtro.nivel}
          opcoes={[
            { value: "1", label: "Nível 1 — uso interno" },
            { value: "2", label: "Nível 2 — site e nome" },
            { value: "3", label: "Nível 3 — conteúdo e anúncio" },
            { value: "sem", label: "Sem autorização" },
          ]}
        />
        <Seletor
          nome="segmento"
          rotulo="Segmento"
          valor={filtro.segmento}
          opcoes={segmentos.map((s) => ({ value: s, label: s }))}
        />
        <Seletor
          nome="servico"
          rotulo="Serviço"
          valor={filtro.servico}
          opcoes={servicos.map((s) => ({ value: s, label: s }))}
        />
        <div className="flex items-center gap-2">
          <SubmitButton size="sm" variant="secondary" pendingLabel="Filtrando…">
            Filtrar
          </SubmitButton>
          {filtro.status || filtro.nivel || filtro.segmento || filtro.servico ? (
            <Link
              href={`/admin/prova${kp}`}
              className="text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
            >
              Limpar
            </Link>
          ) : null}
        </div>
      </form>

      <p className="text-xs text-fysi-muted mb-3 tabular-nums">
        {provas.length} de {todas.length}{" "}
        {todas.length === 1 ? "prova" : "provas"}
      </p>

      {provas.length === 0 ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-10 text-center">
          <p className="text-fysi-deep font-medium mb-1">
            {todas.length === 0 ? "Nenhuma prova ainda" : "Nada bate com o filtro"}
          </p>
          <p className="text-sm text-fysi-muted max-w-md mx-auto">
            {todas.length === 0
              ? "Abra a prova de um projeto entregue acima. Depois entram o antes e o depois, o depoimento e a autorização."
              : "Tente afrouxar o filtro — ou limpe para ver tudo."}
          </p>
        </section>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {provas.map((p) => {
            const falta = faltaParaPublico(p);
            const depo = depoimentoDe(p);
            return (
              <li
                key={p.id}
                className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/prova/${p.id}${kp}`}
                    className="font-medium text-fysi-deep hover:underline min-w-0 truncate"
                  >
                    {p.cliente}
                  </Link>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.68rem] font-medium ${PROOF_STATUS_TOM[p.status as ProofStatus]}`}
                  >
                    {statusLabel(p.status)}
                  </span>
                </div>

                <p className="text-xs text-fysi-muted">
                  {[p.segmento, p.servico, p.cidade].filter(Boolean).join(" · ") ||
                    "Sem segmento nem serviço"}
                </p>

                <p className="text-xs text-fysi-deep">{nivelLabel(p.autorizacaoNivel)}</p>

                {depo ? (
                  <p className="text-sm text-fysi-muted line-clamp-3 italic">
                    “{depo}”
                  </p>
                ) : (
                  <p className="text-sm text-fysi-muted/70 italic">
                    Sem depoimento ainda.
                  </p>
                )}

                {p.resultadoTexto ? (
                  <p className="text-xs text-fysi-deep">
                    {p.resultadoTexto}{" "}
                    <span className="text-fysi-muted">
                      ({p.resultadoFonte}, {p.resultadoData})
                    </span>
                  </p>
                ) : null}

                {falta.length > 0 ? (
                  <p className="text-[0.7rem] text-fysi-muted mt-auto pt-1 border-t border-fysi-line">
                    Pra usar em público, falta: {falta.join(", ")}.
                  </p>
                ) : (
                  <p className="text-[0.7rem] text-fysi-deep mt-auto pt-1 border-t border-fysi-line">
                    Pronta pra usar em público.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}

/** Um filtro. "Todos" é o valor vazio — o `<form method="get">` o omite. */
function Seletor({
  nome,
  rotulo,
  valor,
  opcoes,
}: {
  nome: string;
  rotulo: string;
  valor: string;
  opcoes: { value: string; label: string }[];
}) {
  if (opcoes.length === 0) return null;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
        {rotulo}
      </span>
      <select
        name={nome}
        defaultValue={valor}
        className="rounded-[10px] border border-fysi-line bg-white text-sm px-2.5 py-1.5 text-fysi-deep"
      >
        <option value="">Todos</option>
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
