import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const SUPABASE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
const SPREADSHEET_ID = '1oyOo2Y5HXTEN_8LhW9ekMNRBssCxZ5uyCFFQnB9Z1PM';
const KEY_FILE = '../nnos-dashboard-9e61e1181de1.json';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const auth = new GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const client = await auth.getClient();
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

function formatarND(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === '-' || s === '—') return null;
  // Se for puramente dígitos, preenche com 4 dígitos (ex: 855 -> 0855)
  if (/^\d+$/.test(s)) {
    return s.padStart(4, '0');
  }
  return s;
}

console.log('--- Sincronizando Notas de Débito (ND Agência e ND Consultor) ---');

// Limpar notas de debito atuais
const { error: errDel } = await sb.from('notas_debito').delete().neq('id', '00000000-0000-0000-0000-000000000000');
if (errDel) console.warn('Aviso ao limpar notas_debito:', errDel.message);

let totalInseridos = 0;

for (let m = 0; m < 12; m++) {
  const nomeMes = MESES[m];
  const competencia = `2026-${String(m + 1).padStart(2, '0')}-01`;
  const range = encodeURIComponent(`'Detalhado - ${nomeMes}'!A2:AF2000`);
  
  const { data } = await client.request({ url: `${base}/values/${range}?valueRenderOption=UNFORMATTED_VALUE` });
  const rows = (data.values || []).filter(r => r && r[1] && String(r[1]).trim());
  
  // Buscar lancamentos dessa competencia no Supabase ordenados por id/data
  const { data: dbLancs } = await sb
    .from('lancamentos')
    .select('id, atividade, data_inicial, projetos(nome)')
    .eq('competencia', competencia)
    .order('data_inicial', { ascending: true, nullsFirst: false });

  // Criar mapa de lancamentos por (projeto + atividade + data_inicial)
  const poolPorChave = new Map();
  for (const l of dbLancs || []) {
    const k = `${l.projetos?.nome || ''}__${(l.atividade || '').trim().toUpperCase()}__${l.data_inicial || ''}`;
    if (!poolPorChave.has(k)) poolPorChave.set(k, []);
    poolPorChave.get(k).push(l.id);
  }

  const notasParaInserir = [];

  for (const row of rows) {
    const projNome = (row[1] || '').toString().trim().toUpperCase();
    const ativNome = (row[2] || '').toString().trim().toUpperCase();
    
    // Converter data serial do Excel se houver
    let dt = null;
    if (typeof row[6] === 'number') {
      dt = new Date(Date.UTC(1899, 11, 30) + row[6] * 86400000).toISOString().slice(0, 10);
    }
    const k = `${projNome}__${ativNome}__${dt || ''}`;
    const ids = poolPorChave.get(k);
    const lancId = ids && ids.length > 0 ? ids.shift() : null;

    if (!lancId) continue;

    // Regra de negócio: "quando não tem logística como é o exemplo do print, os campos ND Agência e ND Consultor deveriam estar vazios."
    const precisaLog = (row[18] || '').toString().trim().toUpperCase() === 'SIM';
    const custosViagem = [20, 21, 22, 23, 24].reduce((acc, colIdx) => {
      const v = row[colIdx];
      const n = typeof v === 'number' ? v : parseFloat(String(v || '0').replace(/\./g, '').replace(',', '.'));
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);

    const temLogistica = precisaLog || custosViagem > 0;

    if (!temLogistica) {
      // NÃO tem logística: NDs devem ficar vazias!
      continue;
    }

    const ndAgencia = formatarND(row[28]);
    const ndConsultor = formatarND(row[29]);

    if (ndAgencia) {
      notasParaInserir.push({
        lancamento_id: lancId,
        destino: 'agencia',
        numero: ndAgencia,
        valor: null
      });
    }
    if (ndConsultor) {
      notasParaInserir.push({
        lancamento_id: lancId,
        destino: 'consultor',
        numero: ndConsultor,
        valor: null
      });
    }
  }

  if (notasParaInserir.length > 0) {
    const { error: insErr } = await sb.from('notas_debito').insert(notasParaInserir);
    if (insErr) {
      console.error(`Erro inserindo notas em ${nomeMes}:`, insErr.message);
    } else {
      totalInseridos += notasParaInserir.length;
      console.log(`${nomeMes}: ${notasParaInserir.length} notas de débito inseridas com sucesso.`);
    }
  } else {
    console.log(`${nomeMes}: nenhuma nota vinculada.`);
  }
}

console.log(`--- Sincronização Concluída! Total de notas registradas: ${totalInseridos} ---`);
