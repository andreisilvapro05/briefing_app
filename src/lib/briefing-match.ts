/**
 * Casa o nome da página do ClickUp ("Briefing Dra leticia", "Sofia Rito |
 * Setembro 2026", "Ethos - jéssica") com um cliente do app.
 *
 * Regra de ouro: ERRAR O VÍNCULO É PIOR QUE NÃO VINCULAR. Um briefing
 * pendurado no cliente errado aparece na ficha errada e pode ser aberto por
 * quem só deveria ver aquele projeto. Quando a confiança é baixa o briefing
 * entra como avulso (client_id null) e a equipe vincula na mão — que agora
 * é possível, já que briefing deixou de ser filho obrigatório da ficha.
 */

export interface ClienteRef {
  id: string;
  nome: string | null;
  empresa: string | null;
}

export interface Palpite {
  clientId: string | null;
  confianca: "alta" | "media" | "nenhuma";
  /** Por que casou — aparece no relatório da importação. */
  motivo: string;
}

/** minúsculas, sem acento, sem pontuação, espaços colapsados. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RUIDO = new Set([
  "briefing",
  "novo",
  "brief",
  "dr",
  "dra",
  "sr",
  "sra",
  "de",
  "da",
  "do",
  "dos",
  "das",
  "e",
  "advogado",
  "advogados",
  "advocacia",
  "ltda",
  "me",
  "eireli",
  "sociedade",
  "individual",
  "pagina",
  "paginas",
  "captura",
  "anuncios",
  "site",
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]);

function tokens(s: string): string[] {
  return normalizar(s)
    .split(" ")
    .filter((t) => t.length >= 3 && !RUIDO.has(t) && !/^\d+$/.test(t));
}

/**
 * Casa por interseção de tokens significativos. Exige token raro em comum
 * — "silva" sozinho não basta, por isso tokens que aparecem em vários
 * clientes valem menos.
 */
export function casarCliente(
  nomePagina: string,
  clientes: ClienteRef[]
): Palpite {
  const alvo = tokens(nomePagina);
  if (alvo.length === 0)
    return { clientId: null, confianca: "nenhuma", motivo: "sem nome útil" };

  // Frequência de cada token entre os clientes — token que aparece em
  // muitos clientes ("advocacia", "clinica") não identifica ninguém.
  const freq = new Map<string, number>();
  const porCliente = clientes.map((c) => {
    const t = new Set([
      ...tokens(c.empresa ?? ""),
      ...tokens(c.nome ?? ""),
    ]);
    for (const tok of t) freq.set(tok, (freq.get(tok) ?? 0) + 1);
    return { cliente: c, tokens: t };
  });

  let melhor: { cliente: ClienteRef; score: number; comuns: string[] } | null =
    null;
  let segundo = 0;

  for (const { cliente, tokens: tset } of porCliente) {
    const comuns = alvo.filter((t) => tset.has(t));
    if (comuns.length === 0) continue;
    // Token único no workspace vale 1; token repetido vale menos.
    const score = comuns.reduce(
      (acc, t) => acc + 1 / (freq.get(t) ?? 1),
      0
    );
    if (!melhor || score > melhor.score) {
      if (melhor) segundo = melhor.score;
      melhor = { cliente, score, comuns };
    } else if (score > segundo) {
      segundo = score;
    }
  }

  if (!melhor)
    return { clientId: null, confianca: "nenhuma", motivo: "nenhum cliente parecido" };

  const rotulo = melhor.cliente.empresa || melhor.cliente.nome || "cliente";
  // Empate técnico (ex.: duas "Carla") → não arrisca.
  if (segundo > 0 && melhor.score - segundo < 0.35) {
    return {
      clientId: null,
      confianca: "nenhuma",
      motivo: `ambíguo entre 2+ clientes (${melhor.comuns.join(", ")})`,
    };
  }

  const nomeNorm = normalizar(nomePagina);
  const empresaNorm = normalizar(melhor.cliente.empresa ?? "");
  if (empresaNorm && (nomeNorm === empresaNorm || nomeNorm.includes(empresaNorm))) {
    return { clientId: melhor.cliente.id, confianca: "alta", motivo: `empresa "${rotulo}"` };
  }
  if (melhor.score >= 0.9) {
    return {
      clientId: melhor.cliente.id,
      confianca: "alta",
      motivo: `${melhor.comuns.join(" + ")} → ${rotulo}`,
    };
  }
  if (melhor.score >= 0.45) {
    return {
      clientId: melhor.cliente.id,
      confianca: "media",
      motivo: `${melhor.comuns.join(" + ")} → ${rotulo}`,
    };
  }
  return {
    clientId: null,
    confianca: "nenhuma",
    motivo: `parecido demais com vários (${melhor.comuns.join(", ")})`,
  };
}
