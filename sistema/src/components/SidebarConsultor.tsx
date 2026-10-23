"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useConsultor } from "@/contexts/ConsultorContext";

export function SidebarConsultor() {
  const pathname = usePathname() || "";
  const { consultorAtivo, dadosConsultor } = useConsultor();

  const itens = [
    { href: "/consultor", label: "Visão Geral", icon: "dashboard" },
    {
      href: "/consultor/agenda",
      label: "Minha Agenda",
      icon: "calendar_today",
      badge: dadosConsultor?.lancamentos?.length ? String(dadosConsultor.lancamentos.length) : undefined,
    },
    {
      href: "/consultor/viagens",
      label: "Minhas Viagens",
      icon: "flight_takeoff",
      badge: dadosConsultor?.viagens?.length ? String(dadosConsultor.viagens.length) : undefined,
    },
    {
      href: "/consultor/bms",
      label: "Meus BMs",
      icon: "receipt_long",
      badge: dadosConsultor?.kpis?.bmsPendentes ? `${dadosConsultor.kpis.bmsPendentes} pend` : undefined,
      badgeColor: dadosConsultor?.kpis?.bmsPendentes ? "#f97316" : undefined,
    },
    { href: "/consultor/pagamentos", label: "Meus Pagamentos", icon: "payments" },
  ];

  return (
    <>
      <div className="sidebar-brand">
        <img src="/logo-coruja.png" alt="Logo Coruja NNÓS" className="sidebar-brand-img" />
        <div className="sidebar-brand-text">
          <h2 style={{ lineHeight: "1.2", textTransform: "uppercase" }}>
            PORTAL DO<br />CONSULTOR
          </h2>
        </div>
      </div>

      <nav className="sidebar-nav">
        <a href="/medicao" className="nav-item">
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Voltar ao Sistema</span>
        </a>

        {itens.map((i) => {
          const isActive = pathname === i.href;
          return (
            <a
              key={i.href}
              href={i.href}
              className={`nav-item${isActive ? " active" : ""}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="material-symbols-outlined">{i.icon}</span>
                <span>{i.label}</span>
              </div>
              {i.badge && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "999px",
                    backgroundColor: i.badgeColor || (isActive ? "var(--primary)" : "var(--surface-container-high)"),
                    color: i.badgeColor ? "#ffffff" : (isActive ? "#ffffff" : "var(--on-surface-variant)"),
                  }}
                >
                  {i.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Footer com dados do consultor */}
      <div className="sidebar-footer" style={{ marginTop: "auto" }}>
        <div
          className="sidebar-footer-info"
          style={{
            padding: "10px 14px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            backgroundColor: "var(--surface-container-lowest)",
            borderRadius: "0 0 12px 12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontFamily: "'Material Symbols Outlined'", fontSize: "14px", color: "var(--primary)" }}>
              location_on
            </span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface)" }}>
              {consultorAtivo?.cidade_base || "Belo Horizonte / MG"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontFamily: "'Material Symbols Outlined'", fontSize: "14px", color: "var(--secondary)" }}>
              flight
            </span>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
              {consultorAtivo?.aeroporto_preferencial || "CNF (Confins / BH)"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default SidebarConsultor;
