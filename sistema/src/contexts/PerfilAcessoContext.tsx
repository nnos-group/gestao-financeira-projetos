"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import perfisIniciais from "@/lib/perfis-acesso.json";
import ccBase from "@/lib/centros-de-custo.json";
import ModernDropdown from "@/components/ModernDropdown";

export type NivelAcessoModulo = "TOTAL" | "EDITAR_APROVAR" | "VISUALIZAR" | "BLOQUEADO";

export interface ModuloPermissao {
  id: string;
  nome: string;
  rota: string;
  icone: string;
  visivel: boolean;
  nivel: NivelAcessoModulo;
  abaPadrao: string;
  observacao: string;
}

export interface PerfilAcessoItem {
  id: string;
  nome: string;
  sigla: string;
  icone: string;
  cor: string;
  bgCor: string;
  rotaPadrao: string;
  escopoDados: string;
  descricao: string;
  usuariosVinculados: { nome: string; email: string; cargo: string }[];
  regrasSeguranca: Record<string, boolean>;
  modulos: ModuloPermissao[];
}

export interface LiderOption {
  nome: string;
  email: string;
  area: string;
  qtdProjetos: number;
}

interface PerfilAcessoContextData {
  perfis: PerfilAcessoItem[];
  perfilAtivoId: string;
  perfilAtivoObj: PerfilAcessoItem;
  liderSimulado: string;
  setLiderSimulado: (nome: string) => void;
  listaLideres: LiderOption[];
  ativarPerfil: (id: string, redirecionar?: boolean) => void;
  voltarParaAdmin: () => void;
  recarregarPerfis: () => Promise<void>;
  pertenceAoLiderAtivo: (
    projetoNome?: string | null,
    centroCustoCodigo?: string | null,
    liderDireto?: string | null
  ) => boolean;
  temAcessoModulo: (moduloIdOuRota: string) => boolean;
  nivelModulo: (moduloIdOuRota: string) => NivelAcessoModulo;
  regraAtiva: (chave: string) => boolean;
  hidratado: boolean;
}

const LIDERES_METADATA: Record<string, { email: string; areaPadrao: string }> = {
  "BEATRIZ PICORELLI": { email: "beatriz.picorelli@nnos.com.br", areaPadrao: "HRD - Human Resource Development" },
  "CAROLINE AMIEVA": { email: "caroline.amieva@nnos.com.br", areaPadrao: "Business Solutions" },
  "JEFFERSON SOUZA": { email: "jefferson.souza@nnos.com.br", areaPadrao: "Dealer Development" },
  "VINICIUS SOUZA": { email: "vinicius.souza@nnos.com.br", areaPadrao: "Business Solutions" },
  "FÁBIO CANASSA": { email: "fabio.canassa@nnos.com.br", areaPadrao: "Outsourcing Porsche" },
  "JOICE LAGE": { email: "joice.lage@nnos.com.br", areaPadrao: "Educação" },
  "LEONARDO CAMPOS": { email: "leonardo.campos@nnos.com.br", areaPadrao: "Diretoria & Adm" },
  "IGOR PICORELLI": { email: "igor.picorelli@nnos.com.br", areaPadrao: "Adm e Controle" },
};

