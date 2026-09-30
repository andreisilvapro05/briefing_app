import Link from "next/link";
import { Eyebrow } from "@/components/ui/pill";
import { CopyButton } from "./copy-button";

/**
 * Os links do cliente, num lugar só.
 *
 * Karine (2026-09-30): "a ficha de cada cliente precisa ser melhor, com
 * as informações mais relevantes... link do drive, link EI e briefing,
 * acessos, pagamento".
 *
 * Eles existiam todos — espalhados por seis abas. Pra mandar a pasta do
 * Drive pro cliente era preciso lembrar que ela mora na aba Drive; a EI
 * ficava na aba EI; o link do painel, no fim da aba Geral. Aqui a ficha
 * responde de relance "o que eu mando pra essa pessoa".
 *
 * O que ainda não existe aparece igual, apagado e clicável, levando pra
 * aba onde se cria — some da tela seria fingir que o cliente não precisa
 * daquilo.
 */

export interface LinkDoCliente {
  rotulo: string;
  /** Endereço externo (Drive, painel do cliente). */
  href?: string | null;
  /** Rota interna do próprio admin (documento de EI, aba). */
  interno?: string | null;
  /** Texto de quando não existe — e pra onde ir pra criar. */
  vazio: string;
  ondeCriar: string;
  /** Link de mandar pro cliente ganha botão de copiar. */
  copiavel?: boolean;
}

export function LinksDoCliente({ links }: { links: LinkDoCliente[] }) {
  return (
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-6">
      <Eyebrow>Links e acessos</Eyebrow>
      <p className="text-xs text-fysi-muted mt-1 mb-3">
        O que se manda pra este cliente, e onde o trabalho dele mora.
      </p>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {links.map((l) => {
          const destino = l.href || l.interno;
          return (
            <li
              key={l.rotulo}
              className={`flex items-center gap-2 rounded-[12px] border px-3 py-2 ${
                destino
                  ? "border-fysi-line bg-fysi-cream/25"
                  : "border-dashed border-fysi-line bg-white"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[0.66rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  {l.rotulo}
                </p>
                {destino ? (
                  l.href ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-fysi-deep hover:underline truncate block"
                      title={l.href}
                    >
                      Abrir →
                    </a>
                  ) : (
                    <Link
                      href={l.interno as string}
                      className="text-sm text-fysi-deep hover:underline truncate block"
                    >
                      Abrir →
                    </Link>
                  )
                ) : (
                  <Link
                    href={l.ondeCriar}
                    className="text-sm text-fysi-muted hover:text-fysi-deep hover:underline truncate block"
                  >
                    {l.vazio}
                  </Link>
                )}
              </div>
              {l.copiavel && l.href ? (
                <CopyButton value={l.href} label="Copiar" />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
