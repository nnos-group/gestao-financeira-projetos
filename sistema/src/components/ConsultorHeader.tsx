"use client";

import React from "react";
import ThemeToggle from "@/components/ThemeToggle";
import ModernDropdown from "@/components/ModernDropdown";
import { useConsultor } from "@/contexts/ConsultorContext";

interface ConsultorHeaderProps {
  tituloPagina?: string;
}

export default function ConsultorHeader({ tituloPagina = "Visão Geral" }: ConsultorHeaderProps) {
  const { consultorAtivo, selecionarConsultorPorId, listaConsultores, carregando } = useConsultor();

  const optionsConsultores = listaConsultores.map((c) => ({
    value: c.id,
    label: `${c.nome} (${c.perfil || "SÊNIOR"}${c.tipo === "socio" ? " • SÓCIO" : ""})`,
  }));

  return (
    <header className="top-header" style={{ position: "sticky", top: 0, zIndex: 30 }}>
      {/* Breadcrumb e Seletor de Simulação */}
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

        {/* Separador Visual */}
        <div style={{ height: "18px", width: "1px", backgroundColor: "var(--border)", margin: "0 4px" }} />

        {/* Seletor Oficial de Consultor (ModernDropdown) */}
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
            title="Ambiente de Testes e Simulação de Consultor"
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
      </div>

      {/* Ações do Header */}
      <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <ThemeToggle />

        {/* Perfil do Consultor Simulado */}
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
