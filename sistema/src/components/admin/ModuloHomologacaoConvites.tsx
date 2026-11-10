"use client";

import React, { useState, useEffect, useMemo } from "react";
import ModernDropdown from "@/components/ModernDropdown";
import { formatarDataHoraBR } from "@/lib/date-utils";

interface Props {
  perfis: any[];
  onToast: (msg: string) => void;
}

export interface RegistroHomologacao {
  usuarioId: string;
  login: string;
  nome: string;
  email: string;
  cargo: string;
  perfilId: string;
  senhaInicial: string;
  status: "PENDENTE" | "CONVITE_ENVIADO" | "EM_VALIDACAO" | "HOMOLOGADO";
  conviteEnviadoEm: string | null;
  ultimoAcessoEm: string | null;
  apontamentos: string;
}

const URL_OFICIAL_LOGIN = "https://gestao-financeira-projetos.vercel.app/login";
const URL_OFICIAL_SISTEMA = URL_OFICIAL_LOGIN;

const OPCOES_FILTRO_STATUS = [
  { value: "TODOS", label: "Todos os Status de Homologação" },
  { value: "PENDENTE", label: "Pendentes de Envio" },
  { value: "CONVITE_ENVIADO", label: "Convites Enviados" },
  { value: "EM_VALIDACAO", label: "Em Testes / Validação" },
  { value: "HOMOLOGADO", label: "Homologados / Aprovados" },
];

const OPCOES_FILTRO_GRUPO = [
  { value: "TODOS", label: "Todos os Usuários da Base" },
  { value: "LIDERES_E_AGENCIA", label: "⭐ Grupo Prioritário: Líderes + Agência Fátima" },
  { value: "LIDER", label: "Líderes de Projeto" },
  { value: "AGENCIA", label: "Agência de Viagens FÁTIMA" },
  { value: "FINANCEIRO", label: "Controladoria & Financeiro" },
  { value: "DIRETORIA", label: "Diretoria Executiva" },
  { value: "CONSULTOR", label: "Consultores & Instrutores" },
  { value: "ADMIN", label: "Administradores" },
];

