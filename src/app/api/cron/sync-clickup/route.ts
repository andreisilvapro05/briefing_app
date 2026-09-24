import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { isProduction, logServerError } from "@/lib/api-helpers";
import {
  preencherDonosPadrao,
  sincronizarTarefasDoClickUp,
} from "@/lib/clickup-tasks-sync";

/**
 * Cron: traz do ClickUp o que mudou lá — prazo, responsável e status das
 * tarefas de projeto.
 *
 * Pedido da Karine (23/09), com um print do ClickUp ao lado: "tem coisas
 * desatualizadas... atualize uma ou duas vezes por dia por enquanto". Até
 * aqui a única forma de sincronizar era alguém clicar no botão da Lista, e
 * ninguém clica todo dia.
 *
 * É de IDA só: ClickUp → app. Enquanto a equipe mexer nos dois lugares, o
 * ClickUp é a fonte da verdade do andamento; escrever de volta arriscaria
 * sobrescrever o que alguém acabou de mudar lá.
 *
 * ## Ativar
 *
 * 1. `CLICKUP_API_TOKEN` e `CLICKUP_PROJECTS_FOLDER_ID` na Vercel. **Sem o
 *    token esta rota não faz nada** e devolve o motivo — é o que acontece
 *    hoje (ver memory/limitacao_vercel_briefing_app.md).
 * 2. `CRON_SECRET` na Vercel (a Vercel Cron manda como Bearer).
 * 3. `vercel.json` já traz o agendamento: 12h UTC = 9h em Brasília, todo
 *    dia. Ela pediu "uma ou duas vezes por dia"; é UMA porque o plano
 *    Hobby da Vercel só aceita cron diário — um `0 12,18 * * 1-5` faz a
 *    Vercel recusar o vercel.json e PARAR de construir a cada push, sem
 *    sequer registrar um deploy com erro. Foi o que travou o deploy por
 *    12h em 24/09. Se um dia o projeto virar Pro, dá pra voltar a duas.
 *
 * ## Segurança
 *
 * Esta rota ESCREVE no banco. Em produção sem `CRON_SECRET` ela recusa —
 * falha fechada, mesmo critério do cron de contratos. Fora de produção
 * segue liberada pra facilitar teste.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Sem `maxDuration` por ora. Eu tinha posto 60 e, quando um build falhou,
// culpei esse valor — era falso: o erro era espaço em branco no
// CRON_SECRET. Fica de fora até existir um deploy verde e uma execução
// observada; se o sync estourar o tempo padrão, aí sim se decide entre
// subir o teto (respeitando o limite do plano) ou paginar em lotes.

export async function GET(request: NextRequest) {
  try {
    getServerEnv();
  } catch {
    return NextResponse.json({ mode: "demo", ok: true });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (isProduction()) {
      logServerError(
        "cron.sync-clickup",
        new Error("CRON_SECRET ausente em produção — rota recusada")
      );
      return NextResponse.json({ error: "cron-secret-missing" }, { status: 503 });
    }
  } else {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const sync = await sincronizarTarefasDoClickUp();
    if (!sync.ok) {
      // Falta de token não é erro de servidor: é configuração pendente, e
      // devolver 500 encheria o log de alarme falso todo dia.
      logServerError("cron.sync-clickup", new Error(sync.reason ?? "sync falhou"));
      return NextResponse.json({ ok: false, motivo: sync.reason }, { status: 200 });
    }

    // Tarefa que voltou sem dono ganha o dono padrão do tipo dela. Só toca
    // linha com responsável nulo — nunca reatribui o que já tem gente.
    const donos = await preencherDonosPadrao();

    return NextResponse.json({
      ok: true,
      vinculadas: sync.vinculadas,
      criadas: sync.criadas,
      prazoAtualizado: sync.prazoAtualizado,
      statusAtualizado: sync.statusAtualizado,
      responsavelDefinido: sync.responsavelDefinido,
      internasCriadas: sync.internasCriadas,
      ignoradasSemPrazo: sync.ignoradasSemPrazo,
      semCorrespondencia: sync.semCorrespondencia,
      donosPreenchidos: donos.preenchidas,
      semDono: donos.restantesSemDono,
    });
  } catch (err) {
    logServerError("cron.sync-clickup", err);
    return NextResponse.json({ error: "sync-failed" }, { status: 500 });
  }
}
