import nodemailer from "nodemailer";

export interface EmailAttachment {
  filename: string;
  content?: string | Buffer; // Base64 ou buffer
  path?: string;
  contentType?: string;
}

export interface EnviarEmailOptions {
  para: string;
  de?: string;
  cc?: string[];
  assunto: string;
  html: string;
  texto?: string;
  anexos?: EmailAttachment[];
}

export interface EnviarEmailResultado {
  sucesso: boolean;
  modo: "resend" | "smtp" | "simulado";
  mensagemId?: string;
  mensagem: string;
  destinatario: string;
}

/**
 * Serviço flexível para envio de e-mails:
 * 1. Prioriza Resend se RESEND_API_KEY estiver configurado
 * 2. Usa Nodemailer se SMTP_HOST e SMTP_USER/PASS estiverem configurados
 * 3. Se nenhum provedor estiver preenchido, opera em modo Simulado com logs informativos
 */
export async function dispararEmail(options: EnviarEmailOptions): Promise<EnviarEmailResultado> {
  const dePadrao = process.env.EMAIL_FROM || process.env.SMTP_FROM || "logistica@nnos.com.br";
  const de = options.de || dePadrao;

  // 1. Tentar via Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const attachmentsPayload = (options.anexos || []).map((anx) => {
        let contentBase64 = "";
        if (typeof anx.content === "string") {
          // Se for data URL, extrai apenas o base64
          if (anx.content.startsWith("data:")) {
            contentBase64 = anx.content.split(",")[1];
          } else {
            contentBase64 = anx.content;
          }
        } else if (Buffer.isBuffer(anx.content)) {
          contentBase64 = anx.content.toString("base64");
        }

        return {
          filename: anx.filename,
          content: contentBase64,
        };
      });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: de,
          to: [options.para],
          cc: options.cc,
          subject: options.assunto,
          html: options.html,
          text: options.texto,
          attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Erro retornado pela API do Resend");
      }

      return {
        sucesso: true,
        modo: "resend",
        mensagemId: json.id,
        mensagem: "E-mail enviado com sucesso via Resend!",
        destinatario: options.para,
      };
    } catch (err: any) {
      console.error("Falha ao enviar via Resend:", err);
      // Cai para próxima tentativa (SMTP)
    }
  }

  // 2. Tentar via SMTP (ex: Office 365, Google Workspace, AWS SES)
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = Number(process.env.SMTP_PORT || 587);

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const attachmentsPayload = (options.anexos || []).map((anx) => {
        if (typeof anx.content === "string" && anx.content.startsWith("data:")) {
          const [prefix, base64] = anx.content.split(",");
          const mime = prefix.split(":")[1]?.split(";")[0] || "application/octet-stream";
          return {
            filename: anx.filename,
            content: Buffer.from(base64, "base64"),
            contentType: mime,
          };
        }
        return {
          filename: anx.filename,
          content: anx.content,
          path: anx.path,
          contentType: anx.contentType,
        };
      });

      const info = await transporter.sendMail({
        from: `"${options.de ? "NNÓS Logística" : "Gestão Financeira NNÓS"}" <${smtpUser}>`,
        to: options.para,
        cc: options.cc,
        subject: options.assunto,
        html: options.html,
        text: options.texto,
        attachments: attachmentsPayload,
      });

      return {
        sucesso: true,
        modo: "smtp",
        mensagemId: info.messageId,
        mensagem: "E-mail enviado com sucesso via SMTP!",
        destinatario: options.para,
      };
    } catch (err: any) {
      console.error("Falha ao enviar via SMTP:", err);
      return {
        sucesso: false,
        modo: "smtp",
        mensagem: `Erro ao enviar e-mail via servidor SMTP (${smtpHost}): ${err.message}`,
        destinatario: options.para,
      };
    }
  }

  // 3. Provedor não configurado no .env.local -> Modo Simulação Transparente
  return {
    sucesso: true,
    modo: "simulado",
    mensagem:
      "Simulação executada com sucesso. Para entrega real na caixa postal, configure RESEND_API_KEY ou SMTP_HOST/SMTP_USER no arquivo .env.local.",
    destinatario: options.para,
  };
}
