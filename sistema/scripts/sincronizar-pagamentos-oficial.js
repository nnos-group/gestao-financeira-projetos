const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const SPREADSHEET_ID = '1k4Iz4-AE5YrJImy_FrPg8tNB8uy5lHfim6d6ex0BjwM';
const KEY_FILE = path.join(__dirname, '../../nnos-dashboard-9e61e1181de1.json');
const DEST_JSON = path.join(__dirname, '../src/lib/pagamentos-base.json');

const MESES_VALIDOS = new Set([
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
]);

async function sincronizar() {
  console.log('Iniciando sincronização oficial de pagamentos...');
  const auth = new GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const client = await auth.getClient();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'PAGAMENTOS-26'!A1:K2000?valueRenderOption=FORMATTED_VALUE`;
  const res = await client.request({ url });
  const rows = res.data.values || [];

  console.log(`Lidas ${rows.length} linhas da aba PAGAMENTOS-26.`);

  // Identificar cabeçalho
  let headerIdx = -1;
  for (let i = 0; i < 15; i++) {
    if (rows[i] && rows[i].includes('REALIZADO') && rows[i].includes('CONSULTOR')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error('Cabeçalho de PAGAMENTOS-26 não encontrado.');
  }

  const pagamentos = [];
  let seq = 1;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0] || !r[2]) continue;

    const mesRaw = String(r[0]).trim().toUpperCase();
    if (!MESES_VALIDOS.has(mesRaw)) continue;

    const dataPagto = String(r[1] || '').trim();
    const consultor = String(r[2] || '').trim();
    const tipo = String(r[3] || 'PARCEIRO').trim().toUpperCase();
    const projeto = String(r[4] || '').trim();
    let numeroNota = String(r[5] || '').trim();
    if (numeroNota === '-' || numeroNota === '--' || !numeroNota) {
      numeroNota = '—';
    }

    const valorStr = String(r[6] || '0')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/\s+/g, '')
      .replace('R$', '');
    const valor = parseFloat(valorStr) || 0;

    let statusRaw = String(r[7] || 'Pago').trim();
    let status = statusRaw;
    if (statusRaw.toLowerCase().includes('aberto')) {
      status = 'A Pagar';
    } else if (statusRaw.toLowerCase().includes('cartão')) {
      status = 'Cartão Corporativo';
    } else if (statusRaw.toLowerCase().includes('pago')) {
      status = 'Pago';
    }

    const bm = String(r[8] || '').trim();
    const cc = String(r[9] || '').trim();
    const obs = String(r[10] || '').trim();

    // Derivação do tipo de despesa para análise analítica
    let tipoDespesa = 'Honorário / Prestação de Serviços';
    if (status === 'Cartão Corporativo' || (numeroNota && numeroNota.toUpperCase().includes('CARTÃO'))) {
      tipoDespesa = 'Cartão Corporativo';
    } else if (numeroNota.toUpperCase().includes('RDV') || obs.toUpperCase().includes('RDV')) {
      tipoDespesa = 'Relatório de Viagem (RDV)';
    } else if (tipo === 'SÓCIO' || obs.toUpperCase().includes('COTAS') || obs.toUpperCase().includes('PRÓ-LABORE')) {
      tipoDespesa = 'Acordo Societário / Pró-Labore';
    } else if (bm) {
      tipoDespesa = 'BM Homologado';
    }

    pagamentos.push({
      id: `pgto-26-${String(seq++).padStart(4, '0')}`,
      realizado: mesRaw,
      dataPagto,
      consultor,
      tipo,
      projeto,
      numeroNota,
      tipoDespesa,
      valor,
      status,
      bm,
      centroCusto: cc,
      observacoes: obs
    });
  }

  fs.writeFileSync(DEST_JSON, JSON.stringify(pagamentos, null, 2), 'utf8');
  console.log(`Sucesso: ${pagamentos.length} lançamentos salvos em ${DEST_JSON}`);

  // Resumo por mês
  const mesesResumo = {};
  const statusResumo = {};
  pagamentos.forEach(p => {
    if (!mesesResumo[p.realizado]) mesesResumo[p.realizado] = { count: 0, total: 0 };
    mesesResumo[p.realizado].count++;
    mesesResumo[p.realizado].total += p.valor;

    statusResumo[p.status] = (statusResumo[p.status] || 0) + 1;
  });

  console.log('\n--- CONCILIAÇÃO POR MÊS ---');
  Object.keys(mesesResumo).forEach(m => {
    console.log(`${m.padEnd(12)}: ${String(mesesResumo[m].count).padStart(3)} lançamentos | Total: R$ ${mesesResumo[m].total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  });

  console.log('\n--- DISTRIBUIÇÃO POR STATUS ---');
  console.log(statusResumo);
}

sincronizar().catch(err => {
  console.error('Erro na sincronização:', err);
  process.exit(1);
});
