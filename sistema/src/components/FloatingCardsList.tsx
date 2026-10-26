"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import DocumentPreviewModal from "./viagens/DocumentPreviewModal";
import { ViagemSolicitacao, AnexoDocumento } from "@/lib/viagens-types";
import { calcularPrazoPrestacaoContas, formatarPeriodoBR } from "@/lib/date-utils";
import { calcularValoresAtividade, verificarEhSocio, verificarEhComissao } from "@/lib/tabela-precos-calculator";
import { AgendaBloqueio, verificarConflitoBloqueio } from "@/lib/agenda-bloqueios";

export type ViagemItem = {
  id: string;
  agencia: string | null;
  custo_1: number; // Passagem
  custo_2: number; // Hotel
  custo_3: number; // Carro
  custo_4: number; // Seguro/Outros
  custo_5: number; // Diária/Alimentação
  total: number;
  observacao_agencia: string | null;
};

export type LancamentoItem = {
  id: string;
  competencia: string;
  projeto_id?: string | null;
  consultor_id?: string | null;
  atividade: string | null;
  modalidade: "PRESENCIAL" | "VIRTUAL" | null;
  local: string | null;
  regiao: "BRA" | "LATAM";
  data_inicial: string | null;
  data_final: string | null;
  perfil: string | null;
  horas: number | null;
  faturar: number | null;
  repasse: number | null;
  custo_consultor: number | null;
  status: string | null;
  precisa_logistica: boolean | null;
  projetos: {
    nome: string;
    centros_custo?: {
      codigo: string;
      contrato?: string | null;
      areas: { nome: string } | null;
      lideres: { nome: string } | null;
    } | null;
  } | null;
  consultores: {
    nome: string;
    tipo?: "socio" | "parceiro" | "funcionario";
  } | null;
  viagens: ViagemItem[] | ViagemItem | null;
  notas_debito?: { id?: string; destino: string; numero: string | null; valor?: number | null }[] | null;
};

export type FaturaLogisticaItem = {
  id?: string;
  numeroNota: string;
  projeto: string;
  valor: number;
  realizado?: string;
  status?: string;
};

const brl = (val: number | null | undefined) =>
  val != null
    ? val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";

const dataBR = (d: string | null) => {
  if (!d) return "—";
  const [ano, mes, dia] = d.split("-");
  return `${dia}/${mes}/${ano}`;
};

const iniciais = (nome: string) => {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
};

const capitalizarAtividade = (str: string | null | undefined): string => {
  if (!str) return "Atividade Operacional";
  const minusculas = new Set([
    "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos",
    "a", "o", "as", "os", "para", "por", "com", "sem", "ou",
    "en", "del", "la", "las", "el", "los", "y", "con"
  ]);

  const siglas = new Set([
    "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
    "cx", "ti", "rh", "ead", "cc", "br", "bra", "latam", "ops", "kpi", "xl", "xls"
  ]);

  return str
    .toLowerCase()
    .split(/\s+/)
    .map((palavra, index) => {
      if (!palavra) return "";
      const limpa = palavra.replace(/^[^\wáàâãéèêíïóôõöúçñ]+|[^\wáàâãéèêíïóôõöúçñ]+$/gi, "");
      if (siglas.has(limpa.toLowerCase())) {
        return palavra.toUpperCase();
      }
      if (index > 0 && minusculas.has(limpa.toLowerCase())) {
        return palavra.toLowerCase();
      }
      return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
    })
    .join(" ");
};

const statusClasse = (status: string | null | undefined): string => {
  const s = (status || "").toUpperCase();
  if (s.includes("REALIZ")) return "realizado";
  if (s.includes("CONFIRM")) return "confirmado";
  if (s.includes("CANCEL")) return "cancelado";
  if (s.includes("PREV")) return "previsto";
  return "";
};

