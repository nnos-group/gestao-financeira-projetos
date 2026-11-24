"use client";

import React from "react";

export default function ExportarXlsBotao() {
  const handleClick = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("exportar-xls-atividades"));
    }
  };

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={handleClick}
      title="Extrair atividades filtradas para planilha Excel (.xlsx)"
      id="btn-trigger-exportar-xls"
    >
      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
        download
      </span>
      <span>Exportar XLS</span>
    </button>
  );
}
