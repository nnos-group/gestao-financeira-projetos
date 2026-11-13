import { NextRequest, NextResponse } from "next/server";
import { dispararEmail } from "@/lib/email-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      usuarioNome,
      usuarioEmail,
      usuarioLogin,
      usuarioSenha,
      perfilNome,
      perfilId,
      assuntoPersonalizado,
      corpoTextoPersonalizado,
    } = body;

    if (!usuarioEmail) {
      return NextResponse.json(
        { sucesso: false, erro: "E-mail do destinatário não informado." },
        { status: 400 }
      );
    }

    const urlLogin = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
      : "https://gestao.nnos.com.br/login";
    const canalTeams = "Microsoft Teams da Equipe de Gestão NNÓS";

    const ehAgencia =
      perfilId === "AGENCIA" ||
      (usuarioEmail || "").toLowerCase().includes("fcconsultoriadeviagens") ||
      (usuarioLogin || "").toLowerCase().includes("agencia");

    const ehConsultor =
      perfilId === "CONSULTOR" ||
      (perfilNome || "").toUpperCase().includes("CONSULTOR") ||
      (perfilNome || "").toUpperCase().includes("INSTRUTOR");

    const senhaEfetiva =
      usuarioSenha || (ehAgencia ? "viagem2026" : "nnos2026");

    const loginEfetivo =
      usuarioLogin || (ehAgencia ? "agencia.fatima" : usuarioEmail);

    let assunto = assuntoPersonalizado;
    if (!assunto) {
      if (ehAgencia) {
        assunto = "✈️ Novo Módulo de Viagens & Logística NNÓS | Acesso para Homologação e Testes Operacionais";
      } else if (ehConsultor) {
        assunto = "🎓 Boas-vindas ao Portal do Consultor NNÓS | Acesso para Homologação e Validação Operacional";
      } else {
        assunto = "🚀 Boas-vindas ao novo Sistema NNÓS | Convocação para Homologação e Validação de Processos";
      }
    }

    let saudacao = `Olá, ${usuarioNome || "Colaborador(a)"}, tudo bem?`;
    if (ehAgencia) {
      saudacao = "Olá, Fátima e Equipe, tudo bem?";
    }

    let conteudoApresentacao = "";
    let blocoEscopo = "";

    if (ehAgencia) {
      conteudoApresentacao = `
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 12px 0;">
          Gostaríamos de dar as boas-vindas ao novo módulo de <strong>Viagens &amp; Logística</strong> do sistema corporativo da NNÓS Consultoria!
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 12px 0;">
          Criamos uma área totalmente dedicada à agência para facilitar, agilizar e centralizar a nossa comunicação diária: desde o recebimento das ordens logísticas geradas pelas turmas até o lançamento de opções de cotação e upload dos vouchers definitivos aos viajantes.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0;">
          Como parceiros estratégicos da nossa operação logística, convidamos vocês para testar a ferramenta com as demandas reais e nos apontar quaisquer ajustes necessários antes da entrada em produção.
        </p>
      `;

      blocoEscopo = `
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
          <h4 style="margin: 0 0 12px; font-size: 13px; text-transform: uppercase; color: #0369a1; letter-spacing: 0.5px; font-weight: 800;">
            🎯 FOCO PRINCIPAL DA VALIDAÇÃO PELA AGÊNCIA FÁTIMA:
          </h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e293b; line-height: 1.65;">
            <li style="margin-bottom: 8px;"><strong>Solicitações de Logística (/viagens):</strong> Verifique se as informações transmitidas das turmas (origem, destino, concessionária, datas de ida/volta e necessidade de bagagem) estão claras e completas para cotação.</li>
            <li style="margin-bottom: 8px;"><strong>Matriz de Cotação (/viagens):</strong> Teste a inserção das opções de voo, valores de hotel e traslados, avaliando se o formato atende a agilidade necessária no dia a dia.</li>
            <li style="margin-bottom: 8px;"><strong>Políticas de Viagem:</strong> No card de Políticas de Viagem, vocês têm acesso direto aos PDFs oficiais (NNÓS, CNH Training, Iveco Group e Reembolso Vexpenses) para conferência rápida de limites de diárias e prestação de contas.</li>
            <li><strong>Upload de Vouchers:</strong> Teste o envio de vouchers em PDF para conferência do viajante.</li>
          </ol>
        </div>
      `;
    } else if (ehConsultor) {
      conteudoApresentacao = `
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 12px 0;">
          É com grande entusiasmo que convidamos você para fazer parte do primeiro grupo de validação do novo <strong>Portal do Consultor</strong> no sistema NNÓS Gestão Financeira &amp; Projetos!
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 12px 0;">
          Desenvolvemos esta área exclusiva para você acompanhar e gerenciar de forma transparente toda a sua dinâmica operacional e financeira: sua agenda de treinamentos, orientações e vouchers de viagens, conferência e assinatura digital de Boletins de Medição (BMs) via Zoho Sign e a consulta detalhada de pagamentos e reembolsos.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0;">
          Estamos na reta final para a liberação em produção e a sua validação prática é fundamental para garantirmos que a experiência do consultor seja simples, ágil e precisa no seu dia a dia.
        </p>
      `;

      blocoEscopo = `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
          <h4 style="margin: 0 0 12px; font-size: 13px; text-transform: uppercase; color: #166534; letter-spacing: 0.5px; font-weight: 800;">
            🎯 O QUE PRECISAMOS QUE VOCÊ TESTE E VALIDE:
          </h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e293b; line-height: 1.65;">
            <li style="margin-bottom: 8px;"><strong>Minha Agenda (/consultor/agenda):</strong> Consulte seus treinamentos e turmas programadas, conferindo datas, horários, concessionárias, cidades e detalhamentos da atividade.</li>
            <li style="margin-bottom: 8px;"><strong>Minhas Viagens &amp; Logística (/consultor/viagens):</strong> Acompanhe o status dos seus deslocamentos, passagens aéreas emitidas, hospedagens, translados e vouchers disponibilizados pela Agência Fátima.</li>
            <li style="margin-bottom: 8px;"><strong>Meus Boletins de Medição (/consultor/bms):</strong> Valide a conferência das horas apuradas dos seus treinamentos, valores a receber e a facilidade do fluxo de assinatura digital com validade jurídica (Zoho Sign).</li>
            <li><strong>Meus Pagamentos &amp; Repasses (/consultor/pagamentos):</strong> Acompanhe as previsões financeiras, extrato de liquidações, notas fiscais, RDVs (relatórios de viagem/reembolsos de despesas) e o histórico de pagamentos efetuados.</li>
          </ol>
        </div>
      `;
    } else {
      conteudoApresentacao = `
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 12px 0;">
          É com grande entusiasmo que convidamos você para fazer parte do primeiro grupo de validação do novo sistema <strong>NNÓS Gestão Financeira &amp; Projetos</strong>!
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 12px 0;">
          Desenvolvemos esta plataforma para integrar e desburocratizar a gestão dos nossos treinamentos, concentrando em um único lugar o planejamento de turmas, a logística de viagens, a emissão de Boletins de Medição (BM) com assinaturas digitais via Zoho Sign e a rentabilidade da sua carteira em tempo real.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0;">
          Estamos na reta final para a liberação em produção e o seu olhar operacional é fundamental para garantirmos que a ferramenta reflita com 100% de precisão os processos e a dinâmica real do nosso dia a dia.
        </p>
      `;

      blocoEscopo = `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
          <h4 style="margin: 0 0 12px; font-size: 13px; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px; font-weight: 800;">
            🎯 O QUE PRECISAMOS QUE VOCÊ TESTE E VALIDE:
          </h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e293b; line-height: 1.65;">
            <li style="margin-bottom: 8px;"><strong>Projetos &amp; Atividades (/projetos):</strong> Crie e consulte turmas da sua carteira, verifique as concessões/cidades, a carga horária (8h, 24h ou 40h) e a alocação de instrutores parceiros ou sócios (incluindo o acréscimo de 6% quando aplicável).</li>
            <li style="margin-bottom: 8px;"><strong>Viagens &amp; Logística (/viagens):</strong> Avalie as solicitações de deslocamento, confira as cotações lançadas pela Agência Fátima e o fluxo de aprovação técnica.</li>
            <li style="margin-bottom: 8px;"><strong>Boletins de Medição (/medicao):</strong> Valide a conferência das horas apuradas da sua equipe e a experiência com o fluxo de assinatura digital (Zoho Sign).</li>
            <li><strong>Central de Relatórios (/relatorios):</strong> Confira os demonstrativos, custos diretos e margem da sua unidade de negócio.</li>
          </ol>
        </div>
      `;
    }

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; color: #1e293b;">
        <!-- Header Corporativo -->
        <div style="background: linear-gradient(135deg, #00152f 0%, #0f2a4a 100%); padding: 24px 28px; text-align: left; color: #ffffff;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">NNÓS CONSULTORIA E TREINAMENTO</div>
          </div>
          <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">
            ${ehAgencia ? "Módulo de Viagens &amp; Logística Integrada · Homologação Oficial" : ehConsultor ? "Portal do Consultor · Homologação Oficial 2026" : "Sistema de Gestão Financeira &amp; Projetos · Exercício 2026"}
          </p>
        </div>

        <!-- Conteúdo Principal -->
        <div style="padding: 28px 24px;">
          <h3 style="color: #0f2a4a; font-size: 17px; margin-top: 0; margin-bottom: 14px; font-weight: 700;">
            ${saudacao}
          </h3>

          ${conteudoApresentacao}

          ${blocoEscopo}

          <!-- Card de Credenciais Destacado -->
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; margin: 22px 0;">
            <h4 style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; color: #78350f; letter-spacing: 0.5px; font-weight: 800;">
              🔑 SEUS DADOS DE ACESSO:
            </h4>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0; color: #475569; width: 160px;">• Link Oficial (Tela de Login):</td>
                <td style="padding: 5px 0;">
                  <a href="${urlLogin}" target="_blank" style="color: #0284c7; font-weight: 700; text-decoration: underline;">
                    ${urlLogin}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #475569;">• Seu Usuário / Login:</td>
                <td style="padding: 5px 0; font-weight: 800; color: #0f172a; font-family: monospace;">
                  ${loginEfetivo}
                </td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #475569;">• E-mail Cadastrado:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #1e293b;">${usuarioEmail}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #475569;">• Senha Inicial:</td>
                <td style="padding: 5px 0; font-weight: 800; color: #0f172a; font-family: monospace;">
                  ${senhaEfetiva}
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
            <a href="${urlLogin}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 13px 30px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 3px 8px rgba(2, 132, 199, 0.35);">
              ${ehAgencia ? "Acessar Módulo de Viagens &amp; Logística" : ehConsultor ? "Acessar Portal do Consultor NNÓS" : "Acessar Sistema de Gestão NNÓS"}
            </a>
          </div>

          <!-- Suporte com Guia e IA -->
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 16px 18px; margin: 22px 0; font-size: 12.5px; color: #0369a1;">
            <strong style="color: #0f172a; display: block; margin-bottom: 2px;">
              🦉 DÚVIDAS? UTILIZE O GUIA E O AGENTE DE IA:
            </strong>
            Dentro do sistema, clique no botão flutuante <strong>"Ajuda &amp; IA"</strong> (ícone da coruja) para consultar o passo a passo de todas as telas ou tirar dúvidas conceituais diretamente com a IA da NNÓS.
          </div>

          <!-- Canal de Apontamentos & Assinatura -->
          <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; font-size: 12.5px; color: #475569; line-height: 1.6;">
            <p style="margin: 0 0 8px;">
              Pedimos que qualquer processo divergente, sugestão ou ajuste seja enviado pelo canal de <strong>${canalTeams}</strong> ou respondendo a este e-mail indicando:
            </p>
            <ul style="margin: 0 0 14px; padding-left: 20px; color: #64748b;">
              <li>Em qual tela você estava navegando;</li>
              <li>O que ocorreu de diferente do seu processo real;</li>
              <li>Sugestão de melhoria ou print da tela.</li>
            </ul>
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
        </div>

        <!-- Rodapé -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8;">
          NNÓS Consultoria e Treinamento Ltda · CNPJ 36.443.716/0001-00 · Belo Horizonte / MG
        </div>
      </div>
    `;

    const textoAlternativo =
      corpoTextoPersonalizado ||
      `Olá ${usuarioNome}, segue seu convite oficial para homologação do ${
        ehAgencia ? "Módulo de Viagens & Logística" : ehConsultor ? "Portal do Consultor" : "Sistema de Gestão"
      } NNÓS. Link: ${urlLogin} | Usuário: ${loginEfetivo} | Senha Inicial: ${senhaEfetiva}`;

    const resultado = await dispararEmail({
      para: usuarioEmail,
      assunto,
      html,
      texto: textoAlternativo,
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