function obterIniciais(nome: string): string {
  const p = String(nome || "NN")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (p.length === 0) return "NN";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default function ModuloHomologacaoConvites({ perfis, onToast }: Props) {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [homologacoes, setHomologacoes] = useState<Record<string, { status: string; conviteEnviadoEm: string | null; apontamentos: string }>>({});

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("LIDERES_E_AGENCIA");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");

  // Modal de Prévia de E-mail
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<any | null>(null);
  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [abaTemplateEmail, setAbaTemplateEmail] = useState<"TEXTO" | "HTML">("TEXTO");

  // Carregar dados de usuários e estado de homologação
  const carregarDados = async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/admin/usuarios");
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.usuarios || []);
      }
    } catch (e) {
      console.error("Erro ao carregar usuários:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // Recupera status salvo localmente
    try {
      const salvo = localStorage.getItem("nnos_homologacao_controles_v1");
      if (salvo) {
        setHomologacoes(JSON.parse(salvo));
      }
    } catch {}
  }, []);

  const salvarHomologacoes = (novosDados: Record<string, any>) => {
    setHomologacoes(novosDados);
    try {
      localStorage.setItem("nnos_homologacao_controles_v1", JSON.stringify(novosDados));
    } catch {}
  };

  // Alterar Status de Homologação
  const handleAtualizarStatus = async (
    user: any,
    novoStatus: "PENDENTE" | "CONVITE_ENVIADO" | "EM_VALIDACAO" | "HOMOLOGADO"
  ) => {
    const agoraStr = formatarDataHoraBR(new Date().toISOString());
    const atual = homologacoes[user.id] || { status: "PENDENTE", conviteEnviadoEm: null, apontamentos: "" };

    const atualizado = {
      ...homologacoes,
      [user.id]: {
        ...atual,
        status: novoStatus,
        conviteEnviadoEm: novoStatus === "CONVITE_ENVIADO" ? agoraStr : atual.conviteEnviadoEm,
      },
    };

    salvarHomologacoes(atualizado);

    // Registra evento no Monitoramento de Log de Acesso
    try {
      await fetch("/api/admin/logs-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioLogin: user.login,
          usuarioNome: user.nome,
          usuarioEmail: user.email,
          perfilId: user.perfilId,
          evento: novoStatus === "CONVITE_ENVIADO" ? "CONVITE_HOMOLOGACAO" : `STATUS_${novoStatus}`,
          metodo: "Módulo Homologação & Convites",
          status: "SUCESSO",
          detalhes: `Status de homologação alterado para ${novoStatus} por Leonardo Campos.`,
        }),
      });
    } catch (e) {
      console.warn("Aviso ao registrar log:", e);
    }

    onToast(`Status de ${user.nome} atualizado para ${novoStatus}!`);
  };

  // Registrar Envio de E-mail
  const handleRegistrarDisparo = async (user: any) => {
    await handleAtualizarStatus(user, "CONVITE_ENVIADO");
    onToast(`Convite de homologação registrado para ${user.nome}!`);
  };

  // Gerador de Texto de E-mail Personalizado
  const gerarTextoEmail = (user: any) => {
    const ehAgencia = user.perfilId === "AGENCIA" || user.email.includes("fcconsultoriadeviagens") || user.login.includes("agencia");
    const ehLider = user.perfilId === "LIDER";
    const ehFinanceiro = user.perfilId === "FINANCEIRO";
    const linkAcesso = URL_OFICIAL_LOGIN;

    if (ehAgencia) {
      return `Assunto: ✈️ Novo Módulo de Viagens & Logística NNÓS | Acesso para Homologação e Testes Operacionais

Olá, Fátima e Equipe, tudo bem?

Gostaríamos de dar as boas-vindas ao novo módulo de Viagens & Logística do sistema corporativo da NNÓS Consultoria!

Criamos uma área totalmente dedicada à agência para facilitar, agilizar e centralizar a nossa comunicação diária: desde o recebimento das ordens logísticas geradas pelas turmas até o lançamento de opções de cotação e upload dos vouchers definitivos aos viajantes.

Como parceiros estratégicos da nossa operação logística, convidamos vocês para testar a ferramenta com as demandas reais e nos apontar quaisquer ajustes necessários antes da entrada em produção.

--------------------------------------------------
🎯 FOCO PRINCIPAL DA VALIDAÇÃO PELA AGÊNCIA FÁTIMA:
--------------------------------------------------
1. Solicitações de Logística: Verifique se as informações transmitidas das turmas (origem, destino, concessionária, datas de ida/volta e necessidade de bagagem) estão claras e completas para cotação.
2. Matriz de Cotação: Teste a inserção das opções de voo, valores de hotel e traslados, avaliando se o formato atende a agilidade necessária no dia a dia.
3. Políticas de Viagem: No card de Políticas de Viagem, vocês têm acesso direto aos PDFs oficiais (NNÓS, CNH Training, Iveco Group e Reembolso Vexpenses) para conferência rápida de limites de diárias e prestação de contas.
4. Upload de Vouchers: Teste o envio de vouchers em PDF para conferência do viajante.

--------------------------------------------------
🔑 SEUS DADOS DE ACESSO:
--------------------------------------------------
- Link Oficial de Acesso (Tela de Login): ${linkAcesso}
- Seu Usuário / Login: ${user.login || "agencia.fatima"}
- E-mail: ${user.email}
- Senha Inicial: ${user.senha || "viagem2026"}
* Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no módulo de Viagens & Logística (/viagens).

--------------------------------------------------
🦉 DUVIDAS? UTILIZE O GUIA E O AGENTE DE IA:
--------------------------------------------------
Dentro do sistema, clique no botão "Ajuda & IA" (com o ícone da coruja) para consultar o passo a passo de todas as telas ou tirar dúvidas diretamente com o Guia Virtual NNÓS.

--------------------------------------------------
📝 CANAL DE APONTAMENTOS E MELHORIAS:
--------------------------------------------------
Pedimos que qualquer processo divergente, sugestão ou ajuste seja enviado pelo canal de Microsoft Teams da Equipe de Gestão NNÓS ou respondendo a este e-mail.

Muito obrigado pela parceria contínua!

Atenciosamente,
Leonardo Campos & Equipe de Gestão NNÓS
NNÓS Consultoria e Treinamento`;
    }

    // Template para Líderes de Projeto e demais usuários corporativos
    return `Assunto: 🚀 Boas-vindas ao novo Sistema NNÓS | Convocação para Homologação e Validação de Processos

Olá, ${user.nome}, tudo bem?

É com grande entusiasmo que convidamos você para fazer parte do primeiro grupo de validação do novo sistema NNÓS Gestão Financeira & Projetos!

Desenvolvemos esta plataforma para integrar e desburocratizar a gestão dos nossos treinamentos, concentrando em um único lugar o planejamento de turmas, a logística de viagens, a emissão de Boletins de Medição (BM) com assinaturas digitais via Zoho Sign e a rentabilidade da sua carteira em tempo real.

Estamos na reta final para a liberação em produção e o seu olhar operacional é fundamental para garantirmos que a ferramenta reflita com 100% de precisão os processos e a dinâmica real do nosso dia a dia.

--------------------------------------------------
🎯 O QUE PRECISAMOS QUE VOCÊ TESTE E VALIDE:
--------------------------------------------------
1. Projetos & Atividades (/projetos): Crie e consulte turmas da sua carteira, verifique as concessões/cidades, a carga horária (8h, 24h ou 40h) e a alocação de instrutores parceiros ou sócios (incluindo o acréscimo de 6% quando aplicável).
2. Viagens & Logística (/viagens): Avalie as solicitações de deslocamento, confira as cotações lançadas pela Agência Fátima e o fluxo de aprovação técnica.
3. Boletins de Medição (/medicao): Valide a conferência das horas apuradas da sua equipe e a experiência com o fluxo de assinatura digital (Zoho Sign).
4. Central de Relatórios (/relatorios): Confira os demonstrativos, custos diretos e margem da sua unidade de negócio.

--------------------------------------------------
🔑 SEUS DADOS DE ACESSO:
--------------------------------------------------
- Link Oficial de Acesso (Tela de Login): ${linkAcesso}
- Seu Usuário / Login: ${user.login}
- E-mail Cadastrado: ${user.email}
- Senha Inicial: ${user.senha || "nnos2026"}

--------------------------------------------------
🦉 DUVIDAS? UTILIZE O GUIA E O AGENTE DE IA:
--------------------------------------------------
No topo direito (ou no botão flutuante com o ícone da coruja), clique em "Ajuda & IA":
- Na aba Guia de Processos, você encontra o passo a passo e o macrofluxo das 7 etapas da NNÓS.
- Na aba Agente de IA NNÓS, faça perguntas com suas próprias palavras para tirar dúvidas sobre regras corporativas.

--------------------------------------------------
📝 COMO ENVIAR SEUS APONTAMENTOS DE MELHORIA:
--------------------------------------------------
Pedimos que envie seus feedbacks, processos divergentes ou sugestões diretamente pelo canal de Microsoft Teams da Equipe de Gestão NNÓS ou respondendo a este e-mail indicando:
1. Em qual tela você estava navegando;
2. O que ocorreu de diferente do seu processo real;
3. Sugestão de melhoria ou print da tela.

Contamos muito com sua colaboração para colocarmos no ar o melhor sistema de gestão que a NNÓS já teve!

Um abraço,
Leonardo Campos & Equipe de Gestão NNÓS
NNÓS Consultoria e Treinamento`;
  };

  // Filtragem dos Usuários
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      // 1. Filtro por Grupo / Perfil
      if (filtroGrupo === "LIDERES_E_AGENCIA") {
        if (u.perfilId !== "LIDER" && u.perfilId !== "AGENCIA") return false;
      } else if (filtroGrupo !== "TODOS" && u.perfilId !== filtroGrupo) {
        return false;
      }

      // 2. Filtro por Status de Homologação
      const statusUser = homologacoes[u.id]?.status || "PENDENTE";
      if (filtroStatus !== "TODOS" && statusUser !== filtroStatus) {
        return false;
      }

      // 3. Busca por texto
      if (!busca.trim()) return true;
      const b = busca.toLowerCase();
      return (
        u.nome?.toLowerCase().includes(b) ||
        u.email?.toLowerCase().includes(b) ||
        u.login?.toLowerCase().includes(b) ||
        u.cargo?.toLowerCase().includes(b)
      );
    });
  }, [usuarios, filtroGrupo, filtroStatus, busca, homologacoes]);

  // Contadores do Painel
  const contadores = useMemo(() => {
    const total = usuarios.length;
    let pendentes = 0;
    let enviados = 0;
    let emValidacao = 0;
    let homologados = 0;

    usuarios.forEach((u) => {
      const st = homologacoes[u.id]?.status || "PENDENTE";
      if (st === "PENDENTE") pendentes++;
      else if (st === "CONVITE_ENVIADO") enviados++;
      else if (st === "EM_VALIDACAO") emValidacao++;
      else if (st === "HOMOLOGADO") homologados++;
    });

    return { total, pendentes, enviados, emValidacao, homologados };
  }, [usuarios, homologacoes]);

  // Copiar para Área de Transferência
  const handleCopiarTexto = (texto: string, rotulo: string) => {
    navigator.clipboard.writeText(texto);
    onToast(`${rotulo} copiado para a área de transferência!`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Cards de Métricas de Homologação */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>
              Total na Base
            </span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--primary)", marginTop: "2px" }}>
              {contadores.total}
            </div>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Usuários cadastrados</span>
          </div>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: "#f0f9ff", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>group</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>
              Pendentes de Envio
            </span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#d97706", marginTop: "2px" }}>
              {contadores.pendentes}
            </div>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Aguardando disparo</span>
          </div>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: "#fef3c7", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>mark_email_unread</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", textTransform: "uppercase" }}>
              Convites Disparados
            </span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#0284c7", marginTop: "2px" }}>
              {contadores.enviados}
            </div>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Aguardando 1º acesso</span>
          </div>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: "#e0f2fe", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>forward_to_inbox</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>
              Homologados
            </span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#16a34a", marginTop: "2px" }}>
              {contadores.homologados}
            </div>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Validação concluída</span>
          </div>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>verified</span>
          </div>
        </div>
      </div>

      {/* Banner Informativo com Link Oficial e Canal Teams */}
      <div
        style={{
          padding: "16px 20px",
          borderRadius: "14px",
          backgroundColor: "#f0f9ff",
          border: "1px solid #bae6fd",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#0284c7", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>rocket_launch</span>
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f2a4a" }}>
              Fase de Homologação Ativa • Exercício 2026
            </div>
            <div style={{ fontSize: "12px", color: "#0369a1", marginTop: "2px" }}>
              Link oficial de acesso (Login): <strong>{URL_OFICIAL_LOGIN}</strong> | Canal de suporte e apontamentos: <strong>Microsoft Teams da Equipe de Gestão NNÓS</strong>
            </div>
          </div>
        </div>

        <a
          href={URL_OFICIAL_LOGIN}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "8px",
            backgroundColor: "#0284c7",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <span>Testar Link Oficial</span>
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>open_in_new</span>
        </a>
      </div>

      {/* Barra de Filtros e Busca */}
      <div
        style={{
          backgroundColor: "var(--surface-container-lowest)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", flex: 1 }}>
          <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
            <span
              className="material-symbols-outlined"
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "18px", color: "#94a3b8" }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por nome, login ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                fontSize: "12.5px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface-container-low)",
                color: "var(--on-surface)",
                outline: "none",
              }}
            />
          </div>

          <ModernDropdown
            value={filtroGrupo}
            onChange={(val) => setFiltroGrupo(String(val))}
            options={OPCOES_FILTRO_GRUPO}
            icon="filter_list"
            minWidth={280}
            searchable={false}
          />

          <ModernDropdown
            value={filtroStatus}
            onChange={(val) => setFiltroStatus(String(val))}
            options={OPCOES_FILTRO_STATUS}
            icon="checklist"
            minWidth={240}
            searchable={false}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setFiltroGrupo("LIDERES_E_AGENCIA");
            setFiltroStatus("PENDENTE");
            onToast("Filtrando grupo prioritário pendente de envio!");
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "10px",
            backgroundColor: "#00152f",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#f59e0b" }}>star</span>
          <span>Ver Pendentes Prioritários</span>
        </button>
      </div>

      {/* Tabela de Usuários & Status de Homologação */}
      <div
        style={{
          backgroundColor: "var(--surface-container-lowest)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--surface-container-low)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px 16px", fontWeight: 800, color: "var(--on-surface-variant)", textTransform: "uppercase", fontSize: "11px" }}>
                  Usuário / Identificação
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 800, color: "var(--on-surface-variant)", textTransform: "uppercase", fontSize: "11px" }}>
                  Perfil Vinculado
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 800, color: "var(--on-surface-variant)", textTransform: "uppercase", fontSize: "11px" }}>
                  Status de Homologação
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 800, color: "var(--on-surface-variant)", textTransform: "uppercase", fontSize: "11px" }}>
                  Envio do Convite
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 800, color: "var(--on-surface-variant)", textTransform: "uppercase", fontSize: "11px", textAlign: "right" }}>
                  Ações de Homologação
                </th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                    Carregando usuários da base...
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                    Nenhum usuário encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => {
                  const perfilObj = perfis.find((p) => p.id === u.perfilId) || {
                    nome: u.perfilId,
                    sigla: u.perfilId,
                    cor: "#0284c7",
                    bgCor: "#e0f2fe",
                  };
                  const homoInfo = homologacoes[u.id] || { status: "PENDENTE", conviteEnviadoEm: null, apontamentos: "" };
                  const ehPrioritario = u.perfilId === "LIDER" || u.perfilId === "AGENCIA";

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        transition: "background-color 0.1s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-container-low)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      {/* Usuário / Identificação */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              backgroundColor: perfilObj.bgCor || "#e0f2fe",
                              color: perfilObj.cor || "#0f2a4a",
                              fontWeight: 800,
                              fontSize: "12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {obterIniciais(u.nome)}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontWeight: 700, color: "var(--primary)" }}>{u.nome}</span>
                              {ehPrioritario && (
                                <span style={{ fontSize: "9px", fontWeight: 800, backgroundColor: "#fef3c7", color: "#d97706", padding: "1px 5px", borderRadius: "4px" }}>
                                  PRIORITÁRIO
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                              {u.email} • <span style={{ fontFamily: "monospace" }}>login: {u.login}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Perfil Vinculado */}
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "999px",
                            fontSize: "10.5px",
                            fontWeight: 800,
                            backgroundColor: perfilObj.bgCor,
                            color: perfilObj.cor,
                            textTransform: "uppercase",
                          }}
                        >
                          {perfilObj.nome}
                        </span>
                      </td>

                      {/* Status de Homologação */}
                      <td style={{ padding: "12px 16px" }}>
                        <select
                          value={homoInfo.status}
                          onChange={(e) => handleAtualizarStatus(u, e.target.value as any)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "8px",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            border: "1px solid var(--border)",
                            backgroundColor:
                              homoInfo.status === "HOMOLOGADO"
                                ? "#dcfce7"
                                : homoInfo.status === "CONVITE_ENVIADO"
                                ? "#e0f2fe"
                                : homoInfo.status === "EM_VALIDACAO"
                                ? "#fef3c7"
                                : "#f1f5f9",
                            color:
                              homoInfo.status === "HOMOLOGADO"
                                ? "#15803d"
                                : homoInfo.status === "CONVITE_ENVIADO"
                                ? "#0369a1"
                                : homoInfo.status === "EM_VALIDACAO"
                                ? "#b45309"
                                : "#475569",
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value="PENDENTE">⏳ Pendente de Envio</option>
                          <option value="CONVITE_ENVIADO">📨 Convite Enviado</option>
                          <option value="EM_VALIDACAO">🔍 Em Testes / Validação</option>
                          <option value="HOMOLOGADO">✅ Homologado / Aprovado</option>
                        </select>
                      </td>

                      {/* Envio do Convite */}
                      <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "11.5px" }}>
                        {homoInfo.conviteEnviadoEm ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#0369a1", fontWeight: 600 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>check_circle</span>
                            <span>{homoInfo.conviteEnviadoEm}</span>
                          </div>
                        ) : (
                          <span>Não enviado</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setUsuarioSelecionado(u);
                              setModalEmailAberto(true);
                            }}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              backgroundColor: "#0284c7",
                              color: "#ffffff",
                              fontSize: "11.5px",
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title="Visualizar e copiar o e-mail de boas-vindas deste usuário"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>mail</span>
                            <span>Ver E-mail</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const txt = gerarTextoEmail(u);
                              handleCopiarTexto(txt, `E-mail de ${u.nome}`);
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "8px",
                              backgroundColor: "var(--surface-container-low)",
                              color: "var(--primary)",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              border: "1px solid var(--border)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title="Copiar texto pronto para envio"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>content_copy</span>
                            <span>Copiar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRegistrarDisparo(u)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "8px",
                              backgroundColor: homoInfo.status === "CONVITE_ENVIADO" ? "#ecfdf5" : "transparent",
                              color: homoInfo.status === "CONVITE_ENVIADO" ? "#059669" : "#64748b",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              border: "1px solid var(--border)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title="Registrar que o convite foi enviado"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>send</span>
                            <span>Registrar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL DE PRÉ-VISUALIZAÇÃO & DISPARO DO E-MAIL             */}
      {/* ======================================================== */}
      {modalEmailAberto && usuarioSelecionado && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setModalEmailAberto(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "850px",
              maxHeight: "90vh",
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#e0f2fe", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>forward_to_inbox</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f2a4a" }}>
                    E-mail Oficial de Homologação • {usuarioSelecionado.nome}
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "#64748b" }}>
                    Destinatário: <strong>{usuarioSelecionado.email}</strong> • Perfil: <strong>{usuarioSelecionado.perfilId}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalEmailAberto(false)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: "#ffffff",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
              </button>
            </div>

            {/* Corpo do E-mail */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              <div
                style={{
                  padding: "18px 20px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  fontFamily: "monospace",
                  fontSize: "12.5px",
                  lineHeight: 1.6,
                  color: "#1e293b",
                  whiteSpace: "pre-wrap",
                }}
              >
                {gerarTextoEmail(usuarioSelecionado)}
              </div>
            </div>

            {/* Rodapé do Modal com Ações */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #f1f5f9",
                backgroundColor: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    const txt = gerarTextoEmail(usuarioSelecionado);
                    handleCopiarTexto(txt, "Texto completo do e-mail");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#0284c7",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>content_copy</span>
                  <span>Copiar Texto Completo</span>
                </button>

                <a
                  href={`mailto:${usuarioSelecionado.email}?subject=${encodeURIComponent(
                    usuarioSelecionado.perfilId === "AGENCIA"
                      ? "Novo Módulo de Viagens & Logística NNÓS | Acesso para Homologação"
                      : "Boas-vindas ao novo Sistema NNÓS | Convocação para Homologação"
                  )}&body=${encodeURIComponent(gerarTextoEmail(usuarioSelecionado))}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    color: "#0f2a4a",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>open_in_new</span>
                  <span>Abrir no Aplicativo de E-mail</span>
                </a>
              </div>

              <button
                type="button"
                onClick={() => {
                  handleRegistrarDisparo(usuarioSelecionado);
                  setModalEmailAberto(false);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  backgroundColor: "#059669",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>check_circle</span>
                <span>Registrar Envio &amp; Log</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

