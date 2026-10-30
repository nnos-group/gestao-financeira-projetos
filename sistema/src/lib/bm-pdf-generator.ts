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
  periodoTipo?: string;
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

  // Paleta Visual Oficial NNÓS (Fiel ao BmExportPdfSheet.tsx)
  const cDark = rgb(0.06, 0.09, 0.16);         // #0f172a (Títulos principais e divisórias)
  const cNavyHeader = rgb(0.06, 0.16, 0.29);   // #0f2a4a (Cabeçalho da tabela e ícones)
  const cPrimary = rgb(0.01, 0.52, 0.78);      // #0284c7 (Azul NNÓS institucional)
  const cSky = rgb(0.22, 0.74, 0.97);          // #38bdf8 (Destaque do total consolidado)
  const cText = rgb(0.20, 0.25, 0.33);         // #334155 (Texto padrão)
  const cMuted = rgb(0.39, 0.45, 0.55);        // #64748b (Texto secundário e rótulos)
  const cLightMuted = rgb(0.58, 0.64, 0.72);   // #94a3b8 (Bordas e detalhes sutis)
  const cBorder = rgb(0.88, 0.91, 0.94);       // #e2e8f0 (Bordas de cards)
  const cBgLight = rgb(0.97, 0.98, 0.99);      // #f8fafc (Fundo leve de cards)
  const cSuccess = rgb(0.02, 0.59, 0.41);      // #059669 (Verde aprovação)
  const cSuccessBg = rgb(0.94, 0.99, 0.96);    // #ecfdf5 (Fundo de aceite verde)
  const cSuccessBorder = rgb(0.65, 0.93, 0.78);// #a7f3d0 (Borda verde de aceite)
  const cWhite = rgb(1, 1, 1);

  // Função auxiliar para desenhar ícone de checkmark vetorial nativo
  const desenharCheckMark = (cx: number, cy: number, cor: any = cSuccess, sz: number = 6.5) => {
    page.drawLine({
      start: { x: cx, y: cy + sz * 0.4 },
      end: { x: cx + sz * 0.35, y: cy },
      color: cor,
      thickness: 1.2,
    });
    page.drawLine({
      start: { x: cx + sz * 0.35, y: cy },
      end: { x: cx + sz, y: cy + sz * 0.9 },
      color: cor,
      thickness: 1.2,
    });
  };

  // Carregar Logotipo Oficial Coruja NNÓS
  let logoImage: any = null;
  try {
    const possiblePaths = [
      path.join(process.cwd(), "public/logo-coruja.png"),
      path.join(process.cwd(), "sistema/public/logo-coruja.png"),
      path.join(process.cwd(), "sistema/public/relatorios-portal/logo-coruja.png"),
    ];
    const foundPath = possiblePaths.find((p) => fs.existsSync(p));
    if (foundPath) {
      const logoBytes = fs.readFileSync(foundPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
    }
  } catch (err) {
    console.warn("Aviso ao carregar logo-coruja.png no PDF:", err);
  }

  const marginX = 22;
  const contentWidth = width - marginX * 2; // 551.28 pt
  let y = height - 20;

  const contratoLimpo = (dados.contrato || "SÓCIO").replace(/•\s*NNÓS/g, "").trim();
  const dataHoje = new Date();
  const dataEmissao = `${String(dataHoje.getDate()).padStart(2, "0")}/${String(dataHoje.getMonth() + 1).padStart(2, "0")}/${dataHoje.getFullYear()}`;
  const razaoSocial = dados.consultorRazaoSocial || dados.consultorNome;
  const cnpj = dados.consultorCnpj || "Não informado";
  const endereco = dados.consultorEndereco || `EMAIL: ${dados.consultorEmail}`;

  // ==========================================
  // 1. CABEÇALHO DO DOCUMENTO (DocumentHeader)
  // ==========================================
  const logoSize = 34;
  if (logoImage) {
    page.drawImage(logoImage, {
      x: marginX,
      y: y - logoSize,
      width: logoSize,
      height: logoSize,
    });
  } else {
    page.drawRectangle({
      x: marginX,
      y: y - logoSize,
      width: logoSize,
      height: logoSize,
      color: cNavyHeader,
    });
    page.drawText("N", {
      x: marginX + 11,
      y: y - 24,
      size: 18,
      font: fontBold,
      color: cWhite,
    });
  }

  const titleX = marginX + logoSize + 10;
  page.drawText("Boletim de Medição de Serviços", {
    x: titleX,
    y: y - 22,
    size: 15.5,
    font: fontBold,
    color: cDark,
  });

  // Lado direito do cabeçalho
  const infoHeaderTop = `BM ${dados.codigoBm}  •  Contrato ${contratoLimpo}`;
  const infoHeaderTopWidth = fontBold.widthOfTextAtSize(infoHeaderTop, 10);
  page.drawText(infoHeaderTop, {
    x: marginX + contentWidth - infoHeaderTopWidth,
    y: y - 14,
    size: 10,
    font: fontBold,
    color: cDark,
  });

  const infoHeaderSub = `Emissão: ${dataEmissao}`;
  const infoHeaderSubWidth = fontRegular.widthOfTextAtSize(infoHeaderSub, 8.5);
  page.drawText(infoHeaderSub, {
    x: marginX + contentWidth - infoHeaderSubWidth,
    y: y - 26,
    size: 8.5,
    font: fontRegular,
    color: cMuted,
  });

  y -= (logoSize + 6);

  // Linha divisória escura oficial idêntica ao BmExportPdfSheet
  page.drawLine({
    start: { x: marginX, y: y },
    end: { x: marginX + contentWidth, y: y },
    color: cDark,
    thickness: 1.5,
  });

  y -= 7;

  // ==========================================
  // 2. GRID DE 4 CARDS DE INDICADORES (MetricsSummary)
  // ==========================================
  const cardGap = 7;
  const cardW = (contentWidth - cardGap * 3) / 4; // ~132.5 pt
  const cardH = 46;

  const desenharCardMetrica = (x: number, titulo: string, valorPrincipal: string, badgeTexto: string, isSucesso: boolean = false) => {
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
      color: cDark,
    });

    if (isSucesso) {
      desenharCheckMark(x + 8, y - 38, cSuccess, 6);
      page.drawText(badgeTexto, {
        x: x + 18,
        y: y - 39,
        size: 7.2,
        font: fontBold,
        color: cSuccess,
      });
    } else {
      page.drawText(badgeTexto, {
        x: x + 8,
        y: y - 39,
        size: 6.8,
        font: fontBold,
        color: cMuted,
      });
    }
  };

  // Card 1: Valor Líquido Total
  desenharCardMetrica(
    marginX,
    "Valor Líquido Total",
    `R$ ${dados.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    "Aprovado",
    true
  );

  // Card 2: Carga Horária
  desenharCardMetrica(
    marginX + (cardW + cardGap),
    "Carga Horária",
    `${dados.totalHoras.toFixed(1)} h`,
    `${dados.atividades.length} frentes • Média R$ ${dados.mediaHora.toFixed(2)}/h`
  );

  // Card 3: Mês de Referência
  desenharCardMetrica(
    marginX + (cardW + cardGap) * 2,
    "Mês de Referência",
    dados.mesReferencia,
    dados.periodoStr.includes("Quinzena") ? dados.periodoStr : "Período Integral"
  );

  // Card 4: Cronograma Previsto
  desenharCardMetrica(
    marginX + (cardW + cardGap) * 3,
    "Cronograma Previsto",
    "10 e 25 de Outubro",
    "• NF até dia 10 • Pagto dia 25"
  );

  y -= (cardH + 7);

  // ==========================================
  // 3. DADOS DAS PARTES (PRESTADOR E TOMADOR)
  // ==========================================
  const partyW = (contentWidth - cardGap) / 2; // ~272 pt
  const partyH = 68;

  // Box Prestador de Serviços
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

  // Ícone quadrado Prestador de Serviços
  page.drawRectangle({
    x: p1X + 8,
    y: y - 22,
    width: 18,
    height: 18,
    color: cNavyHeader,
    borderWidth: 0,
  });
  page.drawText("P", { x: p1X + 13.5, y: y - 18, size: 10, font: fontBold, color: cWhite });

  page.drawText("PRESTADOR DE SERVIÇOS", { x: p1X + 32, y: y - 12, size: 6.8, font: fontBold, color: cMuted });
  page.drawText(dados.consultorNome, { x: p1X + 32, y: y - 22, size: 9.5, font: fontBold, color: cDark });
  page.drawLine({ start: { x: p1X + 8, y: y - 27 }, end: { x: p1X + partyW - 8, y: y - 27 }, color: cBorder, thickness: 0.5 });

  page.drawText(`Razão Social / Titular: ${razaoSocial}`, { x: p1X + 8, y: y - 36, size: 6.8, font: fontRegular, color: cText });
  page.drawText(`CNPJ: ${cnpj}`, { x: p1X + 8, y: y - 46, size: 6.8, font: fontRegular, color: cText });
  const endLimpo = endereco.length > 56 ? endereco.substring(0, 53) + "..." : endereco;
  page.drawText(`Endereço: ${endLimpo}`, { x: p1X + 8, y: y - 56, size: 6.5, font: fontRegular, color: cMuted });
  page.drawText(`E-mail: ${dados.consultorEmail}  •  Contrato: ${contratoLimpo}`, { x: p1X + 8, y: y - 64, size: 6.5, font: fontRegular, color: cMuted });

  // Box Tomador dos Serviços (NNÓS)
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

  // Ícone quadrado Tomador dos Serviços
  page.drawRectangle({
    x: p2X + 8,
    y: y - 22,
    width: 18,
    height: 18,
    color: cNavyHeader,
    borderWidth: 0,
  });
  page.drawText("T", { x: p2X + 13.5, y: y - 18, size: 10, font: fontBold, color: cWhite });

  page.drawText("TOMADOR DOS SERVIÇOS", { x: p2X + 32, y: y - 12, size: 6.8, font: fontBold, color: cMuted });
  page.drawText("NNÓS CONSULTORIA E TREINAMENTO LTDA", { x: p2X + 32, y: y - 22, size: 9.5, font: fontBold, color: cDark });
  page.drawLine({ start: { x: p2X + 8, y: y - 27 }, end: { x: p2X + partyW - 8, y: y - 27 }, color: cBorder, thickness: 0.5 });

  page.drawText("CNPJ da Empresa: 36.443.716/0001-00", { x: p2X + 8, y: y - 36, size: 6.8, font: fontRegular, color: cText });
  page.drawText("Inscrição Municipal: 1.208.841/002-5", { x: p2X + 8, y: y - 46, size: 6.8, font: fontRegular, color: cText });
  page.drawText("Sede: Rua Sergipe, nº 77 - Loja 1, Boa Viagem, Belo Horizonte - MG", { x: p2X + 8, y: y - 56, size: 6.5, font: fontRegular, color: cMuted });
  page.drawText("Financeiro: leonardo.campos@nnos.com.br", { x: p2X + 8, y: y - 64, size: 6.5, font: fontRegular, color: cMuted });

  y -= (partyH + 7);

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

  page.drawText(`DETALHAMENTO OPERACIONAL DE HORAS`, {
    x: marginX + 8,
    y: y - 11,
    size: 7.2,
    font: fontBold,
    color: cWhite,
  });

  page.drawText(`Atividades Apuradas no Mês (${dados.mesReferencia})`, {
    x: marginX + 175,
    y: y - 11,
    size: 6.5,
    font: fontRegular,
    color: rgb(0.8, 0.88, 0.98),
  });

  const badgeLctos = `${dados.atividades.length} Lançamentos Registrados`;
  const badgeWidth = fontBold.widthOfTextAtSize(badgeLctos, 6.5);
  page.drawText(badgeLctos, {
    x: marginX + contentWidth - badgeWidth - 8,
    y: y - 11,
    size: 6.5,
    font: fontBold,
    color: cWhite,
  });

  y -= tHeaderH;

  // Colunas da Tabela
  const cColProj = marginX + 6;
  const cColAtiv = marginX + 120;
  const cColPer = marginX + 285;
  const cColHoras = marginX + 375;
  const cColVlH = marginX + 425;
  const cColSub = marginX + 480;

  // Sub-cabeçalho das Colunas
  const subHeadH = 14;
  page.drawRectangle({
    x: marginX,
    y: y - subHeadH,
    width: contentWidth,
    height: subHeadH,
    color: cDark,
  });

  page.drawText("PROJETO", { x: cColProj, y: y - 10, size: 6.5, font: fontBold, color: cWhite });
  page.drawText("ATIVIDADE / ESCOPO", { x: cColAtiv, y: y - 10, size: 6.5, font: fontBold, color: cWhite });
  page.drawText("PERÍODO", { x: cColPer, y: y - 10, size: 6.5, font: fontBold, color: cWhite });
  page.drawText("CH (HORAS)", { x: cColHoras, y: y - 10, size: 6.5, font: fontBold, color: cWhite });
  page.drawText("VALOR / HORA", { x: cColVlH, y: y - 10, size: 6.5, font: fontBold, color: cWhite });
  page.drawText("VALOR TOTAL", { x: cColSub, y: y - 10, size: 6.5, font: fontBold, color: cWhite });

  y -= subHeadH;

  // Linhas das Atividades
  const rowH = 15;
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

    const projStr = at.projeto.length > 22 ? at.projeto.substring(0, 20) + "..." : at.projeto;
    const ativStr = at.atividade.length > 38 ? at.atividade.substring(0, 36) + "..." : at.atividade;
    const perStr = at.periodo || dados.periodoStr;

    page.drawText(projStr, { x: cColProj, y: y - 10.5, size: 7, font: fontBold, color: cDark });
    page.drawText(ativStr, { x: cColAtiv, y: y - 10.5, size: 6.8, font: fontRegular, color: cText });
    page.drawText(perStr, { x: cColPer, y: y - 10.5, size: 6.5, font: fontRegular, color: cMuted });
    page.drawText(`${at.horas.toFixed(1)} h`, { x: cColHoras, y: y - 10.5, size: 7, font: fontBold, color: cDark });
    page.drawText(`R$ ${at.valorHora.toFixed(2)}`, { x: cColVlH, y: y - 10.5, size: 6.8, font: fontRegular, color: cText });
    page.drawText(`R$ ${at.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, {
      x: cColSub,
      y: y - 10.5,
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
    color: cSky,
  });

  y -= tFootH;

  // Barra de Rateio por Projeto no Rodapé da Tabela
  const rateioH = 11;
  page.drawRectangle({
    x: marginX,
    y: y - rateioH,
    width: contentWidth,
    height: rateioH,
    color: cBgLight,
    borderColor: cBorder,
    borderWidth: 0.5,
  });

  const primeiroProj = dados.atividades[0]?.projeto || "Atividades Gerais";
  page.drawText(`Rateio por Projeto:  •  ${primeiroProj} (100.0%)`, {
    x: marginX + 8,
    y: y - 8,
    size: 6.2,
    font: fontBold,
    color: cText,
  });

  y -= (rateioH + 7);

  // ==========================================
  // 5. REGRAS DE EMISSÃO DA NOTA FISCAL & FLUXO DE CAIXA
  // ==========================================
  const rulesH = 88;

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

  page.drawText("DADOS OBRIGATÓRIOS PARA EMISSÃO", { x: marginX + 8, y: y - 10, size: 5.5, font: fontBold, color: cPrimary });
  page.drawText("Discriminação dos Serviços na Nota Fiscal", { x: marginX + 8, y: y - 19, size: 7.5, font: fontBold, color: cDark });

  page.drawText('Copie o bloco textual abaixo e cole no campo "Descrição dos Serviços / Dados Adicionais"', {
    x: marginX + 8,
    y: y - 27,
    size: 5.2,
    font: fontRegular,
    color: cMuted,
  });
  page.drawText('do seu emissor de Nota Fiscal:', {
    x: marginX + 8,
    y: y - 33,
    size: 5.2,
    font: fontRegular,
    color: cMuted,
  });

  // Bloco Monospace de Cópia da NF
  const codeBoxH = 40;
  const codeBoxY = y - 36 - codeBoxH;
  page.drawRectangle({
    x: marginX + 6,
    y: codeBoxY,
    width: partyW - 12,
    height: codeBoxH,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.88, 0.91, 0.94),
    borderWidth: 0.5,
  });

  let curCodeY = y - 44;
  page.drawText(`BM: ${dados.codigoBm}  |  CONTRATO: ${contratoLimpo}`, {
    x: marginX + 10,
    y: curCodeY,
    size: 6,
    font: fontBold,
    color: cDark,
  });
  curCodeY -= 8;

  const projTotais = new Map<string, number>();
  (dados.atividades || []).forEach((a) => {
    const nomeProj = (a.projeto || "SERVIÇOS PROFISSIONAIS").toUpperCase().trim();
    projTotais.set(nomeProj, (projTotais.get(nomeProj) || 0) + (a.valorTotal || 0));
  });

  if (projTotais.size > 0) {
    const linhasProjs = Array.from(projTotais.entries()).slice(0, 1);
    linhasProjs.forEach(([pNome, pVl]) => {
      const pNomeTrunc = pNome.length > 28 ? pNome.slice(0, 26) + "..." : pNome;
      page.drawText(`${pNomeTrunc}: R$ ${pVl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, {
        x: marginX + 10,
        y: curCodeY,
        size: 5.8,
        font: fontBold,
        color: cText,
      });
      curCodeY -= 7.5;
    });
  } else {
    page.drawText(`TOTAL APURADO: R$ ${dados.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, {
      x: marginX + 10,
      y: curCodeY,
      size: 5.8,
      font: fontBold,
      color: cText,
    });
    curCodeY -= 8;
  }

  page.drawText("Código CTISS: 0802-0/01-88 (Instrução e treinamento)", {
    x: marginX + 10,
    y: curCodeY,
    size: 5.2,
    font: fontRegular,
    color: cMuted,
  });
  curCodeY -= 6.5;

  page.drawText("Subitem LC 116/03: 8.02 (Instrução, treinamento, orientação pedagógica).", {
    x: marginX + 10,
    y: curCodeY,
    size: 5.2,
    font: fontRegular,
    color: cMuted,
  });

  // Rodapé do Card de Discriminação
  page.drawText(`Enviar PDF da NF para: leonardo.campos@nnos.com.br`, {
    x: marginX + 8,
    y: y - rulesH + 6,
    size: 5.5,
    font: fontBold,
    color: cPrimary,
  });

  const refTexto = `Ref: BM ${dados.codigoBm}`;
  const refWidth = fontBold.widthOfTextAtSize(refTexto, 5.5);
  page.drawText(refTexto, {
    x: marginX + partyW - refWidth - 8,
    y: y - rulesH + 6,
    size: 5.5,
    font: fontBold,
    color: cMuted,
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

  page.drawText("FLUXO DE CAIXA & REGRAS", { x: p2X + 8, y: y - 10, size: 5.5, font: fontBold, color: cPrimary });
  page.drawText("Cronograma de Envio e Pagamento", { x: p2X + 8, y: y - 19, size: 7.5, font: fontBold, color: cDark });

  const isQuinzena1 = (dados.periodoTipo || dados.periodoStr || "").includes("1ª");

  // Sub-card 1: 1ª Quinzena
  const subH = 25;
  const sub1Y = y - 23 - subH;
  page.drawRectangle({
    x: p2X + 6,
    y: sub1Y,
    width: partyW - 12,
    height: subH,
    color: isQuinzena1 ? rgb(0.95, 0.97, 1) : rgb(0.97, 0.98, 0.99),
    borderColor: isQuinzena1 ? rgb(0.65, 0.8, 0.98) : rgb(0.88, 0.91, 0.94),
    borderWidth: isQuinzena1 ? 1 : 0.5,
  });

  page.drawRectangle({
    x: p2X + 10,
    y: sub1Y + 4.5,
    width: 16,
    height: 16,
    color: isQuinzena1 ? cNavyHeader : rgb(0.88, 0.91, 0.94),
    borderWidth: 0,
  });
  page.drawText("1ª", { x: p2X + 13.5, y: sub1Y + 9, size: 6.5, font: fontBold, color: isQuinzena1 ? cWhite : cPrimary });

  page.drawText("Atividades da 1ª Quinzena", { x: p2X + 30, y: sub1Y + 15, size: 6, font: fontBold, color: cPrimary });
  page.drawText("Envio da nota fiscal até o dia 25 do mês vigente.", { x: p2X + 30, y: sub1Y + 8.5, size: 5.2, font: fontRegular, color: cText });
  page.drawText("Pagamento creditado no dia 10 subsequente", { x: p2X + 30, y: sub1Y + 2.5, size: 5.2, font: fontBold, color: cSuccess });

  // Sub-card 2: Totalidade das Atividades / Mês Cheio
  const sub2Y = sub1Y - subH - 3;
  page.drawRectangle({
    x: p2X + 6,
    y: sub2Y,
    width: partyW - 12,
    height: subH,
    color: !isQuinzena1 ? rgb(0.95, 0.97, 1) : rgb(0.97, 0.98, 0.99),
    borderColor: !isQuinzena1 ? rgb(0.65, 0.8, 0.98) : rgb(0.82, 0.86, 0.92),
    borderWidth: !isQuinzena1 ? 1 : 0.5,
  });

  page.drawRectangle({
    x: p2X + 10,
    y: sub2Y + 4.5,
    width: 16,
    height: 16,
    color: !isQuinzena1 ? cNavyHeader : rgb(0.88, 0.91, 0.94),
    borderWidth: 0,
  });
  page.drawText("2ª", { x: p2X + 13.5, y: sub2Y + 9, size: 6.5, font: fontBold, color: !isQuinzena1 ? cWhite : cPrimary });

  page.drawText(`Totalidade das Atividades / Mês Cheio`, { x: p2X + 30, y: sub2Y + 15, size: 6, font: fontBold, color: cPrimary });
  page.drawText("Envio da nota fiscal até o dia 10 após recebimento do BM.", { x: p2X + 30, y: sub2Y + 8.5, size: 5.2, font: fontRegular, color: cText });
  page.drawText(`Previsão de Liquidação: Dia 25 de ${dados.mesReferencia || "Outubro / 2026"}`, { x: p2X + 30, y: sub2Y + 2.5, size: 5.2, font: fontBold, color: cSuccess });

  // Timeline Horizontal
  const timeBarY = y - rulesH + 4;
  page.drawRectangle({
    x: p2X + 6,
    y: timeBarY,
    width: partyW - 12,
    height: 9,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.9, 0.92, 0.95),
    borderWidth: 0.5,
  });

  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  let mesNum = 10;
  let anoNum = 2026;
  const mesMatch = (dados.mesReferencia || "").match(/(\d{4})/);
  if (mesMatch) anoNum = Number(mesMatch[1]);
  mesesNomes.forEach((m, idx) => {
    if ((dados.mesReferencia || "").toLowerCase().includes(m.toLowerCase())) mesNum = idx + 1;
  });

  const mesStr = String(mesNum).padStart(2, "0");
  const proxMesNum = mesNum === 12 ? 1 : mesNum + 1;
  const proxAnoNum = mesNum === 12 ? anoNum + 1 : anoNum;
  const proxMesStr = String(proxMesNum).padStart(2, "0");

  let tBm = `• BM: 18/${mesStr}`;
  let tPrazo = `Prazo NF: 25/${mesStr}`;
  let tCredito = `• Crédito: 10/${proxMesStr}/${proxAnoNum}`;

  if (!isQuinzena1) {
    tBm = `• BM: 01/${proxMesStr}`;
    tPrazo = `Prazo NF: 10/${proxMesStr}`;
    tCredito = `• Crédito: 25/${proxMesStr}/${proxAnoNum}`;
  }

  page.drawText(tBm, { x: p2X + 12, y: timeBarY + 2.5, size: 5.2, font: fontBold, color: cDark });
  page.drawText("------>", { x: p2X + 68, y: timeBarY + 2.5, size: 5, font: fontRegular, color: cMuted });
  page.drawText(tPrazo, { x: p2X + 96, y: timeBarY + 2.5, size: 5.2, font: fontBold, color: cPrimary });
  page.drawText("------>", { x: p2X + 155, y: timeBarY + 2.5, size: 5, font: fontRegular, color: cMuted });
  page.drawText(tCredito, { x: p2X + 185, y: timeBarY + 2.5, size: 5.2, font: fontBold, color: cSuccess });

  y -= (rulesH + 7);

  // =========================================================================
  // 6. DECLARAÇÃO DE ACEITE & ASSINATURAS DIGITAIS AMPLIADAS
  // =========================================================================
  // Altura ampliada para 114pt garantindo campo amplo de assinatura e identificação de todos os signatários
  const signBoxH = 114;
  const declH = 22;
  const signSecH = declH + signBoxH + 12;

  page.drawRectangle({
    x: marginX,
    y: y - signSecH,
    width: contentWidth,
    height: signSecH,
    color: cWhite,
    borderColor: cBorder,
    borderWidth: 1,
  });

  // Declaração de Aceite com fundo verde suave idêntico ao modelo
  page.drawRectangle({
    x: marginX + 6,
    y: y - declH - 4,
    width: contentWidth - 12,
    height: declH,
    color: cSuccessBg,
    borderColor: cSuccessBorder,
    borderWidth: 0.5,
  });

  desenharCheckMark(marginX + 12, y - 13, cSuccess, 7);

  page.drawText("Declaração de Concordância e Aceite Operacional", {
    x: marginX + 23,
    y: y - 13,
    size: 7.2,
    font: fontBold,
    color: cSuccess,
  });

  page.drawText(`"Declaro concordar integralmente com os valores, horas e quantidades constantes nesta medição de serviços de ${dados.mesReferencia} para fins de emissão de faturamento."`, {
    x: marginX + 12,
    y: y - 22,
    size: 5.8,
    font: fontOblique,
    color: cText,
  });

  const sY = y - declH - 8;
  const gap = 8;
  const boxW = (contentWidth - (gap * 2)) / 3; // ~171.76 pt cada caixa

  // Cor sutil para as tags no PDF (imperceptível sobre o card branco, mas garantindo 100% de leitura pelo parser do Zoho Sign)
  const cTagGhost = rgb(0.97, 0.98, 0.99);

  // -------------------------------------------------------------------------
  // CAIXA 1: ASSINATURA DO PRESTADOR DE SERVIÇOS (RECIPIENT 2)
  // -------------------------------------------------------------------------
  const b1X = marginX;
  page.drawRectangle({
    x: b1X,
    y: sY - signBoxH,
    width: boxW,
    height: signBoxH,
    color: cWhite, // Fundo branco puro para harmonizar perfeitamente com a estampa de assinatura do Zoho Sign
    borderColor: rgb(0.86, 0.92, 0.98),
    borderWidth: 1,
  });

  page.drawText("ASSINATURA DO PRESTADOR", { x: b1X + 8, y: sY - 14, size: 6.8, font: fontBold, color: cNavyHeader });

  // Text Tags Oficiais Zoho Sign: Sintaxe estrita sem espaços para reconhecimento imediato pelo parser
  page.drawText("{{Signature:Recipient2*}}", { x: b1X + 10, y: sY - 44, size: 14, font: fontRegular, color: cTagGhost });
  page.drawText("{{Signdate:Recipient2*}}", { x: b1X + 10, y: sY - 64, size: 8, font: fontRegular, color: cTagGhost });

  page.drawLine({ start: { x: b1X + 8, y: sY - 76 }, end: { x: b1X + boxW - 8, y: sY - 76 }, color: cBorder, thickness: 0.5 });
  page.drawText(dados.consultorNome, { x: b1X + 8, y: sY - 88, size: 7.5, font: fontBold, color: cDark });
  page.drawText(`Razão Social: ${razaoSocial}`, { x: b1X + 8, y: sY - 98, size: 5.5, font: fontRegular, color: cMuted });
  page.drawText(`CNPJ: ${cnpj}`, { x: b1X + 8, y: sY - 106, size: 5.5, font: fontRegular, color: cMuted });

  // -------------------------------------------------------------------------
  // CAIXA 2: VALIDAÇÃO DO LÍDER DE PROJETO (RECIPIENT 1)
  // -------------------------------------------------------------------------
  const b2X = marginX + boxW + gap;
  page.drawRectangle({
    x: b2X,
    y: sY - signBoxH,
    width: boxW,
    height: signBoxH,
    color: cWhite, // Fundo branco puro
    borderColor: rgb(0.86, 0.92, 0.98),
    borderWidth: 1,
  });

  page.drawText("VALIDAÇÃO DO LÍDER DE PROJETO", { x: b2X + 8, y: sY - 14, size: 6.8, font: fontBold, color: cNavyHeader });

  // Text Tags Oficiais Zoho Sign: Líder de Projeto
  page.drawText("{{Signature:Recipient1*}}", { x: b2X + 10, y: sY - 44, size: 14, font: fontRegular, color: cTagGhost });
  page.drawText("{{Signdate:Recipient1*}}", { x: b2X + 10, y: sY - 64, size: 8, font: fontRegular, color: cTagGhost });

  page.drawLine({ start: { x: b2X + 8, y: sY - 76 }, end: { x: b2X + boxW - 8, y: sY - 76 }, color: cBorder, thickness: 0.5 });
  page.drawText(dados.liderNome || "Beatriz Picorelli", { x: b2X + 8, y: sY - 88, size: 7.5, font: fontBold, color: cDark });
  page.drawText("Liderança de Projeto • NNÓS Consultoria", { x: b2X + 8, y: sY - 100, size: 5.6, font: fontRegular, color: cMuted });

  // -------------------------------------------------------------------------
  // CAIXA 3: VALIDAÇÃO DA COORDENAÇÃO GERAL (RECIPIENT 3)
  // -------------------------------------------------------------------------
  const b3X = marginX + (boxW * 2) + (gap * 2);
  page.drawRectangle({
    x: b3X,
    y: sY - signBoxH,
    width: boxW,
    height: signBoxH,
    color: cWhite, // Fundo branco puro
    borderColor: rgb(0.86, 0.92, 0.98),
    borderWidth: 1,
  });

  page.drawText("VALIDAÇÃO DA COORDENAÇÃO", { x: b3X + 8, y: sY - 14, size: 6.8, font: fontBold, color: cNavyHeader });

  // Text Tags Oficiais Zoho Sign: Coordenação
  page.drawText("{{Signature:Recipient3*}}", { x: b3X + 10, y: sY - 44, size: 14, font: fontRegular, color: cTagGhost });
  page.drawText("{{Signdate:Recipient3*}}", { x: b3X + 10, y: sY - 64, size: 8, font: fontRegular, color: cTagGhost });

  page.drawLine({ start: { x: b3X + 8, y: sY - 76 }, end: { x: b3X + boxW - 8, y: sY - 76 }, color: cBorder, thickness: 0.5 });
  page.drawText(dados.responsavelNome || "Marcelo Lara da Silva", { x: b3X + 8, y: sY - 88, size: 7.5, font: fontBold, color: cDark });
  page.drawText("Coordenação Operacional & Projetos • NNÓS", { x: b3X + 8, y: sY - 100, size: 5.6, font: fontRegular, color: cMuted });

  y -= (signSecH + 8);

  // =========================================================================
  // 7. RODAPÉ INSTITUCIONAL OFICIAL COM VALIDADE JURÍDICA
  // =========================================================================
  // Fiel ao BmExportPdfSheet: Linha divisória superior escura e logomarca solta abaixo da linha
  const footLineY = 44;
  page.drawLine({
    start: { x: marginX, y: footLineY },
    end: { x: marginX + contentWidth, y: footLineY },
    color: cDark,
    thickness: 1.5,
  });

  const logoFootSize = 26;
  const logoFootY = footLineY - 4 - logoFootSize; // y = 14 (vai de 14 a 40, respiro de 4pt abaixo da linha 44)
  if (logoImage) {
    page.drawImage(logoImage, {
      x: marginX,
      y: logoFootY,
      width: logoFootSize,
      height: logoFootSize,
    });
  }

  const footTextX = logoImage ? marginX + logoFootSize + 10 : marginX;
  page.drawText("NNÓS CONSULTORIA E TREINAMENTO LTDA", {
    x: footTextX,
    y: footLineY - 15,
    size: 7.2,
    font: fontBold,
    color: cDark,
  });

  page.drawText("CNPJ: 36.443.716/0001-00  •  Inscrição Municipal: 1.208.841/002-5", {
    x: footTextX,
    y: footLineY - 24,
    size: 5.8,
    font: fontRegular,
    color: cMuted,
  });

  page.drawText("Rua Sergipe, nº 77 - Loja 1, Boa Viagem, Belo Horizonte - MG, CEP: 30.130-170", {
    x: footTextX,
    y: footLineY - 32,
    size: 5.4,
    font: fontRegular,
    color: cMuted,
  });

  // Lado Direito do Rodapé
  const legalText = `Autenticador: BM ${dados.codigoBm}`;
  const legalWidth = fontBold.widthOfTextAtSize(legalText, 8.5);
  page.drawText(legalText, {
    x: marginX + contentWidth - legalWidth,
    y: footLineY - 15,
    size: 8.5,
    font: fontBold,
    color: cPrimary,
  });

  const legalSub = "Documento gerado eletronicamente com validade jurídica via Zoho Sign";
  const legalSubWidth = fontRegular.widthOfTextAtSize(legalSub, 5.8);
  page.drawText(legalSub, {
    x: marginX + contentWidth - legalSubWidth,
    y: footLineY - 24,
    size: 5.8,
    font: fontRegular,
    color: cMuted,
  });

  return await pdfDoc.save();
}
