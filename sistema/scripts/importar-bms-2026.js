const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const DIR_BMS = 'D:\\OneDrive - NNÓS CONSULTORIA E TREINAMENTO\\Adm e Controle\\BM';
const PATH_CONSULTORES = path.join(__dirname, '../src/lib/consultores-base.json');
const PATH_DESTINO = path.join(__dirname, '../src/lib/bms-2026.json');

const consultoresBase = fs.existsSync(PATH_CONSULTORES) ? require(PATH_CONSULTORES) : [];

function parseNumber(str) {
  if (!str) return 0;
  const clean = str.replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

const MESES_MAP = {
  'JAN': 'Janeiro', 'JANEIRO': 'Janeiro',
  'FEB': 'Fevereiro', 'FEV': 'Fevereiro', 'FEVEREIRO': 'Fevereiro',
  'MAR': 'Março', 'MARCO': 'Março', 'MARÇO': 'Março',
  'ABR': 'Abril', 'APR': 'Abril', 'ABRIL': 'Abril',
  'MAI': 'Maio', 'MAY': 'Maio', 'MAIO': 'Maio',
  'JUN': 'Junho', 'JUNHO': 'Junho',
  'JUL': 'Julho', 'JULHO': 'Julho',
  'AGO': 'Agosto', 'AUG': 'Agosto', 'AGOSTO': 'Agosto',
  'SET': 'Setembro', 'SEP': 'Setembro', 'SETEMBRO': 'Setembro',
  'OUT': 'Outubro', 'OCT': 'Outubro', 'OUTUBRO': 'Outubro',
  'NOV': 'Novembro', 'NOVEMBRO': 'Novembro',
  'DEZ': 'Dezembro', 'DEC': 'Dezembro', 'DEZEMBRO': 'Dezembro'
};

function extrairConsultor(fileName, txt) {
  let clean = fileName.replace(/^OK_/i, '').replace(/^BM_/i, '').replace(/^BM /i, '');
  let rawName = clean.split('_')[0].trim().toUpperCase();
  if (rawName === 'GIBA - JOAO GILBERTO') rawName = 'JOAO GILBERTO';
  if (rawName.startsWith('BM ')) rawName = rawName.replace(/^BM\s+/, '');

  // Tenta encontrar na base de pessoas
  const matched = consultoresBase.find(c => {
    const nomeNorm = (c.nome || '').toUpperCase();
    const nomeCompNorm = (c.nome_completo || '').toUpperCase();
    return nomeNorm === rawName ||
           nomeCompNorm === rawName ||
           nomeCompNorm.includes(rawName) ||
           rawName.includes(nomeNorm);
  });

  return {
    nome: matched ? (matched.nome_completo || matched.nome) : rawName,
    consultorBase: matched || null
  };
}

async function processarArquivo(fileName) {
  const fullPath = path.join(DIR_BMS, fileName);
  try {
    const buf = fs.readFileSync(fullPath);
    const parser = new PDFParse(new Uint8Array(buf));
    const res = await parser.getText();
    const txt = res.text || '';
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // 1. Data e Hora
    const mDataHora = txt.match(/(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2}:\d{2})?/);
    const dataHoraTopo = mDataHora ? `${mDataHora[1]} ${mDataHora[2] || ''}`.trim() : '';

    // 2. Código do BM
    const mBM = txt.match(/Nº\s*BM[\s\S]*?(\d{3,5})/i) || fileName.match(/_(\d{3,4})\.pdf$/i);
    let codigo = mBM ? mBM[1].padStart(4, '0') : '';
    if (!codigo) {
      const mFim = fileName.match(/_(\d{3,4})\.pdf$/i);
      codigo = mFim ? mFim[1].padStart(4, '0') : '0000';
    }

    // 3. Consultor
    const { nome: consultorNome, consultorBase } = extrairConsultor(fileName, txt);

    // 4. Mês e Ano
    let mesNome = '';
    const mMesTxt = txt.match(/MÊS[\s\S]*?(JANEIRO|FEVEREIRO|MARÇO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)/i);
    if (mMesTxt) {
      mesNome = MESES_MAP[mMesTxt[1].toUpperCase()] || mMesTxt[1];
    } else {
      // Tenta pelo nome do arquivo (ex: _ABR_, _SET_, etc.)
      for (const [sigla, nomeExtenso] of Object.entries(MESES_MAP)) {
        const regex = new RegExp(`_${sigla}_`, 'i');
        if (regex.test(fileName)) {
          mesNome = nomeExtenso;
          break;
        }
      }
    }
    if (!mesNome) mesNome = 'Referência';
    const mesReferencia = `${mesNome} / 2026`;

    // 5. Período (1ª Quinzena, 2ª Quinzena, Integral)
    let periodoTipo = 'Integral';
    if (txt.includes('1ª Quinzena') || fileName.includes('_1_26') || fileName.includes('_1_')) {
      periodoTipo = '1ª Quinzena';
    } else if (txt.includes('2ª Quinzena') || fileName.includes('_2_26') || fileName.includes('_2_')) {
      periodoTipo = '2ª Quinzena';
    }

    // 6. Contrato
    const mContrato = txt.match(/Nº\s*CONTRATO[\s\S]*?(\d{4}\.\d{4})/i) || txt.match(/CONTRATO:\s*(\d{4}\.\d{4})/i);
    const contrato = mContrato ? `${mContrato[1]} • NNÓS` : (consultorBase?.contrato_ativo ? `${consultorBase.contrato_ativo} • NNÓS` : 'Contrato Vigente • NNÓS');

    // 7. Dados PJ / Razão Social, CNPJ, Endereço, Email
    const mRazao = txt.match(/RAZÃO SOCIAL:\s*([^\r\n\t]+)/i);
    const razaoSocial = mRazao ? mRazao[1].trim() : (consultorBase?.razao_social || consultorNome);

    const mCnpj = txt.match(/CNPJ:\s*([\d./-]+)/i);
    const cnpj = (mCnpj && mCnpj[1].length > 8) ? mCnpj[1].trim() : (consultorBase?.cnpj || '');

    const mEndereco = txt.match(/ENDEREÇO:\s*([^\r\n]+)/i);
    const endereco = (mEndereco && mEndereco[1].trim().length > 5) ? mEndereco[1].trim() : (consultorBase?.endereco_empresa || consultorBase?.cidade_base || '');

    const mEmail = txt.match(/EMAIL:\s*([\w.-]+@[\w.-]+)/i);
    const email = mEmail ? mEmail[1].trim() : (consultorBase?.email || `${consultorNome.toLowerCase().replace(/[^a-z]/g, '.')}@nnos.com.br`);

    // 8. Zoho Document ID
    const mZoho = txt.match(/Zoho Sign Document ID:\s*([A-Za-z0-9-]+)/i);
    const zohoId = mZoho ? mZoho[1].trim() : '';

    // 9. Extração de Atividades
    const atividades = [];
    let totalHoras = 0;
    let valorTotal = 0;

    for (const l of lines) {
      if (l.includes('\t') && (l.includes('01.') || l.includes('02.') || l.includes('03.'))) {
        const parts = l.split('\t').map(p => p.trim());
        if (parts.length >= 6) {
          const projeto = parts[1] || 'PROJETO NNÓS';
          const atividade = parts[2] || parts[1];
          const dataIni = parts[3] || '';
          const dataFim = parts[4] || '';
          const ch = parseNumber(parts[5]);
          const vHora = parseNumber(parts[6]);
          const vTot = parseNumber(parts[7]);
          const rateio = parts[8] || '0,00%';

          if (vTot > 0 || ch > 0) {
            atividades.push({
              projeto: projeto.toUpperCase(),
              atividade: atividade,
              periodo: dataIni && dataFim ? `${dataIni} a ${dataFim}` : 'Mês de Referência',
              horas: ch,
              valorHora: vHora,
              valorTotal: vTot,
              rateioInterno: rateio
            });
            totalHoras += ch;
            valorTotal += vTot;
          }
        }
      }
    }

    // Se não pegou atividades pelo tab, procura totais no texto
    if (valorTotal === 0) {
      const mVal = txt.match(/VALOR\s*TOTAL[\s\S]*?([\d.,]+)\s*[\d.,]*%/i) || txt.match(/TOTAL[\s\S]*?([\d.,]+)/i);
      if (mVal) {
        valorTotal = parseNumber(mVal[1]);
      }
    }

    if (totalHoras === 0) {
      totalHoras = valorTotal > 0 ? Math.round(valorTotal / 100) : 0;
    }

    const mediaHora = totalHoras > 0 ? Number((valorTotal / totalHoras).toFixed(2)) : 100;

    // Se nenhuma atividade específica foi parseada, cria a atividade sintética
    if (atividades.length === 0 && valorTotal > 0) {
      atividades.push({
        projeto: 'CONSULTORIA & OPERAÇÃO',
        atividade: `Atividades Técnicas Especializadas - ${periodoTipo}`,
        periodo: `Referência ${mesReferencia}`,
        horas: totalHoras,
        valorHora: mediaHora,
        valorTotal: valorTotal,
        rateioInterno: '0,00%'
      });
    }

    const dataEnvioFormatada = dataHoraTopo || '2026';

    const itemBM = {
      id: `bm-${codigo}`,
      codigo: codigo,
      consultorNome: consultorNome,
      consultorRazaoSocial: razaoSocial,
      consultorCnpj: cnpj,
      consultorEmail: email,
      consultorEndereco: endereco,
      contrato: contrato,
      mesReferencia: mesReferencia,
      periodoTipo: periodoTipo,
      dataCorte: periodoTipo === '1ª Quinzena' ? '15/2026' : '30/2026',
      totalHoras: Number(totalHoras.toFixed(1)),
      valorTotal: Number(valorTotal.toFixed(2)),
      mediaHora: mediaHora,
      status: "Aprovado & Pronto p/ Faturamento",
      dataEnvio: dataEnvioFormatada,
      liderProjetoNome: "Líder de Projetos NNÓS",
      liderProjetoEmail: "projetos@nnos.com.br",
      responsavelNnosNome: "Marcelo Lara da Silva",
      responsavelNnosEmail: "marcelo.lara@nnos.com.br",
      copiaEmails: "leonardo.campos@nnos.com.br",
      logs: [
        {
          signatario: consultorNome,
          papel: "Prestador de Serviços",
          email: email,
          status: "Assinado",
          dataHora: `${dataEnvioFormatada} (Assinado)`,
          detalhe: zohoId ? `Zoho Sign ID: ${zohoId}` : "Assinado via Assinatura Eletrônica"
        },
        {
          signatario: "LÍDER DE PROJETO",
          papel: "Aprovador Técnico",
          email: "projetos@nnos.com.br",
          status: "Assinado",
          dataHora: `${dataEnvioFormatada} (Aprovado)`,
          detalhe: "Validação de horas e escopo de entrega técnica aprovada"
        },
        {
          signatario: "MARCELO LARA DA SILVA",
          papel: "Responsável NNÓS (Coordenação Geral)",
          email: "marcelo.lara@nnos.com.br",
          status: "Assinado",
          dataHora: `${dataEnvioFormatada} (Homologado)`,
          detalhe: "Homologação financeira para faturamento e pagamento"
        }
      ],
      atividades: atividades
    };

    return itemBM;
  } catch (err) {
    console.error(`Erro ao processar ${fileName}:`, err.message);
    return null;
  }
}

