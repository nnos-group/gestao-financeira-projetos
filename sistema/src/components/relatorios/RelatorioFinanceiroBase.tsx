"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ResultadoFA, ResultadoDRE, ParametrosAno, MesAdministration } from "@/lib/dre-engine";

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export interface DadosRelatorio {
  ok: boolean;
  error?: string;
  ano: number;
  mesInicial: number;
  mesFinal: number;
  totalLancamentos: number;
  parametros: ParametrosAno;
  financialAnalysis: ResultadoFA;
  dre: ResultadoDRE;
  dreMensal: ResultadoDRE[];
  administracaoMensal?: MesAdministration[];
}

export const brl0 = (v: number) =>
  (Math.abs(v) < 0.5 ? 0 : v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const brl2 = (v: number) =>
  (Math.abs(v) < 0.005 ? 0 : v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (v: number, base: number) => (base ? `${((v / base) * 100).toFixed(1).replace(".", ",")}%` : "—");

// Formatação contábil para a DRE: números negativos entre parênteses ex: (1.303.910)
export const fmtDRE = (v: number, sinal?: -1 | 1) => {
  const x = sinal === -1 ? -v : v;
  const s = brl0(Math.abs(x));
  if (Math.abs(x) < 0.5) return "0";
  return x < 0 ? `(${s})` : s;
};

export function useRelatorioFinanceiro() {
  const [ano, setAno] = useState(2026);
  const [mesInicial, setMesInicial] = useState(1);
  const [mesFinal, setMesFinal] = useState(12);
  const [tipoReceita, setTipoReceita] = useState<"previsto" | "faturado">("previsto");
  const [dados, setDados] = useState<DadosRelatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await fetch(
        `/api/relatorios/financeiro?ano=${ano}&mesInicial=${mesInicial}&mesFinal=${mesFinal}&tipoReceita=${tipoReceita}`
      );
      const j: DadosRelatorio = await r.json();
      if (!j.ok) throw new Error(j.error || "Falha ao carregar");
      setDados(j);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setCarregando(false);
    }
  }, [ano, mesInicial, mesFinal, tipoReceita]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return {
    ano,
    setAno,
    mesInicial,
    setMesInicial,
    mesFinal,
    setMesFinal,
    tipoReceita,
    setTipoReceita,
    dados,
    carregando,
    erro,
    recarregar: carregar,
  };
}

const selStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)",
  background: "var(--surface-container-lowest)", fontSize: "13px", fontWeight: 600, color: "var(--on-surface)",
};

import ModernDropdown, { type DropdownOption } from "@/components/ModernDropdown";
export { ModernDropdown, type DropdownOption };



export function BarraFiltros(p: {
  ano: number; setAno: (n: number) => void;
  mesInicial: number; setMesInicial: (n: number) => void;
  mesFinal: number; setMesFinal: (n: number) => void;
}) {
  const anos: DropdownOption[] = [{ value: 2026, label: "2026" }];

  const isConsolidado = p.mesInicial === 1 && p.mesFinal === 12;
  const isMesUnico = p.mesInicial === p.mesFinal;
  const [isCustomMode, setIsCustomMode] = useState(!isConsolidado && !isMesUnico);

  useEffect(() => {
    if (!isConsolidado && !isMesUnico) {
      setIsCustomMode(true);
    }
  }, [isConsolidado, isMesUnico]);

  const selectValue = isCustomMode ? "custom" : isConsolidado ? "0" : String(p.mesInicial);

  const opcoesVisaoMes: DropdownOption[] = [
    { value: "0", label: "CONSOLIDADO (Ano Todo)" },
    ...MESES.map((m, i) => ({ value: String(i + 1), label: m.toUpperCase() })),
    { value: "custom", label: "Período Customizado (De/Até)" },
  ];

  const opcoesMeses: DropdownOption[] = MESES.map((m, i) => ({
    value: String(i + 1),
    label: m,
  }));

  const labelStyle: React.CSSProperties = {
    fontSize: "10.5px",
    fontWeight: 800,
    color: "var(--on-surface-variant)",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    display: "block",
    marginBottom: "4px",
  };

  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
      {/* 1. ANO */}
      <div>
        <span style={labelStyle}>Ano</span>
        <ModernDropdown
          value={p.ano}
          onChange={(val) => p.setAno(Number(val))}
          options={anos}
          icon="calendar_today"
          minWidth="105px"
        />
      </div>

      {/* 2. VISÃO / MÊS */}
      <div>
        <span style={labelStyle}>Visão / Mês</span>
        <ModernDropdown
          value={selectValue}
          onChange={(val) => {
            const v = String(val);
            if (v === "0") {
              setIsCustomMode(false);
              p.setMesInicial(1);
              p.setMesFinal(12);
            } else if (v === "custom") {
              setIsCustomMode(true);
            } else {
              setIsCustomMode(false);
              const m = Number(v);
              p.setMesInicial(m);
              p.setMesFinal(m);
            }
          }}
          options={opcoesVisaoMes}
          icon="date_range"
          minWidth="245px"
        />
      </div>

      {isCustomMode && (
        <>
          {/* DE */}
          <div>
            <span style={labelStyle}>De</span>
            <ModernDropdown
              value={String(p.mesInicial)}
              onChange={(val) => {
                const m = Number(val);
                p.setMesInicial(m);
                if (m > p.mesFinal) p.setMesFinal(m);
              }}
              options={opcoesMeses}
              icon="first_page"
              minWidth="130px"
            />
          </div>

          {/* ATÉ */}
          <div>
            <span style={labelStyle}>Até</span>
            <ModernDropdown
              value={String(p.mesFinal)}
              onChange={(val) => {
                const m = Number(val);
                p.setMesFinal(m);
                if (m < p.mesInicial) p.setMesInicial(m);
              }}
              options={opcoesMeses}
              icon="last_page"
              minWidth="130px"
            />
          </div>
        </>
      )}
    </div>
  );
}

// Input monetário sem setas (spinners) no formato brasileiro 0.000,00 - com fonte sans-serif moderna
export function InputMoedaBR({
  valor,
  onChange,
  width = 96,
}: {
  valor: number;
  onChange: (v: number) => void;
  width?: number | string;
}) {
  const [texto, setTexto] = useState(() => brl2(valor));

  useEffect(() => {
    setTexto(brl2(valor));
  }, [valor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTexto(raw);
    const limpo = raw.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(limpo);
    if (!isNaN(num)) {
      onChange(num);
    } else if (raw.trim() === "" || raw.trim() === "-") {
      onChange(0);
    }
  };

  const handleBlur = () => {
    setTexto(brl2(valor));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={texto}
      onChange={handleChange}
      onBlur={handleBlur}
      style={{
        width,
        padding: "6px 10px",
        textAlign: "right",
        fontSize: "12px",
        fontFamily: "var(--font-jakarta), Inter, -apple-system, sans-serif",
        fontWeight: 600,
        borderRadius: "6px",
        border: "1px solid #cbd5e1",
        background: "#ffffff",
        color: "#0f172a",
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}
