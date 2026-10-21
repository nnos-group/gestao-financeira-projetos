"use client";

import React from "react";

export default function NovaAtividadeBotao() {
  const handleClick = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("abrir-modal-nova-atividade"));
    }
  };

  return (
    <button
      type="button"
      className="btn-primary"
      onClick={handleClick}
      title="Cadastrar uma nova atividade operacional"
      id="btn-trigger-nova-atividade"
    >
      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
        add_circle
      </span>
      <span>Nova Atividade</span>
    </button>
  );
}
