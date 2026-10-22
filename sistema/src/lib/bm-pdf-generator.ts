import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface AtividadeBmPdf {
  projeto: string;
  atividade: string;
  periodo?: string;
  horas: number;
  valorHora: number;
  valorTotal: number;
}

export interface BmPdfDados {
  codigoBm: string;
  consultorNome: string;
  consultorRazaoSocial?: string;
  consultorCnpj?: string;
  consultorEndereco?: string;
  consultorEmail: string;
  contrato?: string;
  mesReferencia: string;
  periodoStr: string;
  totalHoras: number;
  mediaHora: number;
  valorTotal: number;
  liderNome: string;
  responsavelNome: string;
  atividades: AtividadeBmPdf[];
}

export async function gerarPdfOficialBm(dados: BmPdfDados): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // A4: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Paleta de cores corporativa NNÓS
  const cDark = rgb(0.06, 0.16, 0.29);     // #0f2a4a
  const cPrimary = rgb(0.01, 0.52, 0.78);  // #0284c7
  const cText = rgb(0.2, 0.25, 0.33);      // #334155
  const cMuted = rgb(0.39, 0.45, 0.55);    // #64748b
  const cBorder = rgb(0.88, 0.91, 0.94);   // #e2e8f0
  const cBgLight = rgb(0.97, 0.98, 0.99);  // #f8fafc
  const cSuccess = rgb(0.02, 0.47, 0.34);  // #047857

  let y = height - 35;
  const marginX = 35;
  const contentWidth = width - marginX * 2;

  // 1. CABEÇALHO CORPORATIVO
  page.drawRectangle({
    x: marginX,
    y: y - 55,
    width: contentWidth,
    height: 55,
    color: cBgLight,
    borderColor: cBorder,
    borderWidth: 1,
  });

  // Título e dados da empresa
  page.drawText("NNÓS CONSULTORIA E TREINAMENTO LTDA", {
    x: marginX + 12,
    y: y - 18,
    size: 11,
    font: fontBold,
    color: cDark,
  });
  page.drawText("CNPJ: 36.443.716/0001-00  •  Belo Horizonte - MG", {
    x: marginX + 12,
    y: y - 32,
    size: 8,
    font: fontRegular,
    color: cMuted,
  });
  page.drawText("Portal de Gestão Financeira e Medição Operacional de Projetos", {
    x: marginX + 12,
    y: y - 44,
    size: 7.5,
    font: fontRegular,
    color: cMuted,
  });

  // Caixa destacada com o número do BM à direita
  page.drawRectangle({
    x: marginX + contentWidth - 145,
    y: y - 48,
    width: 135,
    height: 40,
    color: rgb(0.93, 0.97, 1.0),
    borderColor: cPrimary,
    borderWidth: 1,
  });
  page.drawText("BOLETIM DE MEDIÇÃO", {
    x: marginX + contentWidth - 138,
    y: y - 22,
    size: 8,
    font: fontBold,
    color: cPrimary,
  });
  page.drawText(`BM Nº ${dados.codigoBm}`, {
    x: marginX + contentWidth - 138,
    y: y - 38,
    size: 14,
    font: fontBold,
    color: cDark,
  });

  y -= 68;

  // 2. DADOS DO PRESTADOR E CONTRATO
  page.drawRectangle({
    x: marginX,
    y: y - 60,
    width: contentWidth,
    height: 60,
    color: rgb(1, 1, 1),
    borderColor: cBorder,
    borderWidth: 1,
  });

  page.drawText("DADOS DO PRESTADOR DE SERVIÇOS", {
    x: marginX + 10,
    y: y - 14,
    size: 8,
    font: fontBold,
    color: cPrimary,
  });

  const col1X = marginX + 10;
  const col2X = marginX + 260;

  const razaoSocial = dados.consultorRazaoSocial || dados.consultorNome;
  const cnpj = dados.consultorCnpj || "Não informado";
  const contrato = (dados.contrato || "Contrato de Prestação de Serviços").replace(/•\s*NNÓS/g, "").trim();

  page.drawText(`Prestador: ${dados.consultorNome}`, { x: col1X, y: y - 28, size: 8.5, font: fontBold, color: cDark });
  page.drawText(`Razão Social: ${razaoSocial}`, { x: col1X, y: y - 40, size: 7.5, font: fontRegular, color: cText });
  page.drawText(`CNPJ / CPF: ${cnpj}`, { x: col1X, y: y - 52, size: 7.5, font: fontRegular, color: cText });

  page.drawText(`Período: ${dados.periodoStr}`, { x: col2X, y: y - 28, size: 8.5, font: fontBold, color: cDark });
  page.drawText(`Vínculo Contratual: ${contrato}`, { x: col2X, y: y - 40, size: 7.5, font: fontRegular, color: cText });
  page.drawText(`E-mail: ${dados.consultorEmail}`, { x: col2X, y: y - 52, size: 7.5, font: fontRegular, color: cText });

  y -= 72;

  // 3. CARDS DE RESUMO FINANCEIRO
  const cardW = (contentWidth - 16) / 3;
  const cardH = 42;

  // Card 1: Total de Horas
  page.drawRectangle({ x: marginX, y: y - cardH, width: cardW, height: cardH, color: cBgLight, borderColor: cBorder, borderWidth: 1 });
  page.drawText("TOTAL DE HORAS", { x: marginX + 10, y: y - 14, size: 7, font: fontBold, color: cMuted });
  page.drawText(`${dados.totalHoras}h`, { x: marginX + 10, y: y - 32, size: 13, font: fontBold, color: cDark });

  // Card 2: Valor Hora Médio
  const c2X = marginX + cardW + 8;
  page.drawRectangle({ x: c2X, y: y - cardH, width: cardW, height: cardH, color: cBgLight, borderColor: cBorder, borderWidth: 1 });
  page.drawText("VALOR MÉDIO DA HORA", { x: c2X + 10, y: y - 14, size: 7, font: fontBold, color: cMuted });
  page.drawText(`R$ ${dados.mediaHora.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { x: c2X + 10, y: y - 32, size: 13, font: fontBold, color: cDark });

  // Card 3: Valor Total Líquido
  const c3X = marginX + (cardW + 8) * 2;
  page.drawRectangle({ x: c3X, y: y - cardH, width: cardW, height: cardH, color: rgb(0.92, 0.98, 0.95), borderColor: cSuccess, borderWidth: 1.5 });
  page.drawText("TOTAL A FATURAR", { x: c3X + 10, y: y - 14, size: 7, font: fontBold, color: cSuccess });
  page.drawText(`R$ ${dados.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { x: c3X + 10, y: y - 32, size: 13, font: fontBold, color: cSuccess });

  y -= (cardH + 14);

  // 4. DISCRIMINAÇÃO DAS ATIVIDADES APURADAS (TABELA DINÂMICA)
  page.drawText("DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS", {
    x: marginX,
    y: y,
    size: 8.5,
    font: fontBold,
    color: cDark,
  });

  y -= 10;

  // Cabeçalho da Tabela
  const tableHeaderH = 18;
  page.drawRectangle({
    x: marginX,
    y: y - tableHeaderH,
    width: contentWidth,
    height: tableHeaderH,
    color: cDark,
  });

  const pColProjeto = marginX + 8;
  const pColAtividade = marginX + 130;
  const pColHoras = marginX + 340;
  const pColVlHora = marginX + 400;
  const pColTotal = marginX + 465;

  page.drawText("PROJETO", { x: pColProjeto, y: y - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("ATIVIDADE / DESCRIÇÃO", { x: pColAtividade, y: y - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("HORAS", { x: pColHoras, y: y - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("VL HORA", { x: pColVlHora, y: y - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("SUBTOTAL", { x: pColTotal, y: y - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });

  y -= tableHeaderH;

  // Linhas de atividades apuradas
  const rowH = 18;
  dados.atividades.forEach((ativ, idx) => {
    const isEven = idx % 2 === 0;
    page.drawRectangle({
      x: marginX,
      y: y - rowH,
      width: contentWidth,
      height: rowH,
      color: isEven ? rgb(1, 1, 1) : cBgLight,
      borderColor: cBorder,
      borderWidth: 0.5,
    });

    const nomeProj = ativ.projeto.length > 22 ? ativ.projeto.substring(0, 22) + "..." : ativ.projeto;
    const descAtiv = ativ.atividade.length > 36 ? ativ.atividade.substring(0, 36) + "..." : ativ.atividade;

    page.drawText(nomeProj, { x: pColProjeto, y: y - 12, size: 7.5, font: fontBold, color: cText });
    page.drawText(descAtiv, { x: pColAtividade, y: y - 12, size: 7.5, font: fontRegular, color: cText });
    page.drawText(`${ativ.horas}h`, { x: pColHoras, y: y - 12, size: 7.5, font: fontRegular, color: cText });
    page.drawText(`R$ ${ativ.valorHora.toFixed(2)}`, { x: pColVlHora, y: y - 12, size: 7.5, font: fontRegular, color: cText });
    page.drawText(`R$ ${ativ.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, { x: pColTotal, y: y - 12, size: 7.5, font: fontBold, color: cDark });

    y -= rowH;
  });

  // Linha de Total Geral da Tabela
  page.drawRectangle({
    x: marginX,
    y: y - 20,
    width: contentWidth,
    height: 20,
    color: rgb(0.95, 0.96, 0.98),
    borderColor: cBorder,
    borderWidth: 1,
  });
  page.drawText("VALOR TOTAL APURADO:", { x: pColProjeto, y: y - 14, size: 8, font: fontBold, color: cDark });
  page.drawText(`${dados.totalHoras}h`, { x: pColHoras, y: y - 14, size: 8, font: fontBold, color: cDark });
  page.drawText(`R$ ${dados.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, {
    x: pColTotal - 10,
    y: y - 14,
    size: 8.5,
    font: fontBold,
    color: cSuccess,
  });

  y -= 30;

  // 5. REGRAS DE FATURAMENTO E PRAZOS
  page.drawRectangle({
    x: marginX,
    y: y - 36,
    width: contentWidth,
    height: 36,
    color: rgb(0.99, 0.99, 0.97),
    borderColor: rgb(0.93, 0.88, 0.70),
    borderWidth: 1,
  });
  page.drawText("INSTRUÇÕES DE FATURAMENTO E CRÉDITO", { x: marginX + 10, y: y - 12, size: 7.5, font: fontBold, color: rgb(0.7, 0.45, 0.05) });
  page.drawText("1. A emissão da Nota Fiscal de Prestação de Serviços deve ser realizada após a conclusão das assinaturas deste BM.", { x: marginX + 10, y: y - 22, size: 7, font: fontRegular, color: cText });
  page.drawText("2. Enviar o arquivo XML e PDF da NF para: financeiro@nnos.com.br respeitando a data limite do cronograma.", { x: marginX + 10, y: y - 31, size: 7, font: fontRegular, color: cText });

  y -= 46;

  // 6. DECLARAÇÃO DE ACEITE E ASSINATURAS ELETRÔNICAS (COM TEXT TAGS ZOHO SIGN)
  page.drawRectangle({
    x: marginX,
    y: y - 108,
    width: contentWidth,
    height: 108,
    color: rgb(1, 1, 1),
    borderColor: cBorder,
    borderWidth: 1,
  });

  page.drawText("DECLARAÇÃO DE CONCORDÂNCIA E ASSINATURA ELETRÔNICA", {
    x: marginX + 10,
    y: y - 13,
    size: 7.5,
    font: fontBold,
    color: cDark,
  });
  page.drawText('"Declaro concordar integralmente com os valores, horas e quantidades apuradas nesta medição de serviços."', {
    x: marginX + 10,
    y: y - 24,
    size: 7,
    font: fontOblique,
    color: cMuted,
  });

  const boxW = (contentWidth - 28) / 2;
  const boxH = 68;

  // Caixa 1: Assinatura do Prestador (Recipient 1)
  const b1X = marginX + 10;
  page.drawRectangle({ x: b1X, y: y - 98, width: boxW, height: boxH, color: cBgLight, borderColor: cBorder, borderWidth: 1 });
  page.drawText("ASSINATURA DO PRESTADOR", { x: b1X + 8, y: y - 40, size: 7, font: fontBold, color: cPrimary });
  
  // TEXT TAG ZOHO SIGN PARA O PRESTADOR (Posicionamento dinâmico automático)
  page.drawText("{{Signature:Recipient1*}}", { x: b1X + 15, y: y - 62, size: 10, font: fontBold, color: cPrimary });
  page.drawText("{{Signdate:Recipient1*}}", { x: b1X + 140, y: y - 62, size: 8, font: fontRegular, color: cMuted });
  
  page.drawLine({ start: { x: b1X + 8, y: y - 72 }, end: { x: b1X + boxW - 8, y: y - 72 }, color: cBorder, thickness: 1 });
  page.drawText(dados.consultorNome, { x: b1X + 8, y: y - 82, size: 7.5, font: fontBold, color: cDark });
  page.drawText(`Prestador de Serviços • CNPJ/CPF: ${cnpj}`, { x: b1X + 8, y: y - 92, size: 6.5, font: fontRegular, color: cMuted });

  // Caixa 2: Validação da Coordenação / NNÓS (Recipient 2)
  const b2X = marginX + 18 + boxW;
  page.drawRectangle({ x: b2X, y: y - 98, width: boxW, height: boxH, color: cBgLight, borderColor: cBorder, borderWidth: 1 });
  page.drawText("VALIDAÇÃO DA COORDENAÇÃO", { x: b2X + 8, y: y - 40, size: 7, font: fontBold, color: cPrimary });

  // TEXT TAG ZOHO SIGN PARA A COORDENAÇÃO (Posicionamento dinâmico automático)
  page.drawText("{{Signature:Recipient2*}}", { x: b2X + 15, y: y - 62, size: 10, font: fontBold, color: cPrimary });
  page.drawText("{{Signdate:Recipient2*}}", { x: b2X + 140, y: y - 62, size: 8, font: fontRegular, color: cMuted });

  page.drawLine({ start: { x: b2X + 8, y: y - 72 }, end: { x: b2X + boxW - 8, y: y - 72 }, color: cBorder, thickness: 1 });
  page.drawText(dados.responsavelNome || "LEONARDO CAMPOS", { x: b2X + 8, y: y - 82, size: 7.5, font: fontBold, color: cDark });
  page.drawText("Coordenação Operacional & Projetos • NNÓS Consultoria", { x: b2X + 8, y: y - 92, size: 6.5, font: fontRegular, color: cMuted });

  // 7. RODAPÉ INSTITUCIONAL
  page.drawLine({ start: { x: marginX, y: 35 }, end: { x: width - marginX, y: 35 }, color: cDark, thickness: 1.5 });
  page.drawText("NNÓS CONSULTORIA E TREINAMENTO LTDA  •  CNPJ: 36.443.716/0001-00", { x: marginX, y: 22, size: 7, font: fontBold, color: cDark });
  page.drawText(`Autenticador: BM ${dados.codigoBm} • Documento gerado com validade jurídica via Zoho Sign`, {
    x: marginX + contentWidth - 235,
    y: 22,
    size: 6.8,
    font: fontRegular,
    color: cPrimary,
  });

  return await pdfDoc.save();
}
