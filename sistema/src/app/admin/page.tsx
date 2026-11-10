"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import UserProfileHeader from "@/components/UserProfileHeader";
import ModernDropdown from "@/components/ModernDropdown";
import perfisIniciais from "@/lib/perfis-acesso.json";
import { usePerfilAcesso } from "@/contexts/PerfilAcessoContext";
import GestaoUsuariosELogs from "@/components/admin/GestaoUsuariosELogs";
import ModuloHomologacaoConvites from "@/components/admin/ModuloHomologacaoConvites";

type AbaAdmin =
  | "CONFIGURAR_PERFIL"
  | "MATRIZ_GERAL"
  | "USUARIOS"
  | "GESTAO_USUARIOS"
  | "LOGS_ACESSO"
  | "HOMOLOGACAO";

const REGRAS_SEGURANCA_META: { chave: string; titulo: string; descricao: string; icone: string }[] = [
  {
    chave: "verFaturamentoCliente",
    titulo: "Visualizar Faturamento ao Cliente (Coluna Faturar)",
    descricao: "Permite ver valores cobrados dos clientes (CNH, Iveco, Stellantis, Porsche). Desmarcado para Parceiros e Agência.",
    icone: "visibility",
  },
  {
    chave: "verMargemImpostos",
    titulo: "Visualizar Impostos, Rateio Interno e Margem Líquida",
    descricao: "Libera indicadores de rentabilidade, impostos retidos e DRE de projetos.",
    icone: "Query_stats",
  },
  {
    chave: "verDadosBancarios",
    titulo: "Visualizar Dados Bancários, PIX e Contratos PJ de Terceiros",
    descricao: "Permite consultar dados sensíveis de pagamento no cadastro de Pessoas.",
    icone: "account_balance_wallet",
  },
  {
    chave: "aprovarCotacoesViagem",
    titulo: "Aprovar / Recusar Cotações de Viagens & Logística",
    descricao: "Habilita o botão de aprovação técnica na Matriz de Cotações de aéreo, hotel e locação.",
    icone: "flight_takeoff",
  },
  {
    chave: "homologarBmFinanceiro",
    titulo: "Homologar BMs & Liberar para Faturamento / Pagamento",
    descricao: "Permite validar Notas Fiscais recebidas e liberar lotes no Contas a Pagar.",
    icone: "verified",
  },
  {
    chave: "dispararZohoSign",
    titulo: "Gerar BMs em Massa e Disparar Assinatura no Zoho Sign",
    descricao: "Habilita o envio de documentos oficiais para coleta de assinatura eletrônica.",
    icone: "draw",
  },
  {
    chave: "restringirAoProprioEscopo",
    titulo: "Restringir Dados ao Próprio Escopo (Carteira ou Usuário Logado)",
    descricao: "Filtra automaticamente projetos, viagens e BMs apenas para a carteira do Líder ou do próprio Consultor.",
    icone: "filter_alt",
  },
  {
    chave: "gerenciarPermissoesPerfis",
    titulo: "Gerenciar Perfis e Matriz de Controle de Acesso (RBAC)",
    descricao: "Permite alterar permissões no Painel de Administrador.",
    icone: "admin_panel_settings",
  },
];

