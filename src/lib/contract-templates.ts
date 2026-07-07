/**
 * Pacotes padrão da Fysi pra preenchimento rápido do contrato.
 *
 * Editar aqui pra ajustar valores/escopo. No futuro pode virar tabela
 * no Supabase com UI de gerenciamento — por ora, hardcoded resolve.
 */

export interface ContractTemplate {
  id: string;
  label: string;
  pacote_nome: string;
  valor_parcelamento: string;
  prazo_execucao: string;
  escopo_projeto: string;
  // Link de parcelamento fica vazio porque é gerado por cliente no Asaas.
  link_parcelamento?: string;
}

export const STANDARD_TEMPLATES: ContractTemplate[] = [
  {
    id: "fysilab-start",
    label: "🚀 Fysilab Start (landing simples)",
    pacote_nome: "Fysilab Start",
    valor_parcelamento: "R$1.800,00 à vista ou 7x de R$260",
    prazo_execucao: "06 dias úteis",
    escopo_projeto: [
      "Página profissional com conteúdo pronto",
      "Design responsivo e escaneável",
      "Otimização de velocidade",
      "Instalação de pixel e Tags",
      "Publicação completa + backup",
    ].join("\n"),
  },
  {
    id: "fysilab-pro-copy",
    label: "✨ Fysilab Pro com Copy (landing + copy estratégica)",
    pacote_nome: "Fysilab Pro com Copy",
    valor_parcelamento: "R$2.300,00 à vista ou 7x de R$420",
    prazo_execucao: "12 dias úteis",
    escopo_projeto: [
      "Copy estratégica escrita pela Fysi (Karine)",
      "Validação de copy com cliente antes do design",
      "Design responsivo (mobile + desktop)",
      "Otimização de velocidade",
      "Instalação de pixel e Tags",
      "3 rodadas de ajustes inclusas",
      "Publicação + backup",
    ].join("\n"),
  },
  {
    id: "site-completo",
    label: "🏗️ Site completo (múltiplas páginas)",
    pacote_nome: "Site completo",
    valor_parcelamento: "R$4.500,00 à vista ou 10x de R$490",
    prazo_execucao: "20 dias úteis",
    escopo_projeto: [
      "Até 5 páginas com copy estratégica",
      "Design responsivo (mobile + desktop)",
      "Otimização de velocidade e SEO básico",
      "Instalação de pixel e Tags",
      "3 rodadas de ajustes inclusas",
      "Publicação + backup + documentação",
    ].join("\n"),
  },
  {
    id: "seo-mensal",
    label: "📈 SEO mensal (recorrente)",
    pacote_nome: "SEO Fysi",
    valor_parcelamento: "R$1.500,00 / mês — fidelidade mínima 3 meses",
    prazo_execucao: "Recorrente (mensal)",
    escopo_projeto: [
      "Auditoria técnica completa no início",
      "Otimização on-page mensal",
      "2 conteúdos otimizados por mês",
      "Acompanhamento de rankings",
      "Relatório mensal de tráfego e conversões",
    ].join("\n"),
  },
];

export function getTemplateById(id: string): ContractTemplate | undefined {
  return STANDARD_TEMPLATES.find((t) => t.id === id);
}
