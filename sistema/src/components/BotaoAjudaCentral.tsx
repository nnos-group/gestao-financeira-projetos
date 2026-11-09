"use client";

import React, { useState } from "react";
import AjudaCentralModal from "@/components/AjudaCentralModal";

interface BotaoAjudaCentralProps {
  variante?: "header" | "flutuante" | "compacto";
  abaPadrao?: "GUIA" | "IA";
}

export default function BotaoAjudaCentral({
  variante = "header",
  abaPadrao = "GUIA",
}: BotaoAjudaCentralProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState<"GUIA" | "IA">(abaPadrao);

  const abrirModal = (aba: "GUIA" | "IA" = "GUIA") => {
    setAbaSelecionada(aba);
    setModalAberto(true);
  };

  if (variante === "flutuante") {
    return (
      <>
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => abrirModal("IA")}
            style={{
              height: "46px",
              padding: "0 18px",
              borderRadius: "23px",
              backgroundColor: "#0284c7",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 8px 24px rgba(2, 132, 199, 0.4)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              fontWeight: 700,
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            title="Abrir Agente de IA e Guia de Processos"
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
              smart_toy
            </span>
            <span>Ajuda & IA</span>
          </button>
        </div>

        <AjudaCentralModal
          aberto={modalAberto}
          aoFechar={() => setModalAberto(false)}
          abaInicial={abaSelecionada}
        />
      </>
    );
  }

  if (variante === "compacto") {
    return (
      <>
        <button
          type="button"
          onClick={() => abrirModal("GUIA")}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Ajuda e Manual de Processos"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            help
          </span>
        </button>

        <AjudaCentralModal
          aberto={modalAberto}
          aoFechar={() => setModalAberto(false)}
          abaInicial={abaSelecionada}
        />
      </>
    );
  }

  // Variante Padrão: Header
  return (
    <>
      <button
        type="button"
        onClick={() => abrirModal("GUIA")}
        className="btn-header-ajuda"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "10px",
          border: "1px solid rgba(2, 132, 199, 0.35)",
          backgroundColor: "rgba(2, 132, 199, 0.08)",
          color: "#0284c7",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
        title="Ajuda: Guia de Processos Passo a Passo e Agente de IA"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#0284c7";
          e.currentTarget.style.color = "#ffffff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(2, 132, 199, 0.08)";
          e.currentTarget.style.color = "#0284c7";
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
          help
        </span>
        <span>Ajuda</span>
      </button>

      <AjudaCentralModal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        abaInicial={abaSelecionada}
      />
    </>
  );
}