export default function AdminPage() {
  const router = useRouter();
  const { ativarPerfil } = usePerfilAcesso();
  const [perfis, setPerfis] = useState<any[]>(perfisIniciais as any[]);
  const [perfilAtivoId, setPerfilAtivoId] = useState<string>("LIDER");
  const [abaAtiva, setAbaAtiva] = useState<AbaAdmin>("CONFIGURAR_PERFIL");
  const [pessoasDisponiveis, setPessoasDisponiveis] = useState<any[]>([]);
  const [pessoaParaAdicionar, setPessoaParaAdicionar] = useState<string>("");
  const [salvando, setSalvando] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch("/api/admin/perfis");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.perfis) && data.perfis.length > 0) {
            setPerfis(data.perfis);
          }
          if (Array.isArray(data.pessoasDisponiveis)) {
            setPessoasDisponiveis(data.pessoasDisponiveis);
          }
        }
      } catch (e) {
        console.warn("Usando base local de perfis:", e);
      }
    }
    carregar();
  }, []);

  const perfilAtual = useMemo(
    () => perfis.find((p) => p.id === perfilAtivoId) || perfis[0],
    [perfis, perfilAtivoId]
  );

  const handleToggleModulo = (perfilId: string, moduloId: string) => {
    setPerfis((prev) =>
      prev.map((p) => {
        if (p.id !== perfilId) return p;
        return {
          ...p,
          modulos: p.modulos.map((m: any) => {
            if (m.id !== moduloId) return m;
            const novoVisivel = !m.visivel;
            return {
              ...m,
              visivel: novoVisivel,
              nivel: novoVisivel ? (m.nivel === "BLOQUEADO" ? "VISUALIZAR" : m.nivel) : "BLOQUEADO",
            };
          }),
        };
      })
    );
  };

  const handleAlterarNivelModulo = (perfilId: string, moduloId: string, novoNivel: string) => {
    setPerfis((prev) =>
      prev.map((p) => {
        if (p.id !== perfilId) return p;
        return {
          ...p,
          modulos: p.modulos.map((m: any) => {
            if (m.id !== moduloId) return m;
            return {
              ...m,
              nivel: novoNivel,
              visivel: novoNivel !== "BLOQUEADO",
            };
          }),
        };
      })
    );
  };

  const handleToggleRegra = (perfilId: string, chaveRegra: string) => {
    setPerfis((prev) =>
      prev.map((p) => {
        if (p.id !== perfilId) return p;
        return {
          ...p,
          regrasSeguranca: {
            ...(p.regrasSeguranca || {}),
            [chaveRegra]: !p.regrasSeguranca?.[chaveRegra],
          },
        };
      })
    );
  };

  const handleAlterarRotaPadrao = (perfilId: string, novaRota: string) => {
    setPerfis((prev) =>
      prev.map((p) => (p.id === perfilId ? { ...p, rotaPadrao: novaRota } : p))
    );
  };

  const handleAdicionarUsuarioAoPerfil = () => {
    if (!pessoaParaAdicionar || !perfilAtual) return;
    const pessoaObj = pessoasDisponiveis.find((p) => p.nome === pessoaParaAdicionar);
    if (!pessoaObj) return;

    const jaExiste = (perfilAtual.usuariosVinculados || []).some(
      (u: any) => String(u.nome).toUpperCase() === String(pessoaObj.nome).toUpperCase()
    );
    if (jaExiste) {
      showToast(`${pessoaObj.nome} já está vinculado a este perfil.`);
      return;
    }

    setPerfis((prev) =>
      prev.map((p) => {
        if (p.id !== perfilAtual.id) return p;
        return {
          ...p,
          usuariosVinculados: [
            ...(p.usuariosVinculados || []),
            {
              nome: pessoaObj.nome,
              email: pessoaObj.email,
              cargo: pessoaObj.cargo,
            },
          ],
        };
      })
    );
    setPessoaParaAdicionar("");
    showToast(`${pessoaObj.nome} vinculado ao perfil ${perfilAtual.nome}!`);
  };

  const handleRemoverUsuarioDoPerfil = (nomeUsuario: string) => {
    if (!perfilAtual) return;
    setPerfis((prev) =>
      prev.map((p) => {
        if (p.id !== perfilAtual.id) return p;
        return {
          ...p,
          usuariosVinculados: (p.usuariosVinculados || []).filter((u: any) => u.nome !== nomeUsuario),
        };
      })
    );
    showToast(`Usuário removido do perfil ${perfilAtual.sigla}.`);
  };

  const handleSalvarConfiguracoes = async (restaurarPadrao = false) => {
    try {
      setSalvando(true);
      const res = await fetch("/api/admin/perfis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfis, restaurarPadrao }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.perfis)) {
          setPerfis(data.perfis);
          try {
            localStorage.setItem("nnos_perfis_acesso_v1", JSON.stringify(data.perfis));
            window.dispatchEvent(new CustomEvent("nnos-perfis-updated", { detail: data.perfis }));
          } catch {}
        }
        showToast(
          restaurarPadrao
            ? "Pré-seleções recomendadas restauradas com sucesso!"
            : "Permissões e acessos salvos com sucesso para todos os perfis!"
        );
      }
    } catch (e) {
      console.error("Erro ao salvar perfis:", e);
      showToast("Erro ao salvar configurações.");
    } finally {
      setSalvando(false);
    }
  };

  const nivelBadge = (nivel: string) => {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      TOTAL: { label: "Acesso Total", bg: "#dcfce7", color: "#15803d" },
      EDITAR_APROVAR: { label: "Editar & Aprovar", bg: "#e0f2fe", color: "#0369a1" },
      VISUALIZAR: { label: "Somente Leitura", bg: "#fef3c7", color: "#b45309" },
      BLOQUEADO: { label: "Sem Acesso / Oculto", bg: "#f1f5f9", color: "#64748b" },
    };
    return map[nivel] || map.BLOQUEADO;
  };

  const opcoesPerfisDropdown = perfis.map((p) => ({
    value: p.id,
    label: `${p.nome} (${p.modulos.filter((m: any) => m.visivel).length}/${p.modulos.length} módulos)`,
  }));

  const opcoesRotasPadrao = [
    { value: "/projetos", label: "Projetos & Atividades (/projetos)" },
    { value: "/medicao", label: "BM - Boletim de Medição (/medicao)" },
    { value: "/viagens", label: "Viagens & Logística (/viagens)" },
    { value: "/consultor", label: "Portal do Consultor (/consultor)" },
    { value: "/faturamento", label: "Faturamento (/faturamento)" },
    { value: "/pagamentos", label: "Pagamentos (/pagamentos)" },
    { value: "/relatorios", label: "Central de Relatórios (/relatorios)" },
  ];

  const opcoesNivelModulo = [
    { value: "TOTAL", label: "Acesso Total (Criar, Editar, Excluir)" },
    { value: "EDITAR_APROVAR", label: "Operacional (Editar & Aprovar)" },
    { value: "VISUALIZAR", label: "Somente Visualização (Leitura)" },
    { value: "BLOQUEADO", label: "Bloqueado (Ocultar do Menu)" },
  ];

  return (
    <div className="app-layout">
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "#00152f",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
            fontSize: "13px",
            fontWeight: 600,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#10b981" }}>
            check_circle
          </span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Sidebar Padronizada */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <img src="/logo-coruja.png" alt="Logo Coruja NNÓS" className="sidebar-brand-img" />
            <div className="sidebar-brand-text">
              <h2 style={{ lineHeight: "1.2", textTransform: "uppercase" }}>
                GESTÃO<br />FINANCEIRA &amp; PROJETOS
              </h2>
            </div>
          </div>

          <nav className="sidebar-nav">
            <Link href="/projetos" className="nav-item">
              <span className="material-symbols-outlined">assignment</span>
              <span>Projetos &amp; Atividades</span>
            </Link>
            <Link href="/medicao" className="nav-item">
              <span className="material-symbols-outlined">receipt_long</span>
              <span>BM - Boletim de Medição</span>
            </Link>
            <Link href="/viagens" className="nav-item">
              <span className="material-symbols-outlined">flight</span>
              <span>Viagens &amp; Logística</span>
            </Link>
            <Link href="/contratos" className="nav-item">
              <span className="material-symbols-outlined">history_edu</span>
              <span>Gestão de Contratos</span>
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
            <Link href="/pagamentos" className="nav-item">
              <span className="material-symbols-outlined">payments</span>
              <span>Pagamentos</span>
            </Link>
            <Link href="/relatorios" className="nav-item">
              <span className="material-symbols-outlined">monitoring</span>
              <span>Relatórios</span>
            </Link>
            <Link href="/consultor" className="nav-item">
              <span className="material-symbols-outlined">support_agent</span>
              <span>Consultor</span>
            </Link>
            <Link href="/lider" className="nav-item">
              <span className="material-symbols-outlined">supervisor_account</span>
              <span>Líder de Projeto</span>
            </Link>
            <Link href="/admin" className="nav-item active">
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <span>Administrador</span>
            </Link>
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
              Painel do Administrador
            </span>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
              Governança, Perfis &amp; RBAC
            </span>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="main-wrapper">
        <header className="top-header" style={{ position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                className="font-label-sm"
                style={{
                  color: "var(--on-surface-variant)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Segurança &amp; Governança
              </span>
              <span style={{ color: "var(--outline-variant)" }}>/</span>
              <span className="font-label-sm" style={{ color: "var(--primary)", fontWeight: 700 }}>
                Painel de Administrador (Controle de Acesso por Perfil)
              </span>
            </div>

            <div style={{ height: "18px", width: "1px", backgroundColor: "var(--border)", margin: "0 4px" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>
                Perfil em Edição:
              </span>
              <ModernDropdown
                value={perfilAtivoId}
                onChange={(val) => setPerfilAtivoId(String(val))}
                options={opcoesPerfisDropdown}
                icon="shield_person"
                minWidth={310}
                searchable={false}
              />
            </div>
          </div>

          <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => handleSalvarConfiguracoes(true)}
              disabled={salvando}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface-container-low)",
                color: "var(--on-surface)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Restaurar as visualizações pré-selecionadas recomendadas"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                restart_alt
              </span>
              <span>Restaurar Padrão</span>
            </button>

            <button
              type="button"
              onClick={() => handleSalvarConfiguracoes(false)}
              disabled={salvando}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#059669",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                save
              </span>
              <span>{salvando ? "Salvando..." : "Salvar Acessos"}</span>
            </button>

            <ThemeToggle />
            <UserProfileHeader />
          </div>
        </header>

        <main className="content-container" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Cards dos 6 Perfis Corporativos (Seleção Rápida) */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
            {perfis.map((p) => {
              const selecionada = p.id === perfilAtivoId;
              const qtdAtivos = (p.modulos || []).filter((m: any) => m.visivel).length;
              const qtdTotal = (p.modulos || []).length;

              return (
                <div
                  key={p.id}
                  onClick={() => setPerfilAtivoId(p.id)}
                  style={{
                    backgroundColor: "var(--surface-container-lowest)",
                    border: selecionada ? `2px solid ${p.cor}` : "1px solid var(--border)",
                    borderRadius: "14px",
                    padding: "16px 18px",
                    cursor: "pointer",
                    boxShadow: selecionada ? "0 4px 14px rgba(15,42,74,0.1)" : "0 1px 3px rgba(0,0,0,0.03)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          backgroundColor: p.bgCor,
                          color: p.cor,
                          textTransform: "uppercase",
                        }}
                      >
                        {p.sigla}
                      </span>
                      <h3 style={{ fontSize: "14.5px", fontWeight: 800, color: "var(--primary)", margin: "6px 0 0 0" }}>
                        {p.nome}
                      </h3>
                    </div>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        backgroundColor: p.bgCor,
                        color: p.cor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        {p.icone}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                    <span style={{ fontWeight: 700, color: "var(--on-surface)" }}>
                      {qtdAtivos} de {qtdTotal} telas ativas
                    </span>
                    <span style={{ color: "var(--on-surface-variant)" }}>
                      {(p.usuariosVinculados || []).length} usuário(s)
                    </span>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Barra de Abas do Painel de Administrador */}
          <div
            style={{
              backgroundColor: "var(--surface-container-lowest, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "16px",
              padding: "8px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <nav
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                overflowX: "auto",
                maxWidth: "100%",
              }}
              aria-label="Abas de Governança"
            >
              <button
                type="button"
                onClick={() => setAbaAtiva("CONFIGURAR_PERFIL")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: abaAtiva === "CONFIGURAR_PERFIL" ? 700 : 600,
                  backgroundColor: abaAtiva === "CONFIGURAR_PERFIL" ? "#0f2a4a" : "transparent",
                  color: abaAtiva === "CONFIGURAR_PERFIL" ? "#ffffff" : "#475569",
                  boxShadow: abaAtiva === "CONFIGURAR_PERFIL" ? "0 1px 3px rgba(15,42,74,0.2)" : "none",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: abaAtiva === "CONFIGURAR_PERFIL" ? "#93c5fd" : "#94a3b8" }}>tune</span>
                <span>1. Módulos &amp; Regras</span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: abaAtiva === "CONFIGURAR_PERFIL" ? "#93c5fd" : "#94a3b8", textTransform: "uppercase" }}>({perfilAtual?.sigla})</span>
              </button>

              <button
                type="button"
                onClick={() => setAbaAtiva("MATRIZ_GERAL")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: abaAtiva === "MATRIZ_GERAL" ? 700 : 600,
                  backgroundColor: abaAtiva === "MATRIZ_GERAL" ? "#0f2a4a" : "transparent",
                  color: abaAtiva === "MATRIZ_GERAL" ? "#ffffff" : "#475569",
                  boxShadow: abaAtiva === "MATRIZ_GERAL" ? "0 1px 3px rgba(15,42,74,0.2)" : "none",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: abaAtiva === "MATRIZ_GERAL" ? "#93c5fd" : "#94a3b8" }}>grid_view</span>
                <span>2. Matriz Comparativa Geral</span>
              </button>

              <button
                type="button"
                onClick={() => setAbaAtiva("USUARIOS")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: abaAtiva === "USUARIOS" ? 700 : 600,
                  backgroundColor: abaAtiva === "USUARIOS" ? "#0f2a4a" : "transparent",
                  color: abaAtiva === "USUARIOS" ? "#ffffff" : "#475569",
                  boxShadow: abaAtiva === "USUARIOS" ? "0 1px 3px rgba(15,42,74,0.2)" : "none",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: abaAtiva === "USUARIOS" ? "#93c5fd" : "#94a3b8" }}>manage_accounts</span>
                <span>3. Usuários Vinculados</span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "999px",
                    backgroundColor: abaAtiva === "USUARIOS" ? "#1e3a5f" : "#f1f5f9",
                    color: abaAtiva === "USUARIOS" ? "#ffffff" : "#475569",
                    border: abaAtiva === "USUARIOS" ? "1px solid #334155" : "1px solid #e2e8f0",
                  }}
                >
                  {(perfilAtual?.usuariosVinculados || []).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAbaAtiva("GESTAO_USUARIOS")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: abaAtiva === "GESTAO_USUARIOS" ? 700 : 600,
                  backgroundColor: abaAtiva === "GESTAO_USUARIOS" ? "#0f2a4a" : "transparent",
                  color: abaAtiva === "GESTAO_USUARIOS" ? "#ffffff" : "#475569",
                  boxShadow: abaAtiva === "GESTAO_USUARIOS" ? "0 1px 3px rgba(15,42,74,0.2)" : "none",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: abaAtiva === "GESTAO_USUARIOS" ? "#93c5fd" : "#94a3b8" }}>passkey</span>
                <span>4. Gestão de Senhas (MFA)</span>
              </button>

              <button
                type="button"
                onClick={() => setAbaAtiva("LOGS_ACESSO")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: abaAtiva === "LOGS_ACESSO" ? 700 : 600,
                  backgroundColor: abaAtiva === "LOGS_ACESSO" ? "#0f2a4a" : "transparent",
                  color: abaAtiva === "LOGS_ACESSO" ? "#ffffff" : "#475569",
                  boxShadow: abaAtiva === "LOGS_ACESSO" ? "0 1px 3px rgba(15,42,74,0.2)" : "none",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: abaAtiva === "LOGS_ACESSO" ? "#93c5fd" : "#94a3b8" }}>policy</span>
                <span>5. Monitoramento de Log de Acesso</span>
              </button>

              <button
                type="button"
                onClick={() => setAbaAtiva("HOMOLOGACAO")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: abaAtiva === "HOMOLOGACAO" ? 700 : 600,
                  backgroundColor: abaAtiva === "HOMOLOGACAO" ? "#0f2a4a" : "transparent",
                  color: abaAtiva === "HOMOLOGACAO" ? "#ffffff" : "#475569",
                  boxShadow: abaAtiva === "HOMOLOGACAO" ? "0 1px 3px rgba(15,42,74,0.2)" : "none",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: abaAtiva === "HOMOLOGACAO" ? "#93c5fd" : "#94a3b8" }}>
                  forward_to_inbox
                </span>
                <span>6. Homologação &amp; Convites</span>
              </button>
            </nav>

            {perfilAtual && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                  borderLeft: "1px solid #e2e8f0",
                  paddingLeft: "12px",
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748b" }}>
                  Tela Inicial Padrão:
                </span>
                <ModernDropdown
                  value={perfilAtual.rotaPadrao || "/projetos"}
                  onChange={(val) => handleAlterarRotaPadrao(perfilAtual.id, String(val))}
                  options={opcoesRotasPadrao}
                  icon="home"
                  minWidth={250}
                  searchable={false}
                />

                <button
                  type="button"
                  onClick={() => {
                    if (perfilAtual.id === "CONSULTOR") {
                      router.push("/consultor");
                    } else {
                      ativarPerfil(perfilAtual.id, true);
                    }
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: "#0f2a4a",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(15,42,74,0.15)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#93c5fd" }}>
                    visibility
                  </span>
                  <span>Simular Visão ({perfilAtual.sigla})</span>
                </button>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* ABA 1: CONFIGURAÇÃO DETALHADA DO PERFIL SELECIONADO               */}
          {/* ================================================================= */}
          {abaAtiva === "CONFIGURAR_PERFIL" && perfilAtual && (
            <>
              {/* Resumo do Perfil */}
              <div
                style={{
                  backgroundColor: "var(--surface-container-lowest)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "18px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 800,
                        backgroundColor: perfilAtual.bgCor,
                        color: perfilAtual.cor,
                      }}
                    >
                      PERFIL: {perfilAtual.sigla}
                    </span>
                    <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                      {perfilAtual.nome}
                    </h2>
                  </div>
                  <p style={{ margin: "6px 0 0 0", fontSize: "12.5px", color: "var(--on-surface-variant)", maxWidth: "850px" }}>
                    {perfilAtual.descricao}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPerfis((prev) =>
                        prev.map((p) =>
                          p.id === perfilAtual.id
                            ? {
                                ...p,
                                modulos: p.modulos.map((m: any) => ({ ...m, visivel: true, nivel: m.nivel === "BLOQUEADO" ? "VISUALIZAR" : m.nivel })),
                              }
                            : p
                        )
                      );
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-container-low)",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "var(--primary)",
                    }}
                  >
                    Marcar Todas as Telas
                  </button>
                </div>
              </div>

              {/* Tabela de Módulos Pré-Selecionados */}
              <section
                style={{
                  backgroundColor: "var(--surface-container-lowest)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-container-low)" }}>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>
                    Visualizações do Menu Lateral &amp; Nível de Permissão ({perfilAtual.nome})
                  </h3>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border)",
                        color: "var(--on-surface-variant)",
                        fontSize: "11px",
                        textTransform: "uppercase",
                      }}
                    >
                      <th style={{ padding: "12px 16px", width: "90px", textAlign: "center" }}>No Menu</th>
                      <th style={{ padding: "12px 16px" }}>Módulo / Tela do Sistema</th>
                      <th style={{ padding: "12px 16px" }}>Visualização Pré-Selecionada</th>
                      <th style={{ padding: "12px 16px", width: "260px" }}>Nível de Permissão</th>
                      <th style={{ padding: "12px 16px" }}>Regra de Negócio Aplicada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(perfilAtual.modulos || []).map((m: any) => {
                      const badge = nivelBadge(m.nivel);
                      return (
                        <tr
                          key={m.id}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            backgroundColor: m.visivel ? "transparent" : "rgba(148, 163, 184, 0.05)",
                            opacity: m.visivel ? 1 : 0.72,
                          }}
                        >
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={!!m.visivel}
                              onChange={() => handleToggleModulo(perfilAtual.id, m.id)}
                              style={{ width: "17px", height: "17px", cursor: "pointer", accentColor: "var(--primary)" }}
                            />
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "19px", color: m.visivel ? "var(--primary)" : "#94a3b8" }}>
                                {m.icone}
                              </span>
                              <div>
                                <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "13px" }}>{m.nome}</div>
                                <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>{m.rota}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 9px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                backgroundColor: badge.bg,
                                color: badge.color,
                              }}
                            >
                              {m.abaPadrao}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <ModernDropdown
                              value={m.nivel}
                              onChange={(val) => handleAlterarNivelModulo(perfilAtual.id, m.id, String(val))}
                              options={opcoesNivelModulo}
                              icon="lock_open"
                              minWidth={240}
                              searchable={false}
                            />
                          </td>
                          <td style={{ padding: "12px 16px", color: "var(--on-surface-variant)", fontSize: "11.5px" }}>
                            {m.observacao}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              {/* Regras Granulares de Segurança e Confidencialidade */}
              <section
                style={{
                  backgroundColor: "var(--surface-container-lowest)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "20px",
                }}
              >
                <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>
                  Permissões Especiais &amp; Sigilo de Dados Financeiros ({perfilAtual.nome})
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "12px" }}>
                  {REGRAS_SEGURANCA_META.map((regra) => {
                    const ativo = !!perfilAtual.regrasSeguranca?.[regra.chave];
                    return (
                      <label
                        key={regra.chave}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                          padding: "14px",
                          borderRadius: "12px",
                          border: ativo ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                          backgroundColor: ativo ? "rgba(15, 42, 74, 0.03)" : "var(--surface-container-low)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={ativo}
                          onChange={() => handleToggleRegra(perfilAtual.id, regra.chave)}
                          style={{ width: "17px", height: "17px", marginTop: "2px", accentColor: "var(--primary)", cursor: "pointer" }}
                        />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "12.5px", color: "var(--primary)" }}>
                            {regra.titulo}
                          </div>
                          <div style={{ fontSize: "11.5px", color: "var(--on-surface-variant)", marginTop: "3px", lineHeight: 1.4 }}>
                            {regra.descricao}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* ================================================================= */}
          {/* ABA 2: MATRIZ COMPARATIVA GERAL (TODOS OS 6 PERFIS x 12 TELAS)    */}
          {/* ================================================================= */}
          {abaAtiva === "MATRIZ_GERAL" && (
            <section
              style={{
                backgroundColor: "var(--surface-container-lowest)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                overflowX: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: "var(--surface-container-low)",
                      borderBottom: "1px solid var(--border)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    <th style={{ padding: "14px 16px", color: "var(--primary)" }}>Módulo / Menu</th>
                    {perfis.map((p) => (
                      <th key={p.id} style={{ padding: "14px 12px", textAlign: "center", color: p.cor }}>
                        {p.sigla}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(perfis[0]?.modulos || []).map((modBase: any) => (
                    <tr key={modBase.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 800, color: "var(--primary)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            {modBase.icone}
                          </span>
                          <span>{modBase.nome}</span>
                        </div>
                      </td>
                      {perfis.map((p) => {
                        const modPerfil = (p.modulos || []).find((m: any) => m.id === modBase.id);
                        const visivel = !!modPerfil?.visivel;
                        const badge = nivelBadge(modPerfil?.nivel || "BLOQUEADO");
                        return (
                          <td key={`${p.id}-${modBase.id}`} style={{ padding: "12px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleToggleModulo(p.id, modBase.id)}
                              style={{
                                border: "none",
                                cursor: "pointer",
                                padding: "4px 10px",
                                borderRadius: "999px",
                                fontSize: "10.5px",
                                fontWeight: 800,
                                backgroundColor: visivel ? badge.bg : "#f1f5f9",
                                color: visivel ? badge.color : "#94a3b8",
                              }}
                              title="Clique para ativar/desativar este módulo no perfil"
                            >
                              {visivel ? badge.label : "Oculto"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* ================================================================= */}
          {/* ABA 3: USUÁRIOS VINCULADOS AO PERFIL                              */}
          {/* ================================================================= */}
          {abaAtiva === "USUARIOS" && perfilAtual && (
            <section
              style={{
                backgroundColor: "var(--surface-container-lowest)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "var(--primary)" }}>
                    Profissionais Vinculados ao Perfil: {perfilAtual.nome}
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                    Adicione ou remova integrantes da base NNÓS que herdarão automaticamente as visualizações deste perfil.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <ModernDropdown
                    value={pessoaParaAdicionar}
                    onChange={(val) => setPessoaParaAdicionar(String(val))}
                    options={pessoasDisponiveis.map((p) => ({
                      value: p.nome,
                      label: `${p.nome} (${p.cargo})`,
                    }))}
                    placeholder="Selecionar pessoa da base NNÓS..."
                    icon="person_add"
                    minWidth={280}
                    searchable
                    searchPlaceholder="Buscar profissional..."
                  />
                  <button
                    type="button"
                    onClick={handleAdicionarUsuarioAoPerfil}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "var(--primary)",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Vincular ao Perfil
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                {(perfilAtual.usuariosVinculados || []).map((u: any, idx: number) => (
                  <div
                    key={`${u.nome}-${idx}`}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-container-low)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--primary)" }}>{u.nome}</div>
                      <div style={{ fontSize: "11.5px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                        {u.cargo}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--secondary)", marginTop: "2px" }}>{u.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoverUsuarioDoPerfil(u.nome)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#dc2626",
                        cursor: "pointer",
                        padding: "4px",
                      }}
                      title="Remover vínculo"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        delete
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ================================================================= */}
          {/* ABAS 4 e 5: GESTÃO DE USUÁRIOS/SENHAS/MFA & LOG DE ACESSO         */}
          {/* ================================================================= */}
          {(abaAtiva === "GESTAO_USUARIOS" || abaAtiva === "LOGS_ACESSO") && (
            <GestaoUsuariosELogs
              modo={abaAtiva}
              perfis={perfis}
              onToast={showToast}
            />
          )}

          {/* ================================================================= */}
          {/* ABA 6: HOMOLOGAÇÃO & DISPARO DE CONVITES                          */}
          {/* ================================================================= */}
          {abaAtiva === "HOMOLOGACAO" && (
            <ModuloHomologacaoConvites
              perfis={perfis}
              onToast={showToast}
            />
          )}
        </main>
      </div>
    </div>
  );
}

