export interface PessoaItem {
  id: string;
  nome: string;
  nome_completo: string;
  tipo: "parceiro" | "funcionario" | "socio";
  perfil: string;
  email: string;
  telefone?: string;
  cargo?: string;
  ativo?: boolean;
  tipo_medicao?: "QUINZENAL" | "INTEGRAL";
  
  // Viagens & Logística (Pessoa Física)
  cpf?: string;
  rg?: string;
  data_nascimento?: string;
  cidade_base?: string;
  aeroporto_preferencial?: string;
  
  // Empresa Prestadora de Serviços (Pessoa Jurídica)
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  inscricao_municipal?: string;
  endereco_empresa?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  pix?: string;
  contrato_ativo?: string;
  valor_hora_padrao?: number;
}

// Carrega base real cruzada (Sócios oficiais, Funcionários ativos Anexo 4 e Consultores/Parceiros PJ)
import baseJson from "./consultores-base.json";

export const PESSOAS_INICIAIS: PessoaItem[] = baseJson as PessoaItem[];
