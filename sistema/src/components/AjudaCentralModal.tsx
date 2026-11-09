"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LISTA_PROCESSOS_AJUDA, ProcessoMenu } from "@/lib/ajuda-processos-base";

interface MensagemChat {
  id: string;
  autor: "usuario" | "ia";
  texto: string;
  rotaSugerida?: string;
  rotuloRota?: string;
  dataHora: string;
}

interface AjudaCentralModalProps {
  aberto: boolean;
  aoFechar: () => void;
  abaInicial?: "GUIA" | "IA";
}

// Processa texto inline para negrito (**texto**), itálico (*texto*) e código (`texto`)
function processarTrechosInline(texto: string): React.ReactNode[] {
  if (!texto) return [];

  const partes = texto.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return partes.map((parte, i) => {
    if (!parte) return null;

    if (parte.startsWith("***") && parte.endsWith("***") && parte.length >= 6) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: "inherit", fontStyle: "italic" }}>
          {parte.slice(3, -3)}
        </strong>
      );
    }

    if (parte.startsWith("**") && parte.endsWith("**") && parte.length >= 4) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: "inherit" }}>
          {parte.slice(2, -2)}
        </strong>
      );
    }

    if (parte.startsWith("`") && parte.endsWith("`") && parte.length >= 2) {
      return (
        <code
          key={i}
          style={{
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: "rgba(2, 132, 199, 0.08)",
            color: "#0284c7",
            fontFamily: "monospace",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {parte.slice(1, -1)}
        </code>
      );
    }

    if (parte.startsWith("*") && parte.endsWith("*") && parte.length >= 2) {
      return (
        <em key={i} style={{ fontStyle: "italic" }}>
          {parte.slice(1, -1)}
        </em>
      );
    }

    return parte;
  });
}

