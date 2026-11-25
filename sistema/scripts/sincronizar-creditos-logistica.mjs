import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SPREADSHEET_ID = '1oyOo2Y5HXTEN_8LhW9ekMNRBssCxZ5uyCFFQnB9Z1PM';
const KEY_FILE = '../nnos-dashboard-9e61e1181de1.json';

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const client = await auth.getClient();
const r = encodeURIComponent("'Logística - Controle Crédito'!A2:M200");
const { data } = await client.request({
  url: `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${r}?valueRenderOption=UNFORMATTED_VALUE`,
});

const rows = (data.values || []).filter((row) => row && (row[0] || row[3]));
const dt = (v) =>
  typeof v === 'number'
    ? new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10)
    : v
    ? String(v).trim()
    : '';
const num = (v) =>
  typeof v === 'number'
    ? Math.round(v * 100) / 100
    : parseFloat(String(v || '0').replace(/\./g, '').replace(',', '.')) || 0;

const items = rows.map((row, i) => ({
  id: 'cred-' + String(i + 1).padStart(3, '0'),
  projeto: String(row[0] || '').trim().toUpperCase(),
  dataInicial: dt(row[1]),
  dataFinal: dt(row[2]),
  instrutor: String(row[3] || '').trim().toUpperCase(),
  ciaAereaHotel: String(row[4] || '').trim().toUpperCase(),
  valor: num(row[5]),
  multaTaxa: num(row[6]),
  credito: num(row[7]),
  notaDebito:
    row[8] != null && String(row[8]).trim() !== ''
      ? /^\d{1,4}$/.test(String(row[8]).trim())
        ? String(row[8]).trim().padStart(4, '0')
        : String(row[8]).trim()
      : '',
  creditoUtilizado: String(row[9] || '').trim().toUpperCase() === 'SIM' ? 'SIM' : 'NÃO',
  projetoUtilizado: String(row[10] || '').trim().toUpperCase(),
  dataInicialUtilizacao: dt(row[11]),
  dataFinalUtilizacao: dt(row[12]),
  observacoes: '',
  atualizadoEm: new Date().toISOString(),
  atualizadoPor: 'Planilha Oficial',
}));

fs.writeFileSync('src/lib/viagens-creditos-base.json', JSON.stringify(items, null, 2), 'utf-8');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
await sb
  .from('configuracoes')
  .upsert({ chave: 'viagens_controle_creditos_v1', descricao: JSON.stringify(items) }, { onConflict: 'chave' });

console.log(`Créditos de logística sincronizados com sucesso: ${items.length} registros.`);
