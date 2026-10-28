"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import AnoSelector from "@/components/AnoSelector";
import { ViagemSolicitacao, StatusViagem } from "@/lib/viagens-types";
import ViagensRoleSelector, { ViagensPerfil } from "./ViagensRoleSelector";
import CotacoesMatrixModal from "./CotacoesMatrixModal";
import { formatarDataBR, formatarPeriodoBR } from "@/lib/date-utils";

interface ViagensDashboardClientProps {
  solicitacoesIniciais: ViagemSolicitacao[];
  anoSelecionado: number;
  mesSelecionado: number | null;
  anosDisponiveis?: number[];
}

export default function ViagensDashboardClient({
  solicitacoesIniciais,
  anoSelecionado,
  mesSelecionado,
  anosDisponiveis = [2025, 2026, 2027],
}: ViagensDashboardClientProps) {
  const [solicitacoes, setSolicitacoes] = useState<ViagemSolicitacao[]>(solicitacoesIniciais);
  const [perfilAtivo, setPerfilAtivo] = useState<ViagensPerfil>("LIDER");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [modalItem, setModalItem] = useState<ViagemSolicitacao | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [cardsExpandidos, setCardsExpandidos] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const alternarCard = (id: string) => {
    setCardsExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const recarregarSolicitacoes = async () => {
    try {
      const comp = `${anoSelecionado}-${String(mesSelecionado).padStart(2, "0")}-01`;
      const res = await fetch(`/api/viagens/solicitacoes?competencia=${comp}&sincronizar=true`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.solicitacoes)) {
        setSolicitacoes(data.solicitacoes);
      }
    } catch (e) {
      console.warn("Erro ao recarregar solicitações:", e);
    }
  };

  const brl = (v: number) =>
    (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const mesesNomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Filtragem da Lista
  const solicitacoesFiltradas = useMemo(() => {
    return solicitacoes.filter((s) => {
      if (filtroStatus !== "TODOS" && s.status !== filtroStatus) return false;
      if (busca.trim()) {
        const b = busca.toLowerCase();
        const mProj = s.projeto?.toLowerCase().includes(b);
        const mAtiv = s.atividade?.toLowerCase().includes(b);
        const mCons = s.consultor?.toLowerCase().includes(b);
        const mDest = s.destino?.toLowerCase().includes(b);
        return mProj || mAtiv || mCons || mDest;
      }
      return true;
    });
  }, [solicitacoes, filtroStatus, busca]);

  // Contadores de KPIs
  const kpis = useMemo(() => {
    const total = solicitacoes.length;
    const aguardandoCotacao = solicitacoes.filter((s) => s.status === "AGUARDANDO_COTACAO" || s.status === "EM_COTACAO").length;
    const aguardandoAprovacao = solicitacoes.filter((s) => s.status === "AGUARDANDO_APROVACAO" || s.requerReaprovacao).length;
    const emContratacao = solicitacoes.filter((s) => s.status === "APROVADO_AGUARDANDO_COMPRA" || s.status === "EM_CONTRATACAO").length;
    const vouchersEnviados = solicitacoes.filter((s) => s.status === "VOUCHERS_ENVIADOS" || s.status === "AGUARDANDO_PRESTACAO_CONTAS").length;
    const concluidas = solicitacoes.filter((s) => s.status === "CONCLUIDO").length;

    const totalCustoPrevisto = solicitacoes.reduce((acc, s) => acc + (s.totalAprovado || s.totalCotado || 0), 0);
    const totalContratado = solicitacoes.reduce((acc, s) => acc + (s.totalContratado || 0), 0);
    const totalRealizado = solicitacoes.reduce((acc, s) => acc + (s.totalRealizado || 0), 0);

    return {
      total,
      aguardandoCotacao,
      aguardandoAprovacao,
      emContratacao,
      vouchersEnviados,
      concluidas,
      totalCustoPrevisto,
      totalContratado,
      totalRealizado,
    };
  }, [solicitacoes]);

  const getStatusBadge = (s: ViagemSolicitacao) => {
    if (s.requerReaprovacao) {
      return {
        label: "Aguardando Reaprovação",
        color: "#b91c1c",
        bg: "#fee2e2",
        icone: "warning",
      };
    }
    // Caso seja apenas despesa/reembolso de alimentação sem cotações de agência
    const apenasAlimentacao = (s.totalContratado === 0 || !s.totalContratado) && (s.custoAlimentacaoDiaria > 0);
    if (apenasAlimentacao) {
      return {
        label: "Reembolso Alimentação",
        color: "#059669",
        bg: "#d1fae5",
        icone: "restaurant",
      };
    }
    switch (s.status) {
      case "AGUARDANDO_COTACAO":
        return { label: "Aguardando Cotação", color: "#d97706", bg: "#fef3c7", icone: "pending" };
      case "EM_COTACAO":
        return { label: "Em Cotação", color: "#0284c7", bg: "#e0f2fe", icone: "edit_note" };
      case "AGUARDANDO_APROVACAO":
        return { label: "Aguardando Aprovação", color: "var(--primary, #0f2a4a)", bg: "rgba(15, 42, 74, 0.1)", icone: "how_to_reg" };
      case "APROVADO_AGUARDANDO_COMPRA":
        return { label: "Aprovado • Comprar", color: "#059669", bg: "#d1fae5", icone: "shopping_cart" };
      case "VOUCHERS_PENDENTES":
        return { label: "Vouchers Pendentes", color: "#ea580c", bg: "#ffedd5", icone: "receipt" };
      case "VOUCHERS_ENVIADOS":
        return { label: "Vouchers Enviados", color: "var(--secondary, #00a896)", bg: "rgba(0, 168, 150, 0.12)", icone: "send" };
      case "AGUARDANDO_PRESTACAO_CONTAS":
        return { label: "Prestação de Contas", color: "#7c3aed", bg: "#ede9fe", icone: "assignment_late" };
      case "CONCLUIDO":
        return { label: "Concluído 100%", color: "#059669", bg: "#dcfce7", icone: "check_circle" };
      default:
        return { label: s.status, color: "var(--on-surface-variant)", bg: "var(--surface-container)", icone: "info" };
    }
  };

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "var(--primary, #0f2a4a)",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--secondary, #00a896)" }}>
            check_circle
          </span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Sidebar Padronizada */}
      <aside className="sidebar">
        <div className="sidebar-top">
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
            <Link href="/medicao" className="nav-item">
              <span className="material-symbols-outlined">receipt_long</span>
              <span>BM - Boletim de Medição</span>
            </Link>
            <Link href="/viagens" className="nav-item active">
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
              Módulo de Viagens & Logística
            </span>
          </div>
        </div>
      </aside>

      {/* Área Principal com recuo da Sidebar */}
      <div className="main-wrapper">
        <main className="content-container" style={{ padding: "28px 36px", overflowY: "auto", minHeight: "100vh" }}>
        {/* Header Superior com Seletor de Perfil e Filtro Temporal */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "var(--primary, #0f2a4a)" }}>
                flight_takeoff
              </span>
              <h1 style={{ fontSize: "24px", fontWeight: 800, margin: 0, color: "var(--on-surface)" }}>
                Viagens & Logística Integrada
              </h1>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--on-surface-variant)" }}>
              Central de cotações, aprovações, contratações e prestação de contas vinculada a Projetos & Atividades.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Seletor de Perfil do Usuário */}
            <ViagensRoleSelector
              perfilAtivo={perfilAtivo}
              onChangePerfil={(p) => {
                setPerfilAtivo(p);
                showToast(`Visão alterada para: ${p === "AGENCIA" ? "Agência de Viagens" : p === "LIDER" ? "Líder de Projeto" : p === "FINANCEIRO" ? "Financeiro" : "Consultor"}`);
              }}
            />

            {/* Faixa Temporal com Ano e Meses (Print 5) */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--surface-container)", borderRadius: "8px", padding: "4px 8px", border: "1px solid var(--border)", flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--primary)" }}>
                  calendar_month
                </span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--on-surface)" }}>
                  Competência:
                </span>
                <AnoSelector
                  anosDisponiveis={anosDisponiveis}
                  anoAtual={anoSelecionado}
                  mesAtual={mesSelecionado}
                  basePath="/viagens"
                />
              </div>

              <div style={{ height: "20px", width: "1px", background: "var(--border)", margin: "0 2px" }} />

              {/* Seletor de Mês com Toggle: ao clicar novamente no mês retira o filtro e exibe o ano inteiro */}
              <div style={{ display: "inline-flex", gap: "2px", flexWrap: "wrap" }}>
                {mesesNomes.map((nome, idx) => {
                  const num = idx + 1;
                  const isSelected = num === mesSelecionado;
                  const href = isSelected
                    ? `/viagens?ano=${anoSelecionado}`
                    : `/viagens?ano=${anoSelecionado}&mes=${num}`;
                  return (
                    <a
                      key={num}
                      href={href}
                      style={{
                        padding: "5px 10px",
                        fontSize: "12px",
                        fontWeight: isSelected ? 700 : 500,
                        borderRadius: "6px",
                        textDecoration: "none",
                        color: isSelected ? "#fff" : "var(--on-surface-variant)",
                        backgroundColor: isSelected ? "var(--primary)" : "transparent",
                        transition: "all 0.15s ease",
                        cursor: "pointer",
                      }}
                      title={isSelected ? `Mês ${nome} ativo. Clique para desmarcar e ver todas as viagens de ${anoSelecionado}` : `Filtrar por ${nome}/${anoSelecionado}`}
                    >
                      {nome.substring(0, 3)}
                    </a>
                  );
                })}
              </div>
            </div>

            <ThemeToggle />
          </div>
        </header>

        {/* Alerta de Ação Pendente para o Perfil Conectado */}
        {perfilAtivo === "LIDER" && kpis.aguardandoAprovacao > 0 && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(15, 42, 74, 0.08) 0%, rgba(0, 168, 150, 0.05) 100%)",
              border: "1px solid rgba(15, 42, 74, 0.25)",
              borderRadius: "12px",
              padding: "14px 20px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "var(--primary, #0f2a4a)" }}>
                notifications_active
              </span>
              <div>
                <strong style={{ fontSize: "13px", color: "var(--on-surface)" }}>
                  Atenção Líder de Projeto: Há {kpis.aguardandoAprovacao} solicitação(ões) com cotações prontas para aprovação!
                </strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                  Abra a solicitação para comparar as opções lado a lado, visualizar as propostas e aprovar em 1 clique.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFiltroStatus("AGUARDANDO_APROVACAO")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#ffffff",
                backgroundColor: "var(--primary, #0f2a4a)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Filtrar Pendentes
            </button>
          </div>
        )}

        {perfilAtivo === "AGENCIA" && kpis.aguardandoCotacao > 0 && (
          <div
            style={{
              background: "rgba(0, 168, 150, 0.06)",
              border: "1px solid rgba(0, 168, 150, 0.25)",
              borderRadius: "12px",
              padding: "14px 20px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "var(--secondary, #00a896)" }}>
                travel_explore
              </span>
              <div>
                <strong style={{ fontSize: "13px", color: "var(--on-surface)" }}>
                  Painel da Agência: Existem {kpis.aguardandoCotacao} demanda(s) aguardando elaboração de cotação.
                </strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                  Cadastre até 3 alternativas para cada categoria necessária e envie para aprovação do solicitante.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFiltroStatus("AGUARDANDO_COTACAO")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#ffffff",
                backgroundColor: "var(--secondary, #00a896)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Ver Demandas
            </button>
          </div>
        )}

        {perfilAtivo === "CONSULTOR" && (
          <div
            style={{
              background: "rgba(37, 99, 235, 0.06)",
              border: "1px solid rgba(37, 99, 235, 0.25)",
              borderRadius: "12px",
              padding: "14px 20px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "#2563eb" }}>
                badge
              </span>
              <div>
                <strong style={{ fontSize: "13px", color: "var(--on-surface)" }}>
                  Painel do Consultor: Consulte seus vouchers de viagens e aprove o recebimento diretamente no sistema.
                </strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                  Além de receber por e-mail, todos os vouchers, passagens e reservas emitidos pela agência estão disponíveis aqui para conferência e aprovação.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFiltroStatus("VOUCHERS_ENVIADOS")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#ffffff",
                backgroundColor: "#2563eb",
                border: "none",
                cursor: "pointer",
              }}
            >
              Ver Meus Vouchers
            </button>
          </div>
        )}

        {/* Cards de KPIs e Indicadores da Esteira */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "14px", marginBottom: "24px" }}>
          <div
            onClick={() => setFiltroStatus("TODOS")}
            style={{
              background: "var(--surface)",
              border: filtroStatus === "TODOS" ? "2px solid var(--primary)" : "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Todas Demandas</span>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "4px", color: "var(--on-surface)" }}>{kpis.total}</div>
            <span style={{ fontSize: "11px", color: "var(--primary)" }}>Competência ativa</span>
          </div>

          <div
            onClick={() => setFiltroStatus("AGUARDANDO_COTACAO")}
            style={{
              background: "var(--surface)",
              border: filtroStatus === "AGUARDANDO_COTACAO" ? "2px solid #d97706" : "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>1. Em Cotação</span>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "4px", color: "#d97706" }}>{kpis.aguardandoCotacao}</div>
            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Agência cotando</span>
          </div>

          <div
            onClick={() => setFiltroStatus("AGUARDANDO_APROVACAO")}
            style={{
              background: "var(--surface)",
              border: filtroStatus === "AGUARDANDO_APROVACAO" ? "2px solid var(--primary, #0f2a4a)" : "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>2. Para Aprovar</span>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "4px", color: "var(--primary)" }}>{kpis.aguardandoAprovacao}</div>
            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Líder de Projeto</span>
          </div>

          <div
            onClick={() => setFiltroStatus("APROVADO_AGUARDANDO_COMPRA")}
            style={{
              background: "var(--surface)",
              border: filtroStatus === "APROVADO_AGUARDANDO_COMPRA" ? "2px solid #059669" : "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>3. Para Comprar</span>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "4px", color: "#059669" }}>{kpis.emContratacao}</div>
            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Agência emitindo</span>
          </div>

          <div
            onClick={() => setFiltroStatus("VOUCHERS_ENVIADOS")}
            style={{
              background: "var(--surface)",
              border: filtroStatus === "VOUCHERS_ENVIADOS" ? "2px solid var(--secondary)" : "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--secondary)", textTransform: "uppercase" }}>4. Vouchers Enviados</span>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "4px", color: "var(--secondary)" }}>{kpis.vouchersEnviados}</div>
            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Viajante informado</span>
          </div>

          <div
            onClick={() => setFiltroStatus("CONCLUIDO")}
            style={{
              background: "var(--surface)",
              border: filtroStatus === "CONCLUIDO" ? "2px solid #059669" : "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>5. Concluídas</span>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "4px", color: "#059669" }}>{kpis.concluidas}</div>
            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Prestação finalizada</span>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div style={{ display: "flex", gap: "14px", marginBottom: "20px", alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span
              className="material-symbols-outlined"
              style={{ position: "absolute", left: "12px", top: "10px", fontSize: "18px", color: "var(--on-surface-variant)" }}
            >
              search
            </span>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por Projeto, Atividade, Consultor ou Destino..."
              style={{
                width: "100%",
                padding: "8px 12px 8px 38px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontSize: "13px",
                backgroundColor: "var(--surface)",
                color: "var(--on-surface)",
              }}
            />
          </div>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "13px",
              backgroundColor: "var(--surface)",
              color: "var(--on-surface)",
              fontWeight: 600,
            }}
          >
            <option value="TODOS">Todos os Status</option>
            <option value="AGUARDANDO_COTACAO">Aguardando Cotação</option>
            <option value="EM_COTACAO">Em Cotação</option>
            <option value="AGUARDANDO_APROVACAO">Aguardando Aprovação</option>
            <option value="APROVADO_AGUARDANDO_COMPRA">Aprovado • Aguardando Compra</option>
            <option value="VOUCHERS_PENDENTES">Vouchers Pendentes</option>
            <option value="VOUCHERS_ENVIADOS">Vouchers Enviados</option>
            <option value="AGUARDANDO_PRESTACAO_CONTAS">Aguardando Prestação de Contas</option>
            <option value="CONCLUIDO">Concluído</option>
          </select>
        </div>

        {/* Listagem em Cards Flutuantes Padronizados */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {solicitacoesFiltradas.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "50px 20px",
                background: "var(--surface)",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                color: "var(--on-surface-variant)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "42px", color: "var(--outline)" }}>
                flight_takeoff
              </span>
              <h3 style={{ margin: "10px 0 4px 0", fontSize: "15px", fontWeight: 700, color: "var(--on-surface)" }}>
                Nenhuma viagem encontrada para este filtro
              </h3>
              <p style={{ margin: 0, fontSize: "12px" }}>
                As viagens são geradas automaticamente quando uma atividade tem &quot;Precisa Logística? = SIM&quot;.
              </p>
            </div>
          ) : (
            solicitacoesFiltradas.map((item) => {
              const badge = getStatusBadge(item);
              const isExpanded = cardsExpandidos.has(item.id);

              // Custo por categoria
              const getCatValor = (catNome: string) => {
                const cat = item.categorias?.find((c) => c.categoria === catNome);
                if (!cat) return 0;
                const alt = cat.alternativas?.find((a) => a.id === cat.alternativaAprovadaId) || cat.alternativas?.find((a) => a.selecionada);
                return alt ? (alt.valorContratado ?? alt.valor ?? 0) : 0;
              };

              const vAereo = getCatValor("AEREO");
              const vHotel = getCatValor("HOTEL");
              const vCarro = getCatValor("CARRO");
              const vSeguro = getCatValor("SEGURO");
              const vDiaria = item.custoAlimentacaoDiaria || 0;
              const totalGeral = item.totalRealizado || (vAereo + vHotel + vCarro + vSeguro + vDiaria);

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: "var(--surface, #ffffff)",
                    border: item.requerReaprovacao ? "2px solid #ef4444" : "1px solid var(--border, #e2e8f0)",
                    borderRadius: "14px",
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Linha Principal do Card */}
                  <div
                    style={{
                      padding: "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "24px",
                      cursor: "pointer",
                      background: isExpanded ? "var(--surface-container-low, #f8fafc)" : "transparent",
                    }}
                    onClick={() => alternarCard(item.id)}
                  >
                    {/* 1. Botão Expand + Projeto + Atividade */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1.2 1 260px", minWidth: "220px" }}>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--on-surface-variant)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                      </button>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "14px", color: "var(--on-surface)", fontWeight: 800 }}>
                            {item.projeto}
                          </strong>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 700,
                              backgroundColor: badge.bg,
                              color: badge.color,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>{badge.icone}</span>
                            {badge.label}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "2px", fontWeight: 500 }}>
                          {item.atividade}
                        </div>
                      </div>
                    </div>

                    {/* 2. Informações Centrais Distribuídas Pela Barra */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-around",
                        gap: "24px",
                        flex: "2.5 1 500px",
                        fontSize: "12px",
                      }}
                    >
                      {/* Viajante */}
                      <div style={{ minWidth: "120px", flex: 1 }}>
                        <span style={{ fontSize: "10px", textTransform: "uppercase", display: "block", color: "var(--outline)", fontWeight: 600, letterSpacing: "0.04em" }}>
                          Viajante
                        </span>
                        <strong style={{ color: "var(--on-surface)", fontSize: "12.5px" }}>{item.consultor}</strong>
                      </div>

                      {/* Destino */}
                      <div style={{ minWidth: "130px", flex: 1 }}>
                        <span style={{ fontSize: "10px", textTransform: "uppercase", display: "block", color: "var(--outline)", fontWeight: 600, letterSpacing: "0.04em" }}>
                          Destino
                        </span>
                        <strong style={{ color: "var(--on-surface)", fontSize: "12.5px" }}>{item.destino || "—"}</strong>
                      </div>

                      {/* Período Formatado BR */}
                      <div style={{ minWidth: "180px", flex: 1.4 }}>
                        <span style={{ fontSize: "10px", textTransform: "uppercase", display: "block", color: "var(--outline)", fontWeight: 600, letterSpacing: "0.04em" }}>
                          Período
                        </span>
                        <strong style={{ color: "var(--on-surface)", fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "var(--primary)" }}>date_range</span>
                          {formatarPeriodoBR(item.dataInicial, item.dataFinal)}
                        </strong>
                      </div>
                    </div>

                    {/* 3. Valores e Botão de Ação */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
                      <div style={{ textAlign: "right", minWidth: "110px" }}>
                        <span style={{ fontSize: "10px", textTransform: "uppercase", display: "block", color: "var(--outline)", fontWeight: 600, letterSpacing: "0.04em" }}>
                          Total Viagem
                        </span>
                        <strong style={{ fontSize: "16px", fontWeight: 900, color: "var(--primary, #0f2a4a)" }}>
                          {brl(totalGeral)}
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalItem(item);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#ffffff",
                          backgroundColor:
                            item.requerReaprovacao
                              ? "#dc2626"
                              : badge.label === "Reembolso Alimentação"
                              ? "var(--primary, #0f2a4a)"
                              : perfilAtivo === "CONSULTOR"
                              ? (item.status === "VOUCHERS_ENVIADOS" && !item.vouchersRecebidosAprovadosEm)
                                ? "#059669"
                                : "#2563eb"
                              : perfilAtivo === "AGENCIA"
                              ? "var(--secondary, #00a896)"
                              : perfilAtivo === "LIDER"
                              ? "var(--primary, #0f2a4a)"
                              : "#d97706",
                          border: "none",
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          {item.requerReaprovacao
                            ? "warning"
                            : (perfilAtivo === "CONSULTOR" && item.status === "VOUCHERS_ENVIADOS" && !item.vouchersRecebidosAprovadosEm)
                            ? "verified"
                            : "visibility"}
                        </span>
                        <span>
                          {item.requerReaprovacao
                            ? "Analisar Reaprovação"
                            : badge.label === "Reembolso Alimentação"
                            ? "Ver Despesa"
                            : perfilAtivo === "CONSULTOR"
                            ? item.vouchersRecebidosAprovadosEm
                              ? "Vouchers Aprovados"
                              : item.status === "VOUCHERS_ENVIADOS"
                              ? "Aprovar Vouchers"
                              : "Ver Vouchers"
                            : perfilAtivo === "AGENCIA"
                            ? item.status === "AGUARDANDO_COTACAO" || item.status === "EM_COTACAO"
                              ? "Cotar Viagem"
                              : "Gerenciar Vouchers"
                            : perfilAtivo === "LIDER"
                            ? item.status === "AGUARDANDO_APROVACAO"
                              ? "Analisar & Aprovar"
                              : "Ver Detalhes"
                            : "Prestação de Contas"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Drawer Expansível de Detalhamento Logístico (Padrão 6 Blocos) */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: "16px 20px",
                        borderTop: "1px solid var(--border, #e2e8f0)",
                        backgroundColor: "var(--surface-container-low, #f8fafc)",
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px" }}>
                        {/* 1. Aéreo */}
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px" }}>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Passagem Aérea</span>
                          <div style={{ fontSize: "14px", fontWeight: 800, marginTop: "2px", color: "var(--on-surface)" }}>{brl(vAereo)}</div>
                          <span style={{ fontSize: "10px", color: "var(--secondary)" }}>{vAereo > 0 ? "Contratado" : "Sem aéreo"}</span>
                        </div>

                        {/* 2. Hotel */}
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px" }}>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Hotel / Estadia</span>
                          <div style={{ fontSize: "14px", fontWeight: 800, marginTop: "2px", color: "var(--on-surface)" }}>{brl(vHotel)}</div>
                          <span style={{ fontSize: "10px", color: "var(--secondary)" }}>{vHotel > 0 ? "Contratado" : "Sem estadia"}</span>
                        </div>

                        {/* 3. Carro */}
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px" }}>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Carro / Translado</span>
                          <div style={{ fontSize: "14px", fontWeight: 800, marginTop: "2px", color: "var(--on-surface)" }}>{brl(vCarro)}</div>
                          <span style={{ fontSize: "10px", color: "var(--secondary)" }}>{vCarro > 0 ? "Contratado" : "Sem translado"}</span>
                        </div>

                        {/* 4. Seguro */}
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px" }}>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Seguro / Outros</span>
                          <div style={{ fontSize: "14px", fontWeight: 800, marginTop: "2px", color: "var(--on-surface)" }}>{brl(vSeguro)}</div>
                          <span style={{ fontSize: "10px", color: "var(--outline)" }}>{vSeguro > 0 ? "Apólice ativa" : "Não aplicável"}</span>
                        </div>

                        {/* 5. Alimentação */}
                        <div style={{ background: "var(--surface)", border: "1px solid #d97706", borderRadius: "8px", padding: "10px" }}>
                          <span style={{ fontSize: "11px", color: "#d97706" }}>Alimentação / Diária</span>
                          <div style={{ fontSize: "14px", fontWeight: 800, marginTop: "2px", color: "#d97706" }}>{brl(vDiaria)}</div>
                          <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Despesa Financeiro</span>
                        </div>

                        {/* 6. Total Viagem */}
                        <div style={{ background: "var(--primary, #0f2a4a)", borderRadius: "8px", padding: "10px", color: "#ffffff" }}>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>TOTAL VIAGEM</span>
                          <div style={{ fontSize: "15px", fontWeight: 900, marginTop: "2px", color: "#ffffff" }}>{brl(totalGeral)}</div>
                          <span style={{ fontSize: "10px", color: "var(--secondary, #00a896)" }}>100% Sincronizado</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>

      {/* Modal de Gestão Operacional e Cotações */}
      {modalItem && (
        <CotacoesMatrixModal
          solicitacao={modalItem}
          perfilAtivo={perfilAtivo}
          onClose={() => setModalItem(null)}
          onAtualizar={recarregarSolicitacoes}
          showToast={showToast}
        />
      )}
    </div>
  );
}
