import { createSupabaseServiceRoleClient } from "./supabase/server";
import { fetchClickUpProjectStatuses } from "./clickup";
import { logServerError } from "./api-helpers";
import { generateMagicSlug } from "./slug";
import {
  casarProjeto,
  statusPermiteCriar,
  type CandidatoProjeto,
} from "./clickup-projetos-novos";

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
  /** Existiam só no ClickUp e passaram a existir aqui. */
  criados: { projeto: string; status: string }[];
  /** Já existiam aqui sem vínculo e acabaram de ganhar o clickup_task_id. */
  vinculados: { projeto: string; motivo: string }[];
  /** Existem só lá mas não foram criados (ambíguos, arquivados de propósito). */
  naoCriados: { projeto: string; motivo: string }[];
}

export async function sincronizarStatusDosProjetos(): Promise<ResultadoStatusProjetos> {
  const vazio: ResultadoStatusProjetos = {
    ok: false,
    atualizados: [],
    jaEmDia: 0,
    ignorados: 0,
    criados: [],
    vinculados: [],
    naoCriados: [],
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
  /**
   * TODOS os clientes, não só os já vinculados. Os sem vínculo entram como
   * candidatos pra casar com uma tarefa que só existe no ClickUp — sem
   * essa lista, "Karine Serigy" viraria um projeto novo ao lado da Serigy
   * que já está aqui (ela entrou como "Fruteb / Sa").
   */
  const { data, error } = await service
    .from("clients")
    .select(
      "id, nome, empresa, status, clickup_task_id, clickup_nome, nome_exibicao, responsavel, data_inicial, data_vencimento, arquivado_em, responsavel_manual, data_inicial_manual, data_vencimento_manual"
    );
  if (error) {
    logServerError("clickup.status.clients", error);
    return { ...vazio, erro: "Não consegui ler os projetos." };
  }

  interface LinhaCliente {
    id: string;
    nome: string | null;
    empresa: string | null;
    status: string | null;
    clickup_task_id: string | null;
    clickup_nome: string | null;
    nome_exibicao: string | null;
    responsavel: string | null;
    data_inicial: string | null;
    data_vencimento: string | null;
    arquivado_em: string | null;
    responsavel_manual: boolean | null;
    data_inicial_manual: boolean | null;
    data_vencimento_manual: boolean | null;
  }
  const todos = (data ?? []) as LinhaCliente[];
  const clientes = todos.filter(
    (c): c is LinhaCliente & { clickup_task_id: string } => Boolean(c.clickup_task_id)
  );

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
    /**
     * Campo escrito À MÃO no app não é sobrescrito.
     *
     * A lista virou editável em 01/10 e este sync roda todo dia às 9h:
     * sem a trava, a edição duraria até a manhã seguinte e voltaria
     * sozinha — pior do que não deixar editar, porque some sem avisar.
     * Mesma ideia de `nome_exibicao`. Ver migration 20261001120000.
     */
    if (
      doClickUp.responsavel &&
      doClickUp.responsavel !== c.responsavel &&
      !c.responsavel_manual
    ) {
      extras.responsavel = doClickUp.responsavel;
    }
    // As datas do PROJETO moram na tarefa-mãe lá. Sem isso, as colunas
    // Início e Vencimento ficavam vazias em todo projeto cujas subtarefas
    // não têm data — o caso dos quatro parados (28/09).
    if (
      doClickUp.dataInicial &&
      doClickUp.dataInicial !== c.data_inicial &&
      !c.data_inicial_manual
    ) {
      extras.data_inicial = doClickUp.dataInicial;
    }
    if (
      doClickUp.dataVencimento &&
      doClickUp.dataVencimento !== c.data_vencimento &&
      !c.data_vencimento_manual
    ) {
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

  /* ---------------------------------------------------------------- *
   * Projetos que existem no ClickUp e não existem aqui.
   *
   * Até 28/09 o sync criava TAREFA e nunca PROJETO: quem nascia lá nunca
   * chegava aqui, e a lista do app vivia com menos gente que a do
   * ClickUp (faltavam Marplast, Tatiana Garcia, Karine Serigy e Javier
   * Lopes). Pedido da Karine: "crie o que não existe".
   * ---------------------------------------------------------------- */
  const vinculadas = new Set(clientes.map((c) => c.clickup_task_id));
  const candidatos: CandidatoProjeto[] = todos.map((c) => ({
    id: c.id,
    nomes: [c.nome_exibicao, c.clickup_nome, c.empresa, c.nome],
    clickupTaskId: c.clickup_task_id,
    arquivado: Boolean(c.arquivado_em),
  }));

  const criados: ResultadoStatusProjetos["criados"] = [];
  const vinculados: ResultadoStatusProjetos["vinculados"] = [];
  const naoCriados: ResultadoStatusProjetos["naoCriados"] = [];
  const agora = new Date().toISOString();

  for (const t of leitura.statuses) {
    if (vinculadas.has(t.taskId)) continue;
    if (!statusPermiteCriar(t.statusApp, t.statusBruto)) continue;

    const nome = t.nome.replace(/\s+/g, " ").trim();
    const casou = casarProjeto(nome, candidatos);

    if (casou.tipo === "pular") {
      naoCriados.push({ projeto: nome, motivo: casou.motivo });
      continue;
    }

    if (casou.tipo === "vincular") {
      const { error: vincErr } = await service
        .from("clients")
        .update({
          clickup_task_id: t.taskId,
          clickup_nome: t.nome,
          status: t.statusApp,
          ...(t.responsavel ? { responsavel: t.responsavel } : {}),
          ...(t.dataInicial ? { data_inicial: t.dataInicial } : {}),
          ...(t.dataVencimento ? { data_vencimento: t.dataVencimento } : {}),
          updated_at: agora,
        })
        .eq("id", casou.clientId);
      if (vincErr) {
        logServerError("clickup.status.vincular", vincErr);
        naoCriados.push({ projeto: nome, motivo: "erro ao gravar o vínculo" });
        continue;
      }
      vinculadas.add(t.taskId);
      // Já tem dono: sai da lista de candidatos pra não casar de novo.
      const idx = candidatos.findIndex((c) => c.id === casou.clientId);
      if (idx >= 0) candidatos[idx] = { ...candidatos[idx], clickupTaskId: t.taskId };
      vinculados.push({ projeto: nome, motivo: casou.motivo });
      continue;
    }

    /**
     * `whatsapp` e `nome` são NOT NULL no banco, e o ClickUp só tem o
     * nome — o resto (contato, contrato, pagamento) é preenchido aqui
     * depois. `empresa` fica vazia de propósito: todas as telas caem em
     * `empresa || nome`, então o nome do ClickUp é o que aparece.
     */
    const { data: novo, error: criaErr } = await service
      .from("clients")
      .insert({
        nome,
        email: "",
        empresa: "",
        whatsapp: "",
        status: t.statusApp,
        clickup_task_id: t.taskId,
        clickup_nome: t.nome,
        responsavel: t.responsavel,
        data_inicial: t.dataInicial,
        data_vencimento: t.dataVencimento,
        magic_slug: generateMagicSlug({ nome, empresa: null }),
      })
      .select("id")
      .single();
    if (criaErr || !novo) {
      logServerError("clickup.status.criar", criaErr);
      naoCriados.push({ projeto: nome, motivo: "erro ao criar o projeto" });
      continue;
    }
    vinculadas.add(t.taskId);
    candidatos.push({
      id: (novo as { id: string }).id,
      nomes: [nome],
      clickupTaskId: t.taskId,
      arquivado: false,
    });
    criados.push({ projeto: nome, status: t.statusApp });
  }

  return { ok: true, atualizados, jaEmDia, ignorados, criados, vinculados, naoCriados };
}
