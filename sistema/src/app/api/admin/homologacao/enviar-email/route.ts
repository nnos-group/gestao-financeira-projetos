import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { dispararEmail, EmailAttachment } from "@/lib/email-service";
import { supabaseAdmin } from "@/lib/supabase-server";

const CHAVE_CONTROLE_CONVITES_CLOUD = "admin_controle_convites_v1";

const CODIGO_BADGE_STYLE =
  'style="font-size: 11.5px; font-family: Consolas, monospace; background-color: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; color: #0369a1;"';

function escapeHtml(texto: string): string {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizarSenhaExibicao(senhaRaw: string | undefined | null, ehAgencia: boolean): string {
  const padrao = ehAgencia ? "viagem2026" : "nnos2026";
  if (!senhaRaw || !String(senhaRaw).trim()) return padrao;
  const s = String(senhaRaw).trim();
  if (s.startsWith("scrypt$") || s.length > 40) return padrao;
  return s;
}

function carregarLogoNnosCid(): { src: string; anexos: EmailAttachment[] } {
  const urlBase = process.env.NEXT_PUBLIC_APP_URL || "https://gestao.nnos.com.br";
  const filePath = path.join(process.cwd(), "public", "logo-horizontal-branca.png");
  try {
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      return {
        src: "cid:logo-nnos-branca",
        anexos: [
          {
            filename: "logo-horizontal-branca.png",
            content: buf,
            contentType: "image/png",
            cid: "logo-nnos-branca",
            disposition: "inline",
          },
        ],
      };
    }
  } catch {}
  return { src: `${urlBase}/logo-horizontal-branca.png`, anexos: [] };
}

