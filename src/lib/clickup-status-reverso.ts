import { CLICKUP_STATUS_MAP } from "./clickup";

/**
 * O caminho de VOLTA: status do app → nome do status no ClickUp.
 *
 * Karine (06/10): "se eu coloco algo como feito no app não está
 * sincronizando com o ClickUp" e "aí sempre que todo dia o ClickUp
 * atualiza fica errado".
 *
 * O sync sempre foi de mão única (ClickUp → app). Como o cron roda todo
 * dia às 9h e grava `clients.status` com o que está lá, marcar concluído
 * no app durava até a manhã seguinte e voltava sozinho. Não era "não
 * sincroniza": era a edição sendo DESFEITA em silêncio.
 *
 * ⚠️ `CLICKUP_STATUS_MAP` é de MUITOS-PARA-UM, então reverter exige
 * escolher. "feito", "pendência" e "recorrente" são status das listas de
 * trabalho INTERNO; "completo| entregue", "parado" e "a iniciar" são os da
 * pasta de projetos. Por isso o retorno é uma LISTA ordenada de
 * candidatos: tenta-se o nome da lista de projetos primeiro, e os outros
 * servem de reserva quando a tarefa mora numa lista interna, onde aquele
 * status não existe e o ClickUp recusa com 400.
 */

/** Os nomes de projeto, que vêm primeiro quando há mais de um candidato. */
const PREFERIDO_POR_STATUS: Record<string, string> = {
  "completo-entregue": "completo| entregue",
  parado: "parado",
  "a-iniciar": "a iniciar",
};

/**
 * Nomes de status no ClickUp que correspondem a um status do app, do mais
 * provável pro menos. Lista vazia = o app tem um status que o ClickUp não
 * conhece, e aí não há o que escrever.
 */
export function statusParaClickUp(statusApp: string): string[] {
  const candidatos = Object.entries(CLICKUP_STATUS_MAP)
    .filter(([, app]) => app === statusApp)
    .map(([nomeNoClickUp]) => nomeNoClickUp);

  const preferido = PREFERIDO_POR_STATUS[statusApp];
  if (preferido && candidatos.includes(preferido)) {
    return [preferido, ...candidatos.filter((c) => c !== preferido)];
  }
  return candidatos;
}

/** O status do app é escrevível no ClickUp? */
export function temEquivalenteNoClickUp(statusApp: string): boolean {
  return statusParaClickUp(statusApp).length > 0;
}
