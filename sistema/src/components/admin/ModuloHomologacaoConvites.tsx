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

const OPCOES_FILTRO_STATUS = [
  { value: "TODOS", label: "Status: Todos os Status" },
  { value: "PENDENTE", label: "Status: Pendentes de Envio" },
  { value: "CONVITE_ENVIADO", label: "Status: Convites Enviados" },
  { value: "EM_VALIDACAO", label: "Status: Em Validação" },
  { value: "HOMOLOGADO", label: "Status: Homologados" },
];

const OPCOES_FILTRO_GRUPO = [
  { value: "LIDERES_E_AGENCIA", label: "Grupo Prioritário: Líderes + Agência Fátima" },
  { value: "TODOS", label: "Todos os Usuários da Base" },
  { value: "LIDER", label: "Perfil: Líderes de Projeto" },
  { value: "AGENCIA", label: "Perfil: Agência de Viagens FÁTIMA" },
  { value: "FINANCEIRO", label: "Perfil: Financeiro & Controladoria" },
  { value: "DIRETORIA", label: "Perfil: Diretoria Executiva" },
  { value: "SOCIO", label: "Perfil: Sócio Consultor" },
  { value: "CONSULTOR", label: "Perfil: Consultor / Instrutor" },
  { value: "ADMIN", label: "Perfil: Administrador" },
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

function obterCorAvatar(perfilId: string, nome: string): { bg: string; color: string } {
  const n = (nome || "").toUpperCase();
  if (n.includes("LEONARDO")) return { bg: "#0f172a", color: "#ffffff" };
  if (n.includes("MARCELA")) return { bg: "#2563eb", color: "#ffffff" };
  if (n.includes("TIAGO")) return { bg: "#4f46e5", color: "#ffffff" };
  if (n.includes("FATIMA") || n.includes("FÁTIMA") || perfilId === "AGENCIA") return { bg: "#d97706", color: "#ffffff" };
  if (n.includes("CARLOS") || perfilId === "SOCIO") return { bg: "#9333ea", color: "#ffffff" };
  if (perfilId === "FINANCEIRO") return { bg: "#059669", color: "#ffffff" };
  if (perfilId === "DIRETORIA") return { bg: "#1e3a8a", color: "#ffffff" };
  return { bg: "#0284c7", color: "#ffffff" };
}

export default function ModuloHomologacaoConvites({ perfis, onToast }: Props) {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [homologacoes, setHomologacoes] = useState<Record<string, { status: string; conviteEnviadoEm: string | null; apontamentos: string }>>({});

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("LIDERES_E_AGENCIA");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");

  // Seleção de linhas para disparo em massa
  const [selecionados, setSelecionados] = useState<string[]>([]);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 5;

  // Modal de Prévia de E-mail
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<any | null>(null);
  const [modalEmailAberto, setModalEmailAberto] = useState(false);

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

  // Registrar Envio de E-mail Individual
  const handleRegistrarDisparo = async (user: any) => {
    await handleAtualizarStatus(user, "CONVITE_ENVIADO");
    onToast(`Convite de homologação registrado para ${user.nome}!`);
  };

  // Disparo em Massa dos Selecionados
  const handleDispararSelecionados = async () => {
    if (selecionados.length === 0) {
      onToast("Selecione ao menos um usuário para disparar os convites.");
      return;
    }

    const agoraStr = formatarDataHoraBR(new Date().toISOString());
    let novoMapa = { ...homologacoes };

    for (const userId of selecionados) {
      const user = usuarios.find((u) => u.id === userId);
      if (!user) continue;

      novoMapa[userId] = {
        ...(novoMapa[userId] || { status: "PENDENTE", conviteEnviadoEm: null, apontamentos: "" }),
        status: "CONVITE_ENVIADO",
        conviteEnviadoEm: agoraStr,
      };

      try {
        await fetch("/api/admin/logs-acesso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuarioLogin: user.login,
            usuarioNome: user.nome,
            usuarioEmail: user.email,
            perfilId: user.perfilId,
            evento: "CONVITE_HOMOLOGACAO_EM_MASSA",
            metodo: "Módulo Homologação & Convites (Disparo em Massa)",
            status: "SUCESSO",
            detalhes: `Convite de homologação disparado em lote por Leonardo Campos.`,
          }),
        });
      } catch {}
    }

    salvarHomologacoes(novoMapa);
    onToast(`🚀 ${selecionados.length} convite(s) disparado(s) e registrados no log com sucesso!`);
    setSelecionados([]);
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

  // Paginação dos dados
  const totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / itensPorPagina));
  const usuariosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return usuariosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [usuariosFiltrados, paginaAtual, itensPorPagina]);

  // Selecionar / Deselecionar Linha
  const toggleSelecionar = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Selecionar Todos da Página
  const todosPaginaSelecionados =
    usuariosPaginados.length > 0 &&
    usuariosPaginados.every((u) => selecionados.includes(u.id));

  const toggleSelecionarTodosPagina = () => {
    if (todosPaginaSelecionados) {
      const idsPagina = usuariosPaginados.map((u) => u.id);
      setSelecionados((prev) => prev.filter((id) => !idsPagina.includes(id)));
    } else {
      const idsPagina = usuariosPaginados.map((u) => u.id);
      setSelecionados((prev) => Array.from(new Set([...prev, ...idsPagina])));
    }
  };

  // Copiar para Área de Transferência
  const handleCopiarTexto = (texto: string, rotulo: string) => {
    navigator.clipboard.writeText(texto);
    onToast(`${rotulo} copiado para a área de transferência!`);
  };

  // Gerador de Texto Completo do E-mail
  const gerarTextoEmailPuro = (user: any) => {
    const ehAgencia = user.perfilId === "AGENCIA" || user.email.includes("fcconsultoriadeviagens") || user.login.includes("agencia");
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
1. Solicitações de Logística (/viagens): Verifique se as informações transmitidas das turmas (origem, destino, concessionária, datas de ida/volta e necessidade de bagagem) estão claras e completas para cotação.
2. Matriz de Cotação (/viagens): Teste a inserção das opções de voo, valores de hotel e traslados, avaliando se o formato atende a agilidade necessária no dia a dia.
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
🦉 DÚVIDAS? UTILIZE O GUIA E O AGENTE DE IA:
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
🦉 DÚVIDAS? UTILIZE O GUIA E O AGENTE DE IA:
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", paddingBottom: "70px" }}>
      {/* =================================================================== */}
      {/* 1. CARDS DE MÉTRICAS KPI (ESTILOS PUROS EM LINHA)                   */}
      {/* =================================================================== */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: "16px",
          width: "100%",
        }}
      >
        {/* Metric 1: Total na Base */}
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest, #ffffff)",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid var(--border, #e2e8f0)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
              Total na Base
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
              {contadores.total}
            </div>
            <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "inline-block" }}>
              Usuários cadastrados
            </span>
          </div>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              backgroundColor: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>group</span>
          </div>
        </div>

        {/* Metric 2: Pendentes de Envio (Destaque Âmbar com Barra Lateral) */}
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest, #ffffff)",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid var(--border, #e2e8f0)",
            borderLeft: "4px solid #f59e0b",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#d97706" }}>
              Pendentes de Envio
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#d97706", marginTop: "4px" }}>
              {contadores.pendentes}
            </div>
            <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "inline-block" }}>
              Aguardando disparo oficial
            </span>
          </div>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              backgroundColor: "#fffbeb",
              color: "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>mail</span>
          </div>
        </div>

        {/* Metric 3: Convites Disparados */}
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest, #ffffff)",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid var(--border, #e2e8f0)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
              Convites Disparados
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#334155", marginTop: "4px" }}>
              {contadores.enviados}
            </div>
            <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "inline-block" }}>
              Aguardando 1º acesso
            </span>
          </div>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              backgroundColor: "#f1f5f9",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>send</span>
          </div>
        </div>

        {/* Metric 4: Homologados */}
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest, #ffffff)",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid var(--border, #e2e8f0)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#059669" }}>
              Homologados
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
              {contadores.homologados}
            </div>
            <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "inline-block" }}>
              Validação de perfil concluída
            </span>
          </div>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              backgroundColor: "#ecfdf5",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>verified</span>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 2. BANNER DE HOMOLOGAÇÃO ATIVA                                      */}
      {/* =================================================================== */}
      <section
        style={{
          background: "linear-gradient(to right, #eff6ff 0%, #f0f9ff 50%, #ffffff 100%)",
          borderRadius: "16px",
          border: "1px solid #bfdbfe",
          padding: "18px 22px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: "280px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>rocket_launch</span>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                Fase de Homologação Ativa • Exercício 2026
              </h4>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  backgroundColor: "#dbeafe",
                  color: "#1e40af",
                  padding: "2px 8px",
                  borderRadius: "6px",
                }}
              >
                Homologação Oficial
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>
              Link oficial de acesso (Login):{" "}
              <a
                href={URL_OFICIAL_LOGIN}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700, color: "#1d4ed8", textDecoration: "none" }}
              >
                {URL_OFICIAL_LOGIN}
              </a>{" "}
              <span style={{ margin: "0 8px", color: "#cbd5e1" }}>|</span>{" "}
              Canal de suporte e apontamentos:{" "}
              <strong style={{ color: "#1e293b" }}>Microsoft Teams da Equipe de Gestão NNÓS</strong>
            </p>
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
            padding: "9px 16px",
            borderRadius: "10px",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
          }}
        >
          <span>Testar Link Oficial</span>
          <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>open_in_new</span>
        </a>
      </section>

      {/* =================================================================== */}
      {/* 3. BARRA DE FILTROS & AÇÕES EM MASSA                                */}
      {/* =================================================================== */}
      <section
        style={{
          backgroundColor: "var(--surface-container-lowest, #ffffff)",
          borderRadius: "16px",
          border: "1px solid var(--border, #e2e8f0)",
          padding: "14px 18px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Campo de Busca */}
        <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
          <span
            className="material-symbols-outlined"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
              fontSize: "18px",
              pointerEvents: "none",
            }}
          >
            search
          </span>
          <input
            type="text"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPaginaAtual(1);
            }}
            placeholder="Buscar por nome, login ou e-mail..."
            style={{
              width: "100%",
              padding: "8px 12px 8px 38px",
              backgroundColor: "#f8fafc",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--on-surface, #0f172a)",
              outline: "none",
            }}
          />
        </div>

        {/* Filtros em Dropdown & Ações */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <ModernDropdown
            value={filtroGrupo}
            onChange={(val) => {
              setFiltroGrupo(String(val));
              setPaginaAtual(1);
            }}
            options={OPCOES_FILTRO_GRUPO}
            icon="star"
            minWidth={280}
            searchable={false}
          />

          <ModernDropdown
            value={filtroStatus}
            onChange={(val) => {
              setFiltroStatus(String(val));
              setPaginaAtual(1);
            }}
            options={OPCOES_FILTRO_STATUS}
            icon="filter_list"
            minWidth={240}
            searchable={false}
          />

          {/* Botão Ver Pendentes Prioritários */}
          <button
            type="button"
            onClick={() => {
              setFiltroGrupo("LIDERES_E_AGENCIA");
              setFiltroStatus("PENDENTE");
              setPaginaAtual(1);
              onToast("Filtrando grupo prioritário pendente de envio!");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              backgroundColor: "#0f2a4a",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(15,42,74,0.15)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#fbbf24" }}>bolt</span>
            <span>Ver Pendentes Prioritários</span>
          </button>

          {/* Botão Disparar Selecionados em Massa */}
          <button
            type="button"
            onClick={handleDispararSelecionados}
            disabled={selecionados.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              backgroundColor: selecionados.length > 0 ? "#ecfdf5" : "#f1f5f9",
              color: selecionados.length > 0 ? "#047857" : "#94a3b8",
              border: selecionados.length > 0 ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
              fontSize: "12px",
              fontWeight: 700,
              cursor: selecionados.length > 0 ? "pointer" : "not-allowed",
              transition: "all 0.15s ease",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>send</span>
            <span>Disparar Selecionados ({selecionados.length})</span>
          </button>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 4. TABELA DE HOMOLOGAÇÃO DE USUÁRIOS                                */}
      {/* =================================================================== */}
      <section
        style={{
          backgroundColor: "var(--surface-container-lowest, #ffffff)",
          borderRadius: "16px",
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12.5px" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "#f8fafc",
                  borderBottom: "1px solid var(--border, #e2e8f0)",
                  color: "#64748b",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ padding: "14px 16px", width: "40px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={todosPaginaSelecionados}
                    onChange={toggleSelecionarTodosPagina}
                    style={{ cursor: "pointer", width: "15px", height: "15px" }}
                    title="Selecionar todos da página atual"
                  />
                </th>
                <th style={{ padding: "14px 16px" }}>Usuário / Identificação</th>
                <th style={{ padding: "14px 16px" }}>Perfil Vinculado</th>
                <th style={{ padding: "14px 16px" }}>Status de Homologação</th>
                <th style={{ padding: "14px 16px" }}>Envio do Convite</th>
                <th style={{ padding: "14px 20px", textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    Carregando base de usuários...
                  </td>
                </tr>
              ) : usuariosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    Nenhum usuário encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                usuariosPaginados.map((u) => {
                  const perfilObj = perfis.find((p) => p.id === u.perfilId) || {
                    nome: u.perfilId,
                    sigla: u.perfilId,
                    icone: "person",
                    cor: "#0284c7",
                    bgCor: "#e0f2fe",
                  };

                  const homoInfo = homologacoes[u.id] || {
                    status: "PENDENTE",
                    conviteEnviadoEm: null,
                    apontamentos: "",
                  };

                  const ehPrioritario = u.perfilId === "LIDER" || u.perfilId === "AGENCIA";
                  const avatarColor = obterCorAvatar(u.perfilId, u.nome);
                  const isChecked = selecionados.includes(u.id);

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        backgroundColor: isChecked ? "rgba(239, 246, 255, 0.4)" : "transparent",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isChecked) e.currentTarget.style.backgroundColor = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        if (!isChecked) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      {/* Checkbox de Seleção */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelecionar(u.id)}
                          style={{ cursor: "pointer", width: "15px", height: "15px" }}
                        />
                      </td>

                      {/* Usuário / Identificação */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              backgroundColor: avatarColor.bg,
                              color: avatarColor.color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "12px",
                              flexShrink: 0,
                              boxShadow: "0 0 0 2px #f1f5f9",
                            }}
                          >
                            {obterIniciais(u.nome)}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13.5px" }}>
                                {u.nome}
                              </span>
                              {ehPrioritario && (
                                <span
                                  style={{
                                    backgroundColor: "#fef3c7",
                                    color: "#92400e",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                  }}
                                >
                                  Prioritário
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: "11.5px", color: "#64748b", marginTop: "1px", display: "block" }}>
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Perfil Vinculado */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            backgroundColor: perfilObj.bgCor,
                            color: perfilObj.cor,
                            border: `1px solid ${perfilObj.cor}33`,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                            {perfilObj.icone || "badge"}
                          </span>
                          <span>{perfilObj.nome}</span>
                        </span>
                      </td>

                      {/* Status de Homologação */}
                      <td style={{ padding: "14px 16px" }}>
                        {homoInfo.status === "HOMOLOGADO" && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                              backgroundColor: "#ecfdf5",
                              color: "#059669",
                              border: "1px solid #a7f3d0",
                            }}
                          >
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }} />
                            <span>Homologado</span>
                          </span>
                        )}
                        {homoInfo.status === "CONVITE_ENVIADO" && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                              backgroundColor: "#eff6ff",
                              color: "#1d4ed8",
                              border: "1px solid #bfdbfe",
                            }}
                          >
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#3b82f6" }} />
                            <span>Convite Enviado</span>
                          </span>
                        )}
                        {homoInfo.status === "EM_VALIDACAO" && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                              backgroundColor: "#faf5ff",
                              color: "#7e22ce",
                              border: "1px solid #e9d5ff",
                            }}
                          >
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#a855f7" }} />
                            <span>Em Validação</span>
                          </span>
                        )}
                        {homoInfo.status === "PENDENTE" && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                              backgroundColor: "#fffbeb",
                              color: "#b45309",
                              border: "1px solid #fde68a",
                            }}
                          >
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                            <span>Pendente de Envio</span>
                          </span>
                        )}
                      </td>

                      {/* Envio do Convite */}
                      <td style={{ padding: "14px 16px", color: "#64748b", fontSize: "11.5px" }}>
                        {homoInfo.conviteEnviadoEm ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1d4ed8", fontWeight: 600 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#2563eb" }}>
                              check_circle
                            </span>
                            <span>{homoInfo.conviteEnviadoEm}</span>
                          </div>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#94a3b8" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>schedule</span>
                            <span>Aguardando disparo</span>
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: "14px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                          {/* Botão Disparar -> Abre Modal Oficial */}
                          <button
                            type="button"
                            onClick={() => {
                              setUsuarioSelecionado(u);
                              setModalEmailAberto(true);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "6px 14px",
                              borderRadius: "8px",
                              backgroundColor: "#0f2a4a",
                              color: "#ffffff",
                              fontSize: "12px",
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                              boxShadow: "0 1px 3px rgba(15,42,74,0.2)",
                            }}
                            title="Visualizar e enviar convite oficial"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>send</span>
                            <span>Disparar</span>
                          </button>

                          {/* Copiar Link de Login Individual */}
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto(URL_OFICIAL_LOGIN, "Link Oficial da Tela de Login")}
                            style={{
                              padding: "6px",
                              borderRadius: "8px",
                              backgroundColor: "transparent",
                              color: "#64748b",
                              border: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title="Copiar Link Oficial de Acesso"
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>content_copy</span>
                          </button>

                          {/* Alternar Status Rápido */}
                          <button
                            type="button"
                            onClick={() => {
                              const proximo =
                                homoInfo.status === "PENDENTE"
                                  ? "CONVITE_ENVIADO"
                                  : homoInfo.status === "CONVITE_ENVIADO"
                                  ? "EM_VALIDACAO"
                                  : homoInfo.status === "EM_VALIDACAO"
                                  ? "HOMOLOGADO"
                                  : "PENDENTE";
                              handleAtualizarStatus(u, proximo as any);
                            }}
                            style={{
                              padding: "6px",
                              borderRadius: "8px",
                              backgroundColor: "transparent",
                              color: "#64748b",
                              border: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title="Alternar Status de Homologação"
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>sync</span>
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

        {/* Rodapé da Tabela com Paginação */}
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "12px 20px",
            borderTop: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          <p style={{ margin: 0 }}>
            Exibindo <span style={{ fontWeight: 700, color: "#0f172a" }}>{usuariosFiltrados.length === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1}</span> a{" "}
            <span style={{ fontWeight: 700, color: "#0f172a" }}>{Math.min(paginaAtual * itensPorPagina, usuariosFiltrados.length)}</span> de{" "}
            <span style={{ fontWeight: 700, color: "#0f172a" }}>{usuariosFiltrados.length}</span> usuários cadastrados
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              disabled={paginaAtual <= 1}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
                backgroundColor: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                color: paginaAtual <= 1 ? "#cbd5e1" : "#475569",
                cursor: paginaAtual <= 1 ? "not-allowed" : "pointer",
              }}
            >
              Anterior
            </button>

            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setPaginaAtual(num)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: paginaAtual === num ? "none" : "1px solid var(--border, #e2e8f0)",
                  backgroundColor: paginaAtual === num ? "#0f2a4a" : "#ffffff",
                  color: paginaAtual === num ? "#ffffff" : "#475569",
                  cursor: "pointer",
                }}
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual >= totalPaginas}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
                backgroundColor: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                color: paginaAtual >= totalPaginas ? "#cbd5e1" : "#475569",
                cursor: paginaAtual >= totalPaginas ? "not-allowed" : "pointer",
              }}
            >
              Próximo
            </button>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 5. MODAL DE PRÉVIA & DISPARO DO E-MAIL (DESIGN OFICIAL EXECUTIVO)   */}
      {/* =================================================================== */}
      {modalEmailAberto && usuarioSelecionado && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 10000,
          }}
          onClick={() => setModalEmailAberto(false)}
        >
          <section
            aria-labelledby="modal-title"
            aria-modal="true"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "880px",
              maxHeight: "92vh",
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              boxShadow: "0 25px 50px -12px rgba(15, 42, 74, 0.25)",
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header do Modal */}
            <header
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #f1f5f9",
                backgroundColor: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    backgroundColor: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0284c7",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                    mark_email_read
                  </span>
                </div>
                <div>
                  <h1
                    id="modal-title"
                    style={{
                      margin: 0,
                      fontSize: "17px",
                      fontWeight: 800,
                      color: "#0f172a",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>E-mail Oficial de Homologação</span>
                    <span style={{ color: "#94a3b8", fontWeight: 300 }}>•</span>
                    <span>{usuarioSelecionado.nome}</span>
                  </h1>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#64748b", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span>
                      Destinatário:{" "}
                      <a href={`mailto:${usuarioSelecionado.email}`} style={{ color: "#0369a1", fontWeight: 600, textDecoration: "none" }}>
                        {usuarioSelecionado.email}
                      </a>
                    </span>
                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      Perfil:{" "}
                      <span
                        style={{
                          backgroundColor: "#f1f5f9",
                          color: "#334155",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {usuarioSelecionado.perfilId}
                      </span>
                    </span>
                  </p>
                </div>
              </div>

              {/* Botão Fechar Modal */}
              <button
                type="button"
                onClick={() => setModalEmailAberto(false)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#f8fafc",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                title="Fechar"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
              </button>
            </header>

            {/* Corpo do E-mail (Visualização Estruturada em Cartão) */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                backgroundColor: "#f8fafc",
              }}
            >
              <article
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  padding: "28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  fontSize: "13.5px",
                  lineHeight: "1.65",
                  color: "#334155",
                }}
              >
                {/* Linha do Assunto */}
                <div style={{ paddingBottom: "14px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "baseline", gap: "10px" }}>
                  <span style={{ fontWeight: 800, color: "#0f172a", flexShrink: 0 }}>Assunto:</span>
                  <span style={{ fontWeight: 700, color: "#0c4a6e" }}>
                    {usuarioSelecionado.perfilId === "AGENCIA" ? (
                      <>✈️ Novo Módulo de Viagens &amp; Logística NNÓS | Acesso para Homologação e Testes Operacionais</>
                    ) : (
                      <>🚀 Boas-vindas ao novo Sistema NNÓS | Convocação para Homologação e Validação de Processos</>
                    )}
                  </span>
                </div>

                {/* Saudação & Introdução */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", color: "#334155" }}>
                  <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                    Olá, {usuarioSelecionado.nome}, tudo bem?
                  </p>
                  {usuarioSelecionado.perfilId === "AGENCIA" ? (
                    <>
                      <p style={{ margin: 0 }}>
                        Gostaríamos de dar as boas-vindas ao novo módulo de <strong style={{ color: "#0f172a" }}>Viagens &amp; Logística</strong> do sistema corporativo da NNÓS Consultoria!
                      </p>
                      <p style={{ margin: 0 }}>
                        Criamos uma área totalmente dedicada à agência para facilitar, agilizar e centralizar a nossa comunicação diária: desde o recebimento das ordens logísticas geradas pelas turmas até o lançamento de opções de cotação e upload dos vouchers definitivos aos viajantes.
                      </p>
                      <p style={{ margin: 0 }}>
                        Como parceiros estratégicos da nossa operação logística, convidamos vocês para testar a ferramenta com as demandas reais e nos apontar quaisquer ajustes necessários antes da entrada em produção.
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0 }}>
                        É com grande entusiasmo que convidamos você para fazer parte do primeiro grupo de validação do novo sistema <strong style={{ color: "#0f172a" }}>NNÓS Gestão Financeira &amp; Projetos</strong>!
                      </p>
                      <p style={{ margin: 0 }}>
                        Desenvolvemos esta plataforma para integrar e desburocratizar a gestão dos nossos treinamentos, concentrando em um único lugar o planejamento de turmas, a logística de viagens, a emissão de Boletins de Medição (BM) com assinaturas digitais via Zoho Sign e a rentabilidade da sua carteira em tempo real.
                      </p>
                      <p style={{ margin: 0 }}>
                        Estamos na reta final para a liberação em produção e o seu olhar operacional é fundamental para garantirmos que a ferramenta reflita com 100% de precisão os processos e a dinâmica real do nosso dia a dia.
                      </p>
                    </>
                  )}
                </div>

                {/* Seção 1: Escopo de Validação Estruturado */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    borderRadius: "14px",
                    padding: "20px",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 800,
                      color: "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>🎯</span>{" "}
                    <span>
                      {usuarioSelecionado.perfilId === "AGENCIA"
                        ? "FOCO PRINCIPAL DA VALIDAÇÃO PELA AGÊNCIA FÁTIMA:"
                        : "O QUE PRECISAMOS QUE VOCÊ TESTE E VALIDE:"}
                    </span>
                  </h2>

                  {usuarioSelecionado.perfilId === "AGENCIA" ? (
                    <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>1.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Solicitações de Logística</strong>{" "}
                          <code style={{ fontSize: "11px", fontFamily: "monospace", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0369a1" }}>/viagens</code>:
                          {" "}Verifique se as informações transmitidas das turmas (origem, destino, concessionária, datas de ida/volta e necessidade de bagagem) estão claras e completas para cotação.
                        </div>
                      </li>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>2.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Matriz de Cotação</strong>{" "}
                          <code style={{ fontSize: "11px", fontFamily: "monospace", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0369a1" }}>/viagens</code>:
                          {" "}Teste a inserção das opções de voo, valores de hotel e traslados, avaliando se o formato atende a agilidade necessária no dia a dia.
                        </div>
                      </li>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>3.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Políticas de Viagem</strong>:
                          {" "}No card de Políticas de Viagem, vocês têm acesso direto aos PDFs oficiais (NNÓS, CNH Training, Iveco Group e Reembolso Vexpenses) para conferência rápida de limites de diárias e prestação de contas.
                        </div>
                      </li>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>4.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Upload de Vouchers</strong>:
                          {" "}Teste o envio de vouchers em PDF para conferência do viajante.
                        </div>
                      </li>
                    </ol>
                  ) : (
                    <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>1.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Projetos &amp; Atividades</strong>{" "}
                          <code style={{ fontSize: "11px", fontFamily: "monospace", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0369a1" }}>/projetos</code>:
                          {" "}Crie e consulte turmas da sua carteira, verifique as concessões/cidades, a carga horária (8h, 24h ou 40h) e a alocação de instrutores parceiros ou sócios (incluindo o acréscimo de 6% quando aplicável).
                        </div>
                      </li>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>2.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Viagens &amp; Logística</strong>{" "}
                          <code style={{ fontSize: "11px", fontFamily: "monospace", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0369a1" }}>/viagens</code>:
                          {" "}Avalie as solicitações de deslocamento, confira as cotações lançadas pela Agência Fátima e o fluxo de aprovação técnica.
                        </div>
                      </li>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>3.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Boletins de Medição</strong>{" "}
                          <code style={{ fontSize: "11px", fontFamily: "monospace", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0369a1" }}>/medicao</code>:
                          {" "}Valide a conferência das horas apuradas da sua equipe e a experiência com o fluxo de assinatura digital (Zoho Sign).
                        </div>
                      </li>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>4.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Central de Relatórios</strong>{" "}
                          <code style={{ fontSize: "11px", fontFamily: "monospace", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0369a1" }}>/relatorios</code>:
                          {" "}Confira os demonstrativos, custos diretos e margem da sua unidade de negócio.
                        </div>
                      </li>
                    </ol>
                  )}
                </div>

                {/* Seção 2: Credenciais de Acesso (Caixa Âmbar Destacada) */}
                <div
                  style={{
                    backgroundColor: "#fffbeb",
                    borderRadius: "14px",
                    padding: "20px",
                    border: "1px solid #fde68a",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 800,
                      color: "#78350f",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>🔑</span> SEUS DADOS DE ACESSO:
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ color: "#475569" }}>• Link Oficial (Tela de Login):</span>
                      <a
                        href={URL_OFICIAL_LOGIN}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#0284c7", fontWeight: 700, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        {URL_OFICIAL_LOGIN}
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                      </a>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#475569" }}>• Seu Usuário / Login:</span>
                      <span style={{ fontWeight: 800, color: "#0f172a", backgroundColor: "#ffffff", padding: "2px 8px", borderRadius: "6px", border: "1px solid #fde68a", fontFamily: "monospace", fontSize: "12px" }}>
                        {usuarioSelecionado.login || (usuarioSelecionado.perfilId === "AGENCIA" ? "agencia.fatima" : "usuario")}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#475569" }}>• E-mail Cadastrado:</span>
                      <span style={{ fontWeight: 700, color: "#1e293b" }}>{usuarioSelecionado.email}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#475569" }}>• Senha Inicial:</span>
                      <span style={{ fontWeight: 800, color: "#0f172a", backgroundColor: "#ffffff", padding: "2px 8px", borderRadius: "6px", border: "1px solid #fde68a", fontFamily: "monospace", fontSize: "12px" }}>
                        {usuarioSelecionado.senha || (usuarioSelecionado.perfilId === "AGENCIA" ? "viagem2026" : "nnos2026")}
                      </span>
                    </div>
                    {usuarioSelecionado.perfilId === "AGENCIA" && (
                      <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#92400e", fontWeight: 600 }}>
                        * Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no módulo de Viagens &amp; Logística (/viagens).
                      </p>
                    )}
                  </div>
                </div>

                {/* Seção 3: Suporte Integrado com Guia & Agente de IA */}
                <div
                  style={{
                    backgroundColor: "#f0f9ff",
                    borderRadius: "14px",
                    padding: "16px 18px",
                    border: "1px solid #bae6fd",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    fontSize: "12.5px",
                    color: "#0369a1",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      backgroundColor: "#0284c7",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>psychology</span>
                  </div>
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", marginBottom: "2px" }}>
                      Dúvidas? Utilize o Guia de Processos e o Agente de IA:
                    </strong>
                    Dentro do sistema, clique no botão flutuante <strong>"Ajuda &amp; IA"</strong> (ícone da coruja) para consultar o passo a passo de todas as telas ou tirar dúvidas conceituais diretamente com a IA da NNÓS.
                  </div>
                </div>

                {/* Seção 4: Canal de Apontamentos & Assinatura */}
                <div style={{ paddingTop: "10px", borderTop: "1px solid #f1f5f9", fontSize: "12.5px", color: "#475569", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <p style={{ margin: 0 }}>
                    Pedimos que qualquer processo divergente, sugestão ou ajuste seja enviado pelo canal de{" "}
                    <strong style={{ color: "#0f172a" }}>Microsoft Teams da Equipe de Gestão NNÓS</strong> ou respondendo a este e-mail indicando:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px", color: "#64748b" }}>
                    <li>Em qual tela você estava navegando;</li>
                    <li>O que ocorreu de diferente do seu processo real;</li>
                    <li>Sugestão de melhoria ou print da tela.</li>
                  </ul>
                  <div style={{ paddingTop: "10px" }}>
                    <p style={{ margin: 0, fontWeight: 700, color: "#1e293b" }}>
                      {usuarioSelecionado.perfilId === "AGENCIA" ? "Atenciosamente," : "Um abraço,"}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontWeight: 800, color: "#0f172a" }}>
                      Leonardo Campos &amp; Equipe de Gestão NNÓS
                    </p>
                    <p style={{ margin: "1px 0 0 0", color: "#94a3b8", fontSize: "11.5px" }}>
                      NNÓS Consultoria e Treinamento
                    </p>
                  </div>
                </div>
              </article>
            </div>

            {/* Rodapé do Modal com Ações Oficiais */}
            <footer
              style={{
                padding: "16px 24px",
                backgroundColor: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              {/* Ações Secundárias (Esquerda) */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    const txt = gerarTextoEmailPuro(usuarioSelecionado);
                    handleCopiarTexto(txt, "Texto completo do e-mail");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 16px",
                    borderRadius: "10px",
                    border: "1px solid #0284c7",
                    backgroundColor: "#ffffff",
                    color: "#0284c7",
                    fontSize: "12px",
                    fontWeight: 700,
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
                  )}&body=${encodeURIComponent(gerarTextoEmailPuro(usuarioSelecionado))}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 16px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontSize: "12px",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>open_in_new</span>
                  <span>Abrir no Aplicativo de E-mail</span>
                </a>
              </div>

              {/* Ação Primária (Direita) */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    handleRegistrarDisparo(usuarioSelecionado);
                    setModalEmailAberto(false);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 20px",
                    borderRadius: "10px",
                    backgroundColor: "#059669",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(5,150,105,0.25)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>check_circle</span>
                  <span>Registrar Envio &amp; Log</span>
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
