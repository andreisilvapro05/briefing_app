"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow, Pill } from "@/components/ui/pill";

/**
 * Card de contrato no /admin/[id]:
 * - Se cliente ainda não tem contrato: formulário (pacote, valor, prazo) +
 *   botão "Gerar e enviar contrato".
 * - Se já tem: status + ações (atualizar status, abrir PDF assinado).
 *
 * Avisa se o cliente ainda não tem e-mail (necessário pro Autentique).
 */

interface ContractCardProps {
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  autentiqueDocumentId: string | null;
  contratoStatus: string | null;
  contratoSignedUrl: string | null;
  contratoDados: Record<string, unknown> | null;
  urlKey?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente de assinatura",
  assinado: "Assinado",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
};
const STATUS_TONES: Record<string, "mint" | "outline" | "muted"> = {
  pendente: "outline",
  assinado: "mint",
  rejeitado: "muted",
  cancelado: "muted",
};

export function ContractCard(props: ContractCardProps) {
  const router = useRouter();
  const keyParam = props.urlKey
    ? `?key=${encodeURIComponent(props.urlKey)}`
    : "";

  const initial = props.contratoDados ?? {};
  const [pacote, setPacote] = useState(
    (initial["pacote_nome"] as string) ?? ""
  );
  const [valor, setValor] = useState(
    (initial["valor_parcelamento"] as string) ?? ""
  );
  const [prazo, setPrazo] = useState(
    (initial["prazo_execucao"] as string) ?? ""
  );
  const [escopo, setEscopo] = useState(
    (initial["escopo_projeto"] as string) ?? ""
  );
  const [linkPagamento, setLinkPagamento] = useState(
    (initial["link_parcelamento"] as string) ?? ""
  );
  // Email do destinatário (pra Autentique enviar o link de assinatura).
  // Default = email cadastrado do cliente; admin pode trocar / preencher.
  const [recipientEmail, setRecipientEmail] = useState(
    props.clientEmail ?? ""
  );
  // Nome completo do signatário (vai pro contrato e pro Autentique).
  // Default = nome cadastrado; admin digita o nome legal completo.
  const [signerName, setSignerName] = useState(props.clientName ?? "");
  const [status, setStatus] = useState<
    "idle" | "sending" | "refreshing" | "previewing" | "marking" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [markingMode, setMarkingMode] = useState(false);
  const [manualSignedUrl, setManualSignedUrl] = useState("");

  async function sendContract(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/contracts/send/${props.clientId}${keyParam}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pacoteNome: pacote,
            valorParcelamento: valor,
            prazoExecucao: prazo,
            escopoProjeto: escopo,
            linkParcelamento: linkPagamento,
            recipientEmail: recipientEmail || undefined,
            signerName: signerName || undefined,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(humanError(data.error, data.details));
        return;
      }
      router.refresh();
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  async function preview() {
    // Valida que os campos da proposta estão preenchidos antes de chamar.
    if (!pacote || !valor || !prazo || !escopo || !linkPagamento) {
      setStatus("error");
      setError("Preenche todos os campos da proposta primeiro.");
      return;
    }
    setStatus("previewing");
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/contracts/preview/${props.clientId}${keyParam}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pacoteNome: pacote,
            valorParcelamento: valor,
            prazoExecucao: prazo,
            escopoProjeto: escopo,
            linkParcelamento: linkPagamento,
            recipientEmail: recipientEmail || undefined,
            signerName: signerName || undefined,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setError(humanError(data.error, data.details));
        return;
      }
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `preview-${props.clientId.slice(0, 8)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  async function markSigned() {
    setStatus("marking");
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/contracts/mark-signed/${props.clientId}${keyParam}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signedUrl: manualSignedUrl.trim() || undefined,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(humanError(data.error, data.details));
        return;
      }
      setMarkingMode(false);
      setManualSignedUrl("");
      router.refresh();
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  async function refresh() {
    setStatus("refreshing");
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/contracts/refresh/${props.clientId}${keyParam}`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(humanError(data.error, data.details));
        return;
      }
      router.refresh();
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  const hasContract = !!props.autentiqueDocumentId;
  // Bloqueia enviar se faltar email OU nome do signatário.
  const noEmail = !recipientEmail.trim();
  const noName = !signerName.trim();

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <Eyebrow>Contrato (Autentique)</Eyebrow>
        {hasContract && props.contratoStatus ? (
          <Pill tone={STATUS_TONES[props.contratoStatus] ?? "muted"}>
            {STATUS_LABELS[props.contratoStatus] ?? props.contratoStatus}
          </Pill>
        ) : null}
      </div>

      {noEmail && !hasContract ? (
        <p className="text-xs text-fysi-muted bg-fysi-cream/40 border border-fysi-line rounded-[12px] px-3 py-2 mb-4">
          Preencha o <strong>e-mail do destinatário</strong> abaixo pra enviar.
          Se o cliente ainda não cadastrou um e-mail, digite o que você quiser
          usar — fica salvo no cliente automaticamente.
        </p>
      ) : null}

      {hasContract ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-fysi-muted truncate">
              ID Autentique:{" "}
              <code className="font-mono">{props.autentiqueDocumentId}</code>
            </div>
            <a
              href={`https://app.autentique.com.br/documentos/${props.autentiqueDocumentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-fysi-deep underline underline-offset-2 hover:text-fysi-green whitespace-nowrap"
            >
              Abrir no Autentique →
            </a>
          </div>

          {props.contratoDados ? (
            <div className="bg-fysi-cream/40 rounded-[12px] p-3 text-sm flex flex-col gap-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-fysi-muted text-xs uppercase tracking-[0.1em] block">
                    Pacote
                  </span>
                  <span className="text-fysi-deep">
                    {(props.contratoDados["pacote_nome"] as string) ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-fysi-muted text-xs uppercase tracking-[0.1em] block">
                    Valor
                  </span>
                  <span className="text-fysi-deep">
                    {(props.contratoDados["valor_parcelamento"] as string) ??
                      "—"}
                  </span>
                </div>
                <div>
                  <span className="text-fysi-muted text-xs uppercase tracking-[0.1em] block">
                    Prazo
                  </span>
                  <span className="text-fysi-deep">
                    {(props.contratoDados["prazo_execucao"] as string) ?? "—"}
                  </span>
                </div>
              </div>
              {props.contratoDados["escopo_projeto"] ? (
                <div>
                  <span className="text-fysi-muted text-xs uppercase tracking-[0.1em] block">
                    Escopo
                  </span>
                  <pre className="text-fysi-deep text-sm whitespace-pre-wrap font-sans mt-1">
                    {props.contratoDados["escopo_projeto"] as string}
                  </pre>
                </div>
              ) : null}
              {props.contratoDados["link_parcelamento"] ? (
                <div>
                  <span className="text-fysi-muted text-xs uppercase tracking-[0.1em] block">
                    Link de parcelamento
                  </span>
                  <a
                    href={
                      props.contratoDados["link_parcelamento"] as string
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fysi-deep underline text-sm break-all"
                  >
                    {props.contratoDados["link_parcelamento"] as string}
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          {markingMode ? (
            <div className="rounded-[14px] border border-fysi-line bg-fysi-cream/40 p-3 flex flex-col gap-3">
              <p className="text-xs text-fysi-deep leading-relaxed">
                Marcar contrato como <strong>assinado</strong> manualmente.
                Opcionalmente, cole a URL do PDF assinado pra disponibilizar
                pro cliente baixar (ex: link de Drive ou Autentique).
              </p>
              <Input
                label="URL do PDF assinado (opcional)"
                name="manualSignedUrl"
                value={manualSignedUrl}
                onChange={(e) => setManualSignedUrl(e.target.value)}
                placeholder="https://..."
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMarkingMode(false);
                    setManualSignedUrl("");
                    setError(null);
                  }}
                  disabled={status === "marking"}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={markSigned}
                  disabled={status === "marking"}
                >
                  {status === "marking" ? "Salvando…" : "Confirmar — assinado"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={refresh}
              disabled={status === "refreshing" || markingMode}
            >
              {status === "refreshing" ? "Atualizando…" : "Atualizar status"}
            </Button>
            {props.contratoStatus !== "assinado" && !markingMode ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setMarkingMode(true)}
              >
                Marcar como assinado
              </Button>
            ) : null}
            {props.contratoSignedUrl ? (
              <a
                href={props.contratoSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
              >
                Abrir PDF assinado →
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <form onSubmit={sendContract} className="flex flex-col gap-4">
          <p className="text-sm text-fysi-muted">
            Preencha os dados específicos da proposta. O resto (nome, CPF,
            endereço) vem do cadastro do cliente.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Nome completo do signatário"
              name="signerName"
              required
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Nome completo legal"
              hint={
                props.clientName
                  ? "Vem do cadastro. Edite se quiser o nome legal completo."
                  : "Digite o nome completo legal — salvamos no cliente."
              }
            />
            <Input
              label="E-mail do destinatário"
              name="recipientEmail"
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="cliente@exemplo.com"
              hint={
                props.clientEmail
                  ? "Vem do cadastro. Edite se quiser enviar pra outro."
                  : "Digite o email — salvamos no cliente."
              }
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Pacote"
              name="pacote"
              required
              value={pacote}
              onChange={(e) => setPacote(e.target.value)}
              placeholder="Ex: Fysilab Start"
            />
            <Input
              label="Prazo de execução"
              name="prazo"
              required
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              placeholder="Ex: 06 dias úteis"
            />
          </div>
          <Input
            label="Valor e condição de pagamento"
            name="valor"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex: R$1.800,00 à vista ou 7x de R$260"
          />
          <Textarea
            label="Escopo do projeto"
            name="escopo"
            required
            rows={5}
            value={escopo}
            onChange={(e) => setEscopo(e.target.value)}
            hint="Uma linha por item. Vai entrar logo abaixo do nome do pacote, na proposta."
            placeholder={
              "Página profissional com conteúdo pronto\nDesign responsivo e escaneável\nOtimização de velocidade\nInstalação de pixel e Tags\nPublicação completa + backup"
            }
          />
          <Input
            label="Link de parcelamento (cartão)"
            name="linkParcelamento"
            required
            value={linkPagamento}
            onChange={(e) => setLinkPagamento(e.target.value)}
            placeholder="https://www.asaas.com/c/..."
            hint="Link Asaas (ou outro) gerado pra esse cliente específico."
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              size="md"
              variant="secondary"
              disabled={status === "previewing" || status === "sending"}
              onClick={preview}
            >
              {status === "previewing" ? "Gerando…" : "Pré-visualizar (.docx)"}
            </Button>
            <Button
              type="submit"
              size="md"
              disabled={
                status === "sending" ||
                status === "previewing" ||
                noEmail ||
                noName
              }
            >
              {status === "sending"
                ? "Gerando e enviando…"
                : "Gerar e enviar contrato"}
            </Button>
            <span className="text-xs text-fysi-muted">
              Pré-visualizar baixa o .docx sem enviar — pra você conferir.
            </span>
          </div>
        </form>
      )}
    </section>
  );
}

function humanError(code: string | undefined, details?: string): string {
  switch (code) {
    case "client-missing-email":
      return "Cliente não tem e-mail cadastrado.";
    case "template-not-uploaded":
      return "Modelo não foi enviado. Vá em Contratos → Atualizar modelo.";
    case "autentique-failed":
      return `Autentique recusou: ${details || "verifique o token e o modelo."}`;
    case "save-failed":
      return "Erro ao salvar no banco. Tenta de novo.";
    case "no-contract":
      return "Este cliente ainda não tem contrato gerado.";
    default:
      return `Falha: ${code ?? "erro desconhecido"}`;
  }
}
