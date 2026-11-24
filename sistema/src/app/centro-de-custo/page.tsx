"use client";

import Link from "next/link";
import React, { useState, useMemo, useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import ccBase from "@/lib/centros-de-custo.json";
import ModernDropdown from "@/components/ModernDropdown";
import { usePerfilAcesso } from "@/contexts/PerfilAcessoContext";
import { formatarPeriodoBR } from "@/lib/date-utils";
import { verificarStatusCoberturaLider } from "@/lib/lider-utils";

interface CentroCustoItem {
  centroDeCusto: string;
  projeto: string;
  contrato: string;
  area: string;
  liderProjeto: string;
  liderSubstituto?: string;
  coberturaInicio?: string;
  coberturaFim?: string;
  coberturaMotivo?: string;
}

interface EmpresaItem {
  codigo: string;
  nome: string;
}

interface UnidadeItem {
  codigo: string;
  nome: string;
}

interface ClienteItem {
  codigo: string;
  nome: string;
  cnpj?: string;
}

const OPCOES_CONTRATO_PADRAO = ["Avulso", "Comercial", "CRM", "DM", "N/A", "Stellantis"];

export default function CentroDeCustoPage() {
  const { perfilAtivoId, pertenceAoLiderAtivo, nivelModulo } = usePerfilAcesso();
  const isAdmin = perfilAtivoId === "ADMIN";
  const somenteVisualizar = nivelModulo("centro-de-custo") === "VISUALIZAR" || perfilAtivoId === "LIDER";
  const [busca, setBusca] = useState("");
  const [filtroArea, setFiltroArea] = useState("TODAS");
  const [filtroLider, setFiltroLider] = useState("TODOS");
  const [abaAtiva, setAbaAtiva] = useState<"lista" | "estrutura" | "simulador">("lista");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Lista dinâmica de contratos cadastrados
  const [opcoesContrato, setOpcoesContrato] = useState<string[]>(OPCOES_CONTRATO_PADRAO);
  const [modalNovoContratoAberto, setModalNovoContratoAberto] = useState(false);
  const [novoContratoTexto, setNovoContratoTexto] = useState("");
  const [origemContrato, setOrigemContrato] = useState<"criacao" | "edicao">("criacao");

  // Estados dos Dados
  const [centros, setCentros] = useState<CentroCustoItem[]>(ccBase.centrosDeCusto);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>(ccBase.empresas);
  const [unidades, setUnidades] = useState<UnidadeItem[]>(ccBase.unidadesNegocio);
  const [clientes, setClientes] = useState<ClienteItem[]>(ccBase.clientes);

  // Sincronização inicial com API e localStorage
  useEffect(() => {
    try {
      const savedContratos = localStorage.getItem("nnos_opcoes_contrato_v1");
      if (savedContratos) {
        const parsed = JSON.parse(savedContratos);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOpcoesContrato(parsed);
        }
      }
    } catch (e) {}

    try {
      const saved = localStorage.getItem("nnos_centros_custo_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.centrosDeCusto) setCentros(parsed.centrosDeCusto);
        if (parsed.empresas) setEmpresas(parsed.empresas);
        if (parsed.unidadesNegocio) setUnidades(parsed.unidadesNegocio);
        if (parsed.clientes) setClientes(parsed.clientes);
      }
    } catch (e) {}

    fetch("/api/centro-de-custo")
      .then((res) => res.json())
      .then((data) => {
        if (data.centrosDeCusto) setCentros(data.centrosDeCusto);
        if (data.empresas) setEmpresas(data.empresas);
        if (data.unidadesNegocio) setUnidades(data.unidadesNegocio);
        if (data.clientes) setClientes(data.clientes);
      })
      .catch((err) => console.error("Erro ao carregar /api/centro-de-custo:", err));
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Áreas e Líderes únicos para filtros
  const areasUnicas = useMemo(() => {
    const s = new Set<string>();
    centros.forEach((c) => {
      const a = (c.area || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (a && a !== "-" && a !== "—") s.add(a);
    });
    return Array.from(s).sort();
  }, [centros]);

  const lideresUnicos = useMemo(() => {
    const s = new Set<string>();
    centros.forEach((c) => {
      const l = (c.liderProjeto || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (l && l !== "-" && l !== "—") s.add(l);
    });
    return Array.from(s).sort();
  }, [centros]);

  // Filtragem da Lista
  const centrosFiltrados = useMemo(() => {
    return centros.filter((c) => {
      if (perfilAtivoId === "LIDER" && !pertenceAoLiderAtivo(c.projeto, c.centroDeCusto, c.liderProjeto)) return false;
      if (filtroArea !== "TODAS" && c.area !== filtroArea) return false;
      if (filtroLider !== "TODOS") {
        const ehTitular = c.liderProjeto === filtroLider;
        const ehSubstitutoVigente =
          c.liderSubstituto === filtroLider && verificarStatusCoberturaLider(c) === "VIGENTE";
        if (!ehTitular && !ehSubstitutoVigente) return false;
      }
      if (busca.trim()) {
        const t = busca.toLowerCase();
        const matchCC = (c.centroDeCusto || "").toLowerCase().includes(t);
        const matchProj = (c.projeto || "").toLowerCase().includes(t);
        const matchArea = (c.area || "").toLowerCase().includes(t);
        const matchLider = (c.liderProjeto || "").toLowerCase().includes(t);
        const matchSub = (c.liderSubstituto || "").toLowerCase().includes(t);
        const matchContrato = (c.contrato || "").toLowerCase().includes(t);
        return matchCC || matchProj || matchArea || matchLider || matchSub || matchContrato;
      }
      return true;
    });
  }, [centros, filtroArea, filtroLider, busca, perfilAtivoId, pertenceAoLiderAtivo]);

  // Cálculo da última referência global (Print 4: 078)
  const { ultimaRefGlobal, proximoSequencial } = useMemo(() => {
    const seqs = centros
      .map((c) => {
        const parts = (c.centroDeCusto || "").split(".");
        const n = parseInt(parts[3] || "0", 10);
        return isNaN(n) ? 0 : n;
      })
      .filter((n) => n > 0);

    const max = seqs.length > 0 ? Math.max(...seqs, 78) : 78;
    return {
      ultimaRefGlobal: String(max).padStart(3, "0"),
      proximoSequencial: String(max + 1).padStart(3, "0"),
    };
  }, [centros]);

  // Estados do Criador de Centro de Custo
  const [simEmpresa, setSimEmpresa] = useState("01");
  const [simUnidade, setSimUnidade] = useState("04");
  const [simCliente, setSimCliente] = useState("001");
  const [novoProjetoNome, setNovoProjetoNome] = useState("");
  const [novoContrato, setNovoContrato] = useState("Avulso");
  const [novoLider, setNovoLider] = useState("BEATRIZ PICORELLI");

  const codigoGerado = `${simEmpresa}.${simUnidade}.${simCliente}.${proximoSequencial}`;
  const empresaSelecionada = empresas.find((e) => e.codigo === simEmpresa)?.nome || "NNÓS";
  const unidadeSelecionada = unidades.find((u) => u.codigo === simUnidade)?.nome || "DEALER DEVELOPMENT";
  const clienteSelecionado = clientes.find((c) => c.codigo === simCliente)?.nome || "CLIENTE";

  // Ação: Criar Código e alimentar a base
  const handleCriarCodigoCentroCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoProjetoNome.trim()) {
      alert("Por favor, preencha o Nome do Projeto / Escopo para criar o Centro de Custo.");
      return;
    }

    const novoItem: CentroCustoItem = {
      centroDeCusto: codigoGerado,
      projeto: novoProjetoNome.trim().toUpperCase(),
      contrato: novoContrato.toUpperCase(),
      area: unidadeSelecionada.toUpperCase(),
      liderProjeto: novoLider.toUpperCase(),
    };

    const novaLista = [novoItem, ...centros.filter((c) => c.centroDeCusto !== codigoGerado)];
    setCentros(novaLista);

    try {
      localStorage.setItem("nnos_centros_custo_v2", JSON.stringify({
        centrosDeCusto: novaLista,
        empresas,
        unidadesNegocio: unidades,
        clientes,
      }));

      await fetch("/api/centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "criar-centro-custo", centro: novoItem }),
      });
    } catch (err) {
      console.error(err);
    }

    showToast(`Centro de Custo "${codigoGerado}" criado com sucesso!`);
    setNovoProjetoNome("");
    setNovoContrato("Avulso");
    setAbaAtiva("lista");
  };

  // Excluir Centro de Custo
  const handleExcluirCentroCusto = async (ccCodigo: string) => {
    if (!confirm(`Tem certeza que deseja excluir o Centro de Custo "${ccCodigo}"?`)) return;

    const novaLista = centros.filter((c) => c.centroDeCusto !== ccCodigo);
    setCentros(novaLista);

    try {
      localStorage.setItem("nnos_centros_custo_v2", JSON.stringify({
        centrosDeCusto: novaLista,
        empresas,
        unidadesNegocio: unidades,
        clientes,
      }));

      await fetch("/api/centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "excluir-centro-custo", centroDeCusto: ccCodigo }),
      });
    } catch (err) {
      console.error(err);
    }

    showToast(`Centro de Custo "${ccCodigo}" excluído.`);
  };

  // Modal de Edição de Centro de Custo
  const [modalEditCCAberto, setModalEditCCAberto] = useState(false);
  const [ccEmEdicao, setCcEmEdicao] = useState<CentroCustoItem | null>(null);
  const [editProjetoNome, setEditProjetoNome] = useState("");
  const [editContrato, setEditContrato] = useState("Avulso");
  const [editLider, setEditLider] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editLiderSubstituto, setEditLiderSubstituto] = useState("");
  const [editCoberturaInicio, setEditCoberturaInicio] = useState("");
  const [editCoberturaFim, setEditCoberturaFim] = useState("");
  const [editCoberturaMotivo, setEditCoberturaMotivo] = useState("Férias");

  // Modal de Cobertura de Férias / Ausência em Lote
  const [modalCoberturaLoteAberto, setModalCoberturaLoteAberto] = useState(false);
  const [loteLiderTitular, setLoteLiderTitular] = useState("CAROLINE AMIEVA");
  const [loteCodigosSelecionados, setLoteCodigosSelecionados] = useState<string[]>([]);
  const [loteLiderSubstituto, setLoteLiderSubstituto] = useState("");
  const [loteDataInicio, setLoteDataInicio] = useState("");
  const [loteDataFim, setLoteDataFim] = useState("");
  const [loteMotivo, setLoteMotivo] = useState("Férias");
  const [salvandoCoberturaLote, setSalvandoCoberturaLote] = useState(false);

  const projetosDoLiderTitularLote = useMemo(() => {
    return centros.filter(
      (c) => (c.liderProjeto || "").trim().toUpperCase() === loteLiderTitular.trim().toUpperCase()
    );
  }, [centros, loteLiderTitular]);

  const abrirModalCoberturaLote = () => {
    const titularInicial =
      filtroLider !== "TODOS"
        ? filtroLider
        : lideresUnicos.includes("CAROLINE AMIEVA")
        ? "CAROLINE AMIEVA"
        : lideresUnicos[0] || "BEATRIZ PICORELLI";
    setLoteLiderTitular(titularInicial);
    const projs = centros
      .filter((c) => (c.liderProjeto || "").trim().toUpperCase() === titularInicial.trim().toUpperCase())
      .map((c) => c.centroDeCusto);
    setLoteCodigosSelecionados(projs);
    const outroLider = lideresUnicos.find((l) => l !== titularInicial) || "";
    setLoteLiderSubstituto(outroLider);
    setLoteDataInicio("");
    setLoteDataFim("");
    setLoteMotivo("Férias");
    setModalCoberturaLoteAberto(true);
  };

  const handleTrocarLiderTitularLote = (novoTitular: string) => {
    setLoteLiderTitular(novoTitular);
    const projs = centros
      .filter((c) => (c.liderProjeto || "").trim().toUpperCase() === novoTitular.trim().toUpperCase())
      .map((c) => c.centroDeCusto);
    setLoteCodigosSelecionados(projs);
    if (loteLiderSubstituto === novoTitular) {
      const outro = lideresUnicos.find((l) => l !== novoTitular) || "";
      setLoteLiderSubstituto(outro);
    }
  };

  const toggleProjetoLote = (codigoCC: string) => {
    setLoteCodigosSelecionados((prev) =>
      prev.includes(codigoCC) ? prev.filter((c) => c !== codigoCC) : [...prev, codigoCC]
    );
  };

  const handleSalvarCoberturaLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loteCodigosSelecionados.length === 0) {
      alert("Selecione ao menos um projeto da carteira para aplicar a cobertura.");
      return;
    }
    const isRemover = loteLiderSubstituto === "__REMOVER__" || !loteLiderSubstituto.trim();
    if (!isRemover && loteDataInicio && loteDataFim && loteDataFim < loteDataInicio) {
      alert("A Data Final da cobertura não pode ser anterior à Data Inicial.");
      return;
    }

    setSalvandoCoberturaLote(true);
    const subFinal = isRemover ? "" : loteLiderSubstituto.trim().toUpperCase();
    const iniFinal = isRemover ? "" : loteDataInicio;
    const fimFinal = isRemover ? "" : loteDataFim;
    const motivoFinal = isRemover ? "" : loteMotivo;

    const codigosSet = new Set(loteCodigosSelecionados);
    const novaLista = centros.map((c) => {
      if (!codigosSet.has(c.centroDeCusto)) return c;
      return {
        ...c,
        liderSubstituto: subFinal,
        coberturaInicio: iniFinal,
        coberturaFim: fimFinal,
        coberturaMotivo: motivoFinal,
      };
    });

    setCentros(novaLista);
    try {
      localStorage.setItem(
        "nnos_centros_custo_v2",
        JSON.stringify({
          centrosDeCusto: novaLista,
          empresas,
          unidadesNegocio: unidades,
          clientes,
        })
      );

      await fetch("/api/centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "programar-cobertura-lote",
          codigosCC: loteCodigosSelecionados,
          liderSubstituto: subFinal,
          coberturaInicio: iniFinal,
          coberturaFim: fimFinal,
          coberturaMotivo: motivoFinal,
        }),
      });
      window.dispatchEvent(new CustomEvent("nnos-centros-custo-updated"));
    } catch (err) {
      console.error(err);
    } finally {
      setSalvandoCoberturaLote(false);
    }

    setModalCoberturaLoteAberto(false);
    showToast(
      isRemover
        ? `Cobertura encerrada em ${loteCodigosSelecionados.length} projeto(s) de ${loteLiderTitular}.`
        : `Cobertura atribuída a ${subFinal} para ${loteCodigosSelecionados.length} projeto(s) de ${loteLiderTitular}!`
    );
  };

  const abrirModalEditarCC = (item: CentroCustoItem) => {
    setCcEmEdicao(item);
    setEditProjetoNome(item.projeto);
    setEditContrato(opcoesContrato.find((op) => op.toUpperCase() === (item.contrato || "").toUpperCase()) || "Avulso");
    setEditLider(item.liderProjeto || "");
    setEditArea(item.area || "");
    setEditLiderSubstituto(item.liderSubstituto || "");
    setEditCoberturaInicio(item.coberturaInicio || "");
    setEditCoberturaFim(item.coberturaFim || "");
    setEditCoberturaMotivo(item.coberturaMotivo || "Férias");
    setModalEditCCAberto(true);
  };

  const handleSalvarNovoContrato = (e: React.FormEvent) => {
    e.preventDefault();
    const formatado = novoContratoTexto.trim().toUpperCase();
    if (!formatado) return;
    if (!opcoesContrato.some((c) => c.toUpperCase() === formatado)) {
      const novas = [...opcoesContrato, formatado].sort();
      setOpcoesContrato(novas);
      try {
        localStorage.setItem("nnos_opcoes_contrato_v1", JSON.stringify(novas));
      } catch {}
    }
    if (origemContrato === "criacao") {
      setNovoContrato(formatado);
    } else {
      setEditContrato(formatado);
    }
    setNovoContratoTexto("");
    setModalNovoContratoAberto(false);
    showToast(`Contrato "${formatado}" adicionado com sucesso!`);
  };

  const handleSalvarEdicaoCC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ccEmEdicao) return;

    if (editLiderSubstituto && editCoberturaInicio && editCoberturaFim && editCoberturaFim < editCoberturaInicio) {
      alert("A Data Final da cobertura não pode ser anterior à Data Inicial.");
      return;
    }

    const temSub = Boolean(editLiderSubstituto && editLiderSubstituto.trim());
    const atualizado: CentroCustoItem = {
      ...ccEmEdicao,
      projeto: editProjetoNome.trim().toUpperCase(),
      contrato: editContrato.toUpperCase(),
      liderProjeto: editLider.toUpperCase(),
      area: editArea.toUpperCase(),
      liderSubstituto: temSub ? editLiderSubstituto.trim().toUpperCase() : "",
      coberturaInicio: temSub ? editCoberturaInicio : "",
      coberturaFim: temSub ? editCoberturaFim : "",
      coberturaMotivo: temSub ? editCoberturaMotivo : "",
    };

    const novaLista = centros.map((c) => (c.centroDeCusto === atualizado.centroDeCusto ? atualizado : c));
    setCentros(novaLista);

    try {
      localStorage.setItem("nnos_centros_custo_v2", JSON.stringify({
        centrosDeCusto: novaLista,
        empresas,
        unidadesNegocio: unidades,
        clientes,
      }));

      await fetch("/api/centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "editar-centro-custo", centro: atualizado }),
      });
      window.dispatchEvent(new CustomEvent("nnos-centros-custo-updated"));
    } catch (err) {
      console.error(err);
    }

    showToast(`Centro de Custo "${atualizado.centroDeCusto}" atualizado.`);
    setModalEditCCAberto(false);
  };

  // Estados do Modal de Estrutura (Empresa, Unidade ou Cliente)
  const [modalEstruturaAberto, setModalEstruturaAberto] = useState(false);
  const [estruturaTipo, setEstruturaTipo] = useState<"empresa" | "unidade" | "cliente">("empresa");
  const [estruturaModo, setEstruturaModo] = useState<"criar" | "editar">("criar");
  const [estCodigo, setEstCodigo] = useState("");
  const [estNome, setEstNome] = useState("");
  const [estCnpj, setEstCnpj] = useState("");

  const abrirModalCriarEstrutura = (tipo: "empresa" | "unidade" | "cliente") => {
    setEstruturaTipo(tipo);
    setEstruturaModo("criar");
    if (tipo === "empresa") {
      const nextCode = String(empresas.length + 1).padStart(2, "0");
      setEstCodigo(nextCode);
    } else if (tipo === "unidade") {
      const nextCode = String(unidades.length).padStart(2, "0");
      setEstCodigo(nextCode);
    } else {
      const nextCode = String(clientes.length + 1).padStart(3, "0");
      setEstCodigo(nextCode);
    }
    setEstNome("");
    setEstCnpj("");
    setModalEstruturaAberto(true);
  };

  const abrirModalEditarEstrutura = (
    tipo: "empresa" | "unidade" | "cliente",
    item: { codigo: string; nome: string; cnpj?: string }
  ) => {
    setEstruturaTipo(tipo);
    setEstruturaModo("editar");
    setEstCodigo(item.codigo);
    setEstNome(item.nome);
    setEstCnpj(item.cnpj || "");
    setModalEstruturaAberto(true);
  };

  const handleSalvarEstrutura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estCodigo.trim() || !estNome.trim()) {
      alert("Por favor, preencha código e nome.");
      return;
    }

    if (estruturaTipo === "empresa") {
      const updated = [...empresas];
      const idx = updated.findIndex((e) => e.codigo === estCodigo);
      if (idx >= 0) {
        updated[idx] = { codigo: estCodigo, nome: estNome.trim() };
      } else {
        updated.push({ codigo: estCodigo, nome: estNome.trim() });
      }
      setEmpresas(updated);
      await fetch("/api/centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "salvar-empresa", empresa: { codigo: estCodigo, nome: estNome.trim() } }),
      });
      showToast(`Empresa "${estNome}" salva com sucesso!`);
    } else if (estruturaTipo === "unidade") {
      const updated = [...unidades];
      const idx = updated.findIndex((u) => u.codigo === estCodigo);
      if (idx >= 0) {
        updated[idx] = { codigo: estCodigo, nome: estNome.trim() };
      } else {
        updated.push({ codigo: estCodigo, nome: estNome.trim() });
      }
      setUnidades(updated);
      await fetch("/api/centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "salvar-unidade", unidade: { codigo: estCodigo, nome: estNome.trim() } }),
      });
      showToast(`Unidade "${estNome}" salva com sucesso!`);
    } else {
      const updated = [...clientes];
      const idx = updated.findIndex((c) => c.codigo === estCodigo);
      if (idx >= 0) {
        updated[idx] = { codigo: estCodigo, nome: estNome.trim(), cnpj: estCnpj.trim() || "Não se aplica" };
      } else {
        updated.push({ codigo: estCodigo, nome: estNome.trim(), cnpj: estCnpj.trim() || "Não se aplica" });
      }
      setClientes(updated);
      await fetch("/api/centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "salvar-cliente", cliente: { codigo: estCodigo, nome: estNome.trim(), cnpj: estCnpj.trim() } }),
      });
      showToast(`Cliente "${estNome}" salvo com sucesso!`);
    }

    setModalEstruturaAberto(false);
  };

  const handleExcluirEstrutura = async (tipo: "empresa" | "unidade" | "cliente", codigo: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${codigo} - ${nome}"?`)) return;

    if (tipo === "empresa") {
      const updated = empresas.filter((e) => e.codigo !== codigo);
      setEmpresas(updated);
      await fetch("/api/centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "excluir-empresa", codigo }),
      });
      showToast(`Empresa "${nome}" excluída.`);
    } else if (tipo === "unidade") {
      const updated = unidades.filter((u) => u.codigo !== codigo);
      setUnidades(updated);
      await fetch("/api/centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "excluir-unidade", codigo }),
      });
      showToast(`Unidade "${nome}" excluída.`);
    } else {
      const updated = clientes.filter((c) => c.codigo !== codigo);
      setClientes(updated);
      await fetch("/api/centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "excluir-cliente", codigo }),
      });
      showToast(`Cliente "${nome}" excluído.`);
    }
  };

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
            <Link href="/contratos" className="nav-item">
              <span className="material-symbols-outlined">history_edu</span>
              <span>Gestão de Contratos</span>
            </Link>
            <Link href="/centro-de-custo" className="nav-item active">
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
            <Link href="/lider" className="nav-item"><span className="material-symbols-outlined">supervisor_account</span><span>Líder de Projeto</span></Link>
            <Link href="/admin" className="nav-item"><span className="material-symbols-outlined">admin_panel_settings</span><span>Administrador</span></Link>
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
              Módulo de Centro de Custo
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
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
              Centro de Custo
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
          {/* Header Title & Nav Tabs */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-jakarta)", fontSize: "24px", fontWeight: 800, color: "var(--primary)", margin: "0 0 4px 0" }}>
                Estrutura de Centro de Custo
              </h1>
              <p style={{ fontSize: "13.5px", color: "var(--on-surface-variant)", margin: 0 }}>
                Hierarquia de alocação: Empresa • Unidade de Negócio • Cliente • Projeto
              </p>
            </div>

            {/* Segmented Control Tabs */}
            <div style={{ display: "flex", background: "var(--surface-container-low, #f8fafc)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", gap: "4px" }}>
              <button
                type="button"
                onClick={() => setAbaAtiva("lista")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: abaAtiva === "lista" ? "#0f2a4a" : "transparent",
                  color: abaAtiva === "lista" ? "#ffffff" : "var(--on-surface-variant)",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>view_list</span>
                <span>Centros de Custo ({centrosFiltrados.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva("estrutura")} hidden={somenteVisualizar}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: abaAtiva === "estrutura" ? "#0f2a4a" : "transparent",
                  color: abaAtiva === "estrutura" ? "#ffffff" : "var(--on-surface-variant)",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>schema</span>
                <span>Tabelas de Estrutura</span>
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva("simulador")} hidden={somenteVisualizar}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: abaAtiva === "simulador" ? "#0f2a4a" : "transparent",
                  color: abaAtiva === "simulador" ? "#ffffff" : "var(--on-surface-variant)",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add_circle</span>
                <span>Criar Centro de Custo</span>
              </button>
            </div>
          </div>

          {/* KPI Cards Bento */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Total Centros de Custo</div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#0f2a4a", marginTop: "4px" }}>{centrosFiltrados.length}</div>
              <div style={{ fontSize: "11.5px", color: "var(--on-surface-variant)", marginTop: "2px" }}>Contratos & Alocações ativas</div>
            </div>
            <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Unidades de Negócio</div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#0284c7", marginTop: "4px" }}>{perfilAtivoId === "LIDER" ? new Set(centrosFiltrados.map((c) => c.area).filter(Boolean)).size : unidades.length}</div>
              <div style={{ fontSize: "11.5px", color: "var(--on-surface-variant)", marginTop: "2px" }}>Diretoria, TI, Dealer Dev, HRD, etc.</div>
            </div>
            <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Clientes & CNPJs Mapeados</div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#16a34a", marginTop: "4px" }}>{perfilAtivoId === "LIDER" ? new Set(centrosFiltrados.map((c) => (c.centroDeCusto || "").split(".")[2]).filter(Boolean)).size : clientes.length}</div>
              <div style={{ fontSize: "11.5px", color: "var(--on-surface-variant)", marginTop: "2px" }}>IVECO, CNH, Stellantis, Porsche, etc.</div>
            </div>
            <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Líderes de Projeto Ativos</div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#7c3aed", marginTop: "4px" }}>{perfilAtivoId === "LIDER" ? new Set(centrosFiltrados.map((c) => c.liderProjeto).filter(Boolean)).size : lideresUnicos.length}</div>
              <div style={{ fontSize: "11.5px", color: "var(--on-surface-variant)", marginTop: "2px" }}>Beatriz, Jefferson, Caroline, etc.</div>
            </div>
          </div>

          {/* ABA 1: LISTAGEM DE CENTROS DE CUSTO */}
          {abaAtiva === "lista" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "1240px" }}>
              {/* Barra de Filtros com Dropdowns Padrão 2 (Pílulas com Ícones) */}
              <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface-container-low, #f8fafc)", padding: "8px 14px", borderRadius: "8px", width: "100%", border: "1px solid var(--border)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--outline)" }}>search</span>
                    <input
                      type="text"
                      placeholder="Buscar por Centro de Custo, Projeto, Área ou Líder..."
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
                </div>

                {/* Dropdowns no Padrão ModernDropdown */}
                <div className="filter-selects-group">
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

                  <ModernDropdown
                    value={filtroLider}
                    onChange={(val) => setFiltroLider(String(val))}
                    options={[
                      { value: "TODOS", label: `Todos os Líderes (${lideresUnicos.length})` },
                      ...lideresUnicos.map((l) => ({ value: l, label: l })),
                    ]}
                    icon="person"
                    minWidth="195px"
                  />
                </div>
              </div>

              {/* Tabela de Centros de Custo com Botões Editar e Excluir */}
              <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                <div style={{ padding: "12px 20px", backgroundColor: "#0f2a4a", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: 700, flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#38bdf8" }}>account_tree</span>
                    <span>MATRIZ OFICIAL DE CENTROS DE CUSTO</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={abrirModalCoberturaLote}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "5px 12px",
                          borderRadius: "6px",
                          backgroundColor: "#0284c7",
                          color: "#ffffff",
                          border: "1px solid rgba(255,255,255,0.25)",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                        title="Delegar projetos de um líder para outro durante férias ou ausência temporária (Exclusivo Administrador)"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                          beach_access
                        </span>
                        <span>Programar Cobertura / Férias</span>
                      </button>
                    )}
                    <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: "4px" }}>
                      {centrosFiltrados.length} Registros Exibidos
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", textTransform: "uppercase", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.04em" }}>
                        <th style={{ padding: "12px 18px", width: "150px", whiteSpace: "nowrap" }}>Centro de Custo</th>
                        <th style={{ padding: "12px 16px", minWidth: "300px", whiteSpace: "nowrap" }}>Projeto / Escopo</th>
                        <th style={{ padding: "12px 16px", width: "120px", whiteSpace: "nowrap" }}>Contrato</th>
                        <th style={{ padding: "12px 16px", width: "290px", whiteSpace: "nowrap" }}>Área de Negócio</th>
                        <th style={{ padding: "12px 16px", width: "200px", whiteSpace: "nowrap" }}>Líder de Projeto</th>
                        {!somenteVisualizar && <th style={{ padding: "12px 16px", width: "80px", textAlign: "center", whiteSpace: "nowrap" }}>Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {centrosFiltrados.map((c) => (
                        <tr
                          key={c.centroDeCusto}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <td style={{ padding: "12px 18px", fontWeight: 800, color: "#0f2a4a", whiteSpace: "nowrap" }}>
                            <span style={{ padding: "3px 8px", borderRadius: "6px", backgroundColor: "#f1f5f9", border: "1px solid #e2e8f0", display: "inline-block" }}>
                              {c.centroDeCusto}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>
                            {c.projeto}
                          </td>
                          <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                            {c.contrato && (c.contrato.toUpperCase().includes("CNH") || c.contrato.toUpperCase().includes("DM") || c.contrato.toUpperCase().includes("COMERCIAL") || c.contrato.toUpperCase().includes("CRM")) ? (
                              <a
                                href="/tabela-precos"
                                title="Ver Tabela de Preços deste Contrato"
                                style={{
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "3px 9px",
                                  borderRadius: "6px",
                                  backgroundColor: "rgba(0, 131, 202, 0.1)",
                                  color: "#0083ca",
                                  fontWeight: 800,
                                  fontSize: "11px",
                                  border: "1px solid rgba(0, 131, 202, 0.25)",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>request_quote</span>
                                <span>{c.contrato}</span>
                              </a>
                            ) : (
                              <span style={{ color: "#64748b", fontWeight: 600 }}>{c.contrato || "N/A"}</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#334155", whiteSpace: "nowrap" }}>
                            <span style={{
                              padding: "3px 9px",
                              borderRadius: "4px",
                              backgroundColor: "#e0f2fe",
                              color: "#0369a1",
                              fontSize: "11px",
                              fontWeight: 700,
                              display: "inline-block",
                              whiteSpace: "nowrap"
                            }}>
                              {c.area}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                              {c.liderProjeto ? (
                                <span style={{
                                  padding: "3px 10px",
                                  borderRadius: "6px",
                                  backgroundColor: "#fef3c7",
                                  color: "#92400e",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  whiteSpace: "nowrap"
                                }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>shield_person</span>
                                  {c.liderProjeto}
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "11px", whiteSpace: "nowrap" }}>Diretoria Geral</span>
                              )}

                              {(() => {
                                const stCob = verificarStatusCoberturaLider(c);
                                if (stCob !== "VIGENTE" && stCob !== "AGENDADA") return null;
                                const isVigente = stCob === "VIGENTE";
                                const periodoTxt =
                                  c.coberturaInicio || c.coberturaFim
                                    ? ` · ${formatarPeriodoBR(c.coberturaInicio, c.coberturaFim)}`
                                    : "";
                                return (
                                  <span
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      backgroundColor: isVigente ? "#dcfce7" : "#e0f2fe",
                                      color: isVigente ? "#15803d" : "#0369a1",
                                      border: isVigente ? "1px solid #bbf7d0" : "1px solid #bae6fd",
                                      fontSize: "10.5px",
                                      fontWeight: 700,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      whiteSpace: "nowrap",
                                    }}
                                    title={`${c.coberturaMotivo || "Cobertura"} (${isVigente ? "Ativa" : "Agendada"})`}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                                      {isVigente ? "swap_horiz" : "event_upcoming"}
                                    </span>
                                    <span>
                                      {isVigente ? "Cobertura" : "Agendada"}: {c.liderSubstituto}
                                      {periodoTxt}
                                    </span>
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                          {/* Coluna de Ações: Editar e Excluir */}
                          <td style={{ padding: "12px 16px", textAlign: "center", whiteSpace: "nowrap", display: somenteVisualizar ? "none" : "table-cell" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => abrirModalEditarCC(c)}
                                title="Editar Centro de Custo"
                                style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", color: "var(--primary)" }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExcluirCentroCusto(c.centroDeCusto)}
                                title="Excluir Centro de Custo"
                                style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", color: "#dc2626" }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: TABELAS DE ESTRUTURA (COM BOTÕES EDITAR E EXCLUIR NAS 3 TABELAS) */}
          {abaAtiva === "estrutura" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
              {/* Tabela 1: Empresas */}
              <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                <div style={{ padding: "12px 16px", backgroundColor: "#0c3b5d", color: "#ffffff", fontWeight: 700, fontSize: "12.5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>1. EMPRESA</span>
                  <button
                    type="button"
                    onClick={() => abrirModalCriarEstrutura("empresa")}
                    style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#ffffff", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                    Nova Empresa
                  </button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px" }}>
                      <th style={{ padding: "8px 14px", width: "70px" }}>Código</th>
                      <th style={{ padding: "8px 14px" }}>Razão / Entidade</th>
                      <th style={{ padding: "8px 14px", width: "80px", textAlign: "center" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresas.map((e) => (
                      <tr key={e.codigo} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 800, color: "#0f2a4a" }}>{e.codigo}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>{e.nome}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => abrirModalEditarEstrutura("empresa", e)}
                              title="Modificar Empresa"
                              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary)" }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirEstrutura("empresa", e.codigo, e.nome)}
                              title="Excluir Empresa"
                              style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tabela 2: Unidades de Negócio */}
              <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                <div style={{ padding: "12px 16px", backgroundColor: "#0065a0", color: "#ffffff", fontWeight: 700, fontSize: "12.5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>2. UNIDADE DE NEGÓCIO</span>
                  <button
                    type="button"
                    onClick={() => abrirModalCriarEstrutura("unidade")}
                    style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#ffffff", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                    Nova Unidade
                  </button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px" }}>
                      <th style={{ padding: "8px 14px", width: "70px" }}>Código</th>
                      <th style={{ padding: "8px 14px" }}>Área de Especialidade</th>
                      <th style={{ padding: "8px 14px", width: "80px", textAlign: "center" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unidades.map((u) => (
                      <tr key={u.codigo} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 14px", fontWeight: 800, color: "#0065a0" }}>{u.codigo}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 600 }}>{u.nome}</td>
                        <td style={{ padding: "8px 14px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => abrirModalEditarEstrutura("unidade", u)}
                              title="Modificar Unidade"
                              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary)" }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirEstrutura("unidade", u.codigo, u.nome)}
                              title="Excluir Unidade"
                              style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tabela 3: Clientes & CNPJs */}
              <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", gridColumn: "span 2" }}>
                <div style={{ padding: "12px 16px", backgroundColor: "#4bacc6", color: "#ffffff", fontWeight: 700, fontSize: "12.5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>3. CLIENTE & CNPJ CADASTRADO</span>
                  <button
                    type="button"
                    onClick={() => abrirModalCriarEstrutura("cliente")}
                    style={{ background: "rgba(255,255,255,0.22)", border: "none", color: "#ffffff", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                    Novo Cliente
                  </button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px" }}>
                      <th style={{ padding: "8px 14px", width: "70px" }}>Código</th>
                      <th style={{ padding: "8px 14px" }}>Nome do Cliente</th>
                      <th style={{ padding: "8px 14px" }}>CNPJ Oficial</th>
                      <th style={{ padding: "8px 14px", width: "80px", textAlign: "center" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c) => (
                      <tr key={c.codigo} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 14px", fontWeight: 800, color: "#0e7490" }}>{c.codigo}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 700 }}>{c.nome}</td>
                        <td style={{ padding: "8px 14px", color: "#64748b", fontWeight: 600 }}>{c.cnpj || "Não se aplica"}</td>
                        <td style={{ padding: "8px 14px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => abrirModalEditarEstrutura("cliente", c)}
                              title="Modificar Cliente"
                              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary)" }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirEstrutura("cliente", c.codigo, c.nome)}
                              title="Excluir Cliente"
                              style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 3: CRIAR CENTRO DE CUSTO (TRAVADO EM 078/079, DROPDOWN CONTRATO) */}
          {abaAtiva === "simulador" && (
            <div style={{ background: "#ffffff", padding: "28px", borderRadius: "14px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", maxWidth: "900px" }}>
              <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "19px", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                  [EMPRESA] . [UNIDADE DE NEGÓCIO] . [CLIENTE] . [PROJETO]
                </h2>
                <p style={{ fontSize: "13px", color: "var(--on-surface-variant)", marginTop: "4px" }}>
                  Selecione os blocos abaixo para gerar e registrar automaticamente o novo Centro de Custo na base oficial.
                </p>
              </div>

              <form onSubmit={handleCriarCodigoCentroCusto}>
                {/* 4 Blocos da Regra de Negócio */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "18px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#0c3b5d" }}>
                      1. Empresa
                    </label>
                    <select
                      value={simEmpresa}
                      onChange={(e) => setSimEmpresa(e.target.value)}
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, backgroundColor: "#ffffff" }}
                    >
                      {empresas.map((e) => (
                        <option key={e.codigo} value={e.codigo}>{e.codigo} - {e.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#0065a0" }}>
                      2. Unidade de Negócio
                    </label>
                    <select
                      value={simUnidade}
                      onChange={(e) => setSimUnidade(e.target.value)}
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, backgroundColor: "#ffffff" }}
                    >
                      {unidades.map((u) => (
                        <option key={u.codigo} value={u.codigo}>{u.codigo} - {u.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#0e7490" }}>
                      3. Cliente
                    </label>
                    <select
                      value={simCliente}
                      onChange={(e) => setSimCliente(e.target.value)}
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, backgroundColor: "#ffffff" }}
                    >
                      {clientes.map((c) => (
                        <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Sequencial: Não permitir edição e última ref 078 */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#0369a1" }}>
                        4. Sequencial do Projeto (3 dígitos)
                      </label>
                      <span style={{ fontSize: "10.5px", color: "#0284c7", fontWeight: 700, backgroundColor: "#f0f9ff", padding: "1px 8px", borderRadius: "4px" }}>
                        Última Ref: {ultimaRefGlobal}
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={3}
                      value={proximoSequencial}
                      readOnly={true}
                      disabled={true}
                      title="Campo gerado automaticamente a partir da última referência criada"
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 800, backgroundColor: "#f8fafc", color: "#475569", cursor: "not-allowed" }}
                    />
                  </div>
                </div>

                {/* Campos Obrigatórios do Novo Projeto para alimentar a base */}
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", marginBottom: "12px" }}>
                    Dados do Projeto para Registro Oficial
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "14px", marginBottom: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Nome do Projeto / Escopo *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: CONSULTORIA DE VENDAS E PROCESSOS"
                        value={novoProjetoNome}
                        onChange={(e) => setNovoProjetoNome(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600 }}
                      />
                    </div>
                    {/* Contrato: com opção para adicionar novos contratos */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <label style={{ fontSize: "12px", fontWeight: 700 }}>
                          Contrato
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setOrigemContrato("criacao");
                            setNovoContratoTexto("");
                            setModalNovoContratoAberto(true);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#0284c7",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "2px",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add_circle</span>
                          + Novo Contrato
                        </button>
                      </div>
                      <select
                        value={novoContrato}
                        onChange={(e) => {
                          if (e.target.value === "__NOVO__") {
                            setOrigemContrato("criacao");
                            setNovoContratoTexto("");
                            setModalNovoContratoAberto(true);
                          } else {
                            setNovoContrato(e.target.value);
                          }
                        }}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, backgroundColor: "#ffffff" }}
                      >
                        {opcoesContrato.map((op) => (
                          <option key={op} value={op}>{op}</option>
                        ))}
                        <option value="__NOVO__" style={{ fontWeight: 700, color: "#0284c7" }}>+ Adicionar novo contrato...</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Líder de Projeto Responsável
                      </label>
                      <select
                        value={novoLider}
                        onChange={(e) => setNovoLider(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, backgroundColor: "#ffffff" }}
                      >
                        {lideresUnicos.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Área de Negócio (Automática)
                      </label>
                      <input
                        type="text"
                        value={unidadeSelecionada}
                        disabled={true}
                        readOnly={true}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, backgroundColor: "#ffffff", color: "#64748b", cursor: "not-allowed" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Resultado Gerado em Destaque & Botão Criar Código */}
                <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "#0f2a4a", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                  <div>
                    <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "#93c5fd" }}>
                      Código de Centro de Custo a ser Criado
                    </span>
                    <div style={{ fontSize: "28px", fontWeight: 900, color: "#ffffff", letterSpacing: "1px", marginTop: "4px" }}>
                      {codigoGerado}
                    </div>
                    <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>
                      {empresaSelecionada} • {unidadeSelecionada} • {clienteSelecionado}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    style={{
                      backgroundColor: "#0284c7",
                      color: "#ffffff",
                      border: "none",
                      padding: "12px 24px",
                      borderRadius: "8px",
                      fontSize: "13.5px",
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(2,132,199,0.35)",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_task</span>
                    <span>Criar Código</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* MODAL PARA EDITAR CENTRO DE CUSTO */}
      {modalEditCCAberto && ccEmEdicao && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "520px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)", overflow: "visible" }}>
            <div style={{ padding: "16px 20px", backgroundColor: "#0f2a4a", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", borderTopLeftRadius: "14px", borderTopRightRadius: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#38bdf8" }}>account_tree</span>
                <h3 style={{ fontSize: "15px", fontWeight: 800, margin: 0 }}>
                  Editar Centro de Custo: {ccEmEdicao.centroDeCusto}
                </h3>
              </div>
              <button type="button" onClick={() => setModalEditCCAberto(false)} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoCC} style={{ padding: "20px 24px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Projeto / Escopo *
                </label>
                <input
                  type="text"
                  value={editProjetoNome}
                  onChange={(e) => setEditProjetoNome(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600 }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>
                    Contrato
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setOrigemContrato("edicao");
                      setNovoContratoTexto("");
                      setModalNovoContratoAberto(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#0284c7",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add_circle</span>
                    + Novo Contrato
                  </button>
                </div>
                <select
                  value={editContrato}
                  onChange={(e) => {
                    if (e.target.value === "__NOVO__") {
                      setOrigemContrato("edicao");
                      setNovoContratoTexto("");
                      setModalNovoContratoAberto(true);
                    } else {
                      setEditContrato(e.target.value);
                    }
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, backgroundColor: "#ffffff" }}
                >
                  {opcoesContrato.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                  <option value="__NOVO__" style={{ fontWeight: 700, color: "#0284c7" }}>+ Adicionar novo contrato...</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <ModernDropdown
                    label="ÁREA DE NEGÓCIO"
                    value={editArea}
                    onChange={(val) => setEditArea(String(val))}
                    options={unidades.map((u) => ({ value: u.nome, label: u.nome }))}
                    icon="apartment"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <ModernDropdown
                    label="LÍDER DE PROJETO (TITULAR)"
                    value={editLider}
                    onChange={(val) => setEditLider(String(val))}
                    options={lideresUnicos.map((l) => ({ value: l, label: l }))}
                    icon="shield_person"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {/* Bloco de Cobertura Temporária / Férias (Exclusivo Administrador) */}
              {isAdmin && (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "14px",
                    marginBottom: "18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "17px", color: "#0284c7" }}>
                        beach_access
                      </span>
                      <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#0f2a4a", textTransform: "uppercase" }}>
                        Cobertura Temporária / Férias (Líder Substituto)
                      </span>
                    </div>
                    {editLiderSubstituto && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditLiderSubstituto("");
                          setEditCoberturaInicio("");
                          setEditCoberturaFim("");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Limpar cobertura
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: editLiderSubstituto ? "1.3fr 1fr" : "1fr", gap: "10px", alignItems: "end" }}>
                    <ModernDropdown
                      label="LÍDER SUBSTITUTO (QUEM VAI COBRIR)"
                      value={editLiderSubstituto}
                      onChange={(val) => setEditLiderSubstituto(String(val))}
                      options={[
                        { value: "", label: "Sem cobertura ativa (Apenas Líder Titular)" },
                        ...lideresUnicos
                          .filter((l) => l !== editLider)
                          .map((l) => ({ value: l, label: l })),
                      ]}
                      icon="swap_horiz"
                      style={{ width: "100%" }}
                      dropdownStyle={{ bottom: "calc(100% + 6px)", top: "auto", maxHeight: "230px" }}
                    />

                    {editLiderSubstituto && (
                      <ModernDropdown
                        label="MOTIVO DA COBERTURA"
                        value={editCoberturaMotivo}
                        onChange={(val) => setEditCoberturaMotivo(String(val))}
                        options={[
                          { value: "Férias", label: "Férias" },
                          { value: "Ausência Temporária", label: "Ausência Temporária / Licença" },
                          { value: "Apoio Operacional", label: "Apoio Operacional" },
                        ]}
                        icon="event_note"
                        style={{ width: "100%" }}
                        dropdownStyle={{ bottom: "calc(100% + 6px)", top: "auto", maxHeight: "220px" }}
                      />
                    )}
                  </div>

                  {editLiderSubstituto && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", alignItems: "end" }}>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "11px",
                            fontWeight: 700,
                            marginBottom: "4px",
                            color: "#475569",
                            whiteSpace: "nowrap",
                          }}
                        >
                          INÍCIO DA COBERTURA
                        </label>
                        <input
                          type="date"
                          value={editCoberturaInicio}
                          onChange={(e) => setEditCoberturaInicio(e.target.value)}
                          style={{
                            width: "100%",
                            height: "36px",
                            padding: "7px 10px",
                            borderRadius: "10px",
                            border: "1px solid var(--border, #cbd5e1)",
                            fontFamily: "var(--font-inter), Inter, sans-serif",
                            fontSize: "12.5px",
                            fontWeight: 600,
                            color: "var(--on-surface, #1e293b)",
                            backgroundColor: "#ffffff",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "11px",
                            fontWeight: 700,
                            marginBottom: "4px",
                            color: "#475569",
                            whiteSpace: "nowrap",
                          }}
                          title="Após esta data, a cobertura é encerrada automaticamente"
                        >
                          FIM DA COBERTURA
                        </label>
                        <input
                          type="date"
                          value={editCoberturaFim}
                          onChange={(e) => setEditCoberturaFim(e.target.value)}
                          style={{
                            width: "100%",
                            height: "36px",
                            padding: "7px 10px",
                            borderRadius: "10px",
                            border: "1px solid var(--border, #cbd5e1)",
                            fontFamily: "var(--font-inter), Inter, sans-serif",
                            fontSize: "12.5px",
                            fontWeight: 600,
                            color: "var(--on-surface, #1e293b)",
                            backgroundColor: "#ffffff",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => setModalEditCCAberto(false)}
                  style={{ padding: "9px 18px", borderRadius: "8px", border: "1px solid var(--border)", background: "#ffffff", color: "var(--on-surface-variant)", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "9px 22px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA CRIAR / MODIFICAR ESTRUTURA (EMPRESA, UNIDADE OU CLIENTE) */}
      {modalEstruturaAberto && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "480px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", backgroundColor: "#0f2a4a", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#38bdf8" }}>schema</span>
                <h3 style={{ fontSize: "15px", fontWeight: 800, margin: 0 }}>
                  {estruturaModo === "criar" ? "Adicionar" : "Modificar"}{" "}
                  {estruturaTipo === "empresa" ? "Empresa" : estruturaTipo === "unidade" ? "Unidade de Negócio" : "Cliente"}
                </h3>
              </div>
              <button type="button" onClick={() => setModalEstruturaAberto(false)} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSalvarEstrutura} style={{ padding: "20px 24px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Código Oficial *
                </label>
                <input
                  type="text"
                  value={estCodigo}
                  disabled={estruturaModo === "editar"}
                  onChange={(e) => setEstCodigo(e.target.value)}
                  placeholder="Ex: 01, 001"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 700, backgroundColor: estruturaModo === "editar" ? "#f8fafc" : "#ffffff" }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  {estruturaTipo === "empresa" ? "Razão / Entidade *" : estruturaTipo === "unidade" ? "Área de Especialidade *" : "Nome do Cliente *"}
                </label>
                <input
                  type="text"
                  value={estNome}
                  onChange={(e) => setEstNome(e.target.value)}
                  placeholder="Ex: NNÓS, DIRETORIA, IVECO CNH..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600 }}
                />
              </div>

              {estruturaTipo === "cliente" && (
                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    CNPJ Oficial (Opcional)
                  </label>
                  <input
                    type="text"
                    value={estCnpj}
                    onChange={(e) => setEstCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => setModalEstruturaAberto(false)}
                  style={{ padding: "9px 18px", borderRadius: "8px", border: "1px solid var(--border)", background: "#ffffff", color: "var(--on-surface-variant)", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "9px 22px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL PARA ADICIONAR NOVO CONTRATO */}
      {modalNovoContratoAberto && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "420px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", backgroundColor: "#0f2a4a", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#38bdf8" }}>contract</span>
                <h3 style={{ fontSize: "14px", fontWeight: 800, margin: 0 }}>Novo Contrato</h3>
              </div>
              <button type="button" onClick={() => setModalNovoContratoAberto(false)} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSalvarNovoContrato} style={{ padding: "18px 20px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Nome / Identificação do Contrato *
                </label>
                <input
                  type="text"
                  placeholder="Ex: GLOBAL, FORNECEDOR, VAREJO..."
                  value={novoContratoTexto}
                  onChange={(e) => setNovoContratoTexto(e.target.value)}
                  autoFocus
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, textTransform: "uppercase" }}
                />
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                  O novo contrato ficará disponível para seleção imediata e futuros projetos.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => setModalNovoContratoAberto(false)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "#ffffff", color: "var(--on-surface-variant)", cursor: "pointer", fontSize: "12.5px", fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "8px 18px", borderRadius: "8px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", backgroundColor: "#0284c7" }}
                >
                  Salvar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA PROGRAMAR COBERTURA / FÉRIAS EM LOTE (EXCLUSIVO ADMINISTRADOR) */}
      {isAdmin && modalCoberturaLoteAberto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            zIndex: 10001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => !salvandoCoberturaLote && setModalCoberturaLoteAberto(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "680px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              overflow: "visible",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 22px",
                backgroundColor: "#0f2a4a",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTopLeftRadius: "14px",
                borderTopRightRadius: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "22px", color: "#38bdf8" }}>
                  beach_access
                </span>
                <div>
                  <h3 style={{ fontSize: "15.5px", fontWeight: 800, margin: 0 }}>
                    Programar Cobertura de Férias / Ausência Temporária
                  </h3>
                  <span style={{ fontSize: "11.5px", color: "#cbd5e1" }}>
                    Atribua um ou mais projetos a outro líder mantendo o Líder Titular original
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCoberturaLoteAberto(false)}
                style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSalvarCoberturaLote} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* 1. Seleção do Líder Ausente e do Líder Substituto */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <ModernDropdown
                  label="1. LÍDER TITULAR (EM FÉRIAS / AUSENTE)"
                  value={loteLiderTitular}
                  onChange={(val) => handleTrocarLiderTitularLote(String(val))}
                  options={lideresUnicos.map((l) => ({ value: l, label: l }))}
                  icon="person"
                  style={{ width: "100%" }}
                />

                <ModernDropdown
                  label="2. LÍDER SUBSTITUTO (QUEM VAI COBRIR)"
                  value={loteLiderSubstituto}
                  onChange={(val) => setLoteLiderSubstituto(String(val))}
                  options={[
                    ...lideresUnicos
                      .filter((l) => l !== loteLiderTitular)
                      .map((l) => ({ value: l, label: `Cobrir com: ${l}` })),
                    { value: "__REMOVER__", label: "❌ Encerrar / Remover Cobertura" },
                  ]}
                  icon="swap_horiz"
                  style={{ width: "100%" }}
                />
              </div>

              {/* 2. Período de Vigência e Motivo */}
              {loteLiderSubstituto !== "__REMOVER__" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px",
                    alignItems: "end",
                    backgroundColor: "#f8fafc",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 700,
                        marginBottom: "4px",
                        color: "#475569",
                        whiteSpace: "nowrap",
                      }}
                    >
                      INÍCIO DA COBERTURA
                    </label>
                    <input
                      type="date"
                      value={loteDataInicio}
                      onChange={(e) => setLoteDataInicio(e.target.value)}
                      style={{
                        width: "100%",
                        height: "36px",
                        padding: "7px 10px",
                        borderRadius: "10px",
                        border: "1px solid var(--border, #cbd5e1)",
                        fontFamily: "var(--font-inter), Inter, sans-serif",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        color: "var(--on-surface, #1e293b)",
                        backgroundColor: "#ffffff",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 700,
                        marginBottom: "4px",
                        color: "#475569",
                        whiteSpace: "nowrap",
                      }}
                    >
                      FIM DA COBERTURA
                    </label>
                    <input
                      type="date"
                      value={loteDataFim}
                      onChange={(e) => setLoteDataFim(e.target.value)}
                      style={{
                        width: "100%",
                        height: "36px",
                        padding: "7px 10px",
                        borderRadius: "10px",
                        border: "1px solid var(--border, #cbd5e1)",
                        fontFamily: "var(--font-inter), Inter, sans-serif",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        color: "var(--on-surface, #1e293b)",
                        backgroundColor: "#ffffff",
                      }}
                    />
                  </div>
                  <ModernDropdown
                    label="MOTIVO"
                    value={loteMotivo}
                    onChange={(val) => setLoteMotivo(String(val))}
                    options={[
                      { value: "Férias", label: "Férias" },
                      { value: "Ausência Temporária", label: "Ausência Temporária" },
                      { value: "Apoio Operacional", label: "Apoio Operacional" },
                    ]}
                    icon="event_note"
                    style={{ width: "100%" }}
                  />
                </div>
              )}

              {/* 3. Lista de Projetos da Carteira do Líder Titular com Checkboxes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#0f2a4a", textTransform: "uppercase" }}>
                    3. Selecione quais projetos de {loteLiderTitular} deseja delegar ({loteCodigosSelecionados.length} de {projetosDoLiderTitularLote.length})
                  </span>
                  <div style={{ display: "inline-flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setLoteCodigosSelecionados(projetosDoLiderTitularLote.map((p) => p.centroDeCusto))}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0284c7",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Marcar Todos
                    </button>
                    <span style={{ color: "#cbd5e1" }}>|</span>
                    <button
                      type="button"
                      onClick={() => setLoteCodigosSelecionados([])}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: "230px",
                    overflowY: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    divideY: "1px solid #f1f5f9",
                  } as React.CSSProperties}
                >
                  {projetosDoLiderTitularLote.length === 0 ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "#64748b", fontSize: "12.5px" }}>
                      Nenhum projeto encontrado na carteira de {loteLiderTitular}.
                    </div>
                  ) : (
                    projetosDoLiderTitularLote.map((proj) => {
                      const marcado = loteCodigosSelecionados.includes(proj.centroDeCusto);
                      const stCob = verificarStatusCoberturaLider(proj);
                      return (
                        <label
                          key={proj.centroDeCusto}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderBottom: "1px solid #f1f5f9",
                            cursor: "pointer",
                            backgroundColor: marcado ? "#f0f9ff" : "#ffffff",
                            fontSize: "12.5px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => toggleProjetoLote(proj.centroDeCusto)}
                              style={{ width: "16px", height: "16px", accentColor: "#0284c7", cursor: "pointer" }}
                            />
                            <div>
                              <div style={{ fontWeight: 700, color: "#0f2a4a" }}>
                                {proj.projeto}
                              </div>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                CC: {proj.centroDeCusto} • {proj.area}
                              </div>
                            </div>
                          </div>

                          {(stCob === "VIGENTE" || stCob === "AGENDADA") && proj.liderSubstituto && (
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: "6px",
                                backgroundColor: stCob === "VIGENTE" ? "#dcfce7" : "#e0f2fe",
                                color: stCob === "VIGENTE" ? "#15803d" : "#0369a1",
                                fontSize: "10.5px",
                                fontWeight: 700,
                              }}
                            >
                              Atual: {proj.liderSubstituto}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "14px",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                  * O Líder Titular é preservado nos relatórios executivos e a cobertura expira sozinha após a Data Final.
                </span>
                <div style={{ display: "inline-flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setModalCoberturaLoteAberto(false)}
                    disabled={salvandoCoberturaLote}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "#ffffff",
                      color: "var(--on-surface-variant)",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={salvandoCoberturaLote}
                    style={{
                      padding: "9px 20px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      backgroundColor:
                        loteLiderSubstituto === "__REMOVER__" ? "#dc2626" : "#0284c7",
                    }}
                  >
                    {salvandoCoberturaLote
                      ? "Aplicando..."
                      : loteLiderSubstituto === "__REMOVER__"
                      ? "Encerrar Cobertura Selecionada"
                      : `Aplicar Cobertura (${loteCodigosSelecionados.length})`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
