"use client";
import Link from "next/link";
import React, { useState, useMemo, useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import BmExportPdfSheet from "@/components/BmExportPdfSheet";
import ModernDropdown from "@/components/ModernDropdown";
import bms2026Base from "@/lib/bms-2026.json";
import consultoresBase from "@/lib/consultores-base.json";
import { formatarNomeCurto } from "@/lib/consultor-utils";
import EnvioMassaBmModal from "@/components/medicao/EnvioMassaBmModal";

interface AtividadeMedicao {
  projeto: string;
  atividade: string;
  periodo: string;
  dataInicial?: string | null;
  dataFinal?: string | null;
  horas: number;
  valorHora: number;
  valorTotal: number;
  rateioInterno: string;
}

interface LogSignatario {
  signatario: string;
  papel: string;
  email: string;
  status: "Pendente" | "Assinado" | "Aprovado" | string;
  dataHora?: string;
  detalhe?: string;
}

interface BoletimMedicaoItem {
  id: string;
  codigo: string; // Ex: "0903" (sem #)
  consultorNome: string;
  consultorRazaoSocial?: string;
  consultorCnpj: string;
  consultorEmail: string;
  consultorEndereco: string;
  contrato: string;
  mesReferencia: string; // "Setembro / 2026"
  periodoTipo: "1ª Quinzena" | "2ª Quinzena" | "Integral";
  dataCorte: string;
  totalHoras: number;
  valorTotal: number;
  mediaHora: number;
  status: "Pendente de Assinatura" | "Assinado pelo Prestador" | "Aprovado pelo Líder" | "Aprovado & Pronto p/ Faturamento";
  dataEnvio: string;
  liderProjetoNome: string;
  liderProjetoEmail: string;
  responsavelNnosNome: string;
  responsavelNnosEmail: string;
  copiaEmails?: string;
  zohoRequestId?: string;
  zohoDocumentId?: string;
  logs: LogSignatario[];
  atividades: AtividadeMedicao[];
}

const INITIAL_BMS: BoletimMedicaoItem[] = bms2026Base as unknown as BoletimMedicaoItem[];


const CONSULTORES_DISPONIVEIS = (consultoresBase as any[])
  .filter((c: any) => c.ativo !== false)
  .map((c: any) => ({
    nome: c.nome, // Versão curta para vincular com a base de dados de Projetos
    nomeCompleto: c.nome_completo || c.nome,
    razaoSocial: c.razao_social || c.nome_completo || c.nome,
    cnpj: c.cnpj || '',
    email: c.email || '',
    endereco: c.endereco_empresa || c.cidade_base || '',
    contrato: c.contrato_ativo ? String(c.contrato_ativo).replace(/•\s*NNÓS/g, '').trim() : 'Contrato Vigente',
  }));

const LIDERES_PROJETO_PADRAO = [
  { nome: "Beatriz Picorelli", email: "beatriz.picorelli@nnos.com.br" },
  { nome: "Caroline Amieva", email: "caroline.amieva@nnos.com.br" },
  { nome: "Fábio Canassa", email: "fabio.canassa@nnos.com.br" },
  { nome: "Jefferson Souza", email: "jefferson.souza@nnos.com.br" },
  { nome: "Joice Lage", email: "joice.lage@nnos.com.br" },
  { nome: "Leonardo Campos", email: "leonardo.campos@nnos.com.br" },
  { nome: "Vinicius Souza", email: "vinicius.souza@nnos.com.br" },
  { nome: "Igor Picorelli", email: "igor.picorelli@nnos.com.br" },
];

function formatarNomeAssinatura(nome: string) {
  if (!nome) return "";
  return nome
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

const MESES_LISTA = [
  { num: 1, nome: "Janeiro" },
  { num: 2, nome: "Fevereiro" },
  { num: 3, nome: "Março" },
  { num: 4, nome: "Abril" },
  { num: 5, nome: "Maio" },
  { num: 6, nome: "Junho" },
  { num: 7, nome: "Julho" },
  { num: 8, nome: "Agosto" },
  { num: 9, nome: "Setembro" },
  { num: 10, nome: "Outubro" },
  { num: 11, nome: "Novembro" },
  { num: 12, nome: "Dezembro" },
];

export default function BoletimMedicaoPage() {
  const [bmsLista, setBmsLista] = useState<BoletimMedicaoItem[]>(INITIAL_BMS);
  const [bmVisualizando, setBmVisualizando] = useState<BoletimMedicaoItem | null>(null);
  const [modalEnvioMassaAberto, setModalEnvioMassaAberto] = useState(false);

  // Sincronização e persistência de dados dos BMs (API como fonte da verdade, localStorage como fallback)
  useEffect(() => {
    fetch('/api/medicao')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setBmsLista(data);
          try {
            localStorage.setItem('nnos_bms_2026_v5', JSON.stringify(data));
          } catch {}
        }
      })
      .catch((err) => {
        console.warn('Erro ao buscar /api/medicao', err);
        try {
          const local = localStorage.getItem('nnos_bms_2026_v5');
          if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setBmsLista(parsed);
            }
          }
        } catch {}
      });
  }, []);

  const [sincronizandoZoho, setSincronizandoZoho] = useState(false);

  const handleSincronizarZoho = async () => {
    setSincronizandoZoho(true);
    showToast("Consultando status das assinaturas no Zoho Sign...");
    try {
      const res = await fetch("/api/medicao?sync=1");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setBmsLista(data);
        try {
          localStorage.setItem("nnos_bms_2026_v5", JSON.stringify(data));
        } catch {}
        showToast("Assinaturas sincronizadas com sucesso com o Zoho Sign!");
      }
    } catch (err: any) {
      showToast("Erro ao sincronizar com o Zoho Sign");
    } finally {
      setSincronizandoZoho(false);
    }
  };

  const salvarBms = (novos: BoletimMedicaoItem[]) => {
    setBmsLista(novos);
    try {
      localStorage.setItem('nnos_bms_2026_v5', JSON.stringify(novos));
    } catch {}
    fetch('/api/medicao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novos),
    }).catch((e) => console.error('Erro ao salvar /api/medicao', e));
  };

  const [bmParaExcluir, setBmParaExcluir] = useState<BoletimMedicaoItem | null>(null);

  const handleExcluirBm = (bm: BoletimMedicaoItem) => {
    setBmParaExcluir(bm);
  };

  const confirmarExclusao = () => {
    if (!bmParaExcluir) return;
    const cod = bmParaExcluir.codigo;
    const novaLista = bmsLista.filter((item) => item.id !== bmParaExcluir.id && item.codigo !== cod);
    salvarBms(novaLista);
    setBmParaExcluir(null);
    showToast(`BM ${cod} excluído com sucesso!`);
  };

  // Filtros da Central de Medições
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");

  // Painel de Geração de Novo BM
  const [painelGeracaoAberto, setPainelGeracaoAberto] = useState(false);
  const [consultorSelecionadoNome, setConsultorSelecionadoNome] = useState(
    CONSULTORES_DISPONIVEIS[0]?.nome || "TIAGO ANGELO"
  );
  const dataHoje = new Date();
  const mesHoje = dataHoje.getMonth() + 1;
  const anoHoje = dataHoje.getFullYear();

  const [anoReferencia, setAnoReferencia] = useState(String(anoHoje >= 2026 ? anoHoje : 2026));
  const [mesReferenciaNum, setMesReferenciaNum] = useState(mesHoje);
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([2026, 2027]);
  const [mesesComLancamentos, setMesesComLancamentos] = useState<number[]>([]);
  const [carregandoProjetos, setCarregandoProjetos] = useState(false);
  const [atividadesProjetos, setAtividadesProjetos] = useState<AtividadeMedicao[]>([]);
  const [periodoTipo, setPeriodoTipo] = useState<"1ª Quinzena" | "2ª Quinzena" | "Integral">("Integral");
  const [dataCorte, setDataCorte] = useState(`20/${String(mesHoje).padStart(2, "0")}/${anoHoje >= 2026 ? anoHoje : 2026}`);

  const mesNomeAtual = useMemo(() => {
    return MESES_LISTA.find((m) => m.num === mesReferenciaNum)?.nome || "Setembro";
  }, [mesReferenciaNum]);

  const mesReferenciaFormatado = `${mesNomeAtual} / ${anoReferencia}`;

  // Atualização automática da data de corte conforme período e mês (preservando edições manuais válidas)
  useEffect(() => {
    const mm = String(mesReferenciaNum).padStart(2, "0");
    const ultDia = new Date(Number(anoReferencia), mesReferenciaNum, 0).getDate();
    setDataCorte((prev) => {
      if (prev && prev.includes("/")) {
        const diaAtual = parseInt(prev.split("/")[0], 10);
        if (!isNaN(diaAtual) && diaAtual >= 2 && diaAtual <= ultDia) {
          return `${String(diaAtual).padStart(2, "0")}/${mm}/${anoReferencia}`;
        }
      }
      return `20/${mm}/${anoReferencia}`; // Padrão dia 20 conforme regra de corte de negócio
    });
  }, [mesReferenciaNum, anoReferencia]);

  // Busca em tempo real na base de dados dos Projetos
  useEffect(() => {
    if (!consultorSelecionadoNome) return;
    setCarregandoProjetos(true);
    fetch(`/api/medicao/projetos?consultor_nome=${encodeURIComponent(consultorSelecionadoNome)}&ano=${anoReferencia}&mes=${mesReferenciaNum}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.mesesComLancamentos) {
          setMesesComLancamentos(data.mesesComLancamentos);
        }
        if (data.anosDisponiveis && data.anosDisponiveis.length > 0) {
          setAnosDisponiveis(data.anosDisponiveis);
        }
        if (data.lancamentos && Array.isArray(data.lancamentos)) {
          setAtividadesProjetos(data.lancamentos);
        } else {
          setAtividadesProjetos([]);
        }
        if (data.liderDetectado) {
          setLiderSugeridoProjetos(data.liderDetectado);
        } else {
          setLiderSugeridoProjetos(null);
        }
      })
      .catch((err) => {
        console.warn("Erro ao buscar lançamentos de Projetos", err);
        setAtividadesProjetos([]);
      })
      .finally(() => {
        setCarregandoProjetos(false);
      });
  }, [consultorSelecionadoNome, anoReferencia, mesReferenciaNum]);

  // Carregar líderes atualizados do banco de dados (Supabase)
  useEffect(() => {
    fetch("/api/lideres")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLideresDisponiveis(data);
        }
      })
      .catch((err) => console.warn("Erro ao buscar líderes de projetos da base:", err));
  }, []);

  // Consultor selecionado para geração
  const consultorObj = useMemo(() => {
    return (
      CONSULTORES_DISPONIVEIS.find((c) => c.nome === consultorSelecionadoNome) ||
      CONSULTORES_DISPONIVEIS[0]
    );
  }, [consultorSelecionadoNome]);

  // Quando o BM for do Marcelo Lara, o Signatário 3 (Responsável NNÓS - Validação Final) é Leonardo Campos
  const responsavelNnosAtual = useMemo(() => {
    const nomeCons = (consultorObj.nomeCompleto || consultorObj.nome || "").toLowerCase();
    const isMarceloLara = nomeCons.includes("marcelo");
    if (isMarceloLara) {
      return {
        nome: "Leonardo Campos",
        email: "leonardo.campos@nnos.com.br",
        papel: "Responsável NNÓS (Validação Final)",
      };
    }
    return {
      nome: "Marcelo Lara da Silva",
      email: "marcela.lara@nnos.com.br",
      papel: "Responsável NNÓS (Coordenação Geral)",
    };
  }, [consultorObj]);

  // Modal de Assinatura & Signatários vinculados à base
  const [lideresDisponiveis, setLideresDisponiveis] = useState(LIDERES_PROJETO_PADRAO);
  const [liderSugeridoProjetos, setLiderSugeridoProjetos] = useState<string | null>(null);
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [bmEmCriacao, setBmEmCriacao] = useState<Partial<BoletimMedicaoItem> | null>(null);
  const [emailConsultor, setEmailConsultor] = useState("");
  const [liderEscolhidoNome, setLiderEscolhidoNome] = useState(LIDERES_PROJETO_PADRAO[0].nome);
  const [liderEscolhidoEmail, setLiderEscolhidoEmail] = useState(LIDERES_PROJETO_PADRAO[0].email);
  const [receberCopia, setReceberCopia] = useState(true);
  const [emailCopia, setEmailCopia] = useState("leonardo.campos@nnos.com.br");
  const [emailResponsavelNnos, setEmailResponsavelNnos] = useState("");

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 3500);
  };

  // Código sequencial com 4 dígitos (sem #), garantindo mínimo sequencial 0909
  const proximoCodigo = useMemo(() => {
    const codigosNum = bmsLista
      .map((b) => parseInt(b.codigo, 10))
      .filter((n) => !isNaN(n));
    const max = codigosNum.length > 0 ? Math.max(...codigosNum, 908) : 908;
    return String(max + 1).padStart(4, "0");
  }, [bmsLista]);

  // Atividades apuradas da Gestão de Projetos respeitando estritamente as Regras de Negócio:
  // Regra 1 (Print 1): Quando tiver atividade sem valor (valorTotal === 0 ou null), não fazer o carregamento no BM.
  // Regra 2 (Print 2):
  // - Atividades de Mês Integral (ex: 01/09 a 30/09) cobrem o mês cheio e só aparecem quando selecionado "Integral".
  // - 1ª Quinzena: Apenas atividades com início e término antes da data de corte (diaFim < diaCorte) que não sejam do mês integral.
  // - 2ª Quinzena: Apenas atividades que iniciam a partir da data de corte (diaInicio >= diaCorte).
  // - Se nenhuma atividade iniciar a partir do corte, a 2ª Quinzena fica em branco.
  // - Integral: Exibe todas as atividades com valor da competência.
  const previewAtividades = useMemo(() => {
    if (!atividadesProjetos || atividadesProjetos.length === 0) return [];

    const mm = String(mesReferenciaNum).padStart(2, "0");
    const ultimoDiaMes = new Date(Number(anoReferencia), mesReferenciaNum, 0).getDate();

    // 1. Descartar atividades sem valor
    const atividadesComValor = atividadesProjetos.filter((a: any) => {
      if (a.valorTotal == null) return false;
      if (typeof a.valorTotal === "number" && Math.abs(a.valorTotal) < 0.001) return false;
      return true;
    });

    const extrairDia = (d: any) => {
      if (!d) return NaN;
      const str = String(d).trim();
      if (str.includes("-")) {
        const parts = str.split("T")[0].split("-");
        return parseInt(parts[parts.length - 1], 10);
      }
      if (str.includes("/")) {
        return parseInt(str.split("/")[0], 10);
      }
      const num = parseInt(str, 10);
      return !isNaN(num) ? num : NaN;
    };

    // Extrai o dia exato da data de corte informada (ex: "20/09/2026" -> 20)
    let diaCorte = 20;
    if (dataCorte) {
      const parsedDia = extrairDia(dataCorte);
      if (!isNaN(parsedDia) && parsedDia >= 2 && parsedDia <= ultimoDiaMes) {
        diaCorte = parsedDia;
      }
    }

    // Identificar se a atividade cobre o mês inteiro (Integral)
    const ehMesIntegral = (a: any) => {
      const dIni = extrairDia(a.dataInicial || a.data_inicial);
      const dFim = extrairDia(a.dataFinal || a.data_final);
      if (isNaN(dIni) || isNaN(dFim)) return true; // sem datas fracionadas -> escopo integral do mês
      return dIni <= 5 && dFim >= ultimoDiaMes - 2;
    };

    let listaFiltrada: any[] = [];

    if (periodoTipo === "1ª Quinzena") {
      listaFiltrada = atividadesComValor.filter((a: any) => {
        if (ehMesIntegral(a)) return false; // Mês integral não entra na quinzena
        const dFim = extrairDia(a.dataFinal || a.data_final || a.dataInicial || a.data_inicial);
        if (isNaN(dFim)) return false;
        return dFim < diaCorte;
      });
    } else if (periodoTipo === "2ª Quinzena") {
      listaFiltrada = atividadesComValor.filter((a: any) => {
        if (ehMesIntegral(a)) return false; // Mês integral não entra na quinzena
        const dIni = extrairDia(a.dataInicial || a.data_inicial);
        if (isNaN(dIni)) return false;
        return dIni >= diaCorte; // Ex: inicia no dia 20/09 ou posterior
      });
    } else {
      // Integral (Mês Cheio) - Carrega todas as atividades válidas da competência
      listaFiltrada = [...atividadesComValor];
    }

    // Manter datas reais e formatar período de cada atividade
    const listaFormatada = listaFiltrada.map((a: any) => {
      const perReal = a.dataInicialBr && a.dataFinalBr
        ? `${a.dataInicialBr} a ${a.dataFinalBr}`
        : a.periodo || `01/${mm}/${anoReferencia} a ${ultimoDiaMes}/${mm}/${anoReferencia}`;
      return {
        ...a,
        periodo: perReal,
      };
    });

    // Calcula rateio percentual preciso de cada atividade em relação ao total do período
    const somaTotal = listaFormatada.reduce((acc, a) => acc + (a.valorTotal || 0), 0);
    return listaFormatada.map((a) => ({
      ...a,
      rateioInterno:
        somaTotal > 0
          ? `${((a.valorTotal / somaTotal) * 100).toFixed(2).replace(".", ",")}%`
          : "0,00%",
    }));
  }, [atividadesProjetos, periodoTipo, dataCorte, mesReferenciaNum, anoReferencia]);

  const previewTotalHoras = useMemo(() => {
    return previewAtividades.reduce((acc, a) => acc + (a.horas || 0), 0);
  }, [previewAtividades]);

  const previewValorTotal = useMemo(() => {
    return previewAtividades.reduce((acc, a) => acc + (a.valorTotal || 0), 0);
  }, [previewAtividades]);

  // Filtro de BMs na tabela
  const bmsFiltrados = useMemo(() => {
    return bmsLista.filter((b) => {
      if (filtroStatus !== "Todos" && b.status !== filtroStatus) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const nomeCurto = formatarNomeCurto(b.consultorNome, b.consultorCnpj);
        const texto = `${b.codigo} ${b.consultorNome} ${nomeCurto} ${b.contrato} ${b.mesReferencia}`.toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      return true;
    });
  }, [bmsLista, busca, filtroStatus]);

  // Iniciar geração do BM a partir dos lançamentos da base de Projetos
  const handleIniciarGeracaoBM = () => {
    const atividadesFinais = previewAtividades.length > 0 ? previewAtividades : [
      {
        centroCusto: "01.07.010.039",
        projeto: "PROJETO NNÓS",
        atividade: `Atividades Técnicas Especializadas - ${periodoTipo}`,
        periodo: `Referência ${mesReferenciaFormatado}`,
        dataInicial: null,
        dataFinal: null,
        horas: 0,
        valorHora: 0,
        valorTotal: 0,
        rateioInterno: "0,00%",
      }
    ];

    // Auto-detectar e pré-selecionar líder do projeto vinculado
    let lidInicialNome = lideresDisponiveis[0]?.nome || "Beatriz Picorelli";
    let lidInicialEmail = lideresDisponiveis[0]?.email || "beatriz.picorelli@nnos.com.br";

    const lidCandidato = liderSugeridoProjetos || (atividadesFinais.find(a => (a as any).liderProjeto) as any)?.liderProjeto;
    if (lidCandidato) {
      const matchLid = lideresDisponiveis.find(l =>
        l.nome.toLowerCase() === lidCandidato.toLowerCase() ||
        lidCandidato.toLowerCase().includes(l.nome.toLowerCase()) ||
        l.nome.toLowerCase().includes(lidCandidato.toLowerCase())
      );
      if (matchLid) {
        lidInicialNome = matchLid.nome;
        lidInicialEmail = matchLid.email;
      }
    }

    setLiderEscolhidoNome(lidInicialNome);
    setLiderEscolhidoEmail(lidInicialEmail);

    const novoBM: Partial<BoletimMedicaoItem> = {
      codigo: proximoCodigo,
      consultorNome: consultorObj.nome || consultorObj.nomeCompleto,
      consultorRazaoSocial: consultorObj.razaoSocial,
      consultorCnpj: consultorObj.cnpj,
      consultorEmail: consultorObj.email,
      consultorEndereco: consultorObj.endereco,
      contrato: consultorObj.contrato,
      mesReferencia: mesReferenciaFormatado,
      periodoTipo,
      dataCorte,
      totalHoras: previewTotalHoras,
      valorTotal: previewValorTotal,
      mediaHora: previewTotalHoras > 0 ? previewValorTotal / previewTotalHoras : 0,
      liderProjetoNome: lidInicialNome,
      liderProjetoEmail: lidInicialEmail,
      responsavelNnosNome: responsavelNnosAtual.nome,
      responsavelNnosEmail: responsavelNnosAtual.email,
      atividades: atividadesFinais,
    };

    setBmEmCriacao(novoBM);
    setEmailConsultor(consultorObj.email);
    setEmailResponsavelNnos(responsavelNnosAtual.email);
    setModalAssinaturaAberto(true);
  };

  // Confirmar criação do BM e despacho para signatários via Zoho Sign
  const handleConfirmarEnvioAssinatura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bmEmCriacao) return;

    const dataAgora = new Date();
    const dataHoraStr = `${dataAgora.toLocaleDateString("pt-BR")} às ${dataAgora.toLocaleTimeString("pt-BR")}`;
    const codBm = bmEmCriacao.codigo || proximoCodigo;

    showToast(`Disparando BM ${codBm} para assinatura no Zoho Sign...`);

    let zohoReqId: string | undefined;
    let zohoDocId: string | undefined;
    let avisoZoho: string | null = null;

    try {
      const resp = await fetch("/api/medicao/enviar-zoho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigoBm: codBm,
          consultorNome: bmEmCriacao.consultorNome,
          consultorRazaoSocial: bmEmCriacao.consultorRazaoSocial,
          consultorCnpj: bmEmCriacao.consultorCnpj,
          consultorEndereco: bmEmCriacao.consultorEndereco,
          consultorEmail: emailConsultor || bmEmCriacao.consultorEmail,
          contrato: bmEmCriacao.contrato,
          liderNome: liderEscolhidoNome,
          liderEmail: liderEscolhidoEmail,
          responsavelNome: responsavelNnosAtual.nome,
          responsavelEmail: emailResponsavelNnos || responsavelNnosAtual.email,
          emailsCopia: receberCopia ? emailCopia : undefined,
          mesReferencia: bmEmCriacao.mesReferencia,
          periodoStr: `${bmEmCriacao.mesReferencia} - ${bmEmCriacao.periodoTipo}`,
          totalHoras: bmEmCriacao.totalHoras,
          mediaHora: bmEmCriacao.mediaHora,
          valorTotal: bmEmCriacao.valorTotal,
          atividades: bmEmCriacao.atividades,
        }),
      });

      if (resp.ok) {
        const json = await resp.json();
        zohoReqId = json.requestId;
        zohoDocId = json.documentId;
        if (json.avisoCreditos) {
          avisoZoho = "Documento registrado no Zoho Sign. Para envio automático de e-mails, a conta Zoho requer créditos de API.";
        }
        console.log("✅ Zoho Sign Request ID:", zohoReqId, "Doc ID:", zohoDocId);
      } else {
        const txt = await resp.text();
        console.warn("Aviso ao conectar com Zoho Sign:", txt);
        avisoZoho = "Zoho Sign: Documento registrado localmente (verifique as credenciais da API).";
      }
    } catch (err: any) {
      console.warn("Falha ao disparar Zoho Sign:", err.message);
    }

    const logsIniciais: LogSignatario[] = [
      {
        signatario: bmEmCriacao.consultorNome!,
        papel: "Prestador de Serviços",
        email: emailConsultor || bmEmCriacao.consultorEmail!,
        status: "Pendente",
        detalhe: zohoDocId ? `Zoho Sign ID: ${zohoDocId}` : "Notificação e link de assinatura enviados por e-mail",
      },
      {
        signatario: liderEscolhidoNome.toUpperCase(),
        papel: "Aprovador (Líder de Projeto)",
        email: liderEscolhidoEmail,
        status: "Pendente",
        detalhe: "Aguardando aprovação operacional das horas",
      },
      {
        signatario: responsavelNnosAtual.nome.toUpperCase(),
        papel: responsavelNnosAtual.papel,
        email: emailResponsavelNnos || responsavelNnosAtual.email,
        status: "Pendente",
        detalhe: "Aguardando validação final",
      },
    ];

    const novoBMCompleto: BoletimMedicaoItem = {
      id: `bm-${codBm}`,
      codigo: codBm,
      consultorNome: bmEmCriacao.consultorNome!,
      consultorRazaoSocial: bmEmCriacao.consultorRazaoSocial,
      consultorCnpj: bmEmCriacao.consultorCnpj!,
      consultorEmail: emailConsultor || bmEmCriacao.consultorEmail!,
      consultorEndereco: bmEmCriacao.consultorEndereco!,
      contrato: bmEmCriacao.contrato!,
      mesReferencia: bmEmCriacao.mesReferencia!,
      periodoTipo: bmEmCriacao.periodoTipo as "1ª Quinzena" | "2ª Quinzena" | "Integral",
      dataCorte: bmEmCriacao.dataCorte!,
      totalHoras: bmEmCriacao.totalHoras!,
      valorTotal: bmEmCriacao.valorTotal!,
      mediaHora: bmEmCriacao.mediaHora!,
      status: "Pendente de Assinatura",
      dataEnvio: dataHoraStr,
      liderProjetoNome: liderEscolhidoNome,
      liderProjetoEmail: liderEscolhidoEmail,
      responsavelNnosNome: responsavelNnosAtual.nome,
      responsavelNnosEmail: responsavelNnosAtual.email,
      copiaEmails: receberCopia ? emailCopia : undefined,
      zohoRequestId: zohoDocId || zohoReqId,
      logs: logsIniciais,
      atividades: bmEmCriacao.atividades || [],
    };

    salvarBms([novoBMCompleto, ...bmsLista]);
    setModalAssinaturaAberto(false);
    setPainelGeracaoAberto(false);
    if (avisoZoho) {
      showToast(`BM ${novoBMCompleto.codigo} registrado! ${avisoZoho}`);
    } else {
      showToast(`BM ${novoBMCompleto.codigo} registrado e enviado ao Zoho Sign com sucesso!`);
    }
  };

  // Simular avanço de assinatura
  const handleAvancarAssinatura = (bm: BoletimMedicaoItem) => {
    const dataAgora = new Date();
    const dataHoraStr = `${dataAgora.toLocaleDateString("pt-BR")} às ${dataAgora.toLocaleTimeString("pt-BR")}`;

    const novosBms = bmsLista.map((item) => {
      if (item.id !== bm.id) return item;

      if (item.status === "Pendente de Assinatura") {
        const novosLogs: LogSignatario[] = [
          {
            ...item.logs[0],
            status: "Assinado",
            dataHora: dataHoraStr,
            detalhe: "IP: 189.44.112.5 • Assinado via NNÓS Sign",
          },
          item.logs[1] || { signatario: "LÍDER DE PROJETO", papel: "Aprovador", email: "projetos@nnos.com.br", status: "Pendente" },
          item.logs[2] || { signatario: "MARCELO LARA", papel: "Coordenação", email: "marcelo.lara@nnos.com.br", status: "Pendente" },
        ];
        showToast("Assinatura do prestador (" + item.consultorNome + ") registrada!");
        return {
          ...item,
          status: "Assinado pelo Prestador" as const,
          logs: novosLogs,
        };
      } else if (item.status === "Assinado pelo Prestador") {
        const novosLogs: LogSignatario[] = [
          item.logs[0],
          {
            ...(item.logs[1] || { signatario: item.liderProjetoNome, papel: "Aprovador", email: item.liderProjetoEmail }),
            status: "Assinado",
            dataHora: dataHoraStr,
            detalhe: "Aprovado pelo líder " + item.liderProjetoNome,
          },
          item.logs[2] || { signatario: "MARCELO LARA", papel: "Coordenação", email: "marcelo.lara@nnos.com.br", status: "Pendente" },
        ];
        showToast("Aprovação do Líder de Projeto (" + item.liderProjetoNome + ") concluída!");
        return {
          ...item,
          status: "Aprovado pelo Líder" as const,
          logs: novosLogs,
        };
      } else if (item.status === "Aprovado pelo Líder") {
        const novosLogs: LogSignatario[] = [
          item.logs[0],
          item.logs[1],
          {
            ...(item.logs[2] || { signatario: item.responsavelNnosNome, papel: "Coordenação Geral", email: item.responsavelNnosEmail }),
            status: "Assinado",
            dataHora: dataHoraStr,
            detalhe: "Homologado para faturamento financeiro",
          },
        ];
        showToast("BM " + item.codigo + " Aprovado & Pronto para Faturamento!");
        return {
          ...item,
          status: "Aprovado & Pronto p/ Faturamento" as const,
          logs: novosLogs,
        };
      }
      return item;
    });
    salvarBms(novosBms);
  };

  // Copiar descrição da nota fiscal
  const handleCopyNfTexto = (bm: BoletimMedicaoItem) => {
    const linhasProjetos = Array.from(
      new Set(bm.atividades.map((a) => a.projeto))
    ).map((proj) => {
      const totProj = bm.atividades
        .filter((a) => a.projeto === proj)
        .reduce((acc, a) => acc + a.valorTotal, 0);
      return `${proj}: R$ ${totProj.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    });

    const rawText = `BM: ${bm.codigo} | CONTRATO: ${bm.contrato}
${linhasProjetos.join("\n")}`;

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(rawText).then(() => {
        showToast("Discriminação da NF-e copiada com sucesso!");
      });
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar Corporativa Idêntica à tela de Projetos (sem distorção de logo ou fontes) */}
      <aside className="sidebar">
        <div className="flex flex-col">
          <div className="sidebar-brand">
            <img
              src="/logo-coruja.png"
              alt="Logo Coruja NNÓS"
              className="sidebar-brand-img"
            />
            <div className="sidebar-brand-text">
              <h2 style={{ lineHeight: "1.2", textTransform: "uppercase" }}>
                GESTÃO<br />FINANCEIRA & PROJETOS
              </h2>
            </div>
          </div>

          <nav className="sidebar-nav">
            <Link href="/projetos" className="nav-item">
              <span className="material-symbols-outlined">assignment</span>
              <span>Projetos & Atividades</span>
            </Link>
            <Link href="/medicao" className="nav-item active">
              <span className="material-symbols-outlined">receipt_long</span>
              <span>BM - Boletim de Medição</span>
            </Link>
            <Link href="/viagens" className="nav-item">
              <span className="material-symbols-outlined">flight</span>
              <span>Viagens & Logística</span>
            </Link>
            <Link href="/centro-de-custo" className="nav-item">
              <span className="material-symbols-outlined">account_tree</span>
              <span>Centro de Custo</span>
            </Link>
            <Link href="/tabela-precos" className="nav-item">
              <span className="material-symbols-outlined">request_quote</span>
              <span>Tabela de Preços</span>
            </Link>
            <Link href="/pessoas" className="nav-item">
              <span className="material-symbols-outlined">group</span>
              <span>Pessoas</span>
            </Link>
            <Link href="/faturamento" className="nav-item">
              <span className="material-symbols-outlined">receipt</span>
              <span>Faturamento</span>
            </Link>
            <Link href="/pagamentos" className="nav-item">
              <span className="material-symbols-outlined">payments</span>
              <span>Pagamentos</span>
            </Link>
            <Link href="/relatorios" className="nav-item">
              <span className="material-symbols-outlined">monitoring</span>
              <span>Relatórios</span>
            </Link>
            <Link href="/consultor" className="nav-item"><span className="material-symbols-outlined">support_agent</span><span>Consultor</span></Link>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-info" style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface)" }}>
              Sistema Operacional NNÓS
            </span>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
              Módulo de Boletim de Medição (BM)
            </span>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="main-wrapper">
        <header className="top-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="font-label-sm"
              style={{
                color: "var(--on-surface-variant)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Portal Corporativo · NNÓS
            </span>
            <span style={{ color: "var(--outline-variant)" }}>/</span>
            <span
              className="font-label-sm"
              style={{
                color: "var(--primary)",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              Boletim de Medição de Serviços (BM)
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ThemeToggle />
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "var(--primary)",
                color: "var(--on-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "13px",
              }}
            >
              LC
            </div>
          </div>
        </header>

        {/* Conteúdo Principal Ocupando Toda a Largura da Tela (Print 1 ajustado) */}
        <main className="main-content" style={{ padding: "20px 24px", width: "100%", maxWidth: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>

            {/* SE O USUÁRIO ESTIVER VISUALIZANDO UM BM ESPECÍFICO */}
            {bmVisualizando ? (
              <>
                <div className="bm-document-container screen-bm-view" style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                {/* Cabeçalho Oficial para Exportação / Impressão A4 (Sem as informações demarcadas em laranja do Print 2) */}
                <div className="print-header-only" style={{ display: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #002b49", paddingBottom: "10px", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <img src="/logo-coruja.png" alt="Logo NNÓS" style={{ width: "44px", height: "44px", objectFit: "contain" }} />
                      <div>
                        <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#002b49", margin: 0, textTransform: "uppercase", letterSpacing: "-0.01em" }}>
                          Boletim de Medição de Serviços
                        </h1>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "#002b49" }}>
                        BM {bmVisualizando.codigo}
                      </div>
                      <div style={{ fontSize: "11px", color: "#4a5568", fontWeight: 600 }}>
                        Contrato {bmVisualizando.contrato.replace(/•\s*NNÓS/g, "").trim()} • {bmVisualizando.mesReferencia}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Command & Action Bar */}
                <div className="screen-nav-bar no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setBmVisualizando(null)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--secondary)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
                        <span>Voltar para Lista de BMs</span>
                      </button>
                      <span style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "var(--outline)" }}></span>
                      <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "var(--surface-container)", fontSize: "11px", fontWeight: 600, color: "var(--on-surface-variant)" }}>
                        Ciclo: Mensal Fechado
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                      <h1 style={{ fontFamily: "var(--font-jakarta)", fontSize: "24px", fontWeight: 700, color: "var(--primary)", margin: 0, letterSpacing: "-0.02em" }}>
                        Boletim de Medição de Serviços
                      </h1>
                      <span style={{ fontSize: "13px", color: "var(--on-surface-variant)" }}>
                        BM {bmVisualizando.codigo} • Contrato {bmVisualizando.contrato.replace(/•\s*NNÓS/g, "").trim()}
                      </span>
                    </div>
                  </div>

                  {/* CTAs de Operação Rápida */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="btn-secondary"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "8px 14px" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>print</span>
                      <span>Exportar PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast(`Medição BM ${bmVisualizando.codigo} enviada para o consultor!`)}
                      className="btn-primary"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "8px 16px" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>mail</span>
                      <span>Enviar ao Consultor</span>
                    </button>
                  </div>
                </div>

                {/* Hero KPI Banner Cards */}
                <div className="hero-kpi-banner-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                  {/* Total Apurado */}
                  <div style={{ padding: "20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.05em" }}>Valor Líquido Total</span>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                          R$ {bmVisualizando.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(0,21,47,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>payments</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px", color: "#047857", fontSize: "11px", fontWeight: 600 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>check_circle</span>
                      <span>Aprovado</span>
                    </div>
                  </div>

                  {/* Carga Horária */}
                  <div style={{ padding: "20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.05em" }}>Carga Horária Apurada</span>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                          {bmVisualizando.totalHoras.toFixed(1)} h
                        </div>
                      </div>
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(0,103,129,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--secondary)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>schedule</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", fontSize: "11px" }}>
                      <span style={{ color: "var(--on-surface-variant)" }}>{bmVisualizando.atividades.length} frentes de serviço</span>
                      <strong style={{ color: "var(--secondary)" }}>Média R$ {bmVisualizando.mediaHora.toFixed(2)}/h</strong>
                    </div>
                  </div>

                  {/* Período & Ciclo */}
                  <div style={{ padding: "20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.05em" }}>Mês de Referência</span>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                          {bmVisualizando.mesReferencia}
                        </div>
                      </div>
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "var(--surface-container)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--on-surface)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>calendar_month</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                      <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "var(--surface-container)", fontWeight: 600 }}>{bmVisualizando.periodoTipo}</span>
                      <span>Corte: {bmVisualizando.dataCorte}</span>
                    </div>
                  </div>

                  {/* Prazos de Pagamento */}
                  <div style={{ padding: "20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.05em" }}>Cronograma Previsto</span>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                          10 e 25 de Outubro
                        </div>
                      </div>
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(135,221,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--secondary)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>event_repeat</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--secondary)" }}></span>
                      <span>NF até dia 10 • Pagamento dia 25</span>
                    </div>
                  </div>
                </div>

                {/* Parties Identification Bento Section */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: "16px" }}>
                  {/* Consultor / Prestador Credenciado */}
                  <div style={{ padding: "24px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "var(--primary)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>badge</span>
                          </div>
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Prestador de Serviços</span>
                            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>{formatarNomeCurto(bmVisualizando.consultorNome, bmVisualizando.consultorCnpj)}</h2>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", paddingTop: "14px", fontSize: "12px" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Razão Social / Titular</span>
                          <strong style={{ color: "var(--on-surface)" }}>
                            {bmVisualizando.consultorNome.toLowerCase().includes("marcelo")
                              ? "DRONEX COMERCIO E SERVICOS LTDA"
                              : (bmVisualizando.consultorRazaoSocial || bmVisualizando.consultorNome)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>CNPJ</span>
                          <strong style={{ color: "var(--on-surface)" }}>
                            {bmVisualizando.consultorNome.toLowerCase().includes("marcelo")
                              ? "55.408.003/0001-50"
                              : (bmVisualizando.consultorCnpj || "Não informado")}
                          </strong>
                        </div>
                        <div style={{ gridColumn: "span 2" }}>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Endereço Comercial Cadastrado</span>
                          <span style={{ color: "var(--on-surface)" }}>
                            {bmVisualizando.consultorNome.toLowerCase().includes("marcelo")
                              ? "Rua João Lage, nº 125, Apt 403, Alto São Luiz, Pará de Minas - MG | CEP 35660-970"
                              : (bmVisualizando.consultorEndereco || "Belo Horizonte / MG")}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>E-mail Operacional</span>
                          <a href={`mailto:${bmVisualizando.consultorEmail}`} style={{ color: "var(--secondary)", textDecoration: "none" }}>{bmVisualizando.consultorEmail}</a>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Contrato Ativo / Vinculado</span>
                          <strong style={{ color: "var(--on-surface)" }}>{bmVisualizando.contrato.replace(/•\s*NNÓS/g, "").trim()}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tomador / Contratante */}
                  <div style={{ padding: "24px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "var(--secondary)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>domain</span>
                          </div>
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Tomador dos Serviços</span>
                            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>NNÓS CONSULTORIA E TREINAMENTO LTDA</h2>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", paddingTop: "14px", fontSize: "12px" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>CNPJ da Empresa</span>
                          <strong style={{ color: "var(--on-surface)" }}>36.443.716/0001-00</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Inscrição Municipal</span>
                          <strong style={{ color: "var(--on-surface)" }}>1.208.841/002-5</strong>
                        </div>
                        <div style={{ gridColumn: "span 2" }}>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Endereço da Sede</span>
                          <span style={{ color: "var(--on-surface)" }}>Rua Sergipe, nº 77 - Loja 1, Boa Viagem, Belo Horizonte - MG | CEP 30130-170</span>
                        </div>
                        <div style={{ gridColumn: "span 2" }}>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Financeiro</span>
                          <a href="mailto:leonardo.campos@nnos.com.br" style={{ color: "var(--secondary)", textDecoration: "none" }}>leonardo.campos@nnos.com.br</a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Activities Table (Master Sheet) */}
                <div style={{ borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ padding: "16px 20px", backgroundColor: "var(--surface-container-low)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "var(--primary)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>table_rows</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>Detalhamento Operacional de Horas</span>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>Atividades Apuradas no Mês ({bmVisualizando.mesReferencia})</h3>
                      </div>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: "999px", backgroundColor: "var(--surface-container)", fontSize: "12px", fontWeight: 600, color: "var(--on-surface-variant)" }}>
                      {bmVisualizando.atividades.length} Lançamentos Registrados
                    </span>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "var(--primary)", color: "#ffffff", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          <th style={{ padding: "12px 16px" }}>Projeto</th>
                          <th style={{ padding: "12px 16px", minWidth: "260px" }}>Atividade / Escopo</th>
                          <th style={{ padding: "12px 16px", textAlign: "center" }}>Período</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>CH (Horas)</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>Valor / Hora</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>Valor Total</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>Rateio Interno</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bmVisualizando.atividades.map((at, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--border)", backgroundColor: idx % 2 === 1 ? "var(--surface-container-low)" : "transparent" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary)" }}>{at.projeto}</td>
                            <td style={{ padding: "12px 16px" }}>{at.atividade}</td>
                            <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--on-surface-variant)", whiteSpace: "nowrap" }}>{at.periodo}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>{at.horas.toFixed(1)} h</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--on-surface-variant)" }}>R$ {at.valorHora.toFixed(2)}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--primary)" }}>R$ {at.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", color: at.rateioInterno !== "0,00%" ? "var(--secondary)" : "var(--on-surface-variant)", fontWeight: at.rateioInterno !== "0,00%" ? 700 : 400 }}>{at.rateioInterno}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: "var(--primary)", color: "#ffffff", fontWeight: 700, fontSize: "13px" }}>
                          <td style={{ padding: "14px 16px" }} colSpan={3}>TOTAL CONSOLIDADO DA MEDIÇÃO</td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>{bmVisualizando.totalHoras.toFixed(1)} h</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", opacity: 0.85, fontSize: "11px" }}>(Média R$ {bmVisualizando.mediaHora.toFixed(2)})</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", color: "#87ddff", fontSize: "15px", fontWeight: 800 }}>R$ {bmVisualizando.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", opacity: 0.85, fontSize: "11px" }}>100,00%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Barra de Rateio Visual */}
                  <div style={{ padding: "14px 20px", backgroundColor: "var(--surface-container-low)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", fontSize: "11px" }}>
                      <strong style={{ color: "var(--primary)" }}>Rateio por Projeto:</strong>
                      {Array.from(new Set(bmVisualizando.atividades.map((a) => a.projeto))).map((proj, pIdx) => {
                        const sub = bmVisualizando.atividades
                          .filter((a) => a.projeto === proj)
                          .reduce((acc, a) => acc + a.valorTotal, 0);
                        const pct = bmVisualizando.valorTotal > 0 ? ((sub / bmVisualizando.valorTotal) * 100).toFixed(1) : "0,0";
                        const cores = ["var(--secondary)", "#0f2a4a", "#dd7436", "#485f82", "#10b981"];
                        return (
                          <span key={proj} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: cores[pIdx % cores.length] }}></span>
                            {proj} ({pct}%)
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* NF-e Billing Instructions & Fiscal Discrimination Module */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: "16px" }}>
                  {/* Left: Discriminação */}
                  <div style={{ padding: "22px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--border)", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "rgba(0,103,129,0.1)", color: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>receipt_long</span>
                          </div>
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>Dados Obrigatórios para Emissão</span>
                            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>Discriminação dos Serviços na Nota Fiscal</h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyNfTexto(bmVisualizando)}
                          className="btn-primary"
                          style={{ padding: "6px 12px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>content_copy</span>
                          <span>Copiar Discriminação</span>
                        </button>
                      </div>

                      <p style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginBottom: "10px" }}>
                        Copie exatamente o bloco textual abaixo e cole no campo <strong>&quot;Descrição dos Serviços / Dados Adicionais&quot;</strong> do seu emissor de Nota Fiscal:
                      </p>

                      <div style={{ backgroundColor: "var(--surface-container-low)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)", fontFamily: "inherit", fontSize: "12px", lineHeight: "1.6", color: "var(--on-surface)" }}>
                        <div style={{ fontWeight: 700, color: "var(--primary)" }}>BM: {bmVisualizando.codigo} | CONTRATO: {bmVisualizando.contrato.replace(/•\s*NNÓS/g, "").trim()}</div>
                        {Array.from(new Set(bmVisualizando.atividades.map((a) => a.projeto))).map((proj) => {
                          const subtotal = bmVisualizando.atividades
                            .filter((a) => a.projeto === proj)
                            .reduce((acc, a) => acc + a.valorTotal, 0);
                          return (
                            <div key={proj}>
                              {proj}: R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </div>
                          );
                        })}
                        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                          <strong style={{ color: "var(--primary)" }}>Código CTISS:</strong> 0802-0/01-88 (Instrução e treinamento)<br />
                          <strong style={{ color: "var(--primary)" }}>Subitem LC 116/03:</strong> 8.02 (Instrução, treinamento, orientação pedagógica).
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "14px", padding: "10px 14px", backgroundColor: "rgba(0,103,129,0.06)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "var(--secondary)" }}>email</span>
                        <span>Enviar XML e PDF da NF emitida para: <strong style={{ color: "var(--primary)" }}>leonardo.campos@nnos.com.br</strong></span>
                      </div>
                      <strong style={{ color: "var(--secondary)" }}>Ref: BM {bmVisualizando.codigo}</strong>
                    </div>
                  </div>

                  {/* Right: Cronograma */}
                  <div style={{ padding: "22px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "12px", borderBottom: "1px solid var(--border)", marginBottom: "14px" }}>
                        <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "var(--primary)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>calendar_clock</span>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>Fluxo de Caixa & Regras</span>
                          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>Cronograma de Envio e Pagamento</h3>
                        </div>
                      </div>

                      {(() => {
                        const isQuinzena1 = (bmVisualizando.periodoTipo || "").includes("1ª");
                        const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                        let mesNum = 10;
                        let anoNum = 2026;
                        const mesMatch = (bmVisualizando.mesReferencia || "").match(/(\d{4})/);
                        if (mesMatch) anoNum = Number(mesMatch[1]);
                        mesesNomes.forEach((m, idx) => {
                          if ((bmVisualizando.mesReferencia || "").toLowerCase().includes(m.toLowerCase())) mesNum = idx + 1;
                        });
                        const mesStr = String(mesNum).padStart(2, "0");
                        const proxMesNum = mesNum === 12 ? 1 : mesNum + 1;
                        const proxAnoNum = mesNum === 12 ? anoNum + 1 : anoNum;
                        const proxMesStr = String(proxMesNum).padStart(2, "0");

                        const dataBmTimeline = isQuinzena1 ? `18/${mesStr}` : `01/${proxMesStr}`;
                        const dataPrazoTimeline = isQuinzena1 ? `25/${mesStr}` : `10/${proxMesStr}`;
                        const dataCreditoTimeline = isQuinzena1 ? `10/${proxMesStr}/${proxAnoNum}` : `25/${proxMesStr}/${proxAnoNum}`;

                        return (
                          <>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                              <div style={{
                                padding: "12px",
                                borderRadius: "10px",
                                backgroundColor: isQuinzena1 ? "rgba(0,103,129,0.06)" : "var(--surface-container-low)",
                                border: isQuinzena1 ? "1.5px solid var(--secondary)" : "1px solid var(--border)",
                                display: "flex",
                                gap: "12px",
                                alignItems: "flex-start"
                              }}>
                                <div style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "8px",
                                  backgroundColor: isQuinzena1 ? "var(--primary)" : "var(--surface-container)",
                                  color: isQuinzena1 ? "#ffffff" : "var(--primary)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 800,
                                  fontSize: "13px"
                                }}>
                                  1ª
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <strong style={{ color: "var(--primary)" }}>Atividades da 1ª Quinzena</strong>
                                  </div>
                                  <span style={{ color: "var(--on-surface-variant)" }}>Envio da nota fiscal até o <strong>dia 25 do mês vigente</strong>.</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--secondary)", fontWeight: 700, fontSize: "11px", marginTop: "4px" }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>event_available</span>
                                    <span>Pagamento creditado no dia 10 subsequente</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{
                                padding: "12px",
                                borderRadius: "10px",
                                backgroundColor: !isQuinzena1 ? "rgba(0,21,47,0.06)" : "rgba(0,21,47,0.02)",
                                border: !isQuinzena1 ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                                display: "flex",
                                gap: "12px",
                                alignItems: "flex-start"
                              }}>
                                <div style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "8px",
                                  backgroundColor: !isQuinzena1 ? "var(--primary)" : "var(--surface-container)",
                                  color: !isQuinzena1 ? "#ffffff" : "var(--primary)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 800,
                                  fontSize: "13px"
                                }}>
                                  2ª
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <strong style={{ color: "var(--primary)" }}>Atividades da 2ª Quinzena/Integral</strong>
                                  </div>
                                  <span style={{ color: "var(--on-surface-variant)" }}>Envio da nota fiscal até o <strong>dia 10 após recebimento do BM</strong>.</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#059669", fontWeight: 800, fontSize: "11px", marginTop: "4px" }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>payments</span>
                                    <span>Previsão de Liquidação: Dia 25 de {bmVisualizando.mesReferencia || "Outubro de 2026"}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div style={{ marginTop: "14px", padding: "10px 14px", backgroundColor: "var(--surface-container-low)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                              <span><span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block", marginRight: "4px" }}></span>BM: <strong>{dataBmTimeline}</strong></span>
                              <span style={{ color: "var(--outline)" }}>→</span>
                              <span><span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--secondary)", display: "inline-block", marginRight: "4px" }}></span>Prazo NF: <strong>{dataPrazoTimeline}</strong></span>
                              <span style={{ color: "var(--outline)" }}>→</span>
                              <span style={{ color: "#059669", fontWeight: 700 }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--primary)", display: "inline-block", marginRight: "4px" }}></span>Crédito: <strong>{dataCreditoTimeline}</strong></span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Formal Acceptance & Digital Signatures Box */}
                <div style={{ padding: "24px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ padding: "14px 18px", borderRadius: "10px", backgroundColor: "var(--surface-container-low)", display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "20px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#d1fae5", color: "#065f46", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>task_alt</span>
                    </div>
                    <div>
                      <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>Declaração de Concordância e Aceite Operacional</h4>
                      <p style={{ fontSize: "12px", color: "var(--on-surface-variant)", margin: "4px 0 0 0" }}>
                        &quot;Declaro concordar integralmente com os valores, horas e quantidades constantes nesta medição de serviços de {bmVisualizando.mesReferencia} para fins de emissão de faturamento.&quot;
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
                    {/* Assinatura do Prestador */}
                    <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-container-low)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>Assinatura do Prestador</span>
                          <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#d1fae5", color: "#065f46", fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>done_all</span>
                            Assinado Eletronicamente
                          </span>
                        </div>

                        <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border)", margin: "8px 0" }}>
                          <span style={{ fontFamily: "cursive", fontSize: "28px", color: "var(--primary)", fontStyle: "italic", letterSpacing: "2px" }}>
                            {formatarNomeAssinatura(bmVisualizando.consultorNome)}
                          </span>
                        </div>

                        <div style={{ textAlign: "center", marginTop: "10px" }}>
                          <strong style={{ fontSize: "13px", color: "var(--primary)", display: "block" }}>{bmVisualizando.consultorNome}</strong>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            Razão Social: {bmVisualizando.consultorNome.toLowerCase().includes("marcelo") ? "DRONEX COMERCIO E SERVICOS LTDA" : (bmVisualizando.consultorRazaoSocial || bmVisualizando.consultorNome)} • CNPJ: {bmVisualizando.consultorNome.toLowerCase().includes("marcelo") ? "55.408.003/0001-50" : (bmVisualizando.consultorCnpj || "Não informado")}
                          </span>
                        </div>
                      </div>

                      {(() => {
                        const prestadorLog = bmVisualizando.logs?.find((l: any) => l.papel?.toLowerCase().includes("prestador")) || bmVisualizando.logs?.[0];
                        const ipPrestador = prestadorLog?.detalhe?.includes("IP:")
                          ? prestadorLog.detalhe.split("•")[0].replace("IP:", "").trim()
                          : "191.187.11.168";
                        const dataPrestador = prestadorLog?.dataHora || (prestadorLog?.status === "Assinado" ? "23/10/2026, 15:00:00" : "Status: Pendente");

                        return (
                          <div style={{ marginTop: "16px", paddingTop: "10px", borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            <span>IP: {ipPrestador}</span>
                            <span>Data: {dataPrestador}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Assinatura da Coordenação / Financeiro */}
                    <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-container-low)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)" }}>
                            Validação da Coordenação
                          </span>
                          <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#d1fae5", color: "#065f46", fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>done_all</span>
                            Validação Operacional
                          </span>
                        </div>

                        <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border)", margin: "8px 0" }}>
                          <span style={{ fontFamily: "cursive", fontSize: "28px", color: "var(--secondary)", fontStyle: "italic", letterSpacing: "2px" }}>
                            {bmVisualizando.consultorNome.toLowerCase().includes("marcelo")
                              ? "Leonardo Campos"
                              : formatarNomeAssinatura(bmVisualizando.responsavelNnosNome || "Marcelo Lara da Silva")}
                          </span>
                        </div>

                        <div style={{ textAlign: "center", marginTop: "10px" }}>
                          <strong style={{ fontSize: "13px", color: "var(--primary)", display: "block" }}>
                            {bmVisualizando.consultorNome.toLowerCase().includes("marcelo")
                              ? "LEONARDO CAMPOS"
                              : "MARCELO LARA DA SILVA"}
                          </strong>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            {bmVisualizando.consultorNome.toLowerCase().includes("marcelo")
                              ? "Financeiro / Validação Final • NNÓS"
                              : "Líder de Projetos / Coordenação Operacional • NNÓS"}
                          </span>
                        </div>
                      </div>

                      {(() => {
                        const coordLog = bmVisualizando.logs?.find((l: any) => l.papel?.toLowerCase().includes("coord") || l.papel?.toLowerCase().includes("valida")) || bmVisualizando.logs?.[2];
                        const docIdFinal = bmVisualizando.zohoDocumentId ||
                          (coordLog?.detalhe?.includes("Doc ID:") ? coordLog.detalhe.split("Doc ID:")[1].trim() : null) ||
                          bmVisualizando.zohoRequestId ||
                          "2EEBEA08-B5P3HI3SGTH9S3DTW24ZYKXM-EG74VXMYB4CASUAB8G";
                        const dataCoord = coordLog?.dataHora || (coordLog?.status === "Assinado" ? "23/10/2026, 15:13:00" : (bmVisualizando.status.includes("Aprovado") ? "23/10/2026, 15:13:00" : bmVisualizando.dataEnvio));

                        return (
                          <div style={{ marginTop: "16px", paddingTop: "10px", borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            <span>Zoho Doc ID: {docIdFinal}</span>
                            <span>Data: {dataCoord}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Document Master Footer */}
                <footer style={{ backgroundColor: "var(--primary)", color: "#ffffff", padding: "20px 24px", borderRadius: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <img
                      src="/logo-coruja-branca.png"
                      alt="Logo NNÓS"
                      style={{ width: "38px", height: "38px", objectFit: "contain", display: "block" }}
                    />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700 }}>NNÓS Consultoria e Treinamento LTDA</div>
                      <div style={{ fontSize: "11px", opacity: 0.85 }}>CNPJ: 36.443.716/0001-00 • Inscrição Municipal: 1.208.841/002-5</div>
                      <div style={{ fontSize: "10px", opacity: 0.75 }}>Rua Sergipe, nº 77 – Loja 1, Boa Viagem, Belo Horizonte - MG, CEP: 30.130-170</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "11px", opacity: 0.85 }}>
                    <div>Autenticador: <strong>BM {bmVisualizando.codigo}-SET26</strong></div>
                    <div style={{ fontSize: "10px" }}>Documento gerado eletronicamente com validade jurídica</div>
                  </div>
                </footer>
              </div>

              {/* Layout Oficial de Exportação A4 (Renderizado EXCLUSIVAMENTE ao Exportar PDF / window.print()) */}
              <BmExportPdfSheet bm={bmVisualizando} />
            </>
          ) : (
              /* CENTRAL DE MEDIÇÕES & WORKFLOW DE BM (LARGURA TOTAL AMPLIADA) */
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                {/* Cabeçalho Congelado no Topo com Título e Cards de Indicadores (Print 1) */}
                <div
                  className="sticky-kpi-header"
                  style={{
                    position: "sticky",
                    top: "64px",
                    zIndex: 25,
                    backgroundColor: "var(--background)",
                    paddingTop: "6px",
                    paddingBottom: "14px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                      <h1 style={{ fontFamily: "var(--font-jakarta)", fontSize: "24px", fontWeight: 700, color: "var(--primary)", margin: "0 0 6px 0", lineHeight: "1.3", letterSpacing: "-0.01em" }}>
                        Boletim de Medição de Serviços (BM)
                      </h1>
                      <p style={{ fontSize: "13.5px", color: "var(--on-surface-variant)", margin: 0, lineHeight: "1.5" }}>
                        Central de geração, controle de quinzenas e workflow de assinaturas digitais
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setModalEnvioMassaAberto(true)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "13px",
                          padding: "10px 18px",
                          backgroundColor: "#0d9488",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: 700,
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(13, 148, 136, 0.25)",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#0f766e";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#0d9488";
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>forward_to_inbox</span>
                        <span>Enviar BMs em Massa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPainelGeracaoAberto(!painelGeracaoAberto)}
                        className="btn-primary"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", padding: "10px 18px", boxShadow: "0 2px 8px rgba(0,21,47,0.18)" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                          {painelGeracaoAberto ? "close" : "add_circle"}
                        </span>
                        <span>{painelGeracaoAberto ? "Fechar Formulário" : "Novo Boletim de Medição"}</span>
                      </button>
                    </div>
                  </div>

                  {/* CARDS DE INDICADORES CONSOLIDADOS DE 2026 */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", width: "100%" }}>
                    <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "rgba(0,21,47,0.08)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>receipt_long</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>BMs Emitidos (2026)</span>
                        <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", margin: "2px 0 0 0" }}>{bmsLista.length}</h3>
                        <span style={{ fontSize: "10px", color: "var(--secondary)" }}>Ano 2026 consolidado</span>
                      </div>
                    </div>

                    <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "rgba(0,103,129,0.1)", color: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>payments</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Total Faturado (2026)</span>
                        <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--secondary)", margin: "2px 0 0 0" }}>
                          R$ {bmsLista.reduce((acc, b) => acc + (b.valorTotal || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                        <span style={{ fontSize: "10px", color: "#059669", fontWeight: 600 }}>222 Medições Faturadas</span>
                      </div>
                    </div>

                    <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "rgba(16,185,129,0.1)", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>schedule</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Carga Horária Medida</span>
                        <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", margin: "2px 0 0 0" }}>
                          {bmsLista.reduce((acc, b) => acc + (b.totalHoras || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h
                        </h3>
                        <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Horas técnicas aprovadas</span>
                      </div>
                    </div>

                    <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.1)", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>group</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Prestadores Ativos</span>
                        <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", margin: "2px 0 0 0" }}>
                          {new Set(bmsLista.map((b) => formatarNomeCurto(b.consultorNome, b.consultorCnpj))).size}
                        </h3>
                        <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Profissionais c/ BM em 2026</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PAINEL / FORMULÁRIO DE GERAÇÃO DO BM (PASSO ANTERIOR) */}
                {painelGeracaoAberto && (
                  <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "22px 24px", borderRadius: "14px", border: "2px solid var(--secondary)", boxShadow: "0 8px 24px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: "18px", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="material-symbols-outlined" style={{ color: "var(--secondary)", fontSize: "22px" }}>tune</span>
                        <strong style={{ fontSize: "16px", color: "var(--primary)" }}>
                          Gerar Novo BM
                        </strong>
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--on-surface-variant)" }}>
                        Próximo Código Sequencial: <strong style={{ color: "var(--secondary)" }}>BM {proximoCodigo}</strong>
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px" }}>
                      {/* Consultor / Instrutor - Versão Curta */}
                      <div className="form-field">
                        <label style={{ fontSize: "11px", fontWeight: 700 }}>Consultor / Prestador *</label>
                        <ModernDropdown
                          value={consultorSelecionadoNome}
                          onChange={(val) => setConsultorSelecionadoNome(String(val))}
                          options={CONSULTORES_DISPONIVEIS.map((c) => ({
                            value: c.nome,
                            label: `${c.nome}${c.cnpj ? ` (${c.cnpj})` : ''}`,
                          }))}
                          icon="badge"
                          searchable={true}
                          searchPlaceholder="Digitar para buscar consultor ou CNPJ..."
                          style={{ width: "100%" }}
                          buttonStyle={{ width: "100%", height: "38px" }}
                        />
                      </div>

                      {/* Ano de Referência */}
                      <div className="form-field">
                        <label style={{ fontSize: "11px", fontWeight: 700 }}>Ano de Referência *</label>
                        <ModernDropdown
                          value={anoReferencia}
                          onChange={(val) => setAnoReferencia(String(val))}
                          options={anosDisponiveis.map((a) => ({
                            value: String(a),
                            label: String(a),
                          }))}
                          icon="calendar_today"
                          searchable={false}
                          style={{ width: "100%" }}
                          buttonStyle={{ width: "100%", height: "38px" }}
                        />
                      </div>

                      {/* Mês de Referência com indicação de lançamentos */}
                      <div className="form-field">
                        <label style={{ fontSize: "11px", fontWeight: 700 }}>Mês de Referência *</label>
                        <ModernDropdown
                          value={mesReferenciaNum}
                          onChange={(val) => setMesReferenciaNum(Number(val))}
                          options={MESES_LISTA.map((m) => {
                            const temLanc = mesesComLancamentos.includes(m.num);
                            return {
                              value: m.num,
                              label: `${m.nome} ${temLanc ? "✓ (Com lançamentos)" : "— (Sem lançamentos)"}`,
                            };
                          })}
                          icon="date_range"
                          searchable={false}
                          style={{ width: "100%" }}
                          buttonStyle={{ width: "100%", height: "38px" }}
                        />
                      </div>

                      {/* Período da Medição */}
                      <div className="form-field">
                        <label style={{ fontSize: "11px", fontWeight: 700 }}>Período da Medição *</label>
                        <ModernDropdown
                          value={periodoTipo}
                          onChange={(val) => setPeriodoTipo(val as "1ª Quinzena" | "2ª Quinzena" | "Integral")}
                          options={[
                            { value: "1ª Quinzena", label: "1ª Quinzena (Início do Mês até Corte)" },
                            { value: "2ª Quinzena", label: "2ª Quinzena (Corte até Fim do Mês)" },
                            { value: "Integral", label: "Integral (Mês Cheio)" },
                          ]}
                          icon="timelapse"
                          searchable={false}
                          style={{ width: "100%" }}
                          buttonStyle={{ width: "100%", height: "38px" }}
                        />
                      </div>

                      {/* Data de Corte */}
                      <div className="form-field">
                        <label style={{ fontSize: "11px", fontWeight: 700 }}>Data de Corte (Divisão de Quinzenas) *</label>
                        <input
                          type="text"
                          value={dataCorte}
                          placeholder="Ex: 15/09/2026"
                          onChange={(e) => setDataCorte(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Resumo Pré-visualizado dos Dados da Gestão de Projetos */}
                    <div style={{ backgroundColor: "var(--surface-container-low)", padding: "16px 20px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", flexWrap: "wrap" }}>
                          <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: "22px" }}>hub</span>
                          {carregandoProjetos ? (
                            <span style={{ color: "var(--secondary)", fontWeight: 600 }}>
                              Consultando base de dados dos Projetos...
                            </span>
                          ) : previewAtividades.length > 0 ? (
                            <>
                              
                              <span>
                                <strong>{previewAtividades.length} lançamentos</strong> vinculados ({mesReferenciaFormatado})
                              </span>
                              <span style={{ color: "var(--outline)" }}>•</span>
                              <span>
                                Carga Horária: <strong>{previewTotalHoras.toFixed(1)} h</strong>
                              </span>
                              <span style={{ color: "var(--outline)" }}>•</span>
                              <span>
                                Valor Total: <strong style={{ color: "var(--primary)" }}>R$ {previewValorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                              </span>
                            </>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 700, fontSize: "11px" }}>
                                Sem Lançamentos
                              </span>
                              <span style={{ color: "var(--on-surface-variant)" }}>
                                Nenhum lançamento na base de Projetos para <strong>{consultorSelecionadoNome}</strong> em <strong>{mesReferenciaFormatado}</strong>.
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleIniciarGeracaoBM}
                          className="btn-primary"
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "8px 18px", backgroundColor: "var(--secondary)" }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>description</span>
                          <span>Gerar BM {proximoCodigo}</span>
                        </button>
                      </div>

                      {/* Tabela de Lançamentos Vinculados em Tempo Real (Print 1: aumentado para comportar pelo menos 8 atividades) */}
                      {previewAtividades.length > 0 && (
                        <div style={{ maxHeight: "360px", overflowY: "auto", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                          <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                              <tr style={{ color: "var(--on-surface-variant)" }}>
                                <th style={{ padding: "6px 8px" }}>Projeto</th>
                                <th style={{ padding: "6px 8px" }}>Atividade</th>
                                <th style={{ padding: "6px 8px", textAlign: "center" }}>Período</th>
                                <th style={{ padding: "6px 8px", textAlign: "right" }}>Horas</th>
                                <th style={{ padding: "6px 8px", textAlign: "right" }}>Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewAtividades.map((at, idx) => (
                                <tr key={idx} style={{ borderTop: "1px dashed var(--border)" }}>
                                  <td style={{ padding: "6px 8px", fontWeight: 600, color: "var(--primary)" }}>{at.projeto}</td>
                                  <td style={{ padding: "6px 8px" }}>{at.atividade}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "center", color: "var(--on-surface-variant)" }}>{at.periodo}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{at.horas.toFixed(1)} h</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>R$ {at.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* BARRA DE PESQUISA E FILTROS DE STATUS DO WORKFLOW */}
                <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "12px 18px", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "320px" }}>
                    <span className="material-symbols-outlined" style={{ color: "var(--outline)", fontSize: "18px" }}>search</span>
                    <input
                      type="text"
                      placeholder="Pesquisar por BM (0903), consultor, contrato ou período..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      style={{ width: "100%", border: "none", outline: "none", fontSize: "13px", background: "transparent" }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Workflow:</span>
                    <ModernDropdown
                      value={filtroStatus}
                      onChange={(val) => setFiltroStatus(String(val))}
                      options={[
                        { value: "Todos", label: `Todos os Status (${bmsLista.length})` },
                        { value: "Pendente de Assinatura", label: "Pendente de Assinatura" },
                        { value: "Assinado pelo Prestador", label: "Assinado pelo Prestador" },
                        { value: "Aprovado pelo Líder", label: "Aprovado pelo Líder" },
                        { value: "Aprovado & Pronto p/ Faturamento", label: "Aprovado & Pronto p/ Faturamento" },
                      ]}
                      icon="filter_list"
                      searchable={false}
                      minWidth="200px"
                    />

                    <button
                      type="button"
                      onClick={handleSincronizarZoho}
                      disabled={sincronizandoZoho}
                      className="btn-secondary"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        padding: "8px 14px",
                        borderRadius: "10px",
                        cursor: sincronizandoZoho ? "wait" : "pointer",
                      }}
                      title="Consultar e sincronizar status de assinaturas em tempo real com o Zoho Sign"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "16px",
                          animation: sincronizandoZoho ? "spin 1s linear infinite" : "none",
                        }}
                      >
                        sync
                      </span>
                      <span>{sincronizandoZoho ? "Sincronizando..." : "Sincronizar Zoho"}</span>
                    </button>
                  </div>
                </div>

                {/* TABELA DE BMS GERADOS E WORKFLOW DE ASSINATURAS (LARGURA AMPLA COMPLETA) */}
                <div style={{ backgroundColor: "var(--surface-container-lowest)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", width: "100%" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ backgroundColor: "var(--surface-container-low)", borderBottom: "1px solid var(--border)", color: "var(--on-surface-variant)", fontSize: "11px", textTransform: "uppercase" }}>
                        <th style={{ padding: "12px 18px", width: "90px" }}>Código</th>
                        <th style={{ padding: "12px 18px" }}>Consultor / Prestador</th>
                        <th style={{ padding: "12px 18px" }}>Período & Quinzena</th>
                        <th style={{ padding: "12px 18px", textAlign: "right" }}>Horas</th>
                        <th style={{ padding: "12px 18px", textAlign: "right" }}>Valor Apurado</th>
                        <th style={{ padding: "12px 18px" }}>Status do Workflow</th>
                        <th style={{ padding: "12px 18px" }}>Log de Informações & Assinaturas</th>
                        <th style={{ padding: "12px 18px", textAlign: "center" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bmsFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "var(--on-surface-variant)" }}>
                            Nenhum boletim de medição encontrado com os filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        bmsFiltrados.map((bm) => (
                          <tr key={bm.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            {/* Código sem # */}
                            <td style={{ padding: "14px 18px", fontWeight: 800, color: "var(--primary)", fontSize: "13px" }}>
                              {bm.codigo}
                            </td>
                            <td style={{ padding: "14px 18px" }}>
                              <strong style={{ color: "var(--on-surface)", display: "block" }}>{formatarNomeCurto(bm.consultorNome, bm.consultorCnpj)}</strong>
                              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>CNPJ: {bm.consultorCnpj}</span>
                            </td>
                            <td style={{ padding: "14px 18px" }}>
                              <div>{bm.mesReferencia}</div>
                              <span style={{ fontSize: "11px", color: "var(--secondary)", fontWeight: 600 }}>
                                {bm.periodoTipo === "Integral"
                                  ? "Integral"
                                  : `${bm.periodoTipo} (Corte ${bm.dataCorte})`}
                              </span>
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 600 }}>
                              {bm.totalHoras.toFixed(1)} h
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: "var(--primary)" }}>
                              R$ {bm.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "14px 18px" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  backgroundColor:
                                    bm.status === "Aprovado & Pronto p/ Faturamento"
                                      ? "#d1fae5"
                                      : bm.status === "Assinado pelo Prestador" || bm.status === "Aprovado pelo Líder"
                                      ? "#e0f2fe"
                                      : "#fef3c7",
                                  color:
                                    bm.status === "Aprovado & Pronto p/ Faturamento"
                                      ? "#065f46"
                                      : bm.status === "Assinado pelo Prestador" || bm.status === "Aprovado pelo Líder"
                                      ? "#0369a1"
                                      : "#92400e",
                                }}
                              >
                                {bm.status}
                              </span>
                            </td>
                            <td style={{ padding: "14px 18px", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                              <div style={{ marginBottom: "3px" }}><span style={{ fontWeight: 600 }}>Envio:</span> {bm.dataEnvio}</div>
                              {bm.logs.map((l, idx) => {
                                // Limpar qualquer parêntese duplicado ou textos acumulados como (Assinado) ou (Homologado)
                                let dataLimpa = l.dataHora
                                  ? l.dataHora
                                      .replace(/[()]/g, "")
                                      .replace(/\b(Assinado|Homologado|Aprovado)\b/gi, "")
                                      .trim()
                                  : "";

                                const isConcluido = l.status === "Assinado" || l.status === "Aprovado";
                                if (!isConcluido) {
                                  dataLimpa = "";
                                }

                                // Mapeamento corporativo do papel
                                let papelExibicao = l.papel;
                                if (papelExibicao === "Consultor") papelExibicao = "Prestador de Serviços";
                                if (papelExibicao === "Lider") papelExibicao = "Aprovador (Líder de Projeto)";
                                if (papelExibicao === "ValidacaoFinal") papelExibicao = "Coordenação / Validação Final";

                                return (
                                  <div key={idx} style={{ fontSize: "10.5px", marginTop: "3px", display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: isConcluido ? "#10b981" : "#f59e0b", display: "inline-block", flexShrink: 0 }}></span>
                                    <span style={{ fontWeight: 600, color: "var(--on-surface)" }}>{papelExibicao}:</span>
                                    <span style={{ color: isConcluido ? "#059669" : "#d97706", fontWeight: 700 }}>{l.status}</span>
                                    {dataLimpa && (
                                      <span style={{ color: "var(--on-surface-variant)", fontSize: "9.5px", opacity: 0.85 }}>• {dataLimpa}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "center" }}>
                              <div style={{ display: "inline-flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  onClick={() => setBmVisualizando(bm)}
                                  className="btn-primary"
                                  style={{ padding: "6px 12px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  title="Visualizar documento do BM e exportar"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>visibility</span>
                                  <span>Visualizar</span>
                                </button>

                                {bm.status !== "Aprovado & Pronto p/ Faturamento" && (
                                  <button
                                    type="button"
                                    onClick={() => handleAvancarAssinatura(bm)}
                                    className="btn-secondary"
                                    style={{ padding: "6px 8px", fontSize: "11px" }}
                                    title="Avançar etapa de assinatura"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "var(--secondary)" }}>draw</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleExcluirBm(bm)}
                                  className="btn-secondary"
                                  style={{ padding: "6px 8px", fontSize: "11px", color: "#dc2626" }}
                                  title="Excluir este BM"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* POP-UP / MODAL DE SELEÇÃO DE E-MAIL DOS SIGNATÁRIOS, APROVADOR E CÓPIA */}
      {modalAssinaturaAberto && bmEmCriacao && (
        <div className="modal-backdrop" onClick={() => setModalAssinaturaAberto(false)}>
          <div className="modal-card" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <span className="material-symbols-outlined" style={{ color: "var(--secondary)" }}>forward_to_inbox</span>
                <span>Enviar para Assinatura (BM {bmEmCriacao.codigo})</span>
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setModalAssinaturaAberto(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmarEnvioAssinatura} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              <div className="modal-body" style={{ overflowY: "auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ backgroundColor: "var(--surface-container-low)", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", border: "1px solid var(--border)" }}>
                  <div><strong>Prestador:</strong> {bmEmCriacao.consultorNome}</div>
                  <div><strong>Período:</strong> {bmEmCriacao.mesReferencia} ({bmEmCriacao.periodoTipo}) • <strong>Valor:</strong> R$ {bmEmCriacao.valorTotal?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                </div>

                {/* 1. E-mail do Consultor */}
                <div className="form-field">
                  <label style={{ fontSize: "11px", fontWeight: 700 }}>1. E-mail do Consultor / Prestador (Signatário 1) *</label>
                  <input
                    type="email"
                    required
                    value={emailConsultor}
                    onChange={(e) => setEmailConsultor(e.target.value)}
                    placeholder="email.consultor@nnos.com.br"
                  />
                </div>

                {/* 2. Aprovador (Líder do Projeto) */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px" }}>
                  <div className="form-field">
                    <label style={{ fontSize: "11px", fontWeight: 700 }}>2. Aprovador (Líder de Projeto) *</label>
                    <ModernDropdown
                      value={liderEscolhidoNome}
                      onChange={(val) => {
                        const strVal = String(val);
                        setLiderEscolhidoNome(strVal);
                        const lider = lideresDisponiveis.find((l) => l.nome === strVal);
                        if (lider) setLiderEscolhidoEmail(lider.email);
                      }}
                      options={lideresDisponiveis.map((lp) => ({
                        value: lp.nome,
                        label: lp.nome,
                      }))}
                      icon="supervisor_account"
                      searchable={true}
                      searchPlaceholder="Pesquisar líder de projeto..."
                      style={{ width: "100%" }}
                      buttonStyle={{ width: "100%", height: "38px" }}
                    />
                  </div>
                  <div className="form-field">
                    <label style={{ fontSize: "11px", fontWeight: 700 }}>E-mail do Líder *</label>
                    <input
                      type="email"
                      required
                      value={liderEscolhidoEmail}
                      onChange={(e) => setLiderEscolhidoEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* 3. Responsável NNÓS */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px" }}>
                  <div className="form-field">
                    <label style={{ fontSize: "11px", fontWeight: 700 }}>3. Validação Final (Responsável NNÓS) *</label>
                    <input
                      type="text"
                      disabled
                      value={responsavelNnosAtual.nome}
                      style={{ opacity: 0.85, backgroundColor: "var(--surface-container-low)" }}
                    />
                  </div>
                  <div className="form-field">
                    <label style={{ fontSize: "11px", fontWeight: 700 }}>E-mail da Validação Final *</label>
                    <input
                      type="email"
                      required
                      value={emailResponsavelNnos}
                      onChange={(e) => setEmailResponsavelNnos(e.target.value)}
                      placeholder="responsavel@nnos.com.br"
                    />
                  </div>
                </div>

                {/* Receber cópia após assinatura */}
                <div style={{ backgroundColor: "var(--surface-container-high)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={receberCopia}
                      onChange={(e) => setReceberCopia(e.target.checked)}
                      style={{ width: "16px", height: "16px" }}
                    />
                    <span>Receber uma cópia do BM após a conclusão de todas as assinaturas</span>
                  </label>

                  {receberCopia && (
                    <div className="form-field" style={{ marginTop: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary)" }}>
                        E-mail para Cópia (Financeiro)
                      </label>
                      <input
                        type="text"
                        value={emailCopia}
                        onChange={(e) => setEmailCopia(e.target.value)}
                        placeholder="leonardo.campos@nnos.com.br; outro@nnos.com.br"
                        style={{ backgroundColor: "#ffffff" }}
                      />
                      <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
                        Você pode incluir múltiplos e-mails separando-os por ponto e vírgula (;)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalAssinaturaAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ backgroundColor: "var(--secondary)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>send</span>
                  <span>Confirmar e Enviar para Assinatura</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notificação Toast Moderna (Design Padronizado Print 1) */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "24px",
            zIndex: 9999,
            width: "320px",
            height: "48px",
            backgroundColor: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e6edf5",
            boxShadow: "0 8px 24px rgba(15,42,74,0.10), 0 2px 6px rgba(15,42,74,0.04)",
            display: "flex",
            alignItems: "center",
            padding: "0 12px 0 0",
            overflow: "hidden",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            style={{
              width: "4px",
              height: "28px",
              borderRadius: "2px",
              background: "linear-gradient(180deg, #34d399, #059669)",
              marginLeft: "8px",
              marginRight: "10px",
            }}
          />
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "10px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1.5 4L3.8 6.2L8.5 1.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
              fontSize: "13.5px",
              fontWeight: 700,
              color: "#0f2a4a",
              letterSpacing: "-0.2px",
              flex: 1,
            }}
          >
            {toastMsg}
          </span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              backgroundColor: "#f1f5f9",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              color: "#64748b",
            }}
            title="Fechar"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {bmParaExcluir && (
        <div className="modal-backdrop" onClick={() => setBmParaExcluir(null)} style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ color: "#dc2626" }}>delete_forever</span>
                <span>Excluir Boletim de Medição</span>
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setBmParaExcluir(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: "14px", lineHeight: "1.5" }}>
                Deseja realmente excluir o <strong>BM {bmParaExcluir.codigo}</strong> ({bmParaExcluir.consultorNome})?
              </p>
              <p style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "8px" }}>
                Esta ação removerá o registro e liberará as atividades para nova medição.
              </p>
            </div>
            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "14px 20px" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setBmParaExcluir(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
                onClick={confirmarExclusao}
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Envio de BMs em Massa */}
      {modalEnvioMassaAberto && (
        <EnvioMassaBmModal
          onClose={() => setModalEnvioMassaAberto(false)}
          onConcluido={async () => {
            try {
              const res = await fetch("/api/medicao?sync=1");
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                setBmsLista(data);
                try {
                  localStorage.setItem("nnos_bms_2026_v5", JSON.stringify(data));
                } catch {}
              }
            } catch (err) {
              console.warn("Erro ao recarregar BMs após envio em massa:", err);
            }
          }}
          showToast={showToast}
          bmsListaExistente={bmsLista}
        />
      )}

      {/* Estilos de Impressão A4: Na tela interativa exibe o formato rico; ao Exportar PDF / window.print() renderiza EXCLUSIVAMENTE o layout A4 fornecido */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 6mm;
        }

        @media print {
          /* Ocultar elementos de sistema, botões de tela, topbar, sidebars e o layout da tela interativa */
          aside.sidebar,
          header.top-header,
          .no-print,
          .screen-nav-bar,
          .screen-bm-view,
          .bm-document-container,
          button,
          .btn-primary,
          .btn-secondary,
          .theme-toggle-btn {
            display: none !important;
          }

          /* Reset de layout limpo para impressão */
          html, body, .app-layout, .main-wrapper, .main-content {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
          }

          /* Exibir EXCLUSIVAMENTE o layout oficial fornecido pelo usuário para Exportar PDF */
          .print-only-a4 {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .a4-sheet {
            width: 100% !important;
            height: 100vh !important;
            min-height: 100vh !important;
            max-height: 100vh !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
