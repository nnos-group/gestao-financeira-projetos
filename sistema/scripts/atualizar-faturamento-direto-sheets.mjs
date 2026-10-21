import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const SPREADSHEET_ID = '1oyOo2Y5HXTEN_8LhW9ekMNRBssCxZ5uyCFFQnB9Z1PM';
const KEY_FILE = '../nnos-dashboard-9e61e1181de1.json';

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const client = await auth.getClient();
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

function formatData(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    const dia = String(d.getUTCDate()).padStart(2, '0');
    const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
    const ano = d.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  return String(v).trim();
}

console.log('Buscando FATURAMENTO atualizado da planilha Google Sheets...');
const range = encodeURIComponent("'FATURAMENTO'!A5:N3000");
const res = await client.request({
  url: `${base}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
});

const rows = res.data.values || [];
const dataRows = rows.slice(1); // Ignora linha de cabeçalho

const faturamentoDados = [];

dataRows.forEach((row, idx) => {
  if (!row || row.length === 0 || !row[0]) return;

  const valRaw = row[5];
  let valorNum = 0;
  if (typeof valRaw === 'number') {
    valorNum = valRaw;
  } else if (valRaw) {
    valorNum = parseFloat(String(valRaw).replace(/\./g, '').replace(',', '.')) || 0;
  }

  const numNotaStr = row[4] != null ? String(row[4]).trim() : '';

    const poLimpo = (row[6] != null && String(row[6]).trim() !== 'A DEFINIR' && String(row[6]).trim() !== 'undefined') ? String(row[6]).trim() : '';
    const vencFmt = formatData(row[8]);
    const pagtoFmt = formatData(row[9]);
    const statusFmt = String(row[7] || 'Pendente').trim();

    // Cálculo dinâmico do fluxo de pagamento caso esteja pago
    let diasNum = parseInt(String(row[10] || '0'), 10) || 0;
    let pagtoDesc = String(row[11] || '').trim();

    if ((statusFmt.toLowerCase() === 'pago' || pagtoFmt) && vencFmt && pagtoFmt) {
      const pV = vencFmt.split('/');
      const pP = pagtoFmt.split('/');
      if (pV.length === 3 && pP.length === 3) {
        const dV = new Date(parseInt(pV[2], 10), parseInt(pV[1], 10) - 1, parseInt(pV[0], 10));
        const dP = new Date(parseInt(pP[2], 10), parseInt(pP[1], 10) - 1, parseInt(pP[0], 10));
        const diff = Math.round((dP.getTime() - dV.getTime()) / (1000 * 60 * 60 * 24));
        diasNum = diff;
        if (diff < 0) {
          pagtoDesc = `${Math.abs(diff)} dias adiantado`;
        } else if (diff > 0) {
          pagtoDesc = `${diff} dias em atraso`;
        } else {
          pagtoDesc = 'Pago no prazo';
        }
      }
    }

    faturamentoDados.push({
      id: `fat-${idx + 1}`,
      realizado: String(row[0] || '').trim(),
      faturado: String(row[1] || '').trim(),
      projeto: String(row[2] || '').trim(),
      perfil: String(row[3] || '').trim(),
      numeroNota: numNotaStr,
      valor: valorNum,
      valorFormatado: valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      pedidoCompras: poLimpo,
      status: statusFmt,
      vencimento: vencFmt,
      dataPagto: pagtoFmt,
      dias: diasNum,
      pagtoDescricao: pagtoDesc,
      centroCusto: String(row[12] || '').trim(),
      area: String(row[13] || '').trim(),
    });
});

const dest = path.resolve('src/lib/faturamento-base.json');
fs.writeFileSync(dest, JSON.stringify(faturamentoDados, null, 2), 'utf-8');
console.log(`FATURAMENTO atualizado com sucesso! Total de faturas salvas: ${faturamentoDados.length}`);

const totalLog = faturamentoDados.filter((f) => f.perfil.toUpperCase().includes('LOG'));
console.log(`Total de NDs de Logística disponíveis: ${totalLog.length}`);
