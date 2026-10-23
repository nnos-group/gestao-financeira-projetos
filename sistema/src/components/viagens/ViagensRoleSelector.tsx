"use client";

import React from "react";

export type ViagensPerfil = "AGENCIA" | "LIDER" | "FINANCEIRO" | "CONSULTOR";

interface ViagensRoleSelectorProps {
  perfilAtivo: ViagensPerfil;
  onChangePerfil: (perfil: ViagensPerfil) => void;
}

export default function ViagensRoleSelector({
  perfilAtivo,
  onChangePerfil,
}: ViagensRoleSelectorProps) {
  const perfis = [
    {
      id: "AGENCIA" as ViagensPerfil,
      nome: "Agência de Viagens",
      icone: "travel_explore",
      descricao: "Cotações, contratações e vouchers",
      badgeColor: "rgba(0, 168, 150, 0.15)",
      textColor: "var(--secondary, #00a896)",
    },
    {
      id: "LIDER" as ViagensPerfil,
      nome: "Líder de Projeto",
      icone: "supervised_user_circle",
      descricao: "Análise comparativa e aprovação",
      badgeColor: "rgba(15, 42, 74, 0.12)",
      textColor: "var(--primary, #0f2a4a)",
    },
    {
      id: "FINANCEIRO" as ViagensPerfil,
      nome: "Financeiro",
      icone: "account_balance",
      descricao: "Prestação de contas e diárias",
      badgeColor: "rgba(217, 119, 6, 0.15)",
      textColor: "#d97706",
    },
    {
      id: "CONSULTOR" as ViagensPerfil,
      nome: "Consultor",
      icone: "badge",
      descricao: "Vouchers emitidos e aprovação de recebimento",
      badgeColor: "rgba(37, 99, 235, 0.15)",
      textColor: "#2563eb",
    },
  ];

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "var(--surface-container, #f1f5f9)",
      padding: "4px",
      borderRadius: "10px",
      border: "1px solid var(--border, #e2e8f0)",
    }}>
      {perfis.map((p) => {
        const isSelected = perfilAtivo === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChangePerfil(p.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: isSelected ? 700 : 500,
              color: isSelected ? "var(--on-surface, #0f172a)" : "var(--on-surface-variant, #64748b)",
              backgroundColor: isSelected ? "var(--surface, #ffffff)" : "transparent",
              border: isSelected ? "1px solid var(--border, #cbd5e1)" : "1px solid transparent",
              boxShadow: isSelected ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px", color: isSelected ? p.textColor : "inherit" }}
            >
              {p.icone}
            </span>
            <span>{p.nome}</span>
          </button>
        );
      })}
    </div>
  );
}
