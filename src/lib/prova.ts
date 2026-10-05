/**
 * Banco de prova — regras puras, sem servidor nenhum.
 *
 * PRD de 05/10, módulo 1: "cada projeto entregue vira prova organizada e
 * autorizada (antes e depois, depoimento, resultado com fonte), pronta
 * para conteúdo, proposta e lançamento, sem depender da memória da
 * Karine".
 *
 * Moram aqui as duas regras que o PRD trata como inegociáveis e que são as
 * que mais fácil se perdem numa tela: **resultado só com fonte e data** e
 * **nada sai como público sem nível de autorização registrado**. As duas
 * também estão no banco (CHECK), porque a tela não é o único caminho de
 * escrita — mas é aqui que a mensagem pro humano nasce.
 */

export type ProofStatus =
  | "a_coletar"
  | "coletado"
  | "conferido"
  | "aprovado_para_uso"
  | "usado"
  | "sem_autorizacao"
  | "arquivado";

export const PROOF_STATUS_OPTIONS: { value: ProofStatus; label: string }[] = [
  { value: "a_coletar", label: "A coletar" },
  { value: "coletado", label: "Cliente enviou" },
  { value: "conferido", label: "Equipe conferiu" },
  { value: "aprovado_para_uso", label: "Aprovado para uso" },
  { value: "usado", label: "Já usado" },
  { value: "sem_autorizacao", label: "Sem autorização" },
  { value: "arquivado", label: "Arquivado" },
];

/** Vermelho só pro que é ruim: "sem autorização" é o único impeditivo. */
export const PROOF_STATUS_TOM: Record<ProofStatus, string> = {
  a_coletar: "bg-fysi-cream text-fysi-muted border-fysi-line",
  coletado: "bg-sky-50 text-sky-700 border-sky-200",
  conferido: "bg-amber-50 text-amber-800 border-amber-200",
  aprovado_para_uso: "bg-fysi-mint/40 text-fysi-deep border-fysi-mint",
  usado: "bg-lime-50 text-lime-800 border-lime-200",
  sem_autorizacao: "bg-red-50 text-red-700 border-red-200",
  arquivado: "bg-fysi-deep/[0.04] text-fysi-muted border-fysi-line",
};

export function statusLabel(s: ProofStatus | string): string {
  return PROOF_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? String(s);
}

/** 1, 2, 3 — ver a migration. O texto é o que a equipe lê antes de usar. */
export type NivelAutorizacao = 1 | 2 | 3;

export const NIVEIS: {
  nivel: NivelAutorizacao;
  titulo: string;
  descricao: string;
}[] = [
  {
    nivel: 1,
    titulo: "Uso interno",
    descricao: "Só em proposta para novos clientes. Não aparece em público.",
  },
  {
    nivel: 2,
    titulo: "Site e nome da empresa",
    descricao: "Pode mostrar o site feito e o nome da empresa.",
  },
  {
    nivel: 3,
    titulo: "Conteúdo e anúncio",
    descricao:
      "Pode usar nome, foto, depoimento e marca em conteúdo público e anúncio.",
  },
];

export function nivelLabel(n: NivelAutorizacao | null): string {
  if (!n) return "Sem autorização registrada";
  const x = NIVEIS.find((v) => v.nivel === n);
  return x ? `Nível ${n} — ${x.titulo}` : `Nível ${n}`;
}

export interface Prova {
  id: string;
  clientId: string;
  cliente: string;
  status: ProofStatus;
  segmento: string | null;
  servico: string | null;
  cidade: string | null;
  siteUrl: string | null;
  depoimentoTexto: string | null;
  depoimentoAudioPath: string | null;
  depoimentoTranscricao: string | null;
  nota: number | null;
  autorizacaoNivel: NivelAutorizacao | null;
  autorizacaoTermo: string | null;
  autorizadoPor: string | null;
  autorizadoEm: string | null;
  resultadoTexto: string | null;
  resultadoFonte: string | null;
  resultadoData: string | null;
  tags: string[];
  usadoEm: UsoDaProva[];
  conferidoPor: string | null;
  conferidoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
  assets: ProofAsset[];
}