function normalizarTexto(str?: string | null): string {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizarListaPerfis(lista: PerfilAcessoItem[]): PerfilAcessoItem[] {
  if (!Array.isArray(lista) || lista.length === 0) return perfisIniciais as unknown as PerfilAcessoItem[];
  const padraoAdmin = (perfisIniciais as unknown as PerfilAcessoItem[]).find((p) => p.id === "ADMIN");
  const padraoDiretoria = (perfisIniciais as unknown as PerfilAcessoItem[]).find((p) => p.id === "DIRETORIA");

  const resultado = lista.map((p) => {
    if (p.id === "ADMIN") {
      return {
        ...p,
        nome: "Administrador",
        sigla: "ADMIN",
        descricao: padraoAdmin?.descricao || p.descricao,
      };
    }
    return p;
  });

  if (!resultado.some((p) => p.id === "DIRETORIA") && padraoDiretoria) {
    const idxAdmin = resultado.findIndex((p) => p.id === "ADMIN");
    if (idxAdmin >= 0) {
      resultado.splice(idxAdmin + 1, 0, padraoDiretoria);
    } else {
      resultado.unshift(padraoDiretoria);
    }
  }

  return resultado;
}

const PerfilAcessoContext = createContext<PerfilAcessoContextData | undefined>(undefined);

export function PerfilAcessoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [perfis, setPerfis] = useState<PerfilAcessoItem[]>(perfisIniciais as unknown as PerfilAcessoItem[]);
  const [perfilAtivoId, setPerfilAtivoId] = useState<string>("ADMIN");
  const [liderSimulado, setLiderSimuladoState] = useState<string>("BEATRIZ PICORELLI");
  const [hidratado, setHidratado] = useState<boolean>(false);

  // Mapa rápido de Projeto / Centro de Custo -> Líder de Projeto
  const { mapaPorProjeto, mapaPorCC, listaLideres } = useMemo(() => {
    const porProj = new Map<string, string>();
    const porCC = new Map<string, string>();
    const contagemPorLider = new Map<string, { qtd: number; area: string }>();

    const centros = (ccBase as any)?.centrosDeCusto || [];
    for (const item of centros) {
      const liderNorm = normalizarTexto(item.liderProjeto);
      const projNorm = normalizarTexto(item.projeto);
      const ccNorm = normalizarTexto(item.centroDeCusto);
      if (!liderNorm || liderNorm === "-" || liderNorm === "—") continue;

      if (projNorm) porProj.set(projNorm, liderNorm);
      if (ccNorm) porCC.set(ccNorm, liderNorm);

      // Reabilita nomes originais com acento se conhecidos
      const chaveExibicao =
        liderNorm === "FABIO CANASSA" ? "FÁBIO CANASSA" : String(item.liderProjeto).trim().toUpperCase();

      const atual = contagemPorLider.get(chaveExibicao) || { qtd: 0, area: item.area || "" };
      contagemPorLider.set(chaveExibicao, {
        qtd: atual.qtd + 1,
        area: atual.area || item.area || "",
      });
    }

    const opcoes: LiderOption[] = Array.from(contagemPorLider.entries())
      .map(([nome, info]) => ({
        nome,
        email: LIDERES_METADATA[nome]?.email || `${nome.toLowerCase().split(" ")[0]}@nnos.com.br`,
        area: LIDERES_METADATA[nome]?.areaPadrao || info.area || "Projetos",
        qtdProjetos: info.qtd,
      }))
      .sort((a, b) => b.qtdProjetos - a.qtdProjetos);

    return {
      mapaPorProjeto: porProj,
      mapaPorCC: porCC,
      listaLideres: opcoes,
    };
  }, []);

  const recarregarPerfis = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/perfis");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.perfis) && data.perfis.length > 0) {
          const norm = normalizarListaPerfis(data.perfis);
          setPerfis(norm);
          try {
            localStorage.setItem("nnos_perfis_acesso_v1", JSON.stringify(norm));
          } catch {}
        }
      }
    } catch {
      // Silencioso, mantém fallback local
    }
  }, []);

  useEffect(() => {
    try {
      const savedPerfis = localStorage.getItem("nnos_perfis_acesso_v1");
      if (savedPerfis) {
        const parsed = JSON.parse(savedPerfis);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPerfis(normalizarListaPerfis(parsed));
        }
      }
      const savedPerfilId = localStorage.getItem("nnos_perfil_ativo_id");
      if (savedPerfilId) {
        setPerfilAtivoId(savedPerfilId);
      }
      const savedLider = localStorage.getItem("nnos_lider_simulado_v1");
      if (savedLider) {
        setLiderSimuladoState(savedLider);
      }
    } catch {}
    setHidratado(true);
    recarregarPerfis();

    const handleCustomUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setPerfis(normalizarListaPerfis(customEvent.detail));
      } else {
        recarregarPerfis();
      }
    };

    window.addEventListener("nnos-perfis-updated", handleCustomUpdate);
    return () => window.removeEventListener("nnos-perfis-updated", handleCustomUpdate);
  }, [recarregarPerfis]);

  const setLiderSimulado = useCallback((nome: string) => {
    setLiderSimuladoState(nome);
    try {
      localStorage.setItem("nnos_lider_simulado_v1", nome);
    } catch {}
  }, []);

  const perfilAtivoObj = useMemo(() => {
    return perfis.find((p) => p.id === perfilAtivoId) || perfis[0];
  }, [perfis, perfilAtivoId]);

  const temAcessoModulo = useCallback(
    (moduloIdOuRota: string): boolean => {
      if (perfilAtivoId === "ADMIN") return true;
      const limpo = moduloIdOuRota.replace(/^\//, "").split("/")[0].split("?")[0];
      if (!limpo) return true;
      // Quando em modo LIDER, a rota /lider é apenas o ativador
      if (limpo === "lider" && perfilAtivoId === "LIDER") return true;
      const mod = (perfilAtivoObj?.modulos || []).find(
        (m) => m.id === limpo || m.rota.replace(/^\//, "") === limpo
      );
      if (!mod) return true;
      return Boolean(mod.visivel && mod.nivel !== "BLOQUEADO");
    },
    [perfilAtivoId, perfilAtivoObj]
  );

  const nivelModulo = useCallback(
    (moduloIdOuRota: string): NivelAcessoModulo => {
      if (perfilAtivoId === "ADMIN") return "TOTAL";
      const limpo = moduloIdOuRota.replace(/^\//, "").split("/")[0].split("?")[0];
      const mod = (perfilAtivoObj?.modulos || []).find(
        (m) => m.id === limpo || m.rota.replace(/^\//, "") === limpo
      );
      return mod?.nivel || "VISUALIZAR";
    },
    [perfilAtivoId, perfilAtivoObj]
  );

  const regraAtiva = useCallback(
    (chave: string): boolean => {
      if (perfilAtivoId === "ADMIN") {
        if (chave === "restringirAoProprioEscopo") return false;
        return true;
      }
      return Boolean(perfilAtivoObj?.regrasSeguranca?.[chave]);
    },
    [perfilAtivoId, perfilAtivoObj]
  );

  const ativarPerfil = useCallback(
    (novoId: string, redirecionar = false) => {
      setPerfilAtivoId(novoId);
      try {
        localStorage.setItem("nnos_perfil_ativo_id", novoId);
      } catch {}

      const targetPerfil = perfis.find((p) => p.id === novoId) || perfis[0];
      const rotaPadrao =
        targetPerfil?.rotaPadrao && targetPerfil.rotaPadrao !== "/lider"
          ? targetPerfil.rotaPadrao
          : "/projetos";

      if (redirecionar || pathname === "/lider" || pathname === "/admin") {
        router.push(rotaPadrao);
        return;
      }

      // Se a tela atual não é permitida para o novo perfil, redireciona para a rota padrão do perfil
      if (novoId !== "ADMIN") {
        const seg = (pathname || "").replace(/^\//, "").split("/")[0];
        const modAtual = (targetPerfil?.modulos || []).find(
          (m) => m.id === seg || m.rota.replace(/^\//, "") === seg
        );
        if (modAtual && (!modAtual.visivel || modAtual.nivel === "BLOQUEADO")) {
          router.push(rotaPadrao);
        }
      }
    },
    [perfis, pathname, router]
  );

  const voltarParaAdmin = useCallback(() => {
    setPerfilAtivoId("ADMIN");
    try {
      localStorage.setItem("nnos_perfil_ativo_id", "ADMIN");
    } catch {}
  }, []);

  // Intercepta clique em <a href="/lider"> no menu lateral para ativar a visão Líder sem sair do sistema único
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a.nav-item") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (href === "/lider") {
        e.preventDefault();
        ativarPerfil("LIDER", false);
      } else if (href === "/admin" && perfilAtivoId !== "ADMIN") {
        // Permite ir ao painel de administrador restaurando a visão de Administrador
        setPerfilAtivoId("ADMIN");
        try {
          localStorage.setItem("nnos_perfil_ativo_id", "ADMIN");
        } catch {}
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [ativarPerfil, perfilAtivoId]);

  const pertenceAoLiderAtivo = useCallback(
    (
      projetoNome?: string | null,
      centroCustoCodigo?: string | null,
      liderDireto?: string | null
    ): boolean => {
      if (perfilAtivoId !== "LIDER") return true;
      if (!regraAtiva("restringirAoProprioEscopo")) return true;
      if (!liderSimulado || liderSimulado === "TODOS") return true;

      const alvoNorm = normalizarTexto(liderSimulado);

      if (liderDireto) {
        const lidNorm = normalizarTexto(liderDireto);
        if (lidNorm && lidNorm !== "-" && lidNorm !== "—") {
          return lidNorm === alvoNorm || lidNorm.includes(alvoNorm) || alvoNorm.includes(lidNorm);
        }
      }

      if (centroCustoCodigo) {
        const ccNorm = normalizarTexto(centroCustoCodigo);
        const donoCC = mapaPorCC.get(ccNorm);
        if (donoCC) {
          return donoCC === alvoNorm;
        }
      }

      if (projetoNome) {
        const projNorm = normalizarTexto(projetoNome);
        const donoProj = mapaPorProjeto.get(projNorm);
        if (donoProj) {
          return donoProj === alvoNorm;
        }
        // Busca parcial caso o nome do projeto tenha sufixo/prefixo
        for (const [kProj, kLider] of mapaPorProjeto.entries()) {
          if (projNorm.includes(kProj) || kProj.includes(projNorm)) {
            return kLider === alvoNorm;
          }
        }
      }

      return false;
    },
    [perfilAtivoId, regraAtiva, liderSimulado, mapaPorCC, mapaPorProjeto]
  );

  // CSS Dinâmico para ocultar do menu lateral (.sidebar-nav) os módulos não autorizados para o perfil ativo
  const cssRestricaoMenu = useMemo(() => {
    if (!hidratado || perfilAtivoId === "ADMIN") return "";

    const regrasCss: string[] = [];
    const modulos = perfilAtivoObj?.modulos || [];

    for (const mod of modulos) {
      if (!mod.visivel || mod.nivel === "BLOQUEADO") {
        // Não oculta o próprio botão "Líder de Projeto" quando estamos no perfil LIDER
        if (perfilAtivoId === "LIDER" && mod.rota === "/lider") continue;
        regrasCss.push(`.sidebar-nav a.nav-item[href="${mod.rota}"] { display: none !important; }`);
        regrasCss.push(`.sidebar-nav a.nav-item[href^="${mod.rota}/"] { display: none !important; }`);
      }
    }

    // Destaca o item "Líder de Projeto" no menu lateral quando a visão de Líder está ativa
    if (perfilAtivoId === "LIDER") {
      regrasCss.push(`
        .sidebar-nav a.nav-item[href="/lider"] {
          background: rgba(3, 105, 161, 0.14) !important;
          color: #38bdf8 !important;
          border-left: 3px solid #38bdf8 !important;
          font-weight: 700 !important;
        }
      `);
    }

    return regrasCss.join("\n");
  }, [hidratado, perfilAtivoId, perfilAtivoObj]);

  // Verifica se a rota atual está bloqueada para o perfil ativo
  const rotaAtualBloqueada = useMemo(() => {
    if (!hidratado || perfilAtivoId === "ADMIN") return false;
    if (!pathname || pathname === "/" || pathname === "/lider" || pathname.startsWith("/login")) return false;
    return !temAcessoModulo(pathname);
  }, [hidratado, perfilAtivoId, pathname, temAcessoModulo]);

  const exibirBarraSimulacao =
    hidratado &&
    perfilAtivoId !== "ADMIN" &&
    pathname !== "/lider" &&
    !pathname?.startsWith("/login") &&
    !pathname?.startsWith("/consultor");

  const opcoesLiderDropdown = useMemo(() => {
    return [
      ...listaLideres.map((l) => ({
        value: l.nome,
        label: `${l.nome} (${l.area} • ${l.qtdProjetos} proj.)`,
      })),
      {
        value: "TODOS",
        label: "Todos os Líderes (Visão Consolidada)",
      },
    ];
  }, [listaLideres]);

  const opcoesPerfisDropdown = useMemo(() => {
    return perfis.map((p) => ({
      value: p.id,
      label: `${p.nome} (${p.sigla})`,
    }));
  }, [perfis]);

  const qtdModulosVisiveis = useMemo(() => {
    return (perfilAtivoObj?.modulos || []).filter((m) => m.visivel && m.nivel !== "BLOQUEADO").length;
  }, [perfilAtivoObj]);

  return (
    <PerfilAcessoContext.Provider
      value={{
        perfis,
        perfilAtivoId,
        perfilAtivoObj,
        liderSimulado,
        setLiderSimulado,
        listaLideres,
        ativarPerfil,
        voltarParaAdmin,
        recarregarPerfis,
        pertenceAoLiderAtivo,
        temAcessoModulo,
        nivelModulo,
        regraAtiva,
        hidratado,
      }}
    >
      {cssRestricaoMenu && <style dangerouslySetInnerHTML={{ __html: cssRestricaoMenu }} />}

      {/* Barra Superior de Simulação de Perfil (Semelhante ao Portal do Consultor) */}
      {exibirBarraSimulacao && (
        <div
          style={{
            marginLeft: "var(--sidebar-w, 232px)",
            backgroundColor: "#00152f",
            color: "#ffffff",
            padding: "8px 24px",
            borderBottom: "2px solid #0284c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            position: "sticky",
            top: 0,
            zIndex: 999,
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.16)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(56, 189, 248, 0.18)",
                  color: "#38bdf8",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  {perfilAtivoObj?.icone || "supervisor_account"}
                </span>
              </span>
              <div>
                <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", fontWeight: 700 }}>
                  Modo de Acesso Restrito por Perfil
                </div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{perfilAtivoObj?.nome}</span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 7px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(16, 185, 129, 0.2)",
                      color: "#34d399",
                      fontWeight: 700,
                    }}
                  >
                    {qtdModulosVisiveis} menus liberados
                  </span>
                </div>
              </div>
            </div>

            <div style={{ height: "22px", width: "1px", backgroundColor: "rgba(255,255,255,0.15)" }} />

            {/* Seletor de Líder Simulado quando no perfil LIDER */}
            {perfilAtivoId === "LIDER" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#fbbf24",
                    backgroundColor: "rgba(245, 158, 11, 0.16)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    padding: "4px 9px",
                    borderRadius: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    science
                  </span>
                  Simular Líder:
                </span>

                <div style={{ color: "var(--on-surface)" }}>
                  <ModernDropdown
                    value={liderSimulado}
                    onChange={(val) => setLiderSimulado(String(val))}
                    options={opcoesLiderDropdown}
                    icon="supervisor_account"
                    placeholder="Selecionar Líder de Projeto..."
                    minWidth={290}
                    searchable
                    searchPlaceholder="Buscar líder de projeto..."
                  />
                </div>
              </div>
            )}

            {/* Seletor Rápido de Perfil caso queira alternar entre LIDER / FINANCEIRO / AGENCIA */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "#cbd5e1", fontWeight: 600 }}>Perfil:</span>
              <div style={{ color: "var(--on-surface)" }}>
                <ModernDropdown
                  value={perfilAtivoId}
                  onChange={(val) => ativarPerfil(String(val), false)}
                  options={opcoesPerfisDropdown}
                  icon="badge"
                  minWidth={220}
                  searchable={false}
                />
              </div>
            </div>
          </div>

          {/* Botões de Ação Rápida à Direita */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => {
                voltarParaAdmin();
                router.push("/admin");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.22)",
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "#e2e8f0",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Abrir Painel de Administrador para configurar menus e permissões deste perfil"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                admin_panel_settings
              </span>
              <span>Configurar Acessos</span>
            </button>

            <button
              type="button"
              onClick={voltarParaAdmin}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#0284c7",
                color: "#ffffff",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Sair da simulação de perfil e restaurar acesso total ao sistema"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                lock_open
              </span>
              <span>Voltar ao Acesso Total</span>
            </button>
          </div>
        </div>
      )}

      {/* Bloqueio de Rota Não Autorizada para o Perfil Ativo */}
      {rotaAtualBloqueada ? (
        <div
          style={{
            marginLeft: "var(--sidebar-w, 232px)",
            minHeight: "calc(100vh - 60px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px",
            backgroundColor: "var(--background)",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              backgroundColor: "var(--surface-container-lowest)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "32px",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>
                gpp_maybe
              </span>
            </div>
            <h2 style={{ fontSize: "19px", fontWeight: 800, color: "var(--on-surface)", margin: "0 0 8px 0" }}>
              Módulo Restrito para o Perfil {perfilAtivoObj?.nome}
            </h2>
            <p style={{ fontSize: "13.5px", color: "var(--on-surface-variant)", lineHeight: 1.6, margin: "0 0 22px 0" }}>
              A tela <strong>{pathname}</strong> não está habilitada para o perfil{" "}
              <strong>{perfilAtivoObj?.sigla}</strong> conforme configurado na matriz de segurança do Painel de
              Administrador.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    perfilAtivoObj?.rotaPadrao && perfilAtivoObj.rotaPadrao !== "/lider"
                      ? perfilAtivoObj.rotaPadrao
                      : "/projetos"
                  )
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "var(--primary)",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                  arrow_back
                </span>
                <span>Ir para Tela Autorizada</span>
              </button>

              <button
                type="button"
                onClick={voltarParaAdmin}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-container-low)",
                  color: "var(--on-surface)",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                  admin_panel_settings
                </span>
                <span>Desativar Restrição (Acesso Total)</span>
              </button>
            </div>
          </div>
        </div>
      ) : !hidratado ? (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />
      ) : (
        children
      )}
    </PerfilAcessoContext.Provider>
  );
}

export function usePerfilAcesso() {
  const ctx = useContext(PerfilAcessoContext);
  if (!ctx) {
    throw new Error("usePerfilAcesso deve ser utilizado dentro de um PerfilAcessoProvider");
  }
  return ctx;
}

