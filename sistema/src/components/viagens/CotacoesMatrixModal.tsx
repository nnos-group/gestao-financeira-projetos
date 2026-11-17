"use client";

import React, { useState } from "react";
import {
  ViagemSolicitacao,
  CategoriaLogistica,
  CategoriaCotacoes,
  AlternativaCotacao,
  AnexoDocumento,
} from "@/lib/viagens-types";
import { ViagensPerfil } from "./ViagensRoleSelector";
import DocumentPreviewModal from "./DocumentPreviewModal";
import { formatarDataBR, formatarPeriodoBR, formatarDataHoraBR } from "@/lib/date-utils";
import { POLITICAS_VIAGEM } from "@/lib/politicas-viagem";
import { obterDadosLiderViagem } from "@/lib/lider-utils";

const formatarMoedaBRInput = (val: number | null | undefined): string => {
  if (val == null || isNaN(val) || val === 0) return "";
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoedaBRInput = (str: string): number => {
  const digits = str.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

const FORNECEDORES_GENERICOS = new Set([
  "locadora parceira",
  "rede conveniada",
  "agência fátima",
  "agencia fatima",
  "agência de viagens",
  "agencia de viagens",
  "seguradora corporativa",
  "locadora de veículos",
  "locadora de veiculos",
  "passagem aérea",
  "hotel / estadia",
  "carro / translado",
  "seguro / outros",
]);

const limparFornecedorGenerico = (fornecedor?: string | null): string => {
  const val = (fornecedor || "").trim();
  if (!val) return "";
  return FORNECEDORES_GENERICOS.has(val.toLowerCase()) ? "" : val;
};

export function abrirEmNovaAbaSegura(url?: string, nome?: string) {
  if (!url) return;
  if (url.startsWith("data:")) {
    try {
      const parts = url.split(",");
      const mime = parts[0].split(":")[1]?.split(";")[0] || "application/pdf";
      const byteCharacters = atob(parts[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch {
      window.open(url, "_blank");
    }
  } else {
    window.open(url, "_blank");
  }
}

interface CotacoesMatrixModalProps {
  solicitacao: ViagemSolicitacao;
  perfilAtivo: ViagensPerfil;
  onClose: () => void;
  onAtualizar: (solAtualizada?: ViagemSolicitacao) => void;
  showToast: (msg: string) => void;
}

export default function CotacoesMatrixModal({
  solicitacao,
  perfilAtivo,
  onClose,
  onAtualizar,
  showToast,
}: CotacoesMatrixModalProps) {
  const [sol, setSol] = useState<ViagemSolicitacao>(solicitacao);
  const [docVisualizando, setDocVisualizando] = useState<AnexoDocumento | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados de edição da Agência
  const [categoriasState, setCategoriasState] = useState<CategoriaCotacoes[]>(
    JSON.parse(JSON.stringify(solicitacao.categorias || []))
  );

  // Estados de aprovação do Líder com pré-seleção inteligente da menor cotação
  const [escolhasLider, setEscolhasLider] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    solicitacao.categorias.forEach((c) => {
      if (c.alternativaAprovadaId) {
        init[c.categoria] = c.alternativaAprovadaId;
      } else {
        // Encontra a alternativa de MENOR valor cotado (com valor > 0)
        const validas = c.alternativas.filter((a) => (a.valor || 0) > 0);
        if (validas.length > 0) {
          const menor = [...validas].sort((a, b) => (a.valor || 0) - (b.valor || 0))[0];
          init[c.categoria] = menor.id;
        } else {
          const sel = c.alternativas.find((a) => a.selecionada);
          if (sel) init[c.categoria] = sel.id;
          else if (c.alternativas[0]) init[c.categoria] = c.alternativas[0].id;
        }
      }
    });
    return init;
  });

  // Armazena a opção escolhida pelo Líder por categoria (ou justificativa legada)
  const [justificativasLider, setJustificativasLider] = useState<Record<string, string>>(
    solicitacao.justificativasLider || {}
  );

  // Estados de contratação da Agência (fornecedor, valores finais, localizadores e vouchers)
  const [fornecedoresContratados, setFornecedoresContratados] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    solicitacao.categorias.forEach((c) => {
      const altAprov = c.alternativas.find((a) => a.id === c.alternativaAprovadaId) || c.alternativas.find((a) => a.selecionada) || c.alternativas[0];
      const fornecedorLimpo = limparFornecedorGenerico(altAprov?.fornecedor);
      if (fornecedorLimpo) {
        init[c.categoria] = fornecedorLimpo;
      }
    });
    return init;
  });

  const [valoresContratados, setValoresContratados] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    solicitacao.categorias.forEach((c) => {
      const altAprov = c.alternativas.find((a) => a.id === c.alternativaAprovadaId) || c.alternativas.find((a) => a.selecionada) || c.alternativas[0];
      if (altAprov) {
        init[c.categoria] = altAprov.valorContratado ?? altAprov.valor ?? 0;
      }
    });
    return init;
  });

  const [localizadores, setLocalizadores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    solicitacao.categorias.forEach((c) => {
      const altAprov = c.alternativas.find((a) => a.id === c.alternativaAprovadaId) || c.alternativas.find((a) => a.selecionada) || c.alternativas[0];
      if (altAprov) {
        init[c.categoria] = altAprov.localizadorOuReserva || "";
      }
    });
    return init;
  });

  // Estado do Financeiro: Alimentação / Diária
  const [diariaFinanceiro, setDiariaFinanceiro] = useState<number>(solicitacao.custoAlimentacaoDiaria || 0);
  const [obsFinanceiro, setObsFinanceiro] = useState(solicitacao.prestacaoContasObservacao || "");

  // Controle de expansão de histórico de auditoria
  const [expandirHistorico, setExpandirHistorico] = useState(false);

  // Modo de edição explícito da Agência para solicitações já em andamento ou concluídas
  const [modoEdicaoAgencia, setModoEdicaoAgencia] = useState(false);

  // Modal de Pré-visualização do E-mail do Viajante
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false);
  const [emailPreviewData, setEmailPreviewData] = useState<any>(null);

  const brl = (v: number) =>
    (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const montarPayloadCompras = (listaCats: CategoriaCotacoes[]) =>
    listaCats
      .filter(
        (c) =>
          c.necessaria ||
          (c.alternativas && c.alternativas.some((a) => (a.vouchersDefinitivos?.length || 0) > 0 || (a.anexos?.length || 0) > 0)) ||
          Boolean(localizadores[c.categoria]?.trim()) ||
          Boolean(fornecedoresContratados[c.categoria]?.trim()) ||
          Number(valoresContratados[c.categoria]) > 0
      )
      .map((c) => {
        const altAprov = c.alternativas.find((a) => a.id === c.alternativaAprovadaId) || c.alternativas.find((a) => a.selecionada) || c.alternativas[0];
        return {
          categoria: c.categoria,
          alternativaId: altAprov?.id || `alt-${c.categoria.toLowerCase()}-${sol.id}-1`,
          fornecedor: fornecedoresContratados[c.categoria] ?? altAprov?.fornecedor ?? "",
          valorContratado: valoresContratados[c.categoria] ?? altAprov?.valorContratado ?? altAprov?.valor ?? 0,
          localizadorOuReserva: localizadores[c.categoria] ?? altAprov?.localizadorOuReserva ?? "",
          vouchers: altAprov?.vouchersDefinitivos || [],
        };
      });

  const removerAnexo = async (categoria: CategoriaLogistica, altId: string, anexoId: string) => {
    const novasCategorias = categoriasState.map((cat) => {
      if (cat.categoria === categoria) {
        return {
          ...cat,
          alternativas: cat.alternativas.map((alt) =>
            alt.id === altId
              ? {
                  ...alt,
                  anexos: (alt.anexos || []).filter((a) => a.id !== anexoId),
                  vouchersDefinitivos: (alt.vouchersDefinitivos || []).filter((v) => v.id !== anexoId),
                }
              : alt
          ),
        };
      }
      return cat;
    });

    setCategoriasState(novasCategorias);
    setSol((prev) => ({
      ...prev,
      categorias: novasCategorias,
    }));

    showToast("Anexo removido com sucesso.");

    // Só persiste via /api/viagens/comprar se a viagem já estiver em etapa de compra/vouchers
    const emEtapaCompra =
      sol.status !== "AGUARDANDO_COTACAO" &&
      sol.status !== "EM_COTACAO" &&
      sol.status !== "AGUARDANDO_APROVACAO";

    if (emEtapaCompra) {
      try {
        const resComprar = await fetch("/api/viagens/comprar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            solicitacaoId: sol.id,
            compras: montarPayloadCompras(novasCategorias),
            usuarioNome: "Agência Fátima",
          }),
        });
        const dataComprar = await lerRespostaSegura(resComprar).catch(() => null);
        if (resComprar.ok && dataComprar?.ok && dataComprar?.solicitacao) {
          setSol(dataComprar.solicitacao);
          onAtualizar(dataComprar.solicitacao);
        } else {
          onAtualizar();
        }
      } catch (err) {
        console.warn("Aviso ao persistir remoção de voucher:", err);
      }
    }
  };

  const abrirPreviewEmail = () => {
    const aereoCat = sol.categorias.find((c) => c.categoria === "AEREO");
    const aereoAlt = aereoCat?.alternativas.find((a) => a.id === aereoCat.alternativaAprovadaId) || aereoCat?.alternativas.find((a) => a.selecionada) || aereoCat?.alternativas[0];

    const hotelCat = sol.categorias.find((c) => c.categoria === "HOTEL");
    const hotelAlt = hotelCat?.alternativas.find((a) => a.id === hotelCat.alternativaAprovadaId) || hotelCat?.alternativas.find((a) => a.selecionada) || hotelCat?.alternativas[0];

    const carroCat = sol.categorias.find((c) => c.categoria === "CARRO");
    const carroAlt = carroCat?.alternativas.find((a) => a.id === carroCat.alternativaAprovadaId) || carroCat?.alternativas.find((a) => a.selecionada) || carroCat?.alternativas[0];

    const todosAnexos: { id?: string; nome: string; categoria: string; url?: string; mimeType?: string }[] = [];
    categoriasState.forEach((c) => {
      c.alternativas.forEach((a) => {
        const listaDocs = [
          ...(a.vouchersDefinitivos || []),
          ...(a.anexos || []).filter((doc) => doc.tipo === "VOUCHER"),
        ];
        listaDocs.forEach((doc) => {
          if (!todosAnexos.some((ex) => ex.nome === doc.nome && ex.url === doc.url)) {
            todosAnexos.push({
              id: doc.id,
              nome: doc.nome,
              categoria: c.nomeExibicao,
              url: doc.url,
              mimeType: doc.mimeType,
            });
          }
        });
      });
    });

    const lider = obterDadosLiderViagem(sol);
    const destEmail = sol.consultorEmail || "leonardo.campos@nnos.com.br";

    setEmailPreviewData({
      de: `Agência de Viagens <agencia.${(sol.agenciaNome || "fatima").toLowerCase()}@nnos.com.br>`,
      para: destEmail,
      cc: ["agencia.fatima@nnos.com.br", lider.email],
      assunto: `[VOUCHER & RESERVAS] Viagem Confirmada • ${sol.projeto} - ${sol.atividade}`,
      passageiro: sol.consultor,
      perfil: sol.perfilConsultor,
      projeto: sol.projeto,
      atividade: sol.atividade,
      periodo: formatarPeriodoBR(sol.dataInicial, sol.dataFinal),
      destino: sol.destino,
      aereo: aereoAlt
        ? {
            fornecedor: aereoAlt.fornecedor || "GOL",
            horarios: aereoAlt.descricao || "Conforme bilhete",
            localizador: localizadores["AEREO"] || aereoAlt.localizadorOuReserva || "ABC",
            valor: valoresContratados["AEREO"] ?? aereoAlt.valor,
          }
        : null,
      hotel: hotelAlt
        ? {
            hotel: hotelAlt.fornecedor || "Hotel",
            detalhes: hotelAlt.descricao || "Diárias confirmadas",
            localizador: localizadores["HOTEL"] || hotelAlt.localizadorOuReserva || "XYZ",
            valor: valoresContratados["HOTEL"] ?? hotelAlt.valor,
          }
        : null,
      carro: (carroAlt || localizadores["CARRO"])
        ? {
            locadora: carroAlt?.fornecedor || "Locadora",
            detalhes: carroAlt?.descricao || "Veículo alugado / Translado",
            localizador: localizadores["CARRO"] || carroAlt?.localizadorOuReserva || "Confirmado",
            valor: valoresContratados["CARRO"] ?? carroAlt?.valorContratado ?? carroAlt?.valor ?? 0,
          }
        : null,
      totalViagem: (valoresContratados["AEREO"] || 0) + (valoresContratados["HOTEL"] || 0) + (valoresContratados["CARRO"] || 0) + (sol.custoAlimentacaoDiaria || 0),
      anexos: todosAnexos,
      observacoes: sol.observacoesSolicitante || "Seguir orientações da agência e NNÓS.",
    });
    setShowEmailPreviewModal(true);
  };

  const toggleCategoriaNecessaria = (categoria: CategoriaLogistica) => {
    setCategoriasState((prev) =>
      prev.map((cat) =>
        cat.categoria === categoria ? { ...cat, necessaria: !cat.necessaria } : cat
      )
    );
  };

  const atualizarObsCategoriaAgencia = (categoria: CategoriaLogistica, observacoes: string) => {
    setCategoriasState((prev) =>
      prev.map((cat) => {
        if (cat.categoria !== categoria) return cat;
        if (!cat.alternativas || cat.alternativas.length === 0) {
          const novaAlt: AlternativaCotacao = {
            id: `alt-${categoria.toLowerCase()}-${sol.id}-1`,
            alternativaNumero: 1,
            fornecedor: "",
            descricao: "",
            valor: 0,
            dataCotacao: new Date().toISOString().split("T")[0],
            selecionada: true,
            observacoes,
            anexos: [],
          };
          return { ...cat, alternativas: [novaAlt], alternativaAprovadaId: novaAlt.id };
        }
        return {
          ...cat,
          alternativas: cat.alternativas.map((alt, idx) =>
            idx === 0 ? { ...alt, observacoes } : alt
          ),
        };
      })
    );
  };

  const lerRespostaSegura = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        res.status === 413
          ? "Arquivo excedeu o limite permitido pelo servidor. Envie arquivos de até 4 MB por vez."
          : text.slice(0, 140) || `Erro HTTP ${res.status}`
      );
    }
  };

  const handleUploadAnexo = async (
    e: React.ChangeEvent<HTMLInputElement>,
    categoria: CategoriaLogistica,
    altId: string,
    tipo: "ORCAMENTO" | "VOUCHER"
  ) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const enviarArquivoIndividual = async (file: File): Promise<AnexoDocumento> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipo", tipo);
      formData.append("solicitacaoId", sol.id);
      formData.append("categoria", categoria);

      const res = await fetch("/api/viagens/anexo", {
        method: "POST",
        body: formData,
      });
      const data = await lerRespostaSegura(res);
      if (!res.ok || !data?.ok || !data?.anexo) {
        throw new Error(data?.error || `Falha ao enviar arquivo ${file.name}`);
      }
      return data.anexo as AnexoDocumento;
    };

    setLoading(true);
    try {
      const novosAnexos = await Promise.all(files.map(enviarArquivoIndividual));

      const novasCategorias = categoriasState.map((cat) => {
        if (cat.categoria !== categoria) return cat;

        let achouAlt = false;
        const novasAlts = cat.alternativas.map((alt, idx) => {
          if (alt.id === altId || (!altId && idx === 0)) {
            achouAlt = true;
            if (tipo === "VOUCHER") {
              return {
                ...alt,
                vouchersDefinitivos: [...(alt.vouchersDefinitivos || []), ...novosAnexos],
              };
            }
            return { ...alt, anexos: [...(alt.anexos || []), ...novosAnexos] };
          }
          return alt;
        });

        if (!achouAlt) {
          const novaAlt: AlternativaCotacao = {
            id: altId || `alt-${categoria.toLowerCase()}-${sol.id}-1`,
            alternativaNumero: 1,
            fornecedor: fornecedoresContratados[categoria] || "",
            descricao: justificativasLider[categoria] || `Cotação de ${cat.nomeExibicao}`,
            valor: valoresContratados[categoria] || 0,
            valorContratado: valoresContratados[categoria] || 0,
            dataCotacao: new Date().toISOString().split("T")[0],
            selecionada: true,
            localizadorOuReserva: localizadores[categoria] || "",
            vouchersDefinitivos: tipo === "VOUCHER" ? novosAnexos : [],
            anexos: tipo === "ORCAMENTO" ? novosAnexos : [],
          };
          novasAlts.push(novaAlt);
          return {
            ...cat,
            necessaria: true,
            alternativaAprovadaId: novaAlt.id,
            alternativas: novasAlts,
          };
        }

        return {
          ...cat,
          necessaria: true,
          alternativaAprovadaId: cat.alternativaAprovadaId || novasAlts[0]?.id,
          alternativas: novasAlts,
        };
      });

      setCategoriasState(novasCategorias);
      setSol((prev) => ({ ...prev, categorias: novasCategorias }));

      showToast(
        novosAnexos.length === 1
          ? `Documento "${novosAnexos[0].nome}" enviado com sucesso!`
          : `${novosAnexos.length} documentos enviados com sucesso!`
      );

      if (tipo === "VOUCHER") {
        const resComprar = await fetch("/api/viagens/comprar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            solicitacaoId: sol.id,
            compras: montarPayloadCompras(novasCategorias),
            usuarioNome: "Agência Fátima",
          }),
        });
        const dataComprar = await lerRespostaSegura(resComprar);
        if (resComprar.ok && dataComprar?.ok && dataComprar?.solicitacao) {
          setSol(dataComprar.solicitacao);
          onAtualizar(dataComprar.solicitacao);
        } else {
          onAtualizar();
        }
      }
    } catch (err: any) {
      showToast(`Erro no upload: ${err?.message || "Falha ao enviar o(s) arquivo(s)."}`);
    } finally {
      setLoading(false);
    }
  };

  // Ação 1: Agência envia PDFs de cotação ou salva rascunho
  const handleSalvarCotacoesAgencia = async (enviar: boolean) => {
    if (enviar) {
      const totalAnexos = categoriasState.reduce(
        (acc, cat) =>
          acc + (cat.alternativas || []).reduce((s, a) => s + (a.anexos?.length || 0), 0),
        0
      );
      if (totalAnexos === 0) {
        showToast("⚠️ Anexe pelo menos 1 arquivo PDF com as opções de cotação antes de enviar para aprovação.");
        return;
      }
    }

    setLoading(true);
    try {
      const obsPorCategoria = categoriasState
        .map((cat) => {
          const obs = (cat.alternativas?.[0]?.observacoes || "").trim();
          return obs ? `${cat.nomeExibicao}: ${obs}` : "";
        })
        .filter(Boolean)
        .join(" | ");

      const res = await fetch("/api/viagens/cotacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitacaoId: sol.id,
          categorias: categoriasState,
          observacoesAgencia: obsPorCategoria,
          enviarParaAprovacao: enviar,
          usuarioNome: "Agência Fátima",
        }),
      });
      const data = await lerRespostaSegura(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Falha ao salvar cotações");

      setSol(data.solicitacao);
      showToast(
        enviar
          ? "PDFs de cotação enviados ao Líder de Projeto para escolha!"
          : "Rascunho de cotação salvo com sucesso!"
      );
      onAtualizar(data.solicitacao);
      if (enviar) onClose();
    } catch (err: any) {
      showToast(`Erro ao salvar cotações: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Ação 2: Líder de Projeto informa qual opção escolheu de cada PDF e aprova para compra
  const handleAprovarLider = async () => {
    const categoriasComPdf = categoriasState.filter((c) =>
      (c.alternativas || []).some((a) => (a.anexos?.length || 0) > 0)
    );

    for (const cat of categoriasComPdf) {
      const escolha = (justificativasLider[cat.categoria] || "").trim();
      if (!escolha) {
        showToast(`⚠️ Informe qual opção do PDF foi escolhida em "${cat.nomeExibicao}" antes de aprovar.`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/viagens/aprovar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitacaoId: sol.id,
          escolhas: escolhasLider,
          justificativas: justificativasLider,
          aprovadorNome: obterDadosLiderViagem(sol).nome || "Líder de Projeto",
        }),
      });
      const data = await lerRespostaSegura(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Falha ao aprovar logística");

      setSol(data.solicitacao);
      showToast("Escolhas APROVADAS com sucesso! Agência notificada para compra e emissão.");
      onAtualizar(data.solicitacao);
      onClose();
    } catch (err: any) {
      showToast(`Erro ao aprovar logística: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Ação 3: Agência registra compras, fornecedor, localizador e valor final pago
  const handleRegistrarComprasAgencia = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/viagens/comprar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitacaoId: sol.id,
          compras: montarPayloadCompras(categoriasState),
          usuarioNome: "Agência Fátima",
        }),
      });
      const data = await lerRespostaSegura(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Falha ao registrar compras");

      setSol(data.solicitacao);
      if (data.requerReaprovacao) {
        showToast("ATENÇÃO: Valor contratado excedeu o aprovado! Solicitação enviada para reaprovação do líder.");
      } else {
        showToast("Valores contratados, localizadores e vouchers salvos com sucesso!");
      }
      onAtualizar(data.solicitacao);
    } catch (err: any) {
      showToast(`Erro ao registrar compras: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Ação 4: Agência salva valores contratados/vouchers e dispara e-mail ao viajante
  const handleEnviarVouchers = async () => {
    setLoading(true);
    try {
      const payloadCompras = montarPayloadCompras(categoriasState);
      const resComprar = await fetch("/api/viagens/comprar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitacaoId: sol.id,
          compras: payloadCompras,
          usuarioNome: "Agência Fátima",
        }),
      });
      const dataComprar = await lerRespostaSegura(resComprar);
      if (!resComprar.ok || !dataComprar.ok) throw new Error(dataComprar.error || "Falha ao registrar valores finais");

      if (dataComprar.requerReaprovacao || dataComprar.solicitacao?.requerReaprovacao) {
        setSol(dataComprar.solicitacao);
        showToast("⚠️ Alterações salvas! Como o valor excedeu o orçamento aprovado, o fluxo foi enviado para reaprovação do Líder.");
        onAtualizar(dataComprar.solicitacao);
        setModoEdicaoAgencia(false);
        return;
      }

      const res = await fetch("/api/viagens/enviar-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitacaoId: sol.id,
          emailDestinatario: sol.consultorEmail || "leonardo.campos@nnos.com.br",
          usuarioNome: "Agência Fátima",
          compras: payloadCompras,
        }),
      });
      const data = await lerRespostaSegura(res);
      if (!res.ok || !data.ok) throw new Error(data.error || data.mensagem || "Falha ao enviar vouchers");

      setSol(data.solicitacao);
      setShowEmailPreviewModal(false);
      showToast(data.mensagem || "Vouchers enviados com sucesso!");
      onAtualizar(data.solicitacao);
      setModoEdicaoAgencia(false);
      onClose();
    } catch (err: any) {
      showToast(`Erro ao enviar vouchers: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Ação 5: Financeiro registra Alimentação / Diária na prestação de contas
  const handleSalvarFinanceiro = async (concluir: boolean) => {
    setLoading(true);
    try {
      const res = await fetch("/api/viagens/prestacao-contas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitacaoId: sol.id,
          valorAlimentacao: diariaFinanceiro,
          observacoes: obsFinanceiro,
          concluirPrestacao: concluir,
          usuarioNome: "Financeiro NNÓS",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setSol(data.solicitacao);
      showToast(
        concluir
          ? "Prestação de contas CONCLUÍDA com sucesso! Total Viagem sincronizado."
          : "Valor de alimentação e diárias salvo com sucesso!"
      );
      onAtualizar(data.solicitacao);
      if (concluir) onClose();
    } catch (err: any) {
      showToast(`Erro no Financeiro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Ação 6: Consultor aprova o recebimento dos vouchers e reservas
  const handleAprovarRecebimentoVouchers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/viagens/aprovar-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitacaoId: sol.id,
          usuarioNome: sol.consultor || "Consultor",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setSol(data.solicitacao);
      showToast("Recebimento dos vouchers APROVADO com sucesso no sistema!");
      onAtualizar(data.solicitacao);
    } catch (err: any) {
      showToast(`Erro ao aprovar vouchers: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999,
          padding: "20px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: "95%",
            maxWidth: "1180px",
            height: "90vh",
            backgroundColor: "var(--surface, #ffffff)",
            borderRadius: "16px",
            border: "1px solid var(--border, #e2e8f0)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header do Modal */}
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--surface-container-low, #f8fafc)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--primary, #0f2a4a)", fontSize: "24px" }}>
                  flight_takeoff
                </span>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--on-surface, #0f172a)" }}>
                  {sol.projeto} • {sol.atividade}
                </h2>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 700,
                    backgroundColor: sol.requerReaprovacao ? "#fee2e2" : "rgba(0, 168, 150, 0.12)",
                    color: sol.requerReaprovacao ? "#b91c1c" : "var(--secondary, #00a896)",
                  }}
                >
                  {sol.status.replace(/_/g, " ")}
                </span>
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "4px", fontSize: "12px", color: "var(--on-surface-variant, #64748b)" }}>
                <span><strong>Viajante:</strong> {sol.consultor} ({sol.perfilConsultor})</span>
                <span><strong>Período:</strong> {formatarPeriodoBR(sol.dataInicial, sol.dataFinal)}</span>
                <span><strong>Destino:</strong> {sol.destino}</span>
                <span><strong>Agência:</strong> {sol.agenciaNome}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Badge indicativa do perfil ativo no momento (oculta quando a própria Agência está operando) */}
              {perfilAtivo !== "AGENCIA" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background:
                      perfilAtivo === "LIDER"
                        ? "rgba(15, 42, 74, 0.12)"
                        : perfilAtivo === "FINANCEIRO"
                        ? "rgba(217, 119, 6, 0.15)"
                        : "rgba(37, 99, 235, 0.15)",
                    color:
                      perfilAtivo === "LIDER"
                        ? "var(--primary, #0f2a4a)"
                        : perfilAtivo === "FINANCEIRO"
                        ? "#d97706"
                        : "#2563eb",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    {perfilAtivo === "LIDER"
                      ? "supervised_user_circle"
                      : perfilAtivo === "FINANCEIRO"
                      ? "account_balance"
                      : "badge"}
                  </span>
                  <span>
                    Visão:{" "}
                    {perfilAtivo === "LIDER"
                      ? "Líder de Projeto"
                      : perfilAtivo === "FINANCEIRO"
                      ? "Financeiro"
                      : "Consultor"}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                  color: "var(--on-surface-variant, #64748b)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>close</span>
              </button>
            </div>
          </div>

          {/* Banner de Reaprovação Obrigatória se valor > aprovado */}
          {sol.requerReaprovacao && (
            <div
              style={{
                backgroundColor: "#fff1f2",
                borderBottom: "1px solid #fecdd3",
                padding: "12px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                color: "#9f1239",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "280px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>warning</span>
                <div style={{ fontSize: "13px" }}>
                  <strong>Reaprovação Necessária:</strong> {sol.motivoReaprovacao}
                  <span style={{ display: "block", fontSize: "11.5px", color: "#9f1239", marginTop: "2px" }}>
                    Qualquer alteração na logística reinicia o fluxo de aprovação do líder e a confirmação de recebimento do consultor.
                  </span>
                </div>
              </div>
              {perfilAtivo === "LIDER" ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAprovarLider}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: "#be123c",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(190, 18, 60, 0.3)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>thumb_up</span>
                  Aprovar Novo Orçamento ({brl(sol.totalContratado)})
                </button>
              ) : (
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#be123c" }}>
                  Aguardando reaprovação do Líder de Projetos.
                </span>
              )}
            </div>
          )}

          {/* Quadro de Discriminação Financeira: Cotado x Aprovado x Contratado x Realizado */}
          <div
            style={{
              padding: "12px 24px",
              background: "var(--surface, #ffffff)",
              borderBottom: "1px solid var(--border, #e2e8f0)",
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "14px",
            }}
          >
            <div style={{ borderLeft: "3px solid #94a3b8", paddingLeft: "10px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>1. Orçado / Cotado</span>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--on-surface)" }}>{brl(sol.totalCotado)}</div>
            </div>
            <div style={{ borderLeft: "3px solid var(--primary, #0f2a4a)", paddingLeft: "10px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>2. Aprovado Líder</span>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--primary)" }}>{brl(sol.totalAprovado)}</div>
            </div>
            <div style={{ borderLeft: "3px solid var(--secondary, #00a896)", paddingLeft: "10px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--secondary)", textTransform: "uppercase" }}>3. Contratado Agência</span>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--secondary)" }}>{brl(sol.totalContratado)}</div>
            </div>
            <div style={{ borderLeft: "3px solid #d97706", paddingLeft: "10px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>4. Diárias Financeiro</span>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#d97706" }}>{brl(sol.custoAlimentacaoDiaria)}</div>
            </div>
            <div style={{ borderLeft: "3px solid #059669", paddingLeft: "10px", backgroundColor: "rgba(5, 150, 105, 0.05)", borderRadius: "6px", padding: "4px 10px" }}>
              <span style={{ fontSize: "10px", fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>TOTAL VIAGEM FINAL</span>
              <div style={{ fontSize: "16px", fontWeight: 900, color: "#059669" }}>{brl(sol.totalRealizado)}</div>
            </div>
          </div>

          {/* Corpo Rolável do Modal */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {/* Seção 1: Matriz Comparativa de Cotações por Categoria */}
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {categoriasState.map((cat) => {
                const altEscolhidaId =
                  perfilAtivo === "LIDER"
                    ? escolhasLider[cat.categoria]
                    : cat.alternativaAprovadaId || cat.alternativas.find((a) => a.selecionada)?.id;

                const altPrincipal =
                  cat.alternativas.find((a) => a.id === altEscolhidaId) ||
                  cat.alternativas.find((a) => a.selecionada) ||
                  cat.alternativas[0];

                const pdfsCotacao = (cat.alternativas || []).flatMap((a) =>
                  (a.anexos || [])
                    .filter((anx) => anx.tipo !== "VOUCHER")
                    .map((anx) => ({ doc: anx, altId: a.id }))
                );

                const isEtapaCotacaoAgencia =
                  perfilAtivo === "AGENCIA" &&
                  (sol.status === "AGUARDANDO_COTACAO" || sol.status === "EM_COTACAO");

                const isEtapaEscolhaLider =
                  perfilAtivo === "LIDER" &&
                  (sol.status === "AGUARDANDO_APROVACAO" || sol.status === "AGUARDANDO_REAPROVACAO" || sol.requerReaprovacao);

                const escolhaSalvaTexto =
                  justificativasLider[cat.categoria] ||
                  sol.justificativasLider?.[cat.categoria] ||
                  (altPrincipal?.descricao &&
                  altPrincipal.descricao !== `Cotação de ${cat.nomeExibicao}` &&
                  altPrincipal.descricao !== `Reserva de ${cat.nomeExibicao}`
                    ? altPrincipal.descricao
                    : "");

                // Placeholder contextualizado por categoria
                const placeholderEscolhaLider =
                  cat.categoria === "HOTEL"
                    ? "Ex: Hotel Ibis Styles Goiânia c/ café da manhã (R$ 886,93)"
                    : cat.categoria === "CARRO"
                    ? "Ex: Unidas Grupo EA Compacto Automático (R$ 487,14)"
                    : cat.categoria === "SEGURO"
                    ? "Ex: Apólice Corporativa Padrão"
                    : "Ex: Voo Gol 1169 saída 11:00 c/ bagagem + Volta Latam 3545 saída 19:45";

                return (
                  <div
                    key={cat.categoria}
                    style={{
                      border: pdfsCotacao.length > 0
                        ? "1.5px solid var(--secondary, #00a896)"
                        : "1px solid var(--border, #e2e8f0)",
                      borderRadius: "12px",
                      overflow: "hidden",
                      backgroundColor: "var(--surface, #ffffff)",
                    }}
                  >
                    {/* Header da Categoria */}
                    <div
                      style={{
                        padding: "12px 18px",
                        background: "var(--surface-container-low, #f8fafc)",
                        borderBottom: "1px solid var(--border, #e2e8f0)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "19px", color: "var(--primary, #0f2a4a)" }}>
                          {cat.icone}
                        </span>
                        <strong style={{ fontSize: "14px", color: "var(--on-surface)" }}>
                          {cat.nomeExibicao}
                        </strong>
                        {pdfsCotacao.length > 0 ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#0f766e",
                              backgroundColor: "#ccfbf1",
                              padding: "2px 9px",
                              borderRadius: "12px",
                            }}
                          >
                            {pdfsCotacao.length} arquivo(s) de cotação anexado(s)
                          </span>
                        ) : cat.necessaria ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#0369a1",
                              backgroundColor: "#e0f2fe",
                              padding: "2px 9px",
                              borderRadius: "12px",
                            }}
                          >
                            Solicitado na viagem
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            Opcional / Sem cotação anexada
                          </span>
                        )}
                      </div>

                      {isEtapaCotacaoAgencia && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => toggleCategoriaNecessaria(cat.categoria)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 600,
                              color: cat.necessaria ? "#0369a1" : "var(--on-surface-variant)",
                              backgroundColor: cat.necessaria ? "#e0f2fe" : "#ffffff",
                              border: "1px solid var(--border)",
                              cursor: "pointer",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                              {cat.necessaria ? "check_box" : "check_box_outline_blank"}
                            </span>
                            <span>{cat.necessaria ? "Incluído na viagem" : "Incluir categoria"}</span>
                          </button>

                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "5px 12px",
                              borderRadius: "6px",
                              fontSize: "11.5px",
                              fontWeight: 700,
                              color: "#ffffff",
                              backgroundColor: "var(--primary, #0f2a4a)",
                              cursor: "pointer",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>upload_file</span>
                            <span>Anexar PDF da Cotação</span>
                            <input
                              type="file"
                              multiple
                              accept="application/pdf,image/*"
                              style={{ display: "none" }}
                              onChange={(e) => handleUploadAnexo(e, cat.categoria, altPrincipal?.id || "", "ORCAMENTO")}
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Corpo da Categoria: Etapa 1 (Upload PDFs), Etapa 2 (Escolha do Líder), Histórico */}
                    <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {/* Arquivos PDF de Cotação Anexados */}
                      {pdfsCotacao.length > 0 ? (
                        <div>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>
                            Arquivos de Cotação da Agência ({cat.nomeExibicao})
                          </span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {pdfsCotacao.map(({ doc, altId }) => (
                              <div
                                key={doc.id}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "7px 12px",
                                  borderRadius: "8px",
                                  backgroundColor: "#f0f9ff",
                                  border: "1px solid #bae6fd",
                                  fontSize: "12px",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#0284c7" }}>
                                  picture_as_pdf
                                </span>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <strong style={{ color: "#0f172a", fontSize: "12px" }}>
                                    {doc.nome || (doc as any).nomeOriginal || "Cotacao.pdf"}
                                  </strong>
                                  {doc.tamanhoFormatado && (
                                    <span style={{ fontSize: "10.5px", color: "#64748b" }}>{doc.tamanhoFormatado}</span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDocVisualizando(doc)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "4px 9px",
                                    borderRadius: "6px",
                                    backgroundColor: "#0284c7",
                                    color: "#ffffff",
                                    border: "none",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                  title="Visualizar opções dentro do PDF na tela"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>visibility</span>
                                  <span>Visualizar Opções</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => abrirEmNovaAbaSegura(doc.url, doc.nome)}
                                  style={{
                                    background: "transparent",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    color: "#475569",
                                    cursor: "pointer",
                                    padding: "3px 6px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                  }}
                                  title="Abrir PDF em nova aba"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                                </button>
                                {isEtapaCotacaoAgencia && (
                                  <button
                                    type="button"
                                    onClick={() => removerAnexo(cat.categoria, altId, doc.id)}
                                    title="Remover arquivo"
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      cursor: "pointer",
                                      color: "#dc2626",
                                      fontSize: "15px",
                                      fontWeight: 800,
                                      padding: "0 4px",
                                    }}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : isEtapaCotacaoAgencia ? (
                        <label
                          style={{
                            border: "1.5px dashed #cbd5e1",
                            borderRadius: "10px",
                            padding: "16px",
                            backgroundColor: "#f8fafc",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "#0284c7" }}>
                            cloud_upload
                          </span>
                          <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a" }}>
                            Clique para anexar o arquivo PDF de {cat.nomeExibicao}
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            Envie diretamente o comparativo completo em PDF (EHTL / GDS / Locadora) sem precisar digitar as opções manualmente.
                          </span>
                          <input
                            type="file"
                            multiple
                            accept="application/pdf,image/*"
                            style={{ display: "none" }}
                            onChange={(e) => handleUploadAnexo(e, cat.categoria, altPrincipal?.id || "", "ORCAMENTO")}
                          />
                        </label>
                      ) : (
                        !cat.necessaria && !altPrincipal?.valor && !altPrincipal?.valorContratado && (
                          <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", fontStyle: "italic" }}>
                            Nenhum arquivo de cotação enviado para {cat.nomeExibicao}.
                          </div>
                        )
                      )}

                      {/* Observação por categoria da Agência (Etapa 1 editável ou leitura) */}
                      {isEtapaCotacaoAgencia && (cat.necessaria || pdfsCotacao.length > 0) ? (
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                            Observação da Agência para {cat.nomeExibicao} (opcional)
                          </label>
                          <input
                            type="text"
                            value={altPrincipal?.observacoes || ""}
                            onChange={(e) => atualizarObsCategoriaAgencia(cat.categoria, e.target.value)}
                            placeholder={`Ex: Tarifas de ${cat.nomeExibicao} válidas até amanhã às 18h / Opção com bagagem incluída`}
                            style={{
                              width: "100%",
                              padding: "7px 10px",
                              fontSize: "12px",
                              borderRadius: "8px",
                              border: "1px solid var(--border, #cbd5e1)",
                              backgroundColor: "#ffffff",
                            }}
                          />
                        </div>
                      ) : altPrincipal?.observacoes ? (
                        <div
                          style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            backgroundColor: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                            color: "#334155",
                          }}
                        >
                          <strong style={{ color: "#0f2a4a" }}>Obs. da Agência:</strong> {altPrincipal.observacoes}
                        </div>
                      ) : null}

                      {/* Dados legados (para histórico importado com fornecedor/valor já gravado) */}
                      {!isEtapaCotacaoAgencia && pdfsCotacao.length === 0 && (altPrincipal?.fornecedor || (altPrincipal?.valor || 0) > 0) && (
                        <div style={{ fontSize: "12px", color: "#475569", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                          {altPrincipal?.fornecedor && (
                            <span><strong>Fornecedor:</strong> {altPrincipal.fornecedor}</span>
                          )}
                          {(altPrincipal?.valor || 0) > 0 && (
                            <span><strong>Valor Ref.:</strong> {brl(altPrincipal.valor)}</span>
                          )}
                        </div>
                      )}

                      {/* Etapa 2: Campo de Escolha do Líder de Projeto */}
                      {isEtapaEscolhaLider && (pdfsCotacao.length > 0 || cat.necessaria) ? (
                        <div
                          style={{
                            padding: "12px 14px",
                            borderRadius: "10px",
                            backgroundColor: "#f0fdf4",
                            border: "1.5px solid #86efac",
                          }}
                        >
                          <label style={{ fontSize: "12px", fontWeight: 800, color: "#166534", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>fact_check</span>
                            <span>
                              Qual opção do PDF você escolhe para {cat.nomeExibicao}? {pdfsCotacao.length > 0 ? "*" : "(opcional)"}
                            </span>
                          </label>
                          <textarea
                            rows={2}
                            value={justificativasLider[cat.categoria] || ""}
                            onChange={(e) =>
                              setJustificativasLider((prev) => ({
                                ...prev,
                                [cat.categoria]: e.target.value,
                              }))
                            }
                            placeholder={placeholderEscolhaLider}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              fontSize: "12.5px",
                              borderRadius: "8px",
                              border: "1px solid #22c55e",
                              backgroundColor: "#ffffff",
                              resize: "vertical",
                            }}
                          />
                        </div>
                      ) : escolhaSalvaTexto ? (
                        <div
                          style={{
                            padding: "10px 14px",
                            borderRadius: "8px",
                            backgroundColor: "#ecfdf5",
                            border: "1px solid #6ee7b7",
                          }}
                        >
                          <div style={{ fontSize: "11px", fontWeight: 800, color: "#065f46", textTransform: "uppercase", marginBottom: "2px" }}>
                            🎯 Opção Escolhida pelo Líder para Compra:
                          </div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                            {escolhaSalvaTexto}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Bloco de Contratação & Vouchers Definitivos (Etapa 3: Agência informa Valor Final, Localizador e Voucher) */}
                    {(() => {
                      const podeEditarAgencia = perfilAtivo === "AGENCIA" && (
                        sol.status === "APROVADO_AGUARDANDO_COMPRA" ||
                        sol.status === "VOUCHERS_PENDENTES" ||
                        sol.status === "VOUCHERS_ENVIADOS" ||
                        sol.status === "AGUARDANDO_PRESTACAO_CONTAS" ||
                        sol.status === "CONCLUIDO" ||
                        modoEdicaoAgencia
                      );

                      if (
                        sol.status !== "APROVADO_AGUARDANDO_COMPRA" &&
                        sol.status !== "VOUCHERS_PENDENTES" &&
                        sol.status !== "VOUCHERS_ENVIADOS" &&
                        sol.status !== "AGUARDANDO_PRESTACAO_CONTAS" &&
                        sol.status !== "CONCLUIDO" &&
                        !modoEdicaoAgencia
                      ) {
                        return null;
                      }

                      const altAprov = altPrincipal;
                      const mapaVouchers = new Map<string, AnexoDocumento>();
                      (altAprov?.vouchersDefinitivos || []).forEach((v) => {
                        const chave = v.id || v.nome;
                        if (chave) mapaVouchers.set(chave, v);
                      });
                      (altAprov?.anexos || []).filter((anx) => anx.tipo === "VOUCHER").forEach((v) => {
                        const chave = v.id || v.nome;
                        if (chave && !mapaVouchers.has(chave)) {
                          mapaVouchers.set(chave, v);
                        }
                      });
                      const vouchersAlt = Array.from(mapaVouchers.values());

                      return (
                        <div
                          style={{
                            backgroundColor: "rgba(0, 168, 150, 0.04)",
                            borderTop: "1px solid rgba(0, 168, 150, 0.25)",
                            padding: "14px 18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "16px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: "300px", flexWrap: "wrap" }}>
                            <div>
                              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface-variant)", display: "block", marginBottom: "2px" }}>
                                Fornecedor / Empresa Emitida
                              </span>
                              {podeEditarAgencia ? (
                                <input
                                  type="text"
                                  value={fornecedoresContratados[cat.categoria] || ""}
                                  onChange={(e) =>
                                    setFornecedoresContratados((prev) => ({
                                      ...prev,
                                      [cat.categoria]: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    cat.categoria === "HOTEL"
                                      ? "Ex: Ibis Styles"
                                      : cat.categoria === "CARRO"
                                      ? "Ex: Unidas / Localiza"
                                      : "Ex: GOL / LATAM"
                                  }
                                  style={{ width: "160px", padding: "5px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "#ffffff" }}
                                />
                              ) : (
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--on-surface)" }}>
                                  {fornecedoresContratados[cat.categoria] || limparFornecedorGenerico(altAprov?.fornecedor) || "Não informado"}
                                </span>
                              )}
                            </div>

                            <div>
                              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface-variant)", display: "block", marginBottom: "2px" }}>
                                Valor Final Pago (R$)
                              </span>
                              {podeEditarAgencia ? (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={formatarMoedaBRInput(valoresContratados[cat.categoria])}
                                  onChange={(e) =>
                                    setValoresContratados((prev) => ({
                                      ...prev,
                                      [cat.categoria]: parseMoedaBRInput(e.target.value),
                                    }))
                                  }
                                  placeholder="0,00"
                                  style={{ width: "120px", padding: "5px 8px", fontSize: "13px", fontWeight: 700, borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "#ffffff" }}
                                />
                              ) : (
                                <strong style={{ fontSize: "14px", color: "var(--secondary, #00a896)" }}>
                                  {brl(valoresContratados[cat.categoria] || 0)}
                                </strong>
                              )}
                            </div>

                            <div>
                              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface-variant)", display: "block", marginBottom: "2px" }}>
                                Localizador / Nº Reserva
                              </span>
                              {podeEditarAgencia ? (
                                <input
                                  type="text"
                                  value={localizadores[cat.categoria] || ""}
                                  onChange={(e) =>
                                    setLocalizadores((prev) => ({
                                      ...prev,
                                      [cat.categoria]: e.target.value,
                                    }))
                                  }
                                  placeholder="Ex: ABC123"
                                  style={{ width: "130px", padding: "5px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "#ffffff" }}
                                />
                              ) : (
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--on-surface)" }}>
                                  {localizadores[cat.categoria] || "Não informado"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Vouchers Definitivos */}
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                              Voucher / Bilhete Definitivo
                            </span>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                              {vouchersAlt.map((doc) => (
                                <div
                                  key={doc.id}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    backgroundColor: "rgba(0, 168, 150, 0.1)",
                                    border: "1px solid rgba(0, 168, 150, 0.4)",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setDocVisualizando(doc)}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "var(--secondary, #00a896)",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: 0,
                                      fontWeight: 700,
                                      fontSize: "12px",
                                    }}
                                    title="Visualizar voucher na plataforma"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>visibility</span>
                                    <span>{doc.nome}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => abrirEmNovaAbaSegura(doc.url, doc.nome)}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "var(--on-surface-variant)",
                                      cursor: "pointer",
                                      padding: "0 2px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                    }}
                                    title="Abrir em nova aba (download / visualização externa)"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                                  </button>

                                  {podeEditarAgencia && altAprov && (
                                    <button
                                      type="button"
                                      onClick={() => removerAnexo(cat.categoria, altAprov.id, doc.id)}
                                      title="Remover este voucher"
                                      style={{
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "#ef4444",
                                        fontSize: "14px",
                                        lineHeight: 1,
                                        padding: "0 2px",
                                        fontWeight: 800,
                                      }}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}

                              {podeEditarAgencia && (
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "5px 11px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color: "var(--secondary)",
                                    backgroundColor: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    cursor: "pointer",
                                  }}
                                  title="Anexar bilhete aéreo, reserva de hotel ou voucher"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>upload_file</span>
                                  <span>{vouchersAlt.length > 0 ? "Adicionar Outro Voucher" : "Anexar Voucher"}</span>
                                  <input
                                    type="file"
                                    multiple
                                    accept="application/pdf,image/*"
                                    style={{ display: "none" }}
                                    onChange={(e) => {
                                      let altId = cat.alternativaAprovadaId || cat.alternativas.find((a) => a.selecionada)?.id || cat.alternativas[0]?.id;
                                      if (!altId) {
                                        altId = `alt-${cat.categoria.toLowerCase()}-${sol.id}-1`;
                                      }
                                      handleUploadAnexo(e, cat.categoria, altId, "VOUCHER");
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Seção 2: Painel Exclusivo do Financeiro (Alimentação / Diária) */}
            <div
              style={{
                marginTop: "24px",
                border: "1px solid rgba(217, 119, 6, 0.3)",
                borderRadius: "12px",
                padding: "18px",
                backgroundColor: "rgba(217, 119, 6, 0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#d97706" }}>
                  restaurant
                </span>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--on-surface)" }}>
                  Prestação de Contas • Alimentação & Diárias (Gestão Financeira)
                </h4>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "16px", alignItems: "center" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                    Valor Apurado Alimentação / Diária
                  </label>
                  {perfilAtivo === "FINANCEIRO" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#d97706" }}>R$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatarMoedaBRInput(diariaFinanceiro)}
                        onChange={(e) => setDiariaFinanceiro(parseMoedaBRInput(e.target.value))}
                        placeholder="0,00"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          fontSize: "14px",
                          fontWeight: 800,
                          borderRadius: "6px",
                          border: "1px solid #d97706",
                        }}
                      />
                    </div>
                  ) : (
                    <strong style={{ fontSize: "16px", color: "#d97706" }}>{brl(sol.custoAlimentacaoDiaria)}</strong>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", display: "block", marginBottom: "4px" }}>
                    Observações da Prestação de Contas (Financeiro)
                  </label>
                  {perfilAtivo === "FINANCEIRO" ? (
                    <input
                      type="text"
                      value={obsFinanceiro}
                      onChange={(e) => setObsFinanceiro(e.target.value)}
                      placeholder="Ex: RDVs auditados e recibos conferidos em conformidade"
                      style={{ width: "100%", padding: "8px 10px", fontSize: "12px", borderRadius: "6px", border: "1px solid var(--border)" }}
                    />
                  ) : (
                    <span style={{ fontSize: "12px", color: "var(--on-surface)" }}>
                      {sol.prestacaoContasObservacao || "Sem observações registradas."}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Seção 3: Trilha de Auditoria e Histórico */}
            <div style={{ marginTop: "24px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                }}
                onClick={() => setExpandirHistorico(!expandirHistorico)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--on-surface-variant)" }}>
                    history
                  </span>
                  <strong style={{ fontSize: "13px", color: "var(--on-surface)" }}>Trilha de Auditoria & Eventos ({sol.auditoria.length})</strong>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  {expandirHistorico ? "expand_less" : "expand_more"}
                </span>
              </div>

              {expandirHistorico && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                  {sol.auditoria.map((aud) => (
                    <div
                      key={aud.id}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        backgroundColor: "var(--surface-container-low)",
                        fontSize: "12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong>{aud.usuarioNome}</strong> • <span style={{ color: "var(--primary)" }}>{aud.acao}</span>
                        <div style={{ color: "var(--on-surface-variant)", marginTop: "2px" }}>{aud.detalhes}</div>
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", whiteSpace: "nowrap" }}>
                        {new Date(aud.dataHora).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rodapé de Ações Contextuais Conforme Perfil e Etapa */}
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--border, #e2e8f0)",
              backgroundColor: "var(--surface-container-low, #f8fafc)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--on-surface)",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              Fechar
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Botões do Perfil AGÊNCIA */}
              {perfilAtivo === "AGENCIA" && (
                <>
                  {(sol.status === "AGUARDANDO_COTACAO" || sol.status === "EM_COTACAO") && (
                    <>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleSalvarCotacoesAgencia(false)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--primary)",
                          backgroundColor: "transparent",
                          border: "1px solid var(--primary)",
                          cursor: "pointer",
                        }}
                      >
                        Salvar Rascunho
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleSalvarCotacoesAgencia(true)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 18px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#ffffff",
                          backgroundColor: "var(--secondary, #00a896)",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>send</span>
                        Enviar para Aprovação
                      </button>
                    </>
                  )}

                  {(sol.status === "APROVADO_AGUARDANDO_COMPRA" ||
                    sol.status === "VOUCHERS_PENDENTES" ||
                    sol.status === "VOUCHERS_ENVIADOS" ||
                    sol.status === "AGUARDANDO_PRESTACAO_CONTAS" ||
                    sol.status === "CONCLUIDO" ||
                    modoEdicaoAgencia) && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {sol.status === "APROVADO_AGUARDANDO_COMPRA" ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={handleRegistrarComprasAgencia}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 14px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "var(--primary, #0f2a4a)",
                            backgroundColor: "var(--surface, #ffffff)",
                            border: "1px solid var(--primary, #0f2a4a)",
                            cursor: "pointer",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>save</span>
                          <span>Salvar Valores &amp; Reservas</span>
                        </button>
                      ) : (
                        /* Botão Editar Logística para permitir alterações e emissão de novos vouchers */
                        <button
                          type="button"
                          onClick={() => {
                            setModoEdicaoAgencia(!modoEdicaoAgencia);
                            if (!modoEdicaoAgencia) {
                              showToast("Modo de edição da logística ATIVADO. Você pode alterar valores, localizadores e vouchers.");
                            }
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 14px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: modoEdicaoAgencia ? "#dc2626" : "var(--primary, #0f2a4a)",
                            backgroundColor: modoEdicaoAgencia ? "#fee2e2" : "var(--surface, #ffffff)",
                            border: modoEdicaoAgencia ? "1px solid #fca5a5" : "1px solid var(--border, #cbd5e1)",
                            cursor: "pointer",
                          }}
                          title="Habilita ou desabilita a edição dos campos de contratação, localizadores e anexos"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                            {modoEdicaoAgencia ? "edit_off" : "edit"}
                          </span>
                          <span>{modoEdicaoAgencia ? "Concluir Edição" : "Editar Logística"}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={abrirPreviewEmail}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--primary, #0f2a4a)",
                          backgroundColor: "var(--surface, #ffffff)",
                          border: "1px solid var(--border, #cbd5e1)",
                          cursor: "pointer",
                        }}
                        title="Pré-visualizar o formato corporativo do e-mail de voucher que chega ao viajante"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>visibility</span>
                        <span>Visualizar E-mail do Viajante</span>
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleEnviarVouchers}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 18px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#ffffff",
                          backgroundColor: "#059669",
                          border: "none",
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(5, 150, 105, 0.25)",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>send</span>
                        <span>
                          {sol.status === "VOUCHERS_ENVIADOS" ||
                          sol.status === "AGUARDANDO_PRESTACAO_CONTAS" ||
                          sol.status === "CONCLUIDO"
                            ? "Salvar & Reenviar Vouchers"
                            : "Enviar Vouchers ao Viajante"}
                        </span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Botão do Perfil LÍDER DE PROJETO (Aprovação e envio para compra) */}
              {perfilAtivo === "LIDER" && (sol.status === "AGUARDANDO_APROVACAO" || sol.status === "AGUARDANDO_REAPROVACAO" || sol.requerReaprovacao) && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAprovarLider}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 22px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#ffffff",
                    backgroundColor: "var(--primary, #0f2a4a)",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(15, 42, 74, 0.25)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>thumb_up</span>
                  {sol.requerReaprovacao ? `Aprovar Novo Orçamento (${brl(sol.totalContratado)})` : "Aprovar Escolhas & Autorizar Compra"}
                </button>
              )}

              {/* Botões do Perfil FINANCEIRO */}
              {perfilAtivo === "FINANCEIRO" && (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSalvarFinanceiro(false)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#d97706",
                      backgroundColor: "transparent",
                      border: "1px solid #d97706",
                      cursor: "pointer",
                    }}
                  >
                    Salvar Diárias
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSalvarFinanceiro(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 18px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#ffffff",
                      backgroundColor: "#059669",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>task_alt</span>
                    Concluir Prestação de Contas
                  </button>
                </>
              )}

              {/* Botões do Perfil CONSULTOR */}
              {perfilAtivo === "CONSULTOR" && (
                <>
                  {sol.vouchersRecebidosAprovadosEm ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        backgroundColor: "#ecfdf5",
                        color: "#047857",
                        border: "1px solid #a7f3d0",
                        fontSize: "12.5px",
                        fontWeight: 700,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>verified</span>
                      <span>Recebimento dos Vouchers Aprovado ({formatarDataHoraBR(sol.vouchersRecebidosAprovadosEm)})</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleAprovarRecebimentoVouchers}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "9px 22px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#ffffff",
                        backgroundColor: "#059669",
                        border: "none",
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>check_circle</span>
                      <span>Aprovar Recebimento dos Vouchers</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visualizador de Documentos Embutido */}
      {docVisualizando && (
        <DocumentPreviewModal
          documento={docVisualizando}
          onClose={() => setDocVisualizando(null)}
        />
      )}

      {/* Modal de Pré-visualização do Formato do E-mail do Viajante (Print 1 & code) */}
      {showEmailPreviewModal && emailPreviewData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "16px",
          }}
          onClick={() => setShowEmailPreviewModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "880px",
              maxHeight: "94vh",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* BEGIN: ModalHeader */}
            <div
              style={{
                padding: "16px 24px",
                backgroundColor: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    backgroundColor: "#f0fdfa",
                    border: "1px solid #ccfbf1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0d9488",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                    mail
                  </span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e293b", letterSpacing: "-0.2px" }}>
                    Formato do E-mail Enviado ao Viajante
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#64748b", fontWeight: 500 }}>
                    Simulação exata da mensagem corporativa disparada pela agência
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEmailPreviewModal(false)}
                title="Fechar"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>

            {/* BEGIN: EmailMetadataHeader */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                padding: "14px 24px",
                fontSize: "13px",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "8px", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, color: "#64748b" }}>De:</span>
                <span style={{ color: "#334155", fontWeight: 500 }}>
                  {emailPreviewData.de}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "8px", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, color: "#64748b" }}>Para:</span>
                <a
                  href={`mailto:${emailPreviewData.para}`}
                  style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
                >
                  {emailPreviewData.para}
                </a>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "8px", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, color: "#64748b" }}>Cc:</span>
                <span style={{ color: "#64748b" }}>
                  {(emailPreviewData.cc || []).join(", ")}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "8px", alignItems: "baseline", paddingTop: "2px" }}>
                <span style={{ fontWeight: 600, color: "#64748b" }}>Assunto:</span>
                <span style={{ color: "#0f172a", fontWeight: 800 }}>
                  {emailPreviewData.assunto}
                </span>
              </div>
            </div>

            {/* BEGIN: EmailBodySimulation */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px 28px",
                backgroundColor: "#ffffff",
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              }}
            >
              {/* Institutional Branding Header com a logomarca da NNÓS ao lado do nome */}
              <div
                style={{
                  borderBottom: "2px solid #059669",
                  paddingBottom: "14px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  {/* Logomarca da NNÓS ao lado do nome institucional */}
                  <img
                    src="/logo-coruja.png"
                    alt="Logomarca NNÓS"
                    style={{
                      height: "46px",
                      width: "auto",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "18px",
                        fontWeight: 900,
                        color: "#002B49",
                        letterSpacing: "-0.3px",
                        textTransform: "uppercase",
                        lineHeight: 1.2,
                      }}
                    >
                      NNÓS CONSULTORIA E TREINAMENTO
                    </h2>
                    <p
                      style={{
                        margin: "3px 0 0 0",
                        fontSize: "12px",
                        fontWeight: 800,
                        color: "#0d9488",
                        letterSpacing: "0.8px",
                        textTransform: "uppercase",
                      }}
                    >
                      GESTÃO DE VIAGENS & LOGÍSTICA CORPORATIVA
                    </p>
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 12px",
                      borderRadius: "9999px",
                      fontSize: "12px",
                      fontWeight: 700,
                      backgroundColor: "#ecfdf5",
                      color: "#047857",
                      border: "1px solid #a7f3d0",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "#10b981",
                        marginRight: "6px",
                      }}
                    />
                    Vouchers Confirmados
                  </span>
                </div>
              </div>

              {/* Saudação e Introdução */}
              <div style={{ marginTop: "24px" }}>
                <p style={{ margin: "0 0 10px 0", fontSize: "15px", color: "#1e293b" }}>
                  Olá, <strong style={{ color: "#0f172a", fontWeight: 800 }}>{emailPreviewData.passageiro}</strong>,
                </p>
                <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: 1.6 }}>
                  Sua logística para a atividade <strong style={{ color: "#0f172a" }}>{emailPreviewData.atividade}</strong> do projeto <strong style={{ color: "#0f172a" }}>{emailPreviewData.projeto}</strong> foi contratada com sucesso pela agência <strong style={{ color: "#0f172a" }}>{sol.agenciaNome || "FÁTIMA"}</strong>. Seguem abaixo os dados e localizadores definitivos das suas reservas:
                </p>
              </div>

              {/* Resumo da Atividade */}
              <div
                style={{
                  marginTop: "20px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  border: "1px solid #e2e8f0",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                }}
              >
                <div>
                  <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Destino da Atividade:
                  </span>
                  <span style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                    {emailPreviewData.destino || "SOROCABA-SP"}
                  </span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Período da Viagem:
                  </span>
                  <span style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                    {emailPreviewData.periodo}
                  </span>
                </div>
              </div>

              {/* Cards de Serviços e Vouchers */}
              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Voo / Passagem Aérea */}
                {emailPreviewData.aereo && (
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px 20px",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e293b", fontWeight: 700, fontSize: "14px" }}>
                        <span className="material-symbols-outlined" style={{ color: "#3b82f6", fontSize: "20px" }}>
                          flight
                        </span>
                        <span>Passagem Aérea ({emailPreviewData.aereo.fornecedor})</span>
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 700,
                          backgroundColor: "#ecfdf5",
                          color: "#047857",
                          border: "1px solid #a7f3d0",
                        }}
                      >
                        Localizador: <span style={{ marginLeft: "4px", letterSpacing: "0.5px", textTransform: "uppercase" }}>{emailPreviewData.aereo.localizador}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: "13px", color: "#475569", paddingLeft: "14px", borderLeft: "2px solid #e2e8f0", marginLeft: "6px", marginTop: "8px" }}>
                      <p style={{ margin: 0, fontWeight: 600, color: "#334155" }}>
                        {emailPreviewData.aereo.horarios}
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                        Emissão efetuada com sucesso. Apresente o documento com foto no check-in digital ou aeroporto.
                      </p>
                    </div>
                  </div>
                )}

                {/* Hotel / Hospedagem */}
                {emailPreviewData.hotel && (
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px 20px",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e293b", fontWeight: 700, fontSize: "14px" }}>
                        <span className="material-symbols-outlined" style={{ color: "#f43f5e", fontSize: "20px" }}>
                          hotel
                        </span>
                        <span>Hospedagem / Hotel ({emailPreviewData.hotel.hotel})</span>
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 700,
                          backgroundColor: "#ecfdf5",
                          color: "#047857",
                          border: "1px solid #a7f3d0",
                        }}
                      >
                        Reserva: <span style={{ marginLeft: "4px", letterSpacing: "0.5px", textTransform: "uppercase" }}>{emailPreviewData.hotel.localizador}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: "13px", color: "#475569", paddingLeft: "14px", borderLeft: "2px solid #e2e8f0", marginLeft: "6px", marginTop: "8px" }}>
                      <p style={{ margin: 0, fontWeight: 600, color: "#334155" }}>
                        {emailPreviewData.hotel.detalhes}
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                        Diárias confirmadas. Check-in a partir das 14h / Check-out até 12h.
                      </p>
                    </div>
                  </div>
                )}

                {/* Veículo / Translado */}
                {emailPreviewData.carro && (
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px 20px",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e293b", fontWeight: 700, fontSize: "14px" }}>
                        <span className="material-symbols-outlined" style={{ color: "#0ea5e9", fontSize: "20px" }}>
                          directions_car
                        </span>
                        <span>Locação / Translado ({emailPreviewData.carro.locadora})</span>
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 700,
                          backgroundColor: "#ecfdf5",
                          color: "#047857",
                          border: "1px solid #a7f3d0",
                        }}
                      >
                        Reserva: <span style={{ marginLeft: "4px", letterSpacing: "0.5px", textTransform: "uppercase" }}>{emailPreviewData.carro.localizador}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: "13px", color: "#475569", paddingLeft: "14px", borderLeft: "2px solid #e2e8f0", marginLeft: "6px", marginTop: "8px" }}>
                      <p style={{ margin: 0, fontWeight: 600, color: "#334155" }}>
                        {emailPreviewData.carro.detalhes}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Anexos de Vouchers e Comprovantes */}
              {emailPreviewData.anexos && emailPreviewData.anexos.length > 0 && (
                <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid #e2e8f0" }}>
                  <h4
                    style={{
                      margin: "0 0 12px 0",
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#64748b" }}>
                      attach_file
                    </span>
                    <span>Vouchers e Comprovantes em Anexo ({emailPreviewData.anexos.length}):</span>
                  </h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {emailPreviewData.anexos.map((anx: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(13, 148, 136, 0.08)",
                          border: "1px solid rgba(13, 148, 136, 0.3)",
                          color: "#0f766e",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setDocVisualizando({
                              id: anx.id || `doc-${idx}`,
                              nome: anx.nome,
                              tipo: "VOUCHER",
                              url: anx.url || "",
                              mimeType: anx.mimeType || "application/pdf",
                              tamanhoFormatado: "Voucher",
                              criadoEm: new Date().toISOString(),
                            })
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#0f766e",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: 0,
                            fontWeight: 700,
                            fontSize: "12px",
                          }}
                          title="Visualizar anexo na plataforma"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0d9488" }}>
                            attach_file
                          </span>
                          <span>
                            {anx.nome}{" "}
                            {anx.categoria && (
                              <span style={{ fontWeight: 400, opacity: 0.85 }}>({anx.categoria})</span>
                            )}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => abrirEmNovaAbaSegura(anx.url, anx.nome)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#0d9488",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "0 2px",
                          }}
                          title="Abrir em nova aba (download)"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orientações para Prestação de Contas & Diárias */}
              <div
                style={{
                  marginTop: "24px",
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "12px",
                  padding: "18px 20px",
                  fontSize: "12.5px",
                  color: "#92400e",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#b45309" }}>
                    assignment_late
                  </span>
                  <strong style={{ fontSize: "13.5px", color: "#78350f" }}>
                    Orientações para Prestação de Contas
                  </strong>
                </div>

                <div
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.12)",
                    borderLeft: "3px solid #d97706",
                    padding: "8px 12px",
                    borderRadius: "0 6px 6px 0",
                    margin: "0 0 14px 0",
                    fontSize: "12px",
                    color: "#854d0e",
                  }}
                >
                  <strong style={{ color: "#78350f" }}>Atenção:</strong> O viajante precisa verificar previamente para qual empresa estará prestando o serviço/viagem. <strong>Se a empresa contratante não possuir política de viagem própria, a diretriz oficial que será obrigatoriamente utilizada é a da NNÓS Consultoria.</strong>
                </div>

                {/* Bloco de Miniaturas das Políticas de Viagem (Clique para abrir o PDF) */}
                <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px dashed rgba(217, 119, 6, 0.35)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "#78350f", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#d97706" }}>menu_book</span>
                      Políticas de Viagem &amp; Reembolso (Clique na miniatura para abrir o PDF):
                    </span>
                    <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#92400e" }}>
                      4 Documentos Oficiais
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {POLITICAS_VIAGEM.map((pol) => (
                      <a
                        key={pol.id}
                        href={pol.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          textDecoration: "none",
                          backgroundColor: "#ffffff",
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          padding: "8px",
                          display: "flex",
                          flexDirection: "column",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#0d9488";
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.12)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#e2e8f0";
                          e.currentTarget.style.transform = "none";
                          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
                        }}
                        title={`Clique para abrir o PDF da ${pol.titulo}`}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: "140px",
                            borderRadius: "6px",
                            overflow: "hidden",
                            backgroundColor: "#f1f5f9",
                            position: "relative",
                            border: "1px solid #e2e8f0",
                            marginBottom: "8px",
                          }}
                        >
                          <img
                            src={pol.miniaturaUrl}
                            alt={pol.titulo}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              objectPosition: "top center",
                              display: "block",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              bottom: "4px",
                              right: "4px",
                              backgroundColor: "rgba(15, 23, 42, 0.85)",
                              color: "#ffffff",
                              borderRadius: "4px",
                              padding: "2px 5px",
                              fontSize: "9px",
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>picture_as_pdf</span>
                            PDF
                          </div>
                        </div>

                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                          <div>
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "9px",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                color: pol.corTag,
                                marginBottom: "2px",
                              }}
                            >
                              {pol.tag}
                            </span>
                            <div
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "#0f172a",
                                lineHeight: "1.3",
                                marginBottom: "4px",
                              }}
                            >
                              {pol.empresa}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              color: "#0d9488",
                              fontSize: "10.5px",
                              fontWeight: 700,
                              marginTop: "4px",
                            }}
                          >
                            <span>Abrir PDF</span>
                            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>open_in_new</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rodapé da mensagem */}
              <div style={{ marginTop: "20px", borderTop: "1px solid #f1f5f9", paddingTop: "14px", fontSize: "11px", color: "#94a3b8", textAlign: "center" }}>
                Mensagem gerada pelo Sistema de Gestão Financeira de Projetos • NNÓS Consultoria e Treinamento
              </div>
            </div>

            {/* BEGIN: ModalFooter */}
            <div
              style={{
                padding: "14px 24px",
                backgroundColor: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#94a3b8" }}>
                  info
                </span>
                <span>
                  Destinatário de teste configurado: <strong style={{ color: "#1e293b" }}>{emailPreviewData.para}</strong>
                </span>
              </div>

              <div style={{ display: "inline-flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowEmailPreviewModal(false)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  Fechar Visualização
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setShowEmailPreviewModal(false);
                    handleEnviarVouchers();
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 20px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#ffffff",
                    backgroundColor: "#059669",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>send</span>
                  <span>Disparar E-mail ao Viajante</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
