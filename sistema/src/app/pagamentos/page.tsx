"use client";

import Link from "next/link";
import React, { useState, useMemo, useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import pagamentosBase from "@/lib/pagamentos-base.json";
import consultoresBase from "@/lib/consultores-base.json";
import ccBase from "@/lib/centros-de-custo.json";
import bms2026Base from "@/lib/bms-2026.json";
import ModernDropdown from "@/components/ModernDropdown";

export interface PagamentoItem {
  id: string;
  realizado: string; // Ex: "JANEIRO" .. "SETEMBRO"
  dataPagto: string; // Ex: "07/10/2026"
  consultor: string;
  tipo: "PARCEIRO" | "SÓCIO" | "FUNCIONÁRIO" | "FORNECEDOR";
  projeto: string;
  numeroNota: string; // Ex: "RDV 11681978", "24", "NF BM 0907"
  tipoDespesa: string; // "Relatório de Viagem (RDV)", "BM Homologado", "Cartão Corporativo", "Acordo Societário", "Outros"
  valor: number;
  status: "Pago" | "A Pagar" | "Cartão Corporativo";
  bm?: string;
  centroCusto: string;
  observacoes?: string;
  categoriaDoc?: typeof CATEGORIAS_DOCUMENTO[number];
}

const CATEGORIAS_DOCUMENTO = [
  "NF",
  "RDV",
  "NNÓS MONEY",
  "PRÓ-LABORE",
  "AJUDA DE CUSTO",
  "APORTE",
] as const;

const ESTILOS_CATEGORIA_DOC: Record<
  typeof CATEGORIAS_DOCUMENTO[number],
  {
    bg: string;
    text: string;
    border: string;
    chipActiveBg: string;
    chipActiveText: string;
    chipInactiveBg: string;
    chipInactiveText: string;
    chipInactiveBorder: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  "NF": {
    bg: "#e0f2fe",
    text: "#0369a1",
    border: "#bae6fd",
    chipActiveBg: "#0284c7",
    chipActiveText: "#ffffff",
    chipInactiveBg: "#f0f9ff",
    chipInactiveText: "#0369a1",
    chipInactiveBorder: "#bae6fd",
    badgeBg: "#e0f2fe",
    badgeText: "#0369a1",
    badgeBorder: "#bae6fd",
  },
  "RDV": {
    bg: "#fef3c7",
    text: "#92400e",
    border: "#fde68a",
    chipActiveBg: "#d97706",
    chipActiveText: "#ffffff",
    chipInactiveBg: "#fffbeb",
    chipInactiveText: "#92400e",
    chipInactiveBorder: "#fde68a",
    badgeBg: "#fef3c7",
    badgeText: "#92400e",
    badgeBorder: "#fde68a",
  },
  "NNÓS MONEY": {
    bg: "#d1fae5",
    text: "#065f46",
    border: "#a7f3d0",
    chipActiveBg: "#059669",
    chipActiveText: "#ffffff",
    chipInactiveBg: "#ecfdf5",
    chipInactiveText: "#065f46",
    chipInactiveBorder: "#a7f3d0",
    badgeBg: "#d1fae5",
    badgeText: "#065f46",
    badgeBorder: "#a7f3d0",
  },
  "PRÓ-LABORE": {
    bg: "#ede9fe",
    text: "#5b21b6",
    border: "#ddd6fe",
    chipActiveBg: "#7c3aed",
    chipActiveText: "#ffffff",
    chipInactiveBg: "#f5f3ff",
    chipInactiveText: "#5b21b6",
    chipInactiveBorder: "#ddd6fe",
    badgeBg: "#ede9fe",
    badgeText: "#5b21b6",
    badgeBorder: "#ddd6fe",
  },
  "AJUDA DE CUSTO": {
    bg: "#cffafe",
    text: "#155e75",
    border: "#a5f3fc",
    chipActiveBg: "#0891b2",
    chipActiveText: "#ffffff",
    chipInactiveBg: "#ecfeff",
    chipInactiveText: "#155e75",
    chipInactiveBorder: "#a5f3fc",
    badgeBg: "#cffafe",
    badgeText: "#155e75",
    badgeBorder: "#a5f3fc",
  },
  "APORTE": {
    bg: "#ffe4e6",
    text: "#9f1239",
    border: "#fecdd3",
    chipActiveBg: "#e11d48",
    chipActiveText: "#ffffff",
    chipInactiveBg: "#fff1f2",
    chipInactiveText: "#9f1239",
    chipInactiveBorder: "#fecdd3",
    badgeBg: "#ffe4e6",
    badgeText: "#9f1239",
    badgeBorder: "#fecdd3",
  },
};

function classificarCategoriaDocumento(p: { numeroNota?: string; tipoDespesa?: string; categoriaDoc?: string }): typeof CATEGORIAS_DOCUMENTO[number] {
  if (p.categoriaDoc && (CATEGORIAS_DOCUMENTO as readonly string[]).includes(p.categoriaDoc)) {
    return p.categoriaDoc as typeof CATEGORIAS_DOCUMENTO[number];
  }
  const nota = String(p.numeroNota || "").trim().toUpperCase();
  const despesa = String(p.tipoDespesa || "").trim().toUpperCase();

  if (nota.includes("NNÓS MONEY") || nota.includes("NNOS MONEY")) {
    return "NNÓS MONEY";
  }
  if (
    nota.includes("PRÓ-LABORE") ||
    nota.includes("PRO-LABORE") ||
    nota.includes("PRÓ LABORE") ||
    nota.includes("PRO LABORE")
  ) {
    return "PRÓ-LABORE";
  }
  if (nota.includes("AJUDA DE CUSTO") || nota.includes("AJUDA")) {
    return "AJUDA DE CUSTO";
  }
  if (nota.includes("APORTE")) {
    return "APORTE";
  }
  if (
    nota.includes("RDV") ||
    nota.includes("RVD") ||
    nota.includes("VIAGEM") ||
    despesa.includes("RDV") ||
    despesa.includes("VIAGEM")
  ) {
    return "RDV";
  }
  return "NF";
}

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function PagamentosPage() {
  const dataHoje = new Date();
  const mesAtualNome = MESES_NOMES[dataHoje.getMonth()] || "OUTUBRO";

  // Mapeamento padronizado de nomes curtos igual à tabela Pessoas
  const mapConsultoresCurto = useMemo(() => {
    const clean = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    const m = new Map<string, string>();
    (consultoresBase as any[]).forEach((c) => {
      if (c.nome) m.set(clean(c.nome), c.nome.toUpperCase());
      if (c.nome_completo) m.set(clean(c.nome_completo), c.nome.toUpperCase());
    });
    // Sinônimos operacionais entre PDFs de BMs e Contabilidade
    m.set(clean("MARISTELA GARCIA"), "MARISTELA GARCIA");
    m.set(clean("MARISTELA NEVES GARCIA"), "MARISTELA GARCIA");
    m.set(clean("PEDRO ERNESTO COLARES DE PAULA"), "PEDRO COLARES");
    m.set(clean("PEDRO COLARES"), "PEDRO COLARES");
    m.set(clean("TIAGO ANGELO DE QUEIROZ LOPES"), "TIAGO ANGELO");
    m.set(clean("TIAGO ANGELO"), "TIAGO ANGELO");
    m.set(clean("JOAO GILBERTO DE MELLO SANTOS JUNIOR"), "GIBA - JOÃO GILBERTO");
    m.set(clean("GIBA"), "GIBA - JOÃO GILBERTO");
    m.set(clean("WILLIAM BONFIM NUNES SANTOS"), "WILLIAM SANTOS");
    m.set(clean("WILLIAM SANTOS"), "WILLIAM SANTOS");
    m.set(clean("RODRIGO MARTINELLI KAIRALLA"), "RODRIGO KAIRALLA");
    m.set(clean("CEZAR TEIXEIRA HENRIQUE"), "CEZAR HENRIQUE");
    m.set(clean("FABIO LUIS CANASSA"), "FÁBIO CANASSA");
    m.set(clean("FABIO CANASSA"), "FÁBIO CANASSA");
    return m;
  }, []);

  const formatarNomeCurto = (nome: string) => {
    if (!nome) return "";
    const cleanStr = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    if (mapConsultoresCurto.has(cleanStr)) return mapConsultoresCurto.get(cleanStr)!;
    const parts = nome.trim().split(/\s+/);
    if (parts.length > 2) return (parts[0] + " " + parts[parts.length - 1]).toUpperCase();
    return nome.trim().toUpperCase();
  };

  // Higienização inicial estrita para expurgar registros corrompidos de logs de CLI
  const pagamentosLimposIniciais = useMemo(() => {
    return (pagamentosBase as unknown as PagamentoItem[]).filter((p) => {
      return (
        p &&
        typeof p === "object" &&
        p.id &&
        !String(p.consultor || "").includes("STEP_INDEX") &&
        !String(p.realizado || "").includes("{")
      );
    });
  }, []);

  const [pagamentos, setPagamentos] = useState<PagamentoItem[]>(pagamentosLimposIniciais);
  const [busca, setBusca] = useState("");
  const [filtroAno, setFiltroAno] = useState<string>("TODOS");
  const [filtroMes, setFiltroMes] = useState<string>("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);
  const [modalDueDiligenceAberto, setModalDueDiligenceAberto] = useState(false);
  const [tabDueDiligence, setTabDueDiligence] = useState<"ausentes" | "sem_bm" | "conciliados">("ausentes");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Sincronização e higienização robusta contra dados corrompidos (v5 com base oficial completa de 1.024 lançamentos)
  useEffect(() => {
    // 1. Purga imediata de chaves antigas corrompidas ou defasadas
    try {
      localStorage.removeItem("nnos_pagamentos_cadastrados_v1");
      localStorage.removeItem("nnos_pagamentos_cadastrados_v2");
      localStorage.removeItem("nnos_pagamentos_cadastrados_v3");
      localStorage.removeItem("nnos_pagamentos_cadastrados_v4");
    } catch {}

    const isValido = (item: any) => {
      if (!item || typeof item !== "object") return false;
      if (!item.id || typeof item.id !== "string") return false;
      if (typeof item.consultor !== "string" || item.consultor.includes("STEP_INDEX") || item.consultor.includes("STATUS:")) return false;
      if (typeof item.realizado !== "string" || item.realizado.includes("{") || item.realizado.includes("STEP_INDEX")) return false;
      if (typeof item.projeto !== "string" || item.projeto.includes("created_at")) return false;
      return true;
    };

    try {
      const saved = localStorage.getItem("nnos_pagamentos_cadastrados_v5");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 800 && parsed.every(isValido)) {
          setPagamentos(parsed);
        } else {
          localStorage.removeItem("nnos_pagamentos_cadastrados_v5");
        }
      }
    } catch {}

    fetch("/api/pagamentos")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const limpos = data.filter(isValido);
          if (limpos.length > 0) {
            setPagamentos(limpos);
            try {
              localStorage.setItem("nnos_pagamentos_cadastrados_v5", JSON.stringify(limpos));
            } catch {}
          }
        }
      })
      .catch((e) => console.error("Erro ao carregar pagamentos:", e));
  }, []);

  const salvarPagamentos = (novos: PagamentoItem[]) => {
    setPagamentos(novos);
    try {
      localStorage.setItem("nnos_pagamentos_cadastrados_v5", JSON.stringify(novos));
    } catch {}
    fetch("/api/pagamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novos),
    }).catch((e) => console.error("Erro ao salvar pagamentos:", e));
  };

  // Lista unificada e padronizada de consultores/beneficiários com nomes curtos para o formulário
  const listaConsultoresSugestoes = useMemo(() => {
    const nomesSet = new Set<string>();

    // 1. Integrantes da base oficial de pessoas / consultores
    (consultoresBase as any[]).forEach((c) => {
      if (c.nome) {
        const curto = formatarNomeCurto(c.nome);
        if (curto) nomesSet.add(curto);
      }
    });

    // 2. Consultores do histórico de pagamentos
    pagamentos.forEach((p) => {
      if (p.consultor) {
        const curto = formatarNomeCurto(p.consultor);
        if (curto) nomesSet.add(curto);
      }
    });

    return Array.from(nomesSet).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pagamentos, mapConsultoresCurto]);

  // Modal de Novo Lançamento de Despesa / Pagamento
  const [modalAberto, setModalAberto] = useState(false);
  const [itemEdicao, setItemEdicao] = useState<PagamentoItem | null>(null);
  const [form, setForm] = useState<Partial<PagamentoItem>>({
    realizado: mesAtualNome,
    dataPagto: `${String(dataHoje.getDate()).padStart(2, "0")}/${String(dataHoje.getMonth() + 1).padStart(2, "0")}/${dataHoje.getFullYear()}`,
    tipo: "PARCEIRO",
    tipoDespesa: "Relatório de Viagem (RDV)",
    status: "A Pagar",
    valor: 0,
    centroCusto: "01.07.010.039",
  });

  const abrirNovoLancamento = () => {
    setItemEdicao(null);
    setForm({
      realizado: mesAtualNome,
      dataPagto: `${String(dataHoje.getDate()).padStart(2, "0")}/${String(dataHoje.getMonth() + 1).padStart(2, "0")}/${dataHoje.getFullYear()}`,
      tipo: "PARCEIRO",
      categoriaDoc: "NF",
      status: "A Pagar",
      valor: 0,
      numeroNota: "",
      centroCusto: "01.07.010.039",
    });
    setModalAberto(true);
  };

  const abrirEditar = (item: PagamentoItem) => {
    setItemEdicao(item);
    setForm({
      ...item,
      categoriaDoc: item.categoriaDoc || classificarCategoriaDocumento(item),
    });
    setModalAberto(true);
  };

  const handleSalvarLancamento = (e: React.FormEvent) => {
    e.preventDefault();
    const consultorFormatado = formatarNomeCurto(form.consultor?.trim() || "");
    if (!consultorFormatado) {
      alert("Por favor, preencha o Consultor / Beneficiário.");
      return;
    }
    if (!form.projeto || !form.projeto.trim()) {
      alert("Por favor, preencha o Projeto.");
      return;
    }

    let novos: PagamentoItem[];
    if (itemEdicao) {
      novos = pagamentos.map((p) =>
        p.id === itemEdicao.id ? ({ ...p, ...form, consultor: consultorFormatado } as PagamentoItem) : p
      );
    } else {
      const catDocFinal = form.categoriaDoc || classificarCategoriaDocumento(form);
      const novo: PagamentoItem = {
        id: `pgto-custom-${Date.now()}`,
        realizado: form.realizado || mesAtualNome,
        dataPagto: form.dataPagto || "10/10/2026",
        consultor: consultorFormatado,
        tipo: form.tipo || "PARCEIRO",
        projeto: form.projeto.trim().toUpperCase(),
        numeroNota: form.numeroNota || "—",
        categoriaDoc: catDocFinal,
        tipoDespesa: form.tipoDespesa || catDocFinal,
        valor: Number(form.valor) || 0,
        status: form.status || "A Pagar",
        bm: form.bm || "",
        centroCusto: form.centroCusto || "01.00",
        observacoes: form.observacoes || "",
      };
      novos = [novo, ...pagamentos];
    }

    salvarPagamentos(novos);
    setModalAberto(false);
    setToastMsg(itemEdicao ? "Lançamento atualizado com sucesso!" : "Novo pagamento registrado com sucesso!");
    setTimeout(() => setToastMsg(null), 3500);
  };

  const alternarStatus = (id: string, novoStatus: PagamentoItem["status"]) => {
    const novos = pagamentos.map((p) => (p.id === id ? { ...p, status: novoStatus } : p));
    salvarPagamentos(novos);
    setToastMsg(`Status alterado para "${novoStatus}"`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const excluirLancamento = (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    const novos = pagamentos.filter((p) => p.id !== id);
    salvarPagamentos(novos);
    setToastMsg("Lançamento excluído.");
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Anos únicos disponíveis
  const anosDisponiveis = useMemo(() => {
    const s = new Set<string>();
    pagamentos.forEach((p) => {
      const ano = (p.dataPagto || "").split("/")[2];
      if (ano && /^\d{4}$/.test(ano)) s.add(ano);
    });
    if (!s.has("2026")) s.add("2026");
    return Array.from(s).sort();
  }, [pagamentos]);

  // Tipos da coluna TIPO únicos para o dropdown (PARCEIRO, SÓCIO, FUNCIONÁRIO, FORNECEDOR)
  const tiposUnicos = useMemo(() => {
    const s = new Set<string>();
    pagamentos.forEach((p) => {
      if (p.tipo) s.add(p.tipo.toUpperCase());
    });
    // Garantir presença dos tipos oficiais
    ["PARCEIRO", "SÓCIO", "FUNCIONÁRIO", "FORNECEDOR"].forEach((t) => s.add(t));
    return Array.from(s).sort();
  }, [pagamentos]);

  // Contagem dinâmica de categorias de documentos
  const contagemCategorias = useMemo(() => {
    const counts: Record<string, number> = {
      "NF": 0,
      "RDV": 0,
      "NNÓS MONEY": 0,
      "PRÓ-LABORE": 0,
      "AJUDA DE CUSTO": 0,
      "APORTE": 0,
    };
    pagamentos.forEach((p) => {
      const cat = classificarCategoriaDocumento(p);
      if (counts[cat] !== undefined) counts[cat]++;
    });
    return counts;
  }, [pagamentos]);

  // Due Diligence inteligente cruzando BMs aprovados com a base de pagamentos
  const dueDiligence = useMemo(() => {
    const clean = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

    const getCurto = (nome: string) => {
      const limpo = clean(nome);
      if (mapConsultoresCurto.has(limpo)) return mapConsultoresCurto.get(limpo)!;
      const parts = limpo.split(/\s+/);
      if (parts.length > 2) return (parts[0] + " " + parts[parts.length - 1]).toUpperCase();
      return limpo;
    };

    const bmsValidos = (bms2026Base as any[]).filter(
      (b) => b && b.codigo && b.codigo !== "0000" && (Number(b.valorTotal) || 0) > 0
    );

    const conciliados: any[] = [];
    const pagosSemBm: any[] = [];
    const ausentes: any[] = [];

    bmsValidos.forEach((bm) => {
      const cod = String(bm.codigo).padStart(4, "0");
      const codNum = parseInt(bm.codigo, 10);
      const cCurto = getCurto(bm.consultorNome);
      const mesBm = clean(bm.mesReferencia?.split("/")[0]);
      const valorBm = Math.round(Number(bm.valorTotal) * 100) / 100;

      // 1. Vínculo direto no campo p.bm
      let match = pagamentos.find((p) => {
        if (!p.bm) return false;
        const pBm = String(p.bm).padStart(4, "0");
        return pBm === cod || parseInt(p.bm, 10) === codNum;
      });

      // 2. Menção expressa na Nota Fiscal (ex: "BM 0898")
      if (!match) {
        match = pagamentos.find((p) => {
          const nota = clean(p.numeroNota);
          return (
            nota.includes("BM " + cod) ||
            nota.includes("BM " + codNum) ||
            nota.includes("BM" + cod) ||
            nota.includes("BM" + codNum)
          );
        });
      }

      // 3. Consultor com valor exato de pagamento
      if (!match) {
        match = pagamentos.find((p) => {
          const pCons = getCurto(p.consultor);
          if (pCons !== cCurto) return false;
          const diff = Math.abs((Number(p.valor) || 0) - valorBm);
          return diff < 0.1;
        });
      }

      if (match) {
        conciliados.push({ bm, match });
      } else {
        // Verificar pagamentos do consultor no mês (ex: NF dividida em múltiplos projetos)
        const pagtosConsultorNoMes = pagamentos.filter((p) => {
          const pCons = getCurto(p.consultor);
          if (pCons !== cCurto) return false;
          if (String(p.numeroNota || "").toUpperCase().includes("RDV")) return false;
          return clean(p.realizado).includes(mesBm.slice(0, 3));
        });

        const somaMes = pagtosConsultorNoMes.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
        const diffSoma = Math.abs(somaMes - valorBm);

        if (pagtosConsultorNoMes.length > 0 && diffSoma < 1.0) {
          pagosSemBm.push({
            bm,
            consultorCurto: cCurto,
            mesBm,
            valorBm,
            pagamentosRelacionados: pagtosConsultorNoMes,
            nota: pagtosConsultorNoMes[0]?.numeroNota || "—",
            dataPagto: pagtosConsultorNoMes[0]?.dataPagto || "—",
          });
        } else {
          ausentes.push({
            bm,
            consultorCurto: cCurto,
            mesBm,
            valorBm,
            pagamentosNoMes: pagtosConsultorNoMes,
          });
        }
      }
    });

    return {
      totalValidos: bmsValidos.length,
      conciliados,
      pagosSemBm,
      ausentes,
      totalDivergencias: pagosSemBm.length + ausentes.length,
    };
  }, [pagamentos, mapConsultoresCurto]);

  // Filtragem
  const pagamentosFiltrados = useMemo(() => {
    return pagamentos.filter((p) => {
      if (filtroAno !== "TODOS") {
        const ano = (p.dataPagto || "").split("/")[2] || "2026";
        if (ano !== filtroAno) return false;
      }
      if (filtroMes !== "TODOS" && p.realizado?.toUpperCase() !== filtroMes.toUpperCase()) return false;
      if (filtroStatus !== "TODOS" && p.status !== filtroStatus) return false;
      if (filtroTipo !== "TODOS" && p.tipo?.toUpperCase() !== filtroTipo.toUpperCase()) return false;
      if (categoriasSelecionadas.length > 0) {
        const cat = classificarCategoriaDocumento(p);
        if (!categoriasSelecionadas.includes(cat)) return false;
      }
      if (busca.trim()) {
        const t = busca.toLowerCase();
        const mConsultor = p.consultor?.toLowerCase().includes(t);
        const mProj = p.projeto?.toLowerCase().includes(t);
        const mNota = p.numeroNota?.toLowerCase().includes(t);
        const mBm = p.bm?.toLowerCase().includes(t);
        return mConsultor || mProj || mNota || mBm;
      }
      return true;
    });
  }, [pagamentos, filtroAno, filtroMes, filtroStatus, filtroTipo, categoriasSelecionadas, busca]);

  // Totais e KPIs calculados dinamicamente sobre o filtro
  const totais = useMemo(() => {
    let totalGeral = 0;
    let totalPago = 0;
    let totalAPagar = 0;
    let totalCartao = 0;
    let totalBms = 0;
    let totalRdvs = 0;

    pagamentosFiltrados.forEach((p) => {
      const v = Number(p.valor) || 0;
      totalGeral += v;
      if (p.status === "Pago") totalPago += v;
      if (p.status === "A Pagar") totalAPagar += v;
      if (p.status === "Cartão Corporativo") totalCartao += v;

      if (p.tipoDespesa?.includes("BM")) totalBms += v;
      if (p.tipoDespesa?.includes("RDV")) totalRdvs += v;
    });

    return { totalGeral, totalPago, totalAPagar, totalCartao, totalBms, totalRdvs };
  }, [pagamentosFiltrados]);

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
            <Link href="/pagamentos" className="nav-item active">
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
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface)" }}>Sistema Operacional NNÓS</span>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Módulo de Pagamentos & Despesas</span>
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
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
              Gestão de Pagamentos & Despesas
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ThemeToggle />
          </div>
        </header>

        {/* Toast Notificação */}
        {toastMsg && (
          <div style={{ position: "fixed", top: "20px", right: "24px", zIndex: 9999, backgroundColor: "#0f2a4a", color: "#ffffff", padding: "12px 20px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
            <span className="material-symbols-outlined" style={{ color: "#34d399", fontSize: "20px" }}>check_circle</span>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>{toastMsg}</span>
          </div>
        )}

        <main className="main-content" style={{ padding: "24px 32px", width: "100%" }}>
          {/* Top Title & CTA Button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-jakarta)", fontSize: "24px", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                Gestão de Pagamentos & Despesas
              </h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setModalDueDiligenceAberto(true)}
                className="btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--primary)" }}>fact_check</span>
                <span>Due Diligence BMs vs Planilha</span>
                {dueDiligence.totalDivergencias > 0 && (
                  <span style={{ backgroundColor: "#ef4444", color: "#ffffff", padding: "1px 7px", borderRadius: "10px", fontSize: "11px", fontWeight: 800 }}>
                    {dueDiligence.totalDivergencias}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={abrirNovoLancamento}
                className="btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  padding: "10px 18px",
                  boxShadow: "0 2px 8px rgba(0,21,47,0.18)",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_card</span>
                <span>Novo Lançamento / Despesa</span>
              </button>
            </div>
          </div>

          {/* Cards KPI Bento */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px", marginBottom: "22px" }}>
            {/* Total Geral de Saídas */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Total Lançamentos</div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f2a4a", marginTop: "4px" }}>
                R$ {totais.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "11px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                {pagamentosFiltrados.length} registros no filtro
              </div>
            </div>

            {/* Total Efetivamente Pago */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Efetivamente Pago</span>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#16a34a" }}></span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#16a34a", marginTop: "4px" }}>
                R$ {totais.totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600, marginTop: "2px" }}>
                Liquidado em conta corrente
              </div>
            </div>

            {/* Total A Pagar */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>A Pagar</span>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#d97706" }}></span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#d97706", marginTop: "4px" }}>
                R$ {totais.totalAPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "11px", color: "#b45309", fontWeight: 600, marginTop: "2px" }}>
                BMs e despesas em fluxo
              </div>
            </div>

            {/* Cartão Corporativo */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase" }}>Cartão Corporativo</span>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#7c3aed" }}></span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#7c3aed", marginTop: "4px" }}>
                R$ {totais.totalCartao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "11px", color: "#6d28d9", fontWeight: 600, marginTop: "2px" }}>
                Fatura centralizada NNÓS
              </div>
            </div>

            {/* Viagens (RDVs) vs BMs */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", textTransform: "uppercase" }}>Viagens (RDVs) vs BMs</div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f2a4a", marginTop: "4px" }}>
                R$ {totais.totalRdvs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "11px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                BMs: R$ {totais.totalBms.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Barra de Filtros e Busca Rápida no Padrão Print 5 */}
          <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              {/* Input de Busca */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface-container-low, #f8fafc)", padding: "8px 14px", borderRadius: "8px", flex: 1, minWidth: "260px", border: "1px solid var(--border)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--outline)" }}>search</span>
                <input
                  type="text"
                  placeholder="Buscar por consultor, número da nota/RDV, projeto ou BM..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ border: "none", background: "transparent", outline: "none", width: "100%", fontSize: "13.5px" }}
                />
                {busca && (
                  <button type="button" onClick={() => setBusca("")} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--outline)" }}>close</span>
                  </button>
                )}
              </div>

              {/* Dropdowns no Padrão ModernDropdown */}
              <div className="filter-selects-group" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {/* 1. Tipo (Referente à coluna TIPO) */}
                <ModernDropdown
                  value={filtroTipo}
                  onChange={(val) => setFiltroTipo(String(val))}
                  options={[
                    { value: "TODOS", label: `Todos os Tipos (${tiposUnicos.length})` },
                    ...tiposUnicos.map((t) => ({ value: t, label: t })),
                  ]}
                  icon="badge"
                  minWidth="180px"
                />

                {/* 2. Status (Sem 'Programado') */}
                <ModernDropdown
                  value={filtroStatus}
                  onChange={(val) => setFiltroStatus(String(val))}
                  options={[
                    { value: "TODOS", label: "Todos os Status" },
                    { value: "Pago", label: "Pago" },
                    { value: "A Pagar", label: "A Pagar" },
                    { value: "Cartão Corporativo", label: "Cartão Corporativo" },
                  ]}
                  icon="verified"
                  minWidth="165px"
                />
              </div>
            </div>

            {/* Chips de Categorias de Documento com Seleção Rápida e Cores Correspondentes (Legenda) */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", paddingTop: "2px" }}>
              <span style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", color: "var(--on-surface-variant)", marginRight: "4px" }}>
                Documento:
              </span>
              <button
                type="button"
                onClick={() => setCategoriasSelecionadas([])}
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                  border: categoriasSelecionadas.length === 0 ? "1px solid #002b49" : "1px solid var(--border)",
                  backgroundColor: categoriasSelecionadas.length === 0 ? "#002b49" : "var(--surface-container-low, #f8fafc)",
                  color: categoriasSelecionadas.length === 0 ? "#ffffff" : "var(--on-surface)",
                  transition: "all 0.15s ease",
                }}
              >
                TODOS ({pagamentos.length})
              </button>
              {CATEGORIAS_DOCUMENTO.map((cat) => {
                const isSelected = categoriasSelecionadas.includes(cat);
                const count = contagemCategorias[cat] || 0;
                const estilo = ESTILOS_CATEGORIA_DOC[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setCategoriasSelecionadas(categoriasSelecionadas.filter((c) => c !== cat));
                      } else {
                        setCategoriasSelecionadas([...categoriasSelecionadas, cat]);
                      }
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "11.5px",
                      fontWeight: 500,
                      cursor: "pointer",
                      border: isSelected ? `1px solid ${estilo.chipActiveBg}` : `1px solid ${estilo.chipInactiveBorder}`,
                      backgroundColor: isSelected ? estilo.chipActiveBg : estilo.chipInactiveBg,
                      color: isSelected ? estilo.chipActiveText : estilo.chipInactiveText,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? `0 2px 6px ${estilo.chipActiveBg}33` : "none",
                    }}
                  >
                    <span>{cat}</span>
                    <span style={{
                      fontSize: "10.5px",
                      fontWeight: 500,
                      backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : estilo.bg,
                      color: isSelected ? "#ffffff" : estilo.text,
                      padding: "1px 6px",
                      borderRadius: "10px",
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Faixa de Navegação por Competência Mensal no Padrão Oficial do Print 5 (.month-strip & .month-chip) */}
            <nav className="month-strip" aria-label="Seleção de Competência" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px dashed var(--border)" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginRight: "6px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--primary, #002b49)" }}>
                  calendar_month
                </span>
                <span className="month-label" style={{ fontWeight: 500, margin: 0 }}>
                  COMPETÊNCIA:
                </span>
                
                {/* Seletor de Ano Moderno */}
                <ModernDropdown
                  value={filtroAno}
                  onChange={(val) => setFiltroAno(String(val))}
                  options={[
                    { value: "TODOS", label: "Todos os Anos" },
                    { value: "2026", label: "2026" },
                    ...anosDisponiveis.filter((a) => a !== "2026").map((a) => ({ value: a, label: a })),
                  ]}
                  buttonStyle={{ padding: "4px 10px", fontSize: "12.5px" }}
                  minWidth="110px"
                />
              </div>

              {/* Chips de Meses no Padrão Oficial do Print 5 (Jan a Dez, alternância limpa) */}
              <div style={{ display: "inline-flex", gap: "2px", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setFiltroMes("TODOS")}
                  className={`month-chip ${filtroMes === "TODOS" ? "active" : ""}`}
                  style={{
                    border: "none",
                    outline: "none",
                    cursor: "pointer",
                    backgroundColor: filtroMes === "TODOS" ? "var(--primary-container, #002b49)" : "transparent",
                    color: filtroMes === "TODOS" ? "#ffffff" : "var(--on-surface-variant)",
                    padding: filtroMes === "TODOS" ? "5px 14px" : "5px 10px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: filtroMes === "TODOS" ? 700 : 500,
                    transition: "all 0.15s ease",
                  }}
                >
                  Todos
                </button>
                {MESES_ABREV.map((nome, idx) => {
                  const nomeCompleto = MESES_NOMES[idx];
                  const ativo = filtroMes.toUpperCase() === nomeCompleto.toUpperCase();
                  return (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => setFiltroMes((prev) => (prev.toUpperCase() === nomeCompleto.toUpperCase() ? "TODOS" : nomeCompleto))}
                      className={`month-chip ${ativo ? "active" : ""}`}
                      style={{
                        border: "none",
                        outline: "none",
                        cursor: "pointer",
                        backgroundColor: ativo ? "var(--primary-container, #002b49)" : "transparent",
                        color: ativo ? "#ffffff" : "var(--on-surface-variant)",
                        padding: ativo ? "5px 14px" : "5px 10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 500,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {nome}
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          {/* Tabela de Pagamentos (Sem Coluna CC, Sem Quebra de Linha, Tipo Centralizado, Nº NOTA Uniforme) */}
          <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <div style={{ padding: "12px 18px", backgroundColor: "#00a3ad", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: 700 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>table_chart</span>
                <span>PAGAMENTOS & REPASSES OPERACIONAIS</span>
              </div>
              <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: "4px" }}>
                {pagamentosFiltrados.length} Lançamentos Registrados
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", textTransform: "uppercase", fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    <th style={{ padding: "10px 14px", width: "85px" }}>Realizado</th>
                    <th style={{ padding: "10px 12px", width: "90px" }}>Data Pgto</th>
                    <th style={{ padding: "10px 14px", minWidth: "160px" }}>Consultor / Beneficiário</th>
                    <th style={{ padding: "10px 12px", width: "100px", textAlign: "center" }}>Tipo</th>
                    <th style={{ padding: "10px 14px", minWidth: "180px" }}>Projeto</th>
                    <th style={{ padding: "10px 12px", width: "135px", textAlign: "center" }}>Nº Nota / RDV</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: "110px" }}>Valor</th>
                    <th style={{ padding: "10px 12px", width: "115px" }}>Status</th>
                    <th style={{ padding: "10px 10px", textAlign: "center", width: "65px" }}>BM</th>
                    <th style={{ padding: "10px 14px", minWidth: "140px" }}>Obs.</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: "75px" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentosFiltrados.map((item, idx) => {
                    const rawNota = (item.numeroNota || "").trim();
                    const isNFBM = rawNota.toUpperCase().startsWith("NF BM") || rawNota.toUpperCase().startsWith("NF-BM");
                    const notaLimpa = (!rawNota || isNFBM || rawNota === "—") ? "—" : rawNota;
                    const isRDV = notaLimpa.includes("RDV");
                    const isVazio = notaLimpa === "—";

                    return (
                      <tr
                        key={item.id || idx}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfcfd",
                          transition: "background-color 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#ffffff" : "#fcfcfd")}
                      >
                        {/* Realizado */}
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#64748b", fontSize: "11px", whiteSpace: "nowrap" }}>
                          {item.realizado}
                        </td>

                        {/* Data Pgto */}
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                          {item.dataPagto}
                        </td>

                        {/* Consultor / Beneficiário (Nome Curto Padronizado como em Pessoas) */}
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0f2a4a", whiteSpace: "nowrap" }}>
                          {formatarNomeCurto(item.consultor)}
                        </td>

                        {/* Tipo (Centralizado) */}
                        <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <span style={{
                            display: "inline-block",
                            textAlign: "center",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: 700,
                            backgroundColor:
                              item.tipo === "SÓCIO"
                                ? "#f3e8ff"
                                : item.tipo === "FUNCIONÁRIO"
                                ? "#dcfce7"
                                : "#e0f2fe",
                            color:
                              item.tipo === "SÓCIO"
                                ? "#6b21a8"
                                : item.tipo === "FUNCIONÁRIO"
                                ? "#166534"
                                : "#0369a1",
                          }}>
                            {item.tipo}
                          </span>
                        </td>

                        {/* Projeto */}
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>
                          {item.projeto}
                        </td>

                        {/* Nº Nota / RDV com Cor Correspondente ao Tipo (Sem Coluna Extra) */}
                        <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                          {(() => {
                            const catDoc = classificarCategoriaDocumento(item);
                            const estilo = ESTILOS_CATEGORIA_DOC[catDoc];
                            return (
                              <span
                                title={`Documento: ${catDoc} - ${notaLimpa}`}
                                style={{
                                  display: "inline-block",
                                  minWidth: "90px",
                                  maxWidth: "145px",
                                  textAlign: "center",
                                  padding: "3px 10px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  backgroundColor: isVazio ? "transparent" : estilo.badgeBg,
                                  color: isVazio ? "#94a3b8" : estilo.badgeText,
                                  border: isVazio ? "1px dashed #cbd5e1" : `1px solid ${estilo.badgeBorder}`,
                                  whiteSpace: "nowrap",
                                  textOverflow: "ellipsis",
                                  overflow: "hidden",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {notaLimpa}
                              </span>
                            );
                          })()}
                        </td>

                      {/* Valor */}
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>
                        R$ {Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>

                      {/* Status (Sem 'Programado') */}
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <span
                          onClick={() => alternarStatus(item.id, item.status === "Pago" ? "A Pagar" : "Pago")}
                          title="Clique para alternar status"
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "10.5px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            backgroundColor:
                              item.status === "Pago"
                                ? "#dcfce7"
                                : item.status === "Cartão Corporativo"
                                ? "#f3e8ff"
                                : "#fee2e2",
                            color:
                              item.status === "Pago"
                                ? "#166534"
                                : item.status === "Cartão Corporativo"
                                ? "#6b21a8"
                                : "#991b1b",
                          }}
                        >
                          {item.status}
                        </span>
                      </td>

                      {/* BM */}
                      <td style={{ padding: "10px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                        {item.bm ? (
                          <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#0f2a4a", color: "#ffffff", fontWeight: 800, fontSize: "10px" }}>
                            {item.bm}
                          </span>
                        ) : (
                          <span style={{ color: "#cbd5e1" }}>—</span>
                        )}
                      </td>

                      {/* Obs. (Sem menção a honorários, apenas dados originais) */}
                      <td style={{ padding: "10px 14px", color: "#64748b", fontSize: "11px", whiteSpace: "nowrap" }}>
                        {item.observacoes &&
                        !item.observacoes.toLowerCase().includes("honorário") &&
                        !item.observacoes.toLowerCase().includes("honorario")
                          ? item.observacoes
                          : "—"}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <button
                            type="button"
                            onClick={() => abrirEditar(item)}
                            title="Editar"
                            style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", color: "var(--secondary)" }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirLancamento(item.id)}
                            title="Excluir"
                            style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", color: "#dc2626" }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>

          {/* Modal de Cadastro / Edição Operacional */}
          {modalAberto && (
            <div className="modal-backdrop" onClick={() => setModalAberto(false)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>
                    <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                      {itemEdicao ? "edit_calendar" : "add_circle"}
                    </span>
                    <span>
                      {itemEdicao ? "Editar Lançamento de Pagamento" : "Novo Lançamento / Despesa Operacional"}
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

                <form onSubmit={handleSalvarLancamento} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
                  <div className="modal-body" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Competência (Realizado) *</label>
                        <select
                          value={form.realizado || mesAtualNome}
                          onChange={(e) => setForm({ ...form, realizado: e.target.value })}
                        >
                          {MESES_NOMES.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>Data Pagamento / Vencimento *</label>
                        <input
                          type="text"
                          placeholder="DD/MM/AAAA"
                          value={form.dataPagto || ""}
                          onChange={(e) => setForm({ ...form, dataPagto: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Consultor / Beneficiário *</label>
                        <input
                          type="text"
                          list="consultores-list"
                          placeholder="Nome do integrante ou fornecedor..."
                          value={form.consultor || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const cleanVal = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
                            const found = (consultoresBase as any[]).find((c) => {
                              const cNome = (c.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
                              const cComp = (c.nome_completo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
                              return cNome === cleanVal || cComp === cleanVal;
                            });
                            setForm({
                              ...form,
                              consultor: val,
                              tipo: found ? (found.tipo?.toUpperCase() as any) : form.tipo,
                            });
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (!val.trim()) return;
                            const curto = formatarNomeCurto(val);
                            const cleanCurto = curto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
                            const found = (consultoresBase as any[]).find((c) => {
                              const cNome = (c.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
                              const cComp = (c.nome_completo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
                              return cNome === cleanCurto || cComp === cleanCurto;
                            });
                            setForm((prev) => ({
                              ...prev,
                              consultor: curto,
                              tipo: found ? (found.tipo?.toUpperCase() as any) : prev.tipo,
                            }));
                          }}
                        />
                        <datalist id="consultores-list">
                          {listaConsultoresSugestoes.map((nome, i) => (
                            <option key={i} value={nome} />
                          ))}
                        </datalist>
                      </div>

                      <div className="form-field">
                        <label>Tipo Vínculo</label>
                        <select
                          value={form.tipo || "PARCEIRO"}
                          onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}
                        >
                          <option value="PARCEIRO">PARCEIRO</option>
                          <option value="SÓCIO">SÓCIO</option>
                          <option value="FUNCIONÁRIO">FUNCIONÁRIO</option>
                          <option value="FORNECEDOR">FORNECEDOR</option>
                        </select>
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Projeto *</label>
                        <input
                          type="text"
                          list="projetos-list"
                          placeholder="Selecione ou digite o projeto..."
                          value={form.projeto || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const ccItem = ccBase.centrosDeCusto.find((c) => c.projeto.toUpperCase() === val.toUpperCase());
                            setForm({
                              ...form,
                              projeto: val,
                              centroCusto: ccItem ? ccItem.centroDeCusto : form.centroCusto,
                            });
                          }}
                        />
                        <datalist id="projetos-list">
                          {ccBase.centrosDeCusto.map((cc, i) => (
                            <option key={i} value={cc.projeto} />
                          ))}
                        </datalist>
                      </div>

                      <div className="form-field">
                        <label>Centro de Custo (CC)</label>
                        <input
                          type="text"
                          placeholder="Ex: 01.07.010.039"
                          value={form.centroCusto || ""}
                          onChange={(e) => setForm({ ...form, centroCusto: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Tipo de Documento *</label>
                        <select
                          value={form.categoriaDoc || classificarCategoriaDocumento(form)}
                          onChange={(e) => {
                            const novaCat = e.target.value as typeof CATEGORIAS_DOCUMENTO[number];
                            let novoNumero = form.numeroNota || "";
                            if (novaCat === "RDV" && !novoNumero.toUpperCase().includes("RDV")) {
                              novoNumero = novoNumero.trim() ? `RDV ${novoNumero}` : "RDV ";
                            } else if (novaCat === "NNÓS MONEY" && !novoNumero.toUpperCase().includes("NNÓS MONEY")) {
                              novoNumero = "NNÓS MONEY";
                            } else if (novaCat === "PRÓ-LABORE" && !novoNumero.toUpperCase().includes("PRÓ-LABORE")) {
                              novoNumero = "PRÓ-LABORE";
                            } else if (novaCat === "AJUDA DE CUSTO" && !novoNumero.toUpperCase().includes("AJUDA")) {
                              novoNumero = "AJUDA DE CUSTO";
                            } else if (novaCat === "APORTE" && !novoNumero.toUpperCase().includes("APORTE")) {
                              novoNumero = "APORTE";
                            }
                            setForm({
                              ...form,
                              categoriaDoc: novaCat,
                              numeroNota: novoNumero,
                            });
                          }}
                          style={{ fontWeight: 700 }}
                        >
                          {CATEGORIAS_DOCUMENTO.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>Nº Nota / Documento / RDV *</label>
                        <input
                          type="text"
                          placeholder="Ex: 7, 12, RDV 11681978"
                          value={form.numeroNota || ""}
                          onChange={(e) => setForm({ ...form, numeroNota: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Valor (R$) *</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={form.valor || ""}
                          onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      <div className="form-field">
                        <label>Status *</label>
                        <select
                          value={form.status || "A Pagar"}
                          onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                        >
                          <option value="A Pagar">A Pagar</option>
                          <option value="Pago">Pago</option>
                          <option value="Cartão Corporativo">Cartão Corporativo</option>
                        </select>
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Vínculo BM (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex: 885, 0903"
                          value={form.bm || ""}
                          onChange={(e) => setForm({ ...form, bm: e.target.value })}
                        />
                      </div>

                      <div className="form-field">
                        <label>Observações</label>
                        <input
                          type="text"
                          placeholder="Observações complementares..."
                          value={form.observacoes || ""}
                          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setModalAberto(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        check_circle
                      </span>
                      <span>Salvar Lançamento</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal de Due Diligence BMs vs Planilha */}
          {modalDueDiligenceAberto && (
            <div className="modal-backdrop" onClick={() => setModalDueDiligenceAberto(false)}>
              <div className="modal-card" style={{ maxWidth: "940px" }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>
                    <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                      fact_check
                    </span>
                    <span>Due Diligence | BMs Aprovados vs Planilha de Pagamentos</span>
                  </h3>
                  <button
                    type="button"
                    className="btn-modal-close"
                    onClick={() => setModalDueDiligenceAberto(false)}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="modal-body" style={{ overflowY: "auto", flex: 1, minHeight: 0, gap: "16px" }}>
                  {/* Cards Resumo Executivo */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" }}>
                    <div style={{ background: "var(--surface-container-low, #f8fafc)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Total BMs Aprovados</span>
                      <div style={{ fontSize: "20px", fontWeight: 900, color: "var(--primary)", marginTop: "2px" }}>
                        {dueDiligence.totalValidos}
                      </div>
                      <span style={{ fontSize: "10.5px", color: "var(--on-surface-variant)" }}>Base do sistema 2026</span>
                    </div>

                    <div style={{ background: "#f0fdf4", padding: "12px 14px", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Conciliados na Planilha</span>
                      <div style={{ fontSize: "20px", fontWeight: 900, color: "#16a34a", marginTop: "2px" }}>
                        {dueDiligence.conciliados.length}
                      </div>
                      <span style={{ fontSize: "10.5px", color: "#15803d", fontWeight: 600 }}>100% amarrados com pagamentos</span>
                    </div>

                    <div style={{ background: "#fffbeb", padding: "12px 14px", borderRadius: "10px", border: "1px solid #fde68a" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>Pagos c/ BM em Branco</span>
                      <div style={{ fontSize: "20px", fontWeight: 900, color: "#d97706", marginTop: "2px" }}>
                        {dueDiligence.pagosSemBm.length}
                      </div>
                      <span style={{ fontSize: "10.5px", color: "#b45309", fontWeight: 600 }}>Apenas preencher número do BM</span>
                    </div>

                    <div style={{ background: "#fef2f2", padding: "12px 14px", borderRadius: "10px", border: "1px solid #fecaca" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#991b1b", textTransform: "uppercase" }}>Ausentes na Planilha</span>
                      <div style={{ fontSize: "20px", fontWeight: 900, color: "#dc2626", marginTop: "2px" }}>
                        {dueDiligence.ausentes.length}
                      </div>
                      <span style={{ fontSize: "10.5px", color: "#b91c1c", fontWeight: 600 }}>Pendentes de inclusão contábil</span>
                    </div>
                  </div>

                  {/* Tabs de Navegação */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setTabDueDiligence("ausentes")}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: tabDueDiligence === "ausentes" ? "1px solid #ef4444" : "1px solid var(--border)",
                        backgroundColor: tabDueDiligence === "ausentes" ? "#fee2e2" : "transparent",
                        color: tabDueDiligence === "ausentes" ? "#991b1b" : "var(--on-surface-variant)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>error</span>
                      <span>Ausentes na Planilha ({dueDiligence.ausentes.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTabDueDiligence("sem_bm")}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: tabDueDiligence === "sem_bm" ? "1px solid #f59e0b" : "1px solid var(--border)",
                        backgroundColor: tabDueDiligence === "sem_bm" ? "#fef3c7" : "transparent",
                        color: tabDueDiligence === "sem_bm" ? "#92400e" : "var(--on-surface-variant)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>warning</span>
                      <span>Pagos c/ BM em Branco ({dueDiligence.pagosSemBm.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTabDueDiligence("conciliados")}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: tabDueDiligence === "conciliados" ? "1px solid #10b981" : "1px solid var(--border)",
                        backgroundColor: tabDueDiligence === "conciliados" ? "#d1fae5" : "transparent",
                        color: tabDueDiligence === "conciliados" ? "#065f46" : "var(--on-surface-variant)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>check_circle</span>
                      <span>Conciliados ({dueDiligence.conciliados.length})</span>
                    </button>
                  </div>

                  {/* Conteúdo da Tab: BMs Ausentes */}
                  {tabDueDiligence === "ausentes" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", color: "#991b1b", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                        <span>
                          <strong>Diagnóstico:</strong> Estes <strong>{dueDiligence.ausentes.length} BMs</strong> foram aprovados e homologados no sistema, porém <strong>NÃO constam na aba PAGAMENTOS-26</strong>. Devem ser registrados para conciliação contábil coerente.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const header = "BM\tCONSULTOR\tMÊS\tVALOR\tPROJETOS\n";
                            const rows = dueDiligence.ausentes.map((a: any) => {
                              const projs = (a.bm.atividades || []).map((x: any) => x.projeto).join("; ");
                              return `${a.bm.codigo}\t${a.bm.consultorNome}\t${a.mesBm}\t${a.valorBm}\t${projs}`;
                            }).join("\n");
                            navigator.clipboard.writeText(header + rows);
                            setToastMsg("Lista copiada para a área de transferência!");
                            setTimeout(() => setToastMsg(null), 3000);
                          }}
                          className="btn-secondary"
                          style={{ fontSize: "11px", padding: "4px 10px", backgroundColor: "#ffffff" }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>content_copy</span>
                          Copiar Tabela (Excel/Sheets)
                        </button>
                      </div>

                      <div style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden", maxHeight: "320px", overflowY: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                          <thead style={{ backgroundColor: "var(--surface-container-low, #f8fafc)", position: "sticky", top: 0, zIndex: 1, borderBottom: "1px solid var(--border)" }}>
                            <tr>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>BM</th>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>Consultor</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>Mês Ref.</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>Valor Aprovado</th>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>Projeto(s) Envolvido(s)</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>Status no Sistema</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dueDiligence.ausentes.map((item: any, idx: number) => {
                              const projs = Array.from(new Set((item.bm.atividades || []).map((a: any) => a.projeto))).join(", ");
                              return (
                                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfcfd" }}>
                                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, color: "#dc2626" }}>
                                    #{item.bm.codigo}
                                  </td>
                                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--on-surface)" }}>
                                    {item.bm.consultorNome}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#64748b" }}>
                                    {item.mesBm}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                                    R$ {item.valorBm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: "8px 12px", color: "#475569" }}>
                                    {projs || "Geral"}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <span style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: "4px" }}>
                                      Aprovado & Pronto
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Conteúdo da Tab: Pagos sem BM */}
                  {tabDueDiligence === "sem_bm" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", color: "#92400e" }}>
                        <strong>Ação Simples na Planilha:</strong> Estes <strong>{dueDiligence.pagosSemBm.length} pagamentos</strong> já estão quitados na planilha (mesmo valor e consultor). Basta apenas <strong>digitar o número do BM</strong> na coluna <code>Vínculo BM</code> da planilha.
                      </div>

                      <div style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden", maxHeight: "320px", overflowY: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                          <thead style={{ backgroundColor: "var(--surface-container-low, #f8fafc)", position: "sticky", top: 0, zIndex: 1, borderBottom: "1px solid var(--border)" }}>
                            <tr>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>BM Homologado</th>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>Consultor</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>Mês Ref.</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>Valor Total</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>Data Pgto</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>Nº Nota na Planilha</th>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>Linhas na Planilha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dueDiligence.pagosSemBm.map((item: any, idx: number) => {
                              return (
                                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfcfd" }}>
                                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, color: "#d97706" }}>
                                    #{item.bm.codigo}
                                  </td>
                                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--on-surface)" }}>
                                    {item.bm.consultorNome}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#64748b" }}>
                                    {item.mesBm}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#16a34a" }}>
                                    R$ {item.valorBm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    {item.dataPagto}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>
                                    {item.nota}
                                  </td>
                                  <td style={{ padding: "8px 12px", color: "#475569" }}>
                                    {item.pagamentosRelacionados.map((p: any) => `${p.projeto} (R$ ${Number(p.valor).toFixed(2)})`).join(" + ")}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Conteúdo da Tab: Conciliados */}
                  {tabDueDiligence === "conciliados" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", color: "#166534" }}>
                        <strong>Conformidade Total:</strong> <strong>{dueDiligence.conciliados.length} BMs</strong> estão perfeitamente conciliados entre o sistema e a planilha de pagamentos.
                      </div>

                      <div style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden", maxHeight: "320px", overflowY: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                          <thead style={{ backgroundColor: "var(--surface-container-low, #f8fafc)", position: "sticky", top: 0, zIndex: 1, borderBottom: "1px solid var(--border)" }}>
                            <tr>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>BM</th>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>Consultor</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>Mês Ref.</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>Valor BM</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>Data Pgto</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>Nº Nota</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>Status Planilha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dueDiligence.conciliados.slice(0, 100).map((item: any, idx: number) => {
                              return (
                                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfcfd" }}>
                                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, color: "var(--primary)" }}>
                                    #{item.bm.codigo}
                                  </td>
                                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--on-surface)" }}>
                                    {item.bm.consultorNome}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#64748b" }}>
                                    {item.bm.mesReferencia?.split("/")[0]}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                                    R$ {Number(item.bm.valorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    {item.match.dataPagto}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>
                                    {item.match.numeroNota}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <span style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: "4px" }}>
                                      {item.match.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setModalDueDiligenceAberto(false)}
                  >
                    Fechar
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
