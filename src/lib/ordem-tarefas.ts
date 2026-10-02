/**
 * Onde entra uma tarefa criada a partir de OUTRA tarefa.
 *
 * Karine (01/10): "ao passar o mouse pela tarefa ou subtarefa ter um + para
 * adicionar uma tarefa". O "+" da linha do PROJETO joga a tarefa no fim da
 * lista, e tudo bem — é o "+ Add task" do rodapé, só mais perto. Já o "+"
 * de uma TAREFA quer dizer "mais uma aqui, junto desta": cair no fim, vinte
 * linhas abaixo, é o mesmo que a tarefa ter sumido.
 *
 * `project_tasks.ordem` é um inteiro por cliente, e o banco não garante que
 * ele seja único nem contínuo (o seed do checklist, o sync do ClickUp e o
 * arrasto escrevem nele por caminhos diferentes). Por isso esta função
 * RENUMERA a lista inteira de 0 a n em vez de tentar abrir um buraco no
 * meio: abrir buraco depende de os números estarem bem-comportados, e com
 * ordem repetida a tarefa nova nasceria empatada com outra — ficando acima
 * ou abaixo por sorte do banco.
 */

export interface LinhaOrdenada {
  id: string;
  ordem: number;
}

export interface Insercao {
  /** `ordem` que a tarefa nova recebe. */
  ordemNova: number;
  /** Só as linhas cuja `ordem` precisa mudar — as outras não são tocadas. */
  mover: LinhaOrdenada[];
}

/**
 * Calcula a posição de uma tarefa nova logo DEPOIS de `depoisDe`.
 *
 * Devolve `null` quando a referência não está na lista: significa que ela
 * foi apagada ou é de outro cliente, e aí quem chama cai no comportamento
 * de sempre (jogar no fim) em vez de gravar uma posição inventada.
 *
 * A ordenação de entrada é estável: empate em `ordem` é resolvido pela
 * posição que a linha já ocupava no array, que é a ordem em que o banco a
 * devolveu — a mesma que a tela está mostrando.
 */
export function reordenarComInsercao(
  linhas: LinhaOrdenada[],
  depoisDe: string
): Insercao | null {
  const ordenadas = linhas
    .map((l, i) => ({ ...l, i }))
    .sort((a, b) => a.ordem - b.ordem || a.i - b.i);

  const alvo = ordenadas.findIndex((l) => l.id === depoisDe);
  if (alvo < 0) return null;

  const ordemNova = alvo + 1;
  const mover: LinhaOrdenada[] = [];
  for (let pos = 0; pos < ordenadas.length; pos++) {
    const linha = ordenadas[pos];
    // Quem está antes da referência mantém a posição; quem está depois
    // desce uma casa pra abrir espaço.
    const nova = pos <= alvo ? pos : pos + 1;
    if (linha.ordem !== nova) mover.push({ id: linha.id, ordem: nova });
  }

  return { ordemNova, mover };
}
