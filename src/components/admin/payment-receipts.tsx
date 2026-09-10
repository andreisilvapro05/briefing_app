import {
  FORMAS_PAGAMENTO,
  FORMA_LABEL,
  somaRecebida,
  type PaymentReceipt,
} from "@/lib/payment-receipts";
import {
  addPaymentReceiptAction,
  deletePaymentReceiptAction,
} from "@/app/admin/[id]/actions";
import { SubmitButton, SubmitTextButton } from "./submit-button";
import { Eyebrow } from "@/components/ui/pill";

/**
 * Comprovantes de pagamento do cliente.
 *
 * Resolve um problema concreto da operação: cliente que paga no Pix manda o
 * print no grupo do WhatsApp, o comprovante some na conversa e semanas
 * depois ninguém sabe se pagou — alguém tem que caçar o histórico. Aqui a
 * prova fica junto do valor e da data, e registrar já atualiza quanto o
 * cliente pagou (era o passo manual que ficava pra trás).
 */
export function PaymentReceipts({
  clientId,
  urlKey,
  recibos,
  pagamentoPago,
  formatMoney,
  formatDateShort,
}: {
  clientId: string;
  urlKey?: string;
  recibos: PaymentReceipt[];
  /** `clients.pagamento_pago` — pra apontar divergência com a soma dos comprovantes. */
  pagamentoPago: number;
  formatMoney: (v: number) => string;
  formatDateShort: (iso: string) => string;
}) {
  const soma = somaRecebida(recibos);
  // Pagamento lançado à mão antes desta tela existir não tem comprovante.
  const semComprovante = Math.max(0, pagamentoPago - soma);
  const hoje = new Date().toISOString().slice(0, 10);
  const campo =
    "rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40";
  const rotulo =
    "text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium";

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <Eyebrow>Comprovantes</Eyebrow>
        {recibos.length > 0 ? (
          <span className="text-xs text-fysi-muted">
            {recibos.length} registro{recibos.length === 1 ? "" : "s"} ·{" "}
            <strong className="text-fysi-deep">{formatMoney(soma)}</strong>
          </span>
        ) : null}
      </div>
      <p className="text-sm text-fysi-muted mb-4">
        Quando o cliente paga por fora do link (Pix, transferência), registre
        aqui com o print. Assim ninguém precisa caçar o comprovante na
        conversa pra saber se já foi pago.
      </p>

      {recibos.length > 0 ? (
        <ul className="flex flex-col gap-2 mb-5">
          {recibos.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-fysi-line bg-fysi-cream/30 px-3 py-2.5"
            >
              <span className="font-semibold tabular-nums text-fysi-green">
                {formatMoney(Number(r.valor))}
              </span>
              <span className="rounded-full bg-white border border-fysi-line px-2 py-0.5 text-[0.68rem] font-medium text-fysi-deep">
                {FORMA_LABEL[r.forma] ?? r.forma}
              </span>
              <span className="text-xs text-fysi-muted tabular-nums">
                {formatDateShort(r.pago_em)}
              </span>
              {r.observacao ? (
                <span className="text-xs text-fysi-muted truncate max-w-[16rem]">
                  {r.observacao}
                </span>
              ) : null}
              {r.registrado_por ? (
                <span className="text-[0.68rem] text-fysi-muted/80">
                  por {r.registrado_por}
                </span>
              ) : null}

              <span className="ml-auto flex items-center gap-3">
                {r.arquivo_path ? (
                  <a
                    href={`/api/admin/comprovantes/${r.id}${
                      urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-fysi-deep hover:underline"
                  >
                    Ver comprovante
                  </a>
                ) : (
                  <span
                    className="text-xs text-amber-700"
                    title="Registrado sem anexo"
                  >
                    sem anexo
                  </span>
                )}
                <form action={deletePaymentReceiptAction}>
                  {urlKey ? (
                    <input type="hidden" name="key" value={urlKey} />
                  ) : null}
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="receiptId" value={r.id} />
                  <SubmitTextButton
                    danger
                    pendingLabel="Removendo…"
                    confirm={`Remover o comprovante de ${formatMoney(
                      Number(r.valor)
                    )}? O arquivo também é apagado.`}
                  >
                    remover
                  </SubmitTextButton>
                </form>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {semComprovante > 0.009 ? (
        <p className="mb-5 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {formatMoney(semComprovante)} do valor pago foi lançado à mão, sem
          comprovante anexado. Se tiver o print, registre abaixo — o total não
          é somado duas vezes.
        </p>
      ) : null}

      <form
        action={addPaymentReceiptAction}
        className="grid gap-3 sm:grid-cols-2"
      >
        <input type="hidden" name="clientId" value={clientId} />
        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}

        <label className="flex flex-col gap-1">
          <span className={rotulo}>Valor recebido (R$)</span>
          <input
            name="valor"
            required
            inputMode="decimal"
            placeholder="2400,00"
            className={campo}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={rotulo}>Data do pagamento</span>
          <input name="pagoEm" type="date" defaultValue={hoje} className={campo} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={rotulo}>Forma</span>
          <select name="forma" defaultValue="pix" className={campo}>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={rotulo}>Comprovante (print ou PDF)</span>
          <input
            name="arquivo"
            type="file"
            accept="image/*,application/pdf"
            className="text-sm text-fysi-deep file:mr-3 file:rounded-full file:border-0 file:bg-fysi-cream file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-fysi-mint"
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={rotulo}>Observação (opcional)</span>
          <input
            name="observacao"
            placeholder="Ex: entrada de 50%, restante na entrega"
            className={campo}
          />
        </label>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          <SubmitButton size="sm" pendingLabel="Registrando…">
            Registrar pagamento
          </SubmitButton>
          <span className="text-[0.72rem] text-fysi-muted">
            Registrar já atualiza o valor pago do cliente.
          </span>
        </div>
      </form>
    </section>
  );
}
