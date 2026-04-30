/**
 * Tipos do modelo de dados do app.
 *
 * Espelha o schema Supabase quando ele for criado em M2.
 * Por ora, esses tipos guiam o que vai/volta de localStorage.
 */

export type ProjectType =
  | "landing-com-copy"
  | "landing-sem-copy"
  | "site-completo";

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
  email: string;
  empresa: string;
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
