import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

export interface AtividadeBmPdf {
  projeto: string;
  atividade: string;
  periodo?: string;
  horas: number;
  valorHora: number;
  valorTotal: number;
  rateioInterno?: string;
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

  // Dimensões A4 oficial: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Paleta Corporativa NNÓS (fiel ao BmExportPdfSheet.tsx)
  const cDark = rgb(0.06, 0.09, 0.16);       // #0f172a (Navy escuro)
  const cNavyHeader = rgb(0.06, 0.16, 0.29); // #0f2a4a (Cabeçalho da tabela)
  const cPrimary = rgb(0.01, 0.52, 0.78);    // #0284c7 (Azul NNÓS)
  const cText = rgb(0.2, 0.25, 0.33);        // #334155 (Texto padrão)
  const cMuted = rgb(0.39, 0.45, 0.55);      // #64748b (Texto secundário)
  const cBorder = rgb(0.88, 0.91, 0.94);     // #e2e8f0 (Bordas)
  const cBgLight = rgb(0.97, 0.98, 0.99);    // #f8fafc (Fundo de cards)
  const cSuccess = rgb(0.02, 0.59, 0.41);    // #059669 (Verde aprovação)
  const cWhite = rgb(1, 1, 1);

  // Carregar Logotipo Oficial Coruja NNÓS
  let logoImage: any = null;
  try {
    const possiblePaths = [
      path.join(process.cwd(), "public/logo-coruja.png"),
      path.join(process.cwd(), "sistema/public/logo-coruja.png"),
      path.resolve(__dirname, "../../public/logo-coruja.png"),
    ];
    const foundPath = possiblePaths.find((p) => fs.existsSync(p));
    if (foundPath) {
      const logoBytes = fs.readFileSync(foundPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
    }
  } catch (err) {
    console.warn("Aviso ao carregar logo-coruja.png no PDF:", err);
  }

  const marginX = 24;
  const contentWidth = width - marginX * 2; // 547.28
  let y = height - 26;

  const contratoLimpo = (dados.contrato || "SÓCIO").replace(/•\s*NNÓS/g, "").trim();
  const dataHoje = new Date();
  const dataEmissao = `${String(dataHoje.getDate()).padStart(2, "0")}/${String(dataHoje.getMonth() + 1).padStart(2, "0")}/${dataHoje.getFullYear()}`;
  const razaoSocial = dados.consultorRazaoSocial || dados.consultorNome;
  const cnpj = dados.consultorCnpj || "Não informado";
  const endereco = dados.consultorEndereco || `E-mail: ${dados.consultorEmail}`;

  // ==========================================
  // 1. CABEÇALHO DO DOCUMENTO (DocumentHeader)
  // ==========================================
  const logoSize = 30;
  if (logoImage) {
    page.drawImage(logoImage, {
      x: marginX,
      y: y - logoSize,
      width: logoSize,
      height: logoSize,
    });
  }

  const titleX = logoImage ? marginX + logoSize + 8 : marginX;
  page.drawText("Boletim de Medição de Serviços", {
    x: titleX,
    y: y - 18,
    size: 15,
    font: fontBold,
    color: cDark,
  });

  // Lado direito do cabeçalho
  const infoHeaderTop = `BM ${dados.codigoBm} - Contrato ${contratoLimpo}`;
  const infoHeaderTopWidth = fontBold.widthOfTextAtSize(infoHeaderTop, 10);
  page.drawText(infoHeaderTop, {
    x: marginX + contentWidth - infoHeaderTopWidth,
    y: y - 14,
    size: 10,
    font: fontBold,
    color: cDark,
  });

  const infoHeaderSub = `Emissão: ${dataEmissao}`;
  const infoHeaderSubWidth = fontRegular.widthOfTextAtSize(infoHeaderSub, 8);
  page.drawText(infoHeaderSub, {
    x: marginX + contentWidth - infoHeaderSubWidth,
    y: y - 25,
    size: 8,
    font: fontRegular,
    color: cMuted,
  });

  y -= (logoSize + 8);

  // Linha divisória oficial escura
  page.drawLine({
    start: { x: marginX, y: y },
    end: { x: marginX + contentWidth, y: y },
    color: cDark,
    thickness: 1.5,
  });

  y -= 8;

  // ==========================================
  // 2. GRID DE 4 CARDS DE INDICADORES
  // ==========================================
  const cardGap = 8;
  const cardW = (contentWidth - cardGap * 3) / 4; // ~130.8
  const cardH = 46;

  // Função auxiliar para desenhar cards métricos
  const desenharCard = (x: number, titulo: string, valorPrincipal: string, detalhe: string, destaqueCor?: any) => {
    page.drawRectangle({
      x,
      y: y - cardH,
      width: cardW,
      height: cardH,
      color: cWhite,
      borderColor: cBorder,
      borderWidth: 1,
    });

    page.drawText(titulo.toUpperCase(), {
      x: x + 8,
      y: y - 12,
      size: 6.8,
      font: fontBold,
      color: cMuted,
    });

    page.drawText(valorPrincipal, {
      x: x + 8,
      y: y - 27,
      size: 12.5,
      font: fontBold,
      color: destaqueCor || cDark,
    });

    page.drawText(detalhe, {
      x: x + 8,
      y: y - 39,
      size: 7,
      font: fontBold,
      color: destaqueCor || cMuted,
    });
  };

  // Card 1: Valor Líquido Total
  desenharCard(
    marginX,
    "Valor Líquido Total",
    `R$ ${dados.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    "Aprovado Operacional",
    cSuccess
  );

  // Card 2: Carga Horária
  desenharCard(
    marginX + (cardW + cardGap),
    "Carga Horária",
    `${dados.totalHoras.toFixed(1)} h`,
    `${dados.atividades.length} frentes - R$ ${dados.mediaHora.toFixed(2)}/h`
  );

  // Card 3: Mês de Referência
  desenharCard(
    marginX + (cardW + cardGap) * 2,
    "Mês de Referência",
    dados.mesReferencia,
    dados.periodoStr.includes("Quinzena") ? dados.periodoStr : "Período Integral"
  );

  // Card 4: Cronograma Previsto
  desenharCard(
    marginX + (cardW + cardGap) * 3,
    "Cronograma Previsto",
    "10 e 25",
    "NF ate dia 10 - Pagto dia 25"
  );

  y -= (cardH + 8);

  // ==========================================
  // 3. DADOS DAS PARTES (PRESTADOR E TOMADOR)
  // ==========================================
  const partyW = (contentWidth - cardGap) / 2; // ~269.6
  const partyH = 68;

  // Box Prestador
  const p1X = marginX;
  page.drawRectangle({
    x: p1X,
    y: y - partyH,
    width: partyW,
    height: partyH,
    color: cBgLight,
    borderColor: cBorder,
    borderWidth: 1,
  });

  page.drawRectangle({ x: p1X + 8, y: y - 18, width: 14, height: 14, color: cNavyHeader });
  page.drawText("PRESTADOR DE SERVIÇOS", { x: p1X + 28, y: y - 10, size: 6.5, font: fontBold, color: cMuted });
  page.drawText(dados.consultorNome, { x: p1X + 28, y: y - 18, size: 9, font: fontBold, color: cDark });

  page.drawLine({ start: { x: p1X + 8, y: y - 23 }, end: { x: p1X + partyW - 8, y: y - 23 }, color: cBorder, thickness: 0.5 });

  page.drawText(`Razão Social: ${razaoSocial}`, { x: p1X + 8, y: y - 33, size: 7, font: fontRegular, color: cText });
  page.drawText(`CNPJ / CPF: ${cnpj}`, { x: p1X + 8, y: y - 43, size: 7, font: fontRegular, color: cText });
  const endLimpo = endereco.length > 55 ? endereco.substring(0, 52) + "..." : endereco;
  page.drawText(`Endereço: ${endLimpo}`, { x: p1X + 8, y: y - 53, size: 6.8, font: fontRegular, color: cMuted });
  page.drawText(`E-mail: ${dados.consultorEmail} - Contrato: ${contratoLimpo}`, { x: p1X + 8, y: y - 63, size: 6.8, font: fontRegular, color: cMuted });

  // Box Tomador
  const p2X = marginX + partyW + cardGap;
  page.drawRectangle({
    x: p2X,
    y: y - partyH,
    width: partyW,
    height: partyH,
    color: cBgLight,
    borderColor: cBorder,
    borderWidth: 1,
  });

  page.drawRectangle({ x: p2X + 8, y: y - 18, width: 14, height: 14, color: cNavyHeader });
  page.drawText("TOMADOR DOS SERVIÇOS", { x: p2X + 28, y: y - 10, size: 6.5, font: fontBold, color: cMuted });
  page.drawText("NNÓS CONSULTORIA E TREINAMENTO LTDA", { x: p2X + 28, y: y - 18, size: 9, font: fontBold, color: cDark });

  page.drawLine({ start: { x: p2X + 8, y: y - 23 }, end: { x: p2X + partyW - 8, y: y - 23 }, color: cBorder, thickness: 0.5 });

  page.drawText("CNPJ da Empresa: 36.443.716/0001-00", { x: p2X + 8, y: y - 33, size: 7, font: fontRegular, color: cText });
  page.drawText("Inscrição Municipal: 1.208.841/002-5", { x: p2X + 8, y: y - 43, size: 7, font: fontRegular, color: cText });
  page.drawText("Sede: Rua Sergipe, nº 77 - Loja 1, Boa Viagem, Belo Horizonte - MG", { x: p2X + 8, y: y - 53, size: 6.8, font: fontRegular, color: cMuted });
  page.drawText("Financeiro: leonardo.campos@nnos.com.br", { x: p2X + 8, y: y - 63, size: 6.8, font: fontRegular, color: cMuted });

  y -= (partyH + 8);

  // ==========================================
  // 4. DETALHAMENTO OPERACIONAL DE HORAS (TABELA)
  // ==========================================
  const tHeaderH = 16;
  page.drawRectangle({
    x: marginX,
    y: y - tHeaderH,
    width: contentWidth,
    height: tHeaderH,
    color: cNavyHeader,
  });

  page.drawText(`DETALHAMENTO OPERACIONAL DE HORAS - Atividades Apuradas (${dados.mesReferencia})`, {
    x: marginX + 8,
    y: y - 11,
    size: 7.2,
    font: fontBold,
    color: cWhite,
  });

  const badgeLctos = `${dados.atividades.length} Lançamentos Registrados`;
  const badgeWidth = fontBold.widthOfTextAtSize(badgeLctos, 6.8);
  page.drawText(badgeLctos, {
    x: marginX + contentWidth - badgeWidth - 8,
    y: y - 11,
    size: 6.8,
    font: fontBold,
    color: rgb(0.8, 0.9, 1),
  });

  y -= tHeaderH;

  // Colunas da Tabela
  const cColProj = marginX + 6;
  const cColAtiv = marginX + 115;
  const cColPer = marginX + 285;
  const cColHoras = marginX + 375;
  const cColVlH = marginX + 425;
  const cColSub = marginX + 480;

  // Sub-cabeçalho da Tabela
  const subHeadH = 14;
  page.drawRectangle({
    x: marginX,
    y: y - subHeadH,
    width: contentWidth,
    height: subHeadH,
    color: cDark,
  });

  page.drawText("PROJETO", { x: cColProj, y: y - 10, size: 6.8, font: fontBold, color: cWhite });
  page.drawText("ATIVIDADE / ESCOPO", { x: cColAtiv, y: y - 10, size: 6.8, font: fontBold, color: cWhite });
  page.drawText("PERÍODO", { x: cColPer, y: y - 10, size: 6.8, font: fontBold, color: cWhite });
  page.drawText("CH (HORAS)", { x: cColHoras, y: y - 10, size: 6.8, font: fontBold, color: cWhite });
  page.drawText("VALOR / HORA", { x: cColVlH, y: y - 10, size: 6.8, font: fontBold, color: cWhite });
  page.drawText("VALOR TOTAL", { x: cColSub, y: y - 10, size: 6.8, font: fontBold, color: cWhite });

  y -= subHeadH;

  // Linhas das Atividades
  const rowH = 16;
  dados.atividades.forEach((at, idx) => {
    const isEven = idx % 2 === 0;
    page.drawRectangle({
      x: marginX,
      y: y - rowH,
      width: contentWidth,
      height: rowH,
      color: isEven ? cWhite : cBgLight,
      borderColor: cBorder,
      borderWidth: 0.5,
    });

    const projStr = at.projeto.length > 20 ? at.projeto.substring(0, 18) + "..." : at.projeto;
    const ativStr = at.atividade.length > 38 ? at.atividade.substring(0, 36) + "..." : at.atividade;
    const perStr = at.periodo || dados.periodoStr;

    page.drawText(projStr, { x: cColProj, y: y - 11, size: 7.2, font: fontBold, color: cDark });
    page.drawText(ativStr, { x: cColAtiv, y: y - 11, size: 7, font: fontRegular, color: cText });
    page.drawText(perStr, { x: cColPer, y: y - 11, size: 6.8, font: fontRegular, color: cMuted });
    page.drawText(`${at.horas.toFixed(1)} h`, { x: cColHoras, y: y - 11, size: 7.2, font: fontBold, color: cDark });
    page.drawText(`R$ ${at.valorHora.toFixed(2)}`, { x: cColVlH, y: y - 11, size: 7, font: fontRegular, color: cText });
    page.drawText(`R$ ${at.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, {
      x: cColSub,
      y: y - 11,
      size: 7.2,
      font: fontBold,
      color: cDark,
    });

    y -= rowH;
  });

