"use client";
import Link from "next/link";

import React, { useState, useEffect, useMemo } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import ModernDropdown from "@/components/ModernDropdown";
import { formatarDataBR } from "@/lib/date-utils";

interface PrecoItem {
  atividade: string;
  perfil: string;
  descricaoPerfil?: string;
  tipoCobranca?: string;
  anos: {
    [ano: string]: {
      valorHora: number;
      valorDia: number;
      valorMensal?: number;
    };
  };
}

interface ConsultorTarifa {
  perfil: string;
  clienteBrasil: { valorHora: number; valorDia: number };
  clienteLatam: { valorHora: number; valorDia: number };
  socioBrasil: number;
  socioLatam: number;
  parceiroBrasil: number;
  parceiroLatam: number;
}

interface ReajusteItem {
  ano: number;
  indice: string;
  aliquota: number;
  dataVigencia: string;
  observacoes?: string;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  cliente: string;
  ativo: boolean;
  centrosDeCusto: string[];
  reajustes: ReajusteItem[];
  tabelaPrecoCliente: PrecoItem[];
  tabelaConsultores: ConsultorTarifa[];
  regraSocio: {
    percentualAcrescimoNF: number;
    excecaoPalavra: string;
    descricao: string;
  };
  metricas?: {
    faturadoTotal: number;
    recebidoTotal: number;
    taxaAdimplencia: number;
    qtdFaturas: number;
    horasExecutadas: number;
    diasExecutados: number;
    receitaPrevista: number;
    custoConsultores: number;
    margemEstimada: number;
    qtdLancamentos: number;
  };
}

