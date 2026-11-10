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
    <div className="space-y-6" style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}>
      {/* =================================================================== */}
      {/* 1. CARDS DE MÉTRICAS KPI                                            */}
      {/* =================================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total na Base */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total na Base</span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">{contadores.total}</div>
            <span className="text-xs font-medium text-slate-500 mt-0.5 inline-block">Usuários cadastrados</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shadow-xs">
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>group</span>
          </div>
        </div>

        {/* Metric 2: Pendentes de Envio (Destaque Âmbar) */}
        <div className="bg-white rounded-2xl p-5 border-l-4 border-amber-500 border-y border-r border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Pendentes de Envio</span>
            <div className="text-3xl font-extrabold text-amber-600 mt-1">{contadores.pendentes}</div>
            <span className="text-xs font-medium text-slate-500 mt-0.5 inline-block">Aguardando disparo oficial</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl">
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>mail</span>
          </div>
        </div>

        {/* Metric 3: Convites Disparados */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Convites Disparados</span>
            <div className="text-3xl font-extrabold text-slate-700 mt-1">{contadores.enviados}</div>
            <span className="text-xs font-medium text-slate-500 mt-0.5 inline-block">Aguardando 1º acesso</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-2xl">
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>send</span>
          </div>
        </div>

        {/* Metric 4: Homologados */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Homologados</span>
            <div className="text-3xl font-extrabold text-emerald-600 mt-1">{contadores.homologados}</div>
            <span className="text-xs font-medium text-slate-500 mt-0.5 inline-block">Validação de perfil concluída</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl">
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>verified</span>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 2. BANNER DE HOMOLOGAÇÃO ATIVA                                      */}
      {/* =================================================================== */}
      <section className="bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-white rounded-2xl border border-blue-200/80 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>rocket_launch</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">Fase de Homologação Ativa • Exercício 2026</h4>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-md uppercase tracking-wider">
                  Homologação Oficial
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Link de acesso ao ambiente:{" "}
                <a
                  className="font-bold text-blue-700 hover:underline"
                  href={URL_OFICIAL_LOGIN}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {URL_OFICIAL_LOGIN}
                </a>
                <span className="hidden sm:inline mx-2 text-slate-300">|</span>
                <span className="block sm:inline mt-1 sm:mt-0 text-slate-500">
                  Canal de suporte &amp; apontamentos:{" "}
                  <strong className="text-slate-700">Microsoft Teams da Equipe de Gestão NNÓS</strong>
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-blue-600/20"
              href={URL_OFICIAL_LOGIN}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Testar Link Oficial</span>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>open_in_new</span>
            </a>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. BARRA DE FILTROS & AÇÕES EM MASSA                                */}
      {/* =================================================================== */}
      <section className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <span
              className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              style={{ fontSize: "18px" }}
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
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all outline-none"
            />
          </div>

          {/* Filtros em Dropdown & Ações */}
          <div className="flex flex-wrap items-center gap-2.5">
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
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-sm cursor-pointer"
              style={{ backgroundColor: "#0f2a4a" }}
            >
              <span className="material-symbols-outlined text-amber-400" style={{ fontSize: "17px" }}>bolt</span>
              <span>Ver Pendentes Prioritários</span>
            </button>

            {/* Botão Disparar Selecionados em Massa */}
            <button
              type="button"
              onClick={handleDispararSelecionados}
              disabled={selecionados.length === 0}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                selecionados.length > 0
                  ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300"
                  : "text-slate-400 bg-slate-100 border border-slate-200 opacity-60 cursor-not-allowed"
              }`}
            >
              <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: "17px" }}>send</span>
              <span>Disparar Selecionados ({selecionados.length})</span>
            </button>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 4. TABELA DE HOMOLOGAÇÃO DE USUÁRIOS                                */}
      {/* =================================================================== */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse" id="homologation-table">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 pl-6 pr-3 w-10" scope="col">
                  <input
                    type="checkbox"
                    checked={todosPaginaSelecionados}
                    onChange={toggleSelecionarTodosPagina}
                    className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900 cursor-pointer"
                    title="Selecionar todos da página atual"
                  />
                </th>
                <th className="py-3.5 px-4" scope="col">Usuário / Identificação</th>
                <th className="py-3.5 px-4" scope="col">Perfil Vinculado</th>
                <th className="py-3.5 px-4" scope="col">Status de Homologação</th>
                <th className="py-3.5 px-4" scope="col">Envio do Convite</th>
                <th className="py-3.5 pr-6 pl-4 text-right" scope="col">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {carregando ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Carregando base de usuários...
                  </td>
                </tr>
              ) : usuariosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
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
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isChecked ? "bg-blue-50/30" : ""
                      }`}
                    >
                      {/* Checkbox de Seleção */}
                      <td className="py-3.5 pl-6 pr-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelecionar(u.id)}
                          className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900 cursor-pointer"
                        />
                      </td>

                      {/* Usuário / Identificação */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-slate-100 shrink-0"
                            style={{ backgroundColor: avatarColor.bg, color: avatarColor.color }}
                          >
                            {obterIniciais(u.nome)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm block">{u.nome}</span>
                              {ehPrioritario && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                                  Prioritário
                                </span>
                              )}
                            </div>
                            <span className="text-slate-400 text-xs block">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Perfil Vinculado */}
                      <td className="py-3.5 px-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border"
                          style={{
                            backgroundColor: perfilObj.bgCor,
                            color: perfilObj.cor,
                            borderColor: `${perfilObj.cor}33`,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                            {perfilObj.icone || "badge"}
                          </span>
                          <span>{perfilObj.nome}</span>
                        </span>
                      </td>

                      {/* Status de Homologação */}
                      <td className="py-3.5 px-4">
                        {homoInfo.status === "HOMOLOGADO" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Homologado</span>
                          </span>
                        )}
                        {homoInfo.status === "CONVITE_ENVIADO" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span>Convite Enviado</span>
                          </span>
                        )}
                        {homoInfo.status === "EM_VALIDACAO" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                            <span>Em Validação</span>
                          </span>
                        )}
                        {homoInfo.status === "PENDENTE" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>Pendente de Envio</span>
                          </span>
                        )}
                      </td>

                      {/* Envio do Convite */}
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {homoInfo.conviteEnviadoEm ? (
                          <div className="flex items-center gap-1 text-blue-700 font-semibold text-xs">
                            <span className="material-symbols-outlined text-blue-600" style={{ fontSize: "16px" }}>
                              check_circle
                            </span>
                            <span>{homoInfo.conviteEnviadoEm}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>schedule</span>
                            <span>Aguardando disparo</span>
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 pr-6 pl-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Disparar -> Abre Modal com o E-mail formatado */}
                          <button
                            type="button"
                            onClick={() => {
                              setUsuarioSelecionado(u);
                              setModalEmailAberto(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-white font-semibold rounded-lg transition-colors text-xs shadow-2xs cursor-pointer"
                            style={{ backgroundColor: "#0f2a4a" }}
                            title="Visualizar e enviar convite oficial"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>send</span>
                            <span>Disparar</span>
                          </button>

                          {/* Copiar Link de Login Individual */}
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto(URL_OFICIAL_LOGIN, "Link Oficial da Tela de Login")}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Copiar Link Oficial de Acesso"
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
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Alternar Status de Homologação"
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
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            Exibindo <span className="font-bold text-slate-800">{usuariosFiltrados.length === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1}</span> a{" "}
            <span className="font-bold text-slate-800">{Math.min(paginaAtual * itensPorPagina, usuariosFiltrados.length)}</span> de{" "}
            <span className="font-bold text-slate-800">{usuariosFiltrados.length}</span> usuários cadastrados
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              disabled={paginaAtual <= 1}
              className={`px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium ${
                paginaAtual <= 1
                  ? "text-slate-400 cursor-not-allowed"
                  : "text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Anterior
            </button>

            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setPaginaAtual(num)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  paginaAtual === num
                    ? "bg-[#0f2a4a] text-white shadow-xs"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual >= totalPaginas}
              className={`px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium ${
                paginaAtual >= totalPaginas
                  ? "text-slate-400 cursor-not-allowed"
                  : "text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Próximo
            </button>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 5. MODAL DE PRÉVIA & DISPARO DO E-MAIL (DESIGN OFICIAL)              */}
      {/* =================================================================== */}
      {modalEmailAberto && usuarioSelecionado && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 z-50 animate-in fade-in duration-150"
          onClick={() => setModalEmailAberto(false)}
        >
          <section
            aria-labelledby="modal-title"
            aria-modal="true"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header do Modal */}
            <header className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  aria-hidden="true"
                  className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-xs shrink-0"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                    mark_email_read
                  </span>
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2" id="modal-title">
                    E-mail Oficial de Homologação <span className="text-slate-400 font-light">•</span> {usuarioSelecionado.nome}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      Destinatário:{" "}
                      <a className="text-sky-700 hover:underline font-semibold" href={`mailto:${usuarioSelecionado.email}`}>
                        {usuarioSelecionado.email}
                      </a>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      Perfil:{" "}
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider font-bold border border-slate-200">
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
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                title="Fechar"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
              </button>
            </header>

            {/* Corpo do E-mail (Visualização Estruturada em Cartão) */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6 bg-slate-50/60 select-text text-slate-700 custom-scroll">
              <article className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6 text-sm leading-relaxed">
                {/* Linha do Assunto */}
                <div className="pb-4 border-b border-slate-100 flex items-start gap-2.5">
                  <span className="font-bold text-slate-900 shrink-0">Assunto:</span>
                  <span className="font-semibold text-sky-950 flex items-center gap-1.5 flex-wrap">
                    {usuarioSelecionado.perfilId === "AGENCIA" ? (
                      <>
                        <span>✈️</span> Novo Módulo de Viagens &amp; Logística NNÓS{" "}
                        <span className="text-slate-400 font-normal">|</span> Acesso para Homologação e Testes Operacionais
                      </>
                    ) : (
                      <>
                        <span>🚀</span> Boas-vindas ao novo Sistema NNÓS{" "}
                        <span className="text-slate-400 font-normal">|</span> Convocação para Homologação e Validação de Processos
                      </>
                    )}
                  </span>
                </div>

                {/* Saudação & Introdução */}
                <div className="space-y-4 text-slate-700 leading-relaxed font-normal">
                  <p className="font-semibold text-slate-900">
                    Olá, {usuarioSelecionado.nome}, tudo bem?
                  </p>
                  {usuarioSelecionado.perfilId === "AGENCIA" ? (
                    <>
                      <p>
                        Gostaríamos de dar as boas-vindas ao novo módulo de <strong className="text-slate-900 font-semibold">Viagens &amp; Logística</strong> do sistema corporativo da NNÓS Consultoria!
                      </p>
                      <p>
                        Criamos uma área totalmente dedicada à agência para facilitar, agilizar e centralizar a nossa comunicação diária: desde o recebimento das ordens logísticas geradas pelas turmas até o lançamento de opções de cotação e upload dos vouchers definitivos aos viajantes.
                      </p>
                      <p>
                        Como parceiros estratégicos da nossa operação logística, convidamos vocês para testar a ferramenta com as demandas reais e nos apontar quaisquer ajustes necessários antes da entrada em produção.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        É com grande entusiasmo que convidamos você para fazer parte do primeiro grupo de validação do novo sistema <strong className="text-slate-900 font-semibold">NNÓS Gestão Financeira &amp; Projetos</strong>!
                      </p>
                      <p>
                        Desenvolvemos esta plataforma para integrar e desburocratizar a gestão dos nossos treinamentos, concentrando em um único lugar o planejamento de turmas, a logística de viagens, a emissão de Boletins de Medição (BM) com assinaturas digitais via Zoho Sign e a rentabilidade da sua carteira em tempo real.
                      </p>
                      <p>
                        Estamos na reta final para a liberação em produção e o seu olhar operacional é fundamental para garantirmos que a ferramenta reflita com 100% de precisão os processos e a dinâmica real do nosso dia a dia.
                      </p>
                    </>
                  )}
                </div>

                {/* Seção 1: Escopo de Validação Estruturado */}
                <div className="bg-slate-50/90 rounded-xl p-5 border border-slate-200 space-y-3.5">
                  <h2 className="text-xs uppercase tracking-wider font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-base leading-none">🎯</span>{" "}
                    {usuarioSelecionado.perfilId === "AGENCIA"
                      ? "FOCO PRINCIPAL DA VALIDAÇÃO PELA AGÊNCIA FÁTIMA:"
                      : "O QUE PRECISAMOS QUE VOCÊ TESTE E VALIDE:"}
                  </h2>

                  {usuarioSelecionado.perfilId === "AGENCIA" ? (
                    <ol className="space-y-3 text-slate-700 text-[13.5px]">
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-sky-700 min-w-[18px]">1.</span>
                        <div>
                          <span className="font-semibold text-slate-900">Solicitações de Logística</span>{" "}
                          <code className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-sky-800">/viagens</code>:
                          Verifique se as informações transmitidas das turmas (origem, destino, concessionária, datas de ida/volta e necessidade de bagagem) estão claras e completas para cotação.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-sky-700 min-w-[18px]">2.</span>
                        <div>
                          <span className="font-semibold text-slate-900">Matriz de Cotação</span>{" "}
                          <code className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-sky-800">/viagens</code>:
                          Teste a inserção das opções de voo, valores de hotel e traslados, avaliando se o formato atende a agilidade necessária no dia a dia.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-sky-700 min-w-[18px]">3.</span>
                        <div>
                          <span className="font-semibold text-slate-900">Políticas de Viagem</span>:
                          No card de Políticas de Viagem, vocês têm acesso direto aos PDFs oficiais (NNÓS, CNH Training, Iveco Group e Reembolso Vexpenses) para conferência rápida de limites de diárias e prestação de contas.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-sky-700 min-w-[18px]">4.</span>
                        <div>
                          <span className="font-semibold text-slate-900">Upload de Vouchers</span>:
                          Teste o envio de vouchers em PDF para conferência do viajante.
                        </div>
                      </li>
                    </ol>
                  ) : (
                    <ol className="space-y-3 text-slate-700 text-[13.5px]">
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-sky-700 min-w-[18px]">1.</span>
                        <div>
                          <span className="font-semibold text-slate-900">Projetos &amp; Atividades</span>{" "}
                          <code className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-sky-800">/projetos</code>:
                          Crie e consulte turmas da sua carteira, verifique as concessões/cidades, a carga horária (8h, 24h ou 40h) e a alocação de instrutores parceiros ou sócios (incluindo o acréscimo de 6% quando aplicável).
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-sky-700 min-w-[18px]">2.</span>
                        <div>
                          <span className="font-semibold text-slate-900">Viagens &amp; Logística</span>{" "}
                          <code className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-sky-800">/viagens</code>:
                          Avalie as solicitações de deslocamento, confira as cotações lançadas pela Agência Fátima e o fluxo de aprovação técnica.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-sky-700 min-w-[18px]">3.</span>
                        <div>
                          <span className="font-semibold text-slate-900">Boletins de Medição</span>{" "}
                          <code className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-sky-800">/medicao</code>:
                          Valide a conferência das horas apuradas da sua equipe e a experiência com o fluxo de assinatura digital (Zoho Sign).
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-sky-700 min-w-[18px]">4.</span>
                        <div>
                          <span className="font-semibold text-slate-900">Central de Relatórios</span>{" "}
                          <code className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-sky-800">/relatorios</code>:
                          Confira os demonstrativos, custos diretos e margem da sua unidade de negócio.
                        </div>
                      </li>
                    </ol>
                  )}
                </div>

                {/* Seção 2: Credenciais de Acesso (Caixa Âmbar Destacada) */}
                <div className="bg-amber-50/60 rounded-xl p-5 border border-amber-200/80 space-y-3">
                  <h2 className="text-xs uppercase tracking-wider font-bold text-amber-950 flex items-center gap-2">
                    <span className="text-base leading-none">🔑</span> SEUS DADOS DE ACESSO:
                  </h2>
                  <div className="space-y-2 text-[13.5px] pl-1 font-medium">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="text-slate-600 font-normal">• Link Oficial (Tela de Login):</span>
                      <a
                        className="text-sky-700 hover:text-sky-800 underline font-semibold inline-flex items-center gap-1"
                        href={URL_OFICIAL_LOGIN}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {URL_OFICIAL_LOGIN}
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-normal">• Seu Usuário / Login:</span>
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-200/70 font-mono text-xs">
                        {usuarioSelecionado.login || (usuarioSelecionado.perfilId === "AGENCIA" ? "agencia.fatima" : "usuario")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-normal">• E-mail Cadastrado:</span>
                      <span className="font-semibold text-slate-800">{usuarioSelecionado.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-normal">• Senha Inicial:</span>
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-200/70 font-mono text-xs">
                        {usuarioSelecionado.senha || (usuarioSelecionado.perfilId === "AGENCIA" ? "viagem2026" : "nnos2026")}
                      </span>
                    </div>
                    {usuarioSelecionado.perfilId === "AGENCIA" && (
                      <p className="text-xs text-amber-900 mt-2 font-semibold">
                        * Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no módulo de Viagens &amp; Logística (/viagens).
                      </p>
                    )}
                  </div>
                </div>

                {/* Seção 3: Suporte Integrado com Guia & Agente de IA */}
                <div className="bg-sky-50/60 rounded-xl p-4 border border-sky-100 flex items-start gap-3 text-xs text-slate-700">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>psychology</span>
                  </div>
                  <div>
                    <strong className="text-slate-900 block font-bold mb-0.5">Dúvidas? Utilize o Guia de Processos e o Agente de IA:</strong>
                    Dentro do sistema, clique no botão flutuante <strong>"Ajuda &amp; IA"</strong> (ícone da coruja) para consultar o passo a passo de todas as telas ou tirar dúvidas conceituais diretamente com a IA da NNÓS.
                  </div>
                </div>

                {/* Seção 4: Canal de Apontamentos & Assinatura */}
                <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-3">
                  <p>
                    Pedimos que qualquer processo divergente, sugestão ou ajuste seja enviado pelo canal de{" "}
                    <strong className="text-slate-800">Microsoft Teams da Equipe de Gestão NNÓS</strong> ou respondendo a este e-mail indicando:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-500">
                    <li>Em qual tela você estava navegando;</li>
                    <li>O que ocorreu de diferente do seu processo real;</li>
                    <li>Sugestão de melhoria ou print da tela.</li>
                  </ul>
                  <div className="pt-3">
                    <p className="font-semibold text-slate-800">
                      {usuarioSelecionado.perfilId === "AGENCIA" ? "Atenciosamente," : "Um abraço,"}
                    </p>
                    <p className="font-bold text-slate-900">Leonardo Campos &amp; Equipe de Gestão NNÓS</p>
                    <p className="text-slate-400">NNÓS Consultoria e Treinamento</p>
                  </div>
                </div>
              </article>
            </div>

            {/* Rodapé do Modal com Ações Oficiais */}
            <footer className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              {/* Ações Secundárias (Esquerda) */}
              <div className="flex items-center flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const txt = gerarTextoEmailPuro(usuarioSelecionado);
                    handleCopiarTexto(txt, "Texto completo do e-mail");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-sky-600 text-sky-700 hover:bg-sky-50 font-semibold text-xs transition-colors shadow-xs active:bg-sky-100 cursor-pointer"
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors shadow-xs"
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
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm hover:shadow transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>check_circle</span>
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
