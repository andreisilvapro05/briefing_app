import { createSupabaseServiceRoleClient } from "./supabase/server";

/**
 * Páginas do app que uma demanda pode apontar.
 *
 * Pedido da Karine (2026-09-21), com print do ClickUp ao lado: lá a tarefa
 * "Copy LP Raynna" carrega as páginas "EI - Raynna Felix" e "Rayanna", o
 * drive da cliente e o contexto. Aqui a demanda tinha um link solto de
 * "Criar Estrutura Inicial" e um campo de notas — quem pegava a tarefa
 * precisava caçar no menu onde estava o briefing daquele cliente.
 *
 * "é dentro do app que criamos": o destino desses links é interno, não uma
 * URL externa colada na mão.
 */

export interface LinkTarget {
  /** Chave estável — usada como `key` de lista e pra ordenar. */
  id: string;
  label: string;
  href: string;
  /**
   * false = a página ainda não existe (ex.: cliente sem Estrutura Inicial).
   * O chip então convida a criar em vez de levar a um id vazio.
   */
  existe: boolean;
  /** Agrupa o menu: o que é daquele cliente vem antes do que é geral. */
  grupo: "cliente" | "geral";
}

function comKey(href: string, keyParam: string): string {
  if (!keyParam) return href;
  return href.includes("?")
    ? `${href}&${keyParam.replace(/^\?/, "")}`
    : `${href}${keyParam}`;
}

/**
 * Monta os destinos de uma demanda. `clientId` nulo = demanda interna da
 * agência, que não tem ficha nem documentos — sobram os destinos gerais.
 */
export async function listTaskLinkTargets(
  clientId: string | null,
  keyParam = ""
): Promise<LinkTarget[]> {
  const gerais: LinkTarget[] = [
    {
      id: "processos",
      label: "Processos da agência",
      href: comKey("/admin/processos", keyParam),
      existe: true,
      grupo: "geral",
    },
    {
      id: "demandas",
      label: "Demandas internas",
      href: comKey("/admin/demandas", keyParam),
      existe: true,
      grupo: "geral",
    },
  ];

  if (!clientId) return gerais;

  const service = createSupabaseServiceRoleClient();
  const [{ data: clienteRow }, { data: docsRows }] = await Promise.all([
    service
      .from("clients")
      .select("nome, empresa, magic_slug, fysi_drive_link, cliente_drive_link")
      .eq("id", clientId)
      .maybeSingle(),
    service
      .from("ei_documents")
      .select("id, kind")
      .eq("client_id", clientId),
  ]);

  const cliente = clienteRow as {
    nome: string | null;
    empresa: string | null;
    magic_slug: string | null;
    fysi_drive_link: string | null;
    cliente_drive_link: string | null;
  } | null;
  if (!cliente) return gerais;

  const docs = (docsRows as { id: string; kind: string }[] | null) ?? [];
  const ei = docs.find((d) => d.kind === "ei");
  const briefing = docs.find((d) => d.kind === "briefing");
  const quem = cliente.empresa?.trim() || cliente.nome?.trim() || "cliente";

  const doCliente: LinkTarget[] = [
    {
      id: "ei",
      label: `Estrutura Inicial — ${quem}`,
      href: ei
        ? comKey(`/admin/estruturas-iniciais/${ei.id}`, keyParam)
        : comKey("/admin/estruturas-iniciais", keyParam),
      existe: Boolean(ei),
      grupo: "cliente",
    },
    {
      id: "briefing",
      label: `Briefing — ${quem}`,
      href: briefing
        ? comKey(`/admin/briefings/doc/${briefing.id}`, keyParam)
        : comKey(`/admin/${clientId}?tab=briefing`, keyParam),
      existe: Boolean(briefing),
      grupo: "cliente",
    },
    {
      id: "ficha",
      label: `Ficha de ${quem}`,
      href: comKey(`/admin/${clientId}`, keyParam),
      existe: true,
      grupo: "cliente",
    },
    {
      id: "moodboard",
      label: "Moodboard",
      href: comKey(`/admin/${clientId}?tab=moodboard`, keyParam),
      existe: true,
      grupo: "cliente",
    },
    {
      id: "entrega",
      label: "Documento de entrega",
      href: comKey(`/admin/${clientId}?tab=entrega`, keyParam),
      existe: true,
      grupo: "cliente",
    },
  ];

  // Drives são link externo salvo na ficha — só entram quando existem, pra
  // não oferecer um chip que não leva a lugar nenhum.
  if (cliente.fysi_drive_link) {
    doCliente.push({
      id: "drive-fysi",
      label: "Drive da Fysi",
      href: cliente.fysi_drive_link,
      existe: true,
      grupo: "cliente",
    });
  }
  if (cliente.cliente_drive_link) {
    doCliente.push({
      id: "drive-cliente",
      label: "Drive do cliente",
      href: cliente.cliente_drive_link,
      existe: true,
      grupo: "cliente",
    });
  }
  if (cliente.magic_slug) {
    doCliente.push({
      id: "painel",
      label: "Painel do cliente (o que ele vê)",
      href: `/painel/${cliente.magic_slug}`,
      existe: true,
      grupo: "cliente",
    });
  }

  return [...doCliente, ...gerais];
}
