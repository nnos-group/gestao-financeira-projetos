"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import UserProfileHeader from "@/components/UserProfileHeader";
import ModernDropdown from "@/components/ModernDropdown";
import {
  ContratoCompleto,
  SituacaoContratual,
  ModalidadeCobranca,
  StatusRenovacao,
  AlertaContratual,
  InconsistenciaContratual,
} from "@/lib/contratos-types";
import { formatarDataBR, formatarPeriodoBR } from "@/lib/date-utils";

type AbaNavegacao = "DASHBOARD" | "LISTA" | "UPLOAD" | "TIMELINE" | "ALERTAS" | "RELATORIOS";

const brl = (val: number | null | undefined) =>
  val != null
    ? val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";

export default function GestaoContratosPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaNavegacao>("DASHBOARD");
  const [contratos, setContratos] = useState<ContratoCompleto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filtros Globais
  const [filtroCliente, setFiltroCliente] = useState("TODOS");
  const [filtroSituacao, setFiltroSituacao] = useState("TODAS");
  const [filtroModalidade, setFiltroModalidade] = useState("TODAS");
  const [buscaTexto, setBuscaTexto] = useState("");

  // Ficha Individual do Contrato (Drawer/Modal)
  const [contratoSelecionado, setContratoSelecionado] = useState<ContratoCompleto | null>(null);
  const [abaFicha, setAbaFicha] = useState<"RESUMO" | "DADOS" | "FINANCEIRO" | "RISCOS" | "ADITIVOS" | "ALERTAS">("RESUMO");

  // Estado do Upload / IA
  const [uploadCarregando, setUploadCarregando] = useState(false);
  const [progressoEtapa, setProgressoEtapa] = useState("");
  const [contratoEmRevisao, setContratoEmRevisao] = useState<ContratoCompleto | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal de Novo Aditivo
  const [modalAditivoAberto, setModalAditivoAberto] = useState(false);
  const [aditivoNumero, setAditivoNumero] = useState("01/2026");
  const [aditivoNovaDataFim, setAditivoNovaDataFim] = useState("");
  const [aditivoNovoValorGlobal, setAditivoNovoValorGlobal] = useState<string>("");
  const [aditivoNovoValorMensal, setAditivoNovoValorMensal] = useState<string>("");
  const [aditivoObjeto, setAditivoObjeto] = useState("");

  const mostrarToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  // Carrega contratos da API
  const carregarDados = async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/contratos");
      const json = await res.json();
      if (json.sucesso && Array.isArray(json.contratos)) {
        setContratos(json.contratos);
      }
    } catch (e) {
      console.warn("Erro ao carregar contratos:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Lista de clientes únicos para o filtro
  const opcoesClientes = useMemo(() => {
    const clientesSet = new Set<string>();
    contratos.forEach((c) => {
      const nome = String(c.cliente.valor || "").trim();
      if (nome && nome !== "Não localizado no contrato") clientesSet.add(nome);
    });
    return [
      { value: "TODOS", label: "Todos os Clientes" },
      ...Array.from(clientesSet).map((cl) => ({ value: cl, label: cl })),
    ];
  }, [contratos]);

  // Contratos filtrados
  const contratosFiltrados = useMemo(() => {
    return contratos.filter((c) => {
      if (filtroCliente !== "TODOS" && String(c.cliente.valor).toLowerCase() !== filtroCliente.toLowerCase()) {
        return false;
      }
      if (filtroSituacao !== "TODAS" && c.situacao !== filtroSituacao) {
        return false;
      }
      if (filtroModalidade !== "TODAS" && c.modalidadeCobranca.valor !== filtroModalidade) {
        return false;
      }
      if (buscaTexto.trim()) {
        const b = buscaTexto.toLowerCase();
        const textoBusca = `${c.codigo} ${c.numeroContrato.valor} ${c.cliente.valor} ${c.projeto.valor} ${c.objeto.valor} ${c.responsavelInterno.valor}`.toLowerCase();
        return textoBusca.includes(b);
      }
      return true;
    });
  }, [contratos, filtroCliente, filtroSituacao, filtroModalidade, buscaTexto]);

  // Métricas do Dashboard (Calculadas com rigor financeiro)
  const metricas = useMemo(() => {
    const total = contratosFiltrados.length;
    let vigentes = 0;
    let vencidos = 0;
    let vencimentoProximo = 0;
    let valorGlobal = 0;
    let receitaMensalFixaMRR = 0;
    let receitaAnualEstimada = 0;
    let inconsistenciasPendentes = 0;

    contratosFiltrados.forEach((c) => {
      if (c.situacao === "VIGENTE") vigentes++;
      else if (c.situacao === "VENCIDO") vencidos++;
      else if (c.situacao === "VENCIMENTO_PROXIMO") vencimentoProximo++;

      const valG = Number(c.valorGlobal.valor) || 0;
      valorGlobal += valG;

      // REGRA: Apenas contratos de Mensalidade Fixa somam no MRR recorrente garantido!
      if (c.modalidadeCobranca.valor === "MENSAL_FIXO") {
        const valM = Number(c.valorMensalFixo.valor) || 0;
        receitaMensalFixaMRR += valM;
      }

      const valA = Number(c.valorAnualEstimado.valor) || (valG > 0 ? valG / 2 : 0);
      receitaAnualEstimada += valA;

      const temInconsistencia = (c.inconsistencias || []).some((i) => !i.resolvida);
      if (temInconsistencia) inconsistenciasPendentes++;
    });

    return {
      total,
      vigentes,
      vencidos,
      vencimentoProximo,
      valorGlobal,
      receitaMensalFixaMRR,
      receitaAnualEstimada,
      inconsistenciasPendentes,
    };
  }, [contratosFiltrados]);

  // Contratos com vencimento nos próximos 90 dias
  const contratos90Dias = useMemo(() => {
    return contratos.filter((c) => c.situacao === "VENCIMENTO_PROXIMO");
  }, [contratos]);

  // Todos os alertas consolidados
  const todosAlertas = useMemo(() => {
    const list: AlertaContratual[] = [];
    contratos.forEach((c) => {
      (c.alertas || []).forEach((a) => list.push(a));
    });
    return list.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [contratos]);

  // Processamento de Upload de PDF
  const handleSelecionarArquivo = async (file: File) => {
    if (!file) return;
    setUploadCarregando(true);
    setProgressoEtapa("Carregando e extraindo texto do PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgressoEtapa("Auditor de IA Gemini analisando cláusulas, vigência e valores...");
      const res = await fetch("/api/contratos/processar-pdf", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.sucesso && json.contrato) {
        setContratoEmRevisao(json.contrato);
        mostrarToast("Contrato analisado com sucesso pela IA! Revise os campos antes de aprovar.");
      } else {
        mostrarToast("Aviso: " + (json.erro || "Não foi possível extrair dados do arquivo."));
      }
    } catch (e: any) {
      mostrarToast("Erro ao processar PDF: " + e.message);
    } finally {
      setUploadCarregando(false);
      setProgressoEtapa("");
    }
  };

  // Carregar Exemplo Real (Porsche Contrato A ou B)
  const handleCarregarExemplo = (tipo: "A" | "B") => {
    const exA = contratos.find((c) => c.codigo.includes("TREINAMENTO"));
    const exB = contratos.find((c) => c.codigo.includes("POE"));

    if (tipo === "A" && exA) {
      setContratoEmRevisao({ ...exA, id: `CTR-UPLOAD-${Date.now()}` });
      mostrarToast("Exemplo Contrato A (Porsche Treinamento & Consultoria) carregado para validação!");
    } else if (tipo === "B" && exB) {
      setContratoEmRevisao({ ...exB, id: `CTR-UPLOAD-${Date.now()}` });
      mostrarToast("Exemplo Contrato B (Porsche Consultoria Pós-Vendas POE) carregado para validação!");
    } else {
      mostrarToast("Exemplo já integrado à base de dados.");
    }
  };

  // Salvar / Aprovar Contrato em Revisão
  const handleAprovarContratoRevisao = async () => {
    if (!contratoEmRevisao) return;

    try {
      const res = await fetch("/api/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contratoEmRevisao),
      });

      const json = await res.json();
      if (json.sucesso) {
        mostrarToast("✅ Contrato aprovado e cadastrado no dashboard com sucesso!");
        setContratoEmRevisao(null);
        await carregarDados();
        setAbaAtiva("LISTA");
      } else {
        mostrarToast("Erro ao salvar contrato: " + json.erro);
      }
    } catch (e: any) {
      mostrarToast("Erro na requisição: " + e.message);
    }
  };

  // Atualizar Status do Alerta
  const handleAtualizarAlerta = async (
    alertaId: string,
    contratoId: string,
    novoStatus: "VISUALIZADO" | "EM_TRATAMENTO" | "CONCLUIDO"
  ) => {
    try {
      const res = await fetch("/api/contratos/alertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertaId,
          contratoId,
          novoStatus,
          usuario: "Leonardo Campos",
        }),
      });
      const json = await res.json();
      if (json.sucesso) {
        mostrarToast(`Alerta marcado como ${novoStatus}!`);
        await carregarDados();
      }
    } catch (e) {
      mostrarToast("Erro ao atualizar alerta.");
    }
  };

  // Salvar Aditivo Contratual
  const handleSalvarAditivo = async () => {
    if (!contratoSelecionado) return;

    try {
      const novoAditivo = {
        id: `ADT-${Date.now()}`,
        contratoId: contratoSelecionado.id,
        numeroAditivo: aditivoNumero,
        dataAssinatura: new Date().toISOString().split("T")[0],
        dataInicioVigencia: new Date().toISOString().split("T")[0],
        novaDataEncerramento: aditivoNovaDataFim || undefined,
        novoValorGlobal: aditivoNovoValorGlobal ? parseFloat(aditivoNovoValorGlobal) : undefined,
        novoValorMensal: aditivoNovoValorMensal ? parseFloat(aditivoNovoValorMensal) : undefined,
        objeto: aditivoObjeto || "Prorrogação de vigência e reajuste de valores.",
        alteracoes: {
          vigencia: aditivoNovaDataFim
            ? {
                antes: String(contratoSelecionado.dataEncerramento.valor),
                depois: aditivoNovaDataFim,
              }
            : undefined,
          valorGlobal: aditivoNovoValorGlobal
            ? {
                antes: Number(contratoSelecionado.valorGlobal.valor),
                depois: parseFloat(aditivoNovoValorGlobal),
              }
            : undefined,
        },
        criadoEm: new Date().toISOString(),
        criadoPor: "Leonardo Campos",
      };

      const res = await fetch(`/api/contratos/${contratoSelecionado.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novoAditivo }),
      });

      const json = await res.json();
      if (json.sucesso) {
        mostrarToast("✅ Termo Aditivo registrado com sucesso! Vigência e valores atualizados.");
        setModalAditivoAberto(false);
        setContratoSelecionado(json.contrato);
        await carregarDados();
      } else {
        mostrarToast("Erro ao registrar aditivo: " + json.erro);
      }
    } catch (e: any) {
      mostrarToast("Erro na requisição: " + e.message);
    }
  };

  return (
    <div className="layout-container">
      {/* Toast Notificação */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "#0f2a4a",
            color: "#ffffff",
            padding: "14px 20px",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontWeight: 600,
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#38bdf8" }}>
            info
          </span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Barra Lateral Corporativa NNÓS */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/logo-coruja.png" alt="Logo Coruja NNÓS" className="sidebar-brand-img" />
            <div className="sidebar-brand-text">
              <h2 style={{ lineHeight: "1.2", textTransform: "uppercase" }}>
                GESTÃO<br />FINANCEIRA &amp; PROJETOS
              </h2>
            </div>
          </div>

          <nav className="sidebar-nav">
            <Link href="/projetos" className="nav-item">
              <span className="material-symbols-outlined">assignment</span>
              <span>Projetos &amp; Atividades</span>
            </Link>
            <Link href="/medicao" className="nav-item">
              <span className="material-symbols-outlined">receipt_long</span>
              <span>BM - Boletim de Medição</span>
            </Link>
            <Link href="/viagens" className="nav-item">
              <span className="material-symbols-outlined">flight</span>
              <span>Viagens &amp; Logística</span>
            </Link>
            <Link href="/contratos" className="nav-item active">
              <span className="material-symbols-outlined">history_edu</span>
              <span>Gestão de Contratos</span>
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
            <Link href="/consultor" className="nav-item">
              <span className="material-symbols-outlined">support_agent</span>
              <span>Consultor</span>
            </Link>
            <Link href="/lider" className="nav-item">
              <span className="material-symbols-outlined">supervisor_account</span>
              <span>Líder de Projeto</span>
            </Link>
            <Link href="/admin" className="nav-item">
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <span>Administrador</span>
            </Link>
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
              Módulo de Gestão de Contratos
            </span>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
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
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Gestão de Contratos
            </span>
          </div>
          <UserProfileHeader />
        </header>

        <main className="main-content" style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Cabeçalho da Página com Badge de IA e Botão Novo Contrato */}
          <section
            style={{
              backgroundColor: "var(--surface-container-lowest, #ffffff)",
              borderRadius: "16px",
              border: "1px solid var(--border, #e2e8f0)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Ciclo de Vida Contratual &amp; IA
                </span>
                <span
                  style={{
                    backgroundColor: "#ecfdf5",
                    color: "#047857",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    smart_toy
                  </span>
                  Extrator Gemini Integrado
                </span>
              </div>
              <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginTop: "6px", margin: 0 }}>
                Gestão de Contratos Comerciais
              </h1>
              <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px", margin: 0 }}>
                Acompanhamento centralizado, análise de cláusulas por IA, linha do tempo interativa e monitoramento de vencimentos a 90 dias.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setAbaAtiva("UPLOAD")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  backgroundColor: "#0f2a4a",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(15,42,74,0.2)",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  upload_file
                </span>
                <span>Novo Contrato / Upload PDF</span>
              </button>
            </div>
          </section>

          {/* Sub-navegação das Abas do Módulo */}
          <section
            style={{
              backgroundColor: "var(--surface-container-lowest, #ffffff)",
              borderRadius: "16px",
              border: "1px solid var(--border, #e2e8f0)",
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              overflowX: "auto",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            {[
              { id: "DASHBOARD", rotulo: "Dashboard de Contratos", icone: "dashboard" },
              { id: "LISTA", rotulo: `Contratos Cadastrados (${contratos.length})`, icone: "folder_open" },
              { id: "UPLOAD", rotulo: "Novo Contrato / Upload PDF", icone: "upload_file" },
              { id: "TIMELINE", rotulo: "Linha do Tempo (Gantt)", icone: "timeline" },
              {
                id: "ALERTAS",
                rotulo: `Alertas e Vencimentos (${todosAlertas.filter((a) => a.status === "PENDENTE").length})`,
                icone: "notification_important",
              },
              { id: "RELATORIOS", rotulo: "Relatórios Gerenciais", icone: "analytics" },
            ].map((tab) => {
              const ativo = abaAtiva === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAbaAtiva(tab.id as AbaNavegacao)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: ativo ? 700 : 600,
                    backgroundColor: ativo ? "#0f2a4a" : "transparent",
                    color: ativo ? "#ffffff" : "#475569",
                    boxShadow: ativo ? "0 1px 3px rgba(15,42,74,0.2)" : "none",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "16px", color: ativo ? "#93c5fd" : "#94a3b8" }}
                  >
                    {tab.icone}
                  </span>
                  <span>{tab.rotulo}</span>
                </button>
              );
            })}
          </section>

          {/* =================================================================== */}
          {/* ABA 1: DASHBOARD EXECUTIVO                                         */}
          {/* =================================================================== */}
          {abaAtiva === "DASHBOARD" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Barra de Filtros Rápidos */}
              <div
                style={{
                  backgroundColor: "var(--surface-container-lowest, #ffffff)",
                  borderRadius: "14px",
                  border: "1px solid var(--border, #e2e8f0)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
                  <ModernDropdown
                    value={filtroCliente}
                    onChange={(val) => setFiltroCliente(String(val))}
                    options={opcoesClientes}
                    icon="business"
                    minWidth={220}
                    searchable={true}
                  />

                  <ModernDropdown
                    value={filtroSituacao}
                    onChange={(val) => setFiltroSituacao(String(val))}
                    options={[
                      { value: "TODAS", label: "Todas as Situações" },
                      { value: "VIGENTE", label: "Apenas Vigentes" },
                      { value: "VENCIMENTO_PROXIMO", label: "Vencimento Próximo (≤ 90 dias)" },
                      { value: "VENCIDO", label: "Vencidos" },
                      { value: "RENOVADO", label: "Renovados" },
                    ]}
                    icon="flag"
                    minWidth={220}
                    searchable={false}
                  />

                  <ModernDropdown
                    value={filtroModalidade}
                    onChange={(val) => setFiltroModalidade(String(val))}
                    options={[
                      { value: "TODAS", label: "Todas as Modalidades" },
                      { value: "MENSAL_FIXO", label: "Mensalidade Fixa (Recorrente)" },
                      { value: "DEMANDA_SERVICOS", label: "Serviços por Demanda" },
                    ]}
                    icon="payments"
                    minWidth={230}
                    searchable={false}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Buscar por código, projeto, objeto..."
                    value={buscaTexto}
                    onChange={(e) => setBuscaTexto(e.target.value)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12.5px",
                      width: "280px",
                      outline: "none",
                    }}
                  />
                  {buscaTexto && (
                    <button
                      type="button"
                      onClick={() => setBuscaTexto("")}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "10px",
                        backgroundColor: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* 8 Cards KPIs Oficiais */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                  gap: "14px",
                }}
              >
                {/* KPI 1: Total de Contratos */}
                <div style={kpiCardStyle("#eff6ff", "#2563eb")}>
                  <div>
                    <span style={kpiLabelStyle}>Total de Contratos</span>
                    <div style={kpiValueStyle}>{metricas.total}</div>
                    <span style={kpiSubStyle}>Carteira comercial ativa</span>
                  </div>
                  <div style={kpiIconStyle("#dbeafe", "#1d4ed8")}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      description
                    </span>
                  </div>
                </div>

                {/* KPI 2: Contratos Vigentes */}
                <div style={kpiCardStyle("#ecfdf5", "#059669")}>
                  <div>
                    <span style={kpiLabelStyle}>Contratos Vigentes</span>
                    <div style={kpiValueStyle}>{metricas.vigentes}</div>
                    <span style={kpiSubStyle}>Operação e faturamento ativos</span>
                  </div>
                  <div style={kpiIconStyle("#d1fae5", "#047857")}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      verified
                    </span>
                  </div>
                </div>

                {/* KPI 3: Vencimento Próximo (≤ 90 dias) */}
                <div style={{ ...kpiCardStyle("#fffbeb", "#d97706"), borderLeft: "4px solid #f59e0b" }}>
                  <div>
                    <span style={kpiLabelStyle}>Vencimento Próximo</span>
                    <div style={{ ...kpiValueStyle, color: "#b45309" }}>{metricas.vencimentoProximo}</div>
                    <span style={kpiSubStyle}>Alerta de 90 dias ativo</span>
                  </div>
                  <div style={kpiIconStyle("#fef3c7", "#b45309")}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      schedule
                    </span>
                  </div>
                </div>

                {/* KPI 4: Contratos Vencidos */}
                <div style={kpiCardStyle("#fef2f2", "#dc2626")}>
                  <div>
                    <span style={kpiLabelStyle}>Contratos Vencidos</span>
                    <div style={{ ...kpiValueStyle, color: "#b91c1c" }}>{metricas.vencidos}</div>
                    <span style={kpiSubStyle}>Aguardando renovação</span>
                  </div>
                  <div style={kpiIconStyle("#fee2e2", "#b91c1c")}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      event_busy
                    </span>
                  </div>
                </div>

                {/* KPI 5: Valor Global da Carteira */}
                <div style={{ ...kpiCardStyle("#f8fafc", "#0f2a4a"), borderLeft: "4px solid #0f2a4a" }}>
                  <div>
                    <span style={kpiLabelStyle}>Valor Global da Carteira</span>
                    <div style={{ ...kpiValueStyle, fontSize: "20px" }}>{brl(metricas.valorGlobal)}</div>
                    <span style={kpiSubStyle}>Soma de todos os contratos</span>
                  </div>
                  <div style={kpiIconStyle("#e2e8f0", "#0f2a4a")}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      account_balance_wallet
                    </span>
                  </div>
                </div>

                {/* KPI 6: Receita Mensal Recorrente MRR */}
                <div style={{ ...kpiCardStyle("#f0fdf4", "#15803d"), borderLeft: "4px solid #16a34a" }}>
                  <div>
                    <span style={kpiLabelStyle}>Receita Mensal Fixa (MRR)</span>
                    <div style={{ ...kpiValueStyle, fontSize: "20px", color: "#166534" }}>
                      {brl(metricas.receitaMensalFixaMRR)}
                    </div>
                    <span style={kpiSubStyle}>Apenas mensalidades fixas</span>
                  </div>
                  <div style={kpiIconStyle("#dcfce7", "#166534")}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      cached
                    </span>
                  </div>
                </div>

                {/* KPI 7: Receita Anual Estimada */}
                <div style={kpiCardStyle("#f8fafc", "#475569")}>
                  <div>
                    <span style={kpiLabelStyle}>Receita Anual Estimada</span>
                    <div style={{ ...kpiValueStyle, fontSize: "20px" }}>{brl(metricas.receitaAnualEstimada)}</div>
                    <span style={kpiSubStyle}>Projeção anual da carteira</span>
                  </div>
                  <div style={kpiIconStyle("#f1f5f9", "#475569")}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      trending_up
                    </span>
                  </div>
                </div>

                {/* KPI 8: Inconsistências / Pendências */}
                <div style={{ ...kpiCardStyle("#faf5ff", "#9333ea"), borderLeft: "4px solid #a855f7" }}>
                  <div>
                    <span style={kpiLabelStyle}>Pendências / Alertas IA</span>
                    <div style={{ ...kpiValueStyle, color: "#7e22ce" }}>{metricas.inconsistenciasPendentes}</div>
                    <span style={kpiSubStyle}>Divergências detectadas</span>
                  </div>
                  <div style={kpiIconStyle("#f3e8ff", "#7e22ce")}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      warning
                    </span>
                  </div>
                </div>
              </div>

              {/* Seção Destaque: Contratos com Vencimento nos Próximos 90 Dias */}
              <section
                style={{
                  backgroundColor: "var(--surface-container-lowest, #ffffff)",
                  borderRadius: "16px",
                  border: "1px solid #fde68a",
                  padding: "20px",
                  boxShadow: "0 1px 4px rgba(217, 119, 6, 0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        backgroundColor: "#fef3c7",
                        color: "#b45309",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        alarm
                      </span>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#92400e", margin: 0 }}>
                        CONTRATOS COM VENCIMENTO NOS PRÓXIMOS 90 DIAS
                      </h3>
                      <span style={{ fontSize: "12px", color: "#b45309" }}>
                        Monitoramento ativo do ciclo de renovação e negociação comercial com os clientes.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAbaAtiva("ALERTAS")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#fffbeb",
                      color: "#b45309",
                      border: "1px solid #fde68a",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Ver Central de Alertas
                  </button>
                </div>

                {contratos90Dias.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                    Nenhum contrato possui vencimento programado para os próximos 90 dias.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" }}>
                    {contratos90Dias.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          backgroundColor: "#ffffff",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309" }}>
                            {c.numeroContrato.valor}
                          </span>
                          <span
                            style={{
                              backgroundColor: "#fef3c7",
                              color: "#92400e",
                              fontSize: "10.5px",
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            Vencimento em {formatarDataBR(c.dataEncerramentoOficial || c.dataEncerramento.valor)}
                          </span>
                        </div>
                        <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                          {c.cliente.valor} • {c.projeto.valor}
                        </h4>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "#64748b" }}>
                          <span>Valor Global: <strong style={{ color: "#0f172a" }}>{brl(Number(c.valorGlobal.valor))}</strong></span>
                          <span>Resp: <strong>{c.responsavelInterno.valor}</strong></span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setContratoSelecionado(c);
                              setAbaFicha("ALERTAS");
                            }}
                            style={{
                              flex: 1,
                              padding: "6px",
                              borderRadius: "8px",
                              backgroundColor: "#0f2a4a",
                              color: "#ffffff",
                              fontSize: "11.5px",
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            Ações de Renovação
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Gráficos e Distribuições da Carteira */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "16px" }}>
                {/* Card Distribuição por Cliente */}
                <div
                  style={{
                    backgroundColor: "var(--surface-container-lowest, #ffffff)",
                    borderRadius: "16px",
                    border: "1px solid var(--border, #e2e8f0)",
                    padding: "20px",
                  }}
                >
                  <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", marginBottom: "16px" }}>
                    Distribuição da Carteira por Cliente
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {opcoesClientes
                      .filter((o) => o.value !== "TODOS")
                      .map((cli) => {
                        const contratosCli = contratos.filter(
                          (c) => String(c.cliente.valor).toLowerCase() === cli.value.toLowerCase()
                        );
                        const somaGlobal = contratosCli.reduce((acc, cur) => acc + (Number(cur.valorGlobal.valor) || 0), 0);
                        const percentual = metricas.valorGlobal > 0 ? (somaGlobal / metricas.valorGlobal) * 100 : 0;

                        return (
                          <div key={cli.value}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "4px" }}>
                              <span style={{ fontWeight: 700, color: "#0f172a" }}>{cli.label}</span>
                              <span style={{ color: "#64748b" }}>
                                {brl(somaGlobal)} ({percentual.toFixed(1)}%)
                              </span>
                            </div>
                            <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${percentual}%`,
                                  height: "100%",
                                  backgroundColor: "#0284c7",
                                  borderRadius: "999px",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Card Modalidades Contratuais & MRR */}
                <div
                  style={{
                    backgroundColor: "var(--surface-container-lowest, #ffffff)",
                    borderRadius: "16px",
                    border: "1px solid var(--border, #e2e8f0)",
                    padding: "20px",
                  }}
                >
                  <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", marginBottom: "16px" }}>
                    Diferenciação de Modelos Financeiros
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ padding: "14px", backgroundColor: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#166534" }}>
                          Mensalidade Fixa Garantida (MRR)
                        </span>
                        <strong style={{ fontSize: "15px", color: "#166534" }}>
                          {brl(metricas.receitaMensalFixaMRR)} / mês
                        </strong>
                      </div>
                      <p style={{ fontSize: "11.5px", color: "#15803d", marginTop: "4px", margin: 0 }}>
                        Receita recorrente e previsível (ex: Contrato Porsche Consultoria POE).
                      </p>
                    </div>

                    <div style={{ padding: "14px", backgroundColor: "#eff6ff", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e40af" }}>
                          Serviços por Demanda / Turmas
                        </span>
                        <strong style={{ fontSize: "15px", color: "#1e40af" }}>Faturamento conforme BM</strong>
                      </div>
                      <p style={{ fontSize: "11.5px", color: "#1d4ed8", marginTop: "4px", margin: 0 }}>
                        Receita variável atrelada à realização de treinamentos (ex: Contrato Porsche Treinamento).
                      </p>
                    </div>

                    <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", fontSize: "11.5px", color: "#64748b" }}>
                      💡 <strong>Critério Obrigatório NNÓS:</strong> Contratos por demanda não são contabilizados como receita fixa recorrente, preservando a fidelidade contábil do sistema.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* ABA 2: CONTRATOS CADASTRADOS (TABELA COMPLETA)                      */}
          {/* =================================================================== */}
          {abaAtiva === "LISTA" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  backgroundColor: "var(--surface-container-lowest, #ffffff)",
                  borderRadius: "16px",
                  border: "1px solid var(--border, #e2e8f0)",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12.5px" }}>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#f8fafc",
                          borderBottom: "1px solid var(--border, #e2e8f0)",
                          color: "#64748b",
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        <th style={{ padding: "14px 16px" }}>Código / Número</th>
                        <th style={{ padding: "14px 16px" }}>Cliente &amp; Projeto</th>
                        <th style={{ padding: "14px 16px" }}>Vigência Oficial</th>
                        <th style={{ padding: "14px 16px" }}>Modelo &amp; Preço</th>
                        <th style={{ padding: "14px 16px" }}>Situação</th>
                        <th style={{ padding: "14px 16px", textAlign: "right" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carregando ? (
                        <tr>
                          <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                            Carregando contratos da carteira comercial...
                          </td>
                        </tr>
                      ) : contratosFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                            Nenhum contrato encontrado com os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        contratosFiltrados.map((c) => {
                          const temDivergencia = (c.inconsistencias || []).some((i) => !i.resolvida);
                          const modalidadeFixo = c.modalidadeCobranca.valor === "MENSAL_FIXO";

                          return (
                            <tr
                              key={c.id}
                              style={{
                                borderBottom: "1px solid #f1f5f9",
                                transition: "background-color 0.1s ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <td style={{ padding: "14px 16px" }}>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "13px" }}>
                                    {c.numeroContrato.valor}
                                  </span>
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>{c.codigo}</span>
                                  {temDivergencia && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        marginTop: "4px",
                                        color: "#b45309",
                                        backgroundColor: "#fef3c7",
                                        fontSize: "10px",
                                        fontWeight: 700,
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        width: "fit-content",
                                      }}
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                                        warning
                                      </span>
                                      Divergência de Datas
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td style={{ padding: "14px 16px" }}>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{c.cliente.valor}</span>
                                  <span style={{ fontSize: "11.5px", color: "#64748b" }}>{c.projeto.valor}</span>
                                  <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>
                                    Gestor: {c.responsavelInterno.valor}
                                  </span>
                                </div>
                              </td>

                              <td style={{ padding: "14px 16px" }}>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: 600, color: "#0f172a" }}>
                                    {formatarPeriodoBR(c.dataInicio.valor, c.dataEncerramentoOficial || c.dataEncerramento.valor)}
                                  </span>
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                                    Duração: {c.prazoMeses.valor} meses
                                  </span>
                                </div>
                              </td>

                              <td style={{ padding: "14px 16px" }}>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                                    {brl(Number(c.valorGlobal.valor))}
                                  </span>
                                  <span style={{ fontSize: "11px", color: modalidadeFixo ? "#166534" : "#0369a1", fontWeight: 600 }}>
                                    {modalidadeFixo
                                      ? `${brl(Number(c.valorMensalFixo.valor))} / mês (Fixo)`
                                      : "Serviços por Demanda (BM)"}
                                  </span>
                                </div>
                              </td>

                              <td style={{ padding: "14px 16px" }}>
                                {c.situacao === "VIGENTE" && (
                                  <span
                                    style={{
                                      backgroundColor: "#eff6ff",
                                      color: "#1d4ed8",
                                      padding: "4px 10px",
                                      borderRadius: "999px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#3b82f6" }} />
                                    Vigente
                                  </span>
                                )}
                                {c.situacao === "VENCIMENTO_PROXIMO" && (
                                  <span
                                    style={{
                                      backgroundColor: "#fffbeb",
                                      color: "#b45309",
                                      padding: "4px 10px",
                                      borderRadius: "999px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                                    Vencimento Próximo
                                  </span>
                                )}
                                {c.situacao === "VENCIDO" && (
                                  <span
                                    style={{
                                      backgroundColor: "#fef2f2",
                                      color: "#b91c1c",
                                      padding: "4px 10px",
                                      borderRadius: "999px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#ef4444" }} />
                                    Vencido
                                  </span>
                                )}
                              </td>

                              <td style={{ padding: "14px 16px", textAlign: "right" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setContratoSelecionado(c);
                                      setAbaFicha("RESUMO");
                                    }}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      backgroundColor: "#0f2a4a",
                                      color: "#ffffff",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      border: "none",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                    title="Abrir ficha completa do contrato"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                                      visibility
                                    </span>
                                    <span>Ver Ficha</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* ABA 3: NOVO CONTRATO / UPLOAD PDF (IA & AUDITORIA)                  */}
          {/* =================================================================== */}
          {abaAtiva === "UPLOAD" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Card de Upload / Drag & Drop */}
              <div
                style={{
                  backgroundColor: "var(--surface-container-lowest, #ffffff)",
                  borderRadius: "16px",
                  border: "2px dashed #cbd5e1",
                  padding: "40px 24px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#0284c7")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#cbd5e1")}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSelecionarArquivo(f);
                  }}
                />

                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "14px",
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>
                    cloud_upload
                  </span>
                </div>

                <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Arraste o Contrato em PDF aqui ou clique para selecionar
                </h3>
                <p style={{ fontSize: "12.5px", color: "#64748b", marginTop: "6px", maxWidth: "480px" }}>
                  Suporta PDFs nativos e digitalizados com OCR. A IA extrairá identificação, vigência, valores, cláusulas jurídicas e rastreabilidade por página.
                </p>

                {uploadCarregando && (
                  <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#0284c7", fontWeight: 700, fontSize: "13px" }}>
                    <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite" }}>
                      progress_activity
                    </span>
                    <span>{progressoEtapa}</span>
                  </div>
                )}
              </div>

              {/* Botões de Acesso Rápido a Exemplos de Teste (Porsche A e B) */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", display: "block" }}>
                    🧪 Cenários Oficiais de Teste (Porsche Brasil):
                  </span>
                  <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                    Valide a extração, o reconhecimento de inconsistência de datas e as diferentes modalidades financeiras.
                  </span>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => handleCarregarExemplo("A")}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      color: "#0f172a",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Carregar Contrato A (Treinamento - Demanda)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCarregarExemplo("B")}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      color: "#0f172a",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Carregar Contrato B (Pós-Vendas POE - Fixo)
                  </button>
                </div>
              </div>

              {/* Formulário Estruturado de Conferência e Aprovação Humana */}
              {contratoEmRevisao && (
                <section
                  style={{
                    backgroundColor: "var(--surface-container-lowest, #ffffff)",
                    borderRadius: "16px",
                    border: "1px solid var(--border, #e2e8f0)",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                        Conferência dos Dados Extraídos pela IA
                      </h3>
                      <span style={{ fontSize: "12.5px", color: "#64748b" }}>
                        Revise os campos extraídos. Todas as informações possuem referência de página e cláusula.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAprovarContratoRevisao}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "10px",
                        backgroundColor: "#059669",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 2px 4px rgba(5,150,105,0.2)",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        check_circle
                      </span>
                      <span>Aprovar e Integrar ao Dashboard</span>
                    </button>
                  </div>

                  {/* Destaque de Inconsistência se Houver */}
                  {(contratoEmRevisao.inconsistencias || []).length > 0 && (
                    <div
                      style={{
                        backgroundColor: "#fffbeb",
                        borderRadius: "12px",
                        border: "1px solid #fde68a",
                        padding: "16px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#b45309", fontWeight: 800, fontSize: "14px" }}>
                        <span className="material-symbols-outlined">warning</span>
                        <span>ALERTA DE INCONSISTÊNCIA CONTRATUAL DETECTADA PELA IA</span>
                      </div>
                      {contratoEmRevisao.inconsistencias.map((inc) => (
                        <div key={inc.id} style={{ marginTop: "8px", fontSize: "12.5px", color: "#92400e" }}>
                          <p style={{ margin: 0, fontWeight: 700 }}>{inc.titulo}</p>
                          <p style={{ margin: "4px 0 0 0" }}>{inc.descricao}</p>
                        </div>
                      ))}
                      <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <label style={{ fontSize: "12px", fontWeight: 700, color: "#78350f" }}>
                          Data Oficial de Vencimento a Adotar:
                        </label>
                        <input
                          type="date"
                          value={contratoEmRevisao.dataEncerramentoOficial || contratoEmRevisao.dataEncerramento.valor}
                          onChange={(e) =>
                            setContratoEmRevisao({
                              ...contratoEmRevisao,
                              dataEncerramentoOficial: e.target.value,
                            })
                          }
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #d97706",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        />
                        <span style={{ fontSize: "11px", color: "#92400e" }}>
                          (O sistema não escolhe a data sozinho; confirme a data oficial para ativar os alertas de 90 dias)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Grade de Campos Extraídos */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                    {/* Campo Número */}
                    <div style={campoContainerStyle}>
                      <div style={campoHeaderStyle}>
                        <span>Número do Contrato</span>
                        <span style={origemBadgeStyle}>{contratoEmRevisao.numeroContrato.clausulaOrigem}</span>
                      </div>
                      <input
                        type="text"
                        value={String(contratoEmRevisao.numeroContrato.valor)}
                        onChange={(e) =>
                          setContratoEmRevisao({
                            ...contratoEmRevisao,
                            numeroContrato: { ...contratoEmRevisao.numeroContrato, valor: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </div>

                    {/* Campo Cliente */}
                    <div style={campoContainerStyle}>
                      <div style={campoHeaderStyle}>
                        <span>Cliente / Contratante</span>
                        <span style={origemBadgeStyle}>{contratoEmRevisao.cliente.clausulaOrigem}</span>
                      </div>
                      <input
                        type="text"
                        value={String(contratoEmRevisao.cliente.valor)}
                        onChange={(e) =>
                          setContratoEmRevisao({
                            ...contratoEmRevisao,
                            cliente: { ...contratoEmRevisao.cliente, valor: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </div>

                    {/* Campo Projeto */}
                    <div style={campoContainerStyle}>
                      <div style={campoHeaderStyle}>
                        <span>Nome do Projeto</span>
                        <span style={origemBadgeStyle}>{contratoEmRevisao.projeto.clausulaOrigem}</span>
                      </div>
                      <input
                        type="text"
                        value={String(contratoEmRevisao.projeto.valor)}
                        onChange={(e) =>
                          setContratoEmRevisao({
                            ...contratoEmRevisao,
                            projeto: { ...contratoEmRevisao.projeto, valor: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </div>

                    {/* Campo Valor Global */}
                    <div style={campoContainerStyle}>
                      <div style={campoHeaderStyle}>
                        <span>Valor Global (R$)</span>
                        <span style={origemBadgeStyle}>{contratoEmRevisao.valorGlobal.clausulaOrigem}</span>
                      </div>
                      <input
                        type="number"
                        value={Number(contratoEmRevisao.valorGlobal.valor)}
                        onChange={(e) =>
                          setContratoEmRevisao({
                            ...contratoEmRevisao,
                            valorGlobal: { ...contratoEmRevisao.valorGlobal, valor: parseFloat(e.target.value) || 0 },
                          })
                        }
                        style={inputStyle}
                      />
                    </div>

                    {/* Campo Modalidade */}
                    <div style={campoContainerStyle}>
                      <div style={campoHeaderStyle}>
                        <span>Modalidade de Cobrança</span>
                        <span style={origemBadgeStyle}>{contratoEmRevisao.modalidadeCobranca.clausulaOrigem}</span>
                      </div>
                      <select
                        value={contratoEmRevisao.modalidadeCobranca.valor}
                        onChange={(e) =>
                          setContratoEmRevisao({
                            ...contratoEmRevisao,
                            modalidadeCobranca: {
                              ...contratoEmRevisao.modalidadeCobranca,
                              valor: e.target.value as ModalidadeCobranca,
                            },
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="DEMANDA_SERVICOS">Serviços por Demanda (Sem mensalidade fixa)</option>
                        <option value="MENSAL_FIXO">Mensalidade Fixa Garantida</option>
                      </select>
                    </div>

                    {/* Campo Mensalidade Fixa */}
                    <div style={campoContainerStyle}>
                      <div style={campoHeaderStyle}>
                        <span>Valor Mensal Fixo (se aplicável)</span>
                        <span style={origemBadgeStyle}>{contratoEmRevisao.valorMensalFixo.clausulaOrigem}</span>
                      </div>
                      <input
                        type="number"
                        placeholder="Não possui mensalidade fixa"
                        value={contratoEmRevisao.valorMensalFixo.valor || ""}
                        onChange={(e) =>
                          setContratoEmRevisao({
                            ...contratoEmRevisao,
                            valorMensalFixo: {
                              ...contratoEmRevisao.valorMensalFixo,
                              valor: e.target.value ? parseFloat(e.target.value) : null,
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </div>

                    {/* Campo Data Início */}
                    <div style={campoContainerStyle}>
                      <div style={campoHeaderStyle}>
                        <span>Data Início</span>
                        <span style={origemBadgeStyle}>{contratoEmRevisao.dataInicio.clausulaOrigem}</span>
                      </div>
                      <input
                        type="date"
                        value={String(contratoEmRevisao.dataInicio.valor)}
                        onChange={(e) =>
                          setContratoEmRevisao({
                            ...contratoEmRevisao,
                            dataInicio: { ...contratoEmRevisao.dataInicio, valor: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </div>

                    {/* Campo Data Encerramento */}
                    <div style={campoContainerStyle}>
                      <div style={campoHeaderStyle}>
                        <span>Data Encerramento</span>
                        <span style={origemBadgeStyle}>{contratoEmRevisao.dataEncerramento.clausulaOrigem}</span>
                      </div>
                      <input
                        type="date"
                        value={String(contratoEmRevisao.dataEncerramento.valor)}
                        onChange={(e) =>
                          setContratoEmRevisao({
                            ...contratoEmRevisao,
                            dataEncerramento: { ...contratoEmRevisao.dataEncerramento, valor: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </div>

                    {/* Campo Índice Reajuste */}
                    <div style={campoContainerStyle}>
                      <div style={campoHeaderStyle}>
                        <span>Índice de Reajuste</span>
                        <span style={origemBadgeStyle}>{contratoEmRevisao.indiceReajuste.clausulaOrigem}</span>
                      </div>
                      <input
                        type="text"
                        value={String(contratoEmRevisao.indiceReajuste.valor)}
                        onChange={(e) =>
                          setContratoEmRevisao({
                            ...contratoEmRevisao,
                            indiceReajuste: { ...contratoEmRevisao.indiceReajuste, valor: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* =================================================================== */}
          {/* ABA 4: LINHA DO TEMPO (GANTT INTERATIVO)                            */}
          {/* =================================================================== */}
          {abaAtiva === "TIMELINE" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <section
                style={{
                  backgroundColor: "var(--surface-container-lowest, #ffffff)",
                  borderRadius: "16px",
                  border: "1px solid var(--border, #e2e8f0)",
                  padding: "20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Linha do Tempo dos Contratos (Gantt Interativo)
                    </h3>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Visualização cronológica das vigências contratuais, aditivos e marcos temporais.
                    </span>
                  </div>

                  {/* Legenda de Cores */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", fontWeight: 700 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#2563eb" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "3px", backgroundColor: "#3b82f6" }} />
                      Vigente
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#d97706" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "3px", backgroundColor: "#f59e0b" }} />
                      Vencimento Próximo
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#dc2626" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "3px", backgroundColor: "#ef4444" }} />
                      Vencido
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#059669" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "3px", backgroundColor: "#10b981" }} />
                      Renovado
                    </span>
                  </div>
                </div>

                {/* Grade Cronológica Gantt */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {contratos.map((c) => {
                    const corBarra =
                      c.situacao === "VIGENTE"
                        ? "#3b82f6"
                        : c.situacao === "VENCIMENTO_PROXIMO"
                        ? "#f59e0b"
                        : c.situacao === "VENCIDO"
                        ? "#ef4444"
                        : c.situacao === "RENOVADO"
                        ? "#10b981"
                        : "#94a3b8";

                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setContratoSelecionado(c);
                          setAbaFicha("RESUMO");
                        }}
                        style={{
                          backgroundColor: "#f8fafc",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          padding: "16px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#94a3b8")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                          <div>
                            <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "13.5px" }}>
                              {c.cliente.valor} • {c.projeto.valor}
                            </span>
                            <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "8px" }}>
                              ({c.numeroContrato.valor})
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                            {brl(Number(c.valorGlobal.valor))}
                          </div>
                        </div>

                        {/* Barra Gantt */}
                        <div style={{ position: "relative", width: "100%", height: "24px", backgroundColor: "#e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              backgroundColor: corBarra,
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              padding: "0 12px",
                              color: "#ffffff",
                              fontSize: "11px",
                              fontWeight: 700,
                              justifyContent: "space-between",
                            }}
                          >
                            <span>Início: {formatarDataBR(c.dataInicio.valor)}</span>
                            <span>{c.prazoMeses.valor} meses</span>
                            <span>Fim: {formatarDataBR(c.dataEncerramentoOficial || c.dataEncerramento.valor)}</span>
                          </div>
                        </div>

                        {/* Aditivos Vinculados na Timeline */}
                        {(c.aditivos || []).length > 0 && (
                          <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                            {c.aditivos.map((adt) => (
                              <span
                                key={adt.id}
                                style={{
                                  backgroundColor: "#ecfdf5",
                                  color: "#047857",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #a7f3d0",
                                }}
                              >
                                📌 Termo Aditivo nº {adt.numeroAditivo}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* =================================================================== */}
          {/* ABA 5: ALERTAS E VENCIMENTOS (SISTEMA 90 DIAS)                      */}
          {/* =================================================================== */}
          {abaAtiva === "ALERTAS" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Painel Informativo da Regra dos 90 Dias */}
              <div
                style={{
                  backgroundColor: "#0f2a4a",
                  color: "#ffffff",
                  borderRadius: "16px",
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                    Sistema Automático de Alertas de Vencimento
                  </h3>
                  <p style={{ fontSize: "12.5px", color: "#93c5fd", marginTop: "4px", margin: 0, maxWidth: "600px" }}>
                    Monitoramento diário executado no fuso horário America/Sao_Paulo com escalonamento aos 90, 60, 30, 15 e 0 dias do término de vigência.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={async () => {
                      await carregarDados();
                      mostrarToast("Varredura diária reexecutada com sucesso!");
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      backgroundColor: "#1e3a5f",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      border: "1px solid #334155",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      sync
                    </span>
                    <span>Recalcular Alertas Agora</span>
                  </button>
                </div>
              </div>

              {/* Tabela de Alertas Ativos */}
              <div
                style={{
                  backgroundColor: "var(--surface-container-lowest, #ffffff)",
                  borderRadius: "16px",
                  border: "1px solid var(--border, #e2e8f0)",
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                      <th style={{ padding: "14px 16px" }}>Classificação</th>
                      <th style={{ padding: "14px 16px" }}>Contrato &amp; Cliente</th>
                      <th style={{ padding: "14px 16px" }}>Dias Restantes</th>
                      <th style={{ padding: "14px 16px" }}>Ação Recomendada</th>
                      <th style={{ padding: "14px 16px" }}>Status</th>
                      <th style={{ padding: "14px 16px", textAlign: "right" }}>Gerenciamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todosAlertas.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                          Nenhum alerta ativo registrado.
                        </td>
                      </tr>
                    ) : (
                      todosAlertas.map((alt) => (
                        <tr key={alt.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 800,
                                backgroundColor:
                                  alt.classificacao === "URGENTE"
                                    ? "#fee2e2"
                                    : alt.classificacao === "CRITICO"
                                    ? "#ffedd5"
                                    : "#fef3c7",
                                color:
                                  alt.classificacao === "URGENTE"
                                    ? "#b91c1c"
                                    : alt.classificacao === "CRITICO"
                                    ? "#c2410c"
                                    : "#b45309",
                              }}
                            >
                              {alt.classificacao}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <strong style={{ color: "#0f172a" }}>{alt.cliente}</strong>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>{alt.contratoNumero} • {alt.projeto}</div>
                          </td>
                          <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0f172a" }}>
                            {alt.diasRestantes} dias
                          </td>
                          <td style={{ padding: "14px 16px", color: "#334155" }}>
                            {alt.acaoRecomendada}
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: alt.status === "CONCLUIDO" ? "#047857" : alt.status === "EM_TRATAMENTO" ? "#0369a1" : "#b45309",
                              }}
                            >
                              {alt.status}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              {alt.status !== "CONCLUIDO" && (
                                <button
                                  type="button"
                                  onClick={() => handleAtualizarAlerta(alt.id, alt.contratoId, "CONCLUIDO")}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    backgroundColor: "#ecfdf5",
                                    color: "#047857",
                                    border: "1px solid #a7f3d0",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Concluir
                                </button>
                              )}
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

          {/* =================================================================== */}
          {/* ABA 6: RELATÓRIOS GERENCIAIS                                        */}
          {/* =================================================================== */}
          {abaAtiva === "RELATORIOS" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  backgroundColor: "var(--surface-container-lowest, #ffffff)",
                  borderRadius: "16px",
                  border: "1px solid var(--border, #e2e8f0)",
                  padding: "24px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Relatório Executivo da Carteira de Contratos
                    </h3>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Consolidação financeira, índice de vigência e conformidade de cláusulas contratuais.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      backgroundColor: "#0f2a4a",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      print
                    </span>
                    <span>Imprimir / Exportar Relatório</span>
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                  <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Carteira Comercial Global
                    </span>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                      {brl(metricas.valorGlobal)}
                    </div>
                    <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600 }}>
                      {contratos.length} contratos formalizados
                    </span>
                  </div>

                  <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Receita Mensal Recorrente (MRR)
                    </span>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#166534", marginTop: "4px" }}>
                      {brl(metricas.receitaMensalFixaMRR)}
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Contratos de prestação contínua
                    </span>
                  </div>

                  <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Conformidade e Riscos
                    </span>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                      100% Auditados
                    </div>
                    <span style={{ fontSize: "12px", color: "#0284c7" }}>
                      Cláusulas de sigilo e LGPD ativas
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* DRAWER / MODAL DA FICHA INDIVIDUAL DO CONTRATO                     */}
          {/* =================================================================== */}
          {contratoSelecionado && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(15, 23, 42, 0.65)",
                backdropFilter: "blur(4px)",
                zIndex: 9999,
                display: "flex",
                justifyContent: "flex-end",
              }}
              onClick={() => setContratoSelecionado(null)}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "850px",
                  height: "100%",
                  backgroundColor: "#ffffff",
                  boxShadow: "-8px 0 32px rgba(0,0,0,0.25)",
                  display: "flex",
                  flexDirection: "column",
                  overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Cabeçalho da Ficha */}
                <div style={{ padding: "24px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284c7", textTransform: "uppercase" }}>
                        Ficha Individual do Contrato • {contratoSelecionado.codigo}
                      </span>
                      <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: "4px 0 0 0" }}>
                        {contratoSelecionado.cliente.valor}
                      </h2>
                      <span style={{ fontSize: "13px", color: "#64748b" }}>
                        {contratoSelecionado.projeto.valor} • Número: {contratoSelecionado.numeroContrato.valor}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setContratoSelecionado(null)}
                      style={{
                        padding: "8px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  {/* Indicadores do Topo */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginTop: "16px" }}>
                    <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                        Valor Global
                      </span>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                        {brl(Number(contratoSelecionado.valorGlobal.valor))}
                      </div>
                    </div>

                    <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                        Remuneração Mensal
                      </span>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: contratoSelecionado.modalidadeCobranca.valor === "MENSAL_FIXO" ? "#166534" : "#0284c7" }}>
                        {contratoSelecionado.modalidadeCobranca.valor === "MENSAL_FIXO"
                          ? `${brl(Number(contratoSelecionado.valorMensalFixo.valor))}`
                          : "Por Demanda (BM)"}
                      </div>
                    </div>

                    <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                        Vigência Oficial
                      </span>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                        {formatarDataBR(contratoSelecionado.dataEncerramentoOficial || contratoSelecionado.dataEncerramento.valor)}
                      </div>
                    </div>
                  </div>

                  {/* Abas Internas da Ficha */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "16px", overflowX: "auto" }}>
                    {[
                      { id: "RESUMO", rotulo: "Resumo Executivo" },
                      { id: "DADOS", rotulo: "Informações Contratuais" },
                      { id: "FINANCEIRO", rotulo: "Financeiro & Perfis" },
                      { id: "RISCOS", rotulo: "Cláusulas & Riscos" },
                      { id: "ADITIVOS", rotulo: `Aditivos (${contratoSelecionado.aditivos?.length || 0})` },
                      { id: "ALERTAS", rotulo: "Alertas & Renovação" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAbaFicha(t.id as any)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "none",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                          backgroundColor: abaFicha === t.id ? "#0f2a4a" : "transparent",
                          color: abaFicha === t.id ? "#ffffff" : "#475569",
                        }}
                      >
                        {t.rotulo}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conteúdo da Aba da Ficha */}
                <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  {abaFicha === "RESUMO" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                      <div>
                        <strong style={{ color: "#0f172a" }}>Objeto Contratual:</strong>
                        <p style={{ color: "#475569", marginTop: "4px" }}>{contratoSelecionado.objeto.valor}</p>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div>
                          <strong>Contratada:</strong>
                          <p style={{ color: "#475569", margin: "2px 0 0 0" }}>
                            {contratoSelecionado.razaoSocialContratada.valor} (CNPJ: {contratoSelecionado.cnpjContratada.valor})
                          </p>
                        </div>
                        <div>
                          <strong>Contratante:</strong>
                          <p style={{ color: "#475569", margin: "2px 0 0 0" }}>
                            {contratoSelecionado.cliente.valor} (CNPJ: {contratoSelecionado.cnpjCliente.valor})
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {abaFicha === "FINANCEIRO" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div style={{ padding: "14px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                        <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#0f172a" }}>Condições Financeiras</h4>
                        <div style={{ fontSize: "12.5px", color: "#475569", display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div><strong>Periodicidade de Faturamento:</strong> {contratoSelecionado.periodicidadeFaturamento.valor}</div>
                          <div><strong>Condições de Pagamento:</strong> {contratoSelecionado.condicoesPagamento.valor}</div>
                          <div><strong>Índice de Reajuste:</strong> {contratoSelecionado.indiceReajuste.valor} (Data-base: {contratoSelecionado.dataBaseReajuste.valor})</div>
                        </div>
                      </div>

                      {/* Composição por Perfil Profissional */}
                      {contratoSelecionado.composicaoPerfis && contratoSelecionado.composicaoPerfis.length > 0 && (
                        <div>
                          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#0f172a" }}>
                            Composição por Perfil Profissional
                          </h4>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                              <tr style={{ backgroundColor: "#f1f5f9", textAlign: "left", color: "#475569" }}>
                                <th style={{ padding: "8px" }}>Perfil</th>
                                <th style={{ padding: "8px" }}>Remuneração Mensal</th>
                                <th style={{ padding: "8px" }}>Observações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {contratoSelecionado.composicaoPerfis.map((p, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                  <td style={{ padding: "8px", fontWeight: 700 }}>{p.perfil}</td>
                                  <td style={{ padding: "8px", color: "#166534", fontWeight: 700 }}>{brl(p.valorMensal)}</td>
                                  <td style={{ padding: "8px", color: "#64748b" }}>{p.observacao || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {abaFicha === "ADITIVOS" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h4 style={{ margin: 0, fontSize: "14px" }}>Termos Aditivos Contratuais</h4>
                        <button
                          type="button"
                          onClick={() => setModalAditivoAberto(true)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            backgroundColor: "#0f2a4a",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          + Novo Aditivo
                        </button>
                      </div>

                      {(contratoSelecionado.aditivos || []).length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "12.5px" }}>
                          Nenhum aditivo contratual vinculado até o momento.
                        </div>
                      ) : (
                        contratoSelecionado.aditivos.map((adt) => (
                          <div key={adt.id} style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                              <span>Termo Aditivo nº {adt.numeroAditivo}</span>
                              <span style={{ color: "#047857" }}>Assinado em {formatarDataBR(adt.dataAssinatura)}</span>
                            </div>
                            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#475569" }}>{adt.objeto}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {abaFicha === "RISCOS" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <h4 style={{ margin: 0, fontSize: "14px" }}>Cláusulas Relevantes e Riscos Identificados</h4>
                      {(contratoSelecionado.riscosIdentificados || []).map((r, idx) => (
                        <div key={idx} style={{ padding: "12px", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fee2e2" }}>
                          <span style={{ fontSize: "10px", fontWeight: 800, color: "#b91c1c" }}>RISCO {r.severidade}</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#7f1d1d" }}>{r.risco}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {abaFicha === "ALERTAS" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <h4 style={{ margin: 0, fontSize: "14px" }}>Status do Ciclo de Renovação</h4>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {(["NAO_INICIADA", "EM_NEGOCIACAO", "PROPOSTA_ENVIADA", "AGUARDANDO_APROVACAO", "RENOVADO"] as StatusRenovacao[]).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={async () => {
                                await fetch(`/api/contratos/${contratoSelecionado.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ statusRenovacao: st }),
                                });
                                mostrarToast(`Status de renovação alterado para ${st}!`);
                                await carregarDados();
                                setContratoSelecionado({ ...contratoSelecionado, statusRenovacao: st });
                              }}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                border: "1px solid #cbd5e1",
                                backgroundColor: contratoSelecionado.statusRenovacao === st ? "#0f2a4a" : "#ffffff",
                                color: contratoSelecionado.statusRenovacao === st ? "#ffffff" : "#475569",
                              }}
                            >
                              {st}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal de Cadastro de Aditivo */}
          {modalAditivoAberto && contratoSelecionado && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                zIndex: 10000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => setModalAditivoAberto(false)}
            >
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  padding: "24px",
                  width: "100%",
                  maxWidth: "500px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Novo Termo Aditivo Contratual</h3>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Número do Aditivo:</label>
                  <input
                    type="text"
                    value={aditivoNumero}
                    onChange={(e) => setAditivoNumero(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Nova Data de Encerramento (se houver prorrogação):</label>
                  <input
                    type="date"
                    value={aditivoNovaDataFim}
                    onChange={(e) => setAditivoNovaDataFim(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Novo Valor Global:</label>
                  <input
                    type="number"
                    placeholder="Deixe em branco se mantido"
                    value={aditivoNovoValorGlobal}
                    onChange={(e) => setAditivoNovoValorGlobal(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Objeto do Aditivo:</label>
                  <textarea
                    rows={3}
                    value={aditivoObjeto}
                    onChange={(e) => setAditivoObjeto(e.target.value)}
                    placeholder="Descreva as alterações contratuais acordadas com o cliente..."
                    style={{ ...inputStyle, resize: "none" }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setModalAditivoAberto(false)}
                    style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSalvarAditivo}
                    style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "#0f2a4a", color: "#ffffff", fontWeight: 700, border: "none" }}
                  >
                    Salvar e Atualizar Vigência
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Estilos de apoio
const kpiCardStyle = (bg: string, borderCor: string): React.CSSProperties => ({
  backgroundColor: "var(--surface-container-lowest, #ffffff)",
  borderRadius: "16px",
  padding: "18px 20px",
  border: "1px solid var(--border, #e2e8f0)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

const kpiLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#64748b",
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 800,
  color: "#0f172a",
  marginTop: "2px",
};

const kpiSubStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#94a3b8",
  marginTop: "2px",
  display: "block",
};

const kpiIconStyle = (bg: string, cor: string): React.CSSProperties => ({
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  backgroundColor: bg,
  color: cor,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});

const campoContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const campoHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: "12px",
  fontWeight: 700,
  color: "#334155",
};

const origemBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "#0284c7",
  backgroundColor: "#f0f9ff",
  padding: "1px 6px",
  borderRadius: "4px",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "12.5px",
  color: "#0f172a",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

