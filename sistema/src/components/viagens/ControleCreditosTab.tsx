"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import ModernDropdown from "@/components/ModernDropdown";
import { formatarDataBR, formatarPeriodoBR } from "@/lib/date-utils";
import { usePerfilAcesso } from "@/contexts/PerfilAcessoContext";
import { ViagensPerfil } from "./ViagensRoleSelector";
import ccBase from "@/lib/centros-de-custo.json";

export interface CreditoLogistica {
  id: string;
  projeto: string;
  dataInicial: string;
  dataFinal: string;
  instrutor: string;
  ciaAereaHotel: string;
  valor: number;
  multaTaxa: number;
  credito: number;
  notaDebito: string;
  creditoUtilizado: "SIM" | "NÃO";
  projetoUtilizado: string;
  dataInicialUtilizacao: string;
  dataFinalUtilizacao: string;
  observacoes?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

interface ControleCreditosTabProps {
  perfilAtivo: ViagensPerfil;
  showToast: (msg: string) => void;
  onResumoChange?: (resumo: { qtdDisponiveis: number; saldoDisponivel: number }) => void;
  resetFiltroTrigger?: number;
}

function normalizarTexto(str?: string | null): string {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function calcularDiasSemUtilizacao(
  creditoUtilizado: "SIM" | "NÃO",
  dataInicial?: string,
  dataFinal?: string
): {
  texto: string;
  dias: number | null;
  alertaExpiracao: boolean;
  expirado: boolean;
} {
  if (creditoUtilizado === "SIM") {
    return { texto: "CONCLUÍDO", dias: null, alertaExpiracao: false, expirado: false };
  }
  const refStr = (dataFinal || dataInicial || "").trim();
  if (!refStr || !/^\d{4}-\d{2}-\d{2}/.test(refStr)) {
    return { texto: "EM ABERTO", dias: null, alertaExpiracao: false, expirado: false };
  }
  const [y, m, d] = refStr.slice(0, 10).split("-").map(Number);
  const dataRef = Date.UTC(y, m - 1, d);
  const agora = new Date();
  const hojeUTC = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diffDias = Math.max(0, Math.floor((hojeUTC - dataRef) / 86400000));
  const expirado = diffDias > 365;
  return {
    texto: `${diffDias} DIAS`,
    dias: diffDias,
    alertaExpiracao: diffDias >= 300,
    expirado,
  };
}

export function isCreditoExpirado(item: Pick<CreditoLogistica, "creditoUtilizado" | "dataInicial" | "dataFinal">): boolean {
  return calcularDiasSemUtilizacao(item.creditoUtilizado, item.dataInicial, item.dataFinal).expirado;
}

export default function ControleCreditosTab({
  perfilAtivo,
  showToast,
  onResumoChange,
  resetFiltroTrigger,
}: ControleCreditosTabProps) {
  const { perfilAtivoId, pertenceAoLiderAtivo, liderSimulado, listaLideres } = usePerfilAcesso();

  const [creditos, setCreditos] = useState<CreditoLogistica[]>([]);
  const [projetosBase, setProjetosBase] = useState<string[]>([]);
  const [consultoresBase, setConsultoresBase] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Filtros (fixado por padrão em "DISPONIVEL_VALIDO" = Somente Créditos Disponíveis para Uso <= 1 ano)
  const [busca, setBusca] = useState("");
  const [filtroProjeto, setFiltroProjeto] = useState<string>("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<string>("DISPONIVEL_VALIDO");
  const [filtroCia, setFiltroCia] = useState<string>("TODAS");
  const [filtroLider, setFiltroLider] = useState<string>("TODOS");

  // Sempre que o usuário clicar no botão "Logística · Controle de Crédito", garante que o filtro inicie em Disponíveis para Uso
  useEffect(() => {
    if (resetFiltroTrigger !== undefined) {
      setFiltroStatus("DISPONIVEL_VALIDO");
    }
  }, [resetFiltroTrigger]);

  // Modal de Criação / Edição / Baixa
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<string | null>(null);

  // Campos do formulário
  const [formProjeto, setFormProjeto] = useState("");
  const [formDataInicial, setFormDataInicial] = useState("");
  const [formDataFinal, setFormDataFinal] = useState("");
  const [formInstrutor, setFormInstrutor] = useState("");
  const [formCia, setFormCia] = useState("AZUL");
  const [formValor, setFormValor] = useState("");
  const [formMultaTaxa, setFormMultaTaxa] = useState("");
  const [formNotaDebito, setFormNotaDebito] = useState("");
  const [formCreditoUtilizado, setFormCreditoUtilizado] = useState<"SIM" | "NÃO">("NÃO");
  const [formProjetoUtilizado, setFormProjetoUtilizado] = useState("");
  const [formDataInicialUso, setFormDataInicialUso] = useState("");
  const [formDataFinalUso, setFormDataFinalUso] = useState("");
  const [formObservacoes, setFormObservacoes] = useState("");

  const brl = (v: number) =>
    (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Mapa de Projeto -> Líder de Projeto (a partir da base oficial de Centro de Custo)
  const mapaLiderPorProjeto = useMemo(() => {
    const mapa = new Map<string, string>();
    const centros =
      (ccBase as { centrosDeCusto?: { projeto?: string; liderProjeto?: string }[] })
        ?.centrosDeCusto || [];
    for (const c of centros) {
      const p = normalizarTexto(c.projeto);
      const l = String(c.liderProjeto || "").trim().toUpperCase();
      if (p && l && l !== "-" && l !== "—") {
        mapa.set(p, l);
      }
    }
    return mapa;
  }, []);

  const obterLiderDoProjeto = useCallback(
    (nomeProjeto?: string) => {
      if (!nomeProjeto) return "";
      const norm = normalizarTexto(nomeProjeto);
      const exato = mapaLiderPorProjeto.get(norm);
      if (exato) return exato;
      for (const [projKey, liderVal] of mapaLiderPorProjeto.entries()) {
        if (projKey.includes(norm) || norm.includes(projKey)) {
          return liderVal;
        }
      }
      return "";
    },
    [mapaLiderPorProjeto]
  );

  const carregarDados = useCallback(async () => {
    try {
      const res = await fetch(`/api/viagens/creditos?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        if (Array.isArray(data.creditos)) setCreditos(data.creditos);
        if (Array.isArray(data.projetos)) setProjetosBase(data.projetos);
        if (Array.isArray(data.consultores)) setConsultoresBase(data.consultores);
      }
    } catch (err) {
      console.warn("Erro ao carregar controle de créditos:", err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Verifica se a visão atual está restrita a Líder de Projeto
  const isVisaoLider = perfilAtivoId === "LIDER" || (perfilAtivoId === "ADMIN" && perfilAtivo === "LIDER");

  // Verifica se o perfil atual pode alimentar / editar créditos (Agência, Admin, Financeiro, Diretoria)
  const podeAlimentar =
    perfilAtivo === "AGENCIA" ||
    perfilAtivoId === "AGENCIA" ||
    (perfilAtivoId === "ADMIN" && perfilAtivo !== "LIDER" && perfilAtivo !== "CONSULTOR") ||
    perfilAtivoId === "FINANCEIRO" ||
    perfilAtivoId === "DIRETORIA";

  // Escopo filtrado pelo Líder ativo quando em visão de Líder
  const creditosEscopo = useMemo(() => {
    if (!isVisaoLider) return creditos;
    return creditos.filter((c) => {
      const pertenceOrigem = c.projeto ? pertenceAoLiderAtivo(c.projeto) : false;
      const pertenceDestino = c.projetoUtilizado ? pertenceAoLiderAtivo(c.projetoUtilizado) : false;
      return pertenceOrigem || pertenceDestino;
    });
  }, [creditos, isVisaoLider, pertenceAoLiderAtivo]);

  // Informa o resumo de créditos disponíveis (apenas não utilizados e dentro da validade de 1 ano) para o badge da aba superior
  useEffect(() => {
    if (!onResumoChange) return;
    const disponiveis = creditosEscopo.filter((c) => c.creditoUtilizado === "NÃO" && !isCreditoExpirado(c));
    const saldoDisponivel = disponiveis.reduce((acc, c) => acc + (Number(c.credito) || 0), 0);
    onResumoChange({
      qtdDisponiveis: disponiveis.length,
      saldoDisponivel,
    });
  }, [creditosEscopo, onResumoChange]);

  // Opções dinâmicas de Projetos disponíveis no filtro (respeitando o escopo do Líder)
  const opcoesFiltroProjeto = useMemo(() => {
    const projs = new Set<string>();
    for (const c of creditosEscopo) {
      if (c.projeto) projs.add(c.projeto);
      if (c.projetoUtilizado) projs.add(c.projetoUtilizado);
    }
    for (const p of projetosBase) {
      if (!isVisaoLider || pertenceAoLiderAtivo(p)) {
        projs.add(p);
      }
    }
    const ordenados = Array.from(projs).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [
      { value: "TODOS", label: "Todos os Projetos" },
      ...ordenados.map((p) => ({ value: p, label: p })),
    ];
  }, [creditosEscopo, projetosBase, isVisaoLider, pertenceAoLiderAtivo]);

  // Opções de Cia Aérea / Hotel
  const opcoesFiltroCia = useMemo(() => {
    const cias = new Set<string>(["AZUL", "TAM", "GOL", "HOTEL"]);
    for (const c of creditosEscopo) {
      if (c.ciaAereaHotel) cias.add(c.ciaAereaHotel.toUpperCase());
    }
    return [
      { value: "TODAS", label: "Todas Cias / Hotéis" },
      ...Array.from(cias)
        .sort()
        .map((cia) => ({ value: cia, label: cia })),
    ];
  }, [creditosEscopo]);

  // Opções de Líder de Projeto (para filtro rápido quando não está restrito a um único líder)
  const opcoesFiltroLider = useMemo(() => {
    const lideres = new Set<string>();
    for (const l of listaLideres || []) {
      if (l.nome) lideres.add(l.nome.toUpperCase());
    }
    for (const c of creditos) {
      const l = obterLiderDoProjeto(c.projeto) || obterLiderDoProjeto(c.projetoUtilizado);
      if (l) lideres.add(l);
    }
    return [
      { value: "TODOS", label: "Todos os Líderes" },
      ...Array.from(lideres)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((l) => ({ value: l, label: `Líder: ${l}` })),
    ];
  }, [listaLideres, creditos, obterLiderDoProjeto]);

  // Base filtrada por escopo, líder, projeto, cia e busca (independente do filtroStatus para manter os 4 KPIs sempre visíveis)
  const creditosBaseKpi = useMemo(() => {
    return creditosEscopo.filter((c) => {
      if (filtroCia !== "TODAS" && c.ciaAereaHotel.toUpperCase() !== filtroCia) {
        return false;
      }
      if (filtroProjeto !== "TODOS") {
        const matchOrigem = normalizarTexto(c.projeto) === normalizarTexto(filtroProjeto);
        const matchUso = normalizarTexto(c.projetoUtilizado) === normalizarTexto(filtroProjeto);
        if (!matchOrigem && !matchUso) return false;
      }
      if (!isVisaoLider && filtroLider !== "TODOS") {
        const liderOrigem = obterLiderDoProjeto(c.projeto);
        const liderUso = obterLiderDoProjeto(c.projetoUtilizado);
        const alvo = normalizarTexto(filtroLider);
        if (normalizarTexto(liderOrigem) !== alvo && normalizarTexto(liderUso) !== alvo) {
          return false;
        }
      }
      if (busca.trim()) {
        const termo = normalizarTexto(busca);
        const mProj = normalizarTexto(c.projeto).includes(termo);
        const mProjUso = normalizarTexto(c.projetoUtilizado).includes(termo);
        const mInst = normalizarTexto(c.instrutor).includes(termo);
        const mCia = normalizarTexto(c.ciaAereaHotel).includes(termo);
        const mNd = normalizarTexto(c.notaDebito).includes(termo);
        const mObs = normalizarTexto(c.observacoes).includes(termo);
        return mProj || mProjUso || mInst || mCia || mNd || mObs;
      }
      return true;
    });
  }, [creditosEscopo, filtroCia, filtroProjeto, filtroLider, isVisaoLider, busca, obterLiderDoProjeto]);

  // Lista final filtrada pelo Status selecionado (padrão: "NÃO" = Não utilizados, incluindo válidos e expirados; ou filtro específico)
  const creditosFiltrados = useMemo(() => {
    if (filtroStatus === "TODOS") return creditosBaseKpi;
    if (filtroStatus === "DISPONIVEL_VALIDO") {
      return creditosBaseKpi.filter((c) => c.creditoUtilizado === "NÃO" && !isCreditoExpirado(c));
    }
    if (filtroStatus === "EXPIRADO") {
      return creditosBaseKpi.filter((c) => c.creditoUtilizado === "NÃO" && isCreditoExpirado(c));
    }
    return creditosBaseKpi.filter((c) => c.creditoUtilizado === filtroStatus);
  }, [creditosBaseKpi, filtroStatus]);

  // KPIs calculados sobre a base filtrada (separando Saldo Disponível válido <= 365 dias dos Créditos Expirados > 365 dias)
  const kpis = useMemo(() => {
    const totalRegistros = creditosBaseKpi.length;
    const disponiveisValidos = creditosBaseKpi.filter((c) => c.creditoUtilizado === "NÃO" && !isCreditoExpirado(c));
    const expirados = creditosBaseKpi.filter((c) => c.creditoUtilizado === "NÃO" && isCreditoExpirado(c));
    const utilizados = creditosBaseKpi.filter((c) => c.creditoUtilizado === "SIM");

    const valorOriginalTotal = creditosBaseKpi.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const multaTotal = creditosBaseKpi.reduce((acc, c) => acc + (Number(c.multaTaxa) || 0), 0);
    const creditoTotal = creditosBaseKpi.reduce((acc, c) => acc + (Number(c.credito) || 0), 0);
    const saldoDisponivel = disponiveisValidos.reduce((acc, c) => acc + (Number(c.credito) || 0), 0);
    const saldoExpirado = expirados.reduce((acc, c) => acc + (Number(c.credito) || 0), 0);
    const saldoUtilizado = utilizados.reduce((acc, c) => acc + (Number(c.credito) || 0), 0);

    return {
      totalRegistros,
      qtdDisponiveis: disponiveisValidos.length,
      qtdExpirados: expirados.length,
      qtdUtilizados: utilizados.length,
      valorOriginalTotal,
      multaTotal,
      creditoTotal,
      saldoDisponivel,
      saldoExpirado,
      saldoUtilizado,
    };
  }, [creditosBaseKpi]);

  // Cálculo automático do Crédito Líquido no formulário
  const creditoLiquidoForm = useMemo(() => {
    const v = parseFloat(String(formValor).replace(",", ".")) || 0;
    const m = parseFloat(String(formMultaTaxa).replace(",", ".")) || 0;
    return Math.max(0, Math.round((v - m) * 100) / 100);
  }, [formValor, formMultaTaxa]);

  const abrirModalNovo = () => {
    setEditandoId(null);
    setFormProjeto(filtroProjeto !== "TODOS" ? filtroProjeto : projetosBase[0] || "");
    setFormDataInicial("");
    setFormDataFinal("");
    setFormInstrutor(consultoresBase[0] || "");
    setFormCia("AZUL");
    setFormValor("");
    setFormMultaTaxa("");
    setFormNotaDebito("");
    setFormCreditoUtilizado("NÃO");
    setFormProjetoUtilizado("");
    setFormDataInicialUso("");
    setFormDataFinalUso("");
    setFormObservacoes("");
    setModalAberto(true);
  };

  const abrirModalEditar = (item: CreditoLogistica, preMarcarUtilizado = false) => {
    const expirado = isCreditoExpirado(item);
    if (preMarcarUtilizado && expirado) {
      showToast("Este crédito possui mais de 1 ano (365 dias) e está expirado / indisponível para uso.");
      return;
    }
    setEditandoId(item.id);
    setFormProjeto(item.projeto || "");
    setFormDataInicial(item.dataInicial || "");
    setFormDataFinal(item.dataFinal || "");
    setFormInstrutor(item.instrutor || "");
    setFormCia(item.ciaAereaHotel || "AZUL");
    setFormValor(item.valor ? String(item.valor) : "");
    setFormMultaTaxa(item.multaTaxa ? String(item.multaTaxa) : "0");
    setFormNotaDebito(item.notaDebito || "");
    setFormCreditoUtilizado(preMarcarUtilizado && !expirado ? "SIM" : item.creditoUtilizado);
    setFormProjetoUtilizado(
      item.projetoUtilizado || (preMarcarUtilizado ? item.projeto : "")
    );
    setFormDataInicialUso(item.dataInicialUtilizacao || "");
    setFormDataFinalUso(item.dataFinalUtilizacao || "");
    setFormObservacoes(item.observacoes || "");
    setModalAberto(true);
  };

  const handleSalvarFormulario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formInstrutor.trim()) {
      alert("Selecione ou informe o Instrutor / Consultor.");
      return;
    }
    const valorNum = parseFloat(String(formValor).replace(",", ".")) || 0;
    const multaNum = parseFloat(String(formMultaTaxa).replace(",", ".")) || 0;
    if (valorNum <= 0) {
      alert("Informe o Valor original da passagem/hospedagem.");
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        id: editandoId || undefined,
        projeto: formProjeto.trim().toUpperCase(),
        dataInicial: formDataInicial,
        dataFinal: formDataFinal || formDataInicial,
        instrutor: formInstrutor.trim().toUpperCase(),
        ciaAereaHotel: formCia.trim().toUpperCase(),
        valor: valorNum,
        multaTaxa: multaNum,
        credito: creditoLiquidoForm,
        notaDebito: formNotaDebito.trim(),
        creditoUtilizado: formCreditoUtilizado,
        projetoUtilizado: formCreditoUtilizado === "SIM" ? formProjetoUtilizado.trim().toUpperCase() : "",
        dataInicialUtilizacao: formCreditoUtilizado === "SIM" ? formDataInicialUso : "",
        dataFinalUtilizacao: formCreditoUtilizado === "SIM" ? formDataFinalUso : "",
        observacoes: formObservacoes.trim(),
        atualizadoPor: perfilAtivo === "AGENCIA" ? "Agência de Viagens" : "Gestão NNÓS",
      };

      const res = await fetch("/api/viagens/creditos", {
        method: editandoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (Array.isArray(data.creditos)) {
          setCreditos(data.creditos);
        } else {
          await carregarDados();
        }
        setModalAberto(false);
        showToast(
          editandoId
            ? "Registro de crédito atualizado com sucesso!"
            : "Novo crédito de logística registrado com sucesso!"
        );
      } else {
        alert(data.error || "Erro ao salvar registro de crédito.");
      }
    } catch (err) {
      console.error("Erro ao salvar crédito:", err);
      alert("Erro de comunicação ao salvar crédito.");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id: string) => {
    try {
      const res = await fetch(`/api/viagens/creditos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (Array.isArray(data.creditos)) setCreditos(data.creditos);
        setConfirmandoExclusaoId(null);
        showToast("Registro de crédito removido.");
      }
    } catch (err) {
      console.error("Erro ao excluir crédito:", err);
    }
  };

  const getCiaBadgeStyle = (cia: string) => {
    const c = (cia || "").toUpperCase();
    if (c.includes("AZUL")) {
      return { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd", icone: "flight" };
    }
    if (c.includes("TAM") || c.includes("LATAM")) {
      return { bg: "#fce7f3", color: "#be123c", border: "#fbcfe8", icone: "flight" };
    }
    if (c.includes("GOL")) {
      return { bg: "#ffedd5", color: "#c2410c", border: "#fed7aa", icone: "flight" };
    }
    if (c.includes("HOTEL")) {
      return { bg: "#ede9fe", color: "#6d28d9", border: "#ddd6fe", icone: "hotel" };
    }
    return { bg: "#f1f5f9", color: "#334155", border: "#e2e8f0", icone: "confirmation_number" };
  };

  const opcoesFormProjeto = useMemo(() => {
    const lista = Array.from(
      new Set([
        ...projetosBase,
        ...(formProjeto ? [formProjeto] : []),
        ...(formProjetoUtilizado ? [formProjetoUtilizado] : []),
      ])
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [
      { value: "", label: "Sem projeto definido / A definir" },
      ...lista.map((p) => ({ value: p, label: p })),
    ];
  }, [projetosBase, formProjeto, formProjetoUtilizado]);

  const opcoesFormInstrutor = useMemo(() => {
    const lista = Array.from(
      new Set([...consultoresBase, ...(formInstrutor ? [formInstrutor] : [])])
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return lista.map((nome) => ({ value: nome, label: nome }));
  }, [consultoresBase, formInstrutor]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Banner Contextual por Perfil */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(15, 42, 74, 0.06) 0%, rgba(0, 168, 150, 0.06) 100%)",
          border: "1px solid rgba(15, 42, 74, 0.18)",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "var(--primary, #0f2a4a)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
              credit_score
            </span>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "14px", color: "var(--on-surface)" }}>
                Logística · Controle de Créditos (Cia Aérea & Hotel)
              </strong>
              {isVisaoLider && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    backgroundColor: "rgba(2, 132, 199, 0.12)",
                    color: "#0369a1",
                  }}
                >
                  Escopo do Líder: {liderSimulado}
                </span>
              )}
            </div>
            <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
              {podeAlimentar
                ? "Painel alimentado pela Agência de Viagens: cadastre créditos gerados por cancelamentos/remarcações, calcule multas e dê baixa quando o crédito for reaproveitado em um projeto."
                : "Consulte os créditos gerados por remarcações ou cancelamentos nos projetos da sua carteira, acompanhe os dias em aberto e veja onde cada crédito foi reaproveitado."}
            </p>
          </div>
        </div>

        {podeAlimentar && (
          <button
            type="button"
            onClick={abrirModalNovo}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 16px",
              borderRadius: "10px",
              backgroundColor: "var(--primary, #0f2a4a)",
              color: "#ffffff",
              fontSize: "12.5px",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(15, 42, 74, 0.18)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              add_card
            </span>
            <span>+ Lançar Novo Crédito</span>
          </button>
        )}
      </div>

      {/* Cards de KPIs de Créditos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        {/* 1. Saldo Disponível para Uso (Válidos <= 1 ano) */}
        <div
          onClick={() => setFiltroStatus(filtroStatus === "DISPONIVEL_VALIDO" ? "TODOS" : "DISPONIVEL_VALIDO")}
          style={{
            background: "var(--surface)",
            border:
              filtroStatus === "DISPONIVEL_VALIDO"
                ? "2px solid #d97706"
                : "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "#d97706",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              Saldo de Crédito Disponível
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#d97706" }}>
              account_balance_wallet
            </span>
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "6px", color: "#d97706" }}>
            {brl(kpis.saldoDisponivel)}
          </div>
          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
            {kpis.qtdDisponiveis} disponível(is) p/ uso (&le; 1 ano)
            {kpis.qtdExpirados > 0 ? ` • ${kpis.qtdExpirados} expirado(s) (${brl(kpis.saldoExpirado)})` : ""}
          </span>
        </div>

        {/* 2. Créditos Já Utilizados (SIM) */}
        <div
          onClick={() => setFiltroStatus(filtroStatus === "SIM" ? "TODOS" : "SIM")}
          style={{
            background: "var(--surface)",
            border:
              filtroStatus === "SIM"
                ? "2px solid #059669"
                : "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "#059669",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              Créditos Reaproveitados (SIM)
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#059669" }}>
              task_alt
            </span>
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "6px", color: "#059669" }}>
            {brl(kpis.saldoUtilizado)}
          </div>
          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
            {kpis.qtdUtilizados} crédito(s) concluído(s)
          </span>
        </div>

        {/* 3. Total Geral de Créditos Gerados */}
        <div
          onClick={() => setFiltroStatus("TODOS")}
          style={{
            background: "var(--surface)",
            border:
              filtroStatus === "TODOS"
                ? "2px solid var(--primary, #0f2a4a)"
                : "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "var(--primary, #0f2a4a)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              Total Líquido em Créditos
            </span>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "18px", color: "var(--primary, #0f2a4a)" }}
            >
              savings
            </span>
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 900,
              marginTop: "6px",
              color: "var(--on-surface)",
            }}
          >
            {brl(kpis.creditoTotal)}
          </div>
          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
            {kpis.totalRegistros} registro(s) no filtro atual
          </span>
        </div>

        {/* 4. Valor Original & Multas + Taxas */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "var(--on-surface-variant)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              Multas + Taxas Retidas
            </span>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "18px", color: "#dc2626" }}
            >
              receipt_long
            </span>
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "6px", color: "#dc2626" }}>
            {brl(kpis.multaTotal)}
          </div>
          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
            Sobre {brl(kpis.valorOriginalTotal)} em emissões originais
          </span>
        </div>
      </div>

      {/* Barra de Filtros com ModernDropdown */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          background: "var(--surface)",
          padding: "14px 16px",
          borderRadius: "12px",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ flex: "1 1 240px", position: "relative", minWidth: "220px" }}>
          <span
            className="material-symbols-outlined"
            style={{
              position: "absolute",
              left: "12px",
              top: "10px",
              fontSize: "18px",
              color: "var(--on-surface-variant)",
            }}
          >
            search
          </span>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por Projeto, Instrutor, Cia Aérea ou ND..."
            style={{
              width: "100%",
              padding: "8px 12px 8px 38px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              fontSize: "13px",
              backgroundColor: "var(--surface-container-lowest, #ffffff)",
              color: "var(--on-surface)",
            }}
          />
        </div>

        {!isVisaoLider && (
          <ModernDropdown
            value={filtroLider}
            onChange={(val) => setFiltroLider(String(val))}
            options={opcoesFiltroLider}
            icon="supervisor_account"
            minWidth="210px"
            searchable
            searchPlaceholder="Filtrar líder..."
          />
        )}

        <ModernDropdown
          value={filtroProjeto}
          onChange={(val) => setFiltroProjeto(String(val))}
          options={opcoesFiltroProjeto}
          icon="folder_Special"
          minWidth="240px"
          searchable
          searchPlaceholder="Filtrar projeto..."
        />

        <ModernDropdown
          value={filtroStatus}
          onChange={(val) => setFiltroStatus(String(val))}
          options={[
            { value: "DISPONIVEL_VALIDO", label: "Disponíveis para Uso (<= 1 ano)" },
            { value: "EXPIRADO", label: "Expirados / Indisponíveis (> 1 ano)" },
            { value: "NÃO", label: "Não Utilizados (Disponíveis + Expirados)" },
            { value: "SIM", label: "Já Utilizados / Concluídos (SIM)" },
            { value: "TODOS", label: "Crédito Utilizado: Todos" },
          ]}
          icon="filter_alt"
          minWidth="245px"
        />

        <ModernDropdown
          value={filtroCia}
          onChange={(val) => setFiltroCia(String(val))}
          options={opcoesFiltroCia}
          icon="flight_class"
          minWidth="180px"
        />
      </div>

      {/* Tabela Fiel à Aba "Logística - Controle Crédito" */}
      <div
        style={{
          background: "var(--surface-container-lowest, #ffffff)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12.5px",
              minWidth: "1180px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--primary, #0f2a4a)",
                  color: "#ffffff",
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                <th style={{ padding: "12px 14px", textAlign: "center", verticalAlign: "middle" }}>Projeto (Origem)</th>
                <th style={{ padding: "12px 10px", whiteSpace: "nowrap", textAlign: "center", verticalAlign: "middle" }}>Período Original</th>
                <th style={{ padding: "12px 12px", textAlign: "center", verticalAlign: "middle" }}>Instrutor</th>
                <th style={{ padding: "12px 10px", textAlign: "center", verticalAlign: "middle" }}>Cia Aérea / Hotel</th>
                <th style={{ padding: "12px 12px", textAlign: "center", verticalAlign: "middle" }}>Valor</th>
                <th style={{ padding: "12px 12px", textAlign: "center", verticalAlign: "middle" }}>Multa + Taxa</th>
                <th style={{ padding: "12px 12px", textAlign: "center", verticalAlign: "middle" }}>Crédito</th>
                <th style={{ padding: "12px 10px", textAlign: "center", verticalAlign: "middle" }}>Nota de Débito</th>
                <th style={{ padding: "12px 10px", textAlign: "center", verticalAlign: "middle" }}>Crédito Utilizado</th>
                <th style={{ padding: "12px 10px", textAlign: "center", verticalAlign: "middle" }}>Dias sem Utilização</th>
                <th style={{ padding: "12px 14px", textAlign: "center", verticalAlign: "middle" }}>Crédito Utilizado no Projeto / Período</th>
                {podeAlimentar && (
                  <th style={{ padding: "12px 14px", textAlign: "center", verticalAlign: "middle" }}>Ações Agência</th>
                )}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td
                    colSpan={podeAlimentar ? 12 : 11}
                    style={{ padding: "36px", textAlign: "center", color: "var(--on-surface-variant)" }}
                  >
                    Carregando controle de créditos...
                  </td>
                </tr>
              ) : creditosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={podeAlimentar ? 12 : 11}
                    style={{ padding: "42px 20px", textAlign: "center", color: "var(--on-surface-variant)" }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "36px", color: "var(--outline)", display: "block", marginBottom: "8px" }}
                    >
                      credit_card_off
                    </span>
                    <strong style={{ fontSize: "14px", color: "var(--on-surface)" }}>
                      Nenhum registro de crédito encontrado para os filtros selecionados
                    </strong>
                  </td>
                </tr>
              ) : (
                creditosFiltrados.map((item, idx) => {
                  const infoDias = calcularDiasSemUtilizacao(
                    item.creditoUtilizado,
                    item.dataInicial,
                    item.dataFinal
                  );
                  const ciaStyle = getCiaBadgeStyle(item.ciaAereaHotel);
                  const liderProj =
                    obterLiderDoProjeto(item.projeto) || obterLiderDoProjeto(item.projetoUtilizado);
                  const periodoOrig =
                    item.dataInicial || item.dataFinal
                      ? formatarPeriodoBR(item.dataInicial, item.dataFinal)
                      : "—";
                  const periodoUso =
                    item.dataInicialUtilizacao || item.dataFinalUtilizacao
                      ? formatarPeriodoBR(item.dataInicialUtilizacao, item.dataFinalUtilizacao)
                      : "";

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid var(--border, #e2e8f0)",
                        backgroundColor:
                          idx % 2 === 0
                            ? "var(--surface-container-lowest, #ffffff)"
                            : "var(--surface-container-low, #f8fafc)",
                      }}
                    >
                      {/* 1. PROJETO */}
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--on-surface)", textAlign: "center", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
                          <span>
                            {item.projeto || (
                              <span style={{ color: "#d97706", fontStyle: "italic", fontWeight: 600 }}>
                                A definir pela Agência
                              </span>
                            )}
                          </span>
                          {liderProj && (
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 600,
                                color: "var(--on-surface-variant)",
                              }}
                            >
                              Líder: {liderProj}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. DATA INICIAL a DATA FINAL (Formato Brasileiro DD/MM/AAAA) */}
                      <td
                        style={{
                          padding: "12px 10px",
                          whiteSpace: "nowrap",
                          color: "var(--on-surface-variant)",
                          fontWeight: 600,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
                          <span>{periodoOrig}</span>
                          {item.dataInicial && item.dataFinal && item.dataInicial !== item.dataFinal && (
                            <span style={{ fontSize: "10px", color: "var(--outline)" }}>
                              {formatarDataBR(item.dataInicial)} até {formatarDataBR(item.dataFinal)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. INSTRUTOR */}
                      <td style={{ padding: "12px 12px", fontWeight: 700, color: "var(--on-surface)", textAlign: "center", verticalAlign: "middle" }}>
                        {item.instrutor || "—"}
                      </td>

                      {/* 4. CIA AÉREA / HOTEL */}
                      <td style={{ padding: "12px 10px", textAlign: "center", verticalAlign: "middle" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 800,
                            backgroundColor: ciaStyle.bg,
                            color: ciaStyle.color,
                            border: `1px solid ${ciaStyle.border}`,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                            {ciaStyle.icone}
                          </span>
                          {item.ciaAereaHotel || "—"}
                        </span>
                      </td>

                      {/* 5. VALOR */}
                      <td
                        style={{
                          padding: "12px 12px",
                          textAlign: "center",
                          verticalAlign: "middle",
                          fontWeight: 600,
                          color: "var(--on-surface)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {brl(item.valor)}
                      </td>

                      {/* 6. MULTA + TAXA */}
                      <td
                        style={{
                          padding: "12px 12px",
                          textAlign: "center",
                          verticalAlign: "middle",
                          fontWeight: 600,
                          color: "#dc2626",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {brl(item.multaTaxa)}
                      </td>

                      {/* 7. CRÉDITO */}
                      <td
                        style={{
                          padding: "12px 12px",
                          textAlign: "center",
                          verticalAlign: "middle",
                          fontWeight: 800,
                          color:
                            item.creditoUtilizado === "NÃO"
                              ? infoDias.expirado
                                ? "#94a3b8"
                                : "#d97706"
                              : "var(--primary, #0f2a4a)",
                          textDecoration:
                            item.creditoUtilizado === "NÃO" && infoDias.expirado ? "line-through" : "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {brl(item.credito)}
                      </td>

                      {/* 8. NOTA DE DÉBITO */}
                      <td
                        style={{
                          padding: "12px 10px",
                          textAlign: "center",
                          verticalAlign: "middle",
                          fontWeight: 600,
                          color: "var(--on-surface-variant)",
                        }}
                      >
                        {item.notaDebito ? (
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "6px",
                              backgroundColor: "var(--surface-container)",
                              fontWeight: 700,
                              fontSize: "11px",
                            }}
                          >
                            ND {item.notaDebito}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* 9. CRÉDITO UTILIZADO (SIM / NÃO / EXPIRADO) */}
                      <td style={{ padding: "12px 10px", textAlign: "center", verticalAlign: "middle" }}>
                        {item.creditoUtilizado === "SIM" ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 800,
                              backgroundColor: "#dcfce7",
                              color: "#15803d",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                              check_circle
                            </span>
                            SIM
                          </span>
                        ) : infoDias.expirado ? (
                          <span
                            title="Crédito expirado após 1 ano (365 dias) sem utilização"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 800,
                              backgroundColor: "#fee2e2",
                              color: "#b91c1c",
                              border: "1px solid #fecaca",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                              event_busy
                            </span>
                            EXPIRADO
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 800,
                              backgroundColor: "#fef3c7",
                              color: "#b45309",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                              schedule
                            </span>
                            NÃO
                          </span>
                        )}
                      </td>

                      {/* 10. DIAS SEM UTILIZAÇÃO */}
                      <td style={{ padding: "12px 10px", textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        {item.creditoUtilizado === "SIM" ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 800,
                              color: "#059669",
                              letterSpacing: "0.02em",
                            }}
                          >
                            CONCLUÍDO
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 800,
                              backgroundColor: infoDias.expirado
                                ? "#fee2e2"
                                : infoDias.alertaExpiracao
                                ? "#fef3c7"
                                : "#f1f5f9",
                              color: infoDias.expirado
                                ? "#b91c1c"
                                : infoDias.alertaExpiracao
                                ? "#b45309"
                                : "#334155",
                            }}
                            title={
                              infoDias.expirado
                                ? "Expirado: mais de 1 ano (365 dias) sem utilização — indisponível para uso"
                                : infoDias.alertaExpiracao
                                ? "Atenção: crédito próximo de completar 1 ano (mais de 300 dias sem utilização)"
                                : "Dias corridos desde a data da viagem original"
                            }
                          >
                            {(infoDias.expirado || infoDias.alertaExpiracao) && (
                              <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                                {infoDias.expirado ? "block" : "warning"}
                              </span>
                            )}
                            {infoDias.texto}
                          </span>
                        )}
                      </td>

                      {/* 11. CRÉDITO UTILIZADO NO PROJETO / DATAS */}
                      <td style={{ padding: "12px 14px", textAlign: "center", verticalAlign: "middle" }}>
                        {item.creditoUtilizado === "SIM" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, color: "var(--on-surface)" }}>
                              {item.projetoUtilizado || item.projeto || "Utilizado (mesmo projeto)"}
                            </span>
                            {periodoUso && (
                              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                                Período: {periodoUso}
                              </span>
                            )}
                          </div>
                        ) : infoDias.expirado ? (
                          <span
                            style={{
                              fontSize: "11.5px",
                              fontWeight: 700,
                              color: "#b91c1c",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                              cancel
                            </span>
                            Expirado • Indisponível para uso
                          </span>
                        ) : (
                          <span style={{ fontSize: "11.5px", color: "var(--on-surface-variant)" }}>
                            Disponível para abatimento
                          </span>
                        )}
                        {item.observacoes && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--on-surface-variant)",
                              marginTop: "2px",
                              fontStyle: "italic",
                            }}
                          >
                            Obs: {item.observacoes}
                          </div>
                        )}
                      </td>

                      {/* 12. AÇÕES DA AGÊNCIA */}
                      {podeAlimentar && (
                        <td style={{ padding: "12px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            {item.creditoUtilizado === "NÃO" && !infoDias.expirado && (
                              <button
                                type="button"
                                onClick={() => abrirModalEditar(item, true)}
                                title="Registrar utilização deste crédito em um projeto"
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #059669",
                                  backgroundColor: "#ecfdf5",
                                  color: "#047857",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                  redeem
                                </span>
                                Usar Crédito
                              </button>
                            )}
                            {item.creditoUtilizado === "NÃO" && infoDias.expirado && (
                              <button
                                type="button"
                                disabled
                                title="Crédito expirado após o período de 1 ano (365 dias) e indisponível para uso"
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  backgroundColor: "#f1f5f9",
                                  color: "#94a3b8",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "not-allowed",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                  block
                                </span>
                                Indisponível
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => abrirModalEditar(item, false)}
                              title="Editar informações do crédito"
                              style={{
                                padding: "5px 8px",
                                borderRadius: "6px",
                                border: "1px solid var(--border)",
                                backgroundColor: "var(--surface)",
                                color: "var(--on-surface)",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                                edit
                              </span>
                            </button>
                            {confirmandoExclusaoId === item.id ? (
                              <button
                                type="button"
                                onClick={() => handleExcluir(item.id)}
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #dc2626",
                                  backgroundColor: "#dc2626",
                                  color: "#ffffff",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Confirmar?
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmandoExclusaoId(item.id)}
                                title="Excluir lançamento"
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #fecaca",
                                  backgroundColor: "#fef2f2",
                                  color: "#dc2626",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                                  delete
                                </span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Agência Alimentar / Editar Crédito */}
      {modalAberto && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1200 }}
          onClick={() => !salvando && setModalAberto(false)}
        >
          <div
            className="modal-card"
            style={{ maxWidth: "680px", width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                  credit_score
                </span>
                <span>
                  {editandoId
                    ? "Atualizar / Dar Baixa em Crédito de Viagem"
                    : "Lançar Novo Crédito de Logística"}
                </span>
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setModalAberto(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSalvarFormulario}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Bloco 1: Origem do Crédito */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr",
                    gap: "12px",
                    alignItems: "end",
                  }}
                >
                  <div className="form-field">
                    <label>Projeto (Origem do Crédito)</label>
                    <ModernDropdown
                      value={formProjeto}
                      onChange={(val) => setFormProjeto(String(val))}
                      options={opcoesFormProjeto}
                      icon="folder"
                      searchable
                      searchPlaceholder="Buscar projeto..."
                      style={{ width: "100%" }}
                      buttonStyle={{ height: "37px" }}
                    />
                  </div>

                  <div className="form-field">
                    <label>Instrutor / Viajante *</label>
                    <ModernDropdown
                      value={formInstrutor}
                      onChange={(val) => setFormInstrutor(String(val))}
                      options={opcoesFormInstrutor}
                      icon="person"
                      searchable
                      searchPlaceholder="Buscar instrutor..."
                      style={{ width: "100%" }}
                      buttonStyle={{ height: "37px" }}
                    />
                  </div>
                </div>

                {/* Período Original + Cia Aérea / Hotel + Nota de Débito */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    gap: "12px",
                    alignItems: "end",
                  }}
                >
                  <div className="form-field">
                    <label style={{ whiteSpace: "nowrap" }}>Data Inicial (Original)</label>
                    <input
                      type="date"
                      value={formDataInicial}
                      onChange={(e) => setFormDataInicial(e.target.value)}
                      style={{ height: "37px" }}
                    />
                  </div>
                  <div className="form-field">
                    <label style={{ whiteSpace: "nowrap" }}>Data Final (Original)</label>
                    <input
                      type="date"
                      value={formDataFinal}
                      onChange={(e) => setFormDataFinal(e.target.value)}
                      style={{ height: "37px" }}
                    />
                  </div>
                  <div className="form-field">
                    <label style={{ whiteSpace: "nowrap" }}>Cia Aérea / Hotel *</label>
                    <ModernDropdown
                      value={formCia}
                      onChange={(val) => setFormCia(String(val))}
                      options={[
                        { value: "AZUL", label: "AZUL" },
                        { value: "TAM", label: "TAM / LATAM" },
                        { value: "GOL", label: "GOL" },
                        { value: "HOTEL", label: "HOTEL" },
                      ]}
                      icon="flight"
                      style={{ width: "100%" }}
                      buttonStyle={{ height: "37px" }}
                    />
                  </div>
                  <div className="form-field">
                    <label style={{ whiteSpace: "nowrap" }}>Nota de Débito</label>
                    <input
                      type="text"
                      placeholder="Ex: 0845"
                      value={formNotaDebito}
                      onChange={(e) => setFormNotaDebito(e.target.value)}
                      style={{ height: "37px" }}
                    />
                  </div>
                </div>

                {/* Valores Financeiros: Valor, Multa + Taxa e Crédito Calculado */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px",
                    background: "var(--surface-container-low, #f8fafc)",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="form-field">
                    <label>Valor Original (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0,00"
                      value={formValor}
                      onChange={(e) => setFormValor(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Multa + Taxa (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={formMultaTaxa}
                      onChange={(e) => setFormMultaTaxa(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Crédito Líquido Gerado</label>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        backgroundColor: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        color: "#047857",
                        fontWeight: 800,
                        fontSize: "14px",
                      }}
                    >
                      {brl(creditoLiquidoForm)}
                    </div>
                  </div>
                </div>

                  {/* Status de Utilização do Crédito */}
                  {(() => {
                    const infoFormDias = calcularDiasSemUtilizacao(
                      "NÃO",
                      formDataInicial,
                      formDataFinal
                    );
                    const bloqueadoPorExpiracao = infoFormDias.expirado && formCreditoUtilizado === "NÃO";
                    return (
                      <div
                        style={{
                          background:
                            formCreditoUtilizado === "SIM"
                              ? "rgba(5, 150, 105, 0.06)"
                              : bloqueadoPorExpiracao
                              ? "rgba(220, 38, 38, 0.06)"
                              : "rgba(217, 119, 6, 0.06)",
                          border:
                            formCreditoUtilizado === "SIM"
                              ? "1px solid rgba(5, 150, 105, 0.25)"
                              : bloqueadoPorExpiracao
                              ? "1px solid rgba(220, 38, 38, 0.3)"
                              : "1px solid rgba(217, 119, 6, 0.25)",
                          padding: "14px",
                          borderRadius: "10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        {bloqueadoPorExpiracao && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#b91c1c",
                              backgroundColor: "#fee2e2",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: "1px solid #fecaca",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                              event_busy
                            </span>
                            <span>
                              Crédito expirado ({infoFormDias.texto} sem utilização &gt; 1 ano). Indisponível para reaproveitamento.
                            </span>
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "12px", alignItems: "end" }}>
                          <div className="form-field">
                            <label>Crédito Utilizado? *</label>
                            <ModernDropdown
                              value={formCreditoUtilizado}
                              disabled={bloqueadoPorExpiracao}
                              onChange={(val) => {
                                if (val === "SIM" && infoFormDias.expirado) {
                                  showToast("Crédito com mais de 1 ano (365 dias) está expirado e indisponível para uso.");
                                  return;
                                }
                                setFormCreditoUtilizado(val as "SIM" | "NÃO");
                              }}
                              options={
                                bloqueadoPorExpiracao
                                  ? [{ value: "NÃO", label: "EXPIRADO (Indisponível para uso > 1 ano)" }]
                                  : [
                                      { value: "NÃO", label: "NÃO (Disponível em Aberto)" },
                                      { value: "SIM", label: "SIM (Concluído / Reaproveitado)" },
                                    ]
                              }
                              icon={bloqueadoPorExpiracao ? "event_busy" : "check_circle"}
                              style={{ width: "100%" }}
                              buttonStyle={{ height: "37px" }}
                            />
                          </div>

                          {formCreditoUtilizado === "SIM" && (
                            <div className="form-field">
                              <label>Crédito Utilizado no Projeto</label>
                              <ModernDropdown
                                value={formProjetoUtilizado}
                                onChange={(val) => setFormProjetoUtilizado(String(val))}
                                options={opcoesFormProjeto}
                                icon="folder_special"
                                searchable
                                searchPlaceholder="Projeto onde foi utilizado..."
                                style={{ width: "100%" }}
                                buttonStyle={{ height: "37px" }}
                              />
                            </div>
                          )}
                        </div>

                        {formCreditoUtilizado === "SIM" && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div className="form-field">
                              <label>Data Inicial (Viagem de Utilização)</label>
                              <input
                                type="date"
                                value={formDataInicialUso}
                                onChange={(e) => setFormDataInicialUso(e.target.value)}
                              />
                            </div>
                            <div className="form-field">
                              <label>Data Final (Viagem de Utilização)</label>
                              <input
                                type="date"
                                value={formDataFinalUso}
                                onChange={(e) => setFormDataFinalUso(e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* Observações */}
                <div className="form-field">
                  <label>Anotações / Observações da Agência (Localizador / Bilhete / Regras)</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Localizador ABC123, válido até 12 meses após emissão..."
                    value={formObservacoes}
                    onChange={(e) => setFormObservacoes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={salvando}>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    save
                  </span>
                  <span>{salvando ? "Salvando..." : "Salvar Controle de Crédito"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
