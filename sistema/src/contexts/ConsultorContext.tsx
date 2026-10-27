"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { PessoaItem } from "@/lib/pessoas-data";

interface ConsultorContextType {
  consultorAtivo: PessoaItem | null;
  setConsultorAtivo: (consultor: PessoaItem) => void;
  selecionarConsultorPorId: (id: string) => void;
  listaConsultores: PessoaItem[];
  carregando: boolean;
  dadosConsultor: {
    kpis: {
      totalHoras: number;
      totalRepasse: number;
      totalProjetos: number;
      totalViagens: number;
      totalBms: number;
      bmsPendentes: number;
    };
    lancamentos: any[];
    projetos: any[];
    viagens: any[];
    bms: any[];
  } | null;
  recarregarDados: () => Promise<void>;
}

const ConsultorContext = createContext<ConsultorContextType | undefined>(undefined);

export function ConsultorProvider({ children }: { children: React.ReactNode }) {
  const [consultorAtivo, setConsultorAtivoState] = useState<PessoaItem | null>(null);
  const [listaConsultores, setListaConsultores] = useState<PessoaItem[]>([]);
  const [dadosConsultor, setDadosConsultor] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  // Inicialização imediata do consultor ativo salvo no localStorage (elimina delay percebido)
  useEffect(() => {
    try {
      const savedObjStr = localStorage.getItem("nnos_consultor_simulado_obj");
      if (savedObjStr) {
        const parsed = JSON.parse(savedObjStr);
        if (parsed && parsed.nome) {
          setConsultorAtivoState(parsed);
        }
      }
    } catch {}

    const savedId = localStorage.getItem("nnos_consultor_simulado_id") || undefined;
    const savedNome = localStorage.getItem("nnos_consultor_simulado_nome") || undefined;
    carregarDados(savedId, savedNome);
  }, []);

  const carregarDados = async (consultorId?: string, consultorNome?: string) => {
    try {
      setCarregando(true);
      const params = new URLSearchParams();
      if (consultorId) params.set("id", consultorId);
      if (consultorNome) params.set("nome", consultorNome);

      const res = await fetch(`/api/consultor?${params.toString()}`);
      if (!res.ok) throw new Error("Falha ao carregar dados do consultor");
      const data = await res.json();

      setConsultorAtivoState(data.consultorAtivo);
      if (data.todasPessoas) {
        setListaConsultores(data.todasPessoas);
      }
      setDadosConsultor({
        kpis: data.kpis,
        lancamentos: data.lancamentos || [],
        projetos: data.projetos || [],
        viagens: data.viagens || [],
        bms: data.bms || [],
      });

      if (data.consultorAtivo?.id) {
        localStorage.setItem("nnos_consultor_simulado_id", data.consultorAtivo.id);
        localStorage.setItem("nnos_consultor_simulado_nome", data.consultorAtivo.nome);
        localStorage.setItem("nnos_consultor_simulado_obj", JSON.stringify(data.consultorAtivo));
      }
    } catch (err) {
      console.error("Erro no ConsultorProvider:", err);
    } finally {
      setCarregando(false);
    }
  };

  const setConsultorAtivo = (c: PessoaItem) => {
    setConsultorAtivoState(c);
    localStorage.setItem("nnos_consultor_simulado_id", c.id);
    localStorage.setItem("nnos_consultor_simulado_nome", c.nome);
    localStorage.setItem("nnos_consultor_simulado_obj", JSON.stringify(c));
    carregarDados(c.id, c.nome);
  };

  const selecionarConsultorPorId = (id: string) => {
    const achado = listaConsultores.find((c) => c.id === id);
    if (achado) {
      setConsultorAtivo(achado);
    } else {
      carregarDados(id);
    }
  };

  return (
    <ConsultorContext.Provider
      value={{
        consultorAtivo,
        setConsultorAtivo,
        selecionarConsultorPorId,
        listaConsultores,
        carregando,
        dadosConsultor,
        recarregarDados: async () => {
          if (consultorAtivo) {
            await carregarDados(consultorAtivo.id, consultorAtivo.nome);
          }
        },
      }}
    >
      {children}
    </ConsultorContext.Provider>
  );
}

export function useConsultor() {
  const context = useContext(ConsultorContext);
  if (!context) {
    throw new Error("useConsultor deve ser usado dentro de um ConsultorProvider");
  }
  return context;
}
