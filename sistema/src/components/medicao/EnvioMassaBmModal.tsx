"use client";

import React, { useState, useEffect, useMemo } from "react";
import ModernDropdown from "@/components/ModernDropdown";
import { BoletimMedicaoItem } from "@/components/BmExportPdfSheet";

interface EnvioMassaBmModalProps {
  onClose: () => void;
  onConcluido: () => void;
  showToast: (msg: string) => void;
  bmsListaExistente: BoletimMedicaoItem[];
}

export default function EnvioMassaBmModal({
  onClose,
  onConcluido,
  showToast,
  bmsListaExistente,
}: EnvioMassaBmModalProps) {
  const dataHoje = new Date();
  const mesHoje = dataHoje.getMonth() + 1;
  const anoHoje = dataHoje.getFullYear();

  const [ano, setAno] = useState(String(anoHoje >= 2026 ? anoHoje : 2026));
  const [mesNum, setMesNum] = useState(mesHoje);
  const [tipoMedicao, setTipoMedicao] = useState<"1ª Quinzena" | "2ª Quinzena" | "Integral">("1ª Quinzena");
  const [dataCorte, setDataCorte] = useState(`20/${String(mesHoje).padStart(2, "0")}/${anoHoje >= 2026 ? anoHoje : 2026}`);

  const [carregando, setCarregando] = useState(false);
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [selecionadosIds, setSelecionadosIds] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [progressoEnvio, setProgressoEnvio] = useState<{ atual: number; total: number; consultor?: string } | null>(null);

  const MESES = [
    { num: 1, nome: "Janeiro" },
    { num: 2, nome: "Fevereiro" },
    { num: 3, nome: "Março" },
    { num: 4, nome: "Abril" },
    { num: 5, nome: "Maio" },
    { num: 6, nome: "Junho" },
    { num: 7, nome: "Julho" },
    { num: 8, nome: "Agosto" },
    { num: 9, nome: "Setembro" },
    { num: 10, nome: "Outubro" },
    { num: 11, nome: "Novembro" },
    { num: 12, nome: "Dezembro" },
  ];

  // Atualizar data de corte ao mudar o mês ou ano
  useEffect(() => {
    setDataCorte(`20/${String(mesNum).padStart(2, "0")}/${ano}`);
  }, [mesNum, ano]);

  // Carregar lista de consultores e atividades elegíveis
  const carregarCandidatos = async () => {
    try {
      setCarregando(true);
      const url = `/api/medicao/massa?ano=${ano}&mes=${mesNum}&tipoMedicao=${encodeURIComponent(tipoMedicao)}&dataCorte=${encodeURIComponent(dataCorte)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (Array.isArray(data.candidatos)) {
        setCandidatos(data.candidatos);
        // Por padrão, seleciona todos os aptos que NÃO possuem BM já gerado
        const novosSel = new Set<string>();
        data.candidatos.forEach((c: any) => {
          if (!c.bmExistente && c.aptoEnvio) {
            novosSel.add(c.id);
          }
        });
        setSelecionadosIds(novosSel);
      } else {
        setCandidatos([]);
        setSelecionadosIds(new Set());
      }
    } catch (err: any) {
      console.error("Erro ao carregar candidatos:", err);
      showToast(`Erro ao carregar candidatos: ${err.message || err}`);
      setCandidatos([]);
      setSelecionadosIds(new Set());
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarCandidatos();
  }, [ano, mesNum, tipoMedicao, dataCorte]);

  // Contadores e Totais dos Selecionados
  const resumo = useMemo(() => {
    const itens = candidatos.filter((c) => selecionadosIds.has(c.id));
    const totalHoras = itens.reduce((acc, c) => acc + (c.totalHoras || 0), 0);
    const totalValor = itens.reduce((acc, c) => acc + (c.valorTotal || 0), 0);
    return {
      qtd: itens.length,
      totalHoras,
      totalValor,
    };
  }, [candidatos, selecionadosIds]);

  const alternarTodos = () => {
    if (selecionadosIds.size === candidatos.length) {
      setSelecionadosIds(new Set());
    } else {
      const todos = new Set(candidatos.map((c) => c.id));
      setSelecionadosIds(todos);
    }
  };

  const alternarIndividual = (id: string) => {
    setSelecionadosIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 🧪 E-mail para Teste de Validação do Fluxo Zoho Sign solicitado pelo usuário
  const EMAIL_TESTE_ZOHO = "leonardo.campos@nnos.com.br";

  // Disparo em Massa
  const handleDispararMassa = async () => {
    const itensParaEnviar = candidatos.filter((c) => selecionadosIds.has(c.id));
    if (itensParaEnviar.length === 0) {
      showToast("⚠️ Nenhum consultor selecionado para envio.");
      return;
    }

    console.log(`🚀 [BM Massa Teste] Disparando ${itensParaEnviar.length} BMs para teste Zoho Sign (destinatário: ${EMAIL_TESTE_ZOHO})...`);

    try {
      setEnviando(true);
      const dataAgora = new Date();
      const dataHoraStr = `${dataAgora.toLocaleDateString("pt-BR")} às ${dataAgora.toLocaleTimeString("pt-BR")}`;
      let bmsParaAdicionar: BoletimMedicaoItem[] = [];

      for (let i = 0; i < itensParaEnviar.length; i++) {
        const item = itensParaEnviar[i];
        setProgressoEnvio({
          atual: i + 1,
          total: itensParaEnviar.length,
          consultor: item.consultorNome,
        });

        const codBm = item.codigoSugerido;

        // Disparar via Zoho Sign utilizando o e-mail de teste em todos os signatários/aprovadores
        let zohoDocId: string | undefined;
        let zohoReqId: string | undefined;

        // Configuração de Teste Temporária:
        const consultorEmailFinal = EMAIL_TESTE_ZOHO;
        const liderEmailFinal = EMAIL_TESTE_ZOHO;
        const responsavelEmailFinal = EMAIL_TESTE_ZOHO;
        const emailsCopiaFinal = EMAIL_TESTE_ZOHO;

        const liderNomeFinal = `${item.liderNome || "Beatriz Picorelli"} (Líder - Teste)`;
        const consultorNomeFinal = `${item.consultorNome} (Prestador - Teste)`;
        const responsavelNomeFinal = "Marcelo Lara da Silva (Coordenação - Teste)";

        try {
          console.log(`📤 Disparando Zoho Sign para BM ${codBm} (${item.consultorNome})...`);
          const respZoho = await fetch("/api/medicao/enviar-zoho", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              codigoBm: codBm,
              consultorNome: consultorNomeFinal,
              consultorRazaoSocial: item.consultorRazaoSocial,
              consultorCnpj: item.consultorCnpj,
              consultorEndereco: item.consultorEndereco,
              consultorEmail: consultorEmailFinal,
              contrato: item.contrato,
              liderNome: liderNomeFinal,
              liderEmail: liderEmailFinal,
              responsavelNome: responsavelNomeFinal,
              responsavelEmail: responsavelEmailFinal,
              emailsCopia: emailsCopiaFinal,
              mesReferencia: item.mesReferenciaFormatado,
              periodoStr: `${item.mesReferenciaFormatado} - ${item.periodoRotulo}`,
              totalHoras: item.totalHoras,
              mediaHora: item.mediaHora,
              valorTotal: item.valorTotal,
              atividades: item.atividades,
            }),
          });

          if (respZoho.ok) {
            const zData = await respZoho.json();
            zohoReqId = zData.requestId;
            zohoDocId = zData.documentId;
            console.log(`✅ BM ${codBm} enviado ao Zoho Sign com sucesso:`, zData);
          } else {
            const erroTxt = await respZoho.text();
            console.warn(`Aviso na API Zoho Sign para o BM ${codBm}:`, respZoho.status, erroTxt);
            showToast(`⚠️ BM ${codBm}: Aviso Zoho (${respZoho.status}). Registrando BM localmente...`);
          }
        } catch (zErr: any) {
          console.error(`Falha na API Zoho Sign para o BM ${codBm}:`, zErr);
          showToast(`⚠️ BM ${codBm}: Conexão Zoho (${zErr.message || zErr})`);
        }

        const novoBmItem: BoletimMedicaoItem = {
          id: `bm-${codBm}-${Date.now()}`,
          codigo: codBm,
          consultorNome: item.consultorNome,
          consultorRazaoSocial: item.consultorRazaoSocial,
          consultorCnpj: item.consultorCnpj,
          consultorEmail: consultorEmailFinal,
          consultorEndereco: item.consultorEndereco,
          contrato: item.contrato,
          mesReferencia: item.mesReferenciaFormatado,
          periodoTipo: item.periodoTipo || tipoMedicao,
          dataCorte: (item.periodoTipo || tipoMedicao) !== "Integral" ? dataCorte : "-",
          totalHoras: item.totalHoras,
          valorTotal: item.valorTotal,
          mediaHora: item.mediaHora,
          status: "Pendente de Assinatura",
          zohoRequestId: zohoReqId,
          dataEnvio: dataHoraStr,
          liderProjetoNome: liderNomeFinal,
          liderProjetoEmail: liderEmailFinal,
          responsavelNnosNome: responsavelNomeFinal,
          responsavelNnosEmail: responsavelEmailFinal,
          atividades: item.atividades,
          logs: [
            {
              signatario: liderNomeFinal,
              papel: "Aprovador Técnico (Líder)",
              email: liderEmailFinal,
              status: "Pendente",
              detalhe: "Notificação disparada por e-mail (Teste de Fluxo)",
              dataHora: dataHoraStr,
            },
            {
              signatario: consultorNomeFinal,
              papel: "Prestador de Serviços",
              email: consultorEmailFinal,
              status: "Pendente",
              detalhe: zohoDocId ? `Zoho Sign ID: ${zohoDocId}` : "Notificação disparada por e-mail (Teste de Fluxo)",
              dataHora: dataHoraStr,
            },
            {
              signatario: responsavelNomeFinal,
              papel: "Responsável NNÓS (Coordenação Geral)",
              email: responsavelEmailFinal,
              status: "Pendente",
              detalhe: "Notificação disparada por e-mail (Teste de Fluxo)",
              dataHora: dataHoraStr,
            },
          ],
        };

        bmsParaAdicionar.push(novoBmItem);
      }

      // Persistir todos os novos BMs no Supabase e base local
      const listaFinalBms = [...bmsParaAdicionar, ...bmsListaExistente];
      const salvarRes = await fetch("/api/medicao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listaFinalBms),
      });

      if (!salvarRes.ok) {
        console.warn("Aviso ao salvar BMs no banco:", salvarRes.status);
      }

      // Sincronizar localStorage
      try {
        localStorage.setItem("nnos_bms_2026_v5", JSON.stringify(listaFinalBms));
      } catch {}

      showToast(`🎉 Sucesso! ${bmsParaAdicionar.length} BMs foram gerados e enviados para o seu e-mail (${EMAIL_TESTE_ZOHO})!`);
      onConcluido();
      onClose();
    } catch (err: any) {
      console.error("Erro no envio em massa:", err);
      showToast(`Erro ao disparar lote: ${err.message || err}`);
    } finally {
      setEnviando(false);
      setProgressoEnvio(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        style={{ maxWidth: "980px", maxHeight: "94vh", width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal com Design System Moderno */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "rgba(13, 148, 136, 0.12)",
                color: "#0d9488",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                forward_to_inbox
              </span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--primary)" }}>
                Envio de Boletins de Medição (BM) em Massa
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                Filtre por competência e ciclo para disparar em lote para o fluxo de assinaturas
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            title="Fechar modal"
            disabled={enviando}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
          {/* Painel de Filtros e Seletores Modernos */}
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "12px",
              backgroundColor: "var(--surface-container-low, #f8fafc)",
              border: "1px solid var(--border)",
              display: "grid",
              gridTemplateColumns: tipoMedicao !== "Integral" ? "120px 180px 180px 180px" : "120px 200px 200px",
              gap: "14px",
              alignItems: "flex-end",
              marginBottom: "18px",
            }}
          >
            <div className="form-field">
              <label>Ano</label>
              <ModernDropdown
                value={ano}
                options={[
                  { value: "2026", label: "2026" },
                  { value: "2027", label: "2027" },
                ]}
                onChange={(v) => setAno(String(v))}
              />
            </div>

            <div className="form-field">
              <label>Mês de Referência</label>
              <ModernDropdown
                value={String(mesNum)}
                options={MESES.map((m) => ({ value: String(m.num), label: m.nome }))}
                onChange={(v) => setMesNum(Number(v))}
              />
            </div>

            <div className="form-field">
              <label>Tipo de Medição *</label>
              <ModernDropdown
                value={tipoMedicao}
                options={[
                  { value: "1ª Quinzena", label: "1ª Quinzena" },
                  { value: "2ª Quinzena", label: "2ª Quinzena" },
                  { value: "Integral", label: "Integral" },
                ]}
                onChange={(v) => setTipoMedicao(v as any)}
              />
            </div>

            {tipoMedicao !== "Integral" && (
              <div className="form-field">
                <label>Data de Corte *</label>
                <input
                  type="text"
                  value={dataCorte}
                  onChange={(e) => setDataCorte(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    backgroundColor: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                />
              </div>
            )}
          </div>

          {/* Banner Indicativo de Modo de Teste Zoho Sign */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              backgroundColor: "#f0f9ff",
              border: "1px solid #bae6fd",
              color: "#0369a1",
              fontSize: "12.5px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "22px", color: "#0284c7" }}>
              science
            </span>
            <div style={{ flex: 1, lineHeight: "1.4" }}>
              <strong>Modo de Teste Zoho Sign Ativo:</strong> Todos os 3 signatários (Aprovador Técnico, Prestador e Coordenação Geral) receberão os e-mails e links de assinatura diretamente em <strong>{EMAIL_TESTE_ZOHO}</strong> para validação de ponta a ponta do fluxo.
            </div>
          </div>

          {/* Cards de Resumo Consolidado */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                backgroundColor: "rgba(13, 148, 136, 0.08)",
                border: "1px solid rgba(13, 148, 136, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span className="material-symbols-outlined" style={{ color: "#0d9488", fontSize: "28px" }}>
                people
              </span>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f766e", textTransform: "uppercase" }}>
                  Consultores Selecionados
                </span>
                <h4 style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: 800, color: "#115e59" }}>
                  {resumo.qtd} <span style={{ fontSize: "12px", fontWeight: 500, color: "#64748b" }}>de {candidatos.length} elegíveis</span>
                </h4>
              </div>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                backgroundColor: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span className="material-symbols-outlined" style={{ color: "#2563eb", fontSize: "28px" }}>
                schedule
              </span>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>
                  Horas Totais no Ciclo
                </span>
                <h4 style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: 800, color: "#1e40af" }}>
                  {resumo.totalHoras.toFixed(1)} h
                </h4>
              </div>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span className="material-symbols-outlined" style={{ color: "#059669", fontSize: "28px" }}>
                payments
              </span>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>
                  Valor Consolidado
                </span>
                <h4 style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: 800, color: "#065f46" }}>
                  {resumo.totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </h4>
              </div>
            </div>
          </div>

          {/* Tabela de Candidatos Elegíveis */}
          <div
            style={{
              borderRadius: "10px",
              border: "1px solid var(--border)",
              overflow: "hidden",
              backgroundColor: "#ffffff",
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                backgroundColor: "var(--surface-container-low, #f8fafc)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12.5px", fontWeight: 700, color: "var(--primary)" }}>
                <input
                  type="checkbox"
                  checked={candidatos.length > 0 && selecionadosIds.size === candidatos.length}
                  onChange={alternarTodos}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <span>Selecionar Todos ({candidatos.length})</span>
              </label>

              <span style={{ fontSize: "11.5px", color: "var(--on-surface-variant)" }}>
                {tipoMedicao === "1ª Quinzena"
                  ? "Exibindo consultores com tag Quinzenal e atividades até a data de corte"
                  : tipoMedicao === "2ª Quinzena"
                  ? "Exibindo consultores com tag Quinzenal e atividades da 2ª quinzena"
                  : "Exibindo consultores com tag Integral e atividades de todo o mês"}
              </span>
            </div>

            {carregando ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--on-surface-variant)", fontSize: "13px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "24px", animation: "spin 1s linear infinite" }}>
                  sync
                </span>
                <p style={{ margin: "8px 0 0 0" }}>Buscando atividades e consultores elegíveis...</p>
              </div>
            ) : candidatos.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--on-surface-variant)", fontSize: "13px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#94a3b8" }}>
                  inbox
                </span>
                <p style={{ margin: "8px 0 0 0", fontWeight: 600 }}>Nenhum consultor encontrado para este ciclo e competência.</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "#64748b" }}>
                  Verifique se os lançamentos foram lançados com valores na base de Projetos ou se o tipo de medição do consultor está correto na Ficha.
                </p>
              </div>
            ) : (
              <div style={{ maxHeight: "380px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "#f8fafc", color: "var(--on-surface-variant)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      <th style={{ width: "40px", padding: "10px" }}></th>
                      <th style={{ padding: "10px", textAlign: "left" }}>Código</th>
                      <th style={{ padding: "10px", textAlign: "left" }}>Consultor / Prestador</th>
                      <th style={{ padding: "10px", textAlign: "center" }}>Tag Medição</th>
                      <th style={{ padding: "10px", textAlign: "left" }}>Escopo / Ciclo</th>
                      <th style={{ padding: "10px", textAlign: "right" }}>Horas</th>
                      <th style={{ padding: "10px", textAlign: "right" }}>Valor Total</th>
                      <th style={{ padding: "10px", textAlign: "center" }}>Status Prévio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatos.map((c) => {
                      const sel = selecionadosIds.has(c.id);
                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            backgroundColor: sel ? "rgba(13, 148, 136, 0.04)" : "#ffffff",
                            transition: "background-color 0.1s ease",
                          }}
                        >
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={sel}
                              onChange={() => alternarIndividual(c.id)}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                          </td>
                          <td style={{ padding: "10px", fontWeight: 800, color: "var(--primary)" }}>
                            {c.codigoSugerido}
                          </td>
                          <td style={{ padding: "10px" }}>
                            <strong style={{ color: "var(--on-surface)", display: "block" }}>{c.consultorNome}</strong>
                            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                              {c.consultorCnpj ? `CNPJ: ${c.consultorCnpj}` : c.consultorEmail || "Sem dados PJ"}
                            </span>
                          </td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 800,
                                padding: "2px 7px",
                                borderRadius: "4px",
                                backgroundColor: c.tagMedicao === "INTEGRAL" ? "#f3e8ff" : "#e0f2fe",
                                color: c.tagMedicao === "INTEGRAL" ? "#7e22ce" : "#0369a1",
                                border: c.tagMedicao === "INTEGRAL" ? "1px solid #d8b4fe" : "1px solid #bae6fd",
                              }}
                            >
                              {c.tagMedicao}
                            </span>
                          </td>
                          <td style={{ padding: "10px" }}>
                            <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#334155" }}>
                              {c.periodoRotulo}
                            </span>
                            <span style={{ display: "block", fontSize: "10.5px", color: "#64748b" }}>
                              {c.atividades.length} atividade(s) apurada(s)
                            </span>
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "var(--primary)" }}>
                            {c.totalHoras.toFixed(1)} h
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                            {c.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            {c.bmExistente ? (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  backgroundColor: "#fef3c7",
                                  color: "#b45309",
                                  border: "1px solid #fde68a",
                                }}
                                title={`Já emitido: BM ${c.bmExistenteCodigo} (${c.bmExistenteStatus})`}
                              >
                                BM {c.bmExistenteCodigo}
                              </span>
                            ) : c.aptoEnvio ? (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  backgroundColor: "#ecfdf5",
                                  color: "#047857",
                                  border: "1px solid #a7f3d0",
                                }}
                              >
                                Pronto p/ Envio
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  backgroundColor: "#fee2e2",
                                  color: "#dc2626",
                                  border: "1px solid #fca5a5",
                                }}
                              >
                                E-mail Ausente
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Barra de Progresso Durante o Envio */}
          {enviando && progressoEnvio && (
            <div
              style={{
                marginTop: "16px",
                padding: "14px 18px",
                borderRadius: "10px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 700, color: "#166534" }}>
                <span>Disparando BM {progressoEnvio.atual} de {progressoEnvio.total} ({progressoEnvio.consultor})...</span>
                <span>{Math.round((progressoEnvio.atual / progressoEnvio.total) * 100)}%</span>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#dcfce7", borderRadius: "4px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(progressoEnvio.atual / progressoEnvio.total) * 100}%`,
                    height: "100%",
                    backgroundColor: "#16a34a",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer do Modal */}
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <div style={{ fontSize: "12px", color: "var(--on-surface-variant)" }}>
            <strong>{resumo.qtd}</strong> de {candidatos.length} consultores selecionados
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDispararMassa}
              disabled={enviando || resumo.qtd === 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "9px 24px",
                borderRadius: "8px",
                backgroundColor: "#0d9488",
                color: "#ffffff",
                border: "none",
                fontSize: "13px",
                fontWeight: 700,
                cursor: enviando || resumo.qtd === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(13, 148, 136, 0.3)",
                opacity: enviando || resumo.qtd === 0 ? 0.6 : 1,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                {enviando ? "sync" : "send"}
              </span>
              <span>
                {enviando
                  ? "Processando e Disparando..."
                  : `Gerar e Disparar ${resumo.qtd} BMs (Teste Zoho)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
