"use client";

import React, { useState, useEffect, useMemo } from "react";
import ModernDropdown from "@/components/ModernDropdown";
import { formatarDataHoraBR } from "@/lib/date-utils";

interface Props {
  perfis: any[];
  onToast: (msg: string) => void;
}

export type TipoConvitePlataforma = "BOAS_VINDAS" | "HOMOLOGACAO";

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
  boasVindasStatus?: "PENDENTE" | "BOAS_VINDAS_ENVIADO" | "ACESSO_ATIVO";
  boasVindasEnviadoEm?: string | null;
  ultimoAcessoEm: string | null;
  apontamentos: string;
}

const URL_OFICIAL_LOGIN = "https://gestao.nnos.com.br/login";

const OPCOES_FILTRO_STATUS_BOAS_VINDAS = [
  { value: "TODOS", label: "Status: Todos os Usuários" },
  { value: "PENDENTE", label: "Status: Pendentes de Boas-Vindas" },
  { value: "BOAS_VINDAS_ENVIADO", label: "Status: Boas-Vindas Enviado" },
  { value: "ACESSO_ATIVO", label: "Status: Acesso Ativo (Em Uso)" },
];

const OPCOES_FILTRO_STATUS_HOMOLOGACAO = [
  { value: "TODOS", label: "Status: Todos os Status" },
  { value: "PENDENTE", label: "Status: Pendentes de Envio" },
  { value: "CONVITE_ENVIADO", label: "Status: Convites Enviados" },
  { value: "EM_VALIDACAO", label: "Status: Em Validação" },
  { value: "HOMOLOGADO", label: "Status: Homologados" },
];

function obterSenhaLegivel(user: any): string {
  const padrao = ehPerfilAgencia(user) ? "viagem2026" : "nnos2026";
  const s = String(user?.senha || "").trim();
  if (!s || s.startsWith("scrypt$") || s.length > 40) return padrao;
  return s;
}

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

function ehPerfilAgencia(user: any): boolean {
  if (!user) return false;
  return (
    user.perfilId === "AGENCIA" ||
    String(user.email || "").toLowerCase().includes("fcconsultoriadeviagens") ||
    String(user.login || "").toLowerCase().includes("agencia")
  );
}

function ehPerfilConsultor(user: any): boolean {
  if (!user || ehPerfilAgencia(user)) return false;
  if (
    user.perfilId === "DIRETORIA" ||
    user.perfilId === "LIDER" ||
    user.perfilId === "FINANCEIRO" ||
    user.perfilId === "ADMIN"
  ) {
    return false;
  }
  return (
    user.perfilId === "CONSULTOR" ||
    user.perfilId === "SOCIO" ||
    String(user.cargo || "").toLowerCase().includes("consultor") ||
    String(user.cargo || "").toLowerCase().includes("instrutor")
  );
}

function obterAssuntoConvite(user: any, modo: TipoConvitePlataforma = "BOAS_VINDAS"): string {
  if (modo === "BOAS_VINDAS") {
    if (ehPerfilAgencia(user)) {
      return "✈️ Bem-vindos ao Módulo de Viagens & Logística NNÓS | Acesso Oficial Liberado";
    }
    if (ehPerfilConsultor(user)) {
      return "🎓 Bem-vindo(a) ao Portal do Consultor NNÓS | Suas Credenciais Oficiais de Acesso";
    }
    return "🚀 Bem-vindo(a) ao Sistema NNÓS Gestão Financeira & Projetos | Suas Credenciais Oficiais de Acesso";
  }
  if (ehPerfilAgencia(user)) {
    return "✈️ Novo Módulo de Viagens & Logística NNÓS | Acesso para Homologação e Testes Operacionais";
  }
  if (ehPerfilConsultor(user)) {
    return "🎓 Boas-vindas ao Portal do Consultor NNÓS | Acesso para Homologação e Validação Operacional";
  }
  return "🚀 Boas-vindas ao novo Sistema NNÓS | Convocação para Homologação e Validação de Processos";
}

