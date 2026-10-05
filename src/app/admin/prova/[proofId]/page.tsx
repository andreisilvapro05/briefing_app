import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getCurrentMember,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
  isDeveloper,
  telaInicialDe,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { Eyebrow } from "@/components/ui/pill";
import { SubmitButton, SubmitTextButton } from "@/components/admin/submit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import {
  NIVEIS,
  PROOF_STATUS_OPTIONS,
  PROOF_STATUS_TOM,
  TIPOS_DE_USO,
  depoimentoDe,
  faltaParaPublico,
  nivelLabel,
  paresAntesDepois,
  podeUsarEm,
  type Dispositivo,
  type ProofAsset,
  type ProofStatus,
} from "@/lib/prova";
import { getProva } from "@/lib/prova-server";
import {
  adicionarAssetAction,
  mudarStatusDaProvaAction,
  registrarUsoAction,
  removerAssetAction,
  salvarFichaDaProvaAction,
  salvarResultadoAction,
  urlDoAsset,
} from "../actions";

export const dynamic = "force-dynamic";

/**
 * A ficha de uma prova: antes e depois lado a lado, depoimento,
 * autorização, resultado e onde já foi usada — a tela que o PRD descreve.
 *
 * A autorização NÃO é editável aqui de propósito: quem autoriza é o
 * CLIENTE, pelo painel dele, e o registro guarda quem autorizou e quando.
 * Um botão aqui que marcasse "nível 3" transformaria o termo num
 * formalismo — e é justamente ele que separa "pode usar em anúncio" de
 * problema jurídico.
 */
