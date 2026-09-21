import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { lerBearer, validarChave } from "@/lib/api-keys";
import {
  TASK_STATUS_GROUP,
  TASK_STATUS_OPTIONS,
  type TaskStatus,
} from "@/lib/project-tasks";

/**
 * GET /api/demandas — leitura das demandas abertas, pra um app externo
 * (o "Segundo cérebro") montar a Home de quem é dono da chave.
 *
 * Contrato combinado com o consumidor:
 *   { "demandas": [ { id, titulo, cliente, status, prazo, url } ] }
 *
 *   - `id` é estável entre chamadas (é o uuid da linha, não índice);
 *   - `prazo` em AAAA-MM-DD ou null;
 *   - `url` abre a demanda dentro deste app;
 *   - sem chave → 401; sem resultado → 200 com lista vazia (nunca 404).
 *
 * Sem CORS de propósito: quem chama é servidor, não navegador. Liberar
 * origem só aumentaria a superfície.
 *
 * O recorte NÃO vem do chamador: quem define o que sai é o dono da chave.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TETO = 200;

const LABEL_STATUS = new Map(TASK_STATUS_OPTIONS.map((o) => [o.value, o.label]));

/** Status "ativo" da taxonomia — é o que o consumidor chama de aberta. */
const ABERTOS = TASK_STATUS_OPTIONS.filter(
  (o) => TASK_STATUS_GROUP[o.value] === "ativo"
).map((o) => o.value);

/** Domínio real — o env.appUrl aponta pro *.vercel.app, que não serve de link. */
const DOMINIO_PADRAO = "https://app.fysilabdigital.com.br";

/**
 * Base absoluta do link. Sem o fallback, uma requisição sem header de host
 * geraria `url` RELATIVA ("/admin/..."), e um consumidor que (com razão)
 * só aceita http(s) descartaria o link — o nome da demanda deixaria de ser
 * clicável sem nenhum erro aparecer.
 */
function baseUrlDe(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return DOMINIO_PADRAO;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  // Só http/https saem daqui: o link é clicado dentro do app de quem lê.
  const limpo = proto === "http" || proto === "https" ? proto : "https";
  return `${limpo}://${host}`;
}

function semCache(res: NextResponse): NextResponse {
  // Resposta é por chave e muda o tempo todo — nada de cache compartilhado.
  res.headers.set("Cache-Control", "no-store, private");
  return res;
}

export async function GET(req: NextRequest) {
  const token = lerBearer(req.headers.get("authorization"));
  if (!token) {
    return semCache(
      NextResponse.json(
        { error: "unauthorized", detail: "Envie Authorization: Bearer <chave>." },
        { status: 401 }
      )
    );
  }

  const chave = await validarChave(token, "demandas:read");
  if (!chave) {
    // Mesma resposta pra chave inexistente, revogada ou de outro escopo —
    // não conta ao chamador em qual dos casos ele caiu.
    return semCache(
      NextResponse.json({ error: "unauthorized" }, { status: 401 })
    );
  }

  // Chave sem dono não enxerga nada. Lista vazia, não erro: o consumidor
  // trata "sem demanda" e "sem permissão" do mesmo jeito na Home.
  if (!chave.responsavel) {
    return semCache(NextResponse.json({ demandas: [] }, { status: 200 }));
  }

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("project_tasks")
    .select("id, titulo, status, data_vencimento, client_id, clients(nome, empresa)")
    .eq("responsavel", chave.responsavel)
    .in("status", ABERTOS)
    // Prazo mais próximo primeiro; sem prazo vai pro fim.
    .order("data_vencimento", { ascending: true, nullsFirst: false })
    .limit(TETO);

  if (error) {
    return semCache(
      NextResponse.json({ error: "upstream" }, { status: 502 })
    );
  }

  const base = baseUrlDe(req);
  const linhas =
    (data as unknown as
      | {
          id: string;
          titulo: string;
          status: TaskStatus | null;
          data_vencimento: string | null;
          client_id: string | null;
          clients: { nome: string | null; empresa: string | null } | null;
        }[]
      | null) ?? [];

  const demandas = linhas.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    cliente: t.clients?.empresa?.trim() || t.clients?.nome?.trim() || null,
    status: t.status ? (LABEL_STATUS.get(t.status) ?? t.status) : null,
    // A coluna é `date`, então já chega AAAA-MM-DD; o slice protege caso
    // algum driver devolva timestamp.
    prazo: t.data_vencimento ? t.data_vencimento.slice(0, 10) : null,
    url: t.client_id
      ? `${base}/admin/${t.client_id}?tab=tarefas#tarefa-${t.id}`
      : `${base}/admin/meu-trabalho`,
  }));

  return semCache(NextResponse.json({ demandas }, { status: 200 }));
}
