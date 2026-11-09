"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LISTA_PROCESSOS_AJUDA } from "@/lib/ajuda-processos-base";

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
                }}
              >
                {item.num}
              </div>
              <div style={{ flex: 1 }}>{processarTrechosInline(item.conteudo)}</div>
            </div>
          ))}
        </div>
      </div>
    );

    listaNumeradaTemp = [];
  };

  linhas.forEach((linha, idx) => {
    const trimmed = linha.trim();

    // 1. Linha vazia
    if (!trimmed) {
      flushListaNumerada(`espaco-${idx}`);
      return;
    }

    // 2. Cabeçalho H3 (### Titulo)
    if (trimmed.startsWith("### ")) {
      flushListaNumerada(`h3-${idx}`);
      const conteudo = trimmed.replace(/^###\s+/, "");
      blocos.push(
        <div
          key={`h3-${idx}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            margin: "4px 0 10px 0",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              backgroundColor: "#e0f2fe",
              color: "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              description
            </span>
          </div>
          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f2a4a" }}>
            {processarTrechosInline(conteudo)}
          </h4>
        </div>
      );
      return;
    }

    // 3. Citação / Dica (> texto)
    if (trimmed.startsWith("> ")) {
      flushListaNumerada(`quote-${idx}`);
      const conteudo = trimmed.replace(/^>\s*/, "");
      blocos.push(
        <div
          key={`quote-${idx}`}
          style={{
            margin: "10px 0",
            padding: "8px 12px",
            backgroundColor: "#f0f9ff",
            borderLeft: "3px solid #0284c7",
            borderRadius: "0 8px 8px 0",
            fontSize: "12px",
            color: "#0369a1",
            lineHeight: 1.5,
          }}
        >
          {processarTrechosInline(conteudo)}
        </div>
      );
      return;
    }

    // 4. Lista numerada (1. item, 2. item) -> Acumula para o box estilizado
    const matchNumerado = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (matchNumerado) {
      listaNumeradaTemp.push({
        num: matchNumerado[1],
        conteudo: matchNumerado[2],
      });
      return;
    }

    // Qualquer outra linha dá flush na lista numerada anterior
    flushListaNumerada(`texto-${idx}`);

    // 5. Lista com bullet (- item ou * item)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const conteudo = trimmed.slice(2);
      blocos.push(
        <div
          key={`bullet-${idx}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            margin: "3px 0 3px 6px",
            fontSize: "12.5px",
            lineHeight: 1.5,
            color: "#334155",
          }}
        >
          <span style={{ color: "#0284c7", fontWeight: 700 }}>•</span>
          <div style={{ flex: 1 }}>{processarTrechosInline(conteudo)}</div>
        </div>
      );
      return;
    }

    // 6. Parágrafo padrão
    blocos.push(
      <p
        key={`p-${idx}`}
        style={{
          margin: "4px 0 8px 0",
          fontSize: "13px",
          lineHeight: 1.55,
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

  const modalConteudo = (
    <div
      onClick={aoFechar}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(11, 26, 44, 0.72)",
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
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.45)",
          border: "1px solid rgba(226, 232, 240, 0.8)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* ======================================================== */}
        {/* CABEÇALHO DO MODAL (Fiel ao Design do Usuário)            */}
        {/* ======================================================== */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          {/* Lado Esquerdo: Ícone de Suporte, Título e Tag */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                backgroundColor: "#0284c7",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                headphones
              </span>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2
                  style={{
                    fontSize: "17px",
                    fontWeight: 800,
                    color: "#0f2a4a",
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Central de Ajuda & Agente de IA NNÓS
                </h2>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: "20px",
                    backgroundColor: "#e0f2fe",
                    color: "#0284c7",
                    border: "1px solid rgba(2, 132, 199, 0.25)",
                  }}
                >
                  Suporte Integrado
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                Mapeamento completo dos menus, passo a passo operacional e inteligência artificial para dúvidas.
              </p>
            </div>
          </div>

          {/* Lado Direito: Abas e Fechar */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Botão Guia de Processos */}
            <button
              type="button"
              onClick={() => setAbaAtiva("GUIA")}
              style={{
                padding: "8px 16px",
                fontSize: "12.5px",
                fontWeight: abaAtiva === "GUIA" ? 700 : 600,
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
                backgroundColor: abaAtiva === "GUIA" ? "#0b2545" : "transparent",
                color: abaAtiva === "GUIA" ? "#ffffff" : "#475569",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                menu_book
              </span>
              <span>Guia de Processos</span>
            </button>

            {/* Botão Agente de IA NNÓS (Ativo com fundo escuro e logo em destaque) */}
            <button
              type="button"
              onClick={() => setAbaAtiva("IA")}
              style={{
                padding: "8px 16px",
                fontSize: "12.5px",
                fontWeight: 700,
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.15s ease",
                backgroundColor: abaAtiva === "IA" ? "#0b2545" : "transparent",
                color: abaAtiva === "IA" ? "#ffffff" : "#475569",
                boxShadow: abaAtiva === "IA" ? "0 2px 8px rgba(11, 37, 69, 0.25)" : "none",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
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
                  alt="Logo NNÓS"
                  style={{ width: "14px", height: "14px", objectFit: "contain" }}
                />
              </div>
              <span>Agente de IA NNÓS</span>
            </button>

            {/* Botão Fechar */}
            <button
              type="button"
              onClick={aoFechar}
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
                marginLeft: "4px",
              }}
              title="Fechar (Esc)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                close
              </span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CORPO DO MODAL: GUIA DE PROCESSOS OU AGENTE DE IA        */}
        {/* ======================================================== */}
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
                  borderRight: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "#f8fafc",
                  flexShrink: 0,
                }}
              >
                {/* Campo de Busca Rápida */}
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0" }}>
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
                        border: "1px solid #e2e8f0",
                        backgroundColor: "#ffffff",
                        color: "#0f2a4a",
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
                          color: "#94a3b8",
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
                      color: "#94a3b8",
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
                            color: ativo ? "#0369a1" : "#334155",
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
                              color: ativo ? "#0284c7" : "#64748b",
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
                                color: ativo ? "#0369a1" : "#64748b",
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
                          color: "#64748b",
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
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", backgroundColor: "#ffffff" }}>
                {/* Cabeçalho do Processo */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "16px",
                    paddingBottom: "16px",
                    borderBottom: "1px solid #e2e8f0",
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
                      <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0f2a4a", margin: 0 }}>
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

                    <p style={{ margin: "4px 0", fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                      {menuAtual.descricaoGeral}
                    </p>

                    <div style={{ marginTop: "6px", fontSize: "11.5px", color: "#64748b" }}>
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
                      color: "#0f2a4a",
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
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
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
                          <h5 style={{ margin: "0 0 4px 0", fontSize: "13.5px", fontWeight: 700, color: "#0f2a4a" }}>
                            {passo.titulo}
                          </h5>
                          <p style={{ margin: "0", fontSize: "12.5px", color: "#475569", lineHeight: 1.5 }}>
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
                      <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#475569", lineHeight: 1.6 }}>
                        {menuAtual.regrasImportantes.map((regra, idx) => (
                          <li key={idx} style={{ marginBottom: "4px" }}>
                            {regra}
                          </li>
                        ))}
                      </ul>
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
                        id: "msg-inicio",
                        autor: "ia",
                        texto: "Conversa reiniciada. Em que posso te orientar agora?",
                        dataHora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                      },
                    ])
                  }
                  style={{
                    padding: "4px 8px",
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    fontSize: "11.5px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0f2a4a")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                  title="Reiniciar conversa"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                    restart_alt
                  </span>
                  <span>Limpar Conversa</span>
                </button>
              </div>

              {/* Área das Mensagens com Scroll */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
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
                        gap: "12px",
                        alignSelf: isUsuario ? "flex-end" : "flex-start",
                        maxWidth: isUsuario ? "70%" : "82%",
                      }}
                    >
                      {/* Avatar do Agente com Robô Ciano */}
                      {!isUsuario && (
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "50%",
                            backgroundColor: "#0284c7",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            marginTop: "2px",
                            boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                            smart_toy
                          </span>
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                          style={{
                            backgroundColor: isUsuario ? "#0b2545" : "#ffffff",
                            color: isUsuario ? "#ffffff" : "#1e293b",
                            padding: "14px 18px",
                            borderRadius: isUsuario ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            border: isUsuario ? "none" : "1px solid #e2e8f0",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                            fontSize: "13px",
                            lineHeight: 1.55,
                            wordBreak: "break-word",
                          }}
                        >
                          {/* Conteúdo Renderizado com Caixa de Passos e Negritos Nativos */}
                          <ChatMessageContent texto={msg.texto} />

                          {/* Link de Rota Sugerida */}
                          {msg.rotaSugerida && (
                            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed #e2e8f0" }}>
                              <Link
                                href={msg.rotaSugerida}
                                onClick={aoFechar}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  backgroundColor: "#0284c7",
                                  color: "#ffffff",
                                  padding: "7px 14px",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                                }}
                              >
                                <span>{msg.rotuloRota || "Abrir Tela Sugerida"}</span>
                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                  open_in_new
                                </span>
                              </Link>
                            </div>
                          )}
                        </div>

                        {/* Horário da Mensagem */}
                        <div
                          style={{
                            fontSize: "10.5px",
                            color: "#94a3b8",
                            marginTop: "4px",
                            paddingLeft: isUsuario ? "0" : "4px",
                            paddingRight: isUsuario ? "4px" : "0",
                            textAlign: isUsuario ? "right" : "left",
                          }}
                        >
                          {msg.dataHora}
                        </div>
                      </div>

                      {/* Avatar do Usuário */}
                      {isUsuario && (
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "50%",
                            backgroundColor: "#0b2545",
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
                      backgroundColor: "#ffffff",
                      padding: "10px 16px",
                      borderRadius: "16px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12.5px",
                      color: "#64748b",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#0284c7", animation: "spin 1.5s linear infinite" }}>
                      sync
                    </span>
                    <span>O Agente NNÓS está analisando sua pergunta...</span>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* ======================================================== */}
              {/* BARRA DE SUGESTÕES (Fiel ao design com ícone de raio)    */}
              {/* ======================================================== */}
              <div
                style={{
                  padding: "10px 24px 6px 24px",
                  backgroundColor: "#ffffff",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#f59e0b",
                    letterSpacing: "0.04em",
                    marginRight: "4px",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                    bolt
                  </span>
                  <span>SUGESTÕES:</span>
                </div>

                {sugestoesRapidas.map((sugestao, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleEnviarPergunta(sugestao)}
                    disabled={carregandoIA}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "16px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#ffffff",
                      color: "#334155",
                      fontSize: "11.5px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#0284c7";
                      e.currentTarget.style.color = "#0284c7";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.color = "#334155";
                    }}
                  >
                    {sugestao}
                  </button>
                ))}
              </div>

              {/* ======================================================== */}
              {/* BARRA DE INPUT E ENVIO (Fiel ao design)                  */}
              {/* ======================================================== */}
              <div
                style={{
                  padding: "12px 24px 14px 24px",
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
                        transition: "border-color 0.15s ease",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#0284c7")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
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

                  {/* Botão Perguntar Azul Escuro */}
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
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>Perguntar</span>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      send
                    </span>
                  </button>
                </form>

                {/* Mensagem de Rodapé */}
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
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalConteudo, document.body) : null;
}