export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("configuracoes")
      .select("descricao")
      .eq("chave", CHAVE_CONTROLE_CONVITES_CLOUD)
      .maybeSingle();

    if (!error && data?.descricao) {
      return NextResponse.json({
        sucesso: true,
        controles: JSON.parse(data.descricao),
      });
    }
  } catch (e) {
    console.warn("Aviso ao carregar controles de convites do Supabase:", e);
  }
  return NextResponse.json({ sucesso: true, controles: {} });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Ação de persistência do controle de convites (Boas-Vindas & Homologação) no Supabase
    if (body.acao === "SALVAR_CONTROLES") {
      try {
        const db = supabaseAdmin();
        await db
          .from("configuracoes")
          .upsert(
            {
              chave: CHAVE_CONTROLE_CONVITES_CLOUD,
              descricao: JSON.stringify(body.controles || {}),
            },
            { onConflict: "chave" }
          );
      } catch (e) {
        console.warn("Aviso ao persistir controles de convites no Supabase:", e);
      }
      return NextResponse.json({ sucesso: true });
    }

    const {
      usuarioNome,
      usuarioEmail,
      usuarioLogin,
      usuarioCargo,
      usuarioSenha,
      perfilNome,
      perfilId,
      assuntoPersonalizado,
      corpoTextoPersonalizado,
      tipoConvite = "BOAS_VINDAS", // "BOAS_VINDAS" (Produção Definitivo) ou "HOMOLOGACAO"
      mfaAtivo = false,
    } = body;

    if (!usuarioEmail) {
      return NextResponse.json(
        { sucesso: false, erro: "E-mail do destinatário não informado." },
        { status: 400 }
      );
    }

    const ehBoasVindas = tipoConvite !== "HOMOLOGACAO";
    const urlLogin = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
      : "https://gestao.nnos.com.br/login";
    const canalTeams = "Microsoft Teams da Equipe de Gestão NNÓS";

    const ehAgencia =
      perfilId === "AGENCIA" ||
      (usuarioEmail || "").toLowerCase().includes("fcconsultoriadeviagens") ||
      (usuarioLogin || "").toLowerCase().includes("agencia");

    const ehConsultor =
      !ehAgencia &&
      perfilId !== "DIRETORIA" &&
      perfilId !== "LIDER" &&
      perfilId !== "FINANCEIRO" &&
      perfilId !== "ADMIN" &&
      (perfilId === "CONSULTOR" ||
        perfilId === "SOCIO" ||
        (perfilNome || "").toUpperCase().includes("CONSULTOR") ||
        (perfilNome || "").toUpperCase().includes("INSTRUTOR") ||
        (usuarioCargo || "").toUpperCase().includes("CONSULTOR") ||
        (usuarioCargo || "").toUpperCase().includes("INSTRUTOR"));

    const senhaEfetiva = sanitizarSenhaExibicao(usuarioSenha, ehAgencia);
    const loginEfetivo =
      usuarioLogin || (ehAgencia ? "agencia.fatima" : usuarioEmail);

    let assunto = assuntoPersonalizado;
    if (!assunto) {
      if (ehBoasVindas) {
        if (ehAgencia) {
          assunto = "✈️ Bem-vindos ao Módulo de Viagens & Logística NNÓS | Acesso Oficial Liberado";
        } else if (ehConsultor) {
          assunto = "🎓 Bem-vindo(a) ao Portal do Consultor NNÓS | Suas Credenciais Oficiais de Acesso";
        } else {
          assunto = "🚀 Bem-vindo(a) ao Sistema NNÓS Gestão Financeira & Projetos | Suas Credenciais Oficiais de Acesso";
        }
      } else {
        if (ehAgencia) {
          assunto = "✈️ Novo Módulo de Viagens & Logística NNÓS | Acesso para Homologação e Testes Operacionais";
        } else if (ehConsultor) {
          assunto = "🎓 Boas-vindas ao Portal do Consultor NNÓS | Acesso para Homologação e Validação Operacional";
        } else {
          assunto = "🚀 Boas-vindas ao novo Sistema NNÓS | Convocação para Homologação e Validação de Processos";
        }
      }
    }

    const saudacao = ehAgencia
      ? "Olá, Fátima e Equipe, tudo bem?"
      : `Olá, ${escapeHtml(usuarioNome || "Colaborador(a)")}, tudo bem?`;

    let conteudoApresentacao = "";
    let blocoEscopo = "";

    if (ehBoasVindas) {
      // =====================================================================
      // MODO 1: BOAS-VINDAS OFICIAL (ACESSO DEFINITIVO EM PRODUÇÃO)
      // =====================================================================
      if (ehAgencia) {
        conteudoApresentacao = `
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            Seja muito bem-vinda ao módulo oficial de <strong style="color: #0f172a;">Viagens &amp; Logística</strong> da plataforma corporativa <strong style="color: #0f172a;">NNÓS Gestão Financeira &amp; Projetos</strong>!
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            A partir de agora, todas as solicitações de passagens aéreas, hospedagens, locações, aprovações de líderes, gestão de créditos e envio de vouchers aos viajantes passam a ser operadas de forma centralizada e oficial através do nosso portal.
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0;">
            Abaixo estão suas credenciais definitivas de acesso e o resumo das funcionalidades disponíveis para a rotina diária da agência:
          </p>
        `;

        blocoEscopo = `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 22px 0;">
            <h4 style="margin: 0 0 14px 0; font-size: 12px; text-transform: uppercase; color: #1e293b; letter-spacing: 0.5px; font-weight: 800;">
              🎯 PRINCIPAIS RECURSOS DISPONÍVEIS PARA A AGÊNCIA FÁTIMA:
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.65;">
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Esteira de Solicitações &amp; Cotações</strong> <code ${CODIGO_BADGE_STYLE}>/viagens</code>: Recebimento imediato das demandas de viagem com origem, destino, datas de ida/volta, preferências e anexo dos PDFs comparativos para aprovação do Líder.</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Logística · Controle de Créditos</strong> <code ${CODIGO_BADGE_STYLE}>/viagens</code>: Gestão completa de créditos de companhias aéreas e hotéis disponíveis para reaproveitamento dentro do prazo de validade (1 ano).</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Políticas de Viagem Oficiais</strong>: Consulta rápida aos PDFs de políticas (NNÓS Consultoria, CNH Training, Iveco Group e Reembolso Vexpenses).</li>
              <li><strong style="color: #0f172a;">Emissão &amp; Disparo Automático de Vouchers</strong>: Ao anexar os bilhetes e vouchers emitidos, o sistema dispara automaticamente o kit completo de viagem por e-mail ao consultor viajante.</li>
            </ol>
          </div>
        `;
      } else if (ehConsultor) {
        conteudoApresentacao = `
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            É uma satisfação dar as boas-vindas oficiais a você no <strong style="color: #0f172a;">Portal do Consultor</strong> da plataforma <strong style="color: #0f172a;">NNÓS Gestão Financeira &amp; Projetos</strong>!
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            Seu acesso definitivo já está liberado! Este ambiente foi desenvolvido exclusivamente para centralizar e facilitar toda a sua rotina operacional e financeira com a NNÓS: acompanhamento da sua agenda de treinamentos, bloqueio de datas, consulta de passagens e vouchers de viagem, assinatura digital de Boletins de Medição (BMs) e gestão dos seus recebimentos.
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0;">
            Confira abaixo o que você já pode utilizar no seu Portal e os seus dados oficiais de acesso:
          </p>
        `;

        blocoEscopo = `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 22px 0;">
            <h4 style="margin: 0 0 14px 0; font-size: 12px; text-transform: uppercase; color: #1e293b; letter-spacing: 0.5px; font-weight: 800;">
              🎯 O QUE VOCÊ JÁ PODE UTILIZAR NO SEU PORTAL DO CONSULTOR:
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.65;">
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Minha Agenda &amp; Disponibilidade</strong> <code ${CODIGO_BADGE_STYLE}>/consultor/agenda</code>: Consulte suas turmas confirmadas, locais, datas, carga horária e registre bloqueios de agenda quando tiver indisponibilidade.</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Minhas Viagens &amp; Vouchers</strong> <code ${CODIGO_BADGE_STYLE}>/consultor/viagens</code>: Visualize e baixe suas passagens aéreas, vouchers de hotel, locação de veículo e consulte as Políticas de Viagem e Prestação de Contas (CNH, Iveco, NNÓS e Vexpenses).</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Meus Boletins de Medição (BMs)</strong> <code ${CODIGO_BADGE_STYLE}>/consultor/bms</code>: Confira as horas e atividades apuradas no mês, acompanhe a assinatura digital via Zoho Sign e envie sua Nota Fiscal correspondente.</li>
              <li><strong style="color: #0f172a;">Meus Pagamentos &amp; Repasses</strong> <code ${CODIGO_BADGE_STYLE}>/consultor/pagamentos</code>: Acompanhe o calendário de liquidação das suas Notas Fiscais, reembolsos de despesas (RDVs) e histórico financeiro completo.</li>
            </ol>
          </div>
        `;
      } else {
        conteudoApresentacao = `
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            É uma satisfação dar as boas-vindas oficiais a você na plataforma corporativa <strong style="color: #0f172a;">NNÓS Gestão Financeira &amp; Projetos</strong>!
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            Seu acesso definitivo em produção já está ativo! A plataforma integra em um único ambiente o planejamento operacional de turmas, o fluxo de cotação e aprovação de viagens, a emissão e assinatura digital de Boletins de Medição (BMs) via Zoho Sign, o faturamento e a Central Executiva de Relatórios.
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0;">
            Confira abaixo os principais módulos liberados para o seu perfil e as suas credenciais oficiais de acesso:
          </p>
        `;

        blocoEscopo = `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 22px 0;">
            <h4 style="margin: 0 0 14px 0; font-size: 12px; text-transform: uppercase; color: #1e293b; letter-spacing: 0.5px; font-weight: 800;">
              🎯 PRINCIPAIS MÓDULOS DISPONÍVEIS NO SEU PERFIL:
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.65;">
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Projetos &amp; Atividades</strong> <code ${CODIGO_BADGE_STYLE}>/projetos</code>: Planejamento e gestão de turmas, alocação de consultores/instrutores, cálculo automático de tabelas contratuais e solicitação integrada de logística.</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Viagens &amp; Logística</strong> <code ${CODIGO_BADGE_STYLE}>/viagens</code>: Acompanhamento da esteira de cotações, aprovação ou devolutiva de propostas em PDF enviadas pela Agência Fátima e controle de créditos.</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">BM - Boletim de Medição</strong> <code ${CODIGO_BADGE_STYLE}>/medicao</code>: Apuração mensal de entregas, emissão de BMs, disparo de assinatura eletrônica via Zoho Sign e homologação financeira.</li>
              <li><strong style="color: #0f172a;">Central Executiva de Relatórios</strong> <code ${CODIGO_BADGE_STYLE}>/relatorios</code>: Acompanhamento Semanal, DRE Gerencial, Matriz Financeira, Painel por Líder e indicadores de rentabilidade em tempo real.</li>
            </ol>
          </div>
        `;
      }
    } else {
      // =====================================================================
      // MODO 2: CONVITE DE HOMOLOGAÇÃO (VALIDAÇÃO & TESTES)
      // =====================================================================
      if (ehAgencia) {
        conteudoApresentacao = `
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            Gostaríamos de dar as boas-vindas ao novo módulo de <strong style="color: #0f172a;">Viagens &amp; Logística</strong> do sistema corporativo da NNÓS Consultoria!
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            Criamos uma área totalmente dedicada à agência para facilitar, agilizar e centralizar a nossa comunicação diária: desde o recebimento das ordens logísticas geradas pelas turmas até o lançamento de opções de cotação e upload dos vouchers definitivos aos viajantes.
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0;">
            Como parceiros estratégicos da nossa operação logística, convidamos vocês para testar a ferramenta com as demandas reais e nos apontar quaisquer ajustes necessários antes da entrada em produção.
          </p>
        `;

        blocoEscopo = `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 22px 0;">
            <h4 style="margin: 0 0 14px 0; font-size: 12px; text-transform: uppercase; color: #1e293b; letter-spacing: 0.5px; font-weight: 800;">
              🎯 FOCO PRINCIPAL DA VALIDAÇÃO PELA AGÊNCIA FÁTIMA:
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.65;">
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Solicitações de Logística</strong> <code ${CODIGO_BADGE_STYLE}>/viagens</code>: Verifique se as informações transmitidas das turmas (origem, destino, concessionária, datas de ida/volta e necessidade de bagagem) estão claras e completas para cotação.</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Matriz de Cotação</strong> <code ${CODIGO_BADGE_STYLE}>/viagens</code>: Teste a inserção das opções de voo, valores de hotel e traslados, avaliando se o formato atende a agilidade necessária no dia a dia.</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Políticas de Viagem</strong>: No card de Políticas de Viagem, vocês têm acesso direto aos PDFs oficiais (NNÓS, CNH Training, Iveco Group e Reembolso Vexpenses) para conferência rápida de limites de diárias e prestação de contas.</li>
              <li><strong style="color: #0f172a;">Upload de Vouchers</strong>: Teste o envio de vouchers em PDF para conferência do viajante.</li>
            </ol>
          </div>
        `;
      } else if (ehConsultor) {
        conteudoApresentacao = `
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            É com grande entusiasmo que convidamos você para fazer parte do primeiro grupo de validação do novo <strong style="color: #0f172a;">Portal do Consultor</strong> no sistema NNÓS Gestão Financeira &amp; Projetos!
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            Desenvolvemos esta área exclusiva para você acompanhar e gerenciar de forma transparente toda a sua dinâmica operacional e financeira: sua agenda de treinamentos, orientações e vouchers de viagens, conferência e assinatura digital de Boletins de Medição (BMs) via Zoho Sign e a consulta detalhada de pagamentos e reembolsos.
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0;">
            Estamos na reta final para a liberação em produção e a sua validação prática é fundamental para garantirmos que a experiência do consultor seja simples, ágil e precisa no seu dia a dia.
          </p>
        `;

        blocoEscopo = `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 22px 0;">
            <h4 style="margin: 0 0 14px 0; font-size: 12px; text-transform: uppercase; color: #1e293b; letter-spacing: 0.5px; font-weight: 800;">
              🎯 O QUE PRECISAMOS QUE VOCÊ TESTE E VALIDE (PORTAL DO CONSULTOR):
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.65;">
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Minha Agenda</strong> <code ${CODIGO_BADGE_STYLE}>/consultor/agenda</code>: Consulte seus treinamentos e turmas programadas, conferindo datas, horários, concessionárias, cidades e detalhamentos da atividade.</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Minhas Viagens &amp; Logística</strong> <code ${CODIGO_BADGE_STYLE}>/consultor/viagens</code>: Acompanhe o status dos seus deslocamentos, passagens aéreas emitidas, hospedagens, translados e vouchers disponibilizados pela Agência Fátima.</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Meus Boletins de Medição (BMs)</strong> <code ${CODIGO_BADGE_STYLE}>/consultor/bms</code>: Valide a conferência das horas apuradas dos seus treinamentos, valores a receber e a facilidade do fluxo de assinatura digital com validade jurídica (Zoho Sign).</li>
              <li><strong style="color: #0f172a;">Meus Pagamentos &amp; Repasses</strong> <code ${CODIGO_BADGE_STYLE}>/consultor/pagamentos</code>: Acompanhe as previsões financeiras, extrato de liquidações, notas fiscais, RDVs (relatórios de viagem/reembolsos de despesas) e o histórico de pagamentos efetuados.</li>
            </ol>
          </div>
        `;
      } else {
        conteudoApresentacao = `
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            É com grande entusiasmo que convidamos você para fazer parte do primeiro grupo de validação do novo sistema <strong style="color: #0f172a;">NNÓS Gestão Financeira &amp; Projetos</strong>!
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px 0;">
            Desenvolvemos esta plataforma para integrar e desburocratizar a gestão dos nossos treinamentos, concentrando em um único lugar o planejamento de turmas, a logística de viagens, a emissão de Boletins de Medição (BM) com assinaturas digitais via Zoho Sign e a rentabilidade da sua carteira em tempo real.
          </p>
          <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0;">
            Estamos na reta final para a liberação em produção e o seu olhar operacional é fundamental para garantirmos que a ferramenta reflita com 100% de precisão os processos e a dinâmica real do nosso dia a dia.
          </p>
        `;

        blocoEscopo = `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 22px 0;">
            <h4 style="margin: 0 0 14px 0; font-size: 12px; text-transform: uppercase; color: #1e293b; letter-spacing: 0.5px; font-weight: 800;">
              🎯 O QUE PRECISAMOS QUE VOCÊ TESTE E VALIDE:
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.65;">
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Projetos &amp; Atividades</strong> <code ${CODIGO_BADGE_STYLE}>/projetos</code>: Crie e consulte turmas da sua carteira, verifique as concessões/cidades, a carga horária (8h, 24h ou 40h) e a alocação de instrutores parceiros ou sócios (incluindo o acréscimo de 6% quando aplicável).</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Viagens &amp; Logística</strong> <code ${CODIGO_BADGE_STYLE}>/viagens</code>: Avalie as solicitações de deslocamento, confira as cotações lançadas pela Agência Fátima e o fluxo de aprovação técnica.</li>
              <li style="margin-bottom: 10px;"><strong style="color: #0f172a;">Boletins de Medição</strong> <code ${CODIGO_BADGE_STYLE}>/medicao</code>: Valide a conferência das horas apuradas da sua equipe e a experiência com o fluxo de assinatura digital (Zoho Sign).</li>
              <li><strong style="color: #0f172a;">Central de Relatórios</strong> <code ${CODIGO_BADGE_STYLE}>/relatorios</code>: Confira os demonstrativos, custos diretos e margem da sua unidade de negócio.</li>
            </ol>
          </div>
        `;
      }
    }

    const { src: logoNnosSrc, anexos: anexosCid } = carregarLogoNnosCid();

    const subtituloHeader = ehBoasVindas
      ? ehAgencia
        ? "Módulo de Viagens &amp; Logística Integrada · Acesso Oficial Liberado"
        : ehConsultor
        ? "Portal do Consultor · Acesso Oficial Liberado"
        : "Sistema de Gestão Financeira &amp; Projetos · Acesso Oficial Liberado"
      : ehAgencia
      ? "Módulo de Viagens &amp; Logística Integrada · Homologação Oficial"
      : ehConsultor
      ? "Portal do Consultor · Homologação Oficial 2026"
      : "Sistema de Gestão Financeira &amp; Projetos · Exercício 2026";

    const blocoRodapeFinal = ehBoasVindas
      ? `
          <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; font-size: 13px; color: #475569; line-height: 1.65;">
            <h4 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; color: #0f172a;">
              🔒 SEGURANÇA DA CONTA &amp; BOAS PRÁTICAS DE ACESSO:
            </h4>
            <ul style="margin: 0 0 14px; padding-left: 20px; color: #64748b;">
              <li style="margin-bottom: 4px;">Suas credenciais são pessoais e intransferíveis, garantindo a rastreabilidade das aprovações e operações no sistema.</li>
              ${
                mfaAtivo
                  ? `<li style="margin-bottom: 4px;">Sua conta possui <strong style="color: #0f172a;">Autenticação em 2 Fatores (Google Authenticator - 2FA)</strong> ativa para proteção adicional.</li>`
                  : `<li style="margin-bottom: 4px;">Recomendamos manter seus dados de acesso em local seguro. Caso precise redefinir sua senha, utilize a opção <strong>"Esqueci minha senha"</strong> na tela de login.</li>`
              }
              <li>Sempre que precisar de apoio operacional ou tiver qualquer dúvida, nossa equipe está à disposição pelo <strong style="color: #0f172a;">${canalTeams}</strong> ou por este e-mail.</li>
            </ul>
            <p style="margin: 0 0 14px; color: #334155;">
              ${ehAgencia ? "Desejamos um excelente trabalho e agradecemos pela parceria contínua!" : "Seja muito bem-vindo(a) à nossa nova plataforma oficial de gestão!"}
            </p>
            <p style="margin: 0; font-weight: 700; color: #1e293b;">
              ${ehAgencia ? "Atenciosamente," : "Um abraço,"}
            </p>
            <p style="margin: 2px 0 0; font-weight: 800; color: #0f172a;">
              Leonardo Campos &amp; Equipe de Gestão NNÓS
            </p>
            <p style="margin: 1px 0 0; color: #94a3b8; font-size: 11.5px;">
              NNÓS Consultoria e Treinamento
            </p>
          </div>
      `
      : `
          <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; font-size: 13px; color: #475569; line-height: 1.65;">
            <h4 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; color: #0f172a;">
              📝 COMO ENVIAR SEUS APONTAMENTOS DE MELHORIA:
            </h4>
            <p style="margin: 0 0 8px;">
              Pedimos que envie seus feedbacks, processos divergentes ou sugestões diretamente pelo canal de <strong style="color: #0f172a;">${canalTeams}</strong> ou respondendo a este e-mail indicando:
            </p>
            <ol style="margin: 0 0 14px; padding-left: 20px; color: #64748b;">
              <li style="margin-bottom: 4px;">Em qual tela você estava navegando;</li>
              <li style="margin-bottom: 4px;">O que ocorreu de diferente do seu processo real;</li>
              <li>Sugestão de melhoria ou print da tela.</li>
            </ol>
            <p style="margin: 0 0 14px; color: #334155;">
              ${ehAgencia ? "Muito obrigado pela parceria contínua!" : "Contamos muito com sua colaboração para colocarmos no ar o melhor sistema de gestão que a NNÓS já teve!"}
            </p>
            <p style="margin: 0; font-weight: 700; color: #1e293b;">
              ${ehAgencia ? "Atenciosamente," : "Um abraço,"}
            </p>
            <p style="margin: 2px 0 0; font-weight: 800; color: #0f172a;">
              Leonardo Campos &amp; Equipe de Gestão NNÓS
            </p>
            <p style="margin: 1px 0 0; color: #94a3b8; font-size: 11.5px;">
              NNÓS Consultoria e Treinamento
            </p>
          </div>
      `;

    const html = `
      <div style="font-family: 'Plus Jakarta Sans', 'Inter', 'Segoe UI', Arial, sans-serif; max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #1e293b;">
        <!-- Header Corporativo (com fallback sólido #0f2a4a e logo NNÓS embutida via CID) -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #0f2a4a; background-image: linear-gradient(135deg, #00152f 0%, #0f2a4a 100%);">
          <tr>
            <td style="padding: 24px 28px; text-align: left; color: #ffffff; vertical-align: middle;">
              <div style="font-size: 19px; font-weight: 800; letter-spacing: 0.4px; color: #ffffff;">NNÓS CONSULTORIA E TREINAMENTO</div>
              <p style="margin: 5px 0 0; font-size: 13px; color: #bae6fd; font-weight: 500;">
                ${subtituloHeader}
              </p>
            </td>
            <td align="right" style="padding: 20px 28px; vertical-align: middle; width: 150px;">
              <img src="${logoNnosSrc}" alt="NNÓS" width="128" style="display: block; width: 128px; max-width: 128px; height: auto; border: 0; outline: none;" />
            </td>
          </tr>
        </table>

        <!-- Conteúdo Principal -->
        <div style="padding: 28px 26px;">
          <div style="padding-bottom: 14px; margin-bottom: 18px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px;">
            <strong style="color: #0f172a;">Assunto:</strong>
            <span style="font-weight: 700; color: #0c4a6e;">${escapeHtml(assunto)}</span>
          </div>

          <h3 style="color: #0f172a; font-size: 16px; margin-top: 0; margin-bottom: 14px; font-weight: 700;">
            ${saudacao}
          </h3>

          ${conteudoApresentacao}

          ${blocoEscopo}

          <!-- Card de Credenciais Destacado -->
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 20px; margin: 22px 0;">
            <h4 style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; color: #78350f; letter-spacing: 0.5px; font-weight: 800;">
              🔑 SEUS DADOS OFICIAIS DE ACESSO:
            </h4>
            <table style="width: 100%; font-size: 13.5px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #475569; width: 225px;">• Link Oficial de Acesso (Tela de Login):</td>
                <td style="padding: 6px 0;">
                  <a href="${escapeHtml(urlLogin)}" target="_blank" style="color: #0284c7; font-weight: 700; text-decoration: underline;">
                    ${escapeHtml(urlLogin)}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569;">• Seu Usuário / Login:</td>
                <td style="padding: 6px 0;">
                  <span style="font-weight: 800; color: #0f172a; background-color: #ffffff; padding: 2px 8px; border-radius: 6px; border: 1px solid #fde68a; font-family: Consolas, monospace; font-size: 12.5px;">
                    ${escapeHtml(loginEfetivo)}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569;">• E-mail Cadastrado:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #1e293b;">${escapeHtml(usuarioEmail)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569;">• Senha Inicial:</td>
                <td style="padding: 6px 0;">
                  <span style="font-weight: 800; color: #0f172a; background-color: #ffffff; padding: 2px 8px; border-radius: 6px; border: 1px solid #fde68a; font-family: Consolas, monospace; font-size: 12.5px;">
                    ${escapeHtml(senhaEfetiva)}
                  </span>
                </td>
              </tr>
            </table>
            ${
              ehAgencia
                ? `<p style="margin: 10px 0 0 0; font-size: 12px; color: #92400e; font-weight: 600;">* Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no módulo de Viagens &amp; Logística (/viagens).</p>`
                : ehConsultor
                ? `<p style="margin: 10px 0 0 0; font-size: 12px; color: #0369a1; font-weight: 600;">* Nota: Ao efetuar o login com suas credenciais, seu acesso abrirá diretamente no seu Portal do Consultor (/consultor).</p>`
                : ""
            }
          </div>

          <!-- Botão de Ação Direta -->
          <div style="text-align: center; margin: 26px 0;">
            <a href="${escapeHtml(urlLogin)}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 13px 30px; border-radius: 8px; font-size: 14px; font-weight: 700;">
              ${ehAgencia ? "Acessar Módulo de Viagens &amp; Logística →" : ehConsultor ? "Acessar Portal do Consultor NNÓS →" : "Acessar Plataforma de Gestão NNÓS →"}
            </a>
          </div>

          <!-- Suporte com Guia e IA -->
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 14px; padding: 18px 20px; margin: 22px 0; font-size: 13px; color: #0369a1; line-height: 1.6;">
            <h4 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; color: #0f172a;">
              🦉 DÚVIDAS? UTILIZE O GUIA E O AGENTE DE IA:
            </h4>
            <p style="margin: 0 0 8px 0; color: #0c4a6e;">
              No topo direito (ou no botão flutuante com o ícone da coruja), clique em <strong>"Ajuda &amp; IA"</strong>:
            </p>
            <ul style="margin: 0; padding-left: 18px; color: #0369a1;">
              <li style="margin-bottom: 4px;">Na aba <strong>Guia de Processos</strong>, você encontra o passo a passo e o macrofluxo das 7 etapas da NNÓS.</li>
              <li>Na aba <strong>Agente de IA NNÓS</strong>, faça perguntas com suas próprias palavras para tirar dúvidas sobre regras corporativas.</li>
            </ul>
          </div>

          ${blocoRodapeFinal}
        </div>

        <!-- Rodapé -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8;">
          NNÓS Consultoria e Treinamento Ltda · CNPJ 36.443.716/0001-00 · Belo Horizonte / MG
        </div>
      </div>
    `;

    const textoAlternativo =
      corpoTextoPersonalizado ||
      `Olá ${usuarioNome}, bem-vindo(a) ao ${
        ehAgencia ? "Módulo de Viagens & Logística" : ehConsultor ? "Portal do Consultor" : "Sistema de Gestão"
      } NNÓS. Link: ${urlLogin} | Usuário: ${loginEfetivo} | Senha Inicial: ${senhaEfetiva}`;

    const resultado = await dispararEmail({
      para: usuarioEmail,
      assunto,
      html,
      texto: textoAlternativo,
      anexos: anexosCid,
    });

    return NextResponse.json({
      sucesso: resultado.sucesso,
      modo: resultado.modo,
      mensagemId: resultado.mensagemId,
      mensagem: resultado.mensagem,
      destinatario: resultado.destinatario,
    });
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
}
