"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import ModernDropdown from "@/components/ModernDropdown";
import BotaoAjudaCentral from "@/components/BotaoAjudaCentral";
import ModalPerfilUsuario, { IdentidadeUsuarioModal } from "@/components/ModalPerfilUsuario";
import { useConsultor } from "@/contexts/ConsultorContext";

interface ConsultorHeaderProps {
  tituloPagina?: string;
}

function obterIniciais(nome: string): string {
  const partes = String(nome || "NN")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return "NN";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function ConsultorHeader({ tituloPagina = "Visão Geral" }: ConsultorHeaderProps) {
  const router = useRouter();
  const { consultorAtivo, selecionarConsultorPorId, listaConsultores, carregando } = useConsultor();
  const [usuarioLogado, setUsuarioLogado] = useState<any | null>(null);
  const [fotosPorChave, setFotosPorChave] = useState<Record<string, string>>({});
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);

  useEffect(() => {
    const carregarUsuarioEFotos = () => {
      try {
        const saved = localStorage.getItem("nnos_usuario_logado_v1");
        if (saved) {
          setUsuarioLogado(JSON.parse(saved));
        } else {
          setUsuarioLogado(null);
        }
        const savedFotos = localStorage.getItem("nnos_fotos_usuarios_v1");
        if (savedFotos) {
          setFotosPorChave(JSON.parse(savedFotos));
        }
      } catch {}
    };

    carregarUsuarioEFotos();
    window.addEventListener("nnos-user-updated", carregarUsuarioEFotos);
    return () => window.removeEventListener("nnos-user-updated", carregarUsuarioEFotos);
  }, []);

  const isUsuarioAdmin = !usuarioLogado || usuarioLogado.perfilId === "ADMIN";

  const consultorIdentidade: IdentidadeUsuarioModal = useMemo(() => {
    const nome = consultorAtivo?.nome || usuarioLogado?.nome || "Consultor";
    const login = (usuarioLogado?.login || consultorAtivo?.nome || "consultor")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, ".");
    const email = consultorAtivo?.email || usuarioLogado?.email || `${login}@nnos.com.br`;
    const cargo =
      consultorAtivo?.tipo === "socio"
        ? "Sócio / Parceiro • Consultor"
        : `Consultor Especialista • ${consultorAtivo?.perfil || "Sênior"}`;
    const foto =
      fotosPorChave[login] ||
      fotosPorChave[nome.toUpperCase()] ||
      usuarioLogado?.fotoUrl ||
      (consultorAtivo as any)?.fotoUrl ||
      "";

    return {
      id: consultorAtivo?.id || usuarioLogado?.id,
      login,
      nome,
      email,
      cargo,
      fotoUrl: foto,
      mfaSecret: usuarioLogado?.mfaSecret || "NNOSMFA2026KEY",
    };
  }, [consultorAtivo, usuarioLogado, fotosPorChave]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "LOGOUT",
          login: consultorIdentidade.login,
          nome: consultorIdentidade.nome,
          perfilId: usuarioLogado?.perfilId || "CONSULTOR",
        }),
      });
    } catch {}
    try {
      localStorage.removeItem("nnos_usuario_logado_v1");
      localStorage.removeItem("nnos_perfil_ativo_id");
      localStorage.removeItem("nnos_consultor_simulado_id");
      localStorage.removeItem("nnos_consultor_simulado_nome");
      localStorage.removeItem("nnos_consultor_simulado_obj");
      window.dispatchEvent(new CustomEvent("nnos-user-updated"));
    } catch {}
    window.location.href = "/login";
  };

  const optionsConsultores = listaConsultores.map((c) => ({
    value: c.id,
    label: `${c.nome} (${c.perfil || "SÊNIOR"}${c.tipo === "socio" ? " • SÓCIO" : ""})`,
  }));

  return (
    <header className="top-header" style={{ position: "sticky", top: 0, zIndex: 30 }}>
      {/* Breadcrumb e Identificação */}
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
            Portal do Consultor
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
            {tituloPagina}
          </span>
        </div>

        {/* Seletor Oficial de Consultor EXCLUSIVO para ADMINISTRADOR em modo simulação */}
        {isUsuarioAdmin ? (
          <>
            <div style={{ height: "18px", width: "1px", backgroundColor: "var(--border)", margin: "0 4px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#b45309",
                  backgroundColor: "#fef3c7",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Ambiente de Testes e Simulação de Consultor (Exclusivo Administrador)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                  science
                </span>
                Simular:
              </span>

              <ModernDropdown
                value={consultorAtivo?.id || ""}
                onChange={(val) => selecionarConsultorPorId(String(val))}
                options={optionsConsultores}
                icon="support_agent"
                placeholder={carregando ? "Carregando consultores..." : "Selecionar Consultor..."}
                minWidth={280}
                searchable
                searchPlaceholder="Buscar consultor por nome..."
              />
            </div>
          </>
        ) : (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#0369a1",
              backgroundColor: "rgba(3, 105, 161, 0.1)",
              padding: "3px 9px",
              borderRadius: "999px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              marginLeft: "4px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
              verified_user
            </span>
            {consultorAtivo?.tipo === "socio" ? "Sócio Consultor" : "Consultor Especialista"}
          </span>
        )}
      </div>

      {/* Ações do Header */}
      <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <BotaoAjudaCentral />
        <ThemeToggle />

        {/* Botão Sair */}
        <button
          type="button"
          onClick={handleLogout}
          className="btn-header-logout"
          title="Encerrar sessão e ir para a tela de Login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "6px 12px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface-container-low)",
            color: "var(--on-surface-variant)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
            logout
          </span>
          <span>Sair</span>
        </button>

        {/* Perfil do Consultor - Clicável para Foto, Senha e Google MFA */}
        <div
          className="header-user"
          onClick={() => setModalPerfilAberto(true)}
          title="Clique para alterar sua foto de perfil, senha ou Google Authenticator"
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "4px 8px 4px 10px",
            borderRadius: "12px",
            transition: "background-color 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-container)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <div className="user-details" style={{ textAlign: "right" }}>
            <strong style={{ fontSize: "12.5px", color: "var(--primary)", display: "block", lineHeight: 1.2 }}>
              {consultorIdentidade.nome}
            </strong>
            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block", lineHeight: 1.2 }}>
              {consultorIdentidade.cargo}
            </span>
          </div>

          <div
            className="user-avatar"
            style={{
              position: "relative",
              backgroundColor: "#e0f2fe",
              color: "#0369a1",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              overflow: "visible",
            }}
          >
            {consultorIdentidade.fotoUrl ? (
              <img
                src={consultorIdentidade.fotoUrl}
                alt={consultorIdentidade.nome}
                style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: "13px", fontWeight: 800 }}>
                {obterIniciais(consultorIdentidade.nome)}
              </span>
            )}

            {/* Badge de Câmera */}
            <span
              style={{
                position: "absolute",
                bottom: "-2px",
                right: "-2px",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                backgroundColor: "#0284c7",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid #ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              }}
              title="Alterar Foto de Perfil"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>
                photo_camera
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Modal Oficial de Perfil do Usuário (Foto, Senha e Google MFA) */}
      <ModalPerfilUsuario
        aberto={modalPerfilAberto}
        onFechar={() => setModalPerfilAberto(false)}
        identidade={consultorIdentidade}
        onFotoAtualizada={(novaFoto) => {
          const login = consultorIdentidade.login;
          setFotosPorChave((prev) => ({
            ...prev,
            [login]: novaFoto,
            [consultorIdentidade.nome.toUpperCase()]: novaFoto,
          }));
        }}
      />
    </header>
  );
}
