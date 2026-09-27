"use client";

import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/ui/pill";

/**
 * "O que ainda falta você nos enviar", no painel do cliente.
 *
 * A lista existe desde 22/09 e tinha zero uso porque só aparecia dentro do
 * link público do briefing, ligado em 1 de 35 clientes. Aqui ela fica na
 * porta que o cliente usa todo dia.
 *
 * Marcar é DECLARAÇÃO dele ("mandei"), não recebimento: o item marcado
 * continua na lista, como "a equipe vai conferir". Some da lista só quando
 * a equipe confirma, no admin.
 */

interface Item {
  id: string;
  titulo: string;
  instrucao: string | null;
  status: "pendente" | "enviado" | "nao_se_aplica";
  recadoDoCliente: string | null;
}

export function MateriaisPendentesCard({ clientId }: { clientId: string }) {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/me/materiais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    })
      .then((r) => (r.ok ? r.json() : { itens: [] }))
      .then((d) => {
        if (vivo) setItens(d.itens ?? []);
      })
      .catch(() => {
        if (vivo) setItens([]);
      });
    return () => {
      vivo = false;
    };
  }, [clientId]);

  async function marcar(item: Item) {
    const novo = item.status === "enviado" ? "pendente" : "enviado";
    setSalvando(item.id);
    setErro(false);
    // Otimista: a lista responde na hora e volta atrás se o servidor recusar.
    setItens((atual) =>
      (atual ?? []).map((i) => (i.id === item.id ? { ...i, status: novo } : i))
    );
    try {
      const r = await fetch("/api/me/materiais", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, itemId: item.id, status: novo }),
      });
      if (!r.ok) throw new Error("falhou");
    } catch {
      setErro(true);
      setItens((atual) =>
        (atual ?? []).map((i) =>
          i.id === item.id ? { ...i, status: item.status } : i
        )
      );
    } finally {
      setSalvando(null);
    }
  }

  // Nada pra pedir: o card não aparece. Cliente não precisa ver caixa vazia.
  if (!itens || itens.length === 0) return null;

  const pendentes = itens.filter((i) => i.status === "pendente");
  const aConferir = itens.filter((i) => i.status === "enviado");
  if (pendentes.length === 0 && aConferir.length === 0) return null;

  return (
    <section className="rounded-[20px] border border-fysi-line bg-white p-5">
      <Eyebrow className="mb-1 block">O que precisamos de você</Eyebrow>
      <p className="text-sm text-fysi-muted mb-4">
        {pendentes.length > 0
          ? `Faltam ${pendentes.length} ${pendentes.length === 1 ? "item" : "itens"} pra gente seguir com o seu projeto.`
          : "Tudo enviado. Vamos conferir e seguir."}
      </p>

      <ul className="flex flex-col gap-2">
        {[...pendentes, ...aConferir].map((i) => {
          const enviado = i.status === "enviado";
          return (
            <li
              key={i.id}
              className="flex items-start gap-3 rounded-[12px] border border-fysi-line px-3 py-2.5"
            >
              <button
                type="button"
                disabled={salvando === i.id}
                onClick={() => marcar(i)}
                aria-pressed={enviado}
                aria-label={
                  enviado ? `Desmarcar ${i.titulo}` : `Marcar ${i.titulo} como enviado`
                }
                className={`mt-0.5 h-5 w-5 shrink-0 rounded-[6px] border grid place-items-center transition disabled:opacity-50 ${
                  enviado
                    ? "bg-fysi-deep border-fysi-deep text-fysi-cream"
                    : "border-fysi-line-strong hover:border-fysi-deep"
                }`}
              >
                {enviado ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
                    <path d="M4 12.5l5.5 5.5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </button>
              <div className="min-w-0">
                <p
                  className={`text-sm ${enviado ? "text-fysi-muted" : "text-fysi-deep font-medium"}`}
                >
                  {i.titulo}
                </p>
                {i.instrucao ? (
                  <p className="text-[0.78rem] text-fysi-muted mt-0.5">
                    {i.instrucao}
                  </p>
                ) : null}
                {enviado ? (
                  <p className="text-[0.7rem] text-fysi-muted mt-1">
                    marcado como enviado — a equipe vai conferir
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {erro ? (
        <p role="alert" className="text-xs text-red-700 mt-3">
          Não consegui salvar. Confira a conexão e tente de novo.
        </p>
      ) : null}
    </section>
  );
}