// Renderizador estruturado e visualmente polido do Chat de IA (Fiel ao design aprovado)
function ChatMessageContent({ texto }: { texto: string }) {
  if (!texto) return null;

  const linhas = texto.split("\n");
  const blocos: React.ReactNode[] = [];
  let listaNumeradaTemp: { num: string; conteudo: string }[] = [];

  const flushListaNumerada = (chaveBase: string) => {
    if (listaNumeradaTemp.length === 0) return;

    blocos.push(
      <div
        key={`box-passos-${chaveBase}`}
        style={{
          marginTop: "12px",
          marginBottom: "12px",
          padding: "14px 16px",
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            fontWeight: 800,
            color: "#0284c7",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
            format_list_bulleted
          </span>
          <span>PASSO A PASSO NO SISTEMA:</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {listaNumeradaTemp.map((item, idx) => (
            <div
              key={`item-${idx}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                fontSize: "12.5px",
                lineHeight: 1.5,
                color: "#334155",
              }}
            >
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "6px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#475569",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "1px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                {item.num}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {processarTrechosInline(item.conteudo)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
    listaNumeradaTemp = [];
  };

  linhas.forEach((linhaOriginal, index) => {
    const linha = linhaOriginal.trim();

    if (!linha) {
      flushListaNumerada(`blank-${index}`);
      return;
    }

    // Identifica itens numerados (ex: "1. Acesse o menu...")
    const matchNumerado = linha.match(/^(\d+)[\.\)]\s*(.*)$/);
    if (matchNumerado) {
      listaNumeradaTemp.push({
        num: matchNumerado[1],
        conteudo: matchNumerado[2],
      });
      return;
    }

    flushListaNumerada(`antes-${index}`);

    // Título H3 / Marcador ###
    if (linha.startsWith("###")) {
      const conteudo = linha.replace(/^###\s*/, "").replace(/^[📁📋💼🛫\s]+/, "");
      blocos.push(
        <div
          key={`h3-${index}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "8px",
            marginBottom: "8px",
            color: "#0f2a4a",
            fontWeight: 800,
            fontSize: "14px",
          }}
        >
          <span className="material-symbols-outlined" style={{ color: "#0284c7", fontSize: "18px" }}>
            article
          </span>
          <span>{processarTrechosInline(conteudo)}</span>
        </div>
      );
      return;
    }

    // Card de Dica / Aviso (ex: "> Dica: ...")
    if (linha.startsWith(">")) {
      const conteudo = linha.replace(/^>\s*/, "").replace(/^[*_]+Dica:[*_]+\s*/i, "");
      blocos.push(
        <div
          key={`quote-${index}`}
          style={{
            margin: "10px 0",
            padding: "10px 14px",
            borderRadius: "10px",
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <span className="material-symbols-outlined" style={{ color: "#d97706", fontSize: "17px", marginTop: "1px" }}>
            lightbulb
          </span>
          <div style={{ fontSize: "12px", color: "#78350f", lineHeight: 1.5, fontWeight: 500 }}>
            <strong style={{ fontWeight: 700, color: "#92400e" }}>Dica: </strong>
            {processarTrechosInline(conteudo)}
          </div>
        </div>
      );
      return;
    }

    // Parágrafo regular
    blocos.push(
      <p
        key={`p-${index}`}
        style={{
          margin: "4px 0",
          fontSize: "13px",
          lineHeight: 1.6,
          color: "#334155",
        }}
      >
        {processarTrechosInline(linha)}
      </p>
    );
  });

  flushListaNumerada("final");

  return <div>{blocos}</div>;
}

export default function AjudaCentralModal({
  aberto,
  aoFechar,
  abaInicial = "GUIA",
}: AjudaCentralModalProps) {
  const [mounted, setMounted] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"GUIA" | "IA">(abaInicial);
  const [termoBusca, setTermoBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<"TODOS" | "Operacional" | "Financeiro" | "Gestão">("TODOS");
  const [menuSelecionadoId, setMenuSelecionadoId] = useState<string>("projetos");

  // Estado do Chat de IA
  const [historicoChat, setHistoricoChat] = useState<MensagemChat[]>([
    {
      id: "msg-bem-vindo",
      autor: "ia",
      texto: `Olá! Sou o **Agente de Inteligência Artificial da NNÓS Consultoria**.

Estou aqui para orientar você no uso de qualquer tela, fluxo financeiro, operacional ou regra de negócio do sistema.

Você pode clicar em uma das sugestões abaixo ou digitar sua dúvida!`,
      dataHora: "13:22",
    },
  ]);
  const [inputPergunta, setInputPergunta] = useState("");
  const [carregandoIA, setCarregandoIA] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setAbaAtiva(abaInicial);
  }, [abaInicial]);

  // Rolar para a última mensagem do chat
  useEffect(() => {
    if (abaAtiva === "IA") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [historicoChat, abaAtiva]);

  // Fechar com a tecla ESC e atalho Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aberto) {
        aoFechar();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k" && aberto && abaAtiva === "GUIA") {
        e.preventDefault();
        const searchInput = document.getElementById("input-busca-modulos");
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aberto, aoFechar, abaAtiva]);

  if (!mounted || !aberto) return null;

  // Filtragem dos menus de processos
  const processosFiltrados = LISTA_PROCESSOS_AJUDA.filter((p) => {
    // Filtro por categoria
    if (categoriaFiltro === "Operacional" && p.categoria !== "Operacional") return false;
    if (categoriaFiltro === "Financeiro" && p.categoria !== "Financeiro") return false;
    if (categoriaFiltro === "Gestão" && p.categoria !== "Gestão & Diretoria" && p.categoria !== "Segurança") return false;

    // Filtro por termo de busca
    if (!termoBusca.trim()) return true;
    const t = termoBusca.toLowerCase();
    return (
      p.menuNome.toLowerCase().includes(t) ||
      (p.subtitulo && p.subtitulo.toLowerCase().includes(t)) ||
      p.descricaoGeral.toLowerCase().includes(t) ||
      p.categoria.toLowerCase().includes(t) ||
      p.passos.some((step) => step.titulo.toLowerCase().includes(t) || step.descricao.toLowerCase().includes(t)) ||
      p.regrasImportantes.some((r) => r.toLowerCase().includes(t)) ||
      p.faq.some((f) => f.pergunta.toLowerCase().includes(t) || f.resposta.toLowerCase().includes(t))
    );
  });

  const menuAtual: ProcessoMenu =
    LISTA_PROCESSOS_AJUDA.find((p) => p.id === menuSelecionadoId) ||
    processosFiltrados[0] ||
    LISTA_PROCESSOS_AJUDA[0];

  // Envio de pergunta para o Agente de IA
  const handleEnviarPergunta = async (textoPersonalizado?: string) => {
    const texto = (textoPersonalizado || inputPergunta).trim();
    if (!texto || carregandoIA) return;

    const agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const novaMsgUsuario: MensagemChat = {
      id: `usr-${Date.now()}`,
      autor: "usuario",
      texto,
      dataHora: agora,
    };

    setHistoricoChat((prev) => [...prev, novaMsgUsuario]);
    setInputPergunta("");
    setCarregandoIA(true);

    try {
      const res = await fetch("/api/ajuda/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pergunta: texto,
          historico: historicoChat.slice(-6).map((m) => ({
            role: m.autor === "usuario" ? "user" : "model",
            texto: m.texto,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const novaMsgIA: MensagemChat = {
          id: `ia-${Date.now()}`,
          autor: "ia",
          texto: data.resposta || "Não consegui obter uma resposta para essa pergunta no momento.",
          rotaSugerida: data.rotaSugerida,
          rotuloRota: data.rotuloRota,
          dataHora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        };
        setHistoricoChat((prev) => [...prev, novaMsgIA]);
      } else {
        throw new Error("Erro na resposta");
      }
    } catch {
      const msgErro: MensagemChat = {
        id: `ia-err-${Date.now()}`,
        autor: "ia",
        texto:
          "Ocorreu uma instabilidade momentânea na conexão. Por favor, consulte os tópicos detalhados na aba **Guia de Processos** acima ou tente novamente.",
        dataHora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setHistoricoChat((prev) => [...prev, msgErro]);
    } finally {
      setCarregandoIA(false);
    }
  };

  const sugestoesRapidas = [
    "Como emitir um Boletim de Medição (BM)?",
    "Como funciona a aprovação de Viagens & Logística?",
    "Como aplicar o acréscimo de 6% para Sócios?",
    "Onde consulto o Painel Financeiro por Líder?",
    "Como cadastrar um novo consultor parceiro PJ?",
  ];

  // Helper de cores por categoria de módulo
  const getCategoriaIconColors = (cat: string, id: string) => {
    if (id === "tabela-precos") return { bg: "#fef3c7", color: "#d97706", border: "#fde68a" };
    if (id === "relatorios") return { bg: "#e0e7ff", color: "#4f46e5", border: "#c7d2fe" };
    if (id === "centro-de-custo") return { bg: "#f3e8ff", color: "#9333ea", border: "#e9d5ff" };
    if (cat === "Financeiro") return { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" };
    if (cat === "Operacional") return { bg: "#f0f9ff", color: "#0284c7", border: "#bae6fd" };
    if (cat === "Consultoria") return { bg: "#f0f9ff", color: "#0284c7", border: "#bae6fd" };
    return { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
  };

  const modalConteudo = (
    <div
      onClick={aoFechar}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(7, 19, 34, 0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "1240px",
          height: "93vh",
          maxHeight: "890px",
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          boxShadow: "0 25px 60px -15px rgba(15, 42, 74, 0.35)",
          border: "1px solid rgba(226, 232, 240, 0.9)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ======================================================== */}
        {/* CABEÇALHO DO MODAL (Fiel ao Design do Usuário)            */}
        {/* ======================================================== */}
        <header
          style={{
            padding: "16px 28px",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            gap: "16px",
          }}
        >
          {/* Título, Ícone e Tag de Versão */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                position: "relative",
                width: "44px",
                height: "44px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, #0f2a4a 0%, #0369a1 50%, #0284c7 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.25)",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                menu_book
              </span>
              <span
                style={{
                  position: "absolute",
                  top: "-3px",
                  right: "-3px",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "#0ea5e9",
                  border: "2px solid #ffffff",
                }}
              />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1
                  style={{
                    fontSize: "17px",
                    fontWeight: 800,
                    color: "#0f2a4a",
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Central de Ajuda &amp; Agente de IA NNÓS
                </h1>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "2px 10px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 700,
                    backgroundColor: "#f0f9ff",
                    color: "#0284c7",
                    border: "1px solid #bae6fd",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#0284c7",
                    }}
                  />
                  v4.18 • Suporte Integrado
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                Mapeamento completo dos menus, passo a passo operacional e inteligência artificial para dúvidas.
              </p>
            </div>
          </div>

          {/* Segmented Control Tabs & Ação Fechar */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                display: "inline-flex",
                padding: "4px",
                backgroundColor: "#f1f5f9",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              {/* Aba 1: Guia de Processos */}
              <button
                type="button"
                onClick={() => setAbaAtiva("GUIA")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.15s ease",
                  backgroundColor: abaAtiva === "GUIA" ? "#0284c7" : "transparent",
                  color: abaAtiva === "GUIA" ? "#ffffff" : "#475569",
                  boxShadow: abaAtiva === "GUIA" ? "0 2px 6px rgba(2, 132, 199, 0.25)" : "none",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  menu_book
                </span>
                <span>Guia de Processos</span>
              </button>

              {/* Aba 2: Agente de IA NNÓS */}
              <button
                type="button"
                onClick={() => setAbaAtiva("IA")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.15s ease",
                  backgroundColor: abaAtiva === "IA" ? "#0b2545" : "transparent",
                  color: abaAtiva === "IA" ? "#ffffff" : "#475569",
                  boxShadow: abaAtiva === "IA" ? "0 2px 6px rgba(11, 37, 69, 0.25)" : "none",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1.5px",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src="/logo-coruja.png"
                    alt="NNÓS"
                    style={{ width: "13px", height: "13px", objectFit: "contain", display: "block" }}
                  />
                </div>
                <span>Agente de IA NNÓS</span>
              </button>
            </div>

            <div style={{ width: "1px", height: "24px", backgroundColor: "#e2e8f0" }} />

            {/* Botão Fechar */}
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar janela"
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Fechar (Esc)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                close
              </span>
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* CORPO DO MODAL: GUIA DE PROCESSOS OU AGENTE DE IA        */}
        {/* ======================================================== */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {abaAtiva === "GUIA" ? (
            /* ======================================================== */
            /* ABA 1: GUIA PASSO A PASSO (FIEL AO DESIGN DO MOCKUP)     */
            /* ======================================================== */
            <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
              {/* Barra Lateral Esquerda: Módulos Corporativos */}
              <aside
                style={{
                  width: "340px",
                  borderRight: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  flexShrink: 0,
                }}
              >
                {/* Campo de Busca Rápida */}
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        position: "absolute",
                        left: "10px",
                        fontSize: "18px",
                        color: "#94a3b8",
                        pointerEvents: "none",
                      }}
                    >
                      search
                    </span>
                    <input
                      id="input-busca-modulos"
                      type="text"
                      placeholder="Buscar módulos, regras ou telas..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 36px 8px 34px",
                        fontSize: "12px",
                        borderRadius: "10px",
                        border: "1px solid #e2e8f0",
                        backgroundColor: "#f8fafc",
                        color: "#0f2a4a",
                        outline: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: "8px",
                        padding: "2px 6px",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#94a3b8",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        pointerEvents: "none",
                      }}
                    >
                      ⌘K
                    </div>
                  </div>

                  {/* Pílulas de Filtro por Categoria */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro("TODOS")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: categoriaFiltro === "TODOS" ? 700 : 500,
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: categoriaFiltro === "TODOS" ? "#0f2a4a" : "#f1f5f9",
                        color: categoriaFiltro === "TODOS" ? "#ffffff" : "#475569",
                      }}
                    >
                      Todos ({LISTA_PROCESSOS_AJUDA.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro("Operacional")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: categoriaFiltro === "Operacional" ? 700 : 500,
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: categoriaFiltro === "Operacional" ? "#0f2a4a" : "#f1f5f9",
                        color: categoriaFiltro === "Operacional" ? "#ffffff" : "#475569",
                      }}
                    >
                      Operacional
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro("Financeiro")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: categoriaFiltro === "Financeiro" ? 700 : 500,
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: categoriaFiltro === "Financeiro" ? "#0f2a4a" : "#f1f5f9",
                        color: categoriaFiltro === "Financeiro" ? "#ffffff" : "#475569",
                      }}
                    >
                      Financeiro
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro("Gestão")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: categoriaFiltro === "Gestão" ? 700 : 500,
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: categoriaFiltro === "Gestão" ? "#0f2a4a" : "#f1f5f9",
                        color: categoriaFiltro === "Gestão" ? "#ffffff" : "#475569",
                      }}
                    >
                      Gestão
                    </button>
                  </div>
                </div>

                {/* Cabeçalho da Seção */}
                <div
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  <span>MÓDULOS CORPORATIVOS</span>
                  <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "lowercase", fontWeight: 600 }}>
                    {processosFiltrados.length} itens
                  </span>
                </div>

                {/* Lista Tátil dos Módulos */}
                <nav
                  aria-label="Lista de Menus"
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {processosFiltrados.map((proc) => {
                    const ativo = proc.id === menuAtual.id;
                    const catColors = getCategoriaIconColors(proc.categoria, proc.id);

                    return (
                      <button
                        key={proc.id}
                        type="button"
                        onClick={() => setMenuSelecionadoId(proc.id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: "12px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          backgroundColor: ativo ? "#f0f9ff" : "transparent",
                          border: ativo ? "1px solid #bae6fd" : "1px solid transparent",
                          color: ativo ? "#0369a1" : "#334155",
                          boxShadow: ativo ? "0 2px 6px rgba(2, 132, 199, 0.08)" : "none",
                        }}
                      >
                        {ativo && (
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: "5px",
                              height: "26px",
                              backgroundColor: "#0284c7",
                              borderTopRightRadius: "4px",
                              borderBottomRightRadius: "4px",
                            }}
                          />
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, paddingLeft: ativo ? "6px" : 0 }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "10px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              backgroundColor: ativo ? "#0284c7" : catColors.bg,
                              color: ativo ? "#ffffff" : catColors.color,
                              border: ativo ? "none" : `1px solid ${catColors.border}`,
                              boxShadow: ativo ? "0 2px 6px rgba(2, 132, 199, 0.3)" : "none",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "19px" }}>
                              {proc.icone}
                            </span>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "12.5px", fontWeight: ativo ? 700 : 600, color: "#0f2a4a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {proc.menuNome}
                            </div>
                            <div style={{ fontSize: "10.5px", color: ativo ? "#0284c7" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {proc.subtitulo || `${proc.passos.length} etapas no fluxo`}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "8px" }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "6px",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              backgroundColor: ativo ? "rgba(2, 132, 199, 0.15)" : catColors.bg,
                              color: ativo ? "#0369a1" : catColors.color,
                              border: `1px solid ${catColors.border}`,
                            }}
                          >
                            {proc.categoria.split(" ")[0]}
                          </span>
                          {ativo && (
                            <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#0284c7" }}>
                              arrow_forward
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {processosFiltrados.length === 0 && (
                    <div style={{ padding: "24px 12px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
                      Nenhum módulo encontrado para "{termoBusca}".
                    </div>
                  )}
                </nav>
              </aside>

              {/* Coluna da Direita: Visualização Detalhada do Passo a Passo (Main) */}
              <main
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  overflowY: "auto",
                  backgroundColor: "#ffffff",
                  padding: "32px 36px",
                }}
              >
                {/* Module Feature Header Banner */}
                <section style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "24px", marginBottom: "24px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "16px",
                          background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                          border: "1px solid #bae6fd",
                          color: "#0284c7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(2, 132, 199, 0.12)",
                          flexShrink: 0,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "26px" }}>
                          {menuAtual.icone}
                        </span>
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0f2a4a", margin: 0, letterSpacing: "-0.01em" }}>
                            {menuAtual.menuNome}
                          </h2>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              backgroundColor: "#f0f9ff",
                              color: "#0284c7",
                              border: "1px solid #bae6fd",
                            }}
                          >
                            Módulo Principal
                          </span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 600,
                              backgroundColor: "#f1f5f9",
                              color: "#475569",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            {menuAtual.categoria}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", color: "#94a3b8", marginLeft: "4px" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                              schedule
                            </span>
                            {menuAtual.tempoLeitura || `${Math.max(2, menuAtual.passos.length)} min de leitura`}
                          </span>
                        </div>

                        <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#475569", lineHeight: 1.6, maxWidth: "760px" }}>
                          {menuAtual.descricaoGeral}
                        </p>
                      </div>
                    </div>

                    {/* Botão de Ação Direto para o Módulo */}
                    <div style={{ flexShrink: 0 }}>
                      <Link
                        href={menuAtual.rota}
                        onClick={aoFechar}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 18px",
                          borderRadius: "12px",
                          backgroundColor: "#0284c7",
                          color: "#ffffff",
                          fontSize: "13px",
                          fontWeight: 700,
                          textDecoration: "none",
                          boxShadow: "0 2px 10px rgba(2, 132, 199, 0.25)",
                          transition: "all 0.15s ease",
                          cursor: "pointer",
                        }}
                      >
                        <span>Abrir Módulo de {menuAtual.menuNome.split(" - ")[0].split(" & ")[0]}</span>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          open_in_new
                        </span>
                      </Link>
                    </div>
                  </div>

                  {/* Metadata Pill Bar: Público Recomendado */}
                  <div
                    style={{
                      marginTop: "16px",
                      paddingTop: "14px",
                      borderTop: "1px solid #f8fafc",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                      fontSize: "12px",
                      color: "#64748b",
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0284c7" }}>
                        how_to_reg
                      </span>
                      Público recomendado:
                    </span>
                    {menuAtual.publicoAlvo.split(",").map((p, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: "3px 10px",
                          borderRadius: "20px",
                          backgroundColor: "#f1f5f9",
                          color: "#334155",
                          fontSize: "11.5px",
                          fontWeight: 500,
                        }}
                      >
                        {p.trim()}
                      </span>
                    ))}
                  </div>
                </section>

                {/* Stepper Timeline Section */}
                <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: "#0284c7",
                        }}
                      />
                      <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#0f2a4a", margin: 0 }}>
                        Trilha Operacional Passo a Passo
                      </h3>
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>
                      {menuAtual.passos.length} etapas sequenciais
                    </span>
                  </div>

                  {/* Stepper Container com Linha de Gradiente Contínua */}
                  <div
                    style={{
                      position: "relative",
                      paddingLeft: "36px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                    }}
                  >
                    {/* Linha vertical contínua conectando os nós */}
                    <div
                      style={{
                        position: "absolute",
                        left: "15px",
                        top: "16px",
                        bottom: "24px",
                        width: "2px",
                        background: "linear-gradient(to bottom, #0284c7 0%, #38bdf8 50%, #e2e8f0 100%)",
                      }}
                    />

                    {menuAtual.passos.map((passo) => (
                      <div key={passo.numero} style={{ position: "relative" }}>
                        {/* Stepper Node Circular */}
                        <div
                          style={{
                            position: "absolute",
                            left: "-36px",
                            top: "4px",
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#0284c7",
                            color: "#ffffff",
                            fontSize: "13px",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 8px rgba(2, 132, 199, 0.35)",
                            border: "3px solid #ffffff",
                            zIndex: 2,
                          }}
                        >
                          {passo.numero}
                        </div>

                        {/* Card do Passo */}
                        <div
                          style={{
                            backgroundColor: "#ffffff",
                            borderRadius: "16px",
                            border: "1px solid #e2e8f0",
                            padding: "18px 20px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                              marginBottom: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <h4 style={{ margin: 0, fontSize: "14.5px", fontWeight: 800, color: "#0f2a4a" }}>
                              {passo.titulo}
                            </h4>
                            {passo.tags && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                {passo.tags.map((tag, tIdx) => (
                                  <span
                                    key={tIdx}
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      fontSize: "10px",
                                      fontWeight: 600,
                                      backgroundColor: "#f1f5f9",
                                      color: "#475569",
                                      border: "1px solid #e2e8f0",
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.6 }}>
                            {passo.descricao}
                          </p>

                          {/* Widget Especial: Grade de Campos (Step 2 Projetos) */}
                          {passo.tipoEspecial === "campo-grid" && (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: "10px",
                                paddingTop: "12px",
                                marginTop: "12px",
                                borderTop: "1px solid #f1f5f9",
                              }}
                            >
                              <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                                <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 800, color: "#94a3b8", display: "block" }}>
                                  Localidade
                                </span>
                                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f2a4a" }}>
                                  Concessionária &amp; Cidade
                                </span>
                              </div>
                              <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                                <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 800, color: "#94a3b8", display: "block" }}>
                                  Período Previsto
                                </span>
                                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f2a4a" }}>
                                  Data Início e Término
                                </span>
                              </div>
                              <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                                <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 800, color: "#94a3b8", display: "block" }}>
                                  Carga Horária
                                </span>
                                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f2a4a" }}>
                                  Módulos de 8h, 24h ou 40h
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Widget Especial: Regra Fiscal Sócio Consultor (Step 3 Projetos) */}
                          {passo.tipoEspecial === "regra-fiscal" && (
                            <div
                              style={{
                                marginTop: "12px",
                                padding: "12px 14px",
                                borderRadius: "12px",
                                background: "linear-gradient(to right, #fffbeb 0%, #fff7ed 100%)",
                                border: "1px solid #fde68a",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "10px",
                              }}
                            >
                              <div
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  borderRadius: "6px",
                                  backgroundColor: "#f59e0b",
                                  color: "#ffffff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  marginTop: "1px",
                                }}
                              >
                                %
                              </div>
                              <div style={{ fontSize: "12px", color: "#78350f", lineHeight: 1.5 }}>
                                <strong style={{ fontWeight: 800, color: "#92400e" }}>Regra Fiscal Sócio Consultor: </strong>
                                Caso o instrutor alocado seja registrado na modalidade <strong>Sócio Consultor emitindo Nota Fiscal (NF)</strong>, o sistema calcula e acrescenta automaticamente <strong>+6% sobre o repasse bruto</strong> para fins de equilíbrio tributário.
                              </div>
                            </div>
                          )}

                          {/* Widget Especial: Grade de Modais de Logística (Step 4 Projetos) */}
                          {passo.tipoEspecial === "logistica-grid" && (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                                gap: "8px",
                                paddingTop: "12px",
                                marginTop: "12px",
                                borderTop: "1px solid #f1f5f9",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0284c7" }}>
                                  flight
                                </span>
                                <span>Aéreo</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0284c7" }}>
                                  hotel
                                </span>
                                <span>Hotel</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0284c7" }}>
                                  directions_car
                                </span>
                                <span>Carro / Traslado</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0284c7" }}>
                                  health_and_safety
                                </span>
                                <span>Seguro Viagem</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0284c7" }}>
                                  restaurant
                                </span>
                                <span>Diárias &amp; KM</span>
                              </div>
                            </div>
                          )}

                          {/* Dica Geral / Dica de Produtividade */}
                          {passo.dica && passo.tipoEspecial !== "regra-fiscal" && (
                            <div
                              style={{
                                marginTop: "12px",
                                padding: "10px 14px",
                                borderRadius: "10px",
                                backgroundColor: "#fffbeb",
                                border: "1px solid #fde68a",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "10px",
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#d97706", marginTop: "1px" }}>
                                lightbulb
                              </span>
                              <div style={{ fontSize: "12px", color: "#78350f", lineHeight: 1.5 }}>
                                <strong style={{ fontWeight: 800, color: "#92400e" }}>Dica de Produtividade: </strong>
                                {passo.dica}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Additional Resources & Official Documents Section */}
                <section style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#94a3b8" }}>
                      attach_file
                    </span>
                    <h4 style={{ margin: 0, fontSize: "11.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                      Documentos e Políticas Vinculadas
                    </h4>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <a
                      href="/politicas/NNOS-Politica-Viagens-Geral.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        textDecoration: "none",
                        backgroundColor: "#ffffff",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            picture_as_pdf
                          </span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f2a4a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            Fluxograma Oficial
                          </div>
                          <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>PDF • 1.4 MB</div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#94a3b8" }}>
                        download
                      </span>
                    </a>

                    <Link
                      href="/tabela-precos"
                      onClick={aoFechar}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        textDecoration: "none",
                        backgroundColor: "#ffffff",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            table_chart
                          </span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f2a4a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            Tabela Preços 2026
                          </div>
                          <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>Tarifas homologadas</div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#94a3b8" }}>
                        arrow_forward
                      </span>
                    </Link>

                    <Link
                      href="/consultor/viagens"
                      onClick={aoFechar}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        textDecoration: "none",
                        backgroundColor: "#ffffff",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#f0f9ff", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            explore
                          </span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f2a4a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            Políticas de Viagem
                          </div>
                          <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>Diretrizes de reembolso</div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#94a3b8" }}>
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                </section>

                {/* Regras Importantes & Perguntas Frequentes */}
                {menuAtual.regrasImportantes && menuAtual.regrasImportantes.length > 0 && (
                  <section
                    style={{
                      marginTop: "24px",
                      padding: "16px",
                      borderRadius: "12px",
                      backgroundColor: "#f0f9ff",
                      border: "1px solid #bae6fd",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", color: "#0369a1", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                        verified_user
                      </span>
                      <span>Regras &amp; Premissas Obrigatórias</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "#334155", lineHeight: 1.6 }}>
                      {menuAtual.regrasImportantes.map((r, i) => (
                        <li key={i} style={{ marginBottom: "4px" }}>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {menuAtual.faq && menuAtual.faq.length > 0 && (
                  <section style={{ marginTop: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px", color: "#0f2a4a", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "17px", color: "#f59e0b" }}>
                        quiz
                      </span>
                      <span>Dúvidas Frequentes (FAQ)</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {menuAtual.faq.map((f, i) => (
                        <div key={i} style={{ padding: "12px 14px", borderRadius: "12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#0f2a4a", marginBottom: "4px" }}>
                            {f.pergunta}
                          </div>
                          <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>
                            {f.resposta}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </main>
            </div>
          ) : (
            /* ======================================================== */
            /* ABA 2: AGENTE DE INTELIGÊNCIA ARTIFICIAL NATIVO          */
            /* ======================================================== */
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                backgroundColor: "#f8fafc",
              }}
            >
              {/* Sub-Header: Status do Agente Online */}
              <div
                style={{
                  padding: "10px 24px",
                  backgroundColor: "#ffffff",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      backgroundColor: "#0284c7",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                      smart_toy
                    </span>
                  </div>
                  <div style={{ fontSize: "12px" }}>
                    <strong style={{ color: "#0f2a4a" }}>Guia Virtual NNÓS</strong>
                    <span style={{ margin: "0 6px", color: "#cbd5e1" }}>•</span>
                    <span style={{ color: "#10b981", fontWeight: 700 }}>Assistente Online</span>
                    <span style={{ margin: "0 8px", color: "#cbd5e1" }}> </span>
                    <span style={{ color: "#64748b", fontSize: "11.5px" }}>
                      Treinado nas regras de negócio, tabelas de preços, políticas de viagens e fluxos do sistema.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setHistoricoChat([
                      {
                        id: `msg-${Date.now()}`,
                        autor: "ia",
                        texto: "Conversa reiniciada. Como posso ajudar com os processos do sistema hoje?",
                        dataHora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                      },
                    ])
                  }
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    background: "none",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                  title="Reiniciar chat"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                    refresh
                  </span>
                  <span>Limpar Conversa</span>
                </button>
              </div>

              {/* Área de Conversa com Scroll */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {historicoChat.map((msg) => {
                  const ehUsuario = msg.autor === "usuario";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: ehUsuario ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          maxWidth: "85%",
                          flexDirection: ehUsuario ? "row-reverse" : "row",
                        }}
                      >
                        {/* Avatar */}
                        {ehUsuario ? (
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              backgroundColor: "#0b2545",
                              color: "#ffffff",
                              fontWeight: 700,
                              fontSize: "11px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            EU
                          </div>
                        ) : (
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              backgroundColor: "#0284c7",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                              smart_toy
                            </span>
                          </div>
                        )}

                        {/* Balão de Mensagem */}
                        <div
                          style={{
                            borderRadius: "16px",
                            padding: "14px 18px",
                            fontSize: "13px",
                            lineHeight: 1.5,
                            backgroundColor: ehUsuario ? "#0b2545" : "#ffffff",
                            color: ehUsuario ? "#ffffff" : "#334155",
                            border: ehUsuario ? "none" : "1px solid #e2e8f0",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                          }}
                        >
                          {ehUsuario ? (
                            <div style={{ whiteSpace: "pre-wrap" }}>{msg.texto}</div>
                          ) : (
                            <ChatMessageContent texto={msg.texto} />
                          )}

                          {/* Link de Rota Sugerida */}
                          {msg.rotaSugerida && (
                            <div
                              style={{
                                marginTop: "12px",
                                paddingTop: "10px",
                                borderTop: "1px solid #f1f5f9",
                                display: "flex",
                                justifyContent: "flex-end",
                              }}
                            >
                              <Link
                                href={msg.rotaSugerida}
                                onClick={aoFechar}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  backgroundColor: "#0284c7",
                                  color: "#ffffff",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                }}
                              >
                                <span>{msg.rotuloRota || "Acessar Módulo"}</span>
                                <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                                  arrow_forward
                                </span>
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Horário */}
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#94a3b8",
                          marginTop: "4px",
                          paddingLeft: ehUsuario ? 0 : "42px",
                          paddingRight: ehUsuario ? "42px" : 0,
                        }}
                      >
                        {msg.dataHora}
                      </span>
                    </div>
                  );
                })}

                {/* Indicador de Digitação / Carregamento */}
                {carregandoIA && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", maxWidth: "85%" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        backgroundColor: "#0284c7",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        smart_toy
                      </span>
                    </div>
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "16px",
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span style={{ fontSize: "12px", color: "#64748b" }}>Consultando base de conhecimento...</span>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Sugestões Rápidas */}
              <div
                style={{
                  padding: "8px 24px",
                  backgroundColor: "#ffffff",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  overflowX: "auto",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 800,
                    color: "#f59e0b",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  ⚡ SUGESTÕES:
                </span>
                {sugestoesRapidas.map((sugestao, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleEnviarPergunta(sugestao)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "20px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#334155",
                      fontSize: "11px",
                      fontWeight: 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {sugestao}
                  </button>
                ))}
              </div>

              {/* Input e Envio da Pergunta */}
              <div
                style={{
                  padding: "14px 24px",
                  backgroundColor: "#ffffff",
                  borderTop: "1px solid #f1f5f9",
                  flexShrink: 0,
                }}
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleEnviarPergunta();
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="Digite sua dúvida sobre qualquer processo ou tela do sistema..."
                      value={inputPergunta}
                      onChange={(e) => setInputPergunta(e.target.value)}
                      disabled={carregandoIA}
                      style={{
                        width: "100%",
                        padding: "11px 40px 11px 16px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        backgroundColor: "#ffffff",
                        color: "#0f2a4a",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      style={{
                        position: "absolute",
                        right: "10px",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                      }}
                      title="Anexar arquivo"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        attach_file
                      </span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!inputPergunta.trim() || carregandoIA}
                    style={{
                      padding: "10px 22px",
                      borderRadius: "10px",
                      backgroundColor: inputPergunta.trim() && !carregandoIA ? "#0b2545" : "#cbd5e1",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 700,
                      border: "none",
                      cursor: inputPergunta.trim() && !carregandoIA ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: inputPergunta.trim() && !carregandoIA ? "0 2px 6px rgba(11, 37, 69, 0.25)" : "none",
                    }}
                  >
                    <span>Perguntar</span>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      send
                    </span>
                  </button>
                </form>

                <div
                  style={{
                    fontSize: "10.5px",
                    color: "#94a3b8",
                    textAlign: "center",
                    marginTop: "8px",
                  }}
                >
                  O assistente IA utiliza as diretrizes oficiais de projetos, contratos e controladoria da NNÓS Consultoria.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* RODAPÉ DO MODAL (VISÍVEL NO GUIA DE PROCESSOS)            */}
        {/* ======================================================== */}
        {abaAtiva === "GUIA" && (
          <footer
            style={{
              padding: "12px 28px",
              backgroundColor: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#64748b",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.2)",
                }}
              />
              <span style={{ fontWeight: 600, color: "#334155" }}>
                Base Homologada • Diretrizes Oficiais NNÓS Consultoria
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ color: "#94a3b8" }}>Última revisão de processos: Competência Vigente 2026</span>
              <button
                type="button"
                onClick={() => setAbaAtiva("IA")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#0284c7",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  chat
                </span>
                <span>Falar com Agente de IA</span>
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalConteudo, document.body) : null;
}
