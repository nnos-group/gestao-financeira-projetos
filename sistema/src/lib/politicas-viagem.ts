/**
 * Políticas de Viagens e Reembolso do Ecossistema NNÓS
 * Premissa de Negócio: O viajante deve verificar para qual empresa estará viajando.
 * Caso a empresa contratante não possua política própria, a política utilizada é a da NNÓS.
 */

export interface PoliticaViagemItem {
  id: string;
  empresa: string;
  titulo: string;
  descricao: string;
  vigencia: string;
  miniaturaUrl: string;
  pdfUrl: string;
  tag: string;
  corTag: string;
}

export const POLITICAS_VIAGEM: PoliticaViagemItem[] = [
  {
    id: "nnos",
    empresa: "NNÓS Consultoria",
    titulo: "Política de Viagens 2025",
    descricao: "Regra geral oficial da NNÓS utilizada quando o cliente não tiver política própria.",
    vigencia: "Prazo indeterminado",
    miniaturaUrl: "/politicas/politica-nnos.jpg",
    pdfUrl: "/politicas/politica-nnos.pdf",
    tag: "Padrão NNÓS (Regra Geral)",
    corTag: "#0d9488",
  },
  {
    id: "cnh",
    empresa: "CNH Training",
    titulo: "Política de Viagens Corporativas",
    descricao: "Limites de despesas com alimentação, hospedagem e deslocamentos da CNH.",
    vigencia: "Efetivo a partir de 11/05/2026",
    miniaturaUrl: "/politicas/politica-cnh.jpg",
    pdfUrl: "/politicas/politica-cnh.pdf",
    tag: "Cliente CNH",
    corTag: "#1e3a8a",
  },
  {
    id: "iveco",
    empresa: "Iveco Group",
    titulo: "Guia Rápido de Viagens",
    descricao: "Diretrizes e limites para deslocamentos e diárias a serviço do Iveco Group.",
    vigencia: "Vigente desde Dez/2023",
    miniaturaUrl: "/politicas/politica-iveco.jpg",
    pdfUrl: "/politicas/politica-iveco.pdf",
    tag: "Cliente Iveco",
    corTag: "#0284c7",
  },
  {
    id: "reembolso-nnos",
    empresa: "NNÓS Consultoria",
    titulo: "Política de Reembolso (Vexpenses)",
    descricao: "Instruções passo a passo para prestação de contas pelo aplicativo móvel Vexpenses.",
    vigencia: "Vigente",
    miniaturaUrl: "/politicas/politica-reembolso-nnos.jpg",
    pdfUrl: "/politicas/politica-reembolso-nnos.pdf",
    tag: "App Vexpenses",
    corTag: "#059669",
  },
];
