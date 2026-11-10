"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import AjudaCentralModal from "@/components/AjudaCentralModal";

interface BotaoAjudaCentralProps {
  variante?: "header" | "flutuante" | "compacto";
  abaPadrao?: "GUIA" | "IA";
}

export default function BotaoAjudaCentral({
  variante = "header",
  abaPadrao = "GUIA",
}: BotaoAjudaCentralProps) {
  const pathname = usePathname();
  const [modalAberto, setModalAberto] = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState<"GUIA" | "IA">(abaPadrao);
  const [visivel, setVisivel] = useState(true);

  // Quando o usuário muda de tela (rota/pathname), o botão reaparece automaticamente
  useEffect(() => {
    setVisivel(true);
  }, [pathname]);

  const abrirModal = (aba: "GUIA" | "IA" = "GUIA") => {
    setAbaSelecionada(aba);
    setModalAberto(true);
  };

  if (variante === "flutuante") {
    if (!visivel) return null;

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
            gap: "6px",
          }}
        >
          <button
            type="button"
            onClick={() => abrirModal("IA")}
            style={{
              height: "46px",
              padding: "0 18px 0 10px",
              borderRadius: "23px",
              backgroundColor: "#0284c7",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              boxShadow: "0 8px 24px rgba(2, 132, 199, 0.4)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "13px",
              fontWeight: 700,
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            title="Abrir Agente de IA e Guia de Processos"
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img
                src="/logo-coruja.png"
                alt="Logo NNÓS"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  transform: "scale(1.18)",
                }}
              />
            </div>
            <span>Ajuda & IA</span>
          </button>

          {/* Botão para fechar/ocultar nesta tela (reaparece ao mudar de tela) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setVisivel(false);
            }}
            title="Ocultar botão nesta tela (reaparece ao navegar para outra página)"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              transition: "transform 0.15s ease, background-color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#dc2626")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0f172a")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
              close
            </span>
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
            backgroundColor: "#ffffff",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
            padding: "6px",
          }}
          title="Ajuda e Manual de Processos"
        >
          <img
            src="/logo-coruja.png"
            alt="Logo NNÓS"
            style={{ width: "22px", height: "22px", objectFit: "contain" }}
          />
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
          gap: "7px",
          padding: "5px 12px 5px 6px",
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
        <div
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <img
            src="/logo-coruja.png"
            alt="Logo NNÓS"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              transform: "scale(1.18)",
            }}
          />
        </div>
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
