"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface AnoSelectorProps {
  anosDisponiveis: number[];
  anoAtual: number;
  mesAtual?: number | null;
  basePath?: string;
}

export default function AnoSelector({
  anosDisponiveis,
  anoAtual,
  mesAtual,
  basePath = "/projetos",
}: AnoSelectorProps) {
  const router = useRouter();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <select
        value={anoAtual}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(e) => {
          const novoAno = e.target.value;
          const queryMes = mesAtual ? `&mes=${mesAtual}` : "";
          router.push(`${basePath}?ano=${novoAno}${queryMes}`);
        }}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          padding: "5px 30px 5px 12px",
          borderRadius: "8px",
          border: isFocused ? "1px solid var(--primary, #002b49)" : "1px solid var(--border, #cbd5e1)",
          backgroundColor: isFocused ? "var(--surface-container-lowest, #ffffff)" : "var(--surface-container-low, #f8fafc)",
          color: "var(--primary, #002b49)",
          fontFamily: "var(--font-jakarta), var(--font-inter), sans-serif",
          fontSize: "13px",
          fontWeight: 700,
          cursor: "pointer",
          outline: "none",
          boxShadow: isFocused ? "0 0 0 2px rgba(0, 48, 87, 0.14)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
          transition: "all 0.15s ease",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23002b49' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
          backgroundSize: "14px 14px",
        }}
        title="Filtrar por ano que possui lançamentos de atividades"
      >
        {anosDisponiveis.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}
