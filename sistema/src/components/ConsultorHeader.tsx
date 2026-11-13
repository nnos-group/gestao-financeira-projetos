"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import ModernDropdown from "@/components/ModernDropdown";
import BotaoAjudaCentral from "@/components/BotaoAjudaCentral";
import { useConsultor } from "@/contexts/ConsultorContext";

interface ConsultorHeaderProps {
  tituloPagina?: string;
}

export default function ConsultorHeader({ tituloPagina = "Visão Geral" }: ConsultorHeaderProps) {
  const router = useRouter();
  const { consultorAtivo, selecionarConsultorPorId, listaConsultores, carregando } = useConsultor();
  const [usuarioLogado, setUsuarioLogado] = useState<any | null>(null);

  useEffect(() => {
    const carregarUsuario = () => {
      try {
        const saved = localStorage.getItem("nnos_usuario_logado_v1");
        if (saved) {
          setUsuarioLogado(JSON.parse(saved));
        } else {
          setUsuarioLogado(null);
        }
      } catch {}
    };

    carregarUsuario();
    window.addEventListener("nnos-user-updated", carregarUsuario);
    return () => window.removeEventListener("nnos-user-updated", carregarUsuario);
  }, []);

  const isUsuarioAdmin = !usuarioLogado || usuarioLogado.perfilId === "ADMIN";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "LOGOUT",
          login: usuarioLogado?.login || consultorAtivo?.nome || "consultor",
          nome: consultorAtivo?.nome,
          perfilId: usuarioLogado?.perfilId || "CONSULTOR",
        }),
      });
    } catch {}
    try {
      localStorage.removeItem("nnos_usuario_logado_v1");
      localStorage.removeItem("nnos_consultor_simulado_id");
      localStorage.removeItem("nnos_consultor_simulado_nome");
      localStorage.removeItem("nnos_consultor_simulado_obj");
      window.dispatchEvent(new CustomEvent("nnos-user-updated"));
    } catch {}
    router.push("/login");
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

        {/* Perfil do Consultor */}
        <div className="header-user" style={{ cursor: "default" }}>
          <div className="user-details" style={{ textAlign: "right" }}>
            <strong style={{ fontSize: "12px", color: "var(--primary)" }}>
              {consultorAtivo?.nome || "Carregando..."}
            </strong>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
              {consultorAtivo?.tipo === "socio" ? "Sócio / Parceiro" : (consultorAtivo?.perfil || "Consultor")}
            </span>
          </div>
          <div
            className="user-avatar"
            style={{
              backgroundColor: "#e0f2fe",
              color: "#0369a1",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
              badge
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
