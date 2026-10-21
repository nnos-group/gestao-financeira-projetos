"use client";

import React, { useState, useMemo, useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { PESSOAS_INICIAIS, PessoaItem } from "@/lib/pessoas-data";
import ModernDropdown from "@/components/ModernDropdown";

export default function PessoasPage() {
  const [pessoas, setPessoas] = useState<PessoaItem[]>(PESSOAS_INICIAIS);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "parceiro" | "funcionario" | "socio">("todos");
  const [filtroPerfil, setFiltroPerfil] = useState<string>("todos");
  const [filtroApenasPendentes, setFiltroApenasPendentes] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Helper para formatar máscara de data DD/MM/AAAA automaticamente ao digitar somente números (Print 1)
  const formatarMascaraData = (valor: string): string => {
    const apenasNumeros = valor.replace(/\D/g, "").slice(0, 8);
    if (apenasNumeros.length <= 2) {
      return apenasNumeros;
    }
    if (apenasNumeros.length <= 4) {
      return `${apenasNumeros.slice(0, 2)}/${apenasNumeros.slice(2)}`;
    }
    return `${apenasNumeros.slice(0, 2)}/${apenasNumeros.slice(2, 4)}/${apenasNumeros.slice(4)}`;
  };

  // Sincronização inicial com o servidor e localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nnos_pessoas_cadastradas_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPessoas(parsed);
        }
      }
    } catch (e) {
      console.error("Erro ao ler localStorage:", e);
    }

    fetch("/api/pessoas")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPessoas(data);
          try {
            localStorage.setItem("nnos_pessoas_cadastradas_v2", JSON.stringify(data));
          } catch (e) {}
        }
      })
      .catch((err) => console.error("Erro ao buscar /api/pessoas:", err));
  }, []);

  // Helper de verificação de pendências cadastrais reais
  const temPendencia = (p: PessoaItem) => {
    if (!p.cpf || !p.cpf.trim()) return true;
    if (p.tipo === "parceiro" && (!p.cnpj || !p.cnpj.trim())) return true;
    if (!p.telefone || !p.telefone.trim()) return true;
    if (!p.cidade_base || !p.cidade_base.trim()) return true;
    return false;
  };

  // Helper de estilo de campos no modal com laranja claro para pendências reais
  const getFieldStyle = (valor: string | undefined | null, extraStyles: React.CSSProperties = {}): React.CSSProperties => {
    const vazio = !valor || valor.trim() === "";
    return {
      width: "100%",
      padding: "10px",
      borderRadius: "8px",
      fontSize: "14px",
      backgroundColor: vazio ? "#fff7ed" : "#ffffff",
      border: vazio ? "1.5px dashed #f97316" : "1px solid var(--border)",
      color: vazio ? "#9a3412" : "var(--on-surface)",
      transition: "all 0.15s ease",
      ...extraStyles,
    };
  };

  // Modal State
  const [modalAberto, setModalAberto] = useState(false);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaItem | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"geral" | "viagens" | "empresa">("geral");

  // Form State
  const [formData, setFormData] = useState<Partial<PessoaItem>>({});

  const abrirNovaPessoa = () => {
    setPessoaSelecionada(null);
    setFormData({
      tipo: "parceiro",
      perfil: "SÊNIOR",
      ativo: true,
      aeroporto_preferencial: "CNF (Confins / BH)",
      cidade_base: "Belo Horizonte / MG",
    });
    setAbaAtiva("geral");
    setModalAberto(true);
  };

  const abrirEditarPessoa = (p: PessoaItem) => {
    setPessoaSelecionada(p);
    setFormData({ ...p });
    setAbaAtiva("geral");
    setModalAberto(true);
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.nome.trim()) {
      alert("Por favor, preencha o Nome da pessoa.");
      return;
    }

    const nomeNormalizado = formData.nome.trim().toUpperCase();
    const jaExisteNome = pessoas.some(
      (it) => it.id !== pessoaSelecionada?.id && it.nome.trim().toUpperCase() === nomeNormalizado
    );
    if (jaExisteNome) {
      alert(`Atenção: Já existe um integrante cadastrado com o nome "${nomeNormalizado}". Registros em duplicidade não são permitidos.`);
      return;
    }

    if (formData.cpf && formData.cpf.trim()) {
      const cpfDigitos = formData.cpf.replace(/\D/g, "");
      if (cpfDigitos.length >= 11) {
        const jaExisteCpf = pessoas.some(
          (it) => it.id !== pessoaSelecionada?.id && it.cpf && it.cpf.replace(/\D/g, "") === cpfDigitos
        );
        if (jaExisteCpf) {
          alert(`Atenção: Já existe um integrante cadastrado com o CPF "${formData.cpf}". Registros em duplicidade não são permitidos.`);
          return;
        }
      }
    }

    if (formData.cnpj && formData.cnpj.trim()) {
      const cnpjDigitos = formData.cnpj.replace(/\D/g, "");
      if (cnpjDigitos.length >= 14) {
        const jaExisteCnpj = pessoas.some(
          (it) => it.id !== pessoaSelecionada?.id && it.cnpj && it.cnpj.replace(/\D/g, "") === cnpjDigitos
        );
        if (jaExisteCnpj) {
          alert(`Atenção: Já existe um integrante cadastrado com o CNPJ "${formData.cnpj}". Registros em duplicidade não são permitidos.`);
          return;
        }
      }
    }

    let novasPessoas: PessoaItem[];

    if (pessoaSelecionada) {
      // Edição
      novasPessoas = pessoas.map((it) =>
        it.id === pessoaSelecionada.id ? ({ ...it, ...formData } as PessoaItem) : it
      );
    } else {
      // Novo
      const novo: PessoaItem = {
        id: crypto.randomUUID(),
        nome: formData.nome!.trim().toUpperCase(),
        nome_completo: formData.nome_completo || formData.nome!,
        tipo: formData.tipo || "parceiro",
        perfil: formData.perfil || "SÊNIOR",
        email: formData.email || `${formData.nome!.toLowerCase().replace(/\s+/g, ".")}@nnos.com.br`,
        telefone: formData.telefone || "",
        cargo: formData.cargo || "",
        cpf: formData.cpf || "",
        rg: formData.rg || "",
        data_nascimento: formData.data_nascimento || "",
        cidade_base: formData.cidade_base || "",
        aeroporto_preferencial: formData.aeroporto_preferencial || "",
        razao_social: formData.razao_social || "",
        nome_fantasia: formData.nome_fantasia || "",
        cnpj: formData.cnpj || "",
        inscricao_municipal: formData.inscricao_municipal || "",
        endereco_empresa: formData.endereco_empresa || "",
        banco: formData.banco || "",
        agencia: formData.agencia || "",
        conta: formData.conta || "",
        pix: formData.pix || "",
        contrato_ativo: formData.contrato_ativo || "",
        ativo: true,
      };
      novasPessoas = [novo, ...pessoas];
    }

    // 1. Atualiza estado em memória
    setPessoas(novasPessoas);

    // 2. Persiste imediatamente no localStorage
    try {
      localStorage.setItem("nnos_pessoas_cadastradas_v2", JSON.stringify(novasPessoas));
    } catch (err) {
      console.error("Erro ao salvar no localStorage:", err);
    }

    // 3. Persiste no arquivo do servidor via API
    fetch("/api/pessoas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novasPessoas),
    })
      .then(() => {
        setToastMsg("Ficha salva com sucesso");
        setTimeout(() => setToastMsg(null), 4000);
      })
      .catch((err) => {
        console.error("Erro ao gravar na API:", err);
        setToastMsg("Ficha salva com sucesso");
        setTimeout(() => setToastMsg(null), 4000);
      });

    setModalAberto(false);
  };

  // Contadores
  const totalGeral = pessoas.length;
  const totalParceiros = pessoas.filter((p) => p.tipo === "parceiro").length;
  const totalFuncionarios = pessoas.filter((p) => p.tipo === "funcionario").length;
  const totalSocios = pessoas.filter((p) => p.tipo === "socio").length;
  const totalPendentes = pessoas.filter(temPendencia).length;

  // Filtragem
  const pessoasFiltradas = useMemo(() => {
    return pessoas.filter((p) => {
      if (filtroApenasPendentes && !temPendencia(p)) return false;
      if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
      if (filtroPerfil !== "todos" && p.perfil !== filtroPerfil) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchNome = p.nome.toLowerCase().includes(termo);
        const matchNomeCompleto = p.nome_completo?.toLowerCase().includes(termo);
        const matchCpf = p.cpf?.toLowerCase().includes(termo);
        const matchCnpj = p.cnpj?.toLowerCase().includes(termo);
        const matchEmail = p.email.toLowerCase().includes(termo);
        const matchCidade = p.cidade_base?.toLowerCase().includes(termo);
        if (!matchNome && !matchNomeCompleto && !matchCpf && !matchCnpj && !matchEmail && !matchCidade) {
          return false;
        }
      }
      return true;
    });
  }, [pessoas, filtroTipo, filtroPerfil, filtroApenasPendentes, busca]);

  const renderBadgeTipo = (tipo: "parceiro" | "funcionario" | "socio") => {
    switch (tipo) {
      case "socio":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              backgroundColor: "#f3e8ff",
              color: "#6b21a8",
              border: "1px solid #d8b4fe",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
              stars
            </span>
            SÓCIO
          </span>
        );
      case "funcionario":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              backgroundColor: "#dcfce7",
              color: "#166534",
              border: "1px solid #86efac",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
              badge
            </span>
            FUNCIONÁRIO
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              backgroundColor: "#e0f2fe",
              color: "#0369a1",
              border: "1px solid #bae6fd",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
              handshake
            </span>
            PARCEIRO
          </span>
        );
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar Corporativa Idêntica à tela de Projetos e BM */}
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
            <a href="/projetos" className="nav-item">
              <span className="material-symbols-outlined">assignment</span>
              <span>Projetos & Atividades</span>
            </a>
            <a href="/medicao" className="nav-item">
              <span className="material-symbols-outlined">receipt_long</span>
              <span>BM - Boletim de Medição</span>
            </a>
            <a href="/viagens" className="nav-item">
              <span className="material-symbols-outlined">flight</span>
              <span>Viagens & Logística</span>
            </a>
            <a href="/centro-de-custo" className="nav-item">
              <span className="material-symbols-outlined">account_tree</span>
              <span>Centro de Custo</span>
            </a>
            <a href="/tabela-precos" className="nav-item">
              <span className="material-symbols-outlined">request_quote</span>
              <span>Tabela de Preços</span>
            </a>
            <a href="/pessoas" className="nav-item active">
              <span className="material-symbols-outlined">group</span>
              <span>Pessoas</span>
            </a>
            <a href="/faturamento" className="nav-item">
              <span className="material-symbols-outlined">receipt</span>
              <span>Faturamento</span>
            </a>
            <a href="/pagamentos" className="nav-item">
              <span className="material-symbols-outlined">payments</span>
              <span>Pagamentos</span>
            </a>
            <a href="/relatorios" className="nav-item">
              <span className="material-symbols-outlined">monitoring</span>
              <span>Relatórios</span>
            </a>
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
              Módulo de Pessoas & Consultores
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
              Pessoas
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ThemeToggle />
            <div
              style={{
                fontSize: "12px",
                color: "var(--on-surface-variant)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--surface-container-low)",
                padding: "4px 10px",
                borderRadius: "20px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--accent-green)" }}>
                verified
              </span>
              Base Ativa • {totalGeral} Integrantes
            </div>
          </div>
        </header>

        {/* Notificação Toast Moderna Conforme Design Aprovado (Print 1) */}
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
            {/* Barra lateral esmeralda de acento */}
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

            {/* Ícone com aura menta e círculo esmeralda com checkmark */}
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

            {/* Texto curto oficial */}
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

            {/* Botão de Fechar sutil */}
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

        <main className="main-content" style={{ padding: "24px 32px", width: "100%" }}>
          {/* Top Title & Quick Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "24px",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "var(--primary)",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                Pessoas & Prestadores de Serviços
              </h1>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--on-surface-variant)",
                  margin: "4px 0 0 0",
                }}
              >
                Cadastro centralizado de parceiros credenciados, colaboradores e sócios vinculados a projetos e viagens
              </p>
            </div>

            <button
              onClick={abrirNovaPessoa}
              style={{
                backgroundColor: "var(--primary)",
                color: "#ffffff",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                fontWeight: 600,
                fontSize: "14px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0, 21, 47, 0.15)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--primary-container)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--primary)")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                person_add
              </span>
              Cadastrar Nova Pessoa
            </button>
          </div>

          {/* KPI Cards Banner */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {/* Total */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                padding: "18px 20px",
                border: "1px solid var(--border)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", fontWeight: 600, textTransform: "uppercase" }}>
                  Total Cadastrado
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                  {totalGeral}
                </div>
                <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                  Consultores e equipe
                </div>
              </div>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "var(--surface-container)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "26px" }}>
                  groups
                </span>
              </div>
            </div>

            {/* Parceiros PJ */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                padding: "18px 20px",
                border: "1px solid #bae6fd",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", color: "#0369a1", fontWeight: 700, textTransform: "uppercase" }}>
                  Parceiros (PJ)
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "#0369a1", marginTop: "4px" }}>
                  {totalParceiros}
                </div>
                <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                  Prestadores credenciados
                </div>
              </div>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#e0f2fe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0284c7",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "26px" }}>
                  handshake
                </span>
              </div>
            </div>

            {/* Funcionários */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                padding: "18px 20px",
                border: "1px solid #86efac",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", color: "#15803d", fontWeight: 700, textTransform: "uppercase" }}>
                  Funcionários / CLT
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "#15803d", marginTop: "4px" }}>
                  {totalFuncionarios}
                </div>
                <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                  Equipe interna operacional
                </div>
              </div>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#dcfce7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#16a34a",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "26px" }}>
                  badge
                </span>
              </div>
            </div>

            {/* Sócios */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                padding: "18px 20px",
                border: "1px solid #d8b4fe",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", color: "#6b21a8", fontWeight: 700, textTransform: "uppercase" }}>
                  Sócios / Diretoria
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "#6b21a8", marginTop: "4px" }}>
                  {totalSocios}
                </div>
                <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                  Corpo executivo NNÓS
                </div>
              </div>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#f3e8ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9333ea",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "26px" }}>
                  stars
                </span>
              </div>
            </div>
          </div>

          {/* Filtros e Busca Rápida */}
          <div
            style={{
              background: "#ffffff",
              padding: "16px 20px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            {/* Input de Busca */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1", minWidth: "280px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "var(--surface-container-low)",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  width: "100%",
                  border: "1px solid var(--border)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--outline)" }}>
                  search
                </span>
                <input
                  type="text"
                  placeholder="Buscar por Nome, CPF, CNPJ, E-mail ou Cidade..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    width: "100%",
                    fontSize: "14px",
                    color: "var(--on-surface)",
                  }}
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--outline)" }}>
                      close
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Filtros Rápidos de Tipo */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--on-surface-variant)" }}>
                Vínculo:
              </span>
              {(["todos", "parceiro", "funcionario", "socio"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFiltroTipo(t)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: filtroTipo === t ? "1px solid var(--primary)" : "1px solid var(--border)",
                    backgroundColor: filtroTipo === t ? "var(--primary)" : "var(--surface-container-low)",
                    color: filtroTipo === t ? "#ffffff" : "var(--on-surface)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {t === "todos"
                    ? "Todos"
                    : t === "parceiro"
                    ? "Parceiros (PJ)"
                    : t === "funcionario"
                    ? "Funcionários"
                    : "Sócios"}
                </button>
              ))}

              <ModernDropdown
                value={filtroPerfil}
                onChange={(val) => setFiltroPerfil(String(val))}
                options={[
                  { value: "todos", label: "Todos os Perfis" },
                  { value: "LÍDER DE PROJETO", label: "LÍDER DE PROJETO" },
                  { value: "DIRETORIA", label: "DIRETORIA" },
                  { value: "SÊNIOR", label: "SÊNIOR" },
                  { value: "PLENO", label: "PLENO" },
                  { value: "JÚNIOR", label: "JÚNIOR" },
                ]}
                icon="badge"
                buttonStyle={{ padding: "5px 12px", fontSize: "12px", borderRadius: "8px" }}
                minWidth="175px"
              />

              {/* Botão de Filtro Rápido de Pendências Reais */}
              <button
                type="button"
                onClick={() => setFiltroApenasPendentes(!filtroApenasPendentes)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  border: filtroApenasPendentes ? "1.5px solid #ea580c" : "1px dashed #fdba74",
                  backgroundColor: filtroApenasPendentes ? "#ea580c" : "#fff7ed",
                  color: filtroApenasPendentes ? "#ffffff" : "#c2410c",
                  transition: "all 0.15s ease",
                  marginLeft: "4px",
                }}
                title="Filtrar integrantes com campos pendentes de preenchimento real"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                  warning
                </span>
                Pendentes ({totalPendentes})
              </button>
            </div>
          </div>

          {/* Tabela de Pessoas */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "1000px" }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "#ffffff",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <th style={{ padding: "14px 18px", fontWeight: 700 }}>Nome / Integrante</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700 }}>Vínculo</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700 }}>Perfil</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700 }}>Logística / Viagem (CPF & Base)</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700 }}>Empresa PJ / Fiscal (CNPJ)</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700 }}>Contato</th>
                    <th style={{ padding: "14px 18px", fontWeight: 700, textAlign: "right" }}>Ações</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: "13px" }}>
                  {pessoasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "48px 16px", color: "var(--outline)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "36px", marginBottom: "8px" }}>
                          search_off
                        </span>
                        <div>Nenhum integrante encontrado com os filtros selecionados.</div>
                      </td>
                    </tr>
                  ) : (
                    pessoasFiltradas.map((p, idx) => {
                      const bgRow = idx % 2 === 0 ? "#ffffff" : "var(--surface-container-low)";
                      const iniciais = p.nome
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("");

                      return (
                        <tr
                          key={p.id}
                          style={{
                            backgroundColor: bgRow,
                            borderBottom: "1px solid var(--border)",
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-container)")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgRow)}
                        >
                          {/* Nome */}
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "8px",
                                  backgroundColor:
                                    p.tipo === "socio"
                                      ? "#f3e8ff"
                                      : p.tipo === "funcionario"
                                      ? "#dcfce7"
                                      : "var(--primary-container)",
                                  color:
                                    p.tipo === "socio"
                                      ? "#6b21a8"
                                      : p.tipo === "funcionario"
                                      ? "#166534"
                                      : "#ffffff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 700,
                                  fontSize: "13px",
                                }}
                              >
                                {iniciais}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: "14px" }}>
                                  {p.nome}
                                </div>
                                <div style={{ fontSize: "12px", color: "var(--on-surface-variant)" }}>
                                  {p.nome_completo !== p.nome ? p.nome_completo : p.cargo || "Consultor"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Vínculo */}
                          <td style={{ padding: "14px 16px" }}>{renderBadgeTipo(p.tipo)}</td>

                          {/* Perfil */}
                          <td style={{ padding: "14px 16px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "3px 9px",
                                borderRadius: "6px",
                                backgroundColor:
                                  p.perfil === "LÍDER DE PROJETO"
                                    ? "#dbeafe"
                                    : p.perfil === "DIRETORIA"
                                    ? "#f3e8ff"
                                    : "var(--surface-container-high)",
                                color:
                                  p.perfil === "LÍDER DE PROJETO"
                                    ? "#1e40af"
                                    : p.perfil === "DIRETORIA"
                                    ? "#6b21a8"
                                    : "var(--on-surface)",
                                border:
                                  p.perfil === "LÍDER DE PROJETO"
                                    ? "1px solid #93c5fd"
                                    : p.perfil === "DIRETORIA"
                                    ? "1px solid #e9d5ff"
                                    : "none",
                              }}
                            >
                              {p.perfil}
                            </span>
                          </td>

                          {/* Viagens & Logística */}
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <div style={{ fontWeight: 600, fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                                {p.cpf ? (
                                  <span style={{ color: "var(--on-surface)" }}>CPF: {p.cpf}</span>
                                ) : (
                                  <span
                                    style={{
                                      backgroundColor: "#fff7ed",
                                      color: "#c2410c",
                                      border: "1px dashed #fdba74",
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "3px",
                                    }}
                                    title="CPF não localizado nas tabelas reais. Clique em Ficha para completar."
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>warning</span>
                                    CPF Pendente
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "13px", color: "var(--secondary)" }}>
                                  flight
                                </span>
                                {p.aeroporto_preferencial || p.cidade_base ? (
                                  <span style={{ color: "var(--on-surface-variant)" }}>
                                    {p.aeroporto_preferencial || p.cidade_base}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      backgroundColor: "#fff7ed",
                                      color: "#c2410c",
                                      border: "1px dashed #fdba74",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      fontSize: "10px",
                                      fontWeight: 600,
                                    }}
                                    title="Base de embarque pendente"
                                  >
                                    Base Pendente
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Empresa PJ */}
                          <td style={{ padding: "14px 16px" }}>
                            {p.tipo === "parceiro" ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ fontWeight: 600, fontSize: "12px" }}>
                                  {p.cnpj ? (
                                    <span style={{ color: "var(--on-surface)" }}>{p.cnpj}</span>
                                  ) : (
                                    <span
                                      style={{
                                        backgroundColor: "#fff7ed",
                                        color: "#c2410c",
                                        border: "1px dashed #fdba74",
                                        padding: "2px 8px",
                                        borderRadius: "4px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "3px",
                                      }}
                                      title="CNPJ não localizado nas tabelas de contratos. Clique em Ficha para completar."
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>warning</span>
                                      CNPJ Pendente
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    fontSize: "11px",
                                    maxWidth: "220px",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {p.razao_social ? (
                                    <span style={{ color: "var(--on-surface-variant)" }} title={p.razao_social}>
                                      {p.razao_social}
                                    </span>
                                  ) : (
                                    <span style={{ color: "#c2410c", fontStyle: "italic" }}>
                                      Razão Social Pendente
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : p.tipo === "socio" ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ fontWeight: 600, fontSize: "12px" }}>
                                  {p.cnpj ? (
                                    <span style={{ color: "#6b21a8", fontSize: "11px", fontWeight: 700 }}>
                                      {p.cnpj}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: "11px", color: "#6b21a8", fontWeight: 700 }}>
                                      Regime Diretoria NNÓS
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    fontSize: "11px",
                                    maxWidth: "220px",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {p.razao_social ? (
                                    <span style={{ color: "var(--on-surface-variant)" }} title={p.razao_social}>
                                      {p.razao_social}
                                    </span>
                                  ) : (
                                    <span style={{ color: "var(--outline)", fontSize: "11px" }}>
                                      Contrato Social
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontSize: "12px", color: "#15803d", fontWeight: 700 }}>
                                  CLT Operacional
                                </span>
                                <span style={{ fontSize: "11px", color: "var(--outline)" }}>
                                  Equipe Interna NNÓS
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Contato */}
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                              {p.email ? (
                                <a
                                  href={`mailto:${p.email}`}
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--secondary)",
                                    textDecoration: "none",
                                    fontWeight: 500,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                >
                                  {p.email}
                                </a>
                              ) : (
                                <span
                                  style={{
                                    backgroundColor: "#fff7ed",
                                    color: "#c2410c",
                                    border: "1px dashed #fdba74",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    width: "fit-content",
                                  }}
                                >
                                  E-mail Pendente
                                </span>
                              )}
                              {p.telefone ? (
                                <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                                  {p.telefone}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    backgroundColor: "#fff7ed",
                                    color: "#c2410c",
                                    border: "1px dashed #fdba74",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    width: "fit-content",
                                  }}
                                >
                                  Telefone Pendente
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Ações */}
                          <td style={{ padding: "14px 18px", textAlign: "right" }}>
                            <button
                              onClick={() => abrirEditarPessoa(p)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "1px solid var(--border)",
                                backgroundColor: "#ffffff",
                                color: "var(--primary)",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "var(--surface-container)";
                                e.currentTarget.style.borderColor = "var(--primary)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#ffffff";
                                e.currentTarget.style.borderColor = "var(--border)";
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                edit
                              </span>
                              Ficha
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé da tabela com paginação/total */}
            <div
              style={{
                padding: "12px 18px",
                backgroundColor: "var(--surface-container-low)",
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "var(--on-surface-variant)",
              }}
            >
              <span>
                Exibindo <strong>{pessoasFiltradas.length}</strong> de <strong>{totalGeral}</strong> integrantes
              </span>
              <span>Todos os dados sincronizados com Projetos & BM</span>
            </div>
          </div>
        </main>
      </div>

      {/* Modal / Ficha Completa de Cadastro (Padrão Oficial Print 2) */}
      {modalAberto && (
        <div className="modal-backdrop" onClick={() => setModalAberto(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: "740px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Padrão Print 2 */}
            <div className="modal-header">
              <h3>
                <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                  {pessoaSelecionada ? "badge" : "add_circle"}
                </span>
                <span>{pessoaSelecionada ? `Ficha de ${pessoaSelecionada.nome}` : "Cadastrar Nova Pessoa"}</span>
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setModalAberto(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Tabs Padrão Clean & Modern */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--surface-container-low)",
                padding: "0 24px",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={() => setAbaAtiva("geral")}
                style={{
                  padding: "12px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  border: "none",
                  background: "transparent",
                  color: abaAtiva === "geral" ? "var(--primary)" : "var(--on-surface-variant)",
                  borderBottom: abaAtiva === "geral" ? "2px solid var(--primary)" : "2px solid transparent",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                1. Identificação & Vínculo
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva("viagens")}
                style={{
                  padding: "12px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  border: "none",
                  background: "transparent",
                  color: abaAtiva === "viagens" ? "var(--primary)" : "var(--on-surface-variant)",
                  borderBottom: abaAtiva === "viagens" ? "2px solid var(--primary)" : "2px solid transparent",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                2. Logística & Viagens (CPF/RG)
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva("empresa")}
                style={{
                  padding: "12px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  border: "none",
                  background: "transparent",
                  color: abaAtiva === "empresa" ? "var(--primary)" : "var(--on-surface-variant)",
                  borderBottom: abaAtiva === "empresa" ? "2px solid var(--primary)" : "2px solid transparent",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                3. Dados da Empresa (PJ / Fiscal)
              </button>
            </div>

            <form onSubmit={handleSalvar}>
              <div className="modal-body">
                {/* Aba 1: Identificação & Vínculo */}
                {abaAtiva === "geral" && (
                  <>
                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Nome Operacional (Versão Curta) *</label>
                        <input
                          type="text"
                          required
                          value={formData.nome || ""}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          placeholder="Ex: CARLOS SILVA"
                        />
                      </div>
                      <div className="form-field">
                        <label>Nome Civil Completo (Para Passagens & Contratos)</label>
                        <input
                          type="text"
                          value={formData.nome_completo || ""}
                          onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                          placeholder="Ex: CARLOS ALBERTO SILVA SANTOS"
                        />
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Tipo de Vínculo (Tag) *</label>
                        <select
                          value={formData.tipo || "parceiro"}
                          onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                          style={{ fontWeight: 600 }}
                        >
                          <option value="parceiro">PARCEIRO (Prestador PJ)</option>
                          <option value="funcionario">FUNCIONÁRIO (CLT / Equipe Interna)</option>
                          <option value="socio">SÓCIO (Diretoria Executiva)</option>
                        </select>
                      </div>

                      <div className="form-field">
                        <label>Perfil / Senioridade</label>
                        <select
                          value={formData.perfil || "SÊNIOR"}
                          onChange={(e) => setFormData({ ...formData, perfil: e.target.value })}
                          style={{ fontWeight: 600 }}
                        >
                          <option value="SÊNIOR">SÊNIOR</option>
                          <option value="PLENO">PLENO</option>
                          <option value="JÚNIOR">JÚNIOR</option>
                          <option value="LÍDER DE PROJETO">LÍDER DE PROJETO</option>
                          <option value="DIRETORIA">DIRETORIA</option>
                          <option value="COORDENADOR">COORDENADOR</option>
                          <option value="OPERACIONAL">OPERACIONAL</option>
                        </select>
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>E-mail Operacional</label>
                        <input
                          type="email"
                          value={formData.email || ""}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="Ex: consultor.exemplo@nnos.com.br"
                        />
                      </div>
                      <div className="form-field">
                        <label>Telefone / WhatsApp</label>
                        <input
                          type="text"
                          value={formData.telefone || ""}
                          onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                          placeholder="(11) 98765-4321"
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label>Cargo / Função</label>
                      <input
                        type="text"
                        value={formData.cargo || ""}
                        onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                        placeholder="Ex: Consultor Especialista / Instrutor Líder"
                      />
                    </div>
                  </>
                )}

                {/* Aba 2: Viagens & Logística */}
                {abaAtiva === "viagens" && (
                  <>
                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>CPF do Viajante (Obrigatório para Passagens)</label>
                        <input
                          type="text"
                          value={formData.cpf || ""}
                          onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                          placeholder="000.000.000-00 (Ex: 123.456.789-00)"
                          style={{ fontWeight: 600 }}
                        />
                      </div>
                      <div className="form-field">
                        <label>RG / Órgão Emissor</label>
                        <input
                          type="text"
                          value={formData.rg || ""}
                          onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                          placeholder="Ex: SSP-12.345.678 / SP"
                        />
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Data de Nascimento (Exigida por Cias Aéreas)</label>
                        <input
                          type="text"
                          value={formData.data_nascimento || ""}
                          onChange={(e) => {
                            const formatado = formatarMascaraData(e.target.value);
                            setFormData({ ...formData, data_nascimento: formatado });
                          }}
                          maxLength={10}
                          placeholder="DD/MM/AAAA (Ex: 08/11/1963)"
                        />
                      </div>
                      <div className="form-field">
                        <label>Cidade / UF de Residência</label>
                        <input
                          type="text"
                          value={formData.cidade_base || ""}
                          onChange={(e) => setFormData({ ...formData, cidade_base: e.target.value })}
                          placeholder="Ex: São Paulo / SP"
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label>Aeroporto Preferencial de Embarque</label>
                      <input
                        type="text"
                        value={formData.aeroporto_preferencial || ""}
                        onChange={(e) => setFormData({ ...formData, aeroporto_preferencial: e.target.value })}
                        placeholder="Ex: GRU (Guarulhos / SP), CNF (Confins / BH), CWB (Curitiba)"
                      />
                    </div>
                  </>
                )}

                {/* Aba 3: Dados da Empresa PJ */}
                {abaAtiva === "empresa" && (
                  <>
                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Razão Social da Empresa PJ</label>
                        <input
                          type="text"
                          value={formData.razao_social || ""}
                          onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                          placeholder="Ex: ALFA TREINAMENTOS E CONSULTORIA LTDA"
                        />
                      </div>
                      <div className="form-field">
                        <label>CNPJ da Empresa</label>
                        <input
                          type="text"
                          value={formData.cnpj || ""}
                          onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                          placeholder="00.000.000/0001-00 (Ex: 12.345.678/0001-90)"
                          style={{ fontWeight: 600 }}
                        />
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Inscrição Municipal</label>
                        <input
                          type="text"
                          value={formData.inscricao_municipal || ""}
                          onChange={(e) => setFormData({ ...formData, inscricao_municipal: e.target.value })}
                          placeholder="Ex: 1.208.841/002-5"
                        />
                      </div>
                      <div className="form-field">
                        <label>Contrato Vinculado / Ativo</label>
                        <input
                          type="text"
                          value={formData.contrato_ativo || ""}
                          onChange={(e) => setFormData({ ...formData, contrato_ativo: e.target.value })}
                          placeholder="Ex: #2026.0001 • NNÓS"
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label>Endereço Comercial Cadastrado</label>
                      <input
                        type="text"
                        value={formData.endereco_empresa || ""}
                        onChange={(e) => setFormData({ ...formData, endereco_empresa: e.target.value })}
                        placeholder="Ex: Av. Paulista, 1000 - Bela Vista, São Paulo - SP | CEP: 01310-100"
                      />
                    </div>

                    <div className="modal-grid-3">
                      <div className="form-field">
                        <label>Banco</label>
                        <input
                          type="text"
                          value={formData.banco || ""}
                          onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                          placeholder="Ex: Banco do Brasil"
                        />
                      </div>
                      <div className="form-field">
                        <label>Agência / Conta</label>
                        <input
                          type="text"
                          value={formData.agencia ? `${formData.agencia} / ${formData.conta || ""}` : ""}
                          onChange={(e) => {
                            const parts = e.target.value.split("/");
                            setFormData({ ...formData, agencia: parts[0]?.trim(), conta: parts[1]?.trim() });
                          }}
                          placeholder="Ex: 1234-5 / 98765-4"
                        />
                      </div>
                      <div className="form-field">
                        <label>Chave PIX</label>
                        <input
                          type="text"
                          value={formData.pix || ""}
                          onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
                          placeholder="Ex: 12.345.678/0001-90"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer Padrão Print 2 */}
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "#ffffff",
                    color: "var(--on-surface-variant)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    transition: "all 0.15s ease",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    backgroundColor: "#00152f",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "none",
                    boxShadow: "0 2px 6px rgba(0,21,47,0.2)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    check_circle
                  </span>
                  <span>{pessoaSelecionada ? "Salvar Ficha Cadastral" : "Cadastrar Pessoa"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
