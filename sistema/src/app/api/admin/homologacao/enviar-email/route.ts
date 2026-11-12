import { NextRequest, NextResponse } from "next/server";
import { dispararEmail } from "@/lib/email-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { usuarioNome, usuarioEmail, usuarioLogin, perfilNome, perfilId } = body;

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

    const ehConsultor = perfilId === "CONSULTOR" || (perfilNome || "").toUpperCase().includes("CONSULTOR");
    const ehAgencia = perfilId === "AGENCIA" || (usuarioEmail || "").includes("fcconsultoriadeviagens");

    const escopoValidacao = ehConsultor
      ? `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; color: #166534; letter-spacing: 0.5px;">O que precisamos que você teste e valide:</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e293b; line-height: 1.6;">
            <li><strong>Minha Agenda (/consultor/agenda):</strong> Consulte seus treinamentos agendados, conferindo datas, horários, concessionárias e cidades.</li>
            <li><strong>Minhas Viagens &amp; Logística (/consultor/viagens):</strong> Acompanhe passagens aéreas, hospedagens, translados e vouchers da Agência Fátima.</li>
            <li><strong>Meus Boletins de Medição (/consultor/bms):</strong> Valide a conferência das horas e valores a receber e a assinatura digital via Zoho Sign.</li>
            <li><strong>Meus Pagamentos &amp; Repasses (/consultor/pagamentos):</strong> Acompanhe as previsões financeiras, extrato de liquidações, notas fiscais e relatórios de viagem (RDVs).</li>
          </ul>
        </div>
      `
      : ehAgencia
      ? `
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; color: #1e40af; letter-spacing: 0.5px;">Foco da Validação Operacional (Agência):</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e293b; line-height: 1.6;">
            <li><strong>Solicitações de Logística (/viagens):</strong> Conferir clareza de origens, destinos, datas e necessidades de bagagem.</li>
            <li><strong>Matriz de Cotação:</strong> Inserção de opções de voo, valores de hotel e traslados para aprovação.</li>
            <li><strong>Políticas de Viagem &amp; Vouchers:</strong> Acesso aos PDFs oficiais e upload de bilhetes/vouchers.</li>
          </ul>
        </div>
      `
      : `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px;">O que precisamos que você teste e valide:</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e293b; line-height: 1.6;">
            <li><strong>Projetos &amp; Atividades (/projetos):</strong> Planejamento e consulta de turmas, concessões e alocação de instrutores.</li>
            <li><strong>Viagens &amp; Logística (/viagens):</strong> Solicitações de deslocamento e aprovação de cotações da Agência Fátima.</li>
            <li><strong>Boletins de Medição (/medicao):</strong> Conferência de horas apuradas da equipe e assinaturas via Zoho Sign.</li>
            <li><strong>Central de Relatórios (/relatorios):</strong> Indicadores, demonstrativos de custos diretos e margem da carteira.</li>
          </ul>
        </div>
      `;

    const introTexto = ehConsultor
      ? "Você foi convidado(a) para participar da <strong>Fase Oficial de Homologação</strong> do novo <strong>Portal do Consultor</strong> da NNÓS Consultoria e Treinamento. Esta área exclusiva foi desenvolvida para você gerenciar sua agenda, viagens, boletins de medição (BMs) e pagamentos de forma transparente e desburocratizada."
      : "Você foi convidado(a) para participar da <strong>Fase Oficial de Homologação</strong> do Sistema de Gestão Financeira &amp; Projetos da NNÓS.";

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
        <!-- Header -->
        <div style="background-color: #0f2a4a; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">NNÓS CONSULTORIA E TREINAMENTO</h2>
          <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">${ehConsultor ? "Portal do Consultor · Homologação 2026" : "Sistema de Gestão Financeira &amp; Projetos · Exercício 2026"}</p>
        </div>

        <!-- Conteúdo Principal -->
        <div style="padding: 28px 24px;">
          <h3 style="color: #0f2a4a; font-size: 18px; margin-top: 0;">Olá, ${usuarioNome || "Colaborador(a)"}!</h3>
          
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            ${introTexto}
          </p>

          ${escopoValidacao}

          <!-- Card de Credenciais -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
            <h4 style="margin: 0 0 12px; font-size: 13px; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px;">Seus Dados de Acesso</h4>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #64748b; width: 140px;">Perfil Vinculado:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${perfilNome || (ehConsultor ? "Consultor" : "Usuário")}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Login / E-mail:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${usuarioEmail}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Usuário de Acesso:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${usuarioLogin || usuarioEmail}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Senha Inicial:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">nnos2026</td>
              </tr>
            </table>
          </div>

          <!-- Botão de Acesso -->
          <div style="text-align: center; margin: 28px 0;">
            <a href="${urlLogin}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3);">
              ${ehConsultor ? "Acessar Portal do Consultor NNÓS" : "Acessar Sistema de Gestão NNÓS"}
            </a>
          </div>

          <!-- Orientações -->
          <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; font-size: 12.5px; color: #64748b; line-height: 1.5;">
            <p style="margin: 0 0 6px;"><strong>Canal de Dúvidas e Apontamentos:</strong> ${canalTeams}</p>
            <p style="margin: 0;">Se você não reconhece esta mensagem, favor desconsiderar ou contatar a Coordenação Central da NNÓS.</p>
          </div>
        </div>

        <!-- Rodapé -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8;">
          NNÓS Consultoria e Treinamento Ltda · CNPJ 36.443.716/0001-00
        </div>
      </div>
    `;

    const resultado = await dispararEmail({
      para: usuarioEmail,
      assunto: ehConsultor
        ? "Convite Oficial · Homologação do Portal do Consultor NNÓS 2026"
        : "Convite Oficial · Homologação do Sistema de Gestão Financeira NNÓS 2026",
      html,
      texto: `Olá ${usuarioNome}, você foi convidado(a) para a homologação do ${ehConsultor ? "Portal do Consultor" : "Sistema de Gestão Financeira"} NNÓS. Acesse: ${urlLogin}`,
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