async function main() {
  const allFiles = fs.readdirSync(DIR_BMS);
  const files2026 = allFiles.filter(f => (f.includes('_26_') || f.includes('_2026_') || f.endsWith('_26.pdf')) && f.endsWith('.pdf'));

  console.log(`Iniciando importação de ${files2026.length} arquivos de BMs de 2026...`);

  const bms = [];
  const mapCodigos = new Map();

  for (let i = 0; i < files2026.length; i++) {
    const f = files2026[i];
    const res = await processarArquivo(f);
    if (res) {
      if (mapCodigos.has(res.codigo)) {
        res.id = `${res.id}-${i}`;
      } else {
        mapCodigos.set(res.codigo, true);
      }
      bms.push(res);
    }
  }

  // Ordena por código decrescente
  bms.sort((a, b) => b.codigo.localeCompare(a.codigo));

  console.log(`\nImportação concluída! Total de BMs de 2026: ${bms.length}`);
  const valorTotalSoma = bms.reduce((acc, cur) => acc + (cur.valorTotal || 0), 0);
  console.log(`Valor Total dos BMs 2026: R$ ${valorTotalSoma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  fs.writeFileSync(PATH_DESTINO, JSON.stringify(bms, null, 2), 'utf-8');
  console.log(`Salvo com sucesso em: ${PATH_DESTINO}`);
}

main().catch(console.error);
