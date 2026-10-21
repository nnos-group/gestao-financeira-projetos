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

    // 5. Período Exato (Integral, 1ª Quinzena, 2ª Quinzena) extraído do cabeçalho
    let periodoTipo = 'Integral';
    const mHeaderPeriodo = txt.match(/Per[íi]odo[\s\S]*?DATA[\s\S]*?\n([A-ZÇÃÕ]+)\s*\n([^\n]+)\s*\n(\d{3,5})/i);
    if (mHeaderPeriodo) {
      const pRaw = mHeaderPeriodo[2].trim();
      if (/1ª\s*Quinzena/i.test(pRaw)) periodoTipo = '1ª Quinzena';
      else if (/2ª\s*Quinzena/i.test(pRaw)) periodoTipo = '2ª Quinzena';
      else if (/Integral/i.test(pRaw)) periodoTipo = 'Integral';
    } else {
      if (/_1_26/i.test(fileName)) periodoTipo = '1ª Quinzena';
      else if (/_2_26/i.test(fileName)) periodoTipo = '2ª Quinzena';
      else periodoTipo = 'Integral';
    }

    // Extração da Data de Corte do cabeçalho (ex: 20/09, 15/04)
    let dataCorte = '';
    const dataIdx = lines.findIndex(l => l === 'DATA');
    if (dataIdx !== -1) {
      for (let k = dataIdx + 1; k < Math.min(lines.length, dataIdx + 15); k++) {
        if (/^\d{2}\/\d{2}$/.test(lines[k])) {
          dataCorte = `${lines[k]}/2026`;
          break;
        }
      }
    }
    if (!dataCorte) {
      dataCorte = periodoTipo === '1ª Quinzena' ? '15/2026' : '20/2026';
    }

    // 6. Contrato (sem sufixo • NNÓS)
    const mContrato = txt.match(/Nº\s*CONTRATO[\s\S]*?(\d{4}\.\d{4})/i) || txt.match(/CONTRATO:\s*(\d{4}\.\d{4})/i);
    const contrato = mContrato
      ? mContrato[1]
      : (consultorBase?.contrato_ativo
          ? String(consultorBase.contrato_ativo).replace(/•\s*NNÓS/g, '').trim()
          : (consultorNome.toLowerCase().includes('marcelo') ? 'SÓCIO' : 'Contrato Vigente'));

    // 7. Dados PJ / Razão Social, CNPJ, Endereço, Email
    let razaoSocial = '';
    let cnpj = '';
    let endereco = '';
    const isMarcelo = consultorNome.toLowerCase().includes('marcelo');

    if (isMarcelo) {
      razaoSocial = 'DRONEX COMERCIO E SERVICOS LTDA';
      cnpj = '55.408.003/0001-50';
      endereco = 'Rua João Lage, nº 125, Apt 403, Alto São Luiz, Pará de Minas - MG | CEP 35660-970';
    } else {
      const mRazao = txt.match(/RAZÃO SOCIAL:\s*([^\r\n\t]+)/i);
      razaoSocial = mRazao ? mRazao[1].trim() : (consultorBase?.razao_social || consultorNome);

      const mCnpj = txt.match(/CNPJ:\s*([\d./-]+)/i);
      cnpj = (mCnpj && mCnpj[1].length > 8) ? mCnpj[1].trim() : (consultorBase?.cnpj || '');

      const mEndereco = txt.match(/ENDEREÇO:\s*([^\r\n]+)/i);
      endereco = (mEndereco && mEndereco[1].trim().length > 5) ? mEndereco[1].trim() : (consultorBase?.endereco_empresa || consultorBase?.cidade_base || '');
    }

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
          const vTotal = parseNumber(parts[7]);
          const rInterno = parts[8] || '0,00%';

          totalHoras += ch;
          valorTotal += vTotal;

          atividades.push({
            projeto,
            atividade,
            periodo: dataIni && dataFim ? `${dataIni} a ${dataFim}` : mesReferencia,
            dataInicial: dataIni || null,
            dataFinal: dataFim || null,
            horas: ch,
            valorHora: vHora,
            valorTotal: vTotal,
            rateioInterno: rInterno
          });
        }
      }
    }

    const mediaHora = totalHoras > 0 ? Number((valorTotal / totalHoras).toFixed(2)) : 0;
    const dataEnvioFormatada = dataHoraTopo || `25/${mesReferencia.includes('Setembro') ? '09' : '10'}/2026`;

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
      dataCorte: dataCorte,
      totalHoras: Number(totalHoras.toFixed(1)),
      valorTotal: Number(valorTotal.toFixed(2)),
      mediaHora: mediaHora,
      status: "Aprovado & Pronto p/ Faturamento",
      dataEnvio: dataEnvioFormatada,
      liderProjetoNome: "Líder de Projetos NNÓS",
      liderProjetoEmail: "projetos@nnos.com.br",
      responsavelNnosNome: isMarcelo ? "Leonardo Campos" : "Marcelo Lara da Silva",
      responsavelNnosEmail: isMarcelo ? "leonardo.campos@nnos.com.br" : "marcelo.lara@nnos.com.br",
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
          signatario: isMarcelo ? "LEONARDO CAMPOS" : "MARCELO LARA DA SILVA",
          papel: isMarcelo ? "Financeiro / Validação Final • NNÓS" : "Responsável NNÓS (Coordenação Geral)",
          email: isMarcelo ? "leonardo.campos@nnos.com.br" : "marcelo.lara@nnos.com.br",
          status: "Assinado",
          dataHora: `${dataEnvioFormatada} (Homologado)`,
          detalhe: isMarcelo ? "Homologado pelo financeiro" : "Homologação financeira para faturamento e pagamento"
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
  const files2026 = allFiles.filter(f => (f.includes('_26_') || f.includes('_2026_') || f.endsWith('_26.pdf') || f.endsWith('_26 (1).pdf')) && f.endsWith('.pdf'));

  console.log(`Iniciando reimportação precisa de ${files2026.length} arquivos de BMs de 2026...`);

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

  bms.sort((a, b) => b.codigo.localeCompare(a.codigo));

  console.log(`\nReimportação concluída! Total de BMs de 2026: ${bms.length}`);
  const valorTotalSoma = bms.reduce((acc, cur) => acc + (cur.valorTotal || 0), 0);
  console.log(`Valor Total dos BMs 2026: R$ ${valorTotalSoma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  fs.writeFileSync(PATH_DESTINO, JSON.stringify(bms, null, 2), 'utf-8');
  console.log(`Salvo com sucesso em: ${PATH_DESTINO}`);
}

main().catch(console.error);