export type TipoDeUso = "post" | "proposta" | "pagina" | "anuncio";

export const TIPOS_DE_USO: { value: TipoDeUso; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "proposta", label: "Proposta" },
  { value: "pagina", label: "Página" },
  { value: "anuncio", label: "Anúncio" },
];

export interface UsoDaProva {
  tipo: TipoDeUso;
  link: string | null;
  data: string;
}

export type TipoDeAsset = "antes" | "depois" | "print" | "logo" | "foto" | "video";
export type Dispositivo = "desktop" | "celular";

export interface ProofAsset {
  id: string;
  tipo: TipoDeAsset;
  dispositivo: Dispositivo | null;
  capturadoEm: string | null;
  storagePath: string;
  legenda: string | null;
  origem: "upload" | "automatico";
  ordem: number;
}

/* ── As duas regras que o PRD trata como inegociáveis ─────────────────── */

export interface ResultadoCru {
  texto: string;
  fonte: string;
  data: string;
}

/**
 * "Resultado só com fonte e data. Campo vazio é melhor que número sem
 * origem."
 *
 * Um número sem origem é pior do que nenhum: vira slide, vira anúncio, e
 * ninguém lembra de onde saiu quando um cliente pergunta. Devolve a
 * mensagem pro humano; `null` = pode gravar.
 */
export function problemaNoResultado(r: ResultadoCru): string | null {
  const texto = r.texto.trim();
  const fonte = r.fonte.trim();
  const data = r.data.trim();

  // Apagar o resultado inteiro é sempre permitido.
  if (!texto && !fonte && !data) return null;
  if (!texto) return "Escreva o resultado — fonte e data sozinhas não dizem nada.";
  if (!fonte) {
    return "Diga de onde veio o número (Clarity, Search Console, relato do cliente, CRM).";
  }
  if (!data) return "Diga de quando é o número.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "Data do resultado inválida.";
  return null;
}

/**
 * Esta prova pode aparecer num uso deste tipo?
 *
 * A regra do PRD é "nada sai como público sem nível registrado". Os três
 * níveis não são uma escala solta: eles respondem a perguntas diferentes.
 *   - proposta: basta o nível 1 (uso interno).
 *   - página: precisa poder mostrar o site e o nome (nível 2).
 *   - post e anúncio: precisam do depoimento e da marca em público (3).
 */
export function podeUsarEm(
  nivel: NivelAutorizacao | null,
  tipo: TipoDeUso
): boolean {
  if (!nivel) return false;
  if (tipo === "proposta") return nivel >= 1;
  if (tipo === "pagina") return nivel >= 2;
  return nivel >= 3;
}

/** O que falta pra esta prova poder ser usada em público (nível 3). */
export function faltaParaPublico(p: Prova): string[] {
  const faltas: string[] = [];
  if (!p.autorizacaoNivel) faltas.push("autorização do cliente");
  else if (p.autorizacaoNivel < 3) faltas.push("autorização de nível 3");
  if (!p.depoimentoTexto?.trim() && !p.depoimentoTranscricao?.trim()) {
    faltas.push("depoimento");
  }
  if (!p.assets.some((a) => a.tipo === "depois")) faltas.push("print do depois");
  return faltas;
}

/** Antes e depois lado a lado — o par que a tela desenha. */
export function paresAntesDepois(assets: ProofAsset[]): {
  dispositivo: Dispositivo;
  antes: ProofAsset | null;
  depois: ProofAsset | null;
}[] {
  const dispositivos: Dispositivo[] = ["desktop", "celular"];
  return dispositivos.map((d) => ({
    dispositivo: d,
    antes:
      assets.find((a) => a.tipo === "antes" && a.dispositivo === d) ?? null,
    depois:
      assets.find((a) => a.tipo === "depois" && a.dispositivo === d) ?? null,
  }));
}

/* ── Filtros da lista ─────────────────────────────────────────────────── */

export interface FiltroDeProva {
  status?: string;
  segmento?: string;
  servico?: string;
  /** "1" | "2" | "3" | "sem" */
  nivel?: string;
}

