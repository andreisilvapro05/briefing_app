import { createSupabaseServiceRoleClient } from "./supabase/server";
import { fetchClickUpProjectStatuses } from "./clickup";
import { logServerError } from "./api-helpers";

/**
 * Traz do ClickUp o STATUS de cada projeto e atualiza os defasados.
 *
 * Mora aqui, e não dentro da Server Action, porque o cron também precisa
 * chamar — e Server Action exige um membro logado. Antes só o botão da
 * Lista rodava isso, ou seja: o status do projeto só se atualizava quando
 * alguém lembrava de clicar. Foi o que fez a lista do app divergir da do
 * ClickUp (comparação de 28/09: "Pablo" em design lá e "a iniciar" aqui,
 * "Marya" em redação/copy lá e onboarding aqui, e por aí).
 *
 * De ida só: o ClickUp é a fonte da verdade do andamento enquanto a equipe
 * mexer nos dois lugares.
 */

export interface ResultadoStatusProjetos {
  ok: boolean;
  erro?: string;
  atualizados: { projeto: string; de: string; para: string }[];
  jaEmDia: number;
  /** Vinculados a uma tarefa que não é de projeto (ex.: tarefa de briefing). */
  ignorados: number;
}

export async function sincronizarStatusDosProjetos(): Promise<ResultadoStatusProjetos> {
  const vazio: ResultadoStatusProjetos = {
    ok: false,
    atualizados: [],
    jaEmDia: 0,
    ignorados: 0,
  };

  let leitura: Awaited<ReturnType<typeof fetchClickUpProjectStatuses>>;
  try {
    leitura = await fetchClickUpProjectStatuses();
  } catch (err) {
    logServerError("clickup.status.fetch", err);
    return { ...vazio, erro: "Não consegui falar com o ClickUp agora." };
  }
  if ("skipped" in leitura) return { ...vazio, erro: leitura.reason };

  const porTaskId = new Map(leitura.statuses.map((s) => [s.taskId, s]));

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("clients")
    .select("id, nome, empresa, status, clickup_task_id, clickup_nome, responsavel, data_inicial, data_vencimento")
    .not("clickup_task_id", "is", null);
  if (error) {
    logServerError("clickup.status.clients", error);
    return { ...vazio, erro: "Não consegui ler os projetos." };
  }

  const clientes = (data ?? []) as {
    id: string;
    nome: string | null;
    empresa: string | null;
    status: string | null;
    clickup_task_id: string;
    clickup_nome: string | null;
    responsavel: string | null;
    data_inicial: string | null;
    data_vencimento: string | null;
  }[];

  const atualizados: ResultadoStatusProjetos["atualizados"] = [];
  let jaEmDia = 0;
  let ignorados = 0;

  for (const c of clientes) {
    const doClickUp = porTaskId.get(c.clickup_task_id);
    if (!doClickUp) {
      ignorados++; // tarefa de briefing, ou fora do folder de projetos
      continue;
    }
    const novo = doClickUp.statusApp;

    /**
     * Nome e gestor vêm junto, e são gravados MESMO quando o status já
     * está em dia — senão um projeto parado no mesmo status nunca
     * receberia o responsável (Karine, 28/09: "sempre mostra o Andrei
     * como responsável principal, gestor de projetos").
     */
    const extras: Record<string, unknown> = {};
    if (doClickUp.nome && doClickUp.nome !== c.clickup_nome) {
      extras.clickup_nome = doClickUp.nome;
    }
    if (doClickUp.responsavel && doClickUp.responsavel !== c.responsavel) {
      extras.responsavel = doClickUp.responsavel;
    }
    // As datas do PROJETO moram na tarefa-mãe lá. Sem isso, as colunas
    // Início e Vencimento ficavam vazias em todo projeto cujas subtarefas
    // não têm data — o caso dos quatro parados (28/09).
    if (doClickUp.dataInicial && doClickUp.dataInicial !== c.data_inicial) {
      extras.data_inicial = doClickUp.dataInicial;
    }
    if (doClickUp.dataVencimento && doClickUp.dataVencimento !== c.data_vencimento) {
      extras.data_vencimento = doClickUp.dataVencimento;
    }

    /**
     * "Envio de informações" só existe no app, então o sync não pode
     * REBAIXAR um projeto pra `onboarding` por causa disso. Mas preservar
     * pra sempre era pior: projeto que entrava nesse estágio nunca mais
     * avançava sozinho, mesmo com o ClickUp já em design.
     *
     * Foi o caso da Vitória (Karine, 28/09: "design da página, Vitória já
     * enviou as informações"): ela ficou presa aqui enquanto lá já estava
     * em design da página.
     *
     * Agora só segura quando o ClickUp está ATRÁS (a iniciar, onboarding);
     * se lá já andou, o app anda junto.
     */
    const ANTES_DO_ENVIO = ["a-iniciar", "nem-comecou-nada", "onboarding"];
    const seguraEnvio =
      c.status === "envio-informacoes" && ANTES_DO_ENVIO.includes(novo);
    const manterStatus = seguraEnvio || c.status === novo;
    if (manterStatus) {
      if (seguraEnvio) ignorados++;
      else jaEmDia++;
      if (Object.keys(extras).length > 0) {
        await service.from("clients").update(extras).eq("id", c.id);
      }
      continue;
    }

    const { error: updErr } = await service
      .from("clients")
      .update({ ...extras, status: novo, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    if (updErr) {
      logServerError("clickup.status.update", updErr);
      continue;
    }
    atualizados.push({
      projeto: c.empresa?.trim() || c.nome || "(sem nome)",
      de: c.status ?? "—",
      para: novo,
    });
  }

  return { ok: true, atualizados, jaEmDia, ignorados };
}
