// Importador planilha (Google Sheets, somente leitura) -> Supabase.
// Uso: node --env-file=.env.local scripts/importar-planilha.mjs
// Reimportável: limpa e recarrega lançamentos e viagens; cadastros usam upsert.
import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

const SPREADSHEET_ID = '1oyOo2Y5HXTEN_8LhW9ekMNRBssCxZ5uyCFFQnB9Z1PM';
const KEY_FILE = process.env.GOOGLE_KEY_FILE || '../nnos-dashboard-9e61e1181de1.json';
const ANO = 2026;
const MESES = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const auth = new GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const client = await auth.getClient();
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

async function ler(aba, range) {
  const r = encodeURIComponent(`'${aba}'!${range}`);
  const { data } = await client.request({ url: `${base}/values/${r}?valueRenderOption=UNFORMATTED_VALUE` });
  return data.values ?? [];
}

// ---------- utilitários ----------
const txt = (v) => (v == null ? '' : String(v).trim());
const up = (v) => txt(v).toUpperCase().replace(/\s+/g, ' ');
const num = (v) => {
  if (typeof v === 'number') return v;
  const s = txt(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const data = (v) => {
  if (typeof v !== 'number') return null;
  return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
};
const check = (r) => { if (r.error) throw new Error(`${r.error.message} (${r.error.details ?? ''})`); return r.data; };
async function inserirLotes(tabela, linhas, tam = 500) {
  for (let i = 0; i < linhas.length; i += tam) check(await sb.from(tabela).insert(linhas.slice(i, i + tam)));
}

// ---------- 1. Centros de custo, áreas, líderes, projetos ----------
console.log('Lendo Centro de Custo...');
const cc = (await ler('Centro de Custo', 'A2:F1000')).filter((r) => txt(r[1]) && txt(r[2]));
const nomesArea = [...new Set(cc.map((r) => up(r[4])).filter(Boolean))];
const nomesLider = [...new Set(cc.map((r) => up(r[5])).filter(Boolean))];
check(await sb.from('areas').upsert(nomesArea.map((nome) => ({ nome })), { onConflict: 'nome' }));
check(await sb.from('lideres').upsert(nomesLider.map((nome) => ({ nome })), { onConflict: 'nome' }));
const areaId = Object.fromEntries(check(await sb.from('areas').select('id,nome')).map((a) => [a.nome, a.id]));
const liderId = Object.fromEntries(check(await sb.from('lideres').select('id,nome')).map((a) => [a.nome, a.id]));

const ccPorCodigo = new Map();
for (const r of cc) {
  const codigo = txt(r[1]);
  if (!ccPorCodigo.has(codigo)) ccPorCodigo.set(codigo, {
    codigo, projeto: up(r[2]), contrato: txt(r[3]) || null,
    area_id: areaId[up(r[4])] ?? null, lider_id: liderId[up(r[5])] ?? null,
  });
}
check(await sb.from('centros_custo').upsert([...ccPorCodigo.values()], { onConflict: 'codigo' }));
const ccId = Object.fromEntries(check(await sb.from('centros_custo').select('id,codigo,projeto')).map((c) => [c.codigo, c.id]));

// Projeto -> primeiro centro de custo com esse nome (mesma regra do XLOOKUP da planilha)
const projCC = new Map();
for (const c of ccPorCodigo.values()) if (!projCC.has(c.projeto)) projCC.set(c.projeto, ccId[c.codigo]);

// ---------- 2. Consultores (tipo a partir da Tabela Preços, colunas P=sócios e Q=parceiros) ----------
console.log('Lendo listas de consultores...');
const listas = await ler('Tabela Preços', 'P2:Q200');
const socios = new Set(listas.map((r) => up(r[0])).filter(Boolean));
const parceiros = new Set(listas.map((r) => up(r[1])).filter(Boolean));

// ---------- 3. Meses ----------
const lancs = [];
const viagensRaw = [];
const projetosNovos = new Set();
const consultoresVistos = new Map();

for (let m = 0; m < 12; m++) {
  const aba = `Detalhado - ${MESES[m]}`;
  const linhas = (await ler(aba, 'A2:AF2000')).filter((r) => txt(r[1]));
  console.log(`${aba}: ${linhas.length} linhas`);
  const competencia = `${ANO}-${String(m + 1).padStart(2, '0')}-01`;
  linhas.forEach((r, idx) => {
    const projeto = up(r[1]);
    if (!projCC.has(projeto)) projetosNovos.add(projeto);
    const instrutor = up(r[8]);
    if (instrutor) {
      const fornecedor = instrutor === 'FORNECEDOR';
      const tipo = fornecedor ? 'parceiro' : socios.has(instrutor) ? 'socio' : parceiros.has(instrutor) ? 'parceiro' : 'funcionario';
      consultoresVistos.set(instrutor, { nome: instrutor, tipo, fornecedor, inferido: !fornecedor && !socios.has(instrutor) && !parceiros.has(instrutor) });
    }
    const custoBruto = r[14];
    lancs.push({
      _key: `${m}-${idx}`,
      competencia, projeto, instrutor,
      atividade: txt(r[2]) || null,
      modalidade: up(r[3]) === 'PRESENCIAL' ? 'PRESENCIAL' : up(r[3]) === 'VIRTUAL' ? 'VIRTUAL' : null,
      local: txt(r[4]) || null,
      regiao: up(r[5]) === 'LATAM' ? 'LATAM' : 'BRA',
      data_inicial: data(r[6]), data_final: data(r[7]),
      perfil: txt(r[9]) || null, horas: num(r[10]),
      faturar: num(r[12]), repasse: num(r[13]),
      custo_consultor: typeof custoBruto === 'number' ? custoBruto : null,
      logistica: num(r[16]),
      status: txt(r[17]) || null,
      precisa_logistica: up(r[18]) === 'SIM' ? true : up(r[18]) === 'NAO' || up(r[18]) === 'NÃO' ? false : null,
    });
    const custos = [20, 21, 22, 23, 24].map((i) => num(r[i]) ?? 0);
    if (custos.some((c) => c !== 0) || txt(r[19])) {
      viagensRaw.push({ _key: `${m}-${idx}`, agencia: txt(r[19]) || null,
        custo_1: custos[0], custo_2: custos[1], custo_3: custos[2], custo_4: custos[3], custo_5: custos[4],
        observacao_agencia: txt(r[27]) || null });
    }
  });
}

// projetos novos (não listados em Centro de Custo)
if (projetosNovos.size) console.warn('Projetos sem Centro de Custo:', [...projetosNovos]);
const todosProjetos = new Set([...projCC.keys(), ...projetosNovos]);
check(await sb.from('projetos').upsert(
  [...todosProjetos].map((nome) => ({ nome, centro_custo_id: projCC.get(nome) ?? null })), { onConflict: 'nome' }));
const projetoId = Object.fromEntries(check(await sb.from('projetos').select('id,nome')).map((p) => [p.nome, p.id]));

check(await sb.from('consultores').upsert(
  [...consultoresVistos.values()].map(({ nome, tipo, fornecedor }) => ({ nome, tipo, fornecedor })), { onConflict: 'nome' }));
const consultorId = Object.fromEntries(check(await sb.from('consultores').select('id,nome')).map((c) => [c.nome, c.id]));

// ---------- 4. Carga de lançamentos (limpa e recarrega) ----------
console.log('Limpando lançamentos anteriores...');
check(await sb.from('lancamentos').delete().gte('competencia', `${ANO}-01-01`).lte('competencia', `${ANO}-12-31`));

const paraInserir = lancs.map(({ _key, projeto, instrutor, ...l }) => ({
  ...l, projeto_id: projetoId[projeto], consultor_id: instrutor ? consultorId[instrutor] : null,
}));
console.log(`Inserindo ${paraInserir.length} lançamentos...`);
const idsPorOrdem = [];
for (let i = 0; i < paraInserir.length; i += 500) {
  const ins = check(await sb.from('lancamentos').insert(paraInserir.slice(i, i + 500)).select('id'));
  idsPorOrdem.push(...ins.map((x) => x.id));   // a ordem do retorno acompanha a do envio
}
const idPorKey = new Map(lancs.map((l, i) => [l._key, idsPorOrdem[i]]));
await inserirLotes('viagens', viagensRaw.map(({ _key, ...v }) => ({ ...v, lancamento_id: idPorKey.get(_key) })));

// ---------- 5. Resumo ----------
const soma = (k) => lancs.reduce((s, l) => s + (l[k] ?? 0), 0);
console.log('\n=== RESUMO ===');
console.log('Centros de custo:', ccPorCodigo.size, '| Áreas:', nomesArea.length, '| Líderes:', nomesLider.length);
console.log('Projetos:', todosProjetos.size, '| Consultores:', consultoresVistos.size, '| Viagens:', viagensRaw.length);
console.log('Lançamentos:', lancs.length);
console.log('Faturar total   :', soma('faturar').toFixed(2));
console.log('Consultor total :', soma('custo_consultor').toFixed(2));
console.log('Logística total :', soma('logistica').toFixed(2));
const revisar = [...consultoresVistos.values()].filter((c) => c.inferido).map((c) => c.nome);
console.log(`\nConsultores sem tipo definido na Tabela Preços (assumidos como funcionário), revisar: ${revisar.length}`);
console.log(revisar.join(' | '));