const formatarMoedaValor = (val: number | null | undefined): string => {
  if (val == null || isNaN(val)) return "";
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const tratarInputMoeda = (e: React.ChangeEvent<HTMLInputElement>) => {
  const digits = e.target.value.replace(/\D/g, "");
  if (!digits) {
    e.target.value = "";
    return;
  }
  const num = parseInt(digits, 10) / 100;
  e.target.value = num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseMoeda = (valStr: string | null): number | null => {
  if (!valStr || !valStr.trim()) return null;
  const limpo = valStr.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return isNaN(n) ? null : n;
};

function compararProjetos(a: LancamentoItem, b: LancamentoItem): number {
  const nomeA = (a.projetos?.nome || "").trim().toUpperCase();
  const nomeB = (b.projetos?.nome || "").trim().toUpperCase();

  const isAdmA = nomeA.includes("ADM") || nomeA.includes("ADMINISTRA");
  const isAdmB = nomeB.includes("ADM") || nomeB.includes("ADMINISTRA");

  if (isAdmA && !isAdmB) return 1;
  if (!isAdmA && isAdmB) return -1;

  const comp = nomeA.localeCompare(nomeB, "pt-BR");
  if (comp !== 0) return comp;

  const dataA = a.data_inicial || "";
  const dataB = b.data_inicial || "";
  if (dataA !== dataB) return dataA.localeCompare(dataB);

  return (a.atividade || "").localeCompare(b.atividade || "", "pt-BR");
}

function parseLogisticaObservacao(obs: string | null | undefined, defaults: {
  passageiroNome?: string;
  passageiroDoc?: string;
  destino?: string;
  dataInicial?: string;
  dataFinal?: string;
} = {}) {
  const res = {
    passageiroNome: defaults.passageiroNome || "",
    passageiroDoc: defaults.passageiroDoc || "",
    tipoViagem: "Sozinho" as "Sozinho" | "Acompanhado",
    acompanhanteNome: "",
    acompanhanteDoc: "",
    obsGeral: "",
    aereoOrigem: "",
    aereoDestino: defaults.destino || "",
    aereoDataIda: defaults.dataInicial || "",
    aereoPrefIda: "Manhã",
    aereoDataVolta: defaults.dataFinal || "",
    aereoPrefVolta: "Noite",
    aereoObs: "",
    hotelRegiao: defaults.destino || "",
    hotelCheckin: defaults.dataInicial || "",
    hotelCheckout: defaults.dataFinal || "",
    hotelObs: "",
    veiculoLocacao: "Não" as "Sim" | "Não",
    veiculoRetiradaLocal: "",
    veiculoDataRetirada: "",
    veiculoDataDevolucao: "",
    veiculoCategoria: "Econômico com Ar",
    veiculoObs: "",
  };

  if (!obs || typeof obs !== "string") return res;

  if (!obs.includes("[")) {
    res.obsGeral = obs.trim();
    return res;
  }

  // Extrair PASSAGEIRO
  const passMatch = obs.match(/\[PASSAGEIRO\]\s*(.*?)(?=\n|\[|$)/i);
  if (passMatch) {
    const pStr = passMatch[1];
    const nomeM = pStr.match(/Nome:\s*([^|]+)/i);
    if (nomeM && nomeM[1].trim() && nomeM[1].trim() !== "Não informado") res.passageiroNome = nomeM[1].trim();
    const docM = pStr.match(/Documento:\s*([^|]+)/i);
    if (docM && docM[1].trim() && docM[1].trim() !== "N/A") res.passageiroDoc = docM[1].trim();
    const viagemM = pStr.match(/Viagem:\s*([^|]+)/i);
    if (viagemM && (viagemM[1].trim() === "Sozinho" || viagemM[1].trim() === "Acompanhado")) {
      res.tipoViagem = viagemM[1].trim() as "Sozinho" | "Acompanhado";
    }
    const obsM = pStr.match(/OBS:\s*([^|]+)/i);
    if (obsM && obsM[1].trim() && obsM[1].trim() !== "Nenhuma") res.obsGeral = obsM[1].trim();
  }

  // Extrair ACOMPANHANTE
  const acompMatch = obs.match(/\[ACOMPANHANTE\]\s*(.*?)(?=\n|\[|$)/i);
  if (acompMatch) {
    res.tipoViagem = "Acompanhado";
    const acStr = acompMatch[1];
    const acNomeM = acStr.match(/Nome:\s*([^|]+)/i);
    if (acNomeM) res.acompanhanteNome = acNomeM[1].trim();
    const acDocM = acStr.match(/Documento:\s*([^|]+)/i);
    if (acDocM) res.acompanhanteDoc = acDocM[1].trim();
  }

  // Extrair AÉREO
  const aereoMatch = obs.match(/\[AÉREO\]\s*(.*?)(?=\n|\[|$)/i);
  if (aereoMatch) {
    const aeStr = aereoMatch[1];
    const origM = aeStr.match(/Origem:\s*([^->|]+)/i);
    if (origM && origM[1].trim() !== "N/A") res.aereoOrigem = origM[1].trim();
    const destM = aeStr.match(/Destino:\s*([^|]+)/i);
    if (destM && destM[1].trim() !== "N/A") res.aereoDestino = destM[1].trim();
    const idaM = aeStr.match(/Ida:\s*([^\s(]+)(?:\s*\(([^)]+)\))?/i);
    if (idaM && idaM[1].trim() !== "N/A") {
      res.aereoDataIda = idaM[1].trim();
      if (idaM[2]) res.aereoPrefIda = idaM[2].trim();
    }
    const voltaM = aeStr.match(/Volta:\s*([^\s(]+)(?:\s*\(([^)]+)\))?/i);
    if (voltaM && voltaM[1].trim() !== "N/A") {
      res.aereoDataVolta = voltaM[1].trim();
      if (voltaM[2]) res.aereoPrefVolta = voltaM[2].trim();
    }
    const aeObsM = aeStr.match(/OBS:\s*([^|]+)/i);
    if (aeObsM && aeObsM[1].trim() !== "Nenhuma") res.aereoObs = aeObsM[1].trim();
  }

  // Extrair HOTEL
  const hotelMatch = obs.match(/\[HOTEL\]\s*(.*?)(?=\n|\[|$)/i);
  if (hotelMatch) {
    const htStr = hotelMatch[1];
    const regM = htStr.match(/Região:\s*([^|]+)/i);
    if (regM && regM[1].trim() !== "N/A") res.hotelRegiao = regM[1].trim();
    const cinM = htStr.match(/Check-in:\s*([^|]+)/i);
    if (cinM && cinM[1].trim() !== "N/A") res.hotelCheckin = cinM[1].trim();
    const coutM = htStr.match(/Check-out:\s*([^|]+)/i);
    if (coutM && coutM[1].trim() !== "N/A") res.hotelCheckout = coutM[1].trim();
    const htObsM = htStr.match(/OBS:\s*([^|]+)/i);
    if (htObsM && htObsM[1].trim() !== "Nenhuma") res.hotelObs = htObsM[1].trim();
  }

  // Extrair VEÍCULO
  const veiMatch = obs.match(/\[VEÍCULO ALUGADO\]\s*(.*?)(?=\n|\[|$)/i);
  if (veiMatch) {
    res.veiculoLocacao = "Sim";
    const vStr = veiMatch[1];
    const locM = vStr.match(/Local Retirada:\s*([^|]+)/i);
    if (locM && locM[1].trim() !== "N/A") res.veiculoRetiradaLocal = locM[1].trim();
    const retM = vStr.match(/Retirada:\s*([^|]+)/i);
    if (retM && retM[1].trim() !== "N/A") res.veiculoDataRetirada = retM[1].trim();
    const devM = vStr.match(/Devolução:\s*([^|]+)/i);
    if (devM && devM[1].trim() !== "N/A") res.veiculoDataDevolucao = devM[1].trim();
    const catM = vStr.match(/Categoria:\s*([^|]+)/i);
    if (catM && catM[1].trim() !== "N/A") res.veiculoCategoria = catM[1].trim();
    const vObsM = vStr.match(/OBS:\s*([^|]+)/i);
    if (vObsM && vObsM[1].trim() !== "Nenhuma") res.veiculoObs = vObsM[1].trim();
  }

  return res;
}

function formatarObservacoesAgenciaCard(obsBruta?: string | null): string {
  if (!obsBruta || !obsBruta.trim()) return "Nenhuma instrução adicional registrada.";

  // Se não contém tags estruturadas [PASSAGEIRO], [AÉREO], etc., é uma observação simples
  if (!obsBruta.includes("[")) {
    return `"${obsBruta.trim()}"`;
  }

  const parsed = parseLogisticaObservacao(obsBruta);
  const partes: string[] = [];

  if (parsed.aereoObs && parsed.aereoObs.trim() && parsed.aereoObs.trim().toLowerCase() !== "nenhuma") {
    partes.push(`Aéreo: ${parsed.aereoObs.trim()}`);
  }
  if (parsed.hotelObs && parsed.hotelObs.trim() && parsed.hotelObs.trim().toLowerCase() !== "nenhuma") {
    partes.push(`Hotel: ${parsed.hotelObs.trim()}`);
  }
  if (parsed.veiculoObs && parsed.veiculoObs.trim() && parsed.veiculoObs.trim().toLowerCase() !== "nenhuma") {
    partes.push(`Veículo: ${parsed.veiculoObs.trim()}`);
  }
  if (parsed.obsGeral && parsed.obsGeral.trim() && parsed.obsGeral.trim().toLowerCase() !== "nenhuma") {
    partes.push(`Geral: ${parsed.obsGeral.trim()}`);
  }

  if (partes.length === 0) {
    return "Nenhuma instrução adicional registrada.";
  }

  return `"${partes.join(" | ")}"`;
}

export default function FloatingCardsList({
  itens,
  competencia,
  todosProjetos = [],
  todosConsultores = [],
  faturasLogistica = [],
  solicitacoesViagem = [],
  headerTopContent,
}: {
  itens: LancamentoItem[];
  competencia?: string;
  todosProjetos?: { id: string; nome: string; centro_custo_codigo?: string | null; centro_custo_contrato?: string | null }[];
  todosConsultores?: {
    id: string;
    nome: string;
    nome_completo?: string;
    documento?: string;
    cpf?: string;
    rg?: string;
    perfil?: string;
    tipo?: string;
    cidade_base?: string;
    aeroporto_preferencial?: string;
    origem?: string;
  }[];
  faturasLogistica?: FaturaLogisticaItem[];
  solicitacoesViagem?: ViagemSolicitacao[];
  headerTopContent?: React.ReactNode;
}) {
  const router = useRouter();
  const [lista, setLista] = useState<LancamentoItem[]>(itens);
  const [previewVoucherDoc, setPreviewVoucherDoc] = useState<AnexoDocumento | null>(null);
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<string | null>(null);
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [busca, setBusca] = useState("");
  const [filtroInstrutor, setFiltroInstrutor] = useState("");
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroLogistica, setFiltroLogistica] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  // Estados para Atividade e Local com formatação e sugestões
  const [atividadeTexto, setAtividadeTexto] = useState("");
  const [localTexto, setLocalTexto] = useState("");
  const [perfilSelecionado, setPerfilSelecionado] = useState("");
  const [novaDataInicial, setNovaDataInicial] = useState("");
  const [novaDataFinal, setNovaDataFinal] = useState("");
  const [novaHoras, setNovaHoras] = useState<string>("");
  const [novaRegiao, setNovaRegiao] = useState<"BRA" | "LATAM">("BRA");
  const [novoCustoConsultor, setNovoCustoConsultor] = useState<string>("");
  const [novoFaturar, setNovoFaturar] = useState<string>("");

  // Estados para Edição Modal
  const [modalHoras, setModalHoras] = useState<string>("");
  const [modalRegiao, setModalRegiao] = useState<"BRA" | "LATAM">("BRA");
  const [modalCustoConsultor, setModalCustoConsultor] = useState<string>("");
  const [modalFaturar, setModalFaturar] = useState<string>("");

  const capitalizarPrimeiraMaiuscula = (val: string) => {
    return val.replace(/(?:^|\s|\/|-)[a-zà-ÿ]/gi, (letra) => letra.toUpperCase());
  };

  // Estados para Consultores Dinâmicos
  const [consultoresLista, setConsultoresLista] = useState(todosConsultores);
  const [modalNovoConsultorAberto, setModalNovoConsultorAberto] = useState(false);
  const [novoConsultorNome, setNovoConsultorNome] = useState("");
  const [novoConsultorTipo, setNovoConsultorTipo] = useState<"parceiro" | "socio" | "funcionario">("parceiro");
  const [salvandoConsultor, setSalvandoConsultor] = useState(false);
  const [consultorSelecionadoId, setConsultorSelecionadoId] = useState("");

  const handleSelecionarConsultor = (id: string) => {
    setConsultorSelecionadoId(id);
    const c = consultoresLista.find((item) => item.id === id);
    if (c) {
      setLogPassageiroNome(c.nome_completo || c.nome);
      const doc = c.documento || c.cpf || c.rg || "";
      setLogPassageiroDoc(doc);
      if (c.perfil) setPerfilSelecionado(c.perfil);
      const orig = c.origem || c.aeroporto_preferencial || c.cidade_base || "";
      if (orig) setLogAereoOrigem(orig);
    } else {
      setLogPassageiroNome("");
      setLogPassageiroDoc("");
      setPerfilSelecionado("");
      setLogAereoOrigem("");
    }
  };

  // Estados para Searchable Select de Projeto
  const [projetoBusca, setProjetoBusca] = useState("");
  const [projetoSelecionado, setProjetoSelecionado] = useState<{ id: string; nome: string; centro_custo_codigo?: string | null } | null>(null);
  const [dropdownProjetoAberto, setDropdownProjetoAberto] = useState(false);

  // Estados para Searchable Select de Consultor
  const [consultorBusca, setConsultorBusca] = useState("");
  const [dropdownConsultorAberto, setDropdownConsultorAberto] = useState(false);

  // Estados de Logística (Demanda + Agência + Print 2)
  const [demandaLogistica, setDemandaLogistica] = useState(false);
  const [agenciaSelecionada, setAgenciaSelecionada] = useState("");
  const [logPassageiroNome, setLogPassageiroNome] = useState("");
  const [logPassageiroDoc, setLogPassageiroDoc] = useState("");
  const [logTipoViagem, setLogTipoViagem] = useState<"Sozinho" | "Acompanhado">("Sozinho");
  const [logAcompanhanteNome, setLogAcompanhanteNome] = useState("");
  const [logAcompanhanteDoc, setLogAcompanhanteDoc] = useState("");
  const [logObsGeral, setLogObsGeral] = useState("");
  const [logAereoOrigem, setLogAereoOrigem] = useState("");
  const [logAereoDestino, setLogAereoDestino] = useState("");
  const [logAereoDataIda, setLogAereoDataIda] = useState("");
  const [logAereoPrefIda, setLogAereoPrefIda] = useState("Manhã");
  const [logAereoDataVolta, setLogAereoDataVolta] = useState("");
  const [logAereoPrefVolta, setLogAereoPrefVolta] = useState("Noite");
  const [logAereoObs, setLogAereoObs] = useState("");
  const [logHotelRegiao, setLogHotelRegiao] = useState("");
  const [logHotelCheckin, setLogHotelCheckin] = useState("");
  const [logHotelCheckout, setLogHotelCheckout] = useState("");
  const [logHotelObs, setLogHotelObs] = useState("");

  // Estados de Veículo e Seguro Viagem
  const [logVeiculoLocacao, setLogVeiculoLocacao] = useState<"Sim" | "Não">("Não");
  const [logVeiculoRetiradaLocal, setLogVeiculoRetiradaLocal] = useState("");
  const [logVeiculoDataRetirada, setLogVeiculoDataRetirada] = useState("");
  const [logVeiculoDataDevolucao, setLogVeiculoDataDevolucao] = useState("");
  const [logVeiculoCategoria, setLogVeiculoCategoria] = useState("Econômico com Ar");
  const [logVeiculoObs, setLogVeiculoObs] = useState("");
  const [logSeguroViagem, setLogSeguroViagem] = useState<"Não" | "Sim">("Não");
  const [logSeguroObs, setLogSeguroObs] = useState("");

  const [salvandoRepasseId, setSalvandoRepasseId] = useState<string | null>(null);
  const [editandoNdId, setEditandoNdId] = useState<string | null>(null);
  const [ndEditAgencia, setNdEditAgencia] = useState<string>("");
  const [ndEditConsultor, setNdEditConsultor] = useState<string>("");
  const [repasseEditVal, setRepasseEditVal] = useState<string>("");
  const [modalItem, setModalItem] = useState<LancamentoItem | null>(null);
  const [salvandoModal, setSalvandoModal] = useState(false);
  const [modalDemandaLogistica, setModalDemandaLogistica] = useState<boolean>(false);
  const [modalAgencia, setModalAgencia] = useState<string>("FÁTIMA");
  const [modalObservacaoAgencia, setModalObservacaoAgencia] = useState<string>("");

  // Estados de Logística para Edição Estruturada (Print 2 no Modal de Edição)
  const [modalLogPassageiroNome, setModalLogPassageiroNome] = useState("");
  const [modalLogPassageiroDoc, setModalLogPassageiroDoc] = useState("");
  const [modalLogTipoViagem, setModalLogTipoViagem] = useState<"Sozinho" | "Acompanhado">("Sozinho");
  const [modalLogAcompanhanteNome, setModalLogAcompanhanteNome] = useState("");
  const [modalLogAcompanhanteDoc, setModalLogAcompanhanteDoc] = useState("");
  const [modalLogObsGeral, setModalLogObsGeral] = useState("");
  const [modalLogAereoOrigem, setModalLogAereoOrigem] = useState("");
  const [modalLogAereoDestino, setModalLogAereoDestino] = useState("");
  const [modalLogAereoDataIda, setModalLogAereoDataIda] = useState("");
  const [modalLogAereoPrefIda, setModalLogAereoPrefIda] = useState("Manhã");
  const [modalLogAereoDataVolta, setModalLogAereoDataVolta] = useState("");
  const [modalLogAereoPrefVolta, setModalLogAereoPrefVolta] = useState("Noite");
  const [modalLogAereoObs, setModalLogAereoObs] = useState("");
  const [modalLogHotelRegiao, setModalLogHotelRegiao] = useState("");
  const [modalLogHotelCheckin, setModalLogHotelCheckin] = useState("");
  const [modalLogHotelCheckout, setModalLogHotelCheckout] = useState("");
  const [modalLogHotelObs, setModalLogHotelObs] = useState("");
  const [modalLogVeiculoLocacao, setModalLogVeiculoLocacao] = useState<"Sim" | "Não">("Não");
  const [modalLogVeiculoRetiradaLocal, setModalLogVeiculoRetiradaLocal] = useState("");
  const [modalLogVeiculoDataRetirada, setModalLogVeiculoDataRetirada] = useState("");
  const [modalLogVeiculoDataDevolucao, setModalLogVeiculoDataDevolucao] = useState("");
  const [modalLogVeiculoCategoria, setModalLogVeiculoCategoria] = useState("Econômico com Ar");
  const [modalLogVeiculoObs, setModalLogVeiculoObs] = useState("");

  // Estados dinâmicos e editáveis para o Modal de Edição (Print 2 unificado com Print 3)
  const [modalProjetoBusca, setModalProjetoBusca] = useState("");
  const [modalProjetoSelecionado, setModalProjetoSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [modalDropdownProjetoAberto, setModalDropdownProjetoAberto] = useState(false);
  const [modalConsultorBusca, setModalConsultorBusca] = useState("");
  const [modalConsultorSelecionadoId, setModalConsultorSelecionadoId] = useState("");
  const [modalDropdownConsultorAberto, setModalDropdownConsultorAberto] = useState(false);
  const [modalPerfilSelecionado, setModalPerfilSelecionado] = useState("");
  const [modalAtividadeTexto, setModalAtividadeTexto] = useState("");
  const [modalLocalTexto, setModalLocalTexto] = useState("");
  const [modalDataInicial, setModalDataInicial] = useState("");
  const [modalDataFinal, setModalDataFinal] = useState("");

  // Bloqueios de Agenda dos Consultores
  const [bloqueiosAgenda, setBloqueiosAgenda] = useState<AgendaBloqueio[]>([]);

  useEffect(() => {
    fetch("/api/consultor/bloqueios")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.bloqueios)) {
          setBloqueiosAgenda(data.bloqueios);
        }
      })
      .catch((err) => console.error("Erro ao carregar bloqueios de agenda:", err));
  }, []);

  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [dadosDuplicacao, setDadosDuplicacao] = useState<{
    modalidade?: string;
    status?: string;
    regiao?: string;
    data_inicial?: string;
    data_final?: string;
    horas?: string;
    custo_consultor?: string;
    faturar?: string;
    repasse?: string;
  } | null>(null);

  useEffect(() => {
    if (modalItem) {
      setModalDemandaLogistica(Boolean(modalItem.precisa_logistica));
      const v = Array.isArray(modalItem.viagens) ? modalItem.viagens[0] : modalItem.viagens;
      setModalAgencia(v?.agencia || "FÁTIMA");
      setModalObservacaoAgencia(v?.observacao_agencia || "");
      setConfirmandoExclusaoId(null);

      const parsed = parseLogisticaObservacao(v?.observacao_agencia, {
        passageiroNome: modalItem.consultores?.nome,
        destino: modalItem.local || "",
        dataInicial: modalItem.data_inicial || "",
        dataFinal: modalItem.data_final || "",
      });

      setModalLogPassageiroNome(parsed.passageiroNome);
      setModalLogPassageiroDoc(parsed.passageiroDoc);
      setModalLogTipoViagem(parsed.tipoViagem);
      setModalLogAcompanhanteNome(parsed.acompanhanteNome);
      setModalLogAcompanhanteDoc(parsed.acompanhanteDoc);
      setModalLogObsGeral(parsed.obsGeral);
      setModalLogAereoOrigem(parsed.aereoOrigem);
      setModalLogAereoDestino(parsed.aereoDestino);
      setModalLogAereoDataIda(parsed.aereoDataIda);
      setModalLogAereoPrefIda(parsed.aereoPrefIda);
      setModalLogAereoDataVolta(parsed.aereoDataVolta);
      setModalLogAereoPrefVolta(parsed.aereoPrefVolta);
      setModalLogAereoObs(parsed.aereoObs);
      setModalLogHotelRegiao(parsed.hotelRegiao);
      setModalLogHotelCheckin(parsed.hotelCheckin);
      setModalLogHotelCheckout(parsed.hotelCheckout);
      setModalLogHotelObs(parsed.hotelObs);
      setModalLogVeiculoLocacao(parsed.veiculoLocacao);
      setModalLogVeiculoRetiradaLocal(parsed.veiculoRetiradaLocal);
      setModalLogVeiculoDataRetirada(parsed.veiculoDataRetirada);
      setModalLogVeiculoDataDevolucao(parsed.veiculoDataDevolucao);
      setModalLogVeiculoCategoria(parsed.veiculoCategoria);
      setModalLogVeiculoObs(parsed.veiculoObs);

      // Preenchimento de Projeto e Consultor editáveis para espelhar o formulário de Nova Atividade
      const proj = todosProjetos.find(
        (p) => p.id === modalItem.projeto_id || (modalItem.projetos?.nome && p.nome.toUpperCase() === modalItem.projetos.nome.toUpperCase())
      );
      setModalProjetoSelecionado(proj || (modalItem.projetos?.nome ? { id: modalItem.projeto_id || "", nome: modalItem.projetos.nome } : null));
      setModalProjetoBusca("");
      setModalDropdownProjetoAberto(false);

      const cons = consultoresLista.find(
        (c) => c.id === modalItem.consultor_id || (modalItem.consultores?.nome && c.nome.toUpperCase() === modalItem.consultores.nome.toUpperCase())
      );
      setModalConsultorSelecionadoId(cons?.id || modalItem.consultor_id || "");
      setModalConsultorBusca("");
      setModalDropdownConsultorAberto(false);

      setModalPerfilSelecionado(modalItem.perfil || cons?.perfil || "");
      setModalAtividadeTexto(modalItem.atividade || "");
      setModalLocalTexto(modalItem.local || "");
      setModalDataInicial(modalItem.data_inicial || "");
      setModalDataFinal(modalItem.data_final || "");
      setModalHoras(modalItem.horas != null ? String(modalItem.horas) : "");
      setModalRegiao((modalItem.regiao as "BRA" | "LATAM") || "BRA");
      setModalCustoConsultor(formatarMoedaValor(modalItem.custo_consultor));
      setModalFaturar(formatarMoedaValor(modalItem.faturar));
    }
  }, [modalItem, todosProjetos, consultoresLista]);

  const modalProjetosFiltrados = useMemo(() => {
    if (!modalProjetoBusca.trim()) return todosProjetos;
    const term = modalProjetoBusca.toLowerCase();
    return todosProjetos.filter((p) => p.nome.toLowerCase().includes(term));
  }, [todosProjetos, modalProjetoBusca]);

  const modalConsultorSelecionado = useMemo(() => {
    return consultoresLista.find((c) => c.id === modalConsultorSelecionadoId) || null;
  }, [consultoresLista, modalConsultorSelecionadoId]);

  const modalConsultoresFiltrados = useMemo(() => {
    if (!modalConsultorBusca.trim()) return consultoresLista;
    const term = modalConsultorBusca.toLowerCase();
    return consultoresLista.filter(
      (c) =>
        (c.nome || "").toLowerCase().includes(term) ||
        (c.nome_completo || "").toLowerCase().includes(term)
    );
  }, [consultoresLista, modalConsultorBusca]);

  const projetosFiltrados = useMemo(() => {
    if (!projetoBusca.trim()) return todosProjetos;
    const term = projetoBusca.toLowerCase();
    return todosProjetos.filter((p) => p.nome.toLowerCase().includes(term));
  }, [todosProjetos, projetoBusca]);

  const consultorSelecionado = useMemo(() => {
    return consultoresLista.find((c) => c.id === consultorSelecionadoId) || null;
  }, [consultoresLista, consultorSelecionadoId]);

  const consultoresFiltrados = useMemo(() => {
    if (!consultorBusca.trim()) return consultoresLista;
    const term = consultorBusca.toLowerCase();
    return consultoresLista.filter(
      (c) =>
        (c.nome || "").toLowerCase().includes(term) ||
        (c.nome_completo || "").toLowerCase().includes(term)
    );
  }, [consultoresLista, consultorBusca]);

  // Checagem de Conflito de Bloqueio de Agenda para Nova Atividade
  const conflitoBloqueioNovo = useMemo(() => {
    const nome = consultorSelecionado?.nome;
    if (!nome || !novaDataInicial) return null;
    return verificarConflitoBloqueio(
      bloqueiosAgenda,
      nome,
      novaDataInicial,
      novaDataFinal || novaDataInicial
    );
  }, [bloqueiosAgenda, consultorSelecionado, novaDataInicial, novaDataFinal]);

  // Checagem de Conflito de Bloqueio de Agenda para Edição de Atividade
  const conflitoBloqueioModal = useMemo(() => {
    const nome = modalConsultorSelecionado?.nome || modalItem?.consultores?.nome;
    if (!nome || !modalDataInicial) return null;
    return verificarConflitoBloqueio(
      bloqueiosAgenda,
      nome,
      modalDataInicial,
      modalDataFinal || modalDataInicial
    );
  }, [bloqueiosAgenda, modalConsultorSelecionado, modalItem, modalDataInicial, modalDataFinal]);

  // Cálculos Automáticos de Tabela de Preços e Custo Consultor (+6% Sócios exceto Comissão)
  const anoAtividadeNovo = useMemo(() => {
    if (novaDataInicial) {
      const y = parseInt(novaDataInicial.slice(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    if (competencia) {
      const y = parseInt(competencia.slice(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    return 2026;
  }, [novaDataInicial, competencia]);

  const calculoTabelaNova = useMemo(() => {
    const ccCodigo = (projetoSelecionado as any)?.centro_custo_codigo || null;
    const ccContrato = (projetoSelecionado as any)?.centro_custo_contrato || null;
    const contratoUpper = (ccContrato || "").trim().toUpperCase();
    const nomeUpper = (projetoSelecionado?.nome || "").toUpperCase();

    let contratoFinal: string | undefined = undefined;
    if (contratoUpper === "AVULSO") {
      contratoFinal = "AVULSO";
    } else if (contratoUpper) {
      contratoFinal = contratoUpper;
    } else {
      const isCNH = nomeUpper.includes("DM") || nomeUpper.includes("CNH") || nomeUpper.includes("COMERCIAL") || nomeUpper.includes("CRM");
      contratoFinal = isCNH ? "CNH INDUSTRIAL" : (ccCodigo ? undefined : "AVULSO");
    }

    return calcularValoresAtividade({
      codigoCC: ccCodigo,
      codigoContrato: contratoFinal,
      perfil: perfilSelecionado,
      consultorNome: consultorSelecionado?.nome,
      consultorTipo: consultorSelecionado?.tipo,
      regiao: novaRegiao,
      atividadeDescricao: atividadeTexto,
      horas: novaHoras ? parseFloat(novaHoras.replace(",", ".")) : 0,
      ano: anoAtividadeNovo,
    });
  }, [projetoSelecionado, perfilSelecionado, consultorSelecionado, novaRegiao, atividadeTexto, novaHoras, anoAtividadeNovo]);

  const anoAtividadeModal = useMemo(() => {
    if (modalItem?.data_inicial) {
      const y = parseInt(modalItem.data_inicial.slice(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    if (competencia) {
      const y = parseInt(competencia.slice(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    return 2026;
  }, [modalItem, competencia]);

  const calculoTabelaModal = useMemo(() => {
    const ccCodigo = (modalProjetoSelecionado as any)?.centro_custo_codigo || (modalItem?.projetos?.centros_custo as any)?.codigo || null;
    const ccContrato = (modalProjetoSelecionado as any)?.centro_custo_contrato || (modalItem?.projetos?.centros_custo as any)?.contrato || null;
    const contratoUpper = (ccContrato || "").trim().toUpperCase();
    const nomeUpper = (modalProjetoSelecionado?.nome || modalItem?.projetos?.nome || "").toUpperCase();

    let contratoFinal: string | undefined = undefined;
    if (contratoUpper === "AVULSO") {
      contratoFinal = "AVULSO";
    } else if (contratoUpper) {
      contratoFinal = contratoUpper;
    } else {
      const isCNH = nomeUpper.includes("DM") || nomeUpper.includes("CNH") || nomeUpper.includes("COMERCIAL") || nomeUpper.includes("CRM");
      contratoFinal = isCNH ? "CNH INDUSTRIAL" : (ccCodigo ? undefined : "AVULSO");
    }

    return calcularValoresAtividade({
      codigoCC: ccCodigo,
      codigoContrato: contratoFinal,
      perfil: modalPerfilSelecionado,
      consultorNome: modalConsultorSelecionado?.nome,
      consultorTipo: modalConsultorSelecionado?.tipo,
      regiao: modalRegiao,
      atividadeDescricao: modalAtividadeTexto,
      horas: modalHoras ? parseFloat(modalHoras.replace(",", ".")) : (modalItem?.horas || 0),
      ano: anoAtividadeModal,
    });
  }, [modalProjetoSelecionado, modalItem, modalPerfilSelecionado, modalConsultorSelecionado, modalRegiao, modalAtividadeTexto, modalHoras, anoAtividadeModal]);

  const handleSelecionarConsultorModal = (id: string) => {
    setModalConsultorSelecionadoId(id);
    const c = consultoresLista.find((item) => item.id === id);
    if (c) {
      if (!modalLogPassageiroNome || modalLogPassageiroNome === "Não informado") {
        setModalLogPassageiroNome(c.nome_completo || c.nome);
      }
      if (!modalLogPassageiroDoc || modalLogPassageiroDoc === "N/A") {
        setModalLogPassageiroDoc(c.documento || c.cpf || c.rg || "");
      }
      if (c.perfil) setModalPerfilSelecionado(c.perfil);
      const orig = c.origem || c.aeroporto_preferencial || c.cidade_base || "";
      if (orig && (!modalLogAereoOrigem || modalLogAereoOrigem === "N/A")) {
        setModalLogAereoOrigem(orig);
      }
    }
  };

  const handleExcluirAtividade = async (id: string, nomeAtividade?: string) => {
    setExcluindoId(id);
    try {
      const res = await fetch(`/api/lancamentos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLista((prev) => prev.filter((it) => it.id !== id));
        setModalItem(null);
        setConfirmandoExclusaoId(null);
        router.refresh();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(`Erro ao excluir atividade no servidor: ${errJson.error || "Tente novamente."}`);
      }
    } catch (err) {
      console.error("Erro ao excluir atividade:", err);
      alert("Erro ao comunicar com o servidor.");
    } finally {
      setExcluindoId(null);
    }
  };

  const handleDuplicarAtividade = (item: LancamentoItem) => {
    if (item.projetos?.nome) {
      const proj = todosProjetos.find((p) => p.nome.toUpperCase() === item.projetos?.nome.toUpperCase());
      if (proj) setProjetoSelecionado(proj);
    }
    setAtividadeTexto(item.atividade || "");
    setLocalTexto(item.local || "");
    if (item.consultores?.nome) {
      const cons = consultoresLista.find((c) => c.nome.toUpperCase() === item.consultores?.nome.toUpperCase());
      if (cons) handleSelecionarConsultor(cons.id);
    }
    if (item.perfil) {
      setPerfilSelecionado(item.perfil);
    }
    if (item.precisa_logistica) {
      setDemandaLogistica(true);
      const v = Array.isArray(item.viagens) ? item.viagens[0] : item.viagens;
      if (v?.agencia) {
        setAgenciaSelecionada(v.agencia);
      }
    } else {
      setDemandaLogistica(false);
      setAgenciaSelecionada("");
    }

    setDadosDuplicacao({
      modalidade: item.modalidade || "PRESENCIAL",
      status: item.status || "CONFIRMADO",
      regiao: item.regiao || "BRA",
      data_inicial: item.data_inicial || "",
      data_final: item.data_final || "",
      horas: item.horas != null ? String(item.horas) : "",
      custo_consultor: formatarMoedaValor(item.custo_consultor),
      faturar: formatarMoedaValor(item.faturar),
      repasse: formatarMoedaValor(item.repasse),
    });

    setNovaHoras(item.horas != null ? String(item.horas) : "");
    setNovaRegiao((item.regiao as "BRA" | "LATAM") || "BRA");
    setNovoCustoConsultor(formatarMoedaValor(item.custo_consultor));
    setNovoFaturar(formatarMoedaValor(item.faturar));

    setModalItem(null);
    setModalNovoAberto(true);
  };

  const handleSalvarRepasse = async (id: string, valorStr: string) => {
    const valorLimpo = valorStr.trim();
    const valorNum = valorLimpo === "" ? null : parseFloat(valorLimpo.replace(/\./g, "").replace(",", "."));
    setSalvandoRepasseId(id);
    try {
      const res = await fetch(`/api/lancamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repasse: valorNum }),
      });
      if (res.ok) {
        setLista((prev) =>
          prev.map((item) => (item.id === id ? { ...item, repasse: valorNum } : item))
        );
      }
    } catch (err) {
      console.error("Erro ao salvar repasse:", err);
    } finally {
      setTimeout(() => setSalvandoRepasseId(null), 800);
    }
  };

  const handleVincularNDAuto = async (
    lancamentoId: string,
    destino: "agencia" | "consultor" | "ambos",
    numeroND: string,
    valorND: number,
    repasseCalculado: number
  ) => {
    try {
      const res = await fetch(`/api/lancamentos/${lancamentoId}/vincular-nd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destino,
          numero: numeroND,
          valor: valorND,
          repasseManual: repasseCalculado,
        }),
      });
      if (res.ok) {
        setLista((prev) =>
          prev.map((it) => {
            if (it.id !== lancamentoId) return it;
            let notasAtuais = it.notas_debito ? [...it.notas_debito] : [];
            if (destino === "ambos") {
              notasAtuais = [
                { destino: "agencia", numero: numeroND, valor: valorND },
                { destino: "consultor", numero: numeroND, valor: valorND },
              ];
            } else {
              const idx = notasAtuais.findIndex((n) => n.destino === destino);
              if (idx >= 0) {
                notasAtuais[idx] = { ...notasAtuais[idx], numero: numeroND, valor: valorND };
              } else {
                notasAtuais.push({ destino, numero: numeroND, valor: valorND });
              }
            }
            return {
              ...it,
              repasse: repasseCalculado,
              notas_debito: notasAtuais,
            };
          })
        );
      }
    } catch (err) {
      console.error("Erro ao vincular ND:", err);
    }
  };

  const handleIniciarEdicaoND = (
    lancamentoId: string,
    ndAg: string | null,
    ndCo: string | null,
    repVal: number,
    repasseItem: number | null
  ) => {
    setEditandoNdId(lancamentoId);
    setNdEditAgencia(ndAg || "");
    setNdEditConsultor(ndCo || "");
    const valorPadrao = repVal > 0 ? repVal : (repasseItem != null ? repasseItem : "");
    setRepasseEditVal(String(valorPadrao));
  };

  const handleSalvarEdicaoManualND = async (lancamentoId: string) => {
    const itemAtual = lista.find((l) => l.id === lancamentoId);
    if (!itemAtual) return;
    const v = Array.isArray(itemAtual.viagens) ? itemAtual.viagens[0] : itemAtual.viagens;
    const custoAgencia = v ? ((v.custo_1 || 0) + (v.custo_2 || 0) + (v.custo_3 || 0) + (v.custo_4 || 0)) : 0;
    const custoConsultor = v ? (v.custo_5 || 0) : 0;

    const numAg = ndEditAgencia.trim();
    const numCo = ndEditConsultor.trim();
    const repNum = repasseEditVal.trim() !== "" ? parseFloat(repasseEditVal.replace(/\./g, "").replace(",", ".")) : null;

    if (!numAg && !numCo) {
      await handleDesvincularNDs(lancamentoId, false);
      if (repNum != null) {
        await handleSalvarRepasse(lancamentoId, String(repNum));
      }
      setEditandoNdId(null);
      return;
    }

    if (numAg && numAg === numCo) {
      const fatura = faturasLogistica.find((f) => f.numeroNota === numAg);
      const val = fatura ? fatura.valor : (repNum ?? (custoAgencia + custoConsultor));
      await handleVincularNDAuto(lancamentoId, "ambos", numAg, val, repNum ?? val);
    } else {
      if (numAg) {
        const fatAg = faturasLogistica.find((f) => f.numeroNota === numAg);
        const valAg = fatAg ? fatAg.valor : custoAgencia;
        await handleVincularNDAuto(lancamentoId, "agencia", numAg, valAg, repNum ?? valAg);
      } else {
        await handleVincularNDAuto(lancamentoId, "agencia", "", 0, repNum ?? 0);
      }
      if (numCo) {
        const fatCo = faturasLogistica.find((f) => f.numeroNota === numCo);
        const valCo = fatCo ? fatCo.valor : custoConsultor;
        await handleVincularNDAuto(lancamentoId, "consultor", numCo, valCo, repNum ?? valCo);
      } else {
        await handleVincularNDAuto(lancamentoId, "consultor", "", 0, repNum ?? 0);
      }
    }
    setEditandoNdId(null);
  };

  const handleDesvincularNDs = async (lancamentoId: string, pedirConfirmacao = true) => {
    if (pedirConfirmacao && !confirm("Deseja desvincular as Notas de Débito desta atividade e reabrir os campos para edição manual?")) {
      return;
    }
    try {
      const res = await fetch(`/api/lancamentos/${lancamentoId}/desvincular-nd`, {
        method: "POST",
      });
      if (res.ok) {
        setLista((prev) =>
          prev.map((it) => {
            if (it.id !== lancamentoId) return it;
            return {
              ...it,
              notas_debito: [],
            };
          })
        );
        setEditandoNdId(null);
      }
    } catch (err) {
      console.error("Erro ao desvincular NDs:", err);
    }
  };

  const handleSalvarND = async (
    lancamentoId: string,
    destino: "agencia" | "consultor",
    valorStr: string
  ) => {
    const valorLimpo = valorStr.trim();
    if (!valorLimpo || valorLimpo === "0000") return;

    const itemAtual = lista.find((l) => l.id === lancamentoId);
    const v = itemAtual ? (Array.isArray(itemAtual.viagens) ? itemAtual.viagens[0] : itemAtual.viagens) : null;
    const custoAgencia = v ? ((v.custo_1 || 0) + (v.custo_2 || 0) + (v.custo_3 || 0) + (v.custo_4 || 0)) : 0;
    const custoConsultor = v ? (v.custo_5 || 0) : 0;
    
    const fatura = faturasLogistica.find((f) => f.numeroNota === valorLimpo);
    const valorND = fatura ? fatura.valor : (destino === "consultor" ? custoConsultor : custoAgencia);

    const outraNDDestino = destino === "agencia" ? "consultor" : "agencia";
    const outraND = itemAtual?.notas_debito?.find((n) => n.destino === outraNDDestino);
    const valorOutraND = outraND?.valor ?? (outraND?.numero ? (outraNDDestino === "consultor" ? custoConsultor : custoAgencia) : 0);
    const repasseSoma = Math.round((valorND + valorOutraND) * 100) / 100;

    await handleVincularNDAuto(lancamentoId, destino, valorLimpo, valorND, repasseSoma);
  };

  const handleSalvarModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modalItem) return;

    setSalvandoModal(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const faturarRaw = formData.get("faturar") as string;
    const repasseRaw = formData.get("repasse") as string;
    const consultorRaw = formData.get("custo_consultor") as string;
    const horasRaw = formData.get("horas") as string;

    const dataInicialModal = (formData.get("data_inicial") as string) || null;
    const dataFinalModal = (formData.get("data_final") as string) || null;

    if (dataInicialModal && dataFinalModal && dataInicialModal.slice(0, 7) !== dataFinalModal.slice(0, 7)) {
      alert(
        "Atenção: O período da atividade deve ficar exclusivamente dentro do mesmo mês.\n\nPara atividades que cruzam a virada do mês, cadastre em dois lançamentos distintos (ex: até o último dia do mês e do 1º dia em diante no mês seguinte)."
      );
      setSalvandoModal(false);
      return;
    }

    // Alerta de Bloqueio de Agenda do Consultor
    if (conflitoBloqueioModal) {
      const confirma = window.confirm(
        `⚠️ ATENÇÃO: O período selecionado (${formatarPeriodoBR(conflitoBloqueioModal.dataInicial, conflitoBloqueioModal.dataFinal)}) está BLOQUEADO pelo consultor ${conflitoBloqueioModal.consultorNome} para: "${conflitoBloqueioModal.motivo}".\n\nDeseja realmente continuar e salvar esta atividade mesmo com a indisponibilidade informada?`
      );
      if (!confirma) {
        setSalvandoModal(false);
        return;
      }
    }

    let observacaoAgenciaModal: string | null = null;
    if (modalDemandaLogistica) {
      const blocos: string[] = [];
      blocos.push(
        `[PASSAGEIRO] Nome: ${modalLogPassageiroNome || "Não informado"} | Documento: ${modalLogPassageiroDoc || "N/A"} | Viagem: ${modalLogTipoViagem} | OBS: ${modalLogObsGeral || "Nenhuma"}`
      );
      if (modalLogTipoViagem === "Acompanhado" && (modalLogAcompanhanteNome || modalLogAcompanhanteDoc)) {
        blocos.push(
          `[ACOMPANHANTE] Nome: ${modalLogAcompanhanteNome || "Não informado"} | Documento: ${modalLogAcompanhanteDoc || "N/A"}`
        );
      }
      if (modalLogAereoOrigem || modalLogAereoDestino || modalLogAereoDataIda) {
        blocos.push(
          `[AÉREO] Origem: ${modalLogAereoOrigem || "N/A"} -> Destino: ${modalLogAereoDestino || "N/A"} | Ida: ${modalLogAereoDataIda || "N/A"} (${modalLogAereoPrefIda}) | Volta: ${modalLogAereoDataVolta || "N/A"} (${modalLogAereoPrefVolta}) | OBS: ${modalLogAereoObs || "Nenhuma"}`
        );
      }
      if (modalLogHotelRegiao || modalLogHotelCheckin) {
        blocos.push(
          `[HOTEL] Região: ${modalLogHotelRegiao || "N/A"} | Check-in: ${modalLogHotelCheckin || "N/A"} | Check-out: ${modalLogHotelCheckout || "N/A"} | OBS: ${modalLogHotelObs || "Nenhuma"}`
        );
      }
      if (modalLogVeiculoLocacao === "Sim") {
        blocos.push(
          `[VEÍCULO ALUGADO] Local Retirada: ${modalLogVeiculoRetiradaLocal || "N/A"} | Retirada: ${modalLogVeiculoDataRetirada || "N/A"} | Devolução: ${modalLogVeiculoDataDevolucao || "N/A"} | Categoria: ${modalLogVeiculoCategoria} | OBS: ${modalLogVeiculoObs || "Nenhuma"}`
        );
      }
      observacaoAgenciaModal = blocos.join("\n");
    }

    const payload = {
      projeto_id: modalProjetoSelecionado?.id || modalItem.projeto_id,
      consultor_id: modalConsultorSelecionadoId || modalItem.consultor_id || null,
      atividade: modalAtividadeTexto || (formData.get("atividade") as string) || null,
      modalidade: (formData.get("modalidade") as "PRESENCIAL" | "VIRTUAL") || null,
      local: modalLocalTexto || (formData.get("local") as string) || null,
      regiao: (formData.get("regiao") as "BRA" | "LATAM") || "BRA",
      data_inicial: dataInicialModal,
      data_final: dataFinalModal,
      perfil: modalPerfilSelecionado || (formData.get("perfil") as string) || null,
      status: (formData.get("status") as string) || null,
      precisa_logistica: modalDemandaLogistica,
      agencia: modalDemandaLogistica ? modalAgencia : null,
      observacao_agencia: modalDemandaLogistica ? observacaoAgenciaModal : null,
      horas: horasRaw ? parseFloat(horasRaw.replace(",", ".")) : null,
      faturar: parseMoeda(faturarRaw),
      repasse: parseMoeda(repasseRaw),
      custo_consultor: parseMoeda(consultorRaw),
    };

    try {
      const res = await fetch(`/api/lancamentos/${modalItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const projetoObj = todosProjetos.find((p) => p.id === payload.projeto_id);
        const consultorObj = consultoresLista.find((c) => c.id === payload.consultor_id);

        setLista((prev) =>
          prev.map((it) => {
            if (it.id === modalItem.id) {
              const vAtual = Array.isArray(it.viagens) ? it.viagens[0] : it.viagens;
              const novaViagem: ViagemItem = vAtual
                ? {
                    ...vAtual,
                    agencia: modalDemandaLogistica ? modalAgencia : vAtual.agencia,
                    observacao_agencia: modalDemandaLogistica ? observacaoAgenciaModal : null,
                  }
                : {
                    id: `v-${it.id}`,
                    agencia: modalDemandaLogistica ? modalAgencia : null,
                    custo_1: 0,
                    custo_2: 0,
                    custo_3: 0,
                    custo_4: 0,
                    custo_5: 0,
                    total: 0,
                    observacao_agencia: modalDemandaLogistica ? observacaoAgenciaModal : null,
                  };

              return {
                ...it,
                ...payload,
                projetos: projetoObj
                  ? { nome: projetoObj.nome, centros_custo: it.projetos?.centros_custo || null }
                  : it.projetos,
                consultores: consultorObj
                  ? { nome: consultorObj.nome, tipo: it.consultores?.tipo || "parceiro" }
                  : it.consultores,
                viagens: novaViagem,
              };
            }
            return it;
          })
        );
        setModalItem(null);
        router.refresh();
      } else {
        alert("Erro ao salvar as alterações.");
      }
    } catch (err) {
      console.error("Erro ao salvar lançamento:", err);
      alert("Erro ao comunicar com o servidor.");
    } finally {
      setSalvandoModal(false);
    }
  };

  useEffect(() => {
    const handleAbrir = () => setModalNovoAberto(true);
    window.addEventListener("abrir-modal-nova-atividade", handleAbrir);
    return () => window.removeEventListener("abrir-modal-nova-atividade", handleAbrir);
  }, []);


  const handleCadastrarConsultor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoConsultorNome.trim()) return;
    setSalvandoConsultor(true);
    try {
      const res = await fetch("/api/consultores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: novoConsultorNome.trim(),
          tipo: novoConsultorTipo,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        const novo = json.data;
        setConsultoresLista((prev) =>
          [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome))
        );
        setConsultorSelecionadoId(novo.id);
        if (!logPassageiroNome) setLogPassageiroNome(novo.nome);
        setNovoConsultorNome("");
        setModalNovoConsultorAberto(false);
      } else {
        alert("Erro ao cadastrar consultor: " + (json.error || "Tente novamente."));
      }
    } catch (err) {
      console.error("Erro ao cadastrar consultor:", err);
      alert("Erro ao comunicar com o servidor.");
    } finally {
      setSalvandoConsultor(false);
    }
  };

  const handleCriarNovaAtividade = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const projId = projetoSelecionado?.id;
    if (!projId) {
      alert("Por favor, selecione um Projeto da lista.");
      return;
    }

    if (demandaLogistica && !agenciaSelecionada) {
      alert("Por favor, selecione a Agência de Viagens (FÁTIMA ou ALIVE).");
      return;
    }

    setSalvandoNovo(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const faturarRaw = formData.get("faturar") as string;
    const consultorRaw = formData.get("custo_consultor") as string;
    const horasRaw = formData.get("horas") as string;
    const dataInicialStr = (formData.get("data_inicial") as string) || null;
    const dataFinalStr = (formData.get("data_final") as string) || null;

    // Regra de Negócio: O período da atividade deve ficar exclusivamente dentro do mês
    if (dataInicialStr && dataFinalStr && dataInicialStr.slice(0, 7) !== dataFinalStr.slice(0, 7)) {
      alert(
        "Atenção: O período da atividade precisa ficar exclusivamente dentro do mesmo mês.\n\n" +
        "Para uma atividade que cruza a virada do mês, cadastre dois lançamentos:\n" +
        "1º Lançamento: do início até o último dia do mês (ex: 28/09 a 30/09)\n" +
        "2º Lançamento: do 1º dia até o término no mês seguinte (ex: 01/10 a 02/10)\n\n" +
        "Importante: A solicitação de logística e os valores totais (aéreo/hotel) devem ser preenchidos no 1º lançamento cobrindo o período integral da viagem."
      );
      setSalvandoNovo(false);
      return;
    }

    // Alerta de Bloqueio de Agenda do Consultor
    if (conflitoBloqueioNovo) {
      const confirma = window.confirm(
        `⚠️ ATENÇÃO: O período selecionado (${formatarPeriodoBR(conflitoBloqueioNovo.dataInicial, conflitoBloqueioNovo.dataFinal)}) está BLOQUEADO pelo consultor ${conflitoBloqueioNovo.consultorNome} para: "${conflitoBloqueioNovo.motivo}".\n\nDeseja realmente continuar e agendar esta atividade mesmo com a indisponibilidade informada?`
      );
      if (!confirma) {
        setSalvandoNovo(false);
        return;
      }
    }

    // Constrói a competência correspondente à data inicial para garantir visibilidade correta
    const compCalculada = dataInicialStr && dataInicialStr.length >= 7
      ? `${dataInicialStr.slice(0, 7)}-01`
      : (competencia || "2026-10-01");

    // Constrói a observação da agência estruturada com os campos de logística
    let observacaoAgencia = "";
    if (demandaLogistica) {
      const blocos: string[] = [];
      blocos.push(
        `[PASSAGEIRO] Nome: ${logPassageiroNome || "Não informado"} | Documento: ${logPassageiroDoc || "N/A"} | Viagem: ${logTipoViagem} | OBS: ${logObsGeral || "Nenhuma"}`
      );
      if (logTipoViagem === "Acompanhado" && (logAcompanhanteNome || logAcompanhanteDoc)) {
        blocos.push(
          `[ACOMPANHANTE] Nome: ${logAcompanhanteNome || "Não informado"} | Documento: ${logAcompanhanteDoc || "N/A"}`
        );
      }
      if (logAereoOrigem || logAereoDestino || logAereoDataIda) {
        blocos.push(
          `[AÉREO] Origem: ${logAereoOrigem || "N/A"} -> Destino: ${logAereoDestino || "N/A"} | Ida: ${logAereoDataIda || "N/A"} (${logAereoPrefIda}) | Volta: ${logAereoDataVolta || "N/A"} (${logAereoPrefVolta}) | OBS: ${logAereoObs || "Nenhuma"}`
        );
      }
      if (logHotelRegiao || logHotelCheckin) {
        blocos.push(
          `[HOTEL] Região: ${logHotelRegiao || "N/A"} | Check-in: ${logHotelCheckin || "N/A"} | Check-out: ${logHotelCheckout || "N/A"} | OBS: ${logHotelObs || "Nenhuma"}`
        );
      }
      if (logVeiculoLocacao === "Sim") {
        blocos.push(
          `[VEÍCULO ALUGADO] Local Retirada: ${logVeiculoRetiradaLocal || "N/A"} | Retirada: ${logVeiculoDataRetirada || "N/A"} | Devolução: ${logVeiculoDataDevolucao || "N/A"} | Categoria: ${logVeiculoCategoria} | OBS: ${logVeiculoObs || "Nenhuma"}`
        );
      }
      if (logSeguroViagem === "Sim") {
        blocos.push(
          `[SEGURO VIAGEM] Solicitado: SIM | Requisitos: ${logSeguroObs || "Cobertura corporativa padrão para o período"}`
        );
      }
      observacaoAgencia = blocos.join("\n");
    }

    const payload = {
      projeto_id: projId,
      projeto_nome: projetoSelecionado?.nome,
      consultor_id: consultorSelecionadoId || (formData.get("consultor_id") as string) || null,
      consultor_nome: logPassageiroNome,
      competencia: compCalculada,
      atividade: atividadeTexto.trim() || (formData.get("atividade") as string) || null,
      modalidade: (formData.get("modalidade") as "PRESENCIAL" | "VIRTUAL") || "PRESENCIAL",
      local: localTexto.trim() || (formData.get("local") as string) || null,
      regiao: (formData.get("regiao") as "BRA" | "LATAM") || "BRA",
      data_inicial: dataInicialStr,
      data_final: dataFinalStr,
      perfil: perfilSelecionado || (formData.get("perfil") as string) || null,
      horas: horasRaw ? parseFloat(horasRaw.replace(",", ".")) : null,
      faturar: parseMoeda(faturarRaw),
      repasse: 0, // Campo em desuso no cadastro manual, preenchido exclusivamente por NDs conciliadas
      custo_consultor: parseMoeda(consultorRaw),
      status: (formData.get("status") as string) || "CONFIRMADO",
      precisa_logistica: demandaLogistica,
      agencia: demandaLogistica ? agenciaSelecionada : null,
      observacao_agencia: demandaLogistica ? observacaoAgencia : null,
    };

    try {
      const res = await fetch("/api/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.data) {
        if (!competencia || compCalculada === competencia) {
          setLista((prev) => [data.data, ...prev]);
        } else {
          // Se foi cadastrado em competência diferente da página atual, redireciona para a competência cadastrada
          const partesComp = compCalculada.split("-");
          const anoDestino = partesComp[0];
          const mesDestino = parseInt(partesComp[1], 10);
          window.location.href = `/projetos?ano=${anoDestino}&mes=${mesDestino}`;
          return;
        }
        setModalNovoAberto(false);
        setDadosDuplicacao(null);
        // Reset dos estados
        setProjetoSelecionado(null);
        setProjetoBusca("");
        setConsultorSelecionadoId("");
        setConsultorBusca("");
        setAtividadeTexto("");
        setLocalTexto("");
        setPerfilSelecionado("");
        setDemandaLogistica(false);
        setAgenciaSelecionada("");
        setLogPassageiroNome("");
        setLogPassageiroDoc("");
        setLogTipoViagem("Sozinho");
        setLogAcompanhanteNome("");
        setLogAcompanhanteDoc("");
        setLogObsGeral("");
        setLogAereoOrigem("");
        setLogAereoDestino("");
        setLogAereoDataIda("");
        setLogAereoDataVolta("");
        setLogAereoObs("");
        setLogHotelRegiao("");
        setLogHotelCheckin("");
        setLogHotelCheckout("");
        setLogHotelObs("");
        setLogVeiculoLocacao("Não");
        setLogVeiculoRetiradaLocal("");
        setLogVeiculoDataRetirada("");
        setLogVeiculoDataDevolucao("");
        setLogVeiculoCategoria("Econômico com Ar");
        setLogVeiculoObs("");
        setLogSeguroViagem("Não");
        setLogSeguroObs("");
      } else {
        alert("Erro ao cadastrar atividade: " + (data.error || "Tente novamente."));
      }
    } catch (err) {
      console.error("Erro ao cadastrar nova atividade:", err);
      alert("Erro ao comunicar com o servidor.");
    } finally {
      setSalvandoNovo(false);
    }
  };

  const toggleCard = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleAll = (expand: boolean) => {
    if (!expand) {
      setExpandedIds({});
      return;
    }
    const novo: Record<string, boolean> = {};
    itens.forEach((it) => {
      novo[it.id] = true;
    });
    setExpandedIds(novo);
  };

  const instrutoresLista = useMemo(() => {
    return Array.from(
      new Set(lista.map((it) => it.consultores?.nome).filter(Boolean) as string[])
    ).sort();
  }, [lista]);

  const cidadesLista = useMemo(() => {
    return Array.from(
      new Set(lista.map((it) => it.local).filter(Boolean) as string[])
    ).sort();
  }, [lista]);

  const filtrados = useMemo(() => {
    return lista
      .filter((it) => {
        if (filtroInstrutor && it.consultores?.nome !== filtroInstrutor) {
          return false;
        }
        if (filtroCidade && it.local !== filtroCidade) {
          return false;
        }
        if (filtroLogistica) {
          if (filtroLogistica === "com_viagem") {
            const v = Array.isArray(it.viagens) ? it.viagens[0] : it.viagens;
            if (!v || v.total <= 0) return false;
          } else if (filtroLogistica === "sem_viagem") {
            const v = Array.isArray(it.viagens) ? it.viagens[0] : it.viagens;
            if (v && v.total > 0) return false;
          } else if (filtroLogistica === "presencial" && it.modalidade !== "PRESENCIAL") {
            return false;
          } else if (filtroLogistica === "virtual" && it.modalidade !== "VIRTUAL") {
            return false;
          }
        }
        if (filtroStatus) {
          const st = (it.status || "").toUpperCase();
          if (!st.includes(filtroStatus.toUpperCase())) {
            return false;
          }
        }
        if (busca) {
          const termo = busca.toUpperCase();
          const texto = `${it.projetos?.centros_custo?.codigo ?? ""} ${
            it.projetos?.nome ?? ""
          } ${it.atividade ?? ""} ${it.consultores?.nome ?? ""} ${
            it.local ?? ""
          }`.toUpperCase();
          if (!texto.includes(termo)) return false;
        }
        return true;
      })
      .sort(compararProjetos);
  }, [lista, busca, filtroInstrutor, filtroCidade, filtroLogistica, filtroStatus]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Bloco Congelado / Sticky (KPIs, Competência, Filtros e Cabeçalho de Colunas) */}
      <div className="sticky-control-panel">
        {headerTopContent}

        {/* Faixa de Filtros Operacionais Flutuante */}
        <div className="filter-strip">
        <div className="filter-inputs-group">
          <div className="filter-search-box">
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--outline)" }}>
              search
            </span>
            <input
              type="text"
              placeholder="Filtrar por CC, Projeto, Instrutor, Concessionária ou Cidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-selects-group">
          <div className="select-pill">
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--outline)" }}>
              person
            </span>
            <select
              value={filtroInstrutor}
              onChange={(e) => setFiltroInstrutor(e.target.value)}
            >
              <option value="">Todos os Instrutores</option>
              {instrutoresLista.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>

          <div className="select-pill">
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--outline)" }}>
              location_on
            </span>
            <select
              value={filtroCidade}
              onChange={(e) => setFiltroCidade(e.target.value)}
            >
              <option value="">Todas as Cidades</option>
              {cidadesLista.map((cid) => (
                <option key={cid} value={cid}>
                  {cid}
                </option>
              ))}
            </select>
          </div>

          <div className="select-pill">
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--outline)" }}>
              flag
            </span>
            <select
              value={filtroLogistica}
              onChange={(e) => setFiltroLogistica(e.target.value)}
            >
              <option value="">Modalidade / Viagem</option>
              <option value="com_viagem">Com Despesas de Viagem</option>
              <option value="sem_viagem">Sem Despesas de Viagem</option>
              <option value="presencial">Presencial</option>
              <option value="virtual">Remoto / Virtual</option>
            </select>
          </div>

          <div className="select-pill">
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--outline)" }}>
              verified
            </span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="">Status da Atividade</option>
              <option value="REALIZADO">Realizado</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="CANCELADO">Cancelado</option>
              <option value="PREVISTO">Previsto</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-secondary"
            title="Expandir todos"
            onClick={() => toggleAll(true)}
            style={{ padding: "6px 10px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              unfold_more
            </span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            title="Recolher todos"
            onClick={() => toggleAll(false)}
            style={{ padding: "6px 10px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              unfold_less
            </span>
          </button>

          {(busca || filtroInstrutor || filtroCidade || filtroLogistica || filtroStatus) && (
            <button
              type="button"
              className="btn-secondary"
              title="Limpar Filtros"
              onClick={() => {
                setBusca("");
                setFiltroInstrutor("");
                setFiltroCidade("");
                setFiltroLogistica("");
                setFiltroStatus("");
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                refresh
              </span>
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Guia de Colunas (Table Labels) */}
      <div className="table-labels-guide">
        <div>Projeto & Atividade</div>
        <div>Local / Concessionária</div>
        <div>Período & Horas</div>
        <div>Instrutor / Perfil</div>
        <div className="text-right">Consultor</div>
        <div className="text-right">Faturar</div>
        <div className="text-center">Ações</div>
      </div>
      </div>

      {/* Pilha de Cards Flutuantes */}
      <div className="cards-stack">
        {filtrados.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              backgroundColor: "var(--surface-container-lowest)",
              borderRadius: "12px",
              border: "1px dashed var(--border)",
              color: "var(--on-surface-variant)",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "36px", color: "var(--outline)", marginBottom: "8px" }}
            >
              search_off
            </span>
            <p className="font-body-sm" style={{ fontWeight: 600 }}>Nenhuma atividade encontrada com os filtros atuais.</p>
          </div>
        ) : (
          filtrados.map((it) => {
            const isExpanded = !!expandedIds[it.id];
            const v = Array.isArray(it.viagens) ? it.viagens[0] : it.viagens;
            const presencial = it.modalidade === "PRESENCIAL";
            const diasCalc = it.horas ? (it.horas / 8).toFixed(0) : "—";
            const valorConsultor = it.custo_consultor ?? 0;
            const valorFaturar = it.faturar ?? 0;
            const temLogistica = (v && v.total > 0) || it.precisa_logistica === true;

            const custoAgencia = (v?.custo_1 || 0) + (v?.custo_2 || 0) + (v?.custo_3 || 0) + (v?.custo_4 || 0);
            const custoConsultor = v?.custo_5 || 0;
            const totalViagem = v?.total || (custoAgencia + custoConsultor);

            const ndAgenciaObj = it.notas_debito?.find((n) => n.destino === "agencia");
            const ndConsultorObj = it.notas_debito?.find((n) => n.destino === "consultor");

            const ndAgencia = temLogistica && ndAgenciaObj?.numero && ndAgenciaObj.numero !== "0000" && ndAgenciaObj.numero !== "—"
              ? ndAgenciaObj.numero
              : null;
            const ndConsultor = temLogistica && ndConsultorObj?.numero && ndConsultorObj.numero !== "0000" && ndConsultorObj.numero !== "—"
              ? ndConsultorObj.numero
              : null;

            const temNdVinculada = Boolean(ndAgencia || ndConsultor);

            const valNdAgencia = ndAgencia
              ? (ndAgenciaObj?.valor != null
                  ? Number(ndAgenciaObj.valor)
                  : faturasLogistica.find((f) => f.numeroNota === ndAgencia)?.valor ?? custoAgencia)
              : 0;

            const valNdConsultor = ndConsultor
              ? (ndConsultorObj?.valor != null
                  ? Number(ndConsultorObj.valor)
                  : faturasLogistica.find((f) => f.numeroNota === ndConsultor)?.valor ?? custoConsultor)
              : 0;

            const ehMesmaNd = Boolean(ndAgencia && ndConsultor && ndAgencia === ndConsultor);
            let repasseCalculadoNds = ehMesmaNd
              ? valNdAgencia
              : Math.round((valNdAgencia + valNdConsultor) * 100) / 100;

            if (totalViagem > 0 && repasseCalculadoNds > totalViagem) {
              repasseCalculadoNds = totalViagem;
            }

            // O REPASSE NUNCA PODE SER MAIOR QUE O TOTAL VIAGEM
            let repasseExibicao = (it.repasse && it.repasse > 0)
              ? (totalViagem > 0 ? Math.min(Number(it.repasse), totalViagem) : Number(it.repasse))
              : repasseCalculadoNds;

            if (totalViagem > 0 && repasseExibicao > totalViagem) {
              repasseExibicao = totalViagem;
            }

            // Busca de sugestão inteligente por projeto e valor exato em Faturamento
            const projNomeLimpo = (it.projetos?.nome || "").trim().toUpperCase();
            const ndsProjeto = faturasLogistica.filter((f) => f.projeto === projNomeLimpo);
            const custoTotalViagem = totalViagem || (custoAgencia + custoConsultor);
            const ehCustoComercialInterno =
              projNomeLimpo.includes("PROSPECÇÃO") ||
              projNomeLimpo.includes("PROSPECCAO") ||
              projNomeLimpo.includes("CAMPUS BH") ||
              projNomeLimpo.includes("VEIGA DE ALMEIDA");

            // 1. ND Completa: número NÃO termina com .1 nem .2 (ex: 0857 ou 0848 puro)
            const sugestaoCompleta = (!ndAgencia && !ndConsultor && custoTotalViagem > 0)
              ? ndsProjeto.find((f) => {
                  const num = String(f.numeroNota || "").trim();
                  if (num.endsWith(".1") || num.endsWith(".2")) return false;
                  return Math.abs(f.valor - custoTotalViagem) < 0.05 ||
                         (custoAgencia === 0 && Math.abs(f.valor - custoConsultor) < 0.05) ||
                         (custoConsultor === 0 && Math.abs(f.valor - custoAgencia) < 0.05);
                })
              : null;

            // 2. ND Parcial Agência (.1)
            const sugestaoAgencia = (!ndAgencia && custoAgencia > 0)
              ? ndsProjeto.find((f) => String(f.numeroNota || "").trim().endsWith(".1") && Math.abs(f.valor - custoAgencia) < 0.05)
              : null;

            // 3. ND Parcial Consultor (.2)
            const sugestaoConsultor = (!ndConsultor && custoConsultor > 0)
              ? ndsProjeto.find((f) => String(f.numeroNota || "").trim().endsWith(".2") && Math.abs(f.valor - custoConsultor) < 0.05)
              : null;

            return (
              <div
                key={it.id}
                className={`floating-card-row ${isExpanded ? "expanded" : ""}`}
              >
                {/* Linha Principal da Atividade */}
                <div className="card-main-bar">
                  {/* Col 1: Toggle + Projeto & Atividade + Status da Atividade */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    <button
                      type="button"
                      className={`btn-expand-toggle ${isExpanded ? "active" : ""}`}
                      onClick={() => toggleCard(it.id)}
                      title={isExpanded ? "Recolher detalhes" : "Expandir logística"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        {isExpanded ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                      <div className="project-title-row">
                        <span className="project-title" title={it.projetos?.nome}>
                          {it.projetos?.nome ?? "PROJETO NNÓS"}
                        </span>
                        {/* Status da Atividade na linha da atividade com cores específicas */}
                        {it.status && (
                          <span className={`tag-status-atividade ${statusClasse(it.status)}`}>
                            {it.status}
                          </span>
                        )}
                      </div>
                      <span className="project-activity" title={it.atividade ?? ""}>
                        {capitalizarAtividade(it.atividade)}
                      </span>
                    </div>
                  </div>

                  {/* Col 2: Local / Concessionária */}
                  <div className="col-location">
                    <div
                      className={`col-icon-box ${presencial ? "presencial" : "virtual"}`}
                      title={presencial ? "Presencial" : "Virtual / Remoto"}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "16px" }}
                      >
                        {presencial ? "location_city" : "laptop_chromebook"}
                      </span>
                    </div>
                    <div className="location-info">
                      <strong title={it.local ?? ""}>
                        {it.local || (presencial ? "Presencial" : "Online / Teams")}
                      </strong>
                      <span>Região {it.regiao || "BRA"}</span>
                    </div>
                  </div>

                  {/* Col 3: Período e Duração */}
                  <div className="col-period">
                    <div className="col-icon-box">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "16px" }}
                      >
                        date_range
                      </span>
                    </div>
                    <div className="period-info">
                      <strong>
                        {it.data_inicial ? dataBR(it.data_inicial) : "A Definir"}
                        {it.data_final && it.data_final !== it.data_inicial
                          ? ` a ${dataBR(it.data_final)}`
                          : ""}
                      </strong>
                      <span>
                        {diasCalc !== "—" ? `${diasCalc} dias` : ""}
                        {it.horas ? ` · ${it.horas}h` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Col 4: Instrutor / Perfil */}
                  <div className="col-instructor">
                    <div
                      className={`instructor-avatar ${
                        it.consultores?.tipo || "funcionario"
                      }`}
                    >
                      {it.consultores?.nome
                        ? iniciais(it.consultores.nome)
                        : "NN"}
                    </div>
                    <div className="instructor-info">
                      <strong title={it.consultores?.nome ?? "Sem instrutor"}>
                        {it.consultores?.nome ?? "Sem Consultor"}
                      </strong>
                      {it.perfil ? (
                        <span>Perfil {it.perfil}</span>
                      ) : (
                        <span style={{ color: "var(--outline)" }}>—</span>
                      )}
                    </div>
                  </div>

                  {/* Col 5: Consultor (Valor pago ao instrutor) */}
                  <div className="col-consultor">
                    <span className="financial-value">
                      {brl(valorConsultor)}
                    </span>
                    {(() => {
                      const nomeCons = it.consultores?.nome || "";
                      const isSocio = verificarEhSocio(nomeCons, it.consultores?.tipo);
                      const isComissao = verificarEhComissao(it.atividade);
                      const isExcecao = ["MARCELO LARA", "PEDRO LAGE", "PEDRO COLARES"].some((ex) =>
                        nomeCons.toUpperCase().includes(ex)
                      );

                      if (isSocio && !isComissao && !isExcecao && valorConsultor > 0) {
                        return (
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: "9px",
                              fontWeight: 700,
                              color: "#b45309",
                              background: "rgba(245, 158, 11, 0.12)",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              marginTop: "2px",
                              whiteSpace: "nowrap",
                            }}
                            title="Remuneração inclui acréscimo de +6% para emissão de NF de Consultor Sócio"
                          >
                            +6% NF Sócio
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Col 6: Faturar (Valor de Faturamento) */}
                  <div className="col-faturar">
                    <span className="financial-value">
                      {brl(valorFaturar)}
                    </span>
                  </div>

                  {/* Col 7: Ações (Botão Editar) */}
                  <div className="col-actions">
                    <button
                      type="button"
                      className="btn-card-edit"
                      title="Editar Atividade"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalItem(it);
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                        edit
                      </span>
                      <span>Editar</span>
                    </button>
                  </div>
                </div>

                {/* Drawer Expansível de Detalhamento Logístico */}
                {isExpanded && (
                  <div className="logistics-drawer">
                    <div className="drawer-header">
                      <div className="drawer-title-group">
                        <span
                          className="material-symbols-outlined"
                          style={{ color: "var(--secondary)", fontSize: "20px" }}
                        >
                          flight
                        </span>
                        <h4>Detalhamento Logístico & Despesas de Viagem</h4>
                      </div>

                      <div className="drawer-tags">
                        <div className="drawer-tags-box">
                          <span>Precisa Logística?</span>
                          <strong>{it.precisa_logistica ? "SIM" : "NÃO"}</strong>
                        </div>
                        {v?.agencia && (
                          <div className="drawer-tag-agency">
                            AGÊNCIA: {v.agencia}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Matriz de Custos da Viagem (6 Mini-Cards) */}
                    <div className="logistics-matrix">
                      {/* Item 1: Aéreo */}
                      <div className="cost-box">
                        <div className="cost-box-header">
                          <span>Passagem Aérea</span>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "var(--secondary)" }}
                          >
                            flight
                          </span>
                        </div>
                        <span className="cost-box-value">
                          {brl(v?.custo_1 ?? 0)}
                        </span>
                        <span className="cost-box-note">
                          {v?.custo_1 ? "Emissão e taxas" : "Sem aéreo"}
                        </span>
                      </div>

                      {/* Item 2: Hotel */}
                      <div className="cost-box">
                        <div className="cost-box-header">
                          <span>Hotel / Estadia</span>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "var(--secondary)" }}
                          >
                            hotel
                          </span>
                        </div>
                        <span className="cost-box-value">
                          {brl(v?.custo_2 ?? 0)}
                        </span>
                        <span className="cost-box-note">
                          {v?.custo_2 ? "Hospedagem faturada" : "Sem diárias"}
                        </span>
                      </div>

                      {/* Item 3: Carro */}
                      <div className="cost-box">
                        <div className="cost-box-header">
                          <span>Carro / Translado</span>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "var(--secondary)" }}
                          >
                            directions_car
                          </span>
                        </div>
                        <span className="cost-box-value">
                          {brl(v?.custo_3 ?? 0)}
                        </span>
                        <span className="cost-box-note">
                          {v?.custo_3 ? "Locação / Translado" : "Sem translado"}
                        </span>
                      </div>

                      {/* Item 4: Seguro */}
                      <div className="cost-box">
                        <div className="cost-box-header">
                          <span>Seguro / Outros</span>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "var(--outline)" }}
                          >
                            verified_user
                          </span>
                        </div>
                        <span className="cost-box-value">
                          {brl(v?.custo_4 ?? 0)}
                        </span>
                        <span className="cost-box-note">Apólice internacional</span>
                      </div>

                      {/* Item 5: Diária */}
                      <div className="cost-box">
                        <div className="cost-box-header">
                          <span>Alimentação / Diária</span>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "var(--secondary)" }}
                          >
                            restaurant
                          </span>
                        </div>
                        <span className="cost-box-value">
                          {brl(v?.custo_5 ?? 0)}
                        </span>
                        <span className="cost-box-note">Despesa Consultor</span>
                      </div>

                      {/* Item 6: Total Viagem em Destaque */}
                      <div className="cost-box highlight">
                        <div className="cost-box-header">
                          <span>Total Viagem</span>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "var(--secondary-fixed)" }}
                          >
                            account_balance_wallet
                          </span>
                        </div>
                        <span className="cost-box-value">
                          {brl(v?.total ?? 0)}
                        </span>
                        <span className="cost-box-note">Conciliado 100%</span>
                      </div>
                    </div>

                    {/* Rodapé do Drawer: Prestação de Contas & Observações */}
                    <div className="drawer-footer-bar">
                      {(() => {
                        const infoPrazo = calcularPrazoPrestacaoContas(it.precisa_logistica, it.data_final, v?.custo_5, it.status);
                        return (
                          <div className="accountability-status">
                            <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: infoPrazo.corBg, color: infoPrazo.corTexto, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "18px" }}
                              >
                                {infoPrazo.icone}
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span className="font-label-sm" style={{ color: "var(--on-surface-variant)" }}>
                                {infoPrazo.label}
                              </span>
                              <span
                                className="accountability-badge"
                                style={{
                                  color: infoPrazo.corTexto,
                                  fontWeight: 800,
                                }}
                              >
                                {infoPrazo.badgeTexto}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0 16px" }}>
                        <span className="font-label-sm" style={{ color: "var(--on-surface-variant)" }}>
                          Observações Agência de Viagens
                        </span>
                        <span className="agency-note-snippet" title={formatarObservacoesAgenciaCard(v?.observacao_agencia)}>
                          {formatarObservacoesAgenciaCard(v?.observacao_agencia)}
                        </span>
                      </div>



                      {/* Bloco 1: Campo de REPASSE */}
                      {editandoNdId === it.id ? (
                        <div className="repasse-drawer-box" style={{ border: "1px solid var(--secondary, #00a896)" }}>
                          <span className="font-label-sm" style={{ color: "var(--secondary, #00a896)", fontWeight: 700 }}>
                            Editar Repasse
                          </span>
                          <div className="repasse-input-group">
                            <span className="repasse-currency">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={repasseEditVal}
                              onChange={(e) => setRepasseEditVal(e.target.value)}
                              placeholder="0,00"
                              autoFocus
                            />
                          </div>
                        </div>
                      ) : temNdVinculada ? (
                        <div className="repasse-drawer-box readonly">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                            <span className="font-label-sm">Repasse</span>
                            <span className="badge-auditado-tag" title="Soma automática das NDs vinculadas">
                              <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>verified</span>
                              Auditado
                            </span>
                          </div>
                          <div className="repasse-readonly-badge">
                            <span className="repasse-currency">R$</span>
                            <span className="repasse-val-text">
                              {brl(repasseExibicao).replace("R$", "").trim()}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="repasse-drawer-box readonly">
                          <span className="font-label-sm">Repasse</span>
                          <div className="repasse-readonly-badge">
                            <span className="repasse-currency">R$</span>
                            <span className="repasse-val-text" style={{ color: "var(--on-surface-variant)" }}>
                              {brl(repasseExibicao).replace("R$", "").trim()}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Bloco 2: ND Agência e ND Consultor */}
                      {editandoNdId === it.id ? (
                        <div className="nd-inline-edit-box">
                          <div className="debit-note-item">
                            <span>ND Agência</span>
                            <input
                              type="text"
                              className="debit-note-input"
                              placeholder="0000 ou 0000.1"
                              value={ndEditAgencia}
                              onChange={(e) => setNdEditAgencia(e.target.value)}
                            />
                          </div>
                          <div className="debit-note-item">
                            <span>ND Consultor</span>
                            <input
                              type="text"
                              className="debit-note-input highlight"
                              placeholder="0000 ou 0000.2"
                              value={ndEditConsultor}
                              onChange={(e) => setNdEditConsultor(e.target.value)}
                            />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginLeft: "4px" }}>
                            <button
                              type="button"
                              className="nd-btn-save"
                              onClick={() => handleSalvarEdicaoManualND(it.id)}
                              title="Salvar alterações de ND e Repasse"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>check</span>
                              Salvar
                            </button>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                type="button"
                                className="nd-btn-cancel"
                                onClick={() => setEditandoNdId(null)}
                                title="Cancelar edição"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="nd-btn-unlink"
                                onClick={() => handleDesvincularNDs(it.id, true)}
                                title="Desvincular e remover todas as NDs desta atividade"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>link_off</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : temNdVinculada ? (
                        <div className="debit-notes-group readonly">
                          <div className="debit-note-item">
                            <span>ND Agência</span>
                            <div
                              className={`debit-note-badge ${ndAgencia ? "active" : "empty"}`}
                              title={ndAgencia ? `ND Agência: ${ndAgencia} (${brl(valNdAgencia)})${ehMesmaNd ? " [ND Completa]" : ""}` : "Sem ND da Agência"}
                            >
                              {ndAgencia || "—"}
                            </div>
                          </div>
                          <div className="debit-note-item">
                            <span>ND Consultor</span>
                            <div
                              className={`debit-note-badge highlight ${ndConsultor ? "active" : "empty"}`}
                              title={ndConsultor ? `ND Consultor: ${ndConsultor} (${brl(valNdConsultor)})${ehMesmaNd ? " [ND Completa]" : ""}` : "Sem ND do Consultor"}
                            >
                              {ndConsultor || "—"}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-editar-nd-action"
                            title="Retificar números de ND, alterar valores ou desvincular"
                            onClick={() => handleIniciarEdicaoND(it.id, ndAgencia, ndConsultor, repasseExibicao, it.repasse)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>edit</span>
                            <span>Editar</span>
                          </button>
                        </div>
                      ) : ehCustoComercialInterno ? (
                        <div className="debit-notes-group readonly">
                          <span className="badge-comercial-interno" title="Custo comercial interno da NNÓS (não faturável a cliente)">
                            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>business</span>
                            Custo Comercial Interno
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div className="debit-notes-group readonly">
                            <div className="debit-note-item">
                              <span>ND Agência</span>
                              <div className="debit-note-badge empty">—</div>
                            </div>
                            <div className="debit-note-item">
                              <span>ND Consultor</span>
                              <div className="debit-note-badge empty">—</div>
                            </div>
                            <button
                              type="button"
                              className="btn-editar-nd-action"
                              title="Vincular ND manualmente"
                              onClick={() => handleIniciarEdicaoND(it.id, null, null, 0, it.repasse)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>add_link</span>
                              <span>Vincular</span>
                            </button>
                          </div>

                          {/* Pílula de vinculação rápida de 1 clique quando houver correspondência exata */}
                          {(sugestaoCompleta || sugestaoConsultor || sugestaoAgencia) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              {sugestaoCompleta && (
                                <button
                                  type="button"
                                  className="btn-sugestao-nd"
                                  onClick={() =>
                                    handleVincularNDAuto(
                                      it.id,
                                      "ambos",
                                      sugestaoCompleta.numeroNota,
                                      sugestaoCompleta.valor,
                                      sugestaoCompleta.valor
                                    )
                                  }
                                  title={`Vincular ND Completa ${sugestaoCompleta.numeroNota} encontrada no Faturamento (${brl(sugestaoCompleta.valor)}) nos 2 campos (Agência e Consultor)`}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>auto_awesome</span>
                                  <span>✨ Vincular ND Completa {sugestaoCompleta.numeroNota} ({brl(sugestaoCompleta.valor)})</span>
                                </button>
                              )}
                              {sugestaoConsultor && !sugestaoCompleta && (
                                <button
                                  type="button"
                                  className="btn-sugestao-nd"
                                  onClick={() =>
                                    handleVincularNDAuto(
                                      it.id,
                                      "consultor",
                                      sugestaoConsultor.numeroNota,
                                      sugestaoConsultor.valor,
                                      (valNdAgencia || 0) + sugestaoConsultor.valor
                                    )
                                  }
                                  title={`Vincular ND Consultor ${sugestaoConsultor.numeroNota} encontrada no Faturamento (${brl(sugestaoConsultor.valor)})`}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>auto_awesome</span>
                                  <span>✨ Vincular ND Consultor {sugestaoConsultor.numeroNota} ({brl(sugestaoConsultor.valor)})</span>
                                </button>
                              )}
                              {sugestaoAgencia && !sugestaoCompleta && (
                                <button
                                  type="button"
                                  className="btn-sugestao-nd"
                                  onClick={() =>
                                    handleVincularNDAuto(
                                      it.id,
                                      "agencia",
                                      sugestaoAgencia.numeroNota,
                                      sugestaoAgencia.valor,
                                      (valNdConsultor || 0) + sugestaoAgencia.valor
                                    )
                                  }
                                  title={`Vincular ND Agência ${sugestaoAgencia.numeroNota} encontrada no Faturamento (${brl(sugestaoAgencia.valor)})`}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>auto_awesome</span>
                                  <span>✨ Vincular ND Agência {sugestaoAgencia.numeroNota} ({brl(sugestaoAgencia.valor)})</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé / Estatísticas */}
      <div className="pagination-strip">
        <div>
          Exibindo <strong>{filtrados.length}</strong> de{" "}
          <strong>{itens.length}</strong> atividades cadastradas
        </div>
        <div>
          Total:{" "}
          <strong style={{ color: "var(--on-surface)" }}>
            {brl(
              filtrados.reduce((acc, cur) => {
                const isCancel = (cur.status || "").toUpperCase().includes("CANCEL");
                if (!filtroStatus && isCancel) return acc;
                return acc + (cur.faturar || 0) + (cur.repasse || 0);
              }, 0)
            )}
          </strong>
        </div>
      </div>

      {/* Modal de Edição da Atividade (Botão Editar) */}
      {modalItem && (
        <div className="modal-backdrop" onClick={() => setModalItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                  edit_note
                </span>
                <span>Editar Atividade Operacional</span>
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setModalItem(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSalvarModal} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              <div className="modal-body" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                {/* Projeto com Busca Dinâmica e Scroll (Editável) */}
                <div className="form-field">
                  <label>Projeto *</label>
                  <div className="searchable-select">
                    <div className="searchable-input-wrapper">
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--outline)" }}>
                        search
                      </span>
                      <input
                        type="text"
                        placeholder={modalProjetoSelecionado ? modalProjetoSelecionado.nome : "Digite para buscar ou clique para listar projetos..."}
                        value={modalDropdownProjetoAberto ? modalProjetoBusca : (modalProjetoSelecionado ? modalProjetoSelecionado.nome : "")}
                        onChange={(e) => {
                          setModalProjetoBusca(e.target.value);
                          setModalDropdownProjetoAberto(true);
                        }}
                        onFocus={() => {
                          setModalDropdownProjetoAberto(true);
                          setModalProjetoBusca("");
                        }}
                      />
                      {modalProjetoSelecionado && (
                        <button
                          type="button"
                          className="btn-modal-close"
                          style={{ padding: "2px" }}
                          onClick={() => {
                            setModalProjetoSelecionado(null);
                            setModalProjetoBusca("");
                          }}
                          title="Limpar seleção"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                        </button>
                      )}
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "18px", color: "var(--outline)", cursor: "pointer" }}
                        onClick={() => setModalDropdownProjetoAberto(!modalDropdownProjetoAberto)}
                      >
                        {modalDropdownProjetoAberto ? "arrow_drop_up" : "arrow_drop_down"}
                      </span>
                    </div>

                    {modalDropdownProjetoAberto && (
                      <div className="searchable-menu">
                        {modalProjetosFiltrados.length === 0 ? (
                          <div style={{ padding: "10px 12px", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                            Nenhum projeto encontrado
                          </div>
                        ) : (
                          modalProjetosFiltrados.map((p) => {
                            const isSelected = modalProjetoSelecionado?.id === p.id;
                            return (
                              <div
                                key={p.id}
                                className={`searchable-item ${isSelected ? "selected" : ""}`}
                                onClick={() => {
                                  setModalProjetoSelecionado(p);
                                  setModalDropdownProjetoAberto(false);
                                  setModalProjetoBusca("");
                                }}
                              >
                                {p.nome}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-field">
                  <label>Atividade Operacional *</label>
                  <input
                    type="text"
                    name="atividade"
                    placeholder="Ex: Treinamento Especial, Workshop..."
                    required
                    autoComplete="off"
                    list="sugestoes-atividades-edit"
                    value={modalAtividadeTexto}
                    onChange={(e) => setModalAtividadeTexto(capitalizarPrimeiraMaiuscula(e.target.value))}
                  />
                  <datalist id="sugestoes-atividades-edit">
                    <option value="Treinamento" />
                    <option value="Workshop" />
                  </datalist>
                </div>

                <div className="modal-grid-2">
                  <div className="form-field">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <label>Consultor / Instrutor</label>
                      <button
                        type="button"
                        className="btn-mini-add"
                        onClick={() => setModalNovoConsultorAberto(true)}
                        title="Cadastrar novo consultor na base"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                        <span>Novo</span>
                      </button>
                    </div>
                    <div className="searchable-select">
                      <div className="searchable-input-wrapper">
                        <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--outline)" }}>
                          search
                        </span>
                        <input
                          type="text"
                          placeholder={modalConsultorSelecionado ? `${modalConsultorSelecionado.nome} ${modalConsultorSelecionado.perfil ? `(${modalConsultorSelecionado.perfil})` : ""}` : "Digite para buscar consultor..."}
                          value={modalDropdownConsultorAberto ? modalConsultorBusca : (modalConsultorSelecionado ? `${modalConsultorSelecionado.nome} ${modalConsultorSelecionado.perfil ? `(${modalConsultorSelecionado.perfil})` : ""}` : "")}
                          onChange={(e) => {
                            setModalConsultorBusca(e.target.value);
                            setModalDropdownConsultorAberto(true);
                          }}
                          onFocus={() => {
                            setModalDropdownConsultorAberto(true);
                            setModalConsultorBusca("");
                          }}
                        />
                        {modalConsultorSelecionado && (
                          <button
                            type="button"
                            className="btn-modal-close"
                            style={{ padding: "2px" }}
                            onClick={() => {
                              handleSelecionarConsultorModal("");
                              setModalConsultorBusca("");
                            }}
                            title="Limpar seleção"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                          </button>
                        )}
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "18px", color: "var(--outline)", cursor: "pointer" }}
                          onClick={() => setModalDropdownConsultorAberto(!modalDropdownConsultorAberto)}
                        >
                          {modalDropdownConsultorAberto ? "arrow_drop_up" : "arrow_drop_down"}
                        </span>
                      </div>

                      {modalDropdownConsultorAberto && (
                        <div className="searchable-menu">
                          <div
                            className={`searchable-item ${!modalConsultorSelecionadoId ? "selected" : ""}`}
                            onClick={() => {
                              handleSelecionarConsultorModal("");
                              setModalDropdownConsultorAberto(false);
                              setModalConsultorBusca("");
                            }}
                          >
                            Sem Consultor / A Definir
                          </div>
                          {modalConsultoresFiltrados.length === 0 ? (
                            <div style={{ padding: "10px 12px", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                              Nenhum consultor encontrado
                            </div>
                          ) : (
                            modalConsultoresFiltrados.map((c) => {
                              const isSelected = modalConsultorSelecionadoId === c.id;
                              return (
                                <div
                                  key={c.id}
                                  className={`searchable-item ${isSelected ? "selected" : ""}`}
                                  onClick={() => {
                                    handleSelecionarConsultorModal(c.id);
                                    setModalDropdownConsultorAberto(false);
                                    setModalConsultorBusca("");
                                  }}
                                >
                                  {c.nome} {c.perfil ? `(${c.perfil})` : ""}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Perfil do Instrutor</label>
                    <select
                      name="perfil"
                      value={modalPerfilSelecionado}
                      onChange={(e) => setModalPerfilSelecionado(e.target.value)}
                    >
                      <option value="">Selecione um perfil...</option>
                      <option value="SÊNIOR">SÊNIOR</option>
                      <option value="PLENO">PLENO</option>
                      <option value="JÚNIOR">JÚNIOR</option>
                    </select>
                  </div>
                </div>

                <div className="modal-grid-2">
                  <div className="form-field">
                    <label>Modalidade</label>
                    <select name="modalidade" defaultValue={modalItem.modalidade || "PRESENCIAL"}>
                      <option value="PRESENCIAL">Presencial</option>
                      <option value="VIRTUAL">Virtual / Remoto</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Status da Atividade</label>
                    <select name="status" defaultValue={modalItem.status || "CONFIRMADO"}>
                      <option value="CONFIRMADO">Confirmado</option>
                      <option value="REALIZADO">Realizado</option>
                      <option value="PREVISTO">Previsto</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="modal-grid-2">
                  <div className="form-field">
                    <label>Local / Concessionária</label>
                    <input
                      type="text"
                      name="local"
                      placeholder="Ex: São Paulo - SP / Filial"
                      autoComplete="off"
                      list="sugestoes-locais-edit"
                      value={modalLocalTexto}
                      onChange={(e) => setModalLocalTexto(e.target.value)}
                    />
                    <datalist id="sugestoes-locais-edit">
                      <option value="SOROCABA-SP" />
                    </datalist>
                  </div>
                  <div className="form-field">
                    <label>Região</label>
                    <select
                      name="regiao"
                      value={modalRegiao}
                      onChange={(e) => setModalRegiao(e.target.value as "BRA" | "LATAM")}
                    >
                      <option value="BRA">BRA (Brasil)</option>
                      <option value="LATAM">LATAM (América Latina)</option>
                    </select>
                  </div>
                </div>

                <div className="modal-grid-3">
                  <div className="form-field">
                    <label>Data Inicial</label>
                    <input
                      type="date"
                      name="data_inicial"
                      value={modalDataInicial}
                      onChange={(e) => setModalDataInicial(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Data Final</label>
                    <input
                      type="date"
                      name="data_final"
                      value={modalDataFinal}
                      onChange={(e) => setModalDataFinal(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Carga Horária (h)</label>
                    <input
                      type="number"
                      step="1"
                      name="horas"
                      placeholder="Ex: 8"
                      value={modalHoras}
                      onChange={(e) => setModalHoras(e.target.value)}
                    />
                  </div>
                </div>

                {/* Banner de Aviso de Período Bloqueado pelo Consultor */}
                {conflitoBloqueioModal && (
                  <div
                    style={{
                      marginTop: "-4px",
                      marginBottom: "12px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#fffbeb",
                      border: "1px solid #f59e0b",
                      color: "#92400e",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: "#d97706", fontSize: "20px", flexShrink: 0 }}>
                      event_busy
                    </span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: "block", color: "#b45309", marginBottom: "2px" }}>
                        ⚠️ Período Bloqueado pelo Consultor
                      </strong>
                      <span>
                        Este período ({formatarPeriodoBR(conflitoBloqueioModal.dataInicial, conflitoBloqueioModal.dataFinal)}) está bloqueado pelo consultor <strong>{conflitoBloqueioModal.consultorNome}</strong> para <strong>{conflitoBloqueioModal.motivo}</strong> ou momento off.
                      </span>
                      {conflitoBloqueioModal.observacoes && (
                        <span style={{ display: "block", fontSize: "11px", fontStyle: "italic", marginTop: "4px", color: "#78350f" }}>
                          Obs: {conflitoBloqueioModal.observacoes}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Card Assistente de Tabela de Preços e Custo Consultor */}
                <div
                  style={{
                    background: calculoTabelaModal.ehContratoTabelado ? "rgba(0, 131, 202, 0.05)" : "rgba(100, 116, 139, 0.05)",
                    border: `1px solid ${calculoTabelaModal.ehContratoTabelado ? "rgba(0, 131, 202, 0.3)" : "rgba(100, 116, 139, 0.2)"}`,
                    borderRadius: "10px",
                    padding: "10px 14px",
                    marginBottom: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: calculoTabelaModal.ehContratoTabelado ? "#0083ca" : "#64748b" }}>
                        request_quote
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: calculoTabelaModal.ehContratoTabelado ? "#0083ca" : "var(--on-surface)" }}>
                        Tabela de Preços: {calculoTabelaModal.contratoNome} ({anoAtividadeModal})
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: calculoTabelaModal.ehContratoTabelado ? "rgba(0, 131, 202, 0.15)" : "rgba(100, 116, 139, 0.15)",
                          color: calculoTabelaModal.ehContratoTabelado ? "#0083ca" : "#64748b",
                        }}
                      >
                        {calculoTabelaModal.contratoCodigo}
                      </span>
                    </div>

                    {calculoTabelaModal.ehContratoTabelado && calculoTabelaModal.totalFaturar != null && (
                      <button
                        type="button"
                        onClick={() => {
                          if (calculoTabelaModal.totalFaturar != null) {
                            setModalFaturar(formatarMoedaValor(calculoTabelaModal.totalFaturar));
                          }
                          if (calculoTabelaModal.totalCustoConsultor != null) {
                            setModalCustoConsultor(formatarMoedaValor(calculoTabelaModal.totalCustoConsultor));
                          }
                        }}
                        style={{
                          background: "#0083ca",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Atualizar os campos Faturar e Consultor com base na Tabela do Contrato"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>sync</span>
                        Aplicar Tabela do Contrato
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "16px", fontSize: "11.5px", color: "var(--on-surface-variant)", flexWrap: "wrap", alignItems: "center" }}>
                    <span>
                      <strong>Cliente:</strong> {calculoTabelaModal.valorHoraCliente != null ? `R$ ${calculoTabelaModal.valorHoraCliente.toFixed(2).replace(".", ",")}/h` : "N/A"}
                      {calculoTabelaModal.valorDiaCliente != null && ` (Ref. dia 8h: R$ ${calculoTabelaModal.valorDiaCliente.toFixed(2).replace(".", ",")})`}
                    </span>
                    <span>
                      <strong>Consultor:</strong> {calculoTabelaModal.tarifaConsultorFinal != null ? `R$ ${calculoTabelaModal.tarifaConsultorFinal.toFixed(2).replace(".", ",")}/h` : "N/A"}
                      {calculoTabelaModal.ehSocio && (
                        <span
                          style={{
                            marginLeft: "6px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: 700,
                            background: calculoTabelaModal.ehComissao ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: calculoTabelaModal.ehComissao ? "#059669" : "#d97706",
                          }}
                        >
                          {calculoTabelaModal.ehComissao ? "Sócio: isento +6% (COMISSÃO)" : "Sócio: +6% NF incluso"}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="modal-grid-3">
                  <div className="form-field">
                    <label>Consultor (R$)</label>
                    <input
                      type="text"
                      name="custo_consultor"
                      placeholder="0,00"
                      value={modalCustoConsultor}
                      onChange={(e) => {
                        tratarInputMoeda(e);
                        setModalCustoConsultor(e.target.value);
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label>Faturar (R$)</label>
                    <input
                      type="text"
                      name="faturar"
                      placeholder="0,00"
                      value={modalFaturar}
                      onChange={(e) => {
                        tratarInputMoeda(e);
                        setModalFaturar(e.target.value);
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label title="Preenchido exclusivamente através das ND's conciliadas">Repasse (R$) <span style={{ fontSize: "10px", fontWeight: 400, color: "var(--on-surface-variant)" }}>(via NDs)</span></label>
                    <input
                      type="text"
                      name="repasse"
                      placeholder="0,00"
                      defaultValue={formatarMoedaValor(modalItem.repasse)}
                      readOnly
                      style={{ background: "var(--surface-container-high, #f1f5f9)", color: "var(--on-surface-variant, #64748b)", cursor: "not-allowed" }}
                      title="Este campo é calculado automaticamente pelas Notas de Débito conciliadas"
                    />
                  </div>
                </div>

                {/* Demanda Logística Compacta + Agência ao Lado (Idêntico a Nova Atividade) */}
                <div className="modal-grid-2">
                  <div className="form-field">
                    <label>Demanda Logística?</label>
                    <select
                      name="precisa_logistica"
                      value={modalDemandaLogistica ? "true" : "false"}
                      onChange={(e) => {
                        const val = e.target.value === "true";
                        setModalDemandaLogistica(val);
                        if (!val) setModalAgencia("");
                      }}
                    >
                      <option value="false">Não</option>
                      <option value="true">Sim (Viagens / Hospedagem)</option>
                    </select>
                  </div>

                  {modalDemandaLogistica && (
                    <div className="form-field">
                      <label>Agência de Viagens *</label>
                      <select
                        name="agencia"
                        value={modalAgencia}
                        onChange={(e) => setModalAgencia(e.target.value)}
                        required
                      >
                        <option value="" disabled>Selecione a Agência...</option>
                        <option value="FÁTIMA">FÁTIMA</option>
                        <option value="ALIVE">ALIVE</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Painel Estruturado de Logística para Orientar a Agência */}
                {modalDemandaLogistica && (
                  <div className="logistics-instruction-panel">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>flight</span>
                        Orientações para Agência {modalAgencia ? `(${modalAgencia})` : ""}
                      </strong>
                      <span style={{ fontSize: "11px", color: "var(--primary)", fontWeight: 600 }}>
                        Período Integral da Viagem (Ida e Volta)
                      </span>
                    </div>

                      {/* Bloco Passageiro */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "10px", borderBottom: "1px dashed var(--border)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "10px", width: "100%" }}>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Nome Passageiro</label>
                            <input
                              type="text"
                              placeholder="Nome Completo do Passageiro"
                              value={modalLogPassageiroNome}
                              onChange={(e) => setModalLogPassageiroNome(e.target.value)}
                            />
                          </div>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Documento (RG/CPF)</label>
                            <input
                              type="text"
                              placeholder="000.000.000-00"
                              value={modalLogPassageiroDoc}
                              onChange={(e) => setModalLogPassageiroDoc(e.target.value)}
                            />
                          </div>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Viagem</label>
                            <select
                              value={modalLogTipoViagem}
                              onChange={(e) => setModalLogTipoViagem(e.target.value as "Sozinho" | "Acompanhado")}
                            >
                              <option value="Sozinho">Sozinho</option>
                              <option value="Acompanhado">Acompanhado</option>
                            </select>
                          </div>
                        </div>

                        {modalLogTipoViagem === "Acompanhado" && (
                          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "10px", background: "var(--surface-container-high)", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                            <div className="form-field">
                              <label style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 700 }}>Nome do Acompanhante</label>
                              <input
                                type="text"
                                placeholder="Nome Completo do Acompanhante"
                                value={modalLogAcompanhanteNome}
                                onChange={(e) => setModalLogAcompanhanteNome(e.target.value)}
                              />
                            </div>
                            <div className="form-field">
                              <label style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 700 }}>Documento (RG/CPF)</label>
                              <input
                                type="text"
                                placeholder="000.000.000-00"
                                value={modalLogAcompanhanteDoc}
                                onChange={(e) => setModalLogAcompanhanteDoc(e.target.value)}
                              />
                            </div>
                          </div>
                        )}

                        <div className="form-field" style={{ marginTop: "-2px" }}>
                          <label style={{ fontSize: "10px" }}>OBS Passageiro (Ex: Sem bagagem despachada)</label>
                          <input
                            type="text"
                            placeholder="Ex: Sem bagagem despachada, mala de mão apenas..."
                            value={modalLogObsGeral}
                            onChange={(e) => setModalLogObsGeral(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Bloco Aéreo */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="logistics-section-tag aereo">AÉREO</span>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", fontWeight: 500 }}>Passagens e voos</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Origem (Cidade / Aeroporto)</label>
                            <input
                              type="text"
                              placeholder="Ex: João Pessoa JPA"
                              value={modalLogAereoOrigem}
                              onChange={(e) => setModalLogAereoOrigem(e.target.value)}
                            />
                          </div>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Destino (Cidade / Aeroporto)</label>
                            <input
                              type="text"
                              placeholder="Ex: Goiânia GYN"
                              value={modalLogAereoDestino}
                              onChange={(e) => setModalLogAereoDestino(e.target.value)}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px" }}>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Data Ida</label>
                            <input
                              type="date"
                              value={modalLogAereoDataIda}
                              onChange={(e) => setModalLogAereoDataIda(e.target.value)}
                            />
                          </div>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Preferência Ida</label>
                            <select
                              value={modalLogAereoPrefIda}
                              onChange={(e) => setModalLogAereoPrefIda(e.target.value)}
                            >
                              <option value="Manhã">Manhã</option>
                              <option value="Tarde">Tarde</option>
                              <option value="Noite">Noite</option>
                              <option value="Indiferente">Indiferente</option>
                            </select>
                          </div>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Data Volta</label>
                            <input
                              type="date"
                              value={modalLogAereoDataVolta}
                              onChange={(e) => setModalLogAereoDataVolta(e.target.value)}
                            />
                          </div>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Preferência Volta</label>
                            <select
                              value={modalLogAereoPrefVolta}
                              onChange={(e) => setModalLogAereoPrefVolta(e.target.value)}
                            >
                              <option value="Noite">Noite</option>
                              <option value="Tarde">Tarde</option>
                              <option value="Manhã">Manhã</option>
                              <option value="Indiferente">Indiferente</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>OBS Aéreo (Ex: Voo precisa chegar antes das 13:00)</label>
                          <input
                            type="text"
                            placeholder="Ex: Voo precisa chegar no destino antes das 13:00."
                            value={modalLogAereoObs}
                            onChange={(e) => setModalLogAereoObs(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Bloco Hotel */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="logistics-section-tag hotel">HOTEL</span>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", fontWeight: 500 }}>Hospedagem</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "10px" }}>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Região / Cidade</label>
                            <input
                              type="text"
                              placeholder="Ex: Caldas Novas / Centro"
                              value={modalLogHotelRegiao}
                              onChange={(e) => setModalLogHotelRegiao(e.target.value)}
                            />
                          </div>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Check-in</label>
                            <input
                              type="date"
                              value={modalLogHotelCheckin}
                              onChange={(e) => setModalLogHotelCheckin(e.target.value)}
                            />
                          </div>
                          <div className="form-field">
                            <label style={{ fontSize: "10px" }}>Check-out</label>
                            <input
                              type="date"
                              value={modalLogHotelCheckout}
                              onChange={(e) => setModalLogHotelCheckout(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>OBS Hotel (Ex: Hotel Hot Star Thermas, de preferência)</label>
                          <input
                            type="text"
                            placeholder="Ex: Hotel Hot Star Thermas, de preferência..."
                            value={modalLogHotelObs}
                            onChange={(e) => setModalLogHotelObs(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Bloco Veículo */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="logistics-section-tag veiculo">VEÍCULO</span>
                            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", fontWeight: 500 }}>Locação de veículo</span>
                          </div>
                          <div className="form-field" style={{ minWidth: "140px" }}>
                            <label style={{ fontSize: "10px" }}>Locar Veículo?</label>
                            <select
                              value={modalLogVeiculoLocacao}
                              onChange={(e) => setModalLogVeiculoLocacao(e.target.value as "Sim" | "Não")}
                            >
                              <option value="Não">Não</option>
                              <option value="Sim">Sim</option>
                            </select>
                          </div>
                        </div>

                        {modalLogVeiculoLocacao === "Sim" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "10px" }}>
                              <div className="form-field">
                                <label style={{ fontSize: "10px" }}>Cidade / Local de Retirada</label>
                                <input
                                  type="text"
                                  placeholder="Ex: Aeroporto JPA / Balcão Localiza"
                                  value={modalLogVeiculoRetiradaLocal}
                                  onChange={(e) => setModalLogVeiculoRetiradaLocal(e.target.value)}
                                />
                              </div>
                              <div className="form-field">
                                <label style={{ fontSize: "10px" }}>Data / Hora Retirada</label>
                                <input
                                  type="datetime-local"
                                  value={modalLogVeiculoDataRetirada}
                                  onChange={(e) => setModalLogVeiculoDataRetirada(e.target.value)}
                                />
                              </div>
                              <div className="form-field">
                                <label style={{ fontSize: "10px" }}>Data / Hora Devolução</label>
                                <input
                                  type="datetime-local"
                                  value={modalLogVeiculoDataDevolucao}
                                  onChange={(e) => setModalLogVeiculoDataDevolucao(e.target.value)}
                                />
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "10px" }}>
                              <div className="form-field">
                                <label style={{ fontSize: "10px" }}>Categoria / Modelo</label>
                                <select
                                  value={modalLogVeiculoCategoria}
                                  onChange={(e) => setModalLogVeiculoCategoria(e.target.value)}
                                >
                                  <option value="Econômico com Ar">Econômico com Ar</option>
                                  <option value="Sedan Compacto / Médio">Sedan Compacto / Médio</option>
                                  <option value="SUV">SUV</option>
                                  <option value="Van / Executivo">Van / Executivo</option>
                                  <option value="Indiferente">Indiferente</option>
                                </select>
                              </div>
                              <div className="form-field">
                                <label style={{ fontSize: "10px" }}>OBS Veículo</label>
                                <input
                                  type="text"
                                  placeholder="Ex: Condutor adicional..."
                                  value={modalLogVeiculoObs}
                                  onChange={(e) => setModalLogVeiculoObs(e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div style={{ display: "inline-flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmandoExclusaoId === modalItem.id) {
                        handleExcluirAtividade(modalItem.id, modalItem.atividade || "");
                      } else {
                        setConfirmandoExclusaoId(modalItem.id);
                      }
                    }}
                    disabled={salvandoModal || excluindoId === modalItem.id}
                    title="Excluir esta atividade permanentemente"
                    style={{
                      backgroundColor: confirmandoExclusaoId === modalItem.id ? "#dc2626" : "#fee2e2",
                      color: confirmandoExclusaoId === modalItem.id ? "#ffffff" : "#b91c1c",
                      border: confirmandoExclusaoId === modalItem.id ? "1px solid #b91c1c" : "1px solid #fecaca",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      {confirmandoExclusaoId === modalItem.id ? "warning" : "delete"}
                    </span>
                    <span>
                      {excluindoId === modalItem.id
                        ? "Excluindo..."
                        : confirmandoExclusaoId === modalItem.id
                        ? "Confirmar Exclusão?"
                        : "Excluir"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicarAtividade(modalItem)}
                    disabled={salvandoModal}
                    title="Duplicar dados desta atividade para lançar uma nova rapidamente"
                    style={{
                      backgroundColor: "#e0f2fe",
                      color: "#0369a1",
                      border: "1px solid #bae6fd",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>content_copy</span>
                    <span>Duplicar</span>
                  </button>
                </div>

                <div style={{ display: "inline-flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setModalItem(null)}
                    disabled={salvandoModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={salvandoModal}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      save
                    </span>
                    <span>{salvandoModal ? "Salvando..." : "Salvar Alterações"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Criação de Nova Atividade */}
      {modalNovoAberto && (
        <div className="modal-backdrop" onClick={() => { setModalNovoAberto(false); setDadosDuplicacao(null); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                  add_circle
                </span>
                <span>{dadosDuplicacao ? "Nova Atividade (Duplicada)" : "Nova Atividade"}</span>
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => { setModalNovoAberto(false); setDadosDuplicacao(null); }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form key={dadosDuplicacao ? "duplicado" : "novo"} onSubmit={handleCriarNovaAtividade} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              <div className="modal-body" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                {/* Projeto com Busca Dinâmica e Scroll */}
                <div className="form-field">
                  <label>Projeto *</label>
                  <div className="searchable-select">
                    <div className="searchable-input-wrapper">
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--outline)" }}>
                        search
                      </span>
                      <input
                        type="text"
                        placeholder={projetoSelecionado ? projetoSelecionado.nome : "Digite para buscar ou clique para listar projetos..."}
                        value={dropdownProjetoAberto ? projetoBusca : (projetoSelecionado ? projetoSelecionado.nome : "")}
                        onChange={(e) => {
                          setProjetoBusca(e.target.value);
                          setDropdownProjetoAberto(true);
                        }}
                        onFocus={() => {
                          setDropdownProjetoAberto(true);
                          setProjetoBusca("");
                        }}
                      />
                      {projetoSelecionado && (
                        <button
                          type="button"
                          className="btn-modal-close"
                          style={{ padding: "2px" }}
                          onClick={() => {
                            setProjetoSelecionado(null);
                            setProjetoBusca("");
                          }}
                          title="Limpar seleção"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                        </button>
                      )}
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "18px", color: "var(--outline)", cursor: "pointer" }}
                        onClick={() => setDropdownProjetoAberto(!dropdownProjetoAberto)}
                      >
                        {dropdownProjetoAberto ? "arrow_drop_up" : "arrow_drop_down"}
                      </span>
                    </div>

                    {dropdownProjetoAberto && (
                      <div className="searchable-menu">
                        {projetosFiltrados.length === 0 ? (
                          <div style={{ padding: "10px 12px", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                            Nenhum projeto encontrado
                          </div>
                        ) : (
                          projetosFiltrados.map((p) => {
                            const isSelected = projetoSelecionado?.id === p.id;
                            return (
                              <div
                                key={p.id}
                                className={`searchable-item ${isSelected ? "selected" : ""}`}
                                onClick={() => {
                                  setProjetoSelecionado(p);
                                  setDropdownProjetoAberto(false);
                                  setProjetoBusca("");
                                }}
                              >
                                {p.nome}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-field">
                  <label>Atividade Operacional *</label>
                  <input
                    type="text"
                    name="atividade"
                    placeholder="Ex: Treinamento Especial, Workshop..."
                    required
                    autoComplete="off"
                    list="sugestoes-atividades"
                    value={atividadeTexto}
                    onChange={(e) => setAtividadeTexto(capitalizarPrimeiraMaiuscula(e.target.value))}
                  />
                  <datalist id="sugestoes-atividades">
                    <option value="Treinamento" />
                    <option value="Workshop" />
                  </datalist>
                </div>

                <div className="modal-grid-2">
                  <div className="form-field">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <label>Consultor / Instrutor</label>
                      <button
                        type="button"
                        className="btn-mini-add"
                        onClick={() => setModalNovoConsultorAberto(true)}
                        title="Cadastrar novo consultor na base"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                        <span>Novo</span>
                      </button>
                    </div>
                    <div className="searchable-select">
                      <div className="searchable-input-wrapper">
                        <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--outline)" }}>
                          search
                        </span>
                        <input
                          type="text"
                          placeholder={consultorSelecionado ? `${consultorSelecionado.nome} ${consultorSelecionado.perfil ? `(${consultorSelecionado.perfil})` : ""}` : "Digite para buscar consultor..."}
                          value={dropdownConsultorAberto ? consultorBusca : (consultorSelecionado ? `${consultorSelecionado.nome} ${consultorSelecionado.perfil ? `(${consultorSelecionado.perfil})` : ""}` : "")}
                          onChange={(e) => {
                            setConsultorBusca(e.target.value);
                            setDropdownConsultorAberto(true);
                          }}
                          onFocus={() => {
                            setDropdownConsultorAberto(true);
                            setConsultorBusca("");
                          }}
                        />
                        {consultorSelecionado && (
                          <button
                            type="button"
                            className="btn-modal-close"
                            style={{ padding: "2px" }}
                            onClick={() => {
                              handleSelecionarConsultor("");
                              setConsultorBusca("");
                            }}
                            title="Limpar seleção"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                          </button>
                        )}
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "18px", color: "var(--outline)", cursor: "pointer" }}
                          onClick={() => setDropdownConsultorAberto(!dropdownConsultorAberto)}
                        >
                          {dropdownConsultorAberto ? "arrow_drop_up" : "arrow_drop_down"}
                        </span>
                      </div>

                      {dropdownConsultorAberto && (
                        <div className="searchable-menu">
                          <div
                            className={`searchable-item ${!consultorSelecionadoId ? "selected" : ""}`}
                            onClick={() => {
                              handleSelecionarConsultor("");
                              setDropdownConsultorAberto(false);
                              setConsultorBusca("");
                            }}
                          >
                            Sem Consultor / A Definir
                          </div>
                          {consultoresFiltrados.length === 0 ? (
                            <div style={{ padding: "10px 12px", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                              Nenhum consultor encontrado
                            </div>
                          ) : (
                            consultoresFiltrados.map((c) => {
                              const isSelected = consultorSelecionadoId === c.id;
                              return (
                                <div
                                  key={c.id}
                                  className={`searchable-item ${isSelected ? "selected" : ""}`}
                                  onClick={() => {
                                    handleSelecionarConsultor(c.id);
                                    setDropdownConsultorAberto(false);
                                    setConsultorBusca("");
                                  }}
                                >
                                  {c.nome} {c.perfil ? `(${c.perfil})` : ""}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Perfil do Instrutor</label>
                    <select
                      name="perfil"
                      value={perfilSelecionado}
                      onChange={(e) => setPerfilSelecionado(e.target.value)}
                    >
                      <option value="">Selecione um perfil...</option>
                      <option value="SÊNIOR">SÊNIOR</option>
                      <option value="PLENO">PLENO</option>
                      <option value="JÚNIOR">JÚNIOR</option>
                    </select>
                  </div>
                </div>

                <div className="modal-grid-2">
                  <div className="form-field">
                    <label>Modalidade</label>
                    <select name="modalidade" defaultValue={dadosDuplicacao?.modalidade || "PRESENCIAL"}>
                      <option value="PRESENCIAL">Presencial</option>
                      <option value="VIRTUAL">Virtual / Remoto</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Status da Atividade</label>
                    <select name="status" defaultValue={dadosDuplicacao?.status || "CONFIRMADO"}>
                      <option value="CONFIRMADO">Confirmado</option>
                      <option value="REALIZADO">Realizado</option>
                      <option value="PREVISTO">Previsto</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="modal-grid-2">
                  <div className="form-field">
                    <label>Local / Concessionária</label>
                    <input
                      type="text"
                      name="local"
                      placeholder="Ex: São Paulo - SP / Filial"
                      autoComplete="off"
                      list="sugestoes-locais"
                      value={localTexto}
                      onChange={(e) => setLocalTexto(e.target.value)}
                    />
                    <datalist id="sugestoes-locais">
                      <option value="SOROCABA-SP" />
                    </datalist>
                  </div>
                  <div className="form-field">
                    <label>Região</label>
                    <select
                      name="regiao"
                      value={novaRegiao}
                      onChange={(e) => setNovaRegiao(e.target.value as "BRA" | "LATAM")}
                    >
                      <option value="BRA">BRA (Brasil)</option>
                      <option value="LATAM">LATAM (América Latina)</option>
                    </select>
                  </div>
                </div>

                <div className="modal-grid-3">
                  <div className="form-field">
                    <label>Data Inicial</label>
                    <input
                      type="date"
                      name="data_inicial"
                      defaultValue={dadosDuplicacao?.data_inicial || ""}
                      onChange={(e) => setNovaDataInicial(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Data Final</label>
                    <input
                      type="date"
                      name="data_final"
                      defaultValue={dadosDuplicacao?.data_final || ""}
                      onChange={(e) => setNovaDataFinal(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Carga Horária (h)</label>
                    <input
                      type="number"
                      step="1"
                      name="horas"
                      placeholder="Ex: 8"
                      value={novaHoras}
                      onChange={(e) => setNovaHoras(e.target.value)}
                    />
                  </div>
                </div>

                {/* Banner de Aviso de Período Bloqueado pelo Consultor */}
                {conflitoBloqueioNovo && (
                  <div
                    style={{
                      marginTop: "-4px",
                      marginBottom: "12px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#fffbeb",
                      border: "1px solid #f59e0b",
                      color: "#92400e",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: "#d97706", fontSize: "20px", flexShrink: 0 }}>
                      event_busy
                    </span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: "block", color: "#b45309", marginBottom: "2px" }}>
                        ⚠️ Período Bloqueado pelo Consultor
                      </strong>
                      <span>
                        Este período ({formatarPeriodoBR(conflitoBloqueioNovo.dataInicial, conflitoBloqueioNovo.dataFinal)}) está bloqueado pelo consultor <strong>{conflitoBloqueioNovo.consultorNome}</strong> para <strong>{conflitoBloqueioNovo.motivo}</strong> ou momento off.
                      </span>
                      {conflitoBloqueioNovo.observacoes && (
                        <span style={{ display: "block", fontSize: "11px", fontStyle: "italic", marginTop: "4px", color: "#78350f" }}>
                          Obs: {conflitoBloqueioNovo.observacoes}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Card Assistente de Tabela de Preços e Custo Consultor */}
                <div
                  style={{
                    background: calculoTabelaNova.ehContratoTabelado ? "rgba(0, 131, 202, 0.05)" : "rgba(100, 116, 139, 0.05)",
                    border: `1px solid ${calculoTabelaNova.ehContratoTabelado ? "rgba(0, 131, 202, 0.3)" : "rgba(100, 116, 139, 0.2)"}`,
                    borderRadius: "10px",
                    padding: "10px 14px",
                    marginBottom: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: calculoTabelaNova.ehContratoTabelado ? "#0083ca" : "#64748b" }}>
                        request_quote
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: calculoTabelaNova.ehContratoTabelado ? "#0083ca" : "var(--on-surface)" }}>
                        Tabela de Preços: {calculoTabelaNova.contratoNome} ({anoAtividadeNovo})
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: calculoTabelaNova.ehContratoTabelado ? "rgba(0, 131, 202, 0.15)" : "rgba(100, 116, 139, 0.15)",
                          color: calculoTabelaNova.ehContratoTabelado ? "#0083ca" : "#64748b",
                        }}
                      >
                        {calculoTabelaNova.contratoCodigo}
                      </span>
                    </div>

                    {calculoTabelaNova.ehContratoTabelado && calculoTabelaNova.totalFaturar != null && (
                      <button
                        type="button"
                        onClick={() => {
                          if (calculoTabelaNova.totalFaturar != null) {
                            setNovoFaturar(formatarMoedaValor(calculoTabelaNova.totalFaturar));
                          }
                          if (calculoTabelaNova.totalCustoConsultor != null) {
                            setNovoCustoConsultor(formatarMoedaValor(calculoTabelaNova.totalCustoConsultor));
                          }
                        }}
                        style={{
                          background: "#0083ca",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Preencher os campos Faturar e Consultor com base na Tabela do Contrato"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_fix_high</span>
                        Preencher com Valores da Tabela
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "16px", fontSize: "11.5px", color: "var(--on-surface-variant)", flexWrap: "wrap", alignItems: "center" }}>
                    <span>
                      <strong>Cliente:</strong> {calculoTabelaNova.valorHoraCliente != null ? `R$ ${calculoTabelaNova.valorHoraCliente.toFixed(2).replace(".", ",")}/h` : "N/A"}
                      {calculoTabelaNova.valorDiaCliente != null && ` (Ref. dia 8h: R$ ${calculoTabelaNova.valorDiaCliente.toFixed(2).replace(".", ",")})`}
                    </span>
                    <span>
                      <strong>Consultor:</strong> {calculoTabelaNova.tarifaConsultorFinal != null ? `R$ ${calculoTabelaNova.tarifaConsultorFinal.toFixed(2).replace(".", ",")}/h` : "N/A"}
                      {calculoTabelaNova.ehSocio && (
                        <span
                          style={{
                            marginLeft: "6px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: 700,
                            background: calculoTabelaNova.ehComissao ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: calculoTabelaNova.ehComissao ? "#059669" : "#d97706",
                          }}
                        >
                          {calculoTabelaNova.ehComissao ? "Sócio: isento +6% (COMISSÃO)" : "Sócio: +6% NF incluso"}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Alerta Preventivo de Virada de Mês */}
                {novaDataInicial && novaDataFinal && novaDataInicial.slice(0, 7) !== novaDataFinal.slice(0, 7) && (
                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.1)",
                      border: "1px solid rgba(245, 158, 11, 0.4)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      marginBottom: "12px",
                      display: "flex",
                      gap: "10px",
                      alignItems: "flex-start",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#d97706", marginTop: "2px" }}>
                      warning
                    </span>
                    <div style={{ fontSize: "11px", color: "#92400e", lineHeight: "1.4" }}>
                      <strong>Regra de virada de mês:</strong> O período da atividade deve ficar exclusivamente dentro do mesmo mês.
                      Para este período, registre a atividade até o último dia do mês e crie outro lançamento para o mês seguinte.
                      <div style={{ marginTop: "4px", fontStyle: "italic", color: "#78350f" }}>
                        Nota: A logística completa da viagem (voos de ida e volta, hotel) deve ser solicitada neste 1º lançamento.
                      </div>
                    </div>
                  </div>
                )}

                <div className="modal-grid-2">
                  <div className="form-field">
                    <label>Consultor (R$)</label>
                    <input
                      type="text"
                      name="custo_consultor"
                      placeholder="0,00"
                      value={novoCustoConsultor}
                      onChange={(e) => {
                        tratarInputMoeda(e);
                        setNovoCustoConsultor(e.target.value);
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label>Faturar (R$)</label>
                    <input
                      type="text"
                      name="faturar"
                      placeholder="0,00"
                      value={novoFaturar}
                      onChange={(e) => {
                        tratarInputMoeda(e);
                        setNovoFaturar(e.target.value);
                      }}
                    />
                  </div>
                </div>

                {/* Demanda Logística Compacta + Agência ao Lado */}
                <div className="modal-grid-2">
                  <div className="form-field">
                    <label>Demanda Logística?</label>
                    <select
                      name="precisa_logistica"
                      value={demandaLogistica ? "true" : "false"}
                      onChange={(e) => {
                        const val = e.target.value === "true";
                        setDemandaLogistica(val);
                        if (!val) setAgenciaSelecionada("");
                      }}
                    >
                      <option value="false">Não</option>
                      <option value="true">Sim (Viagens / Hospedagem)</option>
                    </select>
                  </div>

                  {demandaLogistica && (
                    <div className="form-field">
                      <label>Agência de Viagens *</label>
                      <select
                        name="agencia"
                        value={agenciaSelecionada}
                        onChange={(e) => setAgenciaSelecionada(e.target.value)}
                        required
                      >
                        <option value="" disabled>Selecione a Agência...</option>
                        <option value="FÁTIMA">FÁTIMA</option>
                        <option value="ALIVE">ALIVE</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Painel Estruturado de Logística para Orientar a Agência */}
                {demandaLogistica && (
                  <div className="logistics-instruction-panel">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>flight</span>
                        Orientações para Agência {agenciaSelecionada ? `(${agenciaSelecionada})` : ""}
                      </strong>
                      <span style={{ fontSize: "11px", color: "var(--primary)", fontWeight: 600 }} title="Informe o período integral da viagem. Os custos ficarão concentrados neste lançamento.">
                        Período Integral da Viagem (Ida e Volta)
                      </span>
                    </div>

                    {/* Bloco Passageiro (Sem tag ID, Reorganizado com Autopreenchimento) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "10px", borderBottom: "1px dashed var(--border)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "10px", width: "100%" }}>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Nome Passageiro</label>
                          <input
                            type="text"
                            placeholder="Nome Completo do Passageiro"
                            value={logPassageiroNome}
                            onChange={(e) => setLogPassageiroNome(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Documento (RG/CPF)</label>
                          <input
                            type="text"
                            placeholder="000.000.000-00"
                            value={logPassageiroDoc}
                            onChange={(e) => setLogPassageiroDoc(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Viagem</label>
                          <select
                            value={logTipoViagem}
                            onChange={(e) => setLogTipoViagem(e.target.value as "Sozinho" | "Acompanhado")}
                          >
                            <option value="Sozinho">Sozinho</option>
                            <option value="Acompanhado">Acompanhado</option>
                          </select>
                        </div>
                      </div>

                      {/* Se Acompanhado, abrir campos para nome e documento do acompanhante */}
                      {logTipoViagem === "Acompanhado" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "10px", background: "var(--surface-container-high)", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                          <div className="form-field">
                            <label style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 700 }}>Nome do Acompanhante</label>
                            <input
                              type="text"
                              placeholder="Nome Completo do Acompanhante"
                              value={logAcompanhanteNome}
                              onChange={(e) => setLogAcompanhanteNome(e.target.value)}
                            />
                          </div>
                          <div className="form-field">
                            <label style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 700 }}>Documento (RG/CPF)</label>
                            <input
                              type="text"
                              placeholder="000.000.000-00"
                              value={logAcompanhanteDoc}
                              onChange={(e) => setLogAcompanhanteDoc(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      <div className="form-field" style={{ marginTop: "-2px" }}>
                        <label style={{ fontSize: "10px" }}>OBS Passageiro (Ex: Sem bagagem despachada)</label>
                        <input
                          type="text"
                          placeholder="Ex: Sem bagagem despachada, mala de mão apenas..."
                          value={logObsGeral}
                          onChange={(e) => setLogObsGeral(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Bloco 2: Aéreo (Tag ACIMA dos campos) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="logistics-section-tag aereo">AÉREO</span>
                        <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", fontWeight: 500 }}>Passagens e voos</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Origem (Cidade / Aeroporto)</label>
                          <input
                            type="text"
                            placeholder="Ex: João Pessoa JPA"
                            value={logAereoOrigem}
                            onChange={(e) => setLogAereoOrigem(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Destino (Cidade / Aeroporto)</label>
                          <input
                            type="text"
                            placeholder="Ex: Goiânia GYN"
                            value={logAereoDestino}
                            onChange={(e) => setLogAereoDestino(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px" }}>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Data Ida</label>
                          <input
                            type="date"
                            value={logAereoDataIda}
                            onChange={(e) => setLogAereoDataIda(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Preferência Ida</label>
                          <select
                            value={logAereoPrefIda}
                            onChange={(e) => setLogAereoPrefIda(e.target.value)}
                          >
                            <option value="Manhã">Manhã</option>
                            <option value="Tarde">Tarde</option>
                            <option value="Noite">Noite</option>
                            <option value="Indiferente">Indiferente</option>
                          </select>
                        </div>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Data Volta</label>
                          <input
                            type="date"
                            value={logAereoDataVolta}
                            onChange={(e) => setLogAereoDataVolta(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Preferência Volta</label>
                          <select
                            value={logAereoPrefVolta}
                            onChange={(e) => setLogAereoPrefVolta(e.target.value)}
                          >
                            <option value="Noite">Noite</option>
                            <option value="Tarde">Tarde</option>
                            <option value="Manhã">Manhã</option>
                            <option value="Indiferente">Indiferente</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-field">
                        <label style={{ fontSize: "10px" }}>OBS Aéreo (Ex: Voo precisa chegar antes das 13:00)</label>
                        <input
                          type="text"
                          placeholder="Ex: Voo precisa chegar no destino antes das 13:00."
                          value={logAereoObs}
                          onChange={(e) => setLogAereoObs(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Bloco 3: Hotel (Tag ACIMA dos campos) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="logistics-section-tag hotel">HOTEL</span>
                        <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", fontWeight: 500 }}>Hospedagem</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "10px" }}>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Região / Cidade</label>
                          <input
                            type="text"
                            placeholder="Ex: Caldas Novas / Centro"
                            value={logHotelRegiao}
                            onChange={(e) => setLogHotelRegiao(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Check-in</label>
                          <input
                            type="date"
                            value={logHotelCheckin}
                            onChange={(e) => setLogHotelCheckin(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label style={{ fontSize: "10px" }}>Check-out</label>
                          <input
                            type="date"
                            value={logHotelCheckout}
                            onChange={(e) => setLogHotelCheckout(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-field">
                        <label style={{ fontSize: "10px" }}>OBS Hotel (Ex: Hotel Hot Star Thermas, de preferência)</label>
                        <input
                          type="text"
                          placeholder="Ex: Hotel Hot Star Thermas, de preferência..."
                          value={logHotelObs}
                          onChange={(e) => setLogHotelObs(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Bloco 4: Veículo Alugado */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="logistics-section-tag veiculo">VEÍCULO</span>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", fontWeight: 500 }}>Locação de veículo</span>
                        </div>
                        <div className="form-field" style={{ minWidth: "140px" }}>
                          <label style={{ fontSize: "10px" }}>Locar Veículo?</label>
                          <select
                            value={logVeiculoLocacao}
                            onChange={(e) => setLogVeiculoLocacao(e.target.value as "Sim" | "Não")}
                          >
                            <option value="Não">Não</option>
                            <option value="Sim">Sim</option>
                          </select>
                        </div>
                      </div>

                      {logVeiculoLocacao === "Sim" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "10px" }}>
                            <div className="form-field">
                              <label style={{ fontSize: "10px" }}>Cidade / Local de Retirada</label>
                              <input
                                type="text"
                                placeholder="Ex: Aeroporto JPA / Balcão Localiza"
                                value={logVeiculoRetiradaLocal}
                                onChange={(e) => setLogVeiculoRetiradaLocal(e.target.value)}
                              />
                            </div>
                            <div className="form-field">
                              <label style={{ fontSize: "10px" }}>Data / Hora Retirada</label>
                              <input
                                type="datetime-local"
                                value={logVeiculoDataRetirada}
                                onChange={(e) => setLogVeiculoDataRetirada(e.target.value)}
                              />
                            </div>
                            <div className="form-field">
                              <label style={{ fontSize: "10px" }}>Data / Hora Devolução</label>
                              <input
                                type="datetime-local"
                                value={logVeiculoDataDevolucao}
                                onChange={(e) => setLogVeiculoDataDevolucao(e.target.value)}
                              />
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "10px" }}>
                            <div className="form-field">
                              <label style={{ fontSize: "10px" }}>Categoria / Modelo</label>
                              <select
                                value={logVeiculoCategoria}
                                onChange={(e) => setLogVeiculoCategoria(e.target.value)}
                              >
                                <option value="Econômico com Ar">Econômico com Ar</option>
                                <option value="Sedan Compacto / Médio">Sedan Compacto / Médio</option>
                                <option value="SUV">SUV</option>
                                <option value="Van / Executivo">Van / Executivo</option>
                                <option value="Indiferente">Indiferente</option>
                              </select>
                            </div>
                            <div className="form-field">
                              <label style={{ fontSize: "10px" }}>OBS Veículo</label>
                              <input
                                type="text"
                                placeholder="Ex: Condutor adicional, devolução em outra filial..."
                                value={logVeiculoObs}
                                onChange={(e) => setLogVeiculoObs(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bloco 5: Seguro Viagem */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="logistics-section-tag seguro">SEGURO VIAGEM</span>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", fontWeight: 500 }}>Apólice corporativa</span>
                        </div>
                        <div className="form-field" style={{ minWidth: "140px" }}>
                          <label style={{ fontSize: "10px" }}>Emitir Seguro?</label>
                          <select
                            value={logSeguroViagem}
                            onChange={(e) => setLogSeguroViagem(e.target.value as "Não" | "Sim")}
                          >
                            <option value="Não">Não</option>
                            <option value="Sim">Sim</option>
                          </select>
                        </div>
                      </div>

                      {logSeguroViagem === "Sim" && (
                        <div className="form-field" style={{ marginTop: "2px" }}>
                          <label style={{ fontSize: "10px" }}>OBS / Requisitos do Seguro</label>
                          <input
                            type="text"
                            placeholder="Ex: Cobertura médica para período integral..."
                            value={logSeguroObs}
                            onChange={(e) => setLogSeguroObs(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalNovoAberto(false)}
                  disabled={salvandoNovo}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={salvandoNovo}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    check_circle
                  </span>
                  <span>{salvandoNovo ? "Salvando..." : "Cadastrar Atividade"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mini-Modal de Cadastro de Consultor */}
      {modalNovoConsultorAberto && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setModalNovoConsultorAberto(false)}>
          <div className="modal-card" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                  person_add
                </span>
                <span>Novo Consultor / Instrutor</span>
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setModalNovoConsultorAberto(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCadastrarConsultor}>
              <div className="modal-body" style={{ gap: "12px" }}>
                <div className="form-field">
                  <label>Nome Completo do Consultor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: CARLOS SILVA"
                    value={novoConsultorNome}
                    onChange={(e) => setNovoConsultorNome(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-field">
                  <label>Tipo de Vínculo</label>
                  <select
                    value={novoConsultorTipo}
                    onChange={(e) => setNovoConsultorTipo(e.target.value as "parceiro" | "socio" | "funcionario")}
                  >
                    <option value="parceiro">Parceiro (PJ)</option>
                    <option value="socio">Sócio</option>
                    <option value="funcionario">Funcionário (CLT)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalNovoConsultorAberto(false)}
                  disabled={salvandoConsultor}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={salvandoConsultor || !novoConsultorNome.trim()}
                >
                  <span>{salvandoConsultor ? "Salvando..." : "Salvar Consultor"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewVoucherDoc && (
        <DocumentPreviewModal
          documento={previewVoucherDoc}
          onClose={() => setPreviewVoucherDoc(null)}
        />
      )}
    </div>
  );
}
