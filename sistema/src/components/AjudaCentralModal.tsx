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

  // Divide mantendo os delimitadores
  const partes = texto.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return partes.map((parte, i) => {
    if (!parte) return null;

    // Negrito com itálico ***texto***
    if (parte.startsWith("***") && parte.endsWith("***") && parte.length >= 6) {
      return (
        <strong key={i} style={{ fontWeight: 800, color: "inherit", fontStyle: "italic" }}>
          {parte.slice(3, -3)}
        </strong>
      );
    }

    // Negrito **texto** -> Converte em <strong> real sem asteriscos
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length >= 4) {
      return (
        <strong key={i} style={{ fontWeight: 800, color: "inherit" }}>
          {parte.slice(2, -2)}
        </strong>
      );
    }

    // Código inline `texto`
    if (parte.startsWith("`") && parte.endsWith("`") && parte.length >= 2) {
      return (
        <code
          key={i}
          style={{
            padding: "2px 6px",
            borderRadius: "5px",
            backgroundColor: "rgba(2, 132, 199, 0.12)",
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

    // Itálico *texto*
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

// Renderizador estruturado de Markdown para o Chat
function formatarTextoMarkdown(texto: string): React.ReactNode {
  if (!texto) return null;

  const linhas = texto.split("\n");
  const elementos: React.ReactNode[] = [];

  linhas.forEach((linha, idx) => {
    const trimmed = linha.trim();

    // 1. Linha vazia
    if (!trimmed) {
      elementos.push(<div key={`espaco-${idx}`} style={{ height: "6px" }} />);
      return;
    }

    // 2. Cabeçalho H3 (### Titulo)
    if (trimmed.startsWith("### ")) {
      const conteudo = trimmed.replace(/^###\s+/, "");
      elementos.push(
        <div
          key={`h3-${idx}`}
          style={{
            fontSize: "14.5px",
            fontWeight: 800,
            color: "var(--primary)",
            margin: "8px 0 4px 0",
            paddingBottom: "3px",
            borderBottom: "1px solid rgba(2, 132, 199, 0.15)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {processarTrechosInline(conteudo)}
        </div>
      );
      return;
    }

    // 3. Citação / Dica (> texto)
    if (trimmed.startsWith("> ")) {
      const conteudo = trimmed.replace(/^>\s*/, "");
      elementos.push(
        <div
          key={`quote-${idx}`}
          style={{
            margin: "8px 0",
            padding: "8px 12px",
            backgroundColor: "rgba(2, 132, 199, 0.08)",
            borderLeft: "3px solid #0284c7",
            borderRadius: "0 8px 8px 0",
            fontSize: "12px",
            color: "var(--on-surface-variant)",
            lineHeight: 1.5,
          }}
        >
          {processarTrechosInline(conteudo)}
        </div>
      );
      return;
    }

    // 4. Lista numerada (1. item, 2. item)
    const matchNumerado = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (matchNumerado) {
      const num = matchNumerado[1];
      const conteudo = matchNumerado[2];
      elementos.push(
        <div
          key={`num-${idx}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            margin: "4px 0",
            fontSize: "12.5px",
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              fontWeight: 800,
              color: "#0284c7",
              minWidth: "18px",
            }}
          >
            {num}.
          </span>
          <div style={{ flex: 1 }}>{processarTrechosInline(conteudo)}</div>
        </div>
      );
      return;
    }

    // 5. Lista com bullet (- item ou * item)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const conteudo = trimmed.slice(2);
      elementos.push(
        <div
          key={`bullet-${idx}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            margin: "3px 0 3px 6px",
            fontSize: "12.5px",
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: "#0284c7", fontWeight: 700 }}>•</span>
          <div style={{ flex: 1 }}>{processarTrechosInline(conteudo)}</div>
        </div>
      );
      return;
    }

    // 6. Parágrafo padrão
    elementos.push(
      <p
        key={`p-${idx}`}
        style={{
          margin: "4px 0",
          fontSize: "13px",
          lineHeight: 1.55,
        }}
      >
        {processarTrechosInline(linha)}
      </p>
    );
  });

  return elementos;
}

export default function AjudaCentralModal({
  aberto,
  aoFechar,
  abaInicial = "GUIA",
}: AjudaCentralModalProps) {
  const [mounted, setMounted] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"GUIA" | "IA">(abaInicial);
  const [menuSelecionadoId, setMenuSelecionadoId] = useState<string>("projetos");
  const [termoBusca, setTermoBusca] = useState("");

  // Estado do Chat de IA
  const [historicoChat, setHistoricoChat] = useState<MensagemChat[]>([
    {
      id: "msg-bem-vindo",
      autor: "ia",
      texto: `Olá! Sou o **Agente de Inteligência Artificial da NNÓS Consultoria**.

Estou aqui para orientar você no uso de qualquer tela, fluxo financeiro, operacional ou regra de negócio do sistema.

Você pode clicar em uma das sugestões abaixo ou digitar sua dúvida!`,
      dataHora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
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

  // Fechar com a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aberto) {
        aoFechar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aberto, aoFechar]);

  if (!mounted || !aberto) return null;

  // Filtragem dos menus de processos
  const processosFiltrados = LISTA_PROCESSOS_AJUDA.filter((p) => {
    if (!termoBusca.trim()) return true;
    const t = termoBusca.toLowerCase();
    return (
      p.menuNome.toLowerCase().includes(t) ||
      p.descricaoGeral.toLowerCase().includes(t) ||
      p.categoria.toLowerCase().includes(t) ||
      p.passos.some((step) => step.titulo.toLowerCase().includes(t) || step.descricao.toLowerCase().includes(t)) ||
      p.regrasImportantes.some((r) => r.toLowerCase().includes(t)) ||
      p.faq.some((f) => f.pergunta.toLowerCase().includes(t) || f.resposta.toLowerCase().includes(t))
    );
  });

  const menuAtual =
    LISTA_PROCESSOS_AJUDA.find((p) => p.id === menuSelecionadoId) ||
    processosFiltrados[0] ||
    LISTA_PROCESSOS_AJUDA[0];

  // Envio de pergunta para o Agente de IA
  const handleEnviarPergunta = async (textoPersonalizado?: string) => {
    const texto = (textoPersonalizado || inputPergunta).trim();
    if (!texto || carregandoIA) return;

    const novaMsgUsuario: MensagemChat = {
      id: `usr-${Date.now()}`,
      autor: "usuario",
      texto,
      dataHora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
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

  const perguntasRapidas = [
    "Como emitir um Boletim de Medição (BM)?",
    "Como funciona a aprovação de Viagens & Logística?",
    "Como aplicar o acréscimo de 6% para Sócios?",
    "Onde consulto o Painel Financeiro por Líder?",
    "Como cadastrar um novo consultor parceiro PJ?",
    "Quais as políticas de viagem da NNÓS, CNH e Iveco?",
  ];

  const modalConteudo = (
    <div
      onClick={aoFechar}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(6, 13, 30, 0.72)",
        backdropFilter: "blur(8px)",
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
          width: "100%",
          maxWidth: "1140px",
          height: "90vh",
          maxHeight: "860px",
          backgroundColor: "var(--surface)",
          borderRadius: "20px",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.45)",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Cabeçalho do Modal */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            background: "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(15, 42, 74, 0.04) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Ícone com Fundo Branco Nítido e Logomarca Oficial da NNÓS */}
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                backgroundColor: "#ffffff",
                border: "1px solid rgba(2, 132, 199, 0.25)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px",
                flexShrink: 0,
              }}
            >
              <img
                src="/logo-coruja.png"
                alt="Logo Coruja NNÓS"
                style={{ width: "28px", height: "28px", objectFit: "contain" }}
              />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2
                  style={{
                    fontSize: "17px",
                    fontWeight: 800,
                    color: "var(--primary)",
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Central de Ajuda & Agente de IA NNÓS
                </h2>
                <span
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "20px",
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    border: "1px solid rgba(2, 132, 199, 0.2)",
                  }}
                >
                  Suporte Integrado
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                Mapeamento completo dos menus, passo a passo operacional e inteligência artificial para dúvidas.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Seletor de Abas no Topo */}
            <div
              style={{
                display: "flex",
                backgroundColor: "var(--surface-container-high, #f1f5f9)",
                padding: "3px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                onClick={() => setAbaAtiva("GUIA")}
                style={{
                  padding: "6px 14px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  borderRadius: "9px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                  backgroundColor: abaAtiva === "GUIA" ? "#0284c7" : "transparent",
                  color: abaAtiva === "GUIA" ? "#ffffff" : "var(--on-surface-variant)",
                  boxShadow: abaAtiva === "GUIA" ? "0 2px 8px rgba(2, 132, 199, 0.3)" : "none",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  menu_book
                </span>
                Guia de Processos
              </button>

              {/* Botão da Aba com a Logomarca da NNÓS indicada pela Seta */}
              <button
                type="button"
                onClick={() => setAbaAtiva("IA")}
                style={{
                  padding: "6px 14px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  borderRadius: "9px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  transition: "all 0.15s ease",
                  backgroundColor: abaAtiva === "IA" ? "#0284c7" : "transparent",
                  color: abaAtiva === "IA" ? "#ffffff" : "var(--on-surface-variant)",
                  boxShadow: abaAtiva === "IA" ? "0 2px 8px rgba(2, 132, 199, 0.3)" : "none",
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src="/logo-coruja.png"
                    alt="Logo NNÓS"
                    style={{ width: "16px", height: "16px", objectFit: "contain" }}
                  />
                </div>
                <span>Agente de IA NNÓS</span>
              </button>
            </div>

            {/* Botão Fechar */}
            <button
              type="button"
              onClick={aoFechar}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--on-surface-variant)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Fechar (Esc)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                close
              </span>
            </button>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {abaAtiva === "GUIA" ? (
            /* ======================================================== */
            /* ABA 1: GUIA PASSO A PASSO DE PROCESSOS POR MENU          */
            /* ======================================================== */
            <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
              {/* Coluna da Esquerda: Lista de Menus e Busca */}
              <div
                style={{
                  width: "310px",
                  borderRight: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "var(--surface-container-low, rgba(0,0,0,0.015))",
                  flexShrink: 0,
                }}
              >
                {/* Campo de Busca Rápida */}
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
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
                        color: "var(--on-surface-variant)",
                      }}
                    >
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Filtrar menu, processo ou regra..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px 8px 34px",
                        fontSize: "12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface)",
                        color: "var(--on-surface)",
                        outline: "none",
                      }}
                    />
                    {termoBusca && (
                      <button
                        type="button"
                        onClick={() => setTermoBusca("")}
                        style={{
                          position: "absolute",
                          right: "8px",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: "var(--on-surface-variant)",
                          padding: "2px",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          cancel
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Lista de Menus Disponíveis */}
                <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
                  <div
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 700,
                      color: "var(--on-surface-variant)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "4px 8px 8px 8px",
                    }}
                  >
                    Mapeamento de Menus ({processosFiltrados.length})
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {processosFiltrados.map((proc) => {
                      const ativo = proc.id === menuAtual.id;
                      return (
                        <button
                          key={proc.id}
                          type="button"
                          onClick={() => setMenuSelecionadoId(proc.id)}
                          style={{
                            padding: "9px 12px",
                            borderRadius: "10px",
                            border: ativo ? "1px solid #0284c7" : "1px solid transparent",
                            backgroundColor: ativo ? "#e0f2fe" : "transparent",
                            color: ativo ? "#0369a1" : "var(--on-surface)",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            textAlign: "left",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: "18px",
                              color: ativo ? "#0284c7" : "var(--on-surface-variant)",
                            }}
                          >
                            {proc.icone}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "12.5px",
                                fontWeight: ativo ? 700 : 600,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {proc.menuNome}
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: ativo ? "#0369a1" : "var(--on-surface-variant)",
                                opacity: 0.85,
                              }}
                            >
                              {proc.categoria}
                            </div>
                          </div>
                          {ativo && (
                            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0284c7" }}>
                              chevron_right
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {processosFiltrados.length === 0 && (
                      <div
                        style={{
                          padding: "24px 12px",
                          textAlign: "center",
                          color: "var(--on-surface-variant)",
                          fontSize: "12px",
                        }}
                      >
                        Nenhum menu encontrado para "{termoBusca}".
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Coluna da Direita: Conteúdo Passo a Passo do Menu Selecionado */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
                {/* Cabeçalho do Processo */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "16px",
                    paddingBottom: "16px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "24px", color: "#0284c7" }}
                      >
                        {menuAtual.icone}
                      </span>
                      <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                        {menuAtual.menuNome}
                      </h3>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor: "#f1f5f9",
                          color: "#475569",
                        }}
                      >
                        {menuAtual.categoria}
                      </span>
                    </div>

                    <p style={{ margin: "4px 0", fontSize: "13px", color: "var(--on-surface-variant)", lineHeight: 1.5 }}>
                      {menuAtual.descricaoGeral}
                    </p>

                    <div style={{ marginTop: "6px", fontSize: "11.5px", color: "var(--on-surface-variant)" }}>
                      <strong>Público recomendado:</strong> {menuAtual.publicoAlvo}
                    </div>
                  </div>

                  <Link
                    href={menuAtual.rota}
                    onClick={aoFechar}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "10px",
                      backgroundColor: "#0284c7",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    <span>Ir para {menuAtual.menuNome}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      arrow_forward
                    </span>
                  </Link>
                </div>

                {/* Passo a Passo Numerado */}
                <div style={{ marginTop: "24px" }}>
                  <h4
                    style={{
                      fontSize: "14px",
                      fontWeight: 800,
                      color: "var(--primary)",
                      margin: "0 0 16px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#0284c7" }}>
                      format_list_numbered
                    </span>
                    Passo a Passo do Processo
                  </h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {menuAtual.passos.map((passo) => (
                      <div
                        key={passo.numero}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "14px",
                          padding: "14px 16px",
                          borderRadius: "12px",
                          backgroundColor: "var(--surface-container-lowest, rgba(2, 132, 199, 0.02))",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            backgroundColor: "#0284c7",
                            color: "#ffffff",
                            fontSize: "13px",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
                          }}
                        >
                          {passo.numero}
                        </div>

                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: "0 0 4px 0", fontSize: "13.5px", fontWeight: 700, color: "var(--primary)" }}>
                            {passo.titulo}
                          </h5>
                          <p style={{ margin: "0", fontSize: "12.5px", color: "var(--on-surface-variant)", lineHeight: 1.5 }}>
                            {passo.descricao}
                          </p>
                          {passo.dica && (
                            <div
                              style={{
                                marginTop: "8px",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                backgroundColor: "rgba(245, 158, 11, 0.1)",
                                border: "1px solid rgba(245, 158, 11, 0.25)",
                                fontSize: "11.5px",
                                color: "#b45309",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                lightbulb
                              </span>
                              <span>{passo.dica}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Regras Importantes do Negócio */}
                {menuAtual.regrasImportantes && menuAtual.regrasImportantes.length > 0 && (
                  <div style={{ marginTop: "24px" }}>
                    <div
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        backgroundColor: "rgba(2, 132, 199, 0.05)",
                        border: "1px solid rgba(2, 132, 199, 0.2)",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: "13px",
                          fontWeight: 800,
                          color: "#0369a1",
                          margin: "0 0 10px 0",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          verified_user
                        </span>
                        Regras & Premissas Obrigatórias
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "var(--on-surface-variant)", lineHeight: 1.6 }}>
                        {menuAtual.regrasImportantes.map((regra, idx) => (
                          <li key={idx} style={{ marginBottom: "4px" }}>
                            {regra}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Perguntas Frequentes (FAQ) */}
                {menuAtual.faq && menuAtual.faq.length > 0 && (
                  <div style={{ marginTop: "24px" }}>
                    <h4
                      style={{
                        fontSize: "14px",
                        fontWeight: 800,
                        color: "var(--primary)",
                        margin: "0 0 12px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#0284c7" }}>
                        help
                      </span>
                      Dúvidas Frequentes do Módulo
                    </h4>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {menuAtual.faq.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "12px 14px",
                            borderRadius: "10px",
                            backgroundColor: "var(--surface)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--primary)", marginBottom: "4px" }}>
                            ❓ {item.pergunta}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", lineHeight: 1.5 }}>
                            {item.resposta}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* ABA 2: AGENTE DE INTELIGÊNCIA ARTIFICIAL NATIVO          */
            /* ======================================================== */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                backgroundColor: "var(--surface-container-lowest, #ffffff)",
              }}
            >
              {/* Banner do Agente com Fundo Branco Nítido e Logo da NNÓS */}
              <div
                style={{
                  padding: "12px 20px",
                  backgroundColor: "rgba(2, 132, 199, 0.05)",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "#ffffff",
                      border: "1px solid rgba(2, 132, 199, 0.25)",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4px",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src="/logo-coruja.png"
                      alt="Logo NNÓS"
                      style={{ width: "22px", height: "22px", objectFit: "contain" }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--primary)" }}>
                      Guia Virtual NNÓS • Assistente Inteligente
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                      Treinado nas regras de negócio, tabelas de preços, políticas de viagens e fluxos do sistema.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setHistoricoChat([
                      {
                        id: "msg-inicio",
                        autor: "ia",
                        texto: "Conversa reiniciada. Em que posso te orientar agora?",
                        dataHora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                      },
                    ])
                  }
                  style={{
                    padding: "4px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    backgroundColor: "transparent",
                    color: "var(--on-surface-variant)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="Limpar histórico de mensagens"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    restart_alt
                  </span>
                  Limpar Chat
                </button>
              </div>

              {/* Área das Mensagens com Scroll */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {historicoChat.map((msg) => {
                  const isUsuario = msg.autor === "usuario";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        alignSelf: isUsuario ? "flex-end" : "flex-start",
                        maxWidth: "84%",
                      }}
                    >
                      {/* Avatar do Agente com Fundo Branco Nítido e Coruja Oficial */}
                      {!isUsuario && (
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            border: "1.5px solid rgba(2, 132, 199, 0.3)",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "4px",
                            flexShrink: 0,
                            marginTop: "2px",
                          }}
                        >
                          <img
                            src="/logo-coruja.png"
                            alt="Coruja NNÓS"
                            style={{ width: "24px", height: "24px", objectFit: "contain" }}
                          />
                        </div>
                      )}

                      <div
                        style={{
                          backgroundColor: isUsuario ? "#0284c7" : "var(--surface)",
                          color: isUsuario ? "#ffffff" : "var(--on-surface)",
                          padding: "12px 16px",
                          borderRadius: isUsuario ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          border: isUsuario ? "none" : "1px solid var(--border)",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                          fontSize: "13px",
                          lineHeight: 1.55,
                          wordBreak: "break-word",
                        }}
                      >
                        {/* Renderização Formatada: Converte **negrito**, ### títulos e > citações em elementos HTML reais */}
                        <div>{formatarTextoMarkdown(msg.texto)}</div>

                        {msg.rotaSugerida && (
                          <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed rgba(2, 132, 199, 0.3)" }}>
                            <Link
                              href={msg.rotaSugerida}
                              onClick={aoFechar}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                backgroundColor: "#0284c7",
                                color: "#ffffff",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                textDecoration: "none",
                              }}
                            >
                              <span>{msg.rotuloRota || "Abrir Tela Sugerida"}</span>
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                open_in_new
                              </span>
                            </Link>
                          </div>
                        )}

                        <div
                          style={{
                            fontSize: "10px",
                            color: isUsuario ? "rgba(255,255,255,0.7)" : "var(--on-surface-variant)",
                            textAlign: "right",
                            marginTop: "6px",
                          }}
                        >
                          {msg.dataHora}
                        </div>
                      </div>

                      {isUsuario && (
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "var(--primary)",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: "2px",
                          }}
                        >
                          EU
                        </div>
                      )}
                    </div>
                  );
                })}

                {carregandoIA && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      alignSelf: "flex-start",
                      backgroundColor: "var(--surface)",
                      padding: "10px 16px",
                      borderRadius: "16px",
                      border: "1px solid var(--border)",
                      fontSize: "12.5px",
                      color: "var(--on-surface-variant)",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                        border: "1px solid rgba(2, 132, 199, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "2px",
                      }}
                    >
                      <img
                        src="/logo-coruja.png"
                        alt="Coruja"
                        style={{ width: "16px", height: "16px", objectFit: "contain" }}
                      />
                    </div>
                    <span>O Agente NNÓS está analisando sua pergunta...</span>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Sugestões Rápidas de Perguntas */}
              <div
                style={{
                  padding: "10px 20px 6px 20px",
                  borderTop: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)" }}>
                  Sugestões:
                </span>
                {perguntasRapidas.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleEnviarPergunta(p)}
                    disabled={carregandoIA}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "14px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-container-high, #f8fafc)",
                      color: "var(--primary)",
                      fontSize: "11.5px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#0284c7")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Campo de Digitação e Envio */}
              <div
                style={{
                  padding: "12px 20px 16px 20px",
                  borderTop: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
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
                  <input
                    type="text"
                    placeholder="Digite sua dúvida sobre qualquer processo ou tela do sistema..."
                    value={inputPergunta}
                    onChange={(e) => setInputPergunta(e.target.value)}
                    disabled={carregandoIA}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-container-low, #f8fafc)",
                      color: "var(--on-surface)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />

                  <button
                    type="submit"
                    disabled={!inputPergunta.trim() || carregandoIA}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "12px",
                      backgroundColor: inputPergunta.trim() && !carregandoIA ? "#0284c7" : "var(--border)",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 700,
                      border: "none",
                      cursor: inputPergunta.trim() && !carregandoIA ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: inputPergunta.trim() ? "0 2px 8px rgba(2, 132, 199, 0.3)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>Perguntar</span>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      send
                    </span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalConteudo, document.body) : null;
}
