/**
 * Tipos do modelo de dados do app.
 *
 * Espelha o schema Supabase quando ele for criado em M2.
 * Por ora, esses tipos guiam o que vai/volta de localStorage.
 */

export type ProjectType =
  | "landing-com-copy"
  | "landing-sem-copy"
  | "site-completo"
  | "seo"
  /**
   * Tráfego pago. Não é projeto de página: não tem copy, design nem
   * implementação, e por isso não entra na lista de Projetos — sai numa
   * visão própria. Karine (28/09): "a Carla é de tráfego, precisaremos
   * separar uma aba para esses clientes".
   */
  | "trafego"
  | "outro";

export interface ProjectTypeOption {
  id: ProjectType;
  title: string;
  description: string;
  durationLabel: string;
  hasCopyStep: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  // Email e empresa migraram pra etapa /contrato — opcionais até preencher.
  email?: string;
  empresa?: string;
  whatsapp: string;
  projectType?: ProjectType;
  createdAt: string;
  updatedAt: string;
}

/**
 * Etapas do projeto contratado, exibidas como timeline para o cliente.
 * Geradas dinamicamente em função do ProjectType escolhido.
 */
export type EtapaStatus = "pendente" | "em-andamento" | "concluida";

export interface EtapaProjeto {
  numero: number;
  titulo: string;
  prazo: string;
  atividades: string[];
  status: EtapaStatus;
}

export type BlocoStatus = "nao-iniciado" | "em-andamento" | "concluido";

export interface BlocoBriefing {
  id: string;
  titulo: string;
  descricao: string;
  status: BlocoStatus;
  campos: number;
  preenchidos: number;
}
