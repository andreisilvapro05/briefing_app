/**
 * Links escritos nas observações de uma demanda — viram chips clicáveis.
 *
 * Mora em `lib` e não junto do componente porque é função pura, sem React:
 * assim dá pra verificar as regras dela por teste, e o runner do Node não
 * precisa entender JSX.
 */
/** Links markdown `[nome](url)` do texto — viram chips clicáveis. */
export function extrairLinks(
  texto: string
): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const vistos = new Set<string>();

  const markdown = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = markdown.exec(texto))) {
    if (vistos.has(m[2])) continue;
    vistos.add(m[2]);
    out.push({ label: m[1], url: m[2] });
  }

  // URLs soltas que não fazem parte de um link markdown — o texto antigo é
  // todo assim, e continuar mostrando é melhor que fazer sumir.
  const cru = /https?:\/\/[^\s<>"')\]]+/g;
  while ((m = cru.exec(texto))) {
    const antes = texto.slice(Math.max(0, m.index - 2), m.index);
    if (antes.endsWith("](")) continue;
    // "veja https://drive.google.com/abc." — o ponto é da frase, não da URL.
    // Sem aparar, o chip levava a um endereço que não existe.
    const url = m[0].replace(/[.,;:!?]+$/, "");
    if (!url || vistos.has(url)) continue;
    vistos.add(url);
    out.push({ label: url, url });
  }

  return out;
}
