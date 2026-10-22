"use client";

import React, { useState, useMemo, useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import faturamentoBase from "@/lib/faturamento-base.json";
import ccBase from "@/lib/centros-de-custo.json";
import ModernDropdown from "@/components/ModernDropdown";

export interface FaturamentoItem {
  id: string;
  realizado: string; // Ex: "SETEMBRO", "JANEIRO"
  faturado: string; // Ex: "OUTUBRO", "JANEIRO"
  projeto: string;
  perfil: string; // Ex: "SÊNIOR", "BACK OFFICE"
  numeroNota: string; // Ex: "736", "2", "3"
  valor: number;
  valorFormatado?: string;
  pedidoCompras: string; // Ex: "1008715596", "4504176258"
  status: string; // Ex: "Pago", "Aberto", "Em Cobrança"
  vencimento: string; // Ex: "07/01/2026"
  dataPagto: string; // Ex: "10/12/2025"
  dias: number; // Ex: -28, 3, 113
  pagtoDescricao: string; // Ex: "28 DIAS ADIANTADO", "3 DIAS EM ATRASO"
  centroCusto: string; // Ex: "01.06.012.049"
  area: string; // Ex: "HRD - HUMAN RESOURCE DEVELOPMENT"
  tipoDocumento?: "NF" | "ND"; // NF (Nota Fiscal) ou ND (Nota de Débito)
  atividadeVinculadaId?: string; // ID da atividade vinculada se for ND
  atividadeVinculadaNome?: string;
  destinoNd?: "consultor" | "agencia" | "ambos";
  origemProjetos?: boolean;
  anoCompetencia?: string;
}

const formatarDataISOparaBR = (dataIso?: string | null): string => {
  if (!dataIso) return "";
  const partes = dataIso.split("T")[0].split("-");
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataIso;
};

const formatarPeriodoAtividade = (dtIni?: string | null, dtFim?: string | null): string => {
  if (!dtIni) return "";
  const fIni = formatarDataISOparaBR(dtIni);
  const fFim = dtFim ? formatarDataISOparaBR(dtFim) : fIni;
  return fIni === fFim ? `(${fIni})` : `(${fIni} a ${fFim})`;
};

const formatarMoedaBRInput = (val: number | null | undefined): string => {
  if (val == null || isNaN(val) || val === 0) return "";
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoedaBRInput = (str: string): number => {
  const digits = str.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

const formatarDataInputBR = (val: string): string => {
  const digits = val.replace(/\D/g, "");
  if (!digits) return "";
  
  // Se digitar 6 dígitos (DDMMAA), auto-completa para DDMMAAAA
  if (digits.length === 6) {
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const a = "20" + digits.slice(4, 6);
    return `${d}/${m}/${a}`;
  }

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

const expandirAnoSeDoisDigitos = (val: string): string => {
  if (!val) return "";
  const partes = val.split("/");
  if (partes.length === 3 && partes[2].length === 2) {
    return `${partes[0].padStart(2, "0")}/${partes[1].padStart(2, "0")}/20${partes[2]}`;
  }
  const digits = val.replace(/\D/g, "");
  if (digits.length === 6) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/20${digits.slice(4, 6)}`;
  }
  return val;
};

// Converte strings no formato DD/MM/AAAA ou AAAA-MM-DD para objeto Date
function parseDataBR(dataStr?: string | null): Date | null {
  if (!dataStr) return null;
  const limpa = dataStr.trim();
  const partes = limpa.split("/");
  if (partes.length === 3) {
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const ano = parseInt(partes[2], 10);
    if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
      return new Date(ano, mes, dia);
    }
  }
  const partesIso = limpa.split("-");
  if (partesIso.length === 3) {
    const ano = parseInt(partesIso[0], 10);
    const mes = parseInt(partesIso[1], 10) - 1;
    const dia = parseInt(partesIso[2], 10);
    if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
      return new Date(ano, mes, dia);
    }
  }
  return null;
}

// Calcula automaticamente o fluxo e status de pagamento (dias adiantados / atraso / no prazo)
function calcularFluxoPagamento(
  status?: string,
  vencimento?: string,
  dataPagto?: string
): { dias: number; pagtoDescricao: string } {
  const isPago = (status || "").trim().toLowerCase() === "pago" || !!(dataPagto && dataPagto.trim());
  const dVenc = parseDataBR(vencimento);
  const dPagto = parseDataBR(dataPagto);

  if (isPago && dPagto && dVenc) {
    const diffTime = dPagto.getTime() - dVenc.getTime();
    const diffDias = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      const adiantado = Math.abs(diffDias);
      return {
        dias: diffDias,
        pagtoDescricao: `${adiantado} dias adiantado`,
      };
    } else if (diffDias > 0) {
      return {
        dias: diffDias,
        pagtoDescricao: `${diffDias} dias em atraso`,
      };
    } else {
      return {
        dias: 0,
        pagtoDescricao: "Pago no prazo",
      };
    }
  }

  if (isPago) {
    return {
      dias: 0,
      pagtoDescricao: dPagto ? "Pago" : "Pago no prazo",
    };
  }

  if (dVenc) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diffTime = hoje.getTime() - dVenc.getTime();
    const diffDias = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDias > 0) {
      return {
        dias: diffDias,
        pagtoDescricao: `${diffDias} dias em atraso`,
      };
    } else {
      return {
        dias: 0,
        pagtoDescricao: "Aguardando pagamento",
      };
    }
  }

  return {
    dias: 0,
    pagtoDescricao: "Aguardando pagamento",
  };
}

const MESES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export default function FaturamentoPage() {
  const dataHoje = new Date();
  const mesAtualNome = MESES_NOMES[dataHoje.getMonth()] || "OUTUBRO";

  const [faturamentos, setFaturamentos] = useState<FaturamentoItem[]>(() => {
    const raw = (faturamentoBase || []) as any[];
    return raw
      .filter((item: any) => item && item.id !== "fat-709" && item.numeroNota !== "TOTAL" && item.area !== "-")
      .map((item: any) => {
        const areaLimpa = (item.area || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
        const poLimpo = (item.pedidoCompras === "A DEFINIR" || item.pedidoCompras === "undefined") ? "" : (item.pedidoCompras || "");
        const fluxo = calcularFluxoPagamento(item.status, item.vencimento, item.dataPagto);
        const precisaAtualizar = (item.status === "Pago" || item.dataPagto) && (item.dias === 0 && (item.pagtoDescricao === "Aguardando pagamento" || !item.pagtoDescricao));
        return {
          ...item,
          area: areaLimpa,
          pedidoCompras: poLimpo,
          dias: precisaAtualizar ? fluxo.dias : (item.dias ?? fluxo.dias),
          pagtoDescricao: precisaAtualizar ? fluxo.pagtoDescricao : (item.pagtoDescricao || fluxo.pagtoDescricao),
        };
      });
  });
  const [busca, setBusca] = useState("");
  const [filtroAno, setFiltroAno] = useState<string>("2026");
  const [filtroMes, setFiltroMes] = useState<string>(mesAtualNome);
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [filtroVencimento, setFiltroVencimento] = useState<"TODOS" | "A_VENCER" | "VENCIDO">("TODOS");
  const [perfisSelecionados, setPerfisSelecionados] = useState<string[]>([]);
  const [dropdownPerfilAberto, setDropdownPerfilAberto] = useState(false);
  const [filtroArea, setFiltroArea] = useState<string>("TODAS");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Controle de linhas expandidas para exibir detalhes verticais (Pedido de Compras, CC e Fluxo)
  const [linhasExpandidas, setLinhasExpandidas] = useState<Set<string>>(new Set());
  const [confirmandoExclusaoFatId, setConfirmandoExclusaoFatId] = useState<string | null>(null);

  const alternarExpansao = (id: string) => {
    setLinhasExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Perfis únicos disponíveis para filtro multi-seleção
  const perfisUnicos = useMemo(() => {
    const s = new Set<string>();
    faturamentos.forEach((f) => {
      if (f.perfil && f.perfil.trim()) s.add(f.perfil.trim().toUpperCase());
    });
    return Array.from(s).sort();
  }, [faturamentos]);

  const alternarPerfil = (perfil: string) => {
    setPerfisSelecionados((prev) => {
      if (prev.includes(perfil)) {
        return prev.filter((p) => p !== perfil);
      } else {
        return [...prev, perfil];
      }
    });
  };

  // Helper para verificar se a fatura está vencida
  const isFaturaVencida = (f: FaturamentoItem) => {
    if (f.status === "Pago") return false;
    if (f.dias > 0 || (f.pagtoDescricao || "").toUpperCase().includes("ATRASO")) return true;
    if (!f.vencimento) return false;
    const parts = f.vencimento.split("/");
    if (parts.length === 3) {
      const dataVenc = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return dataVenc < hoje;
    }
    return false;
  };

  // Anos disponíveis identificados na base
  const anosDisponiveis = useMemo(() => {
    const s = new Set<string>();
    faturamentos.forEach((f) => {
      if (f.vencimento) {
        const m = f.vencimento.match(/\d{4}/);
        if (m) s.add(m[0]);
      }
      if (f.dataPagto) {
        const m = f.dataPagto.match(/\d{4}/);
        if (m) s.add(m[0]);
      }
    });
    if (s.size === 0) s.add("2026");
    return Array.from(s).sort().reverse();
  }, [faturamentos]);

  // Sincronização inicial com servidor e localStorage
  useEffect(() => {
    const sanitizarFaturamento = (lista: any[]) => {
      return (lista || [])
        .filter((item: any) => {
          if (!item || item.id === "fat-709" || item.numeroNota === "TOTAL" || item.area === "-" || item.projeto === "TOTAL") {
            return false;
          }
          // Preserva estritamente o histórico faturado da planilha (Jan a Out)
          // Regra de projeto só é aplicada para Novembro e Dezembro
          if (item.origemProjetos && item.realizado && item.realizado !== "NOVEMBRO" && item.realizado !== "DEZEMBRO") {
            return false;
          }
          return true;
        })
        .map((item: any) => {
          const areaLimpa = (item.area || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
          const poLimpo = (item.pedidoCompras === "A DEFINIR" || item.pedidoCompras === "undefined") ? "" : (item.pedidoCompras || "");
          const fluxo = calcularFluxoPagamento(item.status, item.vencimento, item.dataPagto);
          const precisaAtualizar = (item.status === "Pago" || item.dataPagto) && (item.dias === 0 && (item.pagtoDescricao === "Aguardando pagamento" || !item.pagtoDescricao));
          return {
            ...item,
            area: areaLimpa,
            pedidoCompras: poLimpo,
            dias: precisaAtualizar ? fluxo.dias : (item.dias ?? fluxo.dias),
            pagtoDescricao: precisaAtualizar ? fluxo.pagtoDescricao : (item.pagtoDescricao || fluxo.pagtoDescricao),
          };
        });
    };

    try {
      const saved = localStorage.getItem("nnos_faturamento_cadastrado_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFaturamentos(sanitizarFaturamento(parsed));
        }
      }
    } catch {}

    fetch("/api/faturamento")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const limpo = sanitizarFaturamento(data);
          setFaturamentos(limpo);
          try {
            localStorage.setItem("nnos_faturamento_cadastrado_v1", JSON.stringify(limpo));
          } catch {}
        }
      })
      .catch((e) => console.error("Erro ao carregar faturamento:", e));
  }, []);

  const salvarFaturamento = (novos: FaturamentoItem[]) => {
    setFaturamentos(novos);
    try {
      localStorage.setItem("nnos_faturamento_cadastrado_v1", JSON.stringify(novos));
    } catch {}
    fetch("/api/faturamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novos),
    }).catch((e) => console.error("Erro ao salvar faturamento:", e));
  };

  // Modal de Nova Fatura
  const [modalAberto, setModalAberto] = useState(false);
  const [itemEdicao, setItemEdicao] = useState<FaturamentoItem | null>(null);
  const [atividadesProjeto, setAtividadesProjeto] = useState<any[]>([]);
  const [form, setForm] = useState<Partial<FaturamentoItem>>({
    realizado: mesAtualNome,
    faturado: mesAtualNome,
    perfil: "SÊNIOR",
    status: "Aberto",
    valor: 0,
    tipoDocumento: "NF",
    centroCusto: "01.04.001.001",
    area: "DEALER DEVELOPMENT",
  });

  // Busca atividades do projeto selecionado para vincular caso o documento seja ND
  useEffect(() => {
    if (form.projeto && form.projeto.trim().length >= 3) {
      fetch(`/api/lancamentos?projeto_nome=${encodeURIComponent(form.projeto.trim())}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            setAtividadesProjeto(res.data);
          } else {
            setAtividadesProjeto([]);
          }
        })
        .catch(() => setAtividadesProjeto([]));
    } else {
      setAtividadesProjeto([]);
    }
  }, [form.projeto]);

  const abrirNovaFatura = () => {
    setItemEdicao(null);
    setForm({
      realizado: mesAtualNome,
      faturado: mesAtualNome,
      perfil: "SÊNIOR",
      status: "Aberto",
      valor: 0,
      tipoDocumento: "NF",
      numeroNota: "",
      pedidoCompras: "",
      centroCusto: "01.04.001.001",
      area: "DEALER DEVELOPMENT",
      vencimento: "",
      dataPagto: "",
    });
    setModalAberto(true);
  };

  const abrirEditar = (item: FaturamentoItem) => {
    setItemEdicao(item);
    setForm({ ...item, tipoDocumento: item.tipoDocumento || (item.numeroNota && item.numeroNota.toUpperCase().includes("ND") ? "ND" : "NF") });
    setModalAberto(true);
  };

  const handleSalvarFatura = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projeto || !form.projeto.trim()) {
      alert("Por favor, selecione ou digite o Projeto.");
      return;
    }
    if (!form.numeroNota || !form.numeroNota.trim()) {
      alert(form.tipoDocumento === "ND" ? "Por favor, preencha o Número da Nota de Débito (ND)." : "Por favor, preencha o Número da Nota Fiscal.");
      return;
    }

    let novos: FaturamentoItem[];
    const poFinal = form.pedidoCompras === "A DEFINIR" ? "" : (form.pedidoCompras?.trim() || "");
    const fluxoCalculado = calcularFluxoPagamento(form.status, form.vencimento, form.dataPagto);

    if (itemEdicao) {
      novos = faturamentos.map((f) => {
        if (f.id === itemEdicao.id) {
          const merged = { ...f, ...form };
          const fluxo = calcularFluxoPagamento(merged.status, merged.vencimento, merged.dataPagto);
          return {
            ...merged,
            pedidoCompras: merged.pedidoCompras === "A DEFINIR" ? "" : (merged.pedidoCompras?.trim() || ""),
            dias: fluxo.dias,
            pagtoDescricao: fluxo.pagtoDescricao,
          } as FaturamentoItem;
        }
        return f;
      });
    } else {
      const novo: FaturamentoItem = {
        id: `fat-custom-${Date.now()}`,
        realizado: form.realizado || mesAtualNome,
        faturado: form.faturado || mesAtualNome,
        projeto: form.projeto.trim().toUpperCase(),
        perfil: form.perfil || "SÊNIOR",
        tipoDocumento: form.tipoDocumento || "NF",
        atividadeVinculadaId: form.atividadeVinculadaId,
        atividadeVinculadaNome: form.atividadeVinculadaNome,
        numeroNota: form.numeroNota.trim(),
        valor: Number(form.valor) || 0,
        valorFormatado: Number(form.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        pedidoCompras: poFinal,
        status: form.status || "Aberto",
        vencimento: form.vencimento || "",
        dataPagto: form.dataPagto || "",
        dias: fluxoCalculado.dias,
        pagtoDescricao: fluxoCalculado.pagtoDescricao,
        centroCusto: form.centroCusto || "01.00",
        area: form.area || "GERAL",
      };
      novos = [novo, ...faturamentos];
    }

    // Se for ND e houver atividade vinculada selecionada, faz a conciliação automática do repasse e grava a ND no Supabase
    if (form.tipoDocumento === "ND" && form.atividadeVinculadaId) {
      const dest = form.destinoNd || "consultor";
      fetch(`/api/lancamentos/${form.atividadeVinculadaId}/vincular-nd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destino: dest,
          numero: form.numeroNota || "0000",
          valor: Number(form.valor) || 0,
        }),
      }).catch((err) => console.warn("Aviso ao vincular ND à atividade:", err));
    }

    salvarFaturamento(novos);
    setModalAberto(false);
    setToastMsg(
      itemEdicao
        ? "Fatura atualizada com sucesso!"
        : form.tipoDocumento === "ND"
        ? "Nota de Débito (ND) cadastrada e vinculada à atividade com sucesso!"
        : "Nova fatura cadastrada com sucesso!"
    );
    setTimeout(() => setToastMsg(null), 3500);
  };

  const alternarStatus = (id: string, novoStatus: string) => {
    const hojeStr = `${String(new Date().getDate()).padStart(2, "0")}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${new Date().getFullYear()}`;
    const novos = faturamentos.map((f) => {
      if (f.id === id) {
        const pagtoFinal = novoStatus === "Pago" ? (f.dataPagto || hojeStr) : "";
        const fluxo = calcularFluxoPagamento(novoStatus, f.vencimento, pagtoFinal);
        return {
          ...f,
          status: novoStatus,
          dataPagto: pagtoFinal,
          dias: fluxo.dias,
          pagtoDescricao: fluxo.pagtoDescricao,
        };
      }
      return f;
    });
    salvarFaturamento(novos);
    setToastMsg(`Status alterado para "${novoStatus}"`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const excluirFatura = (id: string) => {
    const novos = faturamentos.filter((f) => f.id !== id);
    salvarFaturamento(novos);
    setConfirmandoExclusaoFatId(null);
    setToastMsg("Fatura / ND excluída com sucesso!");
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Filtragem Robusta (Ano, Mês, Status, Vencido/A Vencer, Múltiplos Perfis, Área e Busca Textual)
  const faturamentosFiltrados = useMemo(() => {
    return faturamentos.filter((f) => {
      // Filtro por Ano
      if (filtroAno !== "TODOS") {
        const anoVenc = f.vencimento ? f.vencimento.match(/\d{4}/)?.[0] : null;
        const anoPag = f.dataPagto ? f.dataPagto.match(/\d{4}/)?.[0] : null;
        const anoComp = (f as any).anoCompetencia;
        if (anoVenc || anoPag) {
          if (anoVenc !== filtroAno && anoPag !== filtroAno) return false;
        } else if (anoComp) {
          if (anoComp !== filtroAno) return false;
        }
      }

      // Filtro por Mês (Competência Realizado ou Faturado)
      if (filtroMes !== "TODOS") {
        const matchRealizado = f.realizado?.toUpperCase() === filtroMes.toUpperCase();
        const matchFaturado = f.faturado?.toUpperCase() === filtroMes.toUpperCase();
        if (!matchRealizado && !matchFaturado) return false;
      }

      // Filtro por Status
      if (filtroStatus !== "TODOS") {
        const statusNormalizado = (f.status || "").trim().toLowerCase();
        if (filtroStatus === "Pago") {
          if (statusNormalizado !== "pago") return false;
        } else if (filtroStatus === "Aberto") {
          if (statusNormalizado === "pago") return false;
        } else if (statusNormalizado !== filtroStatus.toLowerCase()) {
          return false;
        }
      }

      // Filtro por Vencido / A Vencer
      if (filtroVencimento !== "TODOS") {
        const vencida = isFaturaVencida(f);
        if (filtroVencimento === "VENCIDO") {
          if (!vencida) return false;
        } else if (filtroVencimento === "A_VENCER") {
          if (vencida || f.status === "Pago") return false;
        }
      }

      // Filtro por Perfil com Múltiplas Seleções
      if (perfisSelecionados.length > 0) {
        const pItem = (f.perfil || "").trim().toUpperCase();
        if (pItem) {
          if (!perfisSelecionados.includes(pItem)) return false;
        } else if (f.origemProjetos || f.faturado === "A FATURAR") {
          // Se for item originado de projetos a faturar e estiver sem perfil explícito, aceita se SÊNIOR estiver selecionado
          if (!perfisSelecionados.includes("SÊNIOR")) return false;
        } else {
          return false;
        }
      }

      // Filtro por Área (normalizado)
      if (filtroArea !== "TODAS") {
        const aItem = (f.area || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
        const aFiltro = filtroArea.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
        if (aItem !== aFiltro) return false;
      }

      // Busca Textual
      if (busca.trim()) {
        const t = busca.toLowerCase();
        const mProj = f.projeto?.toLowerCase().includes(t);
        const mNota = f.numeroNota?.toLowerCase().includes(t);
        const mPO = f.pedidoCompras?.toLowerCase().includes(t);
        const mCC = f.centroCusto?.toLowerCase().includes(t);
        const mArea = f.area?.toLowerCase().includes(t);
        const mPerfil = f.perfil?.toLowerCase().includes(t);
        return mProj || mNota || mPO || mCC || mArea || mPerfil;
      }
      return true;
    });
  }, [faturamentos, filtroAno, filtroMes, filtroStatus, filtroVencimento, perfisSelecionados, filtroArea, busca]);

  // Totais e KPIs calculados considerando o mês da competência (Print 1):
  // TOTAL PREVISTO: soma da coluna REALIZADO no mês filtrado
  // TOTAL FATURADO: soma da coluna FATURADO no mês filtrado (excluindo A FATURAR)
  const totais = useMemo(() => {
    let totalPrevisto = 0;
    let totalFaturado = 0;
    let totalRecebido = 0;
    let totalEmAberto = 0;
    let totalAtraso = 0;
    let totalAFaturar = 0;
    let qtdPrevisto = 0;
    let qtdFaturado = 0;
    let qtdAFaturar = 0;

    faturamentosFiltrados.forEach((f) => {
      const v = Number(f.valor) || 0;
      const isMesRealizado = filtroMes === "TODOS" || f.realizado?.toUpperCase() === filtroMes.toUpperCase();
      const isMesFaturado = filtroMes === "TODOS" || f.faturado?.toUpperCase() === filtroMes.toUpperCase();
      const isAFaturar = f.faturado === "A FATURAR" || (f as any).origemProjetos;

      // Soma do Total Previsto (baseado no que foi planejado/realizado no mês)
      if (isMesRealizado) {
        totalPrevisto += v;
        qtdPrevisto++;
        if (isAFaturar) {
          totalAFaturar += v;
          qtdAFaturar++;
        }
      }

      // Soma do Total Faturado (baseado no que foi efetivamente emitido/faturado no mês)
      if (isMesFaturado && !isAFaturar) {
        totalFaturado += v;
        qtdFaturado++;

        if (f.status === "Pago") {
          totalRecebido += v;
        } else {
          totalEmAberto += v;
          if (f.dias > 0 || f.pagtoDescricao?.includes("ATRASO")) {
            totalAtraso += v;
          }
        }
      }
    });

    return {
      totalPrevisto,
      totalFaturado,
      totalRecebido,
      totalEmAberto,
      totalAtraso,
      totalAFaturar,
      qtdPrevisto,
      qtdFaturado,
      qtdAFaturar,
    };
  }, [faturamentosFiltrados, filtroMes]);

  // Áreas únicas para filtro (eliminando duplicidades, traços e espaços invisíveis)
  const areasUnicas = useMemo(() => {
    const s = new Set<string>();
    faturamentos.forEach((f) => {
      const a = (f.area || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (a && a !== "-" && a !== "—" && a !== "TOTAL") {
        s.add(a);
      }
    });
    return Array.from(s).sort();
  }, [faturamentos]);

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
            <a href="/pessoas" className="nav-item">
              <span className="material-symbols-outlined">group</span>
              <span>Pessoas</span>
            </a>
            <a href="/faturamento" className="nav-item active">
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
          <div className="sidebar-footer-info" style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface)" }}>Sistema Operacional NNÓS</span>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Módulo de Faturamento de Clientes</span>
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
              Faturamento
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
                Controle de Faturamento de Clientes
              </h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={abrirNovaFatura}
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
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_task</span>
                <span>Nova Fatura / Lançamento</span>
              </button>
            </div>
          </div>

          {/* Cards KPI Bento (5 Indicadores: Total Previsto, Total Faturado, Recebido, A Receber e A Faturar - Print 2) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: "12px", marginBottom: "22px" }}>
            {/* Total Previsto (Soma da coluna REALIZADO) */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f2a4a", textTransform: "uppercase" }}>Total Previsto</span>
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--primary)" }}>event_upcoming</span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "var(--primary)", marginTop: "4px" }}>
                R$ {totais.totalPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "11px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                {totais.qtdPrevisto} faturas no realizado
              </div>
            </div>

            {/* Total Faturado (Soma da coluna FATURADO, excluindo A FATURAR) */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#4338ca", textTransform: "uppercase" }}>Total Faturado</span>
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#6366f1" }}>receipt_long</span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#3730a3", marginTop: "4px" }}>
                R$ {totais.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "11px", color: "#4338ca", marginTop: "2px" }}>
                {totais.qtdFaturado} faturas emitidas
              </div>
            </div>

            {/* Total Recebido / Liquidado */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Recebido / Liquidado</span>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#16a34a" }}></span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#16a34a", marginTop: "4px" }}>
                R$ {totais.totalRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "11px", color: "#166534", fontWeight: 600, marginTop: "2px" }}>
                Crédito em conta confirmado
              </div>
            </div>

            {/* Total Em Aberto / A Receber */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", textTransform: "uppercase" }}>A Receber (No Prazo)</span>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#0284c7" }}></span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0284c7", marginTop: "4px" }}>
                R$ {totais.totalEmAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "11px", color: "#0369a1", fontWeight: 600, marginTop: "2px" }}>
                Aguardando liquidação cliente
              </div>
            </div>

            {/* A Faturar */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>A Faturar</span>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#f59e0b" }}></span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#d97706", marginTop: "4px" }}>
                R$ {totais.totalAFaturar.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "11px", color: "#b45309", fontWeight: 600, marginTop: "2px" }}>
                {totais.qtdAFaturar} {totais.qtdAFaturar === 1 ? "fatura prevista" : "faturas previstas"}
              </div>
            </div>
          </div>

          {/* Barra de Filtros e Busca Rápida (Padrão 2 com Pílulas, Filtro de Vencimento e Multi-Perfil) */}
          <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              {/* Input de Busca */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface-container-low, #f8fafc)", padding: "8px 14px", borderRadius: "8px", flex: 1, minWidth: "260px", border: "1px solid var(--border)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--outline)" }}>search</span>
                <input
                  type="text"
                  placeholder="Buscar por projeto, número da NF ou pedido de compra (PO)..."
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

              {/* Dropdowns no Padrão 2 (Pílulas com Ícones: Área, Perfil Multi-Select, Vencimento e Status) */}
              <div className="filter-selects-group" style={{ position: "relative" }}>
                {/* 1. Dropdown de Área Moderno */}
                <ModernDropdown
                  value={filtroArea}
                  onChange={(val) => setFiltroArea(String(val))}
                  options={[
                    { value: "TODAS", label: `Todas as Áreas (${areasUnicas.length})` },
                    ...areasUnicas.map((a) => ({ value: a, label: a })),
                  ]}
                  icon="apartment"
                  minWidth="195px"
                />

                {/* 2. Pílula de Perfil com Múltiplas Seleções */}
                <div style={{ position: "relative" }}>
                  <div
                    className="select-pill"
                    onClick={() => setDropdownPerfilAberto(!dropdownPerfilAberto)}
                    style={{ cursor: "pointer", userSelect: "none", border: perfisSelecionados.length > 0 ? "1px solid var(--primary, #0f2a4a)" : "1px solid var(--border)", background: "var(--surface-container-lowest)", padding: "7px 12px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "6px" }}
                    title="Clique para filtrar por um ou mais perfis"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--primary)" }}>
                      badge
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--on-surface)" }}>
                      {perfisSelecionados.length === 0
                        ? `Todos os Perfis (${perfisUnicos.length})`
                        : perfisSelecionados.length === 1
                        ? perfisSelecionados[0]
                        : `Perfis (${perfisSelecionados.length})`}
                    </span>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--on-surface-variant)", marginLeft: "2px" }}>
                      {dropdownPerfilAberto ? "expand_less" : "expand_more"}
                    </span>
                  </div>

                  {dropdownPerfilAberto && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        backgroundColor: "var(--surface-container-lowest, #ffffff)",
                        borderRadius: "12px",
                        border: "1px solid var(--border, #e2e8f0)",
                        boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
                        padding: "12px 14px",
                        zIndex: 1000,
                        minWidth: "220px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Perfis</span>
                        {perfisSelecionados.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPerfisSelecionados([]);
                            }}
                            style={{ border: "none", background: "none", color: "#0284c7", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "190px", overflowY: "auto" }}>
                        {perfisUnicos.map((p) => {
                          const checked = perfisSelecionados.includes(p);
                          return (
                            <label
                              key={p}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "12.5px",
                                fontWeight: 600,
                                color: "#1e293b",
                                cursor: "pointer",
                                padding: "6px 8px",
                                borderRadius: "8px",
                                backgroundColor: checked ? "rgba(2, 132, 199, 0.1)" : "transparent",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => alternarPerfil(p)}
                                style={{ accentColor: "var(--primary, #0f2a4a)", cursor: "pointer", width: "15px", height: "15px" }}
                              />
                              <span>{p}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Dropdown de Vencimento Moderno */}
                <ModernDropdown
                  value={filtroVencimento}
                  onChange={(val) => setFiltroVencimento(val as any)}
                  options={[
                    { value: "TODOS", label: "Todos os Vencimentos" },
                    { value: "A_VENCER", label: "A Vencer" },
                    { value: "VENCIDO", label: "Vencidos" },
                  ]}
                  icon="schedule"
                  minWidth="180px"
                />

                {/* 4. Dropdown de Status Moderno */}
                <ModernDropdown
                  value={filtroStatus}
                  onChange={(val) => setFiltroStatus(String(val))}
                  options={[
                    { value: "TODOS", label: "Todos os Status" },
                    { value: "Pago", label: "Pago" },
                    { value: "Aberto", label: "Em Aberto" },
                  ]}
                  icon="verified"
                  minWidth="155px"
                />
              </div>
            </div>

            {/* Faixa de Navegação por Competência Mensal no Padrão Oficial 2 (.month-strip & .month-chip) */}
            <nav className="month-strip" aria-label="Seleção de Competência" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px dashed var(--border)" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginRight: "6px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--primary, #002b49)" }}>
                  calendar_month
                </span>
                <span className="month-label" style={{ fontWeight: 700, margin: 0 }}>
                  Competência:
                </span>
                
                {/* Seletor de Ano Moderno */}
                <ModernDropdown
                  value={filtroAno}
                  onChange={(val) => setFiltroAno(String(val))}
                  options={[
                    { value: "TODOS", label: "Todos os Anos" },
                    ...anosDisponiveis.map((a) => ({ value: a, label: a })),
                  ]}
                  buttonStyle={{ padding: "4px 10px", fontSize: "12.5px" }}
                  minWidth="110px"
                />
              </div>

              {/* Chips de Meses no Padrão Oficial 2 (Texto limpo, sem bordas, ativo escuro arredondado) */}
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
                    fontWeight: filtroMes === "TODOS" ? 700 : 600,
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
                      onClick={() => {
                        setFiltroMes((prev) => (prev.toUpperCase() === nomeCompleto.toUpperCase() ? "TODOS" : nomeCompleto));
                      }}
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
                        fontWeight: ativo ? 700 : 600,
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

          {/* Tabela de Faturamento Oficial (CONTROLE DE NOTAS FISCAIS EMITIDAS & RECEBIMENTOS) */}
          <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <div style={{ padding: "14px 20px", backgroundColor: "#0f2a4a", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: 700, flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#38bdf8" }}>receipt</span>
                <span style={{ fontSize: "12.5px", letterSpacing: "0.04em", fontWeight: 800 }}>
                  CONTROLE DE NOTAS FISCAIS EMITIDAS & RECEBIMENTOS
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                {/* Legenda Discreta de Fluxo */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", color: "#cbd5e1" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#22c55e" }}></span>
                    Dias Adiantados
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ef4444" }}></span>
                    Dias em Atraso
                  </span>
                </div>
                <span style={{ fontSize: "11.5px", backgroundColor: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: "6px", fontWeight: 700 }}>
                  {faturamentosFiltrados.length} Faturas Registradas
                </span>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", textTransform: "uppercase", fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.04em" }}>
                    <th style={{ padding: "12px 8px", width: "42px", textAlign: "center" }}></th>
                    <th style={{ padding: "12px 14px", width: "95px", whiteSpace: "nowrap" }}>Realizado</th>
                    <th style={{ padding: "12px 12px", width: "95px", whiteSpace: "nowrap" }}>Faturado</th>
                    <th style={{ padding: "12px 16px", minWidth: "260px" }}>Projeto & Área</th>
                    <th style={{ padding: "12px 14px", width: "140px", whiteSpace: "nowrap" }}>Perfil</th>
                    <th style={{ padding: "12px 10px", width: "85px", textAlign: "center", whiteSpace: "nowrap" }}>Nº Nota</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", width: "120px", whiteSpace: "nowrap" }}>Valor (R$)</th>
                    <th style={{ padding: "12px 12px", width: "100px", whiteSpace: "nowrap" }}>Status</th>
                    <th style={{ padding: "12px 12px", width: "100px", whiteSpace: "nowrap" }}>Vencimento</th>
                    <th style={{ padding: "12px 12px", width: "100px", whiteSpace: "nowrap" }}>Data Pagto</th>
                    <th style={{ padding: "12px 12px", width: "105px", textAlign: "center", whiteSpace: "nowrap" }}>Fluxo / Dias</th>
                    <th style={{ padding: "12px 12px", textAlign: "center", width: "65px", whiteSpace: "nowrap" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {faturamentosFiltrados.map((item, idx) => {
                    const fluxoItem = calcularFluxoPagamento(item.status, item.vencimento, item.dataPagto);
                    const descFluxo = fluxoItem.pagtoDescricao;
                    const isAdiantado = fluxoItem.dias < 0 || descFluxo.toUpperCase().includes("ADIANTADO");
                    const isAtraso = fluxoItem.dias > 0 || descFluxo.toUpperCase().includes("ATRASO");
                    const numDias = fluxoItem.dias !== 0 ? String(Math.abs(fluxoItem.dias)) : (descFluxo.replace(/[^0-9]/g, ""));
                    const expandido = linhasExpandidas.has(item.id);

                    return (
                      <React.Fragment key={item.id || idx}>
                        <tr
                          style={{
                            borderBottom: expandido ? "none" : "1px solid #f1f5f9",
                            backgroundColor: expandido ? "#f8fafc" : idx % 2 === 0 ? "#ffffff" : "#fcfcfd",
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!expandido) e.currentTarget.style.backgroundColor = "#f8fafc";
                          }}
                          onMouseLeave={(e) => {
                            if (!expandido) e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#ffffff" : "#fcfcfd";
                          }}
                        >
                          {/* Botão de Expansão Chevron (Print 4) */}
                          <td style={{ padding: "12px 8px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => alternarExpansao(item.id)}
                              title={expandido ? "Recolher detalhes da fatura" : "Expandir detalhes (Pedido de Compras, CC e Fluxo)"}
                              style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "6px",
                                backgroundColor: expandido ? "#0f2a4a" : "var(--surface-container-low, #f1f5f9)",
                                color: expandido ? "#ffffff" : "var(--primary, #0f2a4a)",
                                border: "1px solid var(--border, #cbd5e1)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                                {expandido ? "keyboard_arrow_up" : "keyboard_arrow_down"}
                              </span>
                            </button>
                          </td>

                          {/* Realizado */}
                          <td style={{ padding: "12px 14px", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap", fontSize: "12.5px" }}>
                            {item.realizado}
                          </td>

                          {/* Faturado */}
                          <td style={{ padding: "12px 12px", whiteSpace: "nowrap", fontSize: "12.5px" }}>
                            {item.faturado === "A FATURAR" ? (
                              <span style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                backgroundColor: "#fef3c7",
                                color: "#92400e",
                                fontWeight: 800,
                                fontSize: "11px",
                                letterSpacing: "0.03em"
                              }}>
                                A FATURAR
                              </span>
                            ) : (
                              <span style={{ color: "#334155", fontWeight: 600 }}>{item.faturado}</span>
                            )}
                          </td>

                          {/* Projeto & Área (Fontes Aumentadas para Preencher o Espaço) */}
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a" }}>
                            <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#0f2a4a", lineHeight: 1.3 }}>{item.projeto}</div>
                            <div style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 500, marginTop: "2px" }}>{item.area}</div>
                          </td>

                          {/* Perfil (Sem Quebra de Linha) */}
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 9px",
                                borderRadius: "6px",
                                backgroundColor: item.perfil ? "#f1f5f9" : "transparent",
                                fontSize: "11px",
                                fontWeight: 700,
                                color: item.perfil ? "#334155" : "#94a3b8",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.perfil || "—"}
                            </span>
                          </td>

                          {/* Nº Nota / ND (CAMPO COM TAMANHO PADRONIZADO E DISTINÇÃO VISUAL NF x ND) */}
                          <td style={{ padding: "12px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: "56px",
                                height: "26px",
                                padding: "0 8px",
                                borderRadius: "6px",
                                backgroundColor: item.tipoDocumento === "ND" ? "rgba(0, 168, 150, 0.12)" : item.numeroNota ? "#e0f2fe" : "#f1f5f9",
                                color: item.tipoDocumento === "ND" ? "#008779" : item.numeroNota ? "#0369a1" : "#94a3b8",
                                fontWeight: 800,
                                fontSize: "11.5px",
                                border: item.tipoDocumento === "ND" ? "1px solid rgba(0, 168, 150, 0.3)" : "none",
                              }}
                              title={item.tipoDocumento === "ND" ? `Nota de Débito (ND): ${item.numeroNota}${item.atividadeVinculadaNome ? ` | Vinculada: ${item.atividadeVinculadaNome}` : ""}` : `Nota Fiscal: ${item.numeroNota}`}
                            >
                              {item.tipoDocumento === "ND" ? `ND ${item.numeroNota || "—"}` : (item.numeroNota || "—")}
                            </span>
                          </td>

                          {/* Valor */}
                          <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", fontSize: "13px" }}>
                            R$ {Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                            <span
                              onClick={() => alternarStatus(item.id, item.status === "Pago" ? "Aberto" : "Pago")}
                              title="Clique para alternar status"
                              style={{
                                padding: "4px 9px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                backgroundColor: item.status === "Pago" ? "#dcfce7" : "#fef3c7",
                                color: item.status === "Pago" ? "#166534" : "#92400e",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.status}
                            </span>
                          </td>

                          {/* Vencimento */}
                          <td style={{ padding: "12px 12px", color: isFaturaVencida(item) ? "#dc2626" : "#64748b", fontWeight: isFaturaVencida(item) ? 700 : 500, whiteSpace: "nowrap", fontSize: "12px" }}>
                            {item.vencimento || "—"}
                          </td>

                          {/* Data Pagto */}
                          <td style={{ padding: "12px 12px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", fontSize: "12px" }}>
                            {item.dataPagto || "—"}
                          </td>

                          {/* Fluxo / Dias */}
                          <td style={{ padding: "12px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                            {numDias ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  backgroundColor: isAdiantado ? "#dcfce7" : isAtraso ? "#fee2e2" : "#f1f5f9",
                                  color: isAdiantado ? "#15803d" : isAtraso ? "#b91c1c" : "#475569",
                                  whiteSpace: "nowrap",
                                }}
                                title={descFluxo}
                              >
                                {numDias} dias
                              </span>
                            ) : (item.status === "Pago" || item.dataPagto) ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  backgroundColor: "#dcfce7",
                                  color: "#15803d",
                                  whiteSpace: "nowrap",
                                }}
                                title={descFluxo}
                              >
                                {descFluxo || "No prazo"}
                              </span>
                            ) : (
                              <span style={{ color: "#cbd5e1" }}>—</span>
                            )}
                          </td>

                          {/* Ações */}
                          <td style={{ padding: "12px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirEditar(item);
                                }}
                                title="Editar"
                                style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", color: "var(--secondary)" }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
                              </button>

                              {confirmandoExclusaoFatId === item.id ? (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => excluirFatura(item.id)}
                                    title="Confirmar exclusão desta fatura"
                                    style={{
                                      border: "1px solid #b91c1c",
                                      backgroundColor: "#dc2626",
                                      color: "#ffffff",
                                      cursor: "pointer",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "2px",
                                    }}
                                  >
                                    Excluir?
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmandoExclusaoFatId(null)}
                                    title="Cancelar"
                                    style={{
                                      border: "1px solid var(--border)",
                                      backgroundColor: "var(--surface)",
                                      color: "var(--on-surface-variant)",
                                      cursor: "pointer",
                                      padding: "2px 5px",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmandoExclusaoFatId(item.id);
                                  }}
                                  title="Excluir fatura / ND"
                                  style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", color: "#dc2626" }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* LINHA EXPANSÍVEL: SUBPAINEL VERTICAL DE DETALHES (CONFORME PRINT 4) */}
                        {expandido && (
                          <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                            <td colSpan={12} style={{ padding: "0 18px 16px 42px" }}>
                              <div
                                style={{
                                  backgroundColor: "#ffffff",
                                  borderRadius: "10px",
                                  border: "1px solid #e2e8f0",
                                  padding: "16px 20px",
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                                }}
                              >
                                {/* Cabeçalho do Detalhamento */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#0284c7" }}>
                                      inventory_2
                                    </span>
                                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#0f2a4a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                      Detalhamento Operacional & Pedido de Compras (PO)
                                    </span>
                                  </div>
                                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                                    NF #{item.numeroNota} • {item.projeto}
                                  </span>
                                </div>

                                {/* Bento Cards no Formato Vertical/Horizontal Elegante */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                                  {/* Card 1: Pedido de Compras (PO) em Destaque */}
                                  <div style={{ background: "#f0f9ff", borderRadius: "8px", padding: "12px 14px", border: "1px solid #bae6fd" }}>
                                    <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>receipt_long</span>
                                      Pedido de Compras (PO)
                                    </div>
                                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f2a4a", marginTop: "4px", letterSpacing: "0.5px" }}>
                                      {item.pedidoCompras && item.pedidoCompras !== "A DEFINIR" && item.pedidoCompras !== "—" ? item.pedidoCompras : "—"}
                                    </div>
                                    <div style={{ fontSize: "10.5px", color: "#0284c7", marginTop: "2px" }}>
                                      Número da Ordem de Compra oficial
                                    </div>
                                  </div>

                                  {/* Card 2: Centro de Custo Vinculado */}
                                  <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>account_tree</span>
                                      Centro de Custo
                                    </div>
                                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f2a4a", marginTop: "4px" }}>
                                      {item.centroCusto || "01.00"}
                                    </div>
                                    <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "2px" }}>
                                      {item.area}
                                    </div>
                                  </div>

                                  {/* Card 3: Fluxo Financeiro & Prazos */}
                                  <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>schedule</span>
                                      Situação do Pagamento
                                    </div>
                                    <div style={{ fontSize: "12px", fontWeight: 800, color: (item.status === "Pago" || !!item.dataPagto) ? "#166534" : (isFaturaVencida(item) ? "#dc2626" : "#92400e"), marginTop: "4px" }}>
                                      {descFluxo}
                                    </div>
                                    <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "2px" }}>
                                      Venc: {item.vencimento || "—"} • Pagto: {item.dataPagto || "Pendente"}
                                    </div>
                                  </div>

                                  {/* Card 4: Vínculo de Atividade / Repasse (Se for ND) */}
                                  {item.tipoDocumento === "ND" && (
                                    <div style={{ background: "rgba(0, 168, 150, 0.05)", borderRadius: "8px", padding: "12px 14px", border: "1px solid rgba(0, 168, 150, 0.25)" }}>
                                      <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#00a896", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>link</span>
                                        Atividade Vinculada (Repasse)
                                      </div>
                                      <div style={{ fontSize: "12.5px", fontWeight: 800, color: "#0f2a4a", marginTop: "4px" }}>
                                        {item.atividadeVinculadaNome || "Vinculada a Atividade do Projeto"}
                                      </div>
                                      <div style={{ fontSize: "10.5px", color: "#008779", marginTop: "2px" }}>
                                        Repasse conciliado automaticamente
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal de Nova Fatura / Lançamento (Padrão Oficial Print 5) */}
          {modalAberto && (
            <div className="modal-backdrop" onClick={() => setModalAberto(false)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>
                    <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                      {itemEdicao ? "edit_note" : "add_circle"}
                    </span>
                    <span>{itemEdicao ? "Editar Fatura de Cliente" : "Nova Fatura / Lançamento de Faturamento"}</span>
                  </h3>
                  <button
                    type="button"
                    className="btn-modal-close"
                    onClick={() => setModalAberto(false)}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <form onSubmit={handleSalvarFatura}>
                  <div className="modal-body">
                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Mês Realizado *</label>
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
                        <label>Mês Faturado *</label>
                        <select
                          value={form.faturado || "A FATURAR"}
                          onChange={(e) => setForm({ ...form, faturado: e.target.value })}
                        >
                          <option value="A FATURAR">A FATURAR</option>
                          {MESES_NOMES.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: "14px" }}>
                      <div className="form-field">
                        <label>Projeto *</label>
                        <input
                          type="text"
                          list="projetos-list-fat"
                          placeholder="Digite para buscar ou listar projetos..."
                          value={form.projeto || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const ccItem = ccBase.centrosDeCusto.find((c) => c.projeto.toUpperCase() === val.toUpperCase());
                            setForm({
                              ...form,
                              projeto: val,
                              centroCusto: ccItem ? ccItem.centroDeCusto : form.centroCusto,
                              area: ccItem ? ccItem.area : form.area,
                            });
                          }}
                        />
                        <datalist id="projetos-list-fat">
                          {ccBase.centrosDeCusto.map((cc, i) => (
                            <option key={i} value={cc.projeto} />
                          ))}
                        </datalist>
                      </div>

                      <div className="form-field">
                        <label>Perfil do Profissional</label>
                        <select
                          value={form.perfil || "SÊNIOR"}
                          onChange={(e) => setForm({ ...form, perfil: e.target.value })}
                        >
                          <option value="SÊNIOR">SÊNIOR</option>
                          <option value="PLENO">PLENO</option>
                          <option value="BACK OFFICE">BACK OFFICE</option>
                          <option value="LOGÍSTICA">LOGÍSTICA</option>
                          <option value="MATERIAL">MATERIAL</option>
                          <option value="DIRETORIA">DIRETORIA</option>
                        </select>
                      </div>
                    </div>

                    {/* Seletor Tipo de Documento: NF x ND (Print 5) */}
                    <div style={{ marginBottom: "14px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "6px" }}>
                        Tipo de Faturamento *
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, tipoDocumento: "NF", atividadeVinculadaId: undefined, atividadeVinculadaNome: undefined })}
                          style={{
                            padding: "9px 14px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            border: (form.tipoDocumento || "NF") === "NF" ? "2px solid var(--primary)" : "1px solid var(--border)",
                            backgroundColor: (form.tipoDocumento || "NF") === "NF" ? "rgba(15, 42, 74, 0.08)" : "var(--surface)",
                            color: (form.tipoDocumento || "NF") === "NF" ? "var(--primary)" : "var(--on-surface-variant)",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>description</span>
                          NF - Nota Fiscal de Serviço
                        </button>

                        <button
                          type="button"
                          onClick={() => setForm({ ...form, tipoDocumento: "ND" })}
                          style={{
                            padding: "9px 14px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            border: form.tipoDocumento === "ND" ? "2px solid var(--secondary, #00a896)" : "1px solid var(--border)",
                            backgroundColor: form.tipoDocumento === "ND" ? "rgba(0, 168, 150, 0.08)" : "var(--surface)",
                            color: form.tipoDocumento === "ND" ? "var(--secondary, #00a896)" : "var(--on-surface-variant)",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>receipt_long</span>
                          ND - Nota de Débito (Reembolso)
                        </button>
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>{form.tipoDocumento === "ND" ? "Nº Nota de Débito (ND NNÓS) *" : "Nº Nota Fiscal (NF NNÓS) *"}</label>
                        <input
                          type="text"
                          placeholder={form.tipoDocumento === "ND" ? "Ex: 0858, 0733.1, 0806.1" : "Ex: 736, 12, 45"}
                          value={form.numeroNota || ""}
                          onChange={(e) => setForm({ ...form, numeroNota: e.target.value })}
                          style={{ fontWeight: 700 }}
                        />
                      </div>

                      <div className="form-field">
                        <label>Valor Total Faturado (R$) *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          value={formatarMoedaBRInput(form.valor)}
                          onChange={(e) => setForm({ ...form, valor: parseMoedaBRInput(e.target.value) })}
                          style={{ fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    {/* Vínculo obrigatório com atividade caso seja ND (Print 5) */}
                    {form.tipoDocumento === "ND" && (
                      <div
                        style={{
                          marginBottom: "14px",
                          padding: "12px 14px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(0, 168, 150, 0.04)",
                          border: "1px solid rgba(0, 168, 150, 0.25)",
                        }}
                      >
                        <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--secondary, #00a896)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>link</span>
                          Vincular ND à Atividade do Projeto (Conciliação de Repasse) *
                        </label>
                        <select
                          value={form.atividadeVinculadaId || ""}
                          onChange={(e) => {
                            const ativId = e.target.value;
                            const ativ = atividadesProjeto.find((a) => a.id === ativId);
                            setForm({
                              ...form,
                              atividadeVinculadaId: ativId,
                              atividadeVinculadaNome: ativ ? `${ativ.atividade} (${ativ.consultores?.nome || "Sem Consultor"})` : "",
                            });
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid rgba(0, 168, 150, 0.4)",
                            fontSize: "12px",
                            fontWeight: 600,
                            backgroundColor: "#ffffff",
                          }}
                        >
                          {!form.projeto || !form.projeto.trim() ? (
                            <option value="">Selecione primeiro o Projeto acima para listar suas atividades...</option>
                          ) : atividadesProjeto.length === 0 ? (
                            <option value="">Nenhuma atividade encontrada para o projeto &quot;{form.projeto}&quot;</option>
                          ) : (
                            <>
                              <option value="">Selecione a atividade para vincular o repasse desta ND...</option>
                              {(() => {
                                const numMes = form.realizado ? MESES_NOMES.indexOf(form.realizado) + 1 : 0;
                                const compMes = numMes > 0 ? `2026-${String(numMes).padStart(2, "0")}` : "";
                                const ativsMes = atividadesProjeto.filter((a) => compMes && a.competencia && a.competencia.startsWith(compMes));
                                const ativsOutras = atividadesProjeto.filter((a) => !compMes || !a.competencia || !a.competencia.startsWith(compMes));

                                return (
                                  <>
                                    {ativsMes.length > 0 && (
                                      <optgroup label={`Atividades de ${form.realizado} (Recomendado)`}>
                                        {ativsMes.map((a) => {
                                          const periodo = formatarPeriodoAtividade(a.data_inicial, a.data_final);
                                          const repasseFormatado = a.repasse != null ? ` [Repasse: ${Number(a.repasse).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}]` : "";
                                          return (
                                            <option key={a.id} value={a.id}>
                                              {a.atividade} • {a.consultores?.nome || "Sem Consultor"} {periodo}{repasseFormatado}
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    )}
                                    {ativsOutras.length > 0 && (
                                      <optgroup label={ativsMes.length > 0 ? `Outros Períodos de ${form.projeto}` : `Atividades de ${form.projeto}`}>
                                        {ativsOutras.map((a) => {
                                          const periodo = formatarPeriodoAtividade(a.data_inicial, a.data_final);
                                          const repasseFormatado = a.repasse != null ? ` [Repasse: ${Number(a.repasse).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}]` : "";
                                          return (
                                            <option key={a.id} value={a.id}>
                                              {a.atividade} • {a.consultores?.nome || "Sem Consultor"} {periodo}{repasseFormatado}
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          )}
                        </select>

                        <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr", gap: "6px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)" }}>
                            Destino / Alocação da ND no Projeto:
                          </label>
                          <select
                            value={form.destinoNd || "consultor"}
                            onChange={(e) => setForm({ ...form, destinoNd: e.target.value as "consultor" | "agencia" | "ambos" })}
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: "1px solid var(--border)",
                              fontSize: "12px",
                              fontWeight: 600,
                              backgroundColor: "#ffffff",
                            }}
                          >
                            <option value="consultor">ND Consultor (Reembolso de Diárias / Alimentação / Km)</option>
                            <option value="agencia">ND Agência (Faturamento Passagens / Hospedagem)</option>
                            <option value="ambos">Ambos / Despesas Totais da Viagem</option>
                          </select>
                        </div>

                        <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block", marginTop: "6px" }}>
                          ℹ️ Ao salvar, o valor da Nota de Débito será conciliado e vinculado no campo correspondente (ND Consultor / ND Agência) e no Repasse da atividade.
                        </span>
                      </div>
                    )}

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Pedido de Compras (PO do Cliente)</label>
                        <input
                          type="text"
                          placeholder="Ex: 1008715596, 4504176258"
                          value={form.pedidoCompras || ""}
                          onChange={(e) => setForm({ ...form, pedidoCompras: e.target.value })}
                        />
                      </div>

                      <div className="form-field">
                        <label>Status *</label>
                        <select
                          value={form.status || "Aberto"}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                          style={{ fontWeight: 700 }}
                        >
                          <option value="Aberto">Aberto</option>
                          <option value="Pago">Pago</option>
                        </select>
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <label>Data de Vencimento</label>
                        <input
                          type="text"
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          value={form.vencimento || ""}
                          onChange={(e) => setForm({ ...form, vencimento: formatarDataInputBR(e.target.value) })}
                          onBlur={(e) => setForm({ ...form, vencimento: expandirAnoSeDoisDigitos(e.target.value) })}
                        />
                      </div>

                      <div className="form-field">
                        <label>Data de Pagamento / Crédito</label>
                        <input
                          type="text"
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          value={form.dataPagto || ""}
                          onChange={(e) => setForm({ ...form, dataPagto: formatarDataInputBR(e.target.value) })}
                          onBlur={(e) => setForm({ ...form, dataPagto: expandirAnoSeDoisDigitos(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-field">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <label>Centro de Custo (CC)</label>
                          <span style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 700, backgroundColor: "#f0f9ff", padding: "1px 6px", borderRadius: "4px" }}>
                            Automático
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder="Preenchido pelo projeto..."
                          value={form.centroCusto || ""}
                          readOnly={true}
                          disabled={true}
                          style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)", cursor: "not-allowed" }}
                        />
                      </div>

                      <div className="form-field">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <label>Área de Negócio</label>
                          <span style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 700, backgroundColor: "#f0f9ff", padding: "1px 6px", borderRadius: "4px" }}>
                            Automático
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder="Preenchido pelo projeto..."
                          value={form.area || ""}
                          readOnly={true}
                          disabled={true}
                          style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)", cursor: "not-allowed" }}
                        />
                      </div>
                    </div>
                  </div>

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
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>check_circle</span>
                      <span>{itemEdicao ? "Salvar Fatura" : "Cadastrar Fatura"}</span>
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