export default function TabelaPrecosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [contratoSelecionadoId, setContratoSelecionadoId] = useState<string>("contrato-cnh");
  const [abaAtiva, setAbaAtiva] = useState<"cliente" | "consultores" | "centros_custo" | "reajustes">("cliente");
  const [modoVisualizacao, setModoVisualizacao] = useState<"comparativo" | "vigente">("comparativo");
  const [anoFiltro, setAnoFiltro] = useState<string>("TODOS");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  // Estados do Modal de Reajuste
  const [modalReajusteAberto, setModalReajusteAberto] = useState(false);
  const [reajAno, setReajAno] = useState("2027");
  const [reajIndice, setReajIndice] = useState("CCT Maio");
  const [reajAliquota, setReajAliquota] = useState("5.32");
  const [reajVigencia, setReajVigencia] = useState("01/05/2027");
  const [reajObs, setReajObs] = useState("");
  const [salvandoReajuste, setSalvandoReajuste] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Estados do Modal de Novo Contrato
  const [modalNovoContratoAberto, setModalNovoContratoAberto] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoCliente, setNovoCliente] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novosCentrosCusto, setNovosCentrosCusto] = useState("");
  const [tarifaClienteJunior, setTarifaClienteJunior] = useState("199.88");
  const [tarifaClientePleno, setTarifaClientePleno] = useState("214.38");
  const [tarifaClienteSenior, setTarifaClienteSenior] = useState("228.62");
  const [tarifaConsultorSocioBrasil, setTarifaConsultorSocioBrasil] = useState("115.00");
  const [tarifaConsultorSocioLatam, setTarifaConsultorSocioLatam] = useState("140.00");
  const [tarifaConsultorParceiroBrasil, setTarifaConsultorParceiroBrasil] = useState("105.00");
  const [tarifaConsultorParceiroLatam, setTarifaConsultorParceiroLatam] = useState("110.00");
  const [salvandoNovoContrato, setSalvandoNovoContrato] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const carregarDados = () => {
    setCarregando(true);
    fetch("/api/tabela-precos")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.contratos) {
          setContratos(res.data.contratos);
          if (!res.data.contratos.some((c: any) => c.id === contratoSelecionadoId) && res.data.contratos[0]) {
            setContratoSelecionadoId(res.data.contratos[0].id);
          }
        }
      })
      .catch((e) => console.error("Erro ao carregar tabela de preços:", e))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleCriarNovoContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCodigo.trim() || !novoNome.trim()) {
      alert("Por favor, preencha o código e o nome do contrato.");
      return;
    }
    setSalvandoNovoContrato(true);
    try {
      const ccsArray = novosCentrosCusto
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/tabela-precos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "criar-contrato",
          codigo: novoCodigo.trim().toUpperCase(),
          nome: novoNome.trim(),
          cliente: (novoCliente || novoCodigo).trim().toUpperCase(),
          descricao: novaDescricao.trim(),
          centrosDeCusto: ccsArray,
          tabelaPrecoCliente: [
            {
              atividade: "Docência/Projetação",
              perfil: "JÚNIOR",
              anos: {
                "2026": {
                  valorHora: parseFloat(tarifaClienteJunior) || 199.88,
                  valorDia: Math.round((parseFloat(tarifaClienteJunior) || 199.88) * 8 * 100) / 100,
                },
              },
            },
            {
              atividade: "Docência/Projetação",
              perfil: "PLENO",
              anos: {
                "2026": {
                  valorHora: parseFloat(tarifaClientePleno) || 214.38,
                  valorDia: Math.round((parseFloat(tarifaClientePleno) || 214.38) * 8 * 100) / 100,
                },
              },
            },
            {
              atividade: "Docência/Projetação",
              perfil: "SÊNIOR",
              anos: {
                "2026": {
                  valorHora: parseFloat(tarifaClienteSenior) || 228.62,
                  valorDia: Math.round((parseFloat(tarifaClienteSenior) || 228.62) * 8 * 100) / 100,
                },
              },
            },
            {
              atividade: "Treinamentos Gerenciais",
              perfil: "SÊNIOR",
              anos: {
                "2026": {
                  valorHora: parseFloat(tarifaClienteSenior) || 228.62,
                  valorDia: Math.round((parseFloat(tarifaClienteSenior) || 228.62) * 8 * 100) / 100,
                },
              },
            },
          ],
          tabelaConsultores: [
            {
              perfil: "JÚNIOR",
              clienteBrasil: { valorHora: parseFloat(tarifaClienteJunior) || 199.88, valorDia: (parseFloat(tarifaClienteJunior) || 199.88) * 8 },
              clienteLatam: { valorHora: parseFloat(tarifaClienteJunior) || 199.88, valorDia: (parseFloat(tarifaClienteJunior) || 199.88) * 8 },
              socioBrasil: 105.0,
              socioLatam: parseFloat(tarifaConsultorSocioLatam) || 140.0,
              parceiroBrasil: 97.0,
              parceiroLatam: parseFloat(tarifaConsultorParceiroLatam) || 110.0,
            },
            {
              perfil: "PLENO",
              clienteBrasil: { valorHora: parseFloat(tarifaClientePleno) || 214.38, valorDia: (parseFloat(tarifaClientePleno) || 214.38) * 8 },
              clienteLatam: { valorHora: parseFloat(tarifaClientePleno) || 214.38, valorDia: (parseFloat(tarifaClientePleno) || 214.38) * 8 },
              socioBrasil: 110.0,
              socioLatam: parseFloat(tarifaConsultorSocioLatam) || 140.0,
              parceiroBrasil: 100.0,
              parceiroLatam: parseFloat(tarifaConsultorParceiroLatam) || 110.0,
            },
            {
              perfil: "SÊNIOR",
              clienteBrasil: { valorHora: parseFloat(tarifaClienteSenior) || 228.62, valorDia: (parseFloat(tarifaClienteSenior) || 228.62) * 8 },
              clienteLatam: { valorHora: parseFloat(tarifaClienteSenior) || 228.62, valorDia: (parseFloat(tarifaClienteSenior) || 228.62) * 8 },
              socioBrasil: parseFloat(tarifaConsultorSocioBrasil) || 115.0,
              socioLatam: parseFloat(tarifaConsultorSocioLatam) || 140.0,
              parceiroBrasil: parseFloat(tarifaConsultorParceiroBrasil) || 105.0,
              parceiroLatam: parseFloat(tarifaConsultorParceiroLatam) || 110.0,
            },
          ],
          regraSocio: {
            percentualAcrescimoNF: 6.0,
            excecaoPalavra: "COMISSÃO",
            descricao: "O valor do sócio tem acréscimo de 6% na tarifa para compensar a emissão de nota fiscal, exceto em atividades com a palavra COMISSÃO.",
          },
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast("Novo contrato cadastrado com sucesso!");
        setModalNovoContratoAberto(false);
        const novoId = `contrato-${novoCodigo.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
        setContratoSelecionadoId(novoId);
        setNovoCodigo("");
        setNovoNome("");
        setNovoCliente("");
        setNovaDescricao("");
        setNovosCentrosCusto("");
        carregarDados();
      } else {
        alert("Erro ao criar contrato: " + json.error);
      }
    } catch (err: any) {
      alert("Erro ao criar contrato: " + err.message);
    } finally {
      setSalvandoNovoContrato(false);
    }
  };

  const contratoAtual = useMemo(() => {
    return contratos.find((c) => c.id === contratoSelecionadoId) || contratos[0] || null;
  }, [contratos, contratoSelecionadoId]);

  const opcoesContratos = useMemo(() => {
    return contratos.map((c) => ({
      value: c.id,
      label: `${c.nome} (${c.cliente})`,
      icon: "contract",
    }));
  }, [contratos]);

  const handleAplicarReajuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratoAtual) return;
    setSalvandoReajuste(true);
    try {
      const res = await fetch("/api/tabela-precos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "aplicar-reajuste",
          contratoId: contratoAtual.id,
          ano: parseInt(reajAno, 10),
          indice: reajIndice,
          aliquota: parseFloat(reajAliquota),
          dataVigencia: reajVigencia,
          observacoes: reajObs,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Reajuste contratual aplicado com sucesso!");
        setModalReajusteAberto(false);
        carregarDados();
      } else {
        alert("Erro: " + json.error);
      }
    } catch (e: any) {
      alert("Erro ao aplicar reajuste: " + e.message);
    } finally {
      setSalvandoReajuste(false);
    }
  };

  const formatBRL = (val: number | undefined | null) => {
    if (val == null || isNaN(val)) return "—";
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div className="app-layout">
      {/* Sidebar Oficial Padronizada */}
      <aside className="sidebar">
        <div className="flex flex-col">
          <div className="sidebar-brand">
            <img src="/logo-coruja.png" alt="Logo Coruja NNÓS" className="sidebar-brand-img" />
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
            <Link href="/medicao" className="nav-item">
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
            <Link href="/tabela-precos" className="nav-item active">
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
          <div
            className="sidebar-footer-info"
            style={{
              padding: "8px 12px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface)" }}>
              Sistema Operacional NNÓS
            </span>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
              Tabela de Preços & Contratos
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
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
              Tabela de Preços - Contratos Clientes
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ThemeToggle />
            <Link
              href="/centro-de-custo"
              className="btn-secondary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "6px 12px" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>account_tree</span>
              <span>Matriz de Centro de Custo</span>
            </Link>
          </div>
        </header>

        <main className="content-container">
          {/* Toast Notification */}
          {toastMsg && (
            <div
              style={{
                position: "fixed",
                bottom: "24px",
                right: "24px",
                background: "#065f46",
                color: "#ffffff",
                padding: "12px 20px",
                borderRadius: "10px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                zIndex: 9999,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>check_circle</span>
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Banner de Título & Controles de Ação */}
          <div className="page-title-strip">
            <div>
              <h1 className="page-title">
                <span>Tabela de Preços - Contratos Clientes</span>
                <span className="badge-cycle" style={{ background: "rgba(0, 131, 202, 0.12)", color: "#0083ca" }}>
                  {contratoAtual ? contratoAtual.codigo : "CONTRATO"}
                </span>
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--on-surface-variant)" }}>
                Definição de valor/hora por contrato, perfil de consultor, histórico de reajustes e matriz de custos associada.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: "260px" }}>
                <ModernDropdown
                  value={contratoSelecionadoId}
                  onChange={(val) => setContratoSelecionadoId(String(val))}
                  options={opcoesContratos}
                  label="Contrato Ativo"
                  placeholder="Selecione o Contrato"
                />
              </div>

              <button
                type="button"
                onClick={() => setModalReajusteAberto(true)}
                className="btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  background: "#0083ca",
                  color: "#ffffff",
                  border: "none",
                  boxShadow: "0 2px 6px rgba(0, 131, 202, 0.25)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>trending_up</span>
                <span>Aplicar Reajuste Contratual</span>
              </button>

              <button
                type="button"
                onClick={() => setModalNovoContratoAberto(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  background: "#0f2a4a",
                  color: "#ffffff",
                  border: "none",
                  boxShadow: "0 2px 6px rgba(15, 42, 74, 0.25)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_circle</span>
                <span>Novo Contrato</span>
              </button>
            </div>
          </div>


          {/* Abas de Navegação */}
          <nav
            aria-label="Abas de Tarifas e Contratos"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderBottom: "1px solid var(--border)",
              marginBottom: "20px",
              overflowX: "auto",
            }}
          >
            <button
              type="button"
              onClick={() => setAbaAtiva("cliente")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 18px",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: abaAtiva === "cliente" ? "rgba(2, 132, 199, 0.08)" : "transparent",
                color: abaAtiva === "cliente" ? "#0284c7" : "var(--on-surface-variant)",
                borderBottom: abaAtiva === "cliente" ? "2px solid #0284c7" : "2px solid transparent",
                borderRadius: "8px 8px 0 0",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>payments</span>
              <span>1. Tabela de Preço do Cliente (Faturamento)</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva("consultores")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 18px",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: abaAtiva === "consultores" ? "rgba(2, 132, 199, 0.08)" : "transparent",
                color: abaAtiva === "consultores" ? "#0284c7" : "var(--on-surface-variant)",
                borderBottom: abaAtiva === "consultores" ? "2px solid #0284c7" : "2px solid transparent",
                borderRadius: "8px 8px 0 0",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>group</span>
              <span>2. Tarifas de Consultores (Sócio & Parceiro)</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva("centros_custo")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 18px",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: abaAtiva === "centros_custo" ? "rgba(2, 132, 199, 0.08)" : "transparent",
                color: abaAtiva === "centros_custo" ? "#0284c7" : "var(--on-surface-variant)",
                borderBottom: abaAtiva === "centros_custo" ? "2px solid #0284c7" : "2px solid transparent",
                borderRadius: "8px 8px 0 0",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>account_tree</span>
              <span>3. Matriz Oficial de Centros de Custo ({contratoAtual?.centrosDeCusto?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva("reajustes")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 18px",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: abaAtiva === "reajustes" ? "rgba(2, 132, 199, 0.08)" : "transparent",
                color: abaAtiva === "reajustes" ? "#0284c7" : "var(--on-surface-variant)",
                borderBottom: abaAtiva === "reajustes" ? "2px solid #0284c7" : "2px solid transparent",
                borderRadius: "8px 8px 0 0",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>history</span>
              <span>4. Histórico de Reajustes & Vigências</span>
            </button>
          </nav>

          {/* Conteúdo da Aba 1: Tabela de Preço do Cliente */}
          {abaAtiva === "cliente" && contratoAtual && (
            <section
              style={{
                background: "var(--surface-container-lowest)",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                overflow: "hidden",
                boxShadow: "0 2px 12px rgba(15, 42, 74, 0.04)",
              }}
            >
              {/* Header & Toolbar */}
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface-container-lowest)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0f2a4a" }} />
                        Preços Contratuais Praticados ao Cliente
                      </h2>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, background: "#f1f5f9", color: "#475569" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>schedule</span>
                        Jornada Padrão 8h
                      </span>
                      <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: "#e0f2fe", color: "#0369a1" }}>
                        Moeda: BRL (R$)
                      </span>
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                      A dinâmica de precificação das atividades lançadas é baseada no <strong>VALOR/HORA</strong>. O <strong>VALOR/DIA</strong> serve como referência direta para jornada contratual.
                    </p>
                  </div>

                  {/* Toggle: Comparativa vs Apenas Vigente */}
                  <div
                    style={{
                      display: "inline-flex",
                      padding: "3px",
                      background: "#f1f5f9",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setModoVisualizacao("comparativo")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "7px",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: modoVisualizacao === "comparativo" ? 700 : 500,
                        background: modoVisualizacao === "comparativo" ? "#ffffff" : "transparent",
                        color: modoVisualizacao === "comparativo" ? "#0f2a4a" : "#64748b",
                        boxShadow: modoVisualizacao === "comparativo" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Visualização Comparativa
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoVisualizacao("vigente")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "7px",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: modoVisualizacao === "vigente" ? 700 : 500,
                        background: modoVisualizacao === "vigente" ? "#ffffff" : "transparent",
                        color: modoVisualizacao === "vigente" ? "#0f2a4a" : "#64748b",
                        boxShadow: modoVisualizacao === "vigente" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Apenas Vigente (2026)
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabela de Preços com 2-Tier Header */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    {/* Tier 1 Header */}
                    <tr style={{ borderBottom: "1px solid #e2e8f0", fontSize: "11px" }}>
                      <th
                        rowSpan={2}
                        style={{
                          padding: "14px 18px",
                          background: "#f8fafc",
                          color: "#475569",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          width: "30%",
                          borderRight: "1px solid #e2e8f0",
                          verticalAlign: "bottom",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#64748b" }}>work</span>
                          <span>Atividade Contratual</span>
                        </div>
                        <span style={{ fontSize: "10px", fontWeight: 400, color: "#94a3b8", textTransform: "none" }}>
                          descrição e escopo técnico
                        </span>
                      </th>

                      <th
                        rowSpan={2}
                        style={{
                          padding: "14px 14px",
                          background: "#f8fafc",
                          color: "#475569",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          width: "14%",
                          borderRight: "1px solid #e2e8f0",
                          textAlign: "center",
                          verticalAlign: "bottom",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", marginBottom: "2px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#64748b" }}>badge</span>
                          <span>Perfil</span>
                        </div>
                        <span style={{ fontSize: "10px", fontWeight: 400, color: "#94a3b8", textTransform: "none" }}>
                          senioridade
                        </span>
                      </th>

                      {/* Bloco 2026 (ATUAL) Vigente */}
                      <th
                        colSpan={2}
                        style={{
                          padding: "10px 14px",
                          background: "linear-gradient(90deg, #0f2a4a 0%, #1e3a5f 100%)",
                          color: "#ffffff",
                          textAlign: "center",
                          fontWeight: 800,
                          fontSize: "13px",
                          letterSpacing: "0.02em",
                          borderRight: modoVisualizacao === "comparativo" ? "1px solid rgba(255,255,255,0.2)" : "none",
                        }}
                      >
                        2026 (ATUAL VIGENTE)
                      </th>

                      {/* Bloco 2025 Anterior */}
                      {modoVisualizacao === "comparativo" && (
                        <th
                          colSpan={2}
                          style={{
                            padding: "10px 14px",
                            background: "#f1f5f9",
                            color: "#334155",
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: "12px",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          2025 (ANTERIOR)
                        </th>
                      )}

                      {/* Bloco 2024 Base */}
                      {modoVisualizacao === "comparativo" && (
                        <th
                          colSpan={2}
                          style={{
                            padding: "10px 14px",
                            background: "#f8fafc",
                            color: "#64748b",
                            textAlign: "center",
                            fontWeight: 600,
                            fontSize: "12px",
                          }}
                        >
                          2024 (BASE INICIAL)
                        </th>
                      )}
                    </tr>

                    {/* Tier 2 Header: Sub-columns (Hora / Dia) */}
                    <tr style={{ borderBottom: "2px solid #e2e8f0", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                      {/* 2026 */}
                      <th style={{ padding: "8px 12px", background: "rgba(2, 132, 199, 0.08)", color: "#0369a1", textAlign: "right", borderRight: "1px solid rgba(2, 132, 199, 0.15)" }}>
                        Valor Hora
                      </th>
                      <th style={{ padding: "8px 12px", background: "rgba(2, 132, 199, 0.08)", color: "#0369a1", textAlign: "right", borderRight: modoVisualizacao === "comparativo" ? "1px solid #e2e8f0" : "none" }}>
                        Valor Dia (8h)
                      </th>

                      {/* 2025 */}
                      {modoVisualizacao === "comparativo" && (
                        <>
                          <th style={{ padding: "8px 12px", background: "#f8fafc", color: "#475569", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                            Valor Hora
                          </th>
                          <th style={{ padding: "8px 12px", background: "#f8fafc", color: "#475569", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                            Valor Dia (8h)
                          </th>
                        </>
                      )}

                      {/* 2024 */}
                      {modoVisualizacao === "comparativo" && (
                        <>
                          <th style={{ padding: "8px 12px", background: "#ffffff", color: "#64748b", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                            Valor Hora
                          </th>
                          <th style={{ padding: "8px 12px", background: "#ffffff", color: "#64748b", textAlign: "right" }}>
                            Valor Dia (8h)
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {contratoAtual.tabelaPrecoCliente.map((item, idx) => {
                      const p26 = item.anos["2026"];
                      const p25 = item.anos["2025"];
                      const p24 = item.anos["2024"];
                      const isMensal = item.tipoCobranca === "mensal";

                      // Ícones temáticos para cada atividade
                      let iconName = "school";
                      let iconBg = "#f0f9ff";
                      let iconColor = "#0284c7";
                      let perfilBadgeBg = "#e0f2fe";
                      let perfilBadgeColor = "#0369a1";

                      if (item.perfil === "PLENO") {
                        iconBg = "#eff6ff";
                        iconColor = "#2563eb";
                        perfilBadgeBg = "#dbeafe";
                        perfilBadgeColor = "#1d4ed8";
                      } else if (item.perfil === "SÊNIOR") {
                        iconBg = "#eef2ff";
                        iconColor = "#4f46e5";
                        perfilBadgeBg = "#e0e7ff";
                        perfilBadgeColor = "#3730a3";
                      }

                      if (item.atividade.toLowerCase().includes("treinamento")) {
                        iconName = "co_present";
                        iconBg = "#fffbeb";
                        iconColor = "#d97706";
                      } else if (isMensal || item.perfil === "BACK OFFICE") {
                        iconName = "support_agent";
                        iconBg = "#f1f5f9";
                        iconColor = "#475569";
                        perfilBadgeBg = "#f1f5f9";
                        perfilBadgeColor = "#334155";
                      }

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: idx % 2 === 0 ? "#ffffff" : "var(--surface-container-low)",
                            transition: "background 0.15s ease",
                          }}
                        >
                          {/* Atividade */}
                          <td style={{ padding: "14px 18px", borderRight: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div
                                style={{
                                  width: "34px",
                                  height: "34px",
                                  borderRadius: "10px",
                                  background: iconBg,
                                  color: iconColor,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>{iconName}</span>
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{ fontWeight: 800, color: "var(--primary)" }}>{item.atividade}</span>
                                  {isMensal && (
                                    <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 700, background: "#f1f5f9", color: "#475569", textTransform: "uppercase" }}>
                                      Fixo Mensal
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", marginTop: "2px", display: "block" }}>
                                  {item.descricaoPerfil || (isMensal ? "Suporte operacional contínuo dedicado" : "Execução técnica e mentoria de projeto")}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Perfil */}
                          <td style={{ padding: "14px 14px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 10px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: 800,
                                background: perfilBadgeBg,
                                color: perfilBadgeColor,
                                letterSpacing: "0.04em",
                              }}
                            >
                              {item.perfil === "SÊNIOR" && (
                                <span className="material-symbols-outlined" style={{ fontSize: "12px", color: "#f59e0b" }}>star</span>
                              )}
                              {item.perfil}
                            </span>
                          </td>

                          {/* 2026 Vigente */}
                          <td
                            style={{
                              padding: "14px 12px",
                              textAlign: "right",
                              background: "rgba(2, 132, 199, 0.03)",
                              fontWeight: 800,
                              color: "#0284c7",
                              borderRight: "1px solid rgba(2, 132, 199, 0.1)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {isMensal ? `${formatBRL(p26?.valorMensal)}/mês` : formatBRL(p26?.valorHora)}
                          </td>
                          <td
                            style={{
                              padding: "14px 12px",
                              textAlign: "right",
                              background: "rgba(2, 132, 199, 0.02)",
                              fontWeight: 700,
                              color: "var(--on-surface)",
                              borderRight: modoVisualizacao === "comparativo" ? "1px solid #e2e8f0" : "none",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {isMensal ? (
                              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Não aplicável</span>
                            ) : (
                              formatBRL(p26?.valorDia)
                            )}
                          </td>

                          {/* 2025 Anterior */}
                          {modoVisualizacao === "comparativo" && (
                            <>
                              <td
                                style={{
                                  padding: "14px 12px",
                                  textAlign: "right",
                                  color: "#334155",
                                  fontWeight: 600,
                                  borderRight: "1px solid #f1f5f9",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {isMensal ? `${formatBRL(p25?.valorMensal)}/mês` : formatBRL(p25?.valorHora)}
                              </td>
                              <td
                                style={{
                                  padding: "14px 12px",
                                  textAlign: "right",
                                  color: "#64748b",
                                  fontWeight: 500,
                                  borderRight: "1px solid #e2e8f0",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {isMensal ? "—" : formatBRL(p25?.valorDia)}
                              </td>
                            </>
                          )}

                          {/* 2024 Base */}
                          {modoVisualizacao === "comparativo" && (
                            <>
                              <td
                                style={{
                                  padding: "14px 12px",
                                  textAlign: "right",
                                  color: "#64748b",
                                  fontWeight: 500,
                                  borderRight: "1px solid #f8fafc",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {isMensal ? `${formatBRL(p24?.valorMensal)}/mês` : formatBRL(p24?.valorHora)}
                              </td>
                              <td
                                style={{
                                  padding: "14px 12px",
                                  textAlign: "right",
                                  color: "#94a3b8",
                                  fontWeight: 400,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {isMensal ? "—" : formatBRL(p24?.valorDia)}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Analytics Indices Bar in Footer (Dinâmico do Contrato Selecionado) */}
              <footer
                style={{
                  padding: "14px 24px",
                  background: "#f8fafc",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  fontSize: "12px",
                }}
              >
                {contratoAtual.reajustes && contratoAtual.reajustes.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingRight: "12px", borderRight: "1px solid #cbd5e1" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#64748b" }}>scale</span>
                      <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "11px", color: "#475569", letterSpacing: "0.04em" }}>
                        Negociação & Reajuste:
                      </span>
                    </div>

                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "10px", background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                      <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 500 }}>Índice Contratual:</span>
                      <strong style={{ color: "#0f2a4a", fontSize: "11.5px" }}>{contratoAtual.reajustes[0].indice}</strong>
                    </div>

                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "10px", background: "rgba(5, 150, 105, 0.08)", border: "1px solid rgba(5, 150, 105, 0.25)" }}>
                      <span style={{ color: "#065f46", fontSize: "11px", fontWeight: 600 }}>Reajuste Aplicado:</span>
                      <strong style={{ color: "#059669", fontSize: "12px" }}>+{contratoAtual.reajustes[0].aliquota}%</strong>
                      <span style={{ color: "#047857", fontSize: "11px" }}>(Vigência: {contratoAtual.reajustes[0].dataVigencia})</span>
                    </div>

                    {contratoAtual.reajustes[0].observacoes && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "10px", background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                        <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 500 }}>Bases:</span>
                        <span style={{ color: "#334155", fontSize: "11px" }}>{contratoAtual.reajustes[0].observacoes}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--on-surface-variant)", fontSize: "11.5px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#94a3b8" }}>info</span>
                    <span>Sem histórico de reajuste prévio registrado para o <strong>{contratoAtual.nome}</strong>. Os valores exibidos são os praticados atualmente.</span>
                  </div>
                )}
              </footer>
            </section>
          )}

          {/* Conteúdo da Aba 2: Tarifas de Consultores */}
          {abaAtiva === "consultores" && contratoAtual && (
            <div className="card" style={{ padding: "0", overflow: "hidden", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface-container-lowest)" }}>
              <div style={{ padding: "14px 18px", background: "var(--surface-container-low)", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>
                  Tarifário de Custos de Consultoria (Sócio vs Parceiro)
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                  Atribuição automática do custo de consultor baseada no perfil e localidade (Brasil ou Latam).
                </p>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, color: "var(--primary)" }} rowSpan={2}>PERFIL DO CONSULTOR</th>
                      <th colSpan={2} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#ffffff", background: "#0083ca" }}>FATURAMENTO CLIENTE</th>
                      <th colSpan={2} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#ffffff", background: "#059669" }}>CONSULTOR SÓCIO</th>
                      <th colSpan={2} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#ffffff", background: "#ea580c" }}>CONSULTOR PARCEIRO</th>
                    </tr>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#0083ca", background: "#e0f2fe" }}>BRASIL (Hora / Dia)</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#0083ca", background: "#e0f2fe" }}>LATAM (Hora / Dia)</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#059669", background: "#d1fae5" }}>BRASIL (/h)</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#059669", background: "#d1fae5" }}>LATAM (/h)</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#ea580c", background: "#ffedd5" }}>BRASIL (/h)</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#ea580c", background: "#ffedd5" }}>LATAM (/h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratoAtual.tabelaConsultores.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 800, color: "var(--primary)" }}>
                          {item.perfil}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#0083ca", fontWeight: 700 }}>
                          {formatBRL(item.clienteBrasil.valorHora)} <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>({formatBRL(item.clienteBrasil.valorDia)})</span>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#0083ca", fontWeight: 700 }}>
                          {formatBRL(item.clienteLatam.valorHora)} <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>({formatBRL(item.clienteLatam.valorDia)})</span>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#059669", fontWeight: 800, background: "rgba(5, 150, 105, 0.04)" }}>
                          {formatBRL(item.socioBrasil)}
                          <div style={{ fontSize: "10.5px", color: "#047857", fontWeight: 500 }}>
                            +6% NF: {formatBRL(item.socioBrasil * 1.06)}
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#059669", fontWeight: 800, background: "rgba(5, 150, 105, 0.04)" }}>
                          {formatBRL(item.socioLatam)}
                          <div style={{ fontSize: "10.5px", color: "#047857", fontWeight: 500 }}>
                            +6% NF: {formatBRL(item.socioLatam * 1.06)}
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#ea580c", fontWeight: 700, background: "rgba(234, 88, 12, 0.04)" }}>
                          {formatBRL(item.parceiroBrasil)}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#ea580c", fontWeight: 700, background: "rgba(234, 88, 12, 0.04)" }}>
                          {formatBRL(item.parceiroLatam)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Box Explicativo da Regra de Negócio de Sócio */}
              <div style={{ padding: "16px", background: "#fef3c7", borderTop: "1px solid #fde68a", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span className="material-symbols-outlined" style={{ color: "#d97706", fontSize: "22px" }}>verified</span>
                <div>
                  <h4 style={{ margin: "0 0 2px", fontSize: "12.5px", fontWeight: 800, color: "#92400e" }}>
                    Cálculo Inteligente de Custos de Consultoria (Impacto Contábil da DRE)
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#78350f", lineHeight: "1.5" }}>
                    Quando a atividade é atribuída a um consultor classificado como <strong>SÓCIO</strong>, o sistema calcula automaticamente um <strong>acréscimo de 6% sobre a tarifa</strong> para cobrir os encargos de emissão da Nota Fiscal. Caso a descrição da atividade contenha o termo <strong>COMISSÃO</strong>, este acréscimo não é aplicado, preservando a tarifa base.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba 3: Centros de Custo Vinculados */}
          {abaAtiva === "centros_custo" && contratoAtual && (
            <div className="card" style={{ padding: "0", overflow: "hidden", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface-container-lowest)" }}>
              <div style={{ padding: "14px 18px", background: "var(--surface-container-low)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>
                    Centros de Custo Vinculados a este Contrato (Matriz Oficial)
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                    Ao selecionar qualquer um destes Centros de Custo no lançamento de uma atividade, a Tabela de Preços do <strong>{contratoAtual.nome}</strong> será aplicada automaticamente.
                  </p>
                </div>
                <Link
                  href="/centro-de-custo"
                  className="btn-primary"
                  style={{ textDecoration: "none", fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--primary)", color: "#fff", borderRadius: "8px" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
                  <span>Gerenciar Matriz de Centros de Custo</span>
                </Link>
              </div>

              <div style={{ padding: "18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                  {contratoAtual.centrosDeCusto.map((cc) => (
                    <div
                      key={cc}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--surface-container-lowest)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: "#0083ca", fontSize: "20px" }}>tag</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--primary)" }}>{cc}</div>
                        <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                          Contrato associado: <strong style={{ color: "#0083ca" }}>{contratoAtual.codigo}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba 4: Histórico de Reajustes */}
          {abaAtiva === "reajustes" && contratoAtual && (
            <div className="card" style={{ padding: "0", overflow: "hidden", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface-container-lowest)" }}>
              <div style={{ padding: "14px 18px", background: "var(--surface-container-low)", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>
                  Histórico de Reajustes Contratuais Aplicados
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                  Registro de índices aplicados, percentuais e data de vigência para efeitos de auditoria e cálculo retroativo.
                </p>
              </div>

              <div style={{ padding: "18px" }}>
                {contratoAtual.reajustes && contratoAtual.reajustes.length > 0 ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, color: "var(--primary)" }}>ANO</th>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, color: "var(--primary)" }}>ÍNDICE / TIPO DE ALÍQUOTA</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#0083ca" }}>PERCENTUAL APLICADO</th>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, color: "var(--primary)" }}>DATA DE VIGÊNCIA</th>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, color: "var(--primary)" }}>OBSERVAÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contratoAtual.reajustes.map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 800, color: "var(--primary)" }}>{r.ano}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ padding: "3px 8px", borderRadius: "6px", background: "rgba(0, 131, 202, 0.08)", color: "#0083ca", fontSize: "11px", fontWeight: 700 }}>
                              {r.indice}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                            +{r.aliquota.toFixed(2)}%
                          </td>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>{r.dataVigencia}</td>
                          <td style={{ padding: "10px 14px", color: "var(--on-surface-variant)" }}>{r.observacoes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: "center", padding: "30px", color: "var(--on-surface-variant)" }}>
                    Nenhum reajuste registrado para este contrato.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODAL DE APLICAÇÃO DE REAJUSTE */}
          {modalReajusteAberto && contratoAtual && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "20px",
              }}
            >
              <div
                style={{
                  background: "var(--surface-container-lowest)",
                  borderRadius: "16px",
                  padding: "24px",
                  maxWidth: "520px",
                  width: "100%",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--primary)" }}>
                    Aplicar Reajuste Contratual
                  </h3>
                  <button
                    type="button"
                    onClick={() => setModalReajusteAberto(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--on-surface-variant)" }}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <form onSubmit={handleAplicarReajuste} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                      Contrato Alvo
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${contratoAtual.nome} (${contratoAtual.cliente})`}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-low)", fontWeight: 700 }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                        Ano do Ciclo
                      </label>
                      <input
                        type="number"
                        required
                        value={reajAno}
                        onChange={(e) => setReajAno(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                        Alíquota (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={reajAliquota}
                        onChange={(e) => setReajAliquota(e.target.value)}
                        placeholder="Ex: 5.32"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                        Tipo de Índice / Alíquota
                      </label>
                      <input
                        type="text"
                        required
                        value={reajIndice}
                        onChange={(e) => setReajIndice(e.target.value)}
                        placeholder="Ex: CCT Maio, IPCA, IGP-M"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)" }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                        Data de Vigência
                      </label>
                      <input
                        type="text"
                        required
                        value={reajVigencia}
                        onChange={(e) => setReajVigencia(e.target.value)}
                        placeholder="DD/MM/AAAA (ex: 01/05/2027)"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                      Observações / Justificativa
                    </label>
                    <textarea
                      rows={3}
                      value={reajObs}
                      onChange={(e) => setReajObs(e.target.value)}
                      placeholder="Ex: Reajuste anual acordado em convenção coletiva CCT Maio."
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", resize: "vertical" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setModalReajusteAberto(false)}
                      className="btn-secondary"
                      style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "none", cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvandoReajuste}
                      className="btn-primary"
                      style={{ padding: "8px 18px", borderRadius: "8px", background: "#0083ca", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}
                    >
                      {salvandoReajuste ? "Aplicando..." : "Confirmar & Aplicar Reajuste"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal de Cadastro de Novo Contrato */}
          {modalNovoContratoAberto && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                backdropFilter: "blur(3px)",
              }}
            >
              <div
                style={{
                  background: "var(--surface-container-lowest)",
                  borderRadius: "16px",
                  padding: "24px",
                  maxWidth: "680px",
                  width: "100%",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="material-symbols-outlined" style={{ color: "#0083ca", fontSize: "24px" }}>add_circle</span>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--primary)" }}>
                      Adicionar Novo Contrato de Cliente
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalNovoContratoAberto(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--on-surface-variant)" }}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <form onSubmit={handleCriarNovoContrato} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                        Código / Sigla *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: IVECO, STELLANTIS"
                        value={novoCodigo}
                        onChange={(e) => setNovoCodigo(e.target.value.toUpperCase())}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                        Nome do Contrato *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: CONTRATO - IVECO GROUP"
                        value={novoNome}
                        onChange={(e) => setNovoNome(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                        Cliente / Contratante
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: IVECO GROUP BRASIL"
                        value={novoCliente}
                        onChange={(e) => setNovoCliente(e.target.value.toUpperCase())}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                        Descrição do Escopo
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Treinamentos e Consultoria Especializada"
                        value={novaDescricao}
                        onChange={(e) => setNovaDescricao(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                      Centros de Custo Vinculados (códigos separados por vírgula)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 01.06.005.028, 01.06.005.030, 01.06.005.031"
                      value={novosCentrosCusto}
                      onChange={(e) => setNovosCentrosCusto(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontFamily: "inherit", fontSize: "12px" }}
                    />
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", marginTop: "3px", display: "block" }}>
                      💡 Toda atividade vinculada a esses CCs buscará automaticamente os preços desta tabela.
                    </span>
                  </div>

                  {/* Bloco de Preços Cliente */}
                  <div style={{ background: "var(--surface-container-low)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--primary)" }}>
                      Tabela de Preço Cliente (Valor/Hora R$)
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                      <div>
                        <label style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "2px" }}>
                          Júnior (R$/h)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={tarifaClienteJunior}
                          onChange={(e) => setTarifaClienteJunior(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "2px" }}>
                          Pleno (R$/h)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={tarifaClientePleno}
                          onChange={(e) => setTarifaClientePleno(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "2px" }}>
                          Sênior (R$/h)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={tarifaClienteSenior}
                          onChange={(e) => setTarifaClienteSenior(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bloco de Tarifas Consultores */}
                  <div style={{ background: "var(--surface-container-low)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--primary)" }}>
                      Tabela de Consultores (Tarifa Base R$/h)
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
                      <div>
                        <label style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "2px" }}>
                          Sócio Brasil
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={tarifaConsultorSocioBrasil}
                          onChange={(e) => setTarifaConsultorSocioBrasil(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "2px" }}>
                          Sócio LATAM
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={tarifaConsultorSocioLatam}
                          onChange={(e) => setTarifaConsultorSocioLatam(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "2px" }}>
                          Parceiro Brasil
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={tarifaConsultorParceiroBrasil}
                          onChange={(e) => setTarifaConsultorParceiroBrasil(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "2px" }}>
                          Parceiro LATAM
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={tarifaConsultorParceiroLatam}
                          onChange={(e) => setTarifaConsultorParceiroLatam(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", fontWeight: 700 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Informação sobre a regra de sócio */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "rgba(0, 131, 202, 0.08)", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(0, 131, 202, 0.2)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0083ca", marginTop: "2px" }}>info</span>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", lineHeight: "1.4" }}>
                      <strong>Regra de Sócio Ativa:</strong> Acréscimo automático de +6% sobre a tarifa do consultor sócio para compensação de NF, exceto quando a atividade contiver o termo <em>"COMISSÃO"</em>.
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setModalNovoContratoAberto(false)}
                      className="btn-secondary"
                      style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "none", cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvandoNovoContrato}
                      className="btn-primary"
                      style={{ padding: "8px 20px", borderRadius: "8px", background: "#0f2a4a", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}
                    >
                      {salvandoNovoContrato ? "Cadastrando..." : "Cadastrar & Ativar Contrato"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