  // Linha de Rodapé da Tabela (Total Consolidado da Medição)
  const tFootH = 16;
  page.drawRectangle({
    x: marginX,
    y: y - tFootH,
    width: contentWidth,
    height: tFootH,
    color: cDark,
  });

  page.drawText("TOTAL CONSOLIDADO DA MEDIÇÃO", { x: cColProj, y: y - 11, size: 7, font: fontBold, color: cWhite });
  page.drawText(`${dados.totalHoras.toFixed(1)} h`, { x: cColHoras, y: y - 11, size: 7.2, font: fontBold, color: cWhite });
  page.drawText(`(Média R$ ${dados.mediaHora.toFixed(2)})`, { x: cColVlH - 8, y: y - 11, size: 6.5, font: fontRegular, color: rgb(0.8, 0.9, 1) });
  page.drawText(`R$ ${dados.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, {
    x: cColSub,
    y: y - 11,
    size: 7.5,
    font: fontBold,
    color: rgb(0.22, 0.74, 0.97), // #38bdf8
  });

  y -= (tFootH + 8);

  // ==========================================
  // 5. REGRAS DE EMISSÃO DA NOTA FISCAL & PRAZOS
  // ==========================================
  const rulesH = 58;

  // Caixa Esquerda: Discriminação dos Serviços na NF
  page.drawRectangle({
    x: marginX,
    y: y - rulesH,
    width: partyW,
    height: rulesH,
    color: cWhite,
    borderColor: cBorder,
    borderWidth: 1,
  });

  page.drawText("DADOS OBRIGATÓRIOS PARA EMISSÃO DA NOTA FISCAL", { x: marginX + 8, y: y - 11, size: 6.8, font: fontBold, color: cDark });
  page.drawText(`Copie no campo "Descrição dos Serviços" do emissor da Nota Fiscal:`, { x: marginX + 8, y: y - 20, size: 6.5, font: fontRegular, color: cMuted });

  page.drawRectangle({
    x: marginX + 6,
    y: y - 48,
    width: partyW - 12,
    height: 25,
    color: cBgLight,
    borderColor: cBorder,
    borderWidth: 0.5,
  });

  page.drawText(`BM: ${dados.codigoBm}  |  CONTRATO: ${contratoLimpo}  |  TOTAL: R$ ${dados.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, {
    x: marginX + 10,
    y: y - 31,
    size: 6.8,
    font: fontBold,
    color: cDark,
  });
  page.drawText("Código CTISS: 0802-0/01-88 - Subitem LC 116/03: 8.02 (Instrução e treinamento)", {
    x: marginX + 10,
    y: y - 41,
    size: 6.3,
    font: fontRegular,
    color: cText,
  });

  page.drawText(`Enviar PDF da NF para: leonardo.campos@nnos.com.br`, {
    x: marginX + 8,
    y: y - 54,
    size: 6.5,
    font: fontBold,
    color: cPrimary,
  });

  // Caixa Direita: Cronograma de Envio e Pagamento
  page.drawRectangle({
    x: p2X,
    y: y - rulesH,
    width: partyW,
    height: rulesH,
    color: cWhite,
    borderColor: cBorder,
    borderWidth: 1,
  });

  page.drawText("CRONOGRAMA DE ENVIO E PAGAMENTO", { x: p2X + 8, y: y - 11, size: 6.8, font: fontBold, color: cDark });

  page.drawText("1ª Quinzena: Envio da NF até o dia 25 do mês vigente.", { x: p2X + 8, y: y - 22, size: 6.8, font: fontRegular, color: cText });
  page.drawText("- Previsão de Pagamento: Creditado no dia 10 subsequente.", { x: p2X + 12, y: y - 31, size: 6.5, font: fontBold, color: cSuccess });

  page.drawText("Totalidade / Mês Cheio: Envio da NF até o dia 10 após o BM.", { x: p2X + 8, y: y - 41, size: 6.8, font: fontRegular, color: cText });
  page.drawText("- Previsão de Pagamento: Creditado no dia 25 do mês corrente.", { x: p2X + 12, y: y - 50, size: 6.5, font: fontBold, color: cSuccess });

  y -= (rulesH + 8);

  // ==========================================
  // 6. DECLARAÇÃO DE ACEITE & ASSINATURAS DIGITAIS
  // ==========================================
  const signSecH = 92;
  page.drawRectangle({
    x: marginX,
    y: y - signSecH,
    width: contentWidth,
    height: signSecH,
    color: cWhite,
    borderColor: cBorder,
    borderWidth: 1,
  });

  // Declaração de Aceite com fundo verde suave
  page.drawRectangle({
    x: marginX + 6,
    y: y - 20,
    width: contentWidth - 12,
    height: 16,
    color: rgb(0.93, 0.98, 0.96),
    borderColor: rgb(0.65, 0.95, 0.82),
    borderWidth: 0.5,
  });

  page.drawText(`Declaração de Concordância e Aceite Operacional: "Declaro concordar integralmente com os valores, horas e quantidades apuradas nesta medição de serviços de ${dados.mesReferencia} para fins de faturamento."`, {
    x: marginX + 10,
    y: y - 14,
    size: 6.2,
    font: fontRegular,
    color: cText,
  });

  const signBoxW = (contentWidth - 20) / 2;
  const signBoxH = 64;
  const sY = y - 24;

  // Caixa de Assinatura 1: Prestador de Serviços (Recipient1)
  const sb1X = marginX + 6;
  page.drawRectangle({
    x: sb1X,
    y: sY - signBoxH,
    width: signBoxW,
    height: signBoxH,
    color: cBgLight,
    borderColor: rgb(0.86, 0.92, 0.98),
    borderWidth: 1,
  });

  page.drawText("ASSINATURA DO PRESTADOR", { x: sb1X + 8, y: sY - 10, size: 6.8, font: fontBold, color: cNavyHeader });

  // Text Tag Zoho Sign Recipient 1
  page.drawText("{{Signature:Recipient1*}}", { x: sb1X + 16, y: sY - 28, size: 9, font: fontBold, color: cPrimary });
  page.drawText("{{Signdate:Recipient1*}}", { x: sb1X + 150, y: sY - 28, size: 7.5, font: fontRegular, color: cMuted });

  page.drawLine({ start: { x: sb1X + 8, y: sY - 36 }, end: { x: sb1X + signBoxW - 8, y: sY - 36 }, color: cBorder, thickness: 0.5 });
  page.drawText(dados.consultorNome, { x: sb1X + 8, y: sY - 45, size: 7.5, font: fontBold, color: cDark });
  page.drawText(`Razão Social: ${razaoSocial} - CNPJ: ${cnpj}`, { x: sb1X + 8, y: sY - 55, size: 6.5, font: fontRegular, color: cMuted });

  // Caixa de Assinatura 2: Validação da Coordenação / NNÓS (Recipient2)
  const sb2X = marginX + 14 + signBoxW;
  page.drawRectangle({
    x: sb2X,
    y: sY - signBoxH,
    width: signBoxW,
    height: signBoxH,
    color: cBgLight,
    borderColor: rgb(0.86, 0.92, 0.98),
    borderWidth: 1,
  });

  page.drawText("VALIDAÇÃO DA COORDENAÇÃO", { x: sb2X + 8, y: sY - 10, size: 6.8, font: fontBold, color: cNavyHeader });

  // Text Tag Zoho Sign Recipient 2
  page.drawText("{{Signature:Recipient2*}}", { x: sb2X + 16, y: sY - 28, size: 9, font: fontBold, color: cPrimary });
  page.drawText("{{Signdate:Recipient2*}}", { x: sb2X + 150, y: sY - 28, size: 7.5, font: fontRegular, color: cMuted });

  page.drawLine({ start: { x: sb2X + 8, y: sY - 36 }, end: { x: sb2X + signBoxW - 8, y: sY - 36 }, color: cBorder, thickness: 0.5 });
  page.drawText(dados.responsavelNome || "MARCELA LARA DA SILVA", { x: sb2X + 8, y: sY - 45, size: 7.5, font: fontBold, color: cDark });
  page.drawText("Coordenação Operacional & Projetos - NNÓS Consultoria", { x: sb2X + 8, y: sY - 55, size: 6.5, font: fontRegular, color: cMuted });

  // ==========================================
  // 7. RODAPÉ INSTITUCIONAL COM VALIDADE JURÍDICA
  // ==========================================
  const footY = 22;
  page.drawLine({
    start: { x: marginX, y: footY + 10 },
    end: { x: marginX + contentWidth, y: footY + 10 },
    color: cDark,
    thickness: 1,
  });

  page.drawText("NNÓS CONSULTORIA E TREINAMENTO LTDA - CNPJ: 36.443.716/0001-00", {
    x: marginX,
    y: footY,
    size: 6.8,
    font: fontBold,
    color: cDark,
  });

  const legalText = `Autenticador: BM ${dados.codigoBm} - Documento gerado com validade jurídica via Zoho Sign`;
  const legalWidth = fontRegular.widthOfTextAtSize(legalText, 6.8);
  page.drawText(legalText, {
    x: marginX + contentWidth - legalWidth,
    y: footY,
    size: 6.8,
    font: fontRegular,
    color: cPrimary,
  });

  return await pdfDoc.save();
}
