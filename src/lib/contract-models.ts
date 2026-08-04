import { TRAFEGO_PAGO_DOCX_BASE64 } from "./contract-models/trafego-pago-docx";

/** Tipo mínimo do client Supabase que precisamos (storage download). */
interface StorageCapable {
  storage: {
    from: (bucket: string) => {
      download: (
        path: string
      ) => Promise<{ data: Blob | null; error: unknown }>;
    };
  };
}

/**
 * Modelos de contrato disponíveis. Cada um é um .docx com tags {{...}}.
 * - "padrao": o modelo enviado pelo admin no storage (landing/site/etc).
 * - "trafego": contrato de gestão de anúncios, embutido no código (base64).
 */

export type ContractModelId = "padrao" | "trafego";

export interface ContractModelDef {
  id: ContractModelId;
  label: string;
  descricao: string;
  source: "storage" | "embedded";
  storageFile?: string;
  base64?: string;
}

export const CONTRACT_MODELS: ContractModelDef[] = [
  {
    id: "padrao",
    label: "Padrão (landing / site / projeto)",
    descricao:
      "Modelo que você subiu em Contratos. Usa pacote, valor, prazo e escopo.",
    source: "storage",
    storageFile: "modelo.docx",
  },
  {
    id: "trafego",
    label: "Tráfego Pago (gestão de anúncios)",
    descricao:
      "Contrato mensal de gestão de anúncios (Meta/Google). Já pronto no sistema.",
    source: "embedded",
    base64: TRAFEGO_PAGO_DOCX_BASE64,
  },
];

export function getContractModel(id: string | undefined): ContractModelDef {
  return (
    CONTRACT_MODELS.find((m) => m.id === id) ?? CONTRACT_MODELS[0]
  );
}

/**
 * Carrega o buffer do .docx do modelo. Retorna null se for "storage" e o
 * arquivo ainda não foi enviado.
 */
export async function loadContractTemplateBuffer(
  model: ContractModelDef,
  service: StorageCapable
): Promise<Buffer | null> {
  if (model.source === "embedded" && model.base64) {
    return Buffer.from(model.base64, "base64");
  }
  if (model.source === "storage" && model.storageFile) {
    const { data, error } = await service.storage
      .from("contracts-templates")
      .download(model.storageFile);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  return null;
}

/**
 * Vars específicas do contrato de Tráfego Pago, com defaults sensatos pros
 * campos que no modelo original eram [•].
 */
export function trafegoVars(body: {
  valorMensal?: string;
  diaPagamento?: string;
  formaPagamento?: string;
  avisoPrevio?: string;
  multaRescisao?: string;
  cidadeForo?: string;
}): Record<string, string> {
  return {
    valor_mensal:
      body.valorMensal?.trim() || "R$ 1.500,00 (mil e quinhentos reais)",
    dia_pagamento: body.diaPagamento?.trim() || "10",
    forma_pagamento: body.formaPagamento?.trim() || "Pix",
    aviso_previo: body.avisoPrevio?.trim() || "15 (quinze)",
    multa_rescisao: body.multaRescisao?.trim() || "20",
    cidade_foro: body.cidadeForo?.trim() || "Taió/SC",
  };
}