export default async function ProvaPage({
  params,
  searchParams,
}: {
  params: Promise<{ proofId: string }>;
  searchParams: Promise<{ key?: string; erro?: string }>;
}) {
  const { proofId } = await params;
  const sp = await searchParams;
  const urlKey = sp.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  if (isDeveloper(member) || !hasFullAccess(member)) {
    redirect(`${telaInicialDe(member)}${kp}`);
  }

  const prova = await getProva(proofId);
  if (!prova) redirect(`/admin/prova${kp}`);

  const pares = paresAntesDepois(prova.assets);
  const falta = faltaParaPublico(prova);
  const depo = depoimentoDe(prova);
  const outros = prova.assets.filter(
    (a) => a.tipo !== "antes" && a.tipo !== "depois"
  );

  // Uma URL por imagem — o bucket é o mesmo dos comprovantes.
  const urls = new Map<string, string>();
  for (const a of prova.assets) {
    urls.set(a.id, await urlDoAsset(a.storagePath));
  }

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
      <Link
        href={`/admin/prova${kp}`}
        className="text-sm text-fysi-muted hover:text-fysi-deep inline-block mb-3"
      >
        ← Banco de prova
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep truncate">
            {prova.cliente}
          </h1>
          <p className="text-sm text-fysi-muted mt-1">
            {nivelLabel(prova.autorizacaoNivel)}
            {prova.autorizadoPor ? ` · por ${prova.autorizadoPor}` : ""}
          </p>
        </div>
        <form action={mudarStatusDaProvaAction} className="flex items-end gap-2">
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <input type="hidden" name="proofId" value={prova.id} />
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
              Status
            </span>
            <select
              name="status"
              defaultValue={prova.status}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${PROOF_STATUS_TOM[prova.status as ProofStatus]}`}
            >
              {PROOF_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <SubmitTextButton pendingLabel="Salvando…">Mudar</SubmitTextButton>
        </form>
      </header>

      {sp.erro ? (
        <p
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-4"
        >
          {sp.erro}
        </p>
      ) : null}

      <p
        className={`text-sm rounded-[12px] px-4 py-3 mb-5 border ${
          falta.length === 0
            ? "bg-fysi-mint/30 border-fysi-mint text-fysi-deep"
            : "bg-fysi-cream border-fysi-line text-fysi-muted"
        }`}
      >
        {falta.length === 0
          ? "Esta prova pode ser usada em conteúdo público e anúncio."
          : `Pra usar em público, falta: ${falta.join(", ")}.`}
      </p>

      {/* ---- Antes e depois ---- */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-5">
        <Eyebrow>Antes e depois</Eyebrow>
        <p className="text-xs text-fysi-muted mt-1 mb-4">
          Print do site, desktop e celular. É do SITE — nunca de paciente ou
          cliente final do cliente.
        </p>

        <div className="flex flex-col gap-5">
          {pares.map((par) => (
            <div key={par.dispositivo}>
              <p className="text-xs uppercase tracking-[0.1em] text-fysi-muted font-semibold mb-2">
                {par.dispositivo === "desktop" ? "Desktop" : "Celular"}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Lado
                  rotulo="Antes"
                  asset={par.antes}
                  url={par.antes ? urls.get(par.antes.id) : undefined}
                  proofId={prova.id}
                  tipo="antes"
                  dispositivo={par.dispositivo}
                  urlKey={urlKey}
                />
                <Lado
                  rotulo="Depois"
                  asset={par.depois}
                  url={par.depois ? urls.get(par.depois.id) : undefined}
                  proofId={prova.id}
                  tipo="depois"
                  dispositivo={par.dispositivo}
                  urlKey={urlKey}
                />
              </div>
            </div>
          ))}
        </div>

        {outros.length > 0 ? (
          <div className="mt-5 pt-4 border-t border-fysi-line">
            <p className="text-xs uppercase tracking-[0.1em] text-fysi-muted font-semibold mb-2">
              Outros arquivos
            </p>
            <ul className="flex flex-wrap gap-3">
              {outros.map((a) => (
                <li key={a.id} className="w-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urls.get(a.id)}
                    alt={a.legenda ?? a.tipo}
                    className="w-full rounded-[10px] border border-fysi-line"
                  />
                  <p className="text-[0.7rem] text-fysi-muted mt-1">{a.tipo}</p>
                  <form action={removerAssetAction}>
                    {urlKey ? (
                      <input type="hidden" name="key" value={urlKey} />
                    ) : null}
                    <input type="hidden" name="proofId" value={prova.id} />
                    <input type="hidden" name="assetId" value={a.id} />
                    <DeleteButton label="Remover" what={a.tipo} />
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* ---- Depoimento (quem escreve é o CLIENTE, no painel dele) ---- */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-5">
        <Eyebrow>Depoimento</Eyebrow>
        {depo ? (
          <>
            <p className="text-sm text-fysi-deep mt-2 italic">“{depo}”</p>
            {prova.nota !== null ? (
              <p className="text-xs text-fysi-muted mt-2">
                Nota {prova.nota} de 10
              </p>
            ) : null}
            {prova.depoimentoTranscricao && prova.depoimentoTexto ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-fysi-muted">
                  Ver também a transcrição do áudio
                </summary>
                <p className="text-sm text-fysi-muted mt-1">
                  {prova.depoimentoTranscricao}
                </p>
              </details>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-fysi-muted mt-2">
            O cliente ainda não mandou. Ele responde pelo painel dele — o
            formulário aparece lá assim que esta prova existe.
          </p>
        )}
      </section>

      {/* ---- Autorização: registro, não formulário ---- */}
      <section className="bg-amber-50/60 border border-amber-200 rounded-[20px] p-5 mb-5">
        <Eyebrow>Autorização de uso</Eyebrow>
        {prova.autorizacaoNivel ? (
          <>
            <p className="text-sm text-fysi-deep mt-2 font-medium">
              {nivelLabel(prova.autorizacaoNivel)}
            </p>
            <p className="text-xs text-fysi-muted mt-1">
              Registrada por {prova.autorizadoPor} em{" "}
              {prova.autorizadoEm
                ? new Date(prova.autorizadoEm).toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })
                : "—"}
              .
            </p>
            {prova.autorizacaoTermo ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-fysi-muted">
                  Ver o termo que o cliente aceitou
                </summary>
                <p className="text-sm text-fysi-muted mt-1 whitespace-pre-wrap">
                  {prova.autorizacaoTermo}
                </p>
              </details>
            ) : null}
            <ul className="text-xs text-fysi-muted mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {TIPOS_DE_USO.map((t) => (
                <li key={t.value}>
                  {podeUsarEm(prova.autorizacaoNivel, t.value) ? "✓" : "✗"}{" "}
                  {t.label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="text-sm text-fysi-muted mt-2">
              Nenhuma autorização registrada. Sem ela, esta prova não sai em
              lugar nenhum — nem em proposta.
            </p>
            <ul className="text-xs text-fysi-muted mt-3 flex flex-col gap-1">
              {NIVEIS.map((n) => (
                <li key={n.nivel}>
                  <strong className="text-fysi-deep">Nível {n.nivel}</strong> —{" "}
                  {n.descricao}
                </li>
              ))}
            </ul>
            <p className="text-xs text-fysi-muted mt-3">
              Quem autoriza é o cliente, pelo painel dele. Não há botão aqui de
              propósito: o termo aceito é o que separa “pode usar em anúncio” de
              problema.
            </p>
          </>
        )}
      </section>

      {/* ---- Ficha: segmento, serviço, cidade, site ---- */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-5">
        <Eyebrow>Ficha</Eyebrow>
        <p className="text-xs text-fysi-muted mt-1 mb-3">
          É o que faz a prova ser achada depois: “provas de saúde, nível 3”.
        </p>
        <form
          action={salvarFichaDaProvaAction}
          className="flex flex-wrap items-end gap-3"
        >
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <input type="hidden" name="proofId" value={prova.id} />
          <Campo nome="segmento" rotulo="Segmento" valor={prova.segmento} placeholder="angiologia" />
          <Campo nome="servico" rotulo="Serviço" valor={prova.servico} placeholder="landing page" />
          <Campo nome="cidade" rotulo="Cidade" valor={prova.cidade} />
          <Campo nome="siteUrl" rotulo="Site" valor={prova.siteUrl} placeholder="https://" largo />
          <SubmitTextButton pendingLabel="Salvando…">Salvar ficha</SubmitTextButton>
        </form>
      </section>

      {/* ---- Resultado: só com fonte e data ---- */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-5">
        <Eyebrow>Resultado</Eyebrow>
        <p className="text-xs text-fysi-muted mt-1 mb-3">
          Só entra com fonte e data. Campo vazio é melhor que número sem
          origem — é ele que vira slide e anúncio depois.
        </p>
        <form
          action={salvarResultadoAction}
          className="flex flex-wrap items-end gap-3"
        >
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <input type="hidden" name="proofId" value={prova.id} />
          <Campo
            nome="resultadoTexto"
            rotulo="O que aconteceu"
            valor={prova.resultadoTexto}
            placeholder="3x mais contatos pelo site"
            largo
          />
          <Campo
            nome="resultadoFonte"
            rotulo="Fonte"
            valor={prova.resultadoFonte}
            placeholder="Clarity, Search Console, CRM, relato do cliente"
          />
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
              Data
            </span>
            <input
              type="date"
              name="resultadoData"
              defaultValue={prova.resultadoData ?? ""}
              className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
            />
          </label>
          <SubmitTextButton pendingLabel="Salvando…">
            Salvar resultado
          </SubmitTextButton>
        </form>
      </section>

      {/* ---- Onde foi usada ---- */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5">
        <Eyebrow>Onde já foi usada</Eyebrow>
        {prova.usadoEm.length === 0 ? (
          <p className="text-sm text-fysi-muted mt-2">
            Ainda não foi usada em lugar nenhum.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 mt-2 mb-3">
            {prova.usadoEm.map((u, i) => (
              <li key={`${u.tipo}-${i}`} className="text-sm text-fysi-deep">
                {TIPOS_DE_USO.find((t) => t.value === u.tipo)?.label ?? u.tipo} ·{" "}
                <span className="text-fysi-muted">{u.data}</span>
                {u.link ? (
                  <>
                    {" · "}
                    <a
                      href={u.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      abrir
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <form
          action={registrarUsoAction}
          className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-fysi-line"
        >
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <input type="hidden" name="proofId" value={prova.id} />
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
              Usei em
            </span>
            <select
              name="tipo"
              defaultValue="post"
              className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
            >
              {TIPOS_DE_USO.map((t) => (
                <option
                  key={t.value}
                  value={t.value}
                  disabled={!podeUsarEm(prova.autorizacaoNivel, t.value)}
                >
                  {t.label}
                  {podeUsarEm(prova.autorizacaoNivel, t.value)
                    ? ""
                    : " (sem autorização)"}
                </option>
              ))}
            </select>
          </label>
          <Campo nome="link" rotulo="Link (opcional)" valor={null} largo />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Registrando…">
            Registrar uso
          </SubmitButton>
        </form>
      </section>
    </AdminShell>
  );
}

/** Um lado do par antes/depois: a imagem, ou o campo pra subir. */
function Lado({
  rotulo,
  asset,
  url,
  proofId,
  tipo,
  dispositivo,
  urlKey,
}: {
  rotulo: string;
  asset: ProofAsset | null;
  url?: string;
  proofId: string;
  tipo: "antes" | "depois";
  dispositivo: Dispositivo;
  urlKey: string | null;
}) {
  return (
    <div className="border border-fysi-line rounded-[12px] p-3">
      <p className="text-xs font-semibold text-fysi-deep mb-2">{rotulo}</p>
      {asset && url ? (
        <>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${rotulo} — ${dispositivo}`}
              className="w-full rounded-[8px] border border-fysi-line"
            />
          </a>
          <form action={removerAssetAction} className="mt-2">
            {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
            <input type="hidden" name="proofId" value={proofId} />
            <input type="hidden" name="assetId" value={asset.id} />
            <DeleteButton label="Trocar" what={`${rotulo} (${dispositivo})`} />
          </form>
        </>
      ) : (
        <form action={adicionarAssetAction} className="flex flex-col gap-2">
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <input type="hidden" name="proofId" value={proofId} />
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="dispositivo" value={dispositivo} />
          <input
            type="file"
            name="arquivo"
            accept="image/*"
            required
            className="text-sm text-fysi-deep file:mr-3 file:rounded-full file:border-0 file:bg-fysi-cream file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-fysi-mint"
          />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Subindo…">
            Subir {rotulo.toLowerCase()}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

function Campo({
  nome,
  rotulo,
  valor,
  placeholder,
  largo,
}: {
  nome: string;
  rotulo: string;
  valor: string | null;
  placeholder?: string;
  largo?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${largo ? "flex-1 min-w-[16rem]" : ""}`}>
      <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
        {rotulo}
      </span>
      <input
        type="text"
        name={nome}
        defaultValue={valor ?? ""}
        placeholder={placeholder}
        className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
      />
    </label>
  );
}