/**
 * "A equipe filtra provas 'aprovadas para uso, nível 3, segmento saúde' em
 * uma tela" — critério de aceite do PRD, por isso é função pura e testada.
 */
export function filtrarProvas(provas: Prova[], f: FiltroDeProva): Prova[] {
  return provas.filter((p) => {
    if (f.status && p.status !== f.status) return false;
    if (f.segmento && (p.segmento ?? "") !== f.segmento) return false;
    if (f.servico && (p.servico ?? "") !== f.servico) return false;
    if (f.nivel) {
      if (f.nivel === "sem") return p.autorizacaoNivel === null;
      if (String(p.autorizacaoNivel ?? "") !== f.nivel) return false;
    }
    return true;
  });
}

/** Os valores que aparecem num filtro — só os que existem de verdade. */
export function valoresDe(
  provas: Prova[],
  campo: "segmento" | "servico"
): string[] {
  const vistos = new Set<string>();
  for (const p of provas) {
    const v = p[campo]?.trim();
    if (v) vistos.add(v);
  }
  return [...vistos].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * O texto do depoimento que vale: o escrito ganha da transcrição.
 *
 * Quem digitou escolheu as palavras; a transcrição é o rascunho que o
 * áudio virou. Mostrar os dois lado a lado numa lista seria ruído.
 */
export function depoimentoDe(p: Prova): string | null {
  return p.depoimentoTexto?.trim() || p.depoimentoTranscricao?.trim() || null;
}

/* ── O termo que o cliente aceita ─────────────────────────────────────── */

/**
 * ⚠️ TEXTO PROVISÓRIO — a Karine precisa revisar antes de valer.
 *
 * O PRD lista "o texto do termo de autorização em cada nível" como
 * pendência a decidir, e escrever termo de uso de imagem não é decisão de
 * quem programa. O que está aqui descreve em português claro exatamente o
 * que cada nível permite, segundo o próprio PRD — serve pra feature
 * funcionar ponta a ponta e pra ela trocar as palavras sem mexer em mais
 * nada.
 *
 * O termo aceito é GRAVADO junto da autorização (`autorizacao_termo`), não
 * lido daqui na hora de exibir: se o texto mudar amanhã, a autorização de
 * ontem continua mostrando o que a pessoa realmente aceitou. Sem isso, uma
 * edição de texto reescreveria o passado de todo mundo.
 */
export const TERMO_POR_NIVEL: Record<NivelAutorizacao, string> = {
  1: "Autorizo a Fysi Lab Digital a mostrar o trabalho feito para mim em propostas enviadas a possíveis clientes. Não autorizo uso em conteúdo público nem em anúncio.",
  2: "Autorizo a Fysi Lab Digital a mostrar o site/página que fez para mim e o nome da minha empresa em materiais de divulgação. Não autorizo uso da minha imagem pessoal nem do meu depoimento em anúncio pago.",
  3: "Autorizo a Fysi Lab Digital a usar o nome da minha empresa, minha marca, minha foto e o depoimento que escrevi em conteúdo público e em anúncios pagos, por tempo indeterminado. Posso pedir a retirada a qualquer momento.",
};

export interface RespostaDoCliente {
  depoimento: string;
  nota: string;
  nivel: string;
}

/**
 * O que impede gravar a resposta do cliente. `null` = pode.
 *
 * O nível é obrigatório e o depoimento não: há cliente que autoriza mostrar
 * o site e não quer escrever nada, e isso é uma resposta legítima — já a
 * autorização sem nível não significa coisa alguma.
 */
export function problemaNaResposta(r: RespostaDoCliente): string | null {
  const nivel = Number(r.nivel);
  if (!r.nivel || ![1, 2, 3].includes(nivel)) {
    return "Escolha até onde a gente pode usar.";
  }
  if (r.nota.trim()) {
    const n = Number(r.nota);
    if (!Number.isInteger(n) || n < 0 || n > 10) {
      return "A nota vai de 0 a 10.";
    }
  }
  return null;
}
