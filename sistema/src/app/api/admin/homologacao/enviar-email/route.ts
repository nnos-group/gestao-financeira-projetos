import { NextRequest, NextResponse } from "next/server";
import { dispararEmail } from "@/lib/email-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { usuarioNome, usuarioEmail, usuarioLogin, perfilNome } = body;

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

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
        <!-- Header -->
        <div style="background-color: #0f2a4a; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">NNÓS CONSULTORIA E TREINAMENTO</h2>
          <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">Sistema de Gestão Financeira &amp; Projetos · Exercício 2026</p>
        </div>

        <!-- Conteúdo Principal -->
        <div style="padding: 28px 24px;">
          <h3 style="color: #0f2a4a; font-size: 18px; margin-top: 0;">Olá, ${usuarioNome || "Colaborador(a)"}!</h3>
          
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Você foi convidado(a) para participar da <strong>Fase Oficial de Homologação</strong> do Sistema de Gestão Financeira &amp; Projetos da NNÓS.
          </p>

          <!-- Card de Credenciais -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
            <h4 style="margin: 0 0 12px; font-size: 13px; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px;">Seus Dados de Acesso</h4>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #64748b; width: 140px;">Perfil Vinculado:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${perfilNome || "Usuário"}</td>
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
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">Definida individualmente no 1º acesso</td>
              </tr>
            </table>
          </div>

          <!-- Botão de Acesso -->
          <div style="text-align: center; margin: 28px 0;">
            <a href="${urlLogin}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3);">
              Acessar Sistema de Gestão NNÓS
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
      assunto: "Convite Oficial · Homologação do Sistema de Gestão Financeira NNÓS 2026",
      html,
      texto: `Olá ${usuarioNome}, você foi convidado(a) para a homologação do Sistema de Gestão Financeira NNÓS. Acesse: ${urlLogin}`,
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

