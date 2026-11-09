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
        <strong key={i} className="font-bold text-inherit italic">
          {parte.slice(3, -3)}
        </strong>
      );
    }

    if (parte.startsWith("**") && parte.endsWith("**") && parte.length >= 4) {
      return (
        <strong key={i} className="font-bold text-inherit">
          {parte.slice(2, -2)}
        </strong>
      );
    }

    if (parte.startsWith("`") && parte.endsWith("`") && parte.length >= 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-mono text-xs font-semibold"
        >
          {parte.slice(1, -1)}
        </code>
      );
    }

    if (parte.startsWith("*") && parte.endsWith("*") && parte.length >= 2) {
      return (
        <em key={i} className="italic">
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
        className="my-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200"
      >
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#0284c7] tracking-wider uppercase mb-3">
          <span className="material-symbols-outlined text-base">format_list_bulleted</span>
          <span>PASSO A PASSO NO SISTEMA:</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {listaNumeradaTemp.map((item, idx) => (
            <div key={`item-${idx}`} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-slate-700">
              <div className="w-5 h-5 rounded-md bg-white border border-slate-300 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                {item.num}
              </div>
              <div className="flex-1 min-w-0">{processarTrechosInline(item.conteudo)}</div>
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
        <div key={`h3-${index}`} className="flex items-center gap-2 mt-2 mb-2 text-slate-900 font-extrabold text-sm sm:text-base">
          <span className="material-symbols-outlined text-[#0284c7] text-lg">article</span>
          <span>{processarTrechosInline(conteudo)}</span>
        </div>
      );
      return;
    }

    // Card de Dica / Aviso (ex: "> Dica: ...")
    if (linha.startsWith(">")) {
      const conteudo = linha.replace(/^>\s*/, "").replace(/^[*_]+Dica:[*_]+\s*/i, "");
      blocos.push(
        <div key={`quote-${index}`} className="my-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">lightbulb</span>
          <div className="text-xs text-amber-950 font-medium leading-relaxed">
            <strong className="font-bold text-amber-900">Dica: </strong>
            {processarTrechosInline(conteudo)}
          </div>
        </div>
      );
      return;
    }

    // Parágrafo regular
    blocos.push(
      <p key={`p-${index}`} className="my-1 text-[13px] leading-relaxed text-slate-700">
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
  const getCategoriaIconStyle = (cat: string, id: string) => {
    if (id === "tabela-precos") return "bg-amber-50 text-amber-600 border border-amber-100";
    if (id === "relatorios") return "bg-indigo-50 text-indigo-600 border border-indigo-100";
    if (id === "centro-de-custo") return "bg-purple-50 text-purple-600 border border-purple-100";
    if (cat === "Financeiro") return "bg-emerald-50 text-emerald-600 border border-emerald-100";
    if (cat === "Operacional") return "bg-sky-50 text-sky-600 border border-sky-100";
    if (cat === "Consultoria") return "bg-sky-50 text-sky-600 border border-sky-100";
    return "bg-slate-100 text-slate-600 border border-slate-200";
  };

  const modalConteudo = (
    <div
      onClick={aoFechar}
      className="fixed inset-0 bg-[#071322]/75 backdrop-blur-md z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[1240px] h-[93vh] max-h-[890px] bg-white rounded-2xl lg:rounded-3xl shadow-2xl border border-white/60 ring-1 ring-slate-900/10 flex flex-col overflow-hidden animate-fadeIn"
      >
        {/* ======================================================== */}
        {/* CABEÇALHO DO MODAL (Fiel ao Design do Usuário)            */}
        {/* ======================================================== */}
        <header className="px-6 sm:px-8 py-4 bg-white border-b border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none shrink-0 relative z-10">
          {/* Título, Ícone e Tag de Versão */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0f2a4a] via-[#0369a1] to-[#0284c7] text-white flex items-center justify-center shadow-lg shadow-sky-900/20 ring-4 ring-sky-50">
                <span className="material-symbols-outlined text-xl">menu_book</span>
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500 border-2 border-white"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Central de Ajuda &amp; Agente de IA NNÓS
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-[#0284c7] border border-sky-200/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7]"></span>
                  v4.18 • Suporte Integrado
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Mapeamento completo dos menus, passo a passo operacional e inteligência artificial para dúvidas.
              </p>
            </div>
          </div>

          {/* Segmented Control Tabs & Ação Fechar */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-xs font-semibold shadow-inner" role="tablist">
              {/* Aba 1: Guia de Processos */}
              <button
                type="button"
                role="tab"
                aria-selected={abaAtiva === "GUIA"}
                onClick={() => setAbaAtiva("GUIA")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                  abaAtiva === "GUIA"
                    ? "bg-[#0284c7] text-white shadow-sm hover:bg-[#0369a1]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-medium"
                }`}
              >
                <span className="material-symbols-outlined text-sm">menu_book</span>
                <span>Guia de Processos</span>
              </button>

              {/* Aba 2: Agente de IA NNÓS */}
              <button
                type="button"
                role="tab"
                aria-selected={abaAtiva === "IA"}
                onClick={() => setAbaAtiva("IA")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  abaAtiva === "IA"
                    ? "bg-[#0b2545] text-white font-bold shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-medium"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center p-0.5 shrink-0">
                  <img src="/logo-coruja.png" alt="NNÓS" className="w-3.5 h-3.5 object-contain" />
                </div>
                <span>Agente de IA NNÓS</span>
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            {/* Botão Fechar */}
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar janela"
              className="w-9 h-9 rounded-xl border border-slate-200/90 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all hover:rotate-90 duration-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* CORPO DO MODAL: GUIA DE PROCESSOS OU AGENTE DE IA        */}
        {/* ======================================================== */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/60">
          {abaAtiva === "GUIA" ? (
            /* ======================================================== */
            /* ABA 1: GUIA PASSO A PASSO (FIEL AO DESIGN DO MOCKUP)     */
            /* ======================================================== */
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full h-full">
              {/* Barra Lateral Esquerda: Módulos Corporativos */}
              <aside className="w-full md:w-[330px] lg:w-[350px] border-r border-slate-200/90 bg-white flex flex-col shrink-0">
                {/* Campo de Busca Rápida */}
                <div className="p-3.5 border-b border-slate-100">
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-slate-400 text-sm pointer-events-none">
                      search
                    </span>
                    <input
                      id="input-busca-modulos"
                      type="text"
                      placeholder="Buscar módulos, regras ou telas..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      className="w-full pl-9 pr-14 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-[#0284c7] transition-all font-medium"
                    />
                    <div className="absolute right-2.5 flex items-center pointer-events-none">
                      <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded-md shadow-xs">
                        ⌘K
                      </kbd>
                    </div>
                  </div>

                  {/* Pílulas de Filtro por Categoria */}
                  <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-0.5 custom-scroll-thin">
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro("TODOS")}
                      className={`px-2.5 py-1 text-[11px] rounded-lg shrink-0 transition-colors cursor-pointer ${
                        categoriaFiltro === "TODOS"
                          ? "bg-[#0f2a4a] text-white font-semibold shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 font-medium"
                      }`}
                    >
                      Todos ({LISTA_PROCESSOS_AJUDA.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro("Operacional")}
                      className={`px-2.5 py-1 text-[11px] rounded-lg shrink-0 transition-colors cursor-pointer ${
                        categoriaFiltro === "Operacional"
                          ? "bg-[#0f2a4a] text-white font-semibold shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 font-medium"
                      }`}
                    >
                      Operacional
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro("Financeiro")}
                      className={`px-2.5 py-1 text-[11px] rounded-lg shrink-0 transition-colors cursor-pointer ${
                        categoriaFiltro === "Financeiro"
                          ? "bg-[#0f2a4a] text-white font-semibold shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 font-medium"
                      }`}
                    >
                      Financeiro
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro("Gestão")}
                      className={`px-2.5 py-1 text-[11px] rounded-lg shrink-0 transition-colors cursor-pointer ${
                        categoriaFiltro === "Gestão"
                          ? "bg-[#0f2a4a] text-white font-semibold shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 font-medium"
                      }`}
                    >
                      Gestão
                    </button>
                  </div>
                </div>

                {/* Cabeçalho da Seção */}
                <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 tracking-wider uppercase">
                  <span>MÓDULOS CORPORATIVOS</span>
                  <span className="text-[10px] text-slate-400 font-semibold lowercase">
                    {processosFiltrados.length} itens
                  </span>
                </div>

                {/* Lista Tátil dos Módulos */}
                <nav aria-label="Lista de Menus" className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scroll-thin">
                  {processosFiltrados.map((proc) => {
                    const ativo = proc.id === menuAtual.id;
                    const catPill =
                      proc.categoria === "Financeiro"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                        : proc.categoria === "Gestão & Diretoria"
                        ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                        : proc.categoria === "Consultoria"
                        ? "bg-sky-50 text-sky-700 border border-sky-200/60"
                        : proc.categoria === "Segurança"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-sky-50 text-sky-700 border border-sky-200/60";

                    return (
                      <button
                        key={proc.id}
                        type="button"
                        onClick={() => setMenuSelecionadoId(proc.id)}
                        className={`w-full text-left relative group flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer overflow-hidden ${
                          ativo
                            ? "bg-sky-50/90 text-sky-900 border border-sky-200/90 shadow-sm"
                            : "hover:bg-slate-100/80 border border-transparent"
                        }`}
                      >
                        {ativo && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-[#0284c7] rounded-r-md"></div>
                        )}
                        <div className={`flex items-center gap-3 min-w-0 ${ativo ? "pl-1.5" : ""}`}>
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              ativo
                                ? "bg-gradient-to-br from-sky-500 to-[#0284c7] text-white shadow-sm shadow-sky-500/25"
                                : getCategoriaIconStyle(proc.categoria, proc.id)
                            }`}
                          >
                            <span className="material-symbols-outlined text-lg">{proc.icone}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">{proc.menuNome}</div>
                            <div className={`text-[10px] truncate ${ativo ? "text-sky-700 font-medium" : "text-slate-500"}`}>
                              {proc.subtitulo || `${proc.passos.length} etapas no fluxo`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                              ativo ? "bg-sky-200/60 text-sky-800 font-bold" : catPill
                            }`}
                          >
                            {proc.categoria.split(" ")[0]}
                          </span>
                          {ativo && (
                            <span className="material-symbols-outlined text-[13px] text-[#0284c7]">arrow_forward</span>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {processosFiltrados.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Nenhum módulo encontrado para "{termoBusca}".
                    </div>
                  )}
                </nav>
              </aside>

              {/* Coluna da Direita: Visualização Detalhada do Passo a Passo (Main) */}
              <main className="flex-1 flex flex-col overflow-y-auto bg-white p-6 sm:p-8 lg:p-10 custom-scroll-thin">
                {/* Module Feature Header Banner */}
                <section className="border-b border-slate-100 pb-7 mb-7">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-100/80 border border-sky-200/90 text-[#0284c7] flex items-center justify-center shadow-sm shrink-0">
                        <span className="material-symbols-outlined text-2xl">{menuAtual.icone}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                            {menuAtual.menuNome}
                          </h2>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-sky-50 text-[#0284c7] border border-sky-200/70">
                            Módulo Principal
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/70">
                            {menuAtual.categoria}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium ml-1">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            {menuAtual.tempoLeitura || `${Math.max(2, menuAtual.passos.length)} min de leitura`}
                          </span>
                        </div>
                        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                          {menuAtual.descricaoGeral}
                        </p>
                      </div>
                    </div>

                    {/* Botão de Ação Direto para o Módulo */}
                    <div className="shrink-0 flex items-center">
                      <Link
                        href={menuAtual.rota}
                        onClick={aoFechar}
                        className="inline-flex items-center justify-center gap-2.5 px-4.5 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-sky-600/20 group hover:shadow-lg cursor-pointer"
                      >
                        <span>Abrir Módulo de {menuAtual.menuNome.split(" - ")[0].split(" & ")[0]}</span>
                        <span className="material-symbols-outlined text-xs transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                          open_in_new
                        </span>
                      </Link>
                    </div>
                  </div>

                  {/* Metadata Pill Bar: Público Recomendado */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sky-600 text-sm">how_to_reg</span>
                      Público recomendado:
                    </span>
                    {menuAtual.publicoAlvo.split(",").map((p, idx) => (
                      <span key={idx} className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        {p.trim()}
                      </span>
                    ))}
                  </div>
                </section>

                {/* Stepper Timeline Section */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-2 w-2 rounded-full bg-[#0284c7]"></span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                        Trilha Operacional Passo a Passo
                      </h3>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {menuAtual.passos.length} etapas sequenciais
                    </span>
                  </div>

                  {/* Stepper Container com Linha de Gradiente Contínua */}
                  <div className="relative pl-8 space-y-6 before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-sky-500 before:via-sky-300 before:to-slate-200">
                    {menuAtual.passos.map((passo) => (
                      <div key={passo.numero} className="relative group">
                        {/* Stepper Node Circular */}
                        <div className="absolute -left-8 top-1 flex items-center justify-center w-8 h-8 rounded-full bg-[#0284c7] text-white font-bold text-xs shadow-md shadow-sky-600/30 ring-4 ring-white z-10">
                          {passo.numero}
                        </div>

                        {/* Card do Passo */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <h4 className="text-sm sm:text-base font-bold text-slate-900">{passo.titulo}</h4>
                            {passo.tags && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {passo.tags.map((tag, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {passo.descricao}
                          </p>

                          {/* Widget Especial: Grade de Campos (Step 2 Projetos) */}
                          {passo.tipoEspecial === "campo-grid" && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 mt-3 border-t border-slate-100">
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Localidade</span>
                                <span className="text-xs font-semibold text-slate-800">Concessionária &amp; Cidade</span>
                              </div>
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Período Previsto</span>
                                <span className="text-xs font-semibold text-slate-800">Data Início e Término</span>
                              </div>
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Carga Horária</span>
                                <span className="text-xs font-semibold text-slate-800">Módulos de 8h, 24h ou 40h</span>
                              </div>
                            </div>
                          )}

                          {/* Widget Especial: Regra Fiscal Sócio Consultor (Step 3 Projetos) */}
                          {passo.tipoEspecial === "regra-fiscal" && (
                            <div className="mt-3.5 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex items-start gap-3 shadow-xs">
                              <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                                %
                              </div>
                              <div className="text-xs text-amber-950 leading-relaxed">
                                <span className="font-bold text-amber-900">Regra Fiscal Sócio Consultor:</span> Caso o instrutor alocado seja registrado na modalidade <strong className="font-semibold text-amber-950">Sócio Consultor emitindo Nota Fiscal (NF)</strong>, o sistema calcula e acrescenta automaticamente <strong className="font-semibold text-amber-950">+6% sobre o repasse bruto</strong> para fins de equilíbrio tributário.
                              </div>
                            </div>
                          )}

                          {/* Widget Especial: Grade de Modais de Logística (Step 4 Projetos) */}
                          {passo.tipoEspecial === "logistica-grid" && (
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 mt-3 border-t border-slate-100">
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs font-semibold text-slate-700">
                                <span className="material-symbols-outlined text-sky-600 text-sm">flight</span>
                                <span>Aéreo</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs font-semibold text-slate-700">
                                <span className="material-symbols-outlined text-sky-600 text-sm">hotel</span>
                                <span>Hotel</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs font-semibold text-slate-700">
                                <span className="material-symbols-outlined text-sky-600 text-sm">directions_car</span>
                                <span>Carro / Traslado</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs font-semibold text-slate-700">
                                <span className="material-symbols-outlined text-sky-600 text-sm">health_and_safety</span>
                                <span>Seguro Viagem</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs font-semibold text-slate-700 col-span-2 sm:col-span-1">
                                <span className="material-symbols-outlined text-sky-600 text-sm">restaurant</span>
                                <span>Diárias &amp; KM</span>
                              </div>
                            </div>
                          )}

                          {/* Dica Geral / Dica de Produtividade */}
                          {passo.dica && passo.tipoEspecial !== "regra-fiscal" && (
                            <div className="mt-3.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3">
                              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-sm">lightbulb</span>
                              </div>
                              <div className="text-xs text-amber-950 font-medium leading-relaxed">
                                <span className="font-bold">Dica de Produtividade:</span> {passo.dica}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Additional Resources & Official Documents Section */}
                <section className="mt-8 pt-6 border-t border-slate-200/80">
                  <div className="flex items-center gap-2 mb-3.5">
                    <span className="material-symbols-outlined text-slate-400 text-sm">attach_file</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Documentos e Políticas Vinculadas
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <a
                      href="/politicas/NNOS-Politica-Viagens-Geral.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate group-hover:text-[#0284c7]">
                            Fluxograma Oficial
                          </div>
                          <div className="text-[10px] text-slate-400">PDF • 1.4 MB</div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-xs text-slate-300 group-hover:text-[#0284c7] transition-colors">
                        download
                      </span>
                    </a>

                    <Link
                      href="/tabela-precos"
                      onClick={aoFechar}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-base">table_chart</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate group-hover:text-[#0284c7]">
                            Tabela Preços 2026
                          </div>
                          <div className="text-[10px] text-slate-400">Tarifas homologadas</div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-xs text-slate-300 group-hover:text-[#0284c7] transition-colors">
                        arrow_forward
                      </span>
                    </Link>

                    <Link
                      href="/consultor/viagens"
                      onClick={aoFechar}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 text-[#0284c7] flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-base">explore</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate group-hover:text-[#0284c7]">
                            Políticas de Viagem
                          </div>
                          <div className="text-[10px] text-slate-400">Diretrizes de reembolso</div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-xs text-slate-300 group-hover:text-[#0284c7] transition-colors">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                </section>

                {/* Regras Importantes & Perguntas Frequentes */}
                {menuAtual.regrasImportantes && menuAtual.regrasImportantes.length > 0 && (
                  <section className="mt-6 p-4 rounded-xl bg-sky-50/50 border border-sky-100">
                    <div className="flex items-center gap-2 mb-2 text-sky-900 font-bold text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-sky-600 text-sm">verified_user</span>
                      <span>Regras &amp; Premissas Obrigatórias</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 pl-5 list-disc">
                      {menuAtual.regrasImportantes.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {menuAtual.faq && menuAtual.faq.length > 0 && (
                  <section className="mt-6">
                    <div className="flex items-center gap-2 mb-3 text-slate-700 font-bold text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-amber-500 text-sm">quiz</span>
                      <span>Dúvidas Frequentes (FAQ)</span>
                    </div>
                    <div className="space-y-2">
                      {menuAtual.faq.map((f, i) => (
                        <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                          <div className="font-bold text-xs text-slate-800 mb-1">{f.pergunta}</div>
                          <div className="text-xs text-slate-600 leading-relaxed">{f.resposta}</div>
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
            <div className="flex-1 flex flex-col w-full h-full overflow-hidden bg-slate-50/60">
              {/* Sub-Header: Status do Agente Online */}
              <div className="px-6 py-2.5 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#0284c7] text-white flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-base">smart_toy</span>
                  </div>
                  <div className="text-xs">
                    <strong className="text-slate-900">Guia Virtual NNÓS</strong>
                    <span className="mx-1.5 text-slate-300">•</span>
                    <span className="text-emerald-600 font-bold">Assistente Online</span>
                    <span className="hidden sm:inline mx-2 text-slate-300"> </span>
                    <span className="hidden sm:inline text-slate-500 text-[11px]">
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
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Reiniciar chat"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  <span>Limpar Conversa</span>
                </button>
              </div>

              {/* Área de Conversa com Scroll */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll-thin">
                {historicoChat.map((msg) => {
                  const ehUsuario = msg.autor === "usuario";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${ehUsuario ? "items-end" : "items-start"}`}
                    >
                      <div className={`flex items-start gap-2.5 max-w-[85%] ${ehUsuario ? "flex-row-reverse" : "flex-row"}`}>
                        {/* Avatar */}
                        {ehUsuario ? (
                          <div className="w-8 h-8 rounded-full bg-[#0b2545] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                            EU
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#0284c7] text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-600/30">
                            <span className="material-symbols-outlined text-base">smart_toy</span>
                          </div>
                        )}

                        {/* Balão de Mensagem */}
                        <div
                          className={`rounded-2xl p-4 shadow-xs text-xs sm:text-[13px] ${
                            ehUsuario
                              ? "bg-[#0b2545] text-white rounded-tr-xs"
                              : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs"
                          }`}
                        >
                          {ehUsuario ? (
                            <div className="whitespace-pre-wrap">{msg.texto}</div>
                          ) : (
                            <ChatMessageContent texto={msg.texto} />
                          )}

                          {/* Link de Rota Sugerida */}
                          {msg.rotaSugerida && (
                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end">
                              <Link
                                href={msg.rotaSugerida}
                                onClick={aoFechar}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-xs transition-colors"
                              >
                                <span>{msg.rotuloRota || "Acessar Módulo"}</span>
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Horário */}
                      <span className="text-[10px] text-slate-400 mt-1 px-11">
                        {msg.dataHora}
                      </span>
                    </div>
                  );
                })}

                {/* Indicador de Digitação / Carregamento */}
                {carregandoIA && (
                  <div className="flex items-start gap-2.5 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-[#0284c7] text-white flex items-center justify-center shrink-0 shadow-sm">
                      <span className="material-symbols-outlined text-base">smart_toy</span>
                    </div>
                    <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-3.5 shadow-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#0284c7] animate-bounce"></span>
                      <span className="w-2 h-2 rounded-full bg-[#0284c7] animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-2 h-2 rounded-full bg-[#0284c7] animate-bounce [animation-delay:0.4s]"></span>
                      <span className="text-xs text-slate-500 font-medium ml-1.5">Consultando base de conhecimento...</span>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Sugestões Rápidas */}
              <div className="px-6 py-2 bg-slate-50/80 border-t border-slate-200/60 flex items-center gap-2 overflow-x-auto shrink-0 custom-scroll-thin">
                <span className="text-[10.5px] font-extrabold text-amber-600 uppercase tracking-wider shrink-0 flex items-center gap-1">
                  ⚡ SUGESTÕES:
                </span>
                {sugestoesRapidas.map((sugestao, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleEnviarPergunta(sugestao)}
                    className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 text-[11px] font-medium hover:border-sky-300 hover:text-[#0284c7] transition-all shrink-0 cursor-pointer shadow-2xs"
                  >
                    {sugestao}
                  </button>
                ))}
              </div>

              {/* Input e Envio da Pergunta */}
              <div className="p-4 sm:px-6 bg-white border-t border-slate-200/80 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleEnviarPergunta();
                  }}
                  className="flex items-center gap-2.5"
                >
                  <div className="relative flex-1 flex items-center">
                    <input
                      type="text"
                      placeholder="Digite sua dúvida sobre qualquer processo ou tela do sistema..."
                      value={inputPergunta}
                      onChange={(e) => setInputPergunta(e.target.value)}
                      disabled={carregandoIA}
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-[#0284c7] transition-all font-medium"
                    />
                    <button
                      type="button"
                      aria-label="Anexo"
                      className="absolute right-2 text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                      title="Anexar arquivo"
                    >
                      <span className="material-symbols-outlined text-base">attach_file</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!inputPergunta.trim() || carregandoIA}
                    className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      inputPergunta.trim() && !carregandoIA
                        ? "bg-[#0b2545] text-white hover:bg-[#0f2a4a] shadow-sm"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <span>Perguntar</span>
                    <span className="material-symbols-outlined text-sm">send</span>
                  </button>
                </form>

                <div className="text-[10px] text-slate-400 text-center mt-2">
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
          <footer className="px-6 sm:px-8 py-3 bg-slate-50 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3 shrink-0 select-none">
            <div className="flex items-center gap-2.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></span>
              <span className="font-medium text-slate-700">Base Homologada • Diretrizes Oficiais NNÓS Consultoria</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 hidden md:inline">Última revisão de processos: Competência Vigente 2026</span>
              <button
                type="button"
                onClick={() => setAbaAtiva("IA")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0284c7] hover:text-[#0369a1] transition-colors hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">chat</span>
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