export default function ModuloHomologacaoConvites({ perfis, onToast }: Props) {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [modoConvite, setModoConvite] = useState<TipoConvitePlataforma>("BOAS_VINDAS");
  const [homologacoes, setHomologacoes] = useState<
    Record<
      string,
      {
        status: string;
        conviteEnviadoEm: string | null;
        boasVindasStatus?: string;
        boasVindasEnviadoEm?: string | null;
        apontamentos: string;
      }
    >
  >({});

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("TODOS");
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
    let localData: Record<string, any> = {};
    try {
      const salvo = localStorage.getItem("nnos_homologacao_controles_v1");
      if (salvo) {
        localData = JSON.parse(salvo);
        setHomologacoes(localData);
      }
    } catch {}

    // Sincroniza controles com o Supabase para não perder o histórico entre computadores
    fetch("/api/admin/homologacao/enviar-email")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.sucesso && res.controles && typeof res.controles === "object") {
          const mesclado = { ...localData, ...res.controles };
          setHomologacoes(mesclado);
          try {
            localStorage.setItem("nnos_homologacao_controles_v1", JSON.stringify(mesclado));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const salvarHomologacoes = (novosDados: Record<string, any>) => {
    setHomologacoes(novosDados);
    try {
      localStorage.setItem("nnos_homologacao_controles_v1", JSON.stringify(novosDados));
    } catch {}
    fetch("/api/admin/homologacao/enviar-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "SALVAR_CONTROLES", controles: novosDados }),
    }).catch(() => {});
  };

  const obterStatusBoasVindasEfetivo = (user: any): "PENDENTE" | "BOAS_VINDAS_ENVIADO" | "ACESSO_ATIVO" => {
    const reg = homologacoes[user.id];
    if (reg?.boasVindasStatus === "ACESSO_ATIVO") return "ACESSO_ATIVO";
    if (reg?.boasVindasStatus === "BOAS_VINDAS_ENVIADO") {
      return user.ultimoAcesso ? "ACESSO_ATIVO" : "BOAS_VINDAS_ENVIADO";
    }
    if (reg?.boasVindasStatus === "PENDENTE") return "PENDENTE";
    if (user.ultimoAcesso) return "ACESSO_ATIVO";
    return "PENDENTE";
  };

  // Alterar Status (Boas-Vindas ou Homologação)
  const handleAtualizarStatus = async (
    user: any,
    novoStatus: string
  ) => {
    const agoraStr = formatarDataHoraBR(new Date().toISOString());
    const atual = homologacoes[user.id] || {
      status: "PENDENTE",
      conviteEnviadoEm: null,
      boasVindasStatus: "PENDENTE",
      boasVindasEnviadoEm: null,
      apontamentos: "",
    };

    const atualizado = {
      ...homologacoes,
      [user.id]:
        modoConvite === "BOAS_VINDAS"
          ? {
              ...atual,
              boasVindasStatus: novoStatus,
              boasVindasEnviadoEm:
                novoStatus === "BOAS_VINDAS_ENVIADO"
                  ? agoraStr
                  : atual.boasVindasEnviadoEm,
            }
          : {
              ...atual,
              status: novoStatus,
              conviteEnviadoEm:
                novoStatus === "CONVITE_ENVIADO" ? agoraStr : atual.conviteEnviadoEm,
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
          evento:
            modoConvite === "BOAS_VINDAS"
              ? novoStatus === "BOAS_VINDAS_ENVIADO"
                ? "CONVITE_BOAS_VINDAS_OFICIAL"
                : `BOAS_VINDAS_${novoStatus}`
              : novoStatus === "CONVITE_ENVIADO"
              ? "CONVITE_HOMOLOGACAO"
              : `STATUS_${novoStatus}`,
          metodo:
            modoConvite === "BOAS_VINDAS"
              ? "Central de Convites & Boas-Vindas (Produção)"
              : "Módulo Homologação & Convites",
          status: "SUCESSO",
          detalhes: `Status de ${
            modoConvite === "BOAS_VINDAS" ? "Boas-Vindas Oficial" : "Homologação"
          } alterado para ${novoStatus} por Leonardo Campos.`,
        }),
      });
    } catch (e) {
      console.warn("Aviso ao registrar log:", e);
    }

    onToast(`Status de ${user.nome} atualizado para ${novoStatus}!`);
  };

  const montarPayloadEmailHomologacao = (user: any, tipo: TipoConvitePlataforma = modoConvite) => ({
    usuarioNome: user.nome,
    usuarioEmail: user.email,
    usuarioLogin: user.login,
    usuarioCargo: user.cargo,
    usuarioSenha: obterSenhaLegivel(user),
    perfilId: user.perfilId,
    perfilNome: perfis.find((p) => p.id === user.perfilId)?.nome || user.perfilId,
    assuntoPersonalizado: obterAssuntoConvite(user, tipo),
    corpoTextoPersonalizado: gerarTextoEmailPuro(user, tipo),
    tipoConvite: tipo,
    mfaAtivo: Boolean(user.mfaAtivo),
  });

  // Registrar e Disparar Envio de E-mail Individual
  const handleRegistrarDisparo = async (user: any) => {
    const statusAlvo = modoConvite === "BOAS_VINDAS" ? "BOAS_VINDAS_ENVIADO" : "CONVITE_ENVIADO";
    await handleAtualizarStatus(user, statusAlvo);

    try {
      const res = await fetch("/api/admin/homologacao/enviar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(montarPayloadEmailHomologacao(user, modoConvite)),
      });

      const data = await res.json();
      if (data.sucesso && (data.modo === "smtp" || data.modo === "resend")) {
        onToast(
          `✉️ E-mail oficial de ${
            modoConvite === "BOAS_VINDAS" ? "Boas-Vindas" : "Homologação"
          } entregue com sucesso para ${user.email}!`
        );
      } else if (data.sucesso === false) {
        onToast(`⚠️ Falha no envio para ${user.email}: ${data.mensagem || data.erro || "Verifique o provedor de e-mail"}`);
      } else if (data.modo === "simulado") {
        onToast(`Convite registrado para ${user.nome}! (Modo Simulado: SMTP pendente de configuração)`);
      } else {
        onToast(`Convite registrado para ${user.nome}!`);
      }
    } catch (e: any) {
      onToast(`Erro ao disparar e-mail: ${e.message}`);
    }
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

      const atual = novoMapa[userId] || {
        status: "PENDENTE",
        conviteEnviadoEm: null,
        boasVindasStatus: "PENDENTE",
        boasVindasEnviadoEm: null,
        apontamentos: "",
      };

      novoMapa[userId] =
        modoConvite === "BOAS_VINDAS"
          ? {
              ...atual,
              boasVindasStatus: "BOAS_VINDAS_ENVIADO",
              boasVindasEnviadoEm: agoraStr,
            }
          : {
              ...atual,
              status: "CONVITE_ENVIADO",
              conviteEnviadoEm: agoraStr,
            };

      try {
        await fetch("/api/admin/homologacao/enviar-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(montarPayloadEmailHomologacao(user, modoConvite)),
        });

        await fetch("/api/admin/logs-acesso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuarioLogin: user.login,
            usuarioNome: user.nome,
            usuarioEmail: user.email,
            perfilId: user.perfilId,
            evento:
              modoConvite === "BOAS_VINDAS"
                ? "CONVITE_BOAS_VINDAS_EM_MASSA"
                : "CONVITE_HOMOLOGACAO_EM_MASSA",
            metodo:
              modoConvite === "BOAS_VINDAS"
                ? "Central de Convites & Boas-Vindas (Disparo em Massa)"
                : "Módulo Homologação & Convites (Disparo em Massa)",
            status: "SUCESSO",
            detalhes: `E-mail de ${
              modoConvite === "BOAS_VINDAS" ? "Boas-Vindas Oficial" : "Homologação"
            } disparado em lote por Leonardo Campos.`,
          }),
        });
      } catch {}
    }

    salvarHomologacoes(novoMapa);
    onToast(
      `🚀 ${selecionados.length} e-mail(s) de ${
        modoConvite === "BOAS_VINDAS" ? "Boas-Vindas Oficial" : "Homologação"
      } disparado(s) e registrados com sucesso!`
    );
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

      // 2. Filtro por Status (conforme o modo ativo)
      const statusUser =
        modoConvite === "BOAS_VINDAS"
          ? obterStatusBoasVindasEfetivo(u)
          : homologacoes[u.id]?.status || "PENDENTE";
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
  }, [usuarios, filtroGrupo, filtroStatus, busca, homologacoes, modoConvite]);

  // Contadores do Painel
  const contadores = useMemo(() => {
    const total = usuarios.length;
    let pendentes = 0;
    let enviados = 0;
    let emValidacao = 0;
    let homologados = 0;

    usuarios.forEach((u) => {
      if (modoConvite === "BOAS_VINDAS") {
        const st = obterStatusBoasVindasEfetivo(u);
        if (st === "PENDENTE") pendentes++;
        else if (st === "BOAS_VINDAS_ENVIADO") enviados++;
        else if (st === "ACESSO_ATIVO") homologados++;
      } else {
        const st = homologacoes[u.id]?.status || "PENDENTE";
        if (st === "PENDENTE") pendentes++;
        else if (st === "CONVITE_ENVIADO") enviados++;
        else if (st === "EM_VALIDACAO") emValidacao++;
        else if (st === "HOMOLOGADO") homologados++;
      }
    });

    return { total, pendentes, enviados, emValidacao, homologados };
  }, [usuarios, homologacoes, modoConvite]);

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
  const gerarTextoEmailPuro = (user: any, modo: TipoConvitePlataforma = modoConvite) => {
    const ehAgencia = ehPerfilAgencia(user);
    const ehConsultor = ehPerfilConsultor(user);
    const ehBoasVindas = modo === "BOAS_VINDAS";
    const linkAcesso = URL_OFICIAL_LOGIN;
    const assuntoTexto = obterAssuntoConvite(user, modo);
    const senhaLegivel = obterSenhaLegivel(user);

    const blocoDuvidasTexto = `--------------------------------------------------
🦉 DÚVIDAS? UTILIZE O GUIA E O AGENTE DE IA:
--------------------------------------------------
No topo direito (ou no botão flutuante com o ícone da coruja), clique em "Ajuda & IA":
- Na aba Guia de Processos, você encontra o passo a passo e o macrofluxo das 7 etapas da NNÓS.
- Na aba Agente de IA NNÓS, faça perguntas com suas próprias palavras para tirar dúvidas sobre regras corporativas.`;

    const blocoSegurancaBoasVindasTexto = `--------------------------------------------------
🔒 SEGURANÇA DA CONTA & BOAS PRÁTICAS DE ACESSO:
--------------------------------------------------
- Suas credenciais são pessoais e intransferíveis, garantindo a rastreabilidade das operações no sistema.
- ${
      user.mfaAtivo
        ? "Sua conta possui Autenticação em 2 Fatores (Google Authenticator - 2FA) ativa para proteção adicional."
        : 'Caso precise redefinir sua senha, utilize a opção "Esqueci minha senha" na tela de login.'
    }
- Sempre que precisar de apoio operacional, nossa equipe está à disposição pelo Microsoft Teams da Equipe de Gestão NNÓS ou por este e-mail.

${
  ehAgencia
    ? "Desejamos um excelente trabalho e agradecemos pela parceria contínua!"
    : "Seja muito bem-vindo(a) à nossa nova plataforma oficial de gestão!"
}

${ehAgencia ? "Atenciosamente," : "Um abraço,"}
Leonardo Campos & Equipe de Gestão NNÓS
NNÓS Consultoria e Treinamento`;

    const blocoApontamentosTexto = `--------------------------------------------------
📝 COMO ENVIAR SEUS APONTAMENTOS DE MELHORIA:
--------------------------------------------------
Pedimos que envie seus feedbacks, processos divergentes ou sugestões diretamente pelo canal de Microsoft Teams da Equipe de Gestão NNÓS ou respondendo a este e-mail indicando:
1. Em qual tela você estava navegando;
2. O que ocorreu de diferente do seu processo real;
3. Sugestão de melhoria ou print da tela.

${
  ehAgencia
    ? "Muito obrigado pela parceria contínua!"
    : "Contamos muito com sua colaboração para colocarmos no ar o melhor sistema de gestão que a NNÓS já teve!"
}

${ehAgencia ? "Atenciosamente," : "Um abraço,"}
Leonardo Campos & Equipe de Gestão NNÓS
NNÓS Consultoria e Treinamento`;

    if (ehBoasVindas) {
      if (ehAgencia) {
        return `Assunto: ${assuntoTexto}

Olá, Fátima e Equipe, tudo bem?

Seja muito bem-vinda ao módulo oficial de Viagens & Logística da plataforma corporativa NNÓS Gestão Financeira & Projetos!

A partir de agora, todas as solicitações de passagens aéreas, hospedagens, locações, aprovações de líderes, gestão de créditos e envio de vouchers aos viajantes passam a ser operadas de forma centralizada e oficial através do nosso portal.

Abaixo estão suas credenciais definitivas de acesso e o resumo das funcionalidades disponíveis para a rotina diária da agência:

--------------------------------------------------
🎯 PRINCIPAIS RECURSOS DISPONÍVEIS PARA A AGÊNCIA FÁTIMA:
--------------------------------------------------
1. Esteira de Solicitações & Cotações (/viagens): Recebimento imediato das demandas de viagem com origem, destino, datas de ida/volta, preferências e anexo dos PDFs comparativos para aprovação do Líder.
2. Logística · Controle de Créditos (/viagens): Gestão completa de créditos de companhias aéreas e hotéis disponíveis para reaproveitamento dentro do prazo de validade (1 ano).
3. Políticas de Viagem Oficiais: Consulta rápida aos PDFs de políticas (NNÓS Consultoria, CNH Training, Iveco Group e Reembolso Vexpenses).
4. Emissão & Disparo Automático de Vouchers: Ao anexar os bilhetes e vouchers emitidos, o sistema dispara automaticamente o kit completo de viagem por e-mail ao consultor viajante.

--------------------------------------------------
🔑 SEUS DADOS OFICIAIS DE ACESSO:
--------------------------------------------------
- Link Oficial de Acesso (Tela de Login): ${linkAcesso}
- Seu Usuário / Login: ${user.login || "agencia.fatima"}
- E-mail Cadastrado: ${user.email}
- Senha Inicial: ${senhaLegivel}
* Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no módulo de Viagens & Logística (/viagens).

${blocoDuvidasTexto}

${blocoSegurancaBoasVindasTexto}`;
      }

      if (ehConsultor) {
        return `Assunto: ${assuntoTexto}

Olá, ${user.nome}, tudo bem?

É uma satisfação dar as boas-vindas oficiais a você no Portal do Consultor da plataforma NNÓS Gestão Financeira & Projetos!

Seu acesso definitivo já está liberado! Este ambiente foi desenvolvido exclusivamente para centralizar e facilitar toda a sua rotina operacional e financeira com a NNÓS: acompanhamento da sua agenda de treinamentos, bloqueio de datas, consulta de passagens e vouchers de viagem, assinatura digital de Boletins de Medição (BMs) e gestão dos seus recebimentos.

Confira abaixo o que você já pode utilizar no seu Portal e os seus dados oficiais de acesso:

--------------------------------------------------
🎯 O QUE VOCÊ JÁ PODE UTILIZAR NO SEU PORTAL DO CONSULTOR:
--------------------------------------------------
1. Minha Agenda & Disponibilidade (/consultor/agenda): Consulte suas turmas confirmadas, locais, datas, carga horária e registre bloqueios de agenda quando tiver indisponibilidade.
2. Minhas Viagens & Vouchers (/consultor/viagens): Visualize e baixe suas passagens aéreas, vouchers de hotel, locação de veículo e consulte as Políticas de Viagem e Prestação de Contas (CNH, Iveco, NNÓS e Vexpenses).
3. Meus Boletins de Medição (BMs) (/consultor/bms): Confira as horas e atividades apuradas no mês, acompanhe a assinatura digital via Zoho Sign e envie sua Nota Fiscal correspondente.
4. Meus Pagamentos & Repasses (/consultor/pagamentos): Acompanhe o calendário de liquidação das suas Notas Fiscais, reembolsos de despesas (RDVs) e histórico financeiro completo.

--------------------------------------------------
🔑 SEUS DADOS OFICIAIS DE ACESSO:
--------------------------------------------------
- Link Oficial de Acesso (Tela de Login): ${linkAcesso}
- Seu Usuário / Login: ${user.login}
- E-mail Cadastrado: ${user.email}
- Senha Inicial: ${senhaLegivel}
* Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no seu Portal do Consultor (/consultor).

${blocoDuvidasTexto}

${blocoSegurancaBoasVindasTexto}`;
      }

      return `Assunto: ${assuntoTexto}

Olá, ${user.nome}, tudo bem?

É uma satisfação dar as boas-vindas oficiais a você na plataforma corporativa NNÓS Gestão Financeira & Projetos!

Seu acesso definitivo em produção já está ativo! A plataforma integra em um único ambiente o planejamento operacional de turmas, o fluxo de cotação e aprovação de viagens, a emissão e assinatura digital de Boletins de Medição (BMs) via Zoho Sign, o faturamento e a Central Executiva de Relatórios.

Confira abaixo os principais módulos liberados para o seu perfil e as suas credenciais oficiais de acesso:

--------------------------------------------------
🎯 PRINCIPAIS MÓDULOS DISPONÍVEIS NO SEU PERFIL:
--------------------------------------------------
1. Projetos & Atividades (/projetos): Planejamento e gestão de turmas, alocação de consultores/instrutores, cálculo automático de tabelas contratuais e solicitação integrada de logística.
2. Viagens & Logística (/viagens): Acompanhamento da esteira de cotações, aprovação ou devolutiva de propostas em PDF enviadas pela Agência Fátima e controle de créditos.
3. BM - Boletim de Medição (/medicao): Apuração mensal de entregas, emissão de BMs, disparo de assinatura eletrônica via Zoho Sign e homologação financeira.
4. Central Executiva de Relatórios (/relatorios): Acompanhamento Semanal, DRE Gerencial, Matriz Financeira, Painel por Líder e indicadores de rentabilidade em tempo real.

--------------------------------------------------
🔑 SEUS DADOS OFICIAIS DE ACESSO:
--------------------------------------------------
- Link Oficial de Acesso (Tela de Login): ${linkAcesso}
- Seu Usuário / Login: ${user.login}
- E-mail Cadastrado: ${user.email}
- Senha Inicial: ${senhaLegivel}

${blocoDuvidasTexto}

${blocoSegurancaBoasVindasTexto}`;
    }

    if (ehAgencia) {
      return `Assunto: ${assuntoTexto}

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
- E-mail Cadastrado: ${user.email}
- Senha Inicial: ${senhaLegivel}
* Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no módulo de Viagens & Logística (/viagens).

${blocoDuvidasTexto}

${blocoApontamentosTexto}`;
    }

    if (ehConsultor) {
      return `Assunto: ${assuntoTexto}

Olá, ${user.nome}, tudo bem?

É com grande entusiasmo que convidamos você para fazer parte do primeiro grupo de validação do novo Portal do Consultor no sistema NNÓS Gestão Financeira & Projetos!

Desenvolvemos esta área exclusiva para você acompanhar e gerenciar de forma transparente toda a sua dinâmica operacional e financeira: sua agenda de treinamentos, orientações e vouchers de viagens, conferência e assinatura digital de Boletins de Medição (BMs) via Zoho Sign e a consulta detalhada de pagamentos e reembolsos.

Estamos na reta final para a liberação em produção e a sua validação prática é fundamental para garantirmos que a experiência do consultor seja simples, ágil e precisa no seu dia a dia.

--------------------------------------------------
🎯 O QUE PRECISAMOS QUE VOCÊ TESTE E VALIDE (PORTAL DO CONSULTOR):
--------------------------------------------------
1. Minha Agenda (/consultor/agenda): Consulte seus treinamentos e turmas programadas, conferindo datas, horários, concessionárias, cidades e detalhamentos da atividade.
2. Minhas Viagens & Logística (/consultor/viagens): Acompanhe o status dos seus deslocamentos, passagens aéreas emitidas, hospedagens, translados e vouchers disponibilizados pela Agência Fátima.
3. Meus Boletins de Medição (/consultor/bms): Valide a conferência das horas apuradas dos seus treinamentos, valores a receber e a facilidade do fluxo de assinatura digital com validade jurídica (Zoho Sign).
4. Meus Pagamentos & Repasses (/consultor/pagamentos): Acompanhe as previsões financeiras, extrato de liquidações, notas fiscais, RDVs (relatórios de viagem/reembolsos de despesas) e o histórico de pagamentos efetuados.

--------------------------------------------------
🔑 SEUS DADOS DE ACESSO:
--------------------------------------------------
- Link Oficial de Acesso (Tela de Login): ${linkAcesso}
- Seu Usuário / Login: ${user.login}
- E-mail Cadastrado: ${user.email}
- Senha Inicial: ${senhaLegivel}
* Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no seu Portal do Consultor (/consultor).

${blocoDuvidasTexto}

${blocoApontamentosTexto}`;
    }

    return `Assunto: ${assuntoTexto}

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
- Senha Inicial: ${senhaLegivel}

${blocoDuvidasTexto}

${blocoApontamentosTexto}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", paddingBottom: "70px" }}>
      {/* =================================================================== */}
      {/* 0. SELETOR DE MODO: BOAS-VINDAS OFICIAL (PRODUÇÃO) vs. HOMOLOGAÇÃO  */}
      {/* =================================================================== */}
      <section
        style={{
          backgroundColor: "var(--surface-container-lowest, #ffffff)",
          borderRadius: "16px",
          border: "1px solid var(--border, #e2e8f0)",
          padding: "14px 18px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "22px", color: "#0284c7" }}>
            campaign
          </span>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
              Central de Convites, Boas-Vindas &amp; Homologação
            </div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Escolha o modelo de e-mail e controle que deseja operar para os usuários da plataforma:
            </div>
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            backgroundColor: "#f1f5f9",
            padding: "4px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            gap: "4px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setModoConvite("BOAS_VINDAS");
              setFiltroStatus("TODOS");
              setSelecionados([]);
              setPaginaAtual(1);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "9px",
              border: "none",
              fontSize: "12.5px",
              fontWeight: 800,
              cursor: "pointer",
              backgroundColor: modoConvite === "BOAS_VINDAS" ? "#0f2a4a" : "transparent",
              color: modoConvite === "BOAS_VINDAS" ? "#ffffff" : "#475569",
              boxShadow: modoConvite === "BOAS_VINDAS" ? "0 2px 6px rgba(15,42,74,0.22)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "17px", color: modoConvite === "BOAS_VINDAS" ? "#38bdf8" : "#64748b" }}>
              verified_user
            </span>
            <span>Boas-Vindas Oficial (Uso Definitivo)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModoConvite("HOMOLOGACAO");
              setFiltroStatus("TODOS");
              setSelecionados([]);
              setPaginaAtual(1);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "9px",
              border: "none",
              fontSize: "12.5px",
              fontWeight: 800,
              cursor: "pointer",
              backgroundColor: modoConvite === "HOMOLOGACAO" ? "#0f2a4a" : "transparent",
              color: modoConvite === "HOMOLOGACAO" ? "#ffffff" : "#475569",
              boxShadow: modoConvite === "HOMOLOGACAO" ? "0 2px 6px rgba(15,42,74,0.22)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "17px", color: modoConvite === "HOMOLOGACAO" ? "#fbbf24" : "#64748b" }}>
              science
            </span>
            <span>Convite de Homologação (Testes)</span>
          </button>
        </div>
      </section>

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
              {modoConvite === "BOAS_VINDAS" ? "Boas-Vindas Enviado" : "Convites Disparados"}
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

        {/* Metric 4: Acesso Ativo / Homologados */}
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
              {modoConvite === "BOAS_VINDAS" ? "Acesso Ativo (Em Uso)" : "Homologados"}
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
              {contadores.homologados}
            </div>
            <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "inline-block" }}>
              {modoConvite === "BOAS_VINDAS" ? "Usuários já operando na plataforma" : "Validação de perfil concluída"}
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
      {/* 2. BANNER DE OPERAÇÃO ATIVA                                         */}
      {/* =================================================================== */}
      <section
        style={{
          background:
            modoConvite === "BOAS_VINDAS"
              ? "linear-gradient(to right, #ecfdf5 0%, #f0f9ff 50%, #ffffff 100%)"
              : "linear-gradient(to right, #eff6ff 0%, #f0f9ff 50%, #ffffff 100%)",
          borderRadius: "16px",
          border: modoConvite === "BOAS_VINDAS" ? "1px solid #a7f3d0" : "1px solid #bfdbfe",
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
              backgroundColor: modoConvite === "BOAS_VINDAS" ? "#059669" : "#2563eb",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow:
                modoConvite === "BOAS_VINDAS"
                  ? "0 4px 12px rgba(5,150,105,0.25)"
                  : "0 4px 12px rgba(37,99,235,0.25)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
              {modoConvite === "BOAS_VINDAS" ? "verified_user" : "rocket_launch"}
            </span>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                {modoConvite === "BOAS_VINDAS"
                  ? "E-mail Oficial de Boas-Vindas & Liberação Definitiva de Acesso"
                  : "Fase de Homologação Ativa • Exercício 2026"}
              </h4>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  backgroundColor: modoConvite === "BOAS_VINDAS" ? "#d1fae5" : "#dbeafe",
                  color: modoConvite === "BOAS_VINDAS" ? "#065f46" : "#1e40af",
                  padding: "2px 8px",
                  borderRadius: "6px",
                }}
              >
                {modoConvite === "BOAS_VINDAS" ? "Produção Oficial" : "Homologação Oficial"}
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
              {modoConvite === "BOAS_VINDAS" ? (
                <>
                  Envia credenciais oficiais de produção personalizadas por perfil com logomarca NNÓS embutida.
                </>
              ) : (
                <>
                  Canal de suporte e apontamentos:{" "}
                  <strong style={{ color: "#1e293b" }}>Microsoft Teams da Equipe de Gestão NNÓS</strong>
                </>
              )}
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
            options={
              modoConvite === "BOAS_VINDAS"
                ? OPCOES_FILTRO_STATUS_BOAS_VINDAS
                : OPCOES_FILTRO_STATUS_HOMOLOGACAO
            }
            icon="filter_list"
            minWidth={250}
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
                <th style={{ padding: "14px 16px" }}>
                  {modoConvite === "BOAS_VINDAS" ? "Status do Acesso Oficial" : "Status de Homologação"}
                </th>
                <th style={{ padding: "14px 16px" }}>
                  {modoConvite === "BOAS_VINDAS" ? "Disparo de Boas-Vindas / Último Login" : "Envio do Convite"}
                </th>
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
                    boasVindasStatus: "PENDENTE",
                    boasVindasEnviadoEm: null,
                    apontamentos: "",
                  };
                  const statusBoasVindas = obterStatusBoasVindasEfetivo(u);
                  const statusExibido =
                    modoConvite === "BOAS_VINDAS" ? statusBoasVindas : homoInfo.status;
                  const dataEnvioExibida =
                    modoConvite === "BOAS_VINDAS"
                      ? homoInfo.boasVindasEnviadoEm
                      : homoInfo.conviteEnviadoEm;

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

                      {/* Status de Acesso / Homologação */}
                      <td style={{ padding: "14px 16px" }}>
                        {(statusExibido === "HOMOLOGADO" || statusExibido === "ACESSO_ATIVO") && (
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
                            <span>{statusExibido === "ACESSO_ATIVO" ? "Acesso Ativo (Em Uso)" : "Homologado"}</span>
                          </span>
                        )}
                        {(statusExibido === "CONVITE_ENVIADO" || statusExibido === "BOAS_VINDAS_ENVIADO") && (
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
                            <span>
                              {statusExibido === "BOAS_VINDAS_ENVIADO" ? "Boas-Vindas Enviado" : "Convite Enviado"}
                            </span>
                          </span>
                        )}
                        {statusExibido === "EM_VALIDACAO" && (
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
                        {statusExibido === "PENDENTE" && (
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
                            <span>
                              {modoConvite === "BOAS_VINDAS" ? "Pendente de Boas-Vindas" : "Pendente de Envio"}
                            </span>
                          </span>
                        )}
                      </td>

                      {/* Envio do Convite / Último Login */}
                      <td style={{ padding: "14px 16px", color: "#64748b", fontSize: "11.5px" }}>
                        {dataEnvioExibida ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1d4ed8", fontWeight: 600 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#2563eb" }}>
                                check_circle
                              </span>
                              <span>Enviado: {dataEnvioExibida}</span>
                            </div>
                            {modoConvite === "BOAS_VINDAS" && u.ultimoAcesso && (
                              <span style={{ fontSize: "10.5px", color: "#059669", fontWeight: 600 }}>
                                Último login: {formatarDataHoraBR(u.ultimoAcesso)}
                              </span>
                            )}
                          </div>
                        ) : modoConvite === "BOAS_VINDAS" && u.ultimoAcesso ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "11px", color: "#059669", fontWeight: 700 }}>
                              Último login: {formatarDataHoraBR(u.ultimoAcesso)}
                            </span>
                            <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>
                              Boas-vindas ainda não disparado
                            </span>
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
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                          {/* Botão Ver E-mail -> Azul #0284c7 com ícone mail */}
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
                              padding: "6px 12px",
                              borderRadius: "8px",
                              backgroundColor: "#0284c7",
                              color: "#ffffff",
                              fontSize: "12px",
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                              boxShadow: "0 1px 3px rgba(2, 132, 199, 0.25)",
                              transition: "all 0.15s ease",
                              whiteSpace: "nowrap",
                            }}
                            title="Visualizar o e-mail oficial formatado deste usuário"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>mail</span>
                            <span>Ver E-mail</span>
                          </button>

                          {/* Botão Disparar -> Navy #0f2a4a ou Verde #059669 com ícone send */}
                          <button
                            type="button"
                            onClick={() => handleRegistrarDisparo(u)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              backgroundColor: modoConvite === "BOAS_VINDAS" ? "#059669" : "#0f2a4a",
                              color: "#ffffff",
                              fontSize: "12px",
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                              boxShadow: "0 1px 3px rgba(15, 42, 74, 0.15)",
                              transition: "all 0.15s ease",
                              whiteSpace: "nowrap",
                            }}
                            title={
                              modoConvite === "BOAS_VINDAS"
                                ? "Disparar E-mail Oficial de Boas-Vindas & Liberação de Acesso"
                                : "Registrar envio do convite no log de homologação"
                            }
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>send</span>
                            <span>
                              {modoConvite === "BOAS_VINDAS"
                                ? dataEnvioExibida
                                  ? "Reenviar Boas-Vindas"
                                  : "Enviar Boas-Vindas"
                                : "Disparar"}
                            </span>
                          </button>

                          {/* Copiar Link de Login Individual */}
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto(URL_OFICIAL_LOGIN, "Link Oficial da Tela de Login")}
                            style={{
                              padding: "6px",
                              borderRadius: "8px",
                              backgroundColor: "#f8fafc",
                              color: "#64748b",
                              border: "1px solid #e2e8f0",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease",
                            }}
                            title="Copiar Link Oficial de Acesso"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#e2e8f0";
                              e.currentTarget.style.color = "#0f172a";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "#f8fafc";
                              e.currentTarget.style.color = "#64748b";
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>content_copy</span>
                          </button>

                          {/* Alternar Status Rápido */}
                          <button
                            type="button"
                            onClick={() => {
                              if (modoConvite === "BOAS_VINDAS") {
                                const proximo =
                                  statusExibido === "PENDENTE"
                                    ? "BOAS_VINDAS_ENVIADO"
                                    : statusExibido === "BOAS_VINDAS_ENVIADO"
                                    ? "ACESSO_ATIVO"
                                    : "PENDENTE";
                                handleAtualizarStatus(u, proximo);
                              } else {
                                const proximo =
                                  homoInfo.status === "PENDENTE"
                                    ? "CONVITE_ENVIADO"
                                    : homoInfo.status === "CONVITE_ENVIADO"
                                    ? "EM_VALIDACAO"
                                    : homoInfo.status === "EM_VALIDACAO"
                                    ? "HOMOLOGADO"
                                    : "PENDENTE";
                                handleAtualizarStatus(u, proximo);
                              }
                            }}
                            style={{
                              padding: "6px",
                              borderRadius: "8px",
                              backgroundColor: "#f8fafc",
                              color: "#64748b",
                              border: "1px solid #e2e8f0",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease",
                            }}
                            title="Alternar Status de Homologação"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#e2e8f0";
                              e.currentTarget.style.color = "#0f172a";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "#f8fafc";
                              e.currentTarget.style.color = "#64748b";
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>sync</span>
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
                    <span>
                      {modoConvite === "BOAS_VINDAS"
                        ? "E-mail Oficial de Boas-Vindas (Acesso Definitivo)"
                        : "E-mail Oficial de Homologação"}
                    </span>
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
                    {obterAssuntoConvite(usuarioSelecionado, modoConvite)}
                  </span>
                </div>

                {/* Saudação & Introdução */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", color: "#334155" }}>
                  <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                    {ehPerfilAgencia(usuarioSelecionado)
                      ? "Olá, Fátima e Equipe, tudo bem?"
                      : `Olá, ${usuarioSelecionado.nome}, tudo bem?`}
                  </p>
                  {modoConvite === "BOAS_VINDAS" ? (
                    ehPerfilAgencia(usuarioSelecionado) ? (
                      <>
                        <p style={{ margin: 0 }}>
                          Seja muito bem-vinda ao módulo oficial de <strong style={{ color: "#0f172a" }}>Viagens &amp; Logística</strong> da plataforma corporativa <strong style={{ color: "#0f172a" }}>NNÓS Gestão Financeira &amp; Projetos</strong>!
                        </p>
                        <p style={{ margin: 0 }}>
                          A partir de agora, todas as solicitações de passagens aéreas, hospedagens, locações, aprovações de líderes, gestão de créditos e envio de vouchers aos viajantes passam a ser operadas de forma centralizada e oficial através do nosso portal.
                        </p>
                        <p style={{ margin: 0 }}>
                          Abaixo estão suas credenciais definitivas de acesso e o resumo das funcionalidades disponíveis para a rotina diária da agência:
                        </p>
                      </>
                    ) : ehPerfilConsultor(usuarioSelecionado) ? (
                      <>
                        <p style={{ margin: 0 }}>
                          É uma satisfação dar as boas-vindas oficiais a você no <strong style={{ color: "#0f172a" }}>Portal do Consultor</strong> da plataforma <strong style={{ color: "#0f172a" }}>NNÓS Gestão Financeira &amp; Projetos</strong>!
                        </p>
                        <p style={{ margin: 0 }}>
                          Seu acesso definitivo já está liberado! Este ambiente foi desenvolvido exclusivamente para centralizar e facilitar toda a sua rotina operacional e financeira com a NNÓS: acompanhamento da sua agenda de treinamentos, bloqueio de datas, consulta de passagens e vouchers de viagem, assinatura digital de Boletins de Medição (BMs) e gestão dos seus recebimentos.
                        </p>
                        <p style={{ margin: 0 }}>
                          Confira abaixo o que você já pode utilizar no seu Portal e os seus dados oficiais de acesso:
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: 0 }}>
                          É uma satisfação dar as boas-vindas oficiais a você na plataforma corporativa <strong style={{ color: "#0f172a" }}>NNÓS Gestão Financeira &amp; Projetos</strong>!
                        </p>
                        <p style={{ margin: 0 }}>
                          Seu acesso definitivo em produção já está ativo! A plataforma integra em um único ambiente o planejamento operacional de turmas, o fluxo de cotação e aprovação de viagens, a emissão e assinatura digital de Boletins de Medição (BMs) via Zoho Sign, o faturamento e a Central Executiva de Relatórios.
                        </p>
                        <p style={{ margin: 0 }}>
                          Confira abaixo os principais módulos liberados para o seu perfil e as suas credenciais oficiais de acesso:
                        </p>
                      </>
                    )
                  ) : ehPerfilAgencia(usuarioSelecionado) ? (
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
                  ) : ehPerfilConsultor(usuarioSelecionado) ? (
                    <>
                      <p style={{ margin: 0 }}>
                        É com grande entusiasmo que convidamos você para fazer parte do primeiro grupo de validação do novo <strong style={{ color: "#0f172a" }}>Portal do Consultor</strong> no sistema NNÓS Gestão Financeira &amp; Projetos!
                      </p>
                      <p style={{ margin: 0 }}>
                        Desenvolvemos esta área exclusiva para você acompanhar e gerenciar de forma transparente toda a sua dinâmica operacional e financeira: sua agenda de treinamentos, orientações e vouchers de viagens, conferência e assinatura digital de Boletins de Medição (BMs) via Zoho Sign e a consulta detalhada de pagamentos e reembolsos.
                      </p>
                      <p style={{ margin: 0 }}>
                        Estamos na reta final para a liberação em produção e a sua validação prática é fundamental para garantirmos que a experiência do consultor seja simples, ágil e precisa no seu dia a dia.
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

                {/* Seção 1: Escopo de Módulos / Validação Estruturado */}
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
                      {modoConvite === "BOAS_VINDAS"
                        ? ehPerfilAgencia(usuarioSelecionado)
                          ? "PRINCIPAIS RECURSOS DISPONÍVEIS PARA A AGÊNCIA FÁTIMA:"
                          : ehPerfilConsultor(usuarioSelecionado)
                          ? "O QUE VOCÊ JÁ PODE UTILIZAR NO SEU PORTAL DO CONSULTOR:"
                          : "PRINCIPAIS MÓDULOS DISPONÍVEIS NO SEU PERFIL:"
                        : ehPerfilAgencia(usuarioSelecionado)
                        ? "FOCO PRINCIPAL DA VALIDAÇÃO PELA AGÊNCIA FÁTIMA:"
                        : ehPerfilConsultor(usuarioSelecionado)
                        ? "O QUE PRECISAMOS QUE VOCÊ TESTE E VALIDE (PORTAL DO CONSULTOR):"
                        : "O QUE PRECISAMOS QUE VOCÊ TESTE E VALIDE:"}
                    </span>
                  </h2>

                  {ehPerfilAgencia(usuarioSelecionado) ? (
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
                  ) : ehPerfilConsultor(usuarioSelecionado) ? (
                    <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>1.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Minha Agenda</strong>{" "}
                          <code style={{ fontSize: "11px", fontFamily: "monospace", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0369a1" }}>/consultor/agenda</code>:
                          {" "}Consulte seus treinamentos e turmas programadas, conferindo datas, horários, concessionárias, cidades e detalhamentos da atividade.
                        </div>
                      </li>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>2.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Minhas Viagens &amp; Logística</strong>{" "}
                          <code style={{ fontSize: "11px", fontFamily: "monospace", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0369a1" }}>/consultor/viagens</code>:
                          {" "}Acompanhe o status dos seus deslocamentos, passagens aéreas emitidas, hospedagens, translados e vouchers disponibilizados pela Agência Fátima.
                        </div>
                      </li>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>3.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Meus Boletins de Medição (BMs)</strong>{" "}
                          <code style={{ fontSize: "11px", fontFamily: "monospace", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0369a1" }}>/consultor/bms</code>:
                          {" "}Valide a conferência das horas apuradas dos seus treinamentos, valores a receber e a facilidade do fluxo de assinatura digital com validade jurídica (Zoho Sign).
                        </div>
                      </li>
                      <li style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 800, color: "#0284c7", minWidth: "18px" }}>4.</span>
                        <div>
                          <strong style={{ color: "#0f172a" }}>Meus Pagamentos &amp; Repasses</strong>{" "}
                          <code style={{ fontSize: "11px", fontFamily: "monospace", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0369a1" }}>/consultor/pagamentos</code>:
                          {" "}Acompanhe as previsões financeiras, extrato de liquidações, notas fiscais, RDVs (relatórios de viagem/reembolsos de despesas) e o histórico de pagamentos efetuados.
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
                      <span style={{ color: "#475569" }}>• Link Oficial de Acesso (Tela de Login):</span>
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
                        {usuarioSelecionado.login || (ehPerfilAgencia(usuarioSelecionado) ? "agencia.fatima" : "usuario")}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#475569" }}>• E-mail Cadastrado:</span>
                      <span style={{ fontWeight: 700, color: "#1e293b" }}>{usuarioSelecionado.email}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#475569" }}>• Senha Inicial:</span>
                      <span style={{ fontWeight: 800, color: "#0f172a", backgroundColor: "#ffffff", padding: "2px 8px", borderRadius: "6px", border: "1px solid #fde68a", fontFamily: "monospace", fontSize: "12px" }}>
                        {obterSenhaLegivel(usuarioSelecionado)}
                      </span>
                    </div>
                    {ehPerfilAgencia(usuarioSelecionado) ? (
                      <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#92400e", fontWeight: 600 }}>
                        * Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no módulo de Viagens &amp; Logística (/viagens).
                      </p>
                    ) : ehPerfilConsultor(usuarioSelecionado) ? (
                      <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#0369a1", fontWeight: 600 }}>
                        * Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no seu Portal do Consultor (/consultor).
                      </p>
                    ) : null}
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
                    alignItems: "flex-start",
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
                      marginTop: "2px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>psychology</span>
                  </div>
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", marginBottom: "4px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      🦉 DÚVIDAS? UTILIZE O GUIA E O AGENTE DE IA:
                    </strong>
                    <p style={{ margin: "0 0 6px 0", color: "#0c4a6e" }}>
                      No topo direito (ou no botão flutuante com o ícone da coruja), clique em <strong>&quot;Ajuda &amp; IA&quot;</strong>:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "3px" }}>
                      <li>Na aba <strong>Guia de Processos</strong>, você encontra o passo a passo e o macrofluxo das 7 etapas da NNÓS.</li>
                      <li>Na aba <strong>Agente de IA NNÓS</strong>, faça perguntas com suas próprias palavras para tirar dúvidas sobre regras corporativas.</li>
                    </ul>
                  </div>
                </div>

                {/* Seção 4: Segurança / Apontamentos & Assinatura */}
                {modoConvite === "BOAS_VINDAS" ? (
                  <div style={{ paddingTop: "10px", borderTop: "1px solid #f1f5f9", fontSize: "12.5px", color: "#475569", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <h3 style={{ margin: 0, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 800, color: "#0f172a" }}>
                      🔒 SEGURANÇA DA CONTA &amp; BOAS PRÁTICAS DE ACESSO:
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px", color: "#64748b" }}>
                      <li>Suas credenciais são pessoais e intransferíveis, garantindo a rastreabilidade das aprovações e operações no sistema.</li>
                      <li>
                        {usuarioSelecionado.mfaAtivo
                          ? "Sua conta possui Autenticação em 2 Fatores (Google Authenticator - 2FA) ativa para proteção adicional."
                          : 'Recomendamos manter seus dados de acesso em local seguro. Caso precise redefinir sua senha, utilize a opção "Esqueci minha senha" na tela de login.'}
                      </li>
                      <li>
                        Sempre que precisar de apoio operacional, nossa equipe está à disposição pelo{" "}
                        <strong style={{ color: "#0f172a" }}>Microsoft Teams da Equipe de Gestão NNÓS</strong> ou por este e-mail.
                      </li>
                    </ul>
                    <p style={{ margin: 0, color: "#334155" }}>
                      {ehPerfilAgencia(usuarioSelecionado)
                        ? "Desejamos um excelente trabalho e agradecemos pela parceria contínua!"
                        : "Seja muito bem-vindo(a) à nossa nova plataforma oficial de gestão!"}
                    </p>
                    <div style={{ paddingTop: "6px" }}>
                      <p style={{ margin: 0, fontWeight: 700, color: "#1e293b" }}>
                        {ehPerfilAgencia(usuarioSelecionado) ? "Atenciosamente," : "Um abraço,"}
                      </p>
                      <p style={{ margin: "2px 0 0 0", fontWeight: 800, color: "#0f172a" }}>
                        Leonardo Campos &amp; Equipe de Gestão NNÓS
                      </p>
                      <p style={{ margin: "1px 0 0 0", color: "#94a3b8", fontSize: "11.5px" }}>
                        NNÓS Consultoria e Treinamento
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ paddingTop: "10px", borderTop: "1px solid #f1f5f9", fontSize: "12.5px", color: "#475569", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <h3 style={{ margin: 0, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 800, color: "#0f172a" }}>
                      📝 COMO ENVIAR SEUS APONTAMENTOS DE MELHORIA:
                    </h3>
                    <p style={{ margin: 0 }}>
                      Pedimos que envie seus feedbacks, processos divergentes ou sugestões diretamente pelo canal de{" "}
                      <strong style={{ color: "#0f172a" }}>Microsoft Teams da Equipe de Gestão NNÓS</strong> ou respondendo a este e-mail indicando:
                    </p>
                    <ol style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px", color: "#64748b" }}>
                      <li>Em qual tela você estava navegando;</li>
                      <li>O que ocorreu de diferente do seu processo real;</li>
                      <li>Sugestão de melhoria ou print da tela.</li>
                    </ol>
                    <p style={{ margin: 0, color: "#334155" }}>
                      {ehPerfilAgencia(usuarioSelecionado)
                        ? "Muito obrigado pela parceria contínua!"
                        : "Contamos muito com sua colaboração para colocarmos no ar o melhor sistema de gestão que a NNÓS já teve!"}
                    </p>
                    <div style={{ paddingTop: "6px" }}>
                      <p style={{ margin: 0, fontWeight: 700, color: "#1e293b" }}>
                        {ehPerfilAgencia(usuarioSelecionado) ? "Atenciosamente," : "Um abraço,"}
                      </p>
                      <p style={{ margin: "2px 0 0 0", fontWeight: 800, color: "#0f172a" }}>
                        Leonardo Campos &amp; Equipe de Gestão NNÓS
                      </p>
                      <p style={{ margin: "1px 0 0 0", color: "#94a3b8", fontSize: "11.5px" }}>
                        NNÓS Consultoria e Treinamento
                      </p>
                    </div>
                  </div>
                )}
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
                    obterAssuntoConvite(usuarioSelecionado, modoConvite)
                  )}&body=${encodeURIComponent(gerarTextoEmailPuro(usuarioSelecionado, modoConvite))}`}
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
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>send</span>
                  <span>
                    {modoConvite === "BOAS_VINDAS"
                      ? "Disparar Boas-Vindas Oficial & Registrar"
                      : "Disparar Convite & Registrar Log"}
                  </span>
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
