// Módulo Oficial de Integração com o Zoho Sign para Envio e Coleta de Assinaturas de BM

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Obtém um Access Token válido utilizando o Refresh Token permanente
 */
export async function getZohoAccessToken(): Promise<string> {
  const now = Date.now();
  // Se o token em cache ainda for válido por mais de 5 minutos, reutiliza
  if (cachedAccessToken && tokenExpiresAt > now + 300000) {
    return cachedAccessToken;
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Credenciais do Zoho Sign (CLIENT_ID, CLIENT_SECRET ou REFRESH_TOKEN) não configuradas no ambiente.");
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(`https://accounts.zoho.com/oauth/v2/token?${params.toString()}`, {
    method: "POST",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao obter Access Token do Zoho: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Erro retornado pelo Zoho OAuth: ${data.error}`);
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;

  return cachedAccessToken!;
}

export interface SignatarioEnvio {
  nome: string;
  email: string;
  papel: "Prestador de Serviços" | "Líder de Projeto" | "Coordenação / Validação Final";
  ordem: number;
}

export interface EnviarBmZohoParams {
  codigoBm: string;
  consultorNome: string;
  consultorEmail: string;
  liderNome: string;
  liderEmail: string;
  responsavelNome: string;
  responsavelEmail: string;
  emailsCopia?: string;
  periodoStr: string;
  valorTotal: number;
  pdfBuffer?: Buffer;
}

function gerarPdfBasicoBm(params: EnviarBmZohoParams): Buffer {
  const content =
    `BT /F1 16 Tf 50 730 Td (BOLETIM DE MEDICAO - NNOS CONSULTORIA) Tj ET ` +
    `BT /F1 12 Tf 50 690 Td (BM: ${params.codigoBm} - Periodo: ${params.periodoStr}) Tj ET ` +
    `BT /F1 12 Tf 50 660 Td (Prestador / Consultor: ${params.consultorNome}) Tj ET ` +
    `BT /F1 12 Tf 50 630 Td (Valor Total Apurado: R$ ${params.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) Tj ET ` +
    `BT /F1 10 Tf 50 590 Td (Signatarios vinculados:) Tj ET ` +
    `BT /F1 9 Tf 60 565 Td (1. Prestador de Servicos: ${params.consultorNome} <${params.consultorEmail}>) Tj ET ` +
    `BT /F1 9 Tf 60 545 Td (2. Lider de Projeto: ${params.liderNome} <${params.liderEmail}>) Tj ET ` +
    `BT /F1 9 Tf 60 525 Td (3. Validacao Final NNOS: ${params.responsavelNome} <${params.responsavelEmail}>) Tj ET ` +
    `BT /F1 8 Tf 50 480 Td (Documento oficial gerado pelo Portal Corporativo NNOS Consultoria.) Tj ET`;

  const len = Buffer.byteLength(content, "utf-8");
  const pdfString =
    "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n" +
    "4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
    "5 0 obj<</Length " + len + ">>stream\n" + content + "\nendstream\nendobj\n" +
    "xref\n0 6\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\n0000000213 00000 n\n0000000282 00000 n\n" +
    "trailer<</Size 6/Root 1 0 R>>\nstartxref\n" + (330 + len) + "\n%%EOF";

  return Buffer.from(pdfString);
}

/**
 * Cria a solicitação oficial de assinatura no Zoho Sign com os 3 signatários
 */
export async function enviarBmParaZohoSign(params: EnviarBmZohoParams) {
  const accessToken = await getZohoAccessToken();
  const apiUrl = process.env.ZOHO_API_URL || "https://sign.zoho.com/api/v1";

  // Montar signatários sequenciais (sem campo 'role' que é rejeitado pela API Zoho)
  const actions: any[] = [
    {
      recipient_name: params.consultorNome,
      recipient_email: params.consultorEmail,
      action_type: "SIGN",
      signing_order: 1,
      verify_recipient: false,
    },
    {
      recipient_name: params.liderNome,
      recipient_email: params.liderEmail,
      action_type: "SIGN",
      signing_order: 2,
      verify_recipient: false,
    },
    {
      recipient_name: params.responsavelNome,
      recipient_email: params.responsavelEmail,
      action_type: "SIGN",
      signing_order: 3,
      verify_recipient: false,
    },
  ];

  // Adicionar destinatários de cópia (visualizadores)
  if (params.emailsCopia) {
    const copias = params.emailsCopia.split(";").map((e) => e.trim()).filter(Boolean);
    copias.forEach((email) => {
      actions.push({
        recipient_name: "Cópia Financeiro",
        recipient_email: email,
        action_type: "VIEW",
        signing_order: 4,
      });
    });
  }

  const requestName = `BM ${params.codigoBm} - ${params.consultorNome} (${params.periodoStr})`;
  const notes = `Prezado(a),\n\nSegue para assinatura eletrônica o Boletim de Medição de Serviços (BM ${params.codigoBm}) referente ao período de ${params.periodoStr}.\nValor apurado: R$ ${params.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.\n\nPor favor, revise os dados e confirme a sua assinatura.\n\nAtenciosamente,\nNNÓS Consultoria e Treinamento`;

  const requestPayload = {
    requests: {
      request_name: requestName,
      is_sequential: true,
      expiration_days: 7,
      email_reminders: true,
      reminder_period: 2,
      notes: notes,
      actions: actions,
    },
  };

  // Garante buffer do PDF físico
  const pdfBuffer = params.pdfBuffer || gerarPdfBasicoBm(params);
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
  formData.append("file", blob, `BM_${params.codigoBm}.pdf`);
  formData.append("data", JSON.stringify(requestPayload));

  const res = await fetch(`${apiUrl}/requests`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Erro na API do Zoho Sign ao criar documento:", res.status, errText);
    throw new Error(`Falha no Zoho Sign: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const reqObj = data.requests || data;
  const requestId = reqObj.request_id;
  const documentId = (reqObj.document_ids && reqObj.document_ids[0]?.document_id) || reqObj.zsdocumentid || reqObj.document_id;

  let submitSucesso = false;
  let avisoCreditos = false;
  let submitMsg = "";

  // Passo 2: Disparo dos e-mails
  // Se houver Zoho Flow configurado (Zoho One), usa o Flow para disparar nativamente sem consumir créditos de API externa
  const flowUrl = process.env.ZOHO_FLOW_WEBHOOK_URL;
  if (requestId && flowUrl) {
    try {
      console.log(`🌊 [Zoho Flow] Disparando e-mail de assinatura para request ${requestId} via Zoho Flow...`);
      const flowRes = await fetch(flowUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          email_address: params.consultorEmail,
          consultor_email: params.consultorEmail,
          codigo_bm: params.codigoBm,
          consultor_nome: params.consultorNome,
          lider_email: params.liderEmail,
          lider_nome: params.liderNome,
          responsavel_email: params.responsavelEmail,
          responsavel_nome: params.responsavelNome,
          periodo: params.periodoStr,
          valor_total: params.valorTotal,
        }),
      });

      if (flowRes.ok) {
        submitSucesso = true;
        avisoCreditos = false;
        submitMsg = "E-mail de assinatura enviado aos signatários via Zoho Flow (Zoho One)!";
        console.log("✅ [Zoho Flow] Disparo realizado com sucesso pelo Zoho Flow!");
      } else {
        console.warn("Aviso ao disparar pelo Zoho Flow:", flowRes.status, await flowRes.text());
      }
    } catch (e: any) {
      console.warn("Falha ao conectar com Zoho Flow:", e.message);
    }
  }

  // Fallback: Tentativa via endpoint direto do Zoho Sign caso Flow não tenha disparado
  if (requestId && !submitSucesso) {
    try {
      const submitRes = await fetch(`${apiUrl}/requests/${requestId}/submit`, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "",
      });

      if (submitRes.ok) {
        submitSucesso = true;
        submitMsg = "E-mails de assinatura enviados aos signatários via Zoho Sign!";
      } else {
        const submitErrText = await submitRes.text();
        console.warn("Aviso no submit do Zoho Sign:", submitRes.status, submitErrText);
        if (submitErrText.includes("12000") || submitErrText.includes("créditos") || submitErrText.includes("creditos")) {
          avisoCreditos = true;
          submitMsg = "Documento registrado no Zoho Sign. Para envio automático de e-mails via API externa, a conta Zoho requer créditos de API.";
        } else {
          submitMsg = `Zoho Sign: Documento criado (${submitRes.status}).`;
        }
      }
    } catch (e: any) {
      console.warn("Erro ao submeter request no Zoho Sign:", e.message);
    }
  }

  return {
    success: true,
    requestId: requestId,
    documentId: documentId,
    status: submitSucesso ? "sent" : "draft",
    avisoCreditos,
    message: submitMsg || "Solicitação criada com sucesso no Zoho Sign!",
  };
}

/**
 * Consulta o status e a trilha de auditoria de um documento assinado no Zoho Sign
 */
export async function obterDetalhesDocumentoZoho(requestId: string) {
  const accessToken = await getZohoAccessToken();
  const apiUrl = process.env.ZOHO_API_URL || "https://sign.zoho.com/api/v1";

  const res = await fetch(`${apiUrl}/requests/${requestId}`, {
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao obter documento do Zoho Sign: ${res.status} - ${errText}`);
  }

  return await res.json();
}
