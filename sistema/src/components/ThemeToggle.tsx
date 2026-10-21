"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const temaAtual = document.documentElement.getAttribute("data-theme");
    setIsDark(temaAtual === "dark");
  }, []);

  function alternar() {
    const proximo = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", proximo);
    setIsDark(!isDark);
    try {
      localStorage.setItem("tema", proximo);
    } catch {}
  }

  // Tooltip exibido ao passar o mouse conforme o print 1
  const textoTooltip = isDark ? "Modo Claro" : "Modo Escuro";

  return (
    <button
      id="btn-tema"
      type="button"
      className="btn-theme-toggle"
      onClick={alternar}
      title={textoTooltip}
      aria-label={textoTooltip}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "19px" }}>
        {mounted && isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
