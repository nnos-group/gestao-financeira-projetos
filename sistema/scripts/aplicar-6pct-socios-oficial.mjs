import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SPREADSHEET_ID = '1oyOo2Y5HXTEN_8LhW9ekMNRBssCxZ5uyCFFQnB9Z1PM';
const KEY_FILE = path.join(process.cwd(), 'nnos-dashboard-9e61e1181de1.json');
const ANO = 2026;
const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

const envFile = fs.readFileSync(path.join(process.cwd(), 'sistema', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.trim().split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const client = await auth.getClient();
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

async function ler(aba, range) {
  const r = encodeURIComponent(`'${aba}'!${range}`);
  const { data } = await client.request({ url: `${base}/values/${r}?valueRenderOption=UNFORMATTED_VALUE` });
  return data.values ?? [];
}

const txt = (v) => (v == null ? '' : String(v).trim());
const up = (v) => txt(v).toUpperCase().replace(/\s+/g, ' ');
const num = (v) => {
  if (typeof v === 'number') return v;
  const s = txt(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const dataConv = (v) => {
  if (typeof v !== 'number') return null;
  return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
};

const excecoes = ['MARCELO LARA', 'PEDRO LAGE', 'PEDRO COLARES'];
function ehComissao(ativ) {
  if (!ativ) return false;
  const a = ativ.toUpperCase();
  return a.includes('COMISSÃO') || a.includes('COMISSAO');
}
function ehExcecao(nome) {
  if (!nome) return false;
  const n = nome.toUpperCase();
  return excecoes.some((ex) => n.includes(ex));
}

async function executar() {
  console.log('1. Lendo lista de sócios e parceiros de Tabela Preços...');
  const listas = await ler('Tabela Preços', 'P2:Q200');
  const sociosSheet = new Set(listas.map((r) => up(r[0])).filter(Boolean));
  
  // Garantir todos os sócios oficiais reconhecidos
  const sociosOficiais = new Set([
    ...sociosSheet,
    'ELIZA FORTUNA', 'FELIPE CAMPOS', 'CLEIVSON VIEIRA', 'ANTONIO PEREZ',
    'DOLORES LITZA', 'CLORISVALDO DOURADO', 'GIBA - JOÃO GILBERTO', 'GABRIEL GOES',
    'MARISTELA GARCIA', 'JEFFERSON SOUZA', 'LEONARDO CAMPOS', 'BEATRIZ PICORELLI',
    'KARLA GOMES', 'JAYZA RODRIGUES'
  ]);

  console.log('Sócios oficiais considerados:', [...sociosOficiais]);

  // Atualizar também na tabela consultores o tipo = 'socio' se necessário
  console.log('2. Atualizando tipo de consultores no Supabase...');
  for (const socioNome of sociosOficiais) {
    await sb.from('consultores').update({ tipo: 'socio' }).ilike('nome', `%${socioNome}%`);
  }

  // 3. Buscar todos os lançamentos do Supabase de 2026 com ID, competencia, data_inicial, atividade, consultor
  console.log('3. Carregando lançamentos existentes do Supabase...');
  const lancamentosSupabase = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('lancamentos')
      .select('id, competencia, data_inicial, atividade, custo_consultor, horas, faturar, consultor_id, consultores(id, nome, tipo)')
      .gte('competencia', `${ANO}-01-01`)
      .lte('competencia', `${ANO}-12-31`)
      .range(from, from + 999);
    if (error) { console.error('Erro ao buscar lançamentos:', error); return; }
    lancamentosSupabase.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  console.log(`Lançamentos no Supabase: ${lancamentosSupabase.length}`);

  // 4. Ler cada mês da planilha e correlacionar com o Supabase
  console.log('4. Lendo abas mensais da planilha e calculando +6%...');
  const atualizacoes = [];
  let totalAcrescimo = 0;

  for (let m = 0; m < 12; m++) {
    const aba = `Detalhado - ${MESES[m]}`;
    const linhas = (await ler(aba, 'A2:AF2000')).filter((r) => txt(r[1]));
    const competencia = `${ANO}-${String(m + 1).padStart(2, '0')}-01`;

    linhas.forEach((r) => {
      const instrutor = up(r[8]);
      const atividade = txt(r[2]);
      const dataIni = dataConv(r[6]);
      const horasVal = num(r[10]);
      const faturarVal = num(r[12]);
      const custoBruto = num(r[14]);

      if (!instrutor || custoBruto == null || custoBruto <= 0) return;

      const isSocio = sociosOficiais.has(instrutor) || [...sociosOficiais].some(s => instrutor.includes(s));
      const comissao = ehComissao(atividade);
      const excecao = ehExcecao(instrutor);

      if (isSocio && !comissao && !excecao) {
        const custoCalculado = Math.round(custoBruto * 1.06 * 100) / 100;
        
        // Localizar lançamento correspondente no Supabase
        const correspondente = lancamentosSupabase.find((l) => {
          if (l.competencia !== competencia) return false;
          const consNome = up(l.consultores?.nome || '');
          if (!consNome.includes(instrutor) && !instrutor.includes(consNome)) return false;
          if (dataIni && l.data_inicial !== dataIni) return false;
          if (atividade && l.atividade && up(l.atividade) !== up(atividade)) return false;
          return true;
        });

        if (correspondente) {
          const custoAtual = Number(correspondente.custo_consultor) || 0;
          if (Math.abs(custoAtual - custoCalculado) > 0.01) {
            atualizacoes.push({
              id: correspondente.id,
              instrutor,
              atividade,
              competencia,
              custoBasePlanilha: custoBruto,
              custoAtualSupabase: custoAtual,
              novoCustoCom6Pct: custoCalculado,
            });
            totalAcrescimo += (custoCalculado - custoBruto);
          }
        }
      }
    });
  }

  console.log(`\nTotal de lançamentos de sócios a recalcular (+6%): ${atualizacoes.length}`);
  console.log(`Diferença total de acréscimo (+6% NF Sócio): R$ ${totalAcrescimo.toFixed(2)}`);

  console.log('\nExemplos de atualizações preparadas:');
  atualizacoes.slice(0, 10).forEach((a) => {
    console.log(`- [${a.competencia}] ${a.instrutor} | ${a.atividade} | Base: R$ ${a.custoBasePlanilha} -> De R$ ${a.custoAtualSupabase} para R$ ${a.novoCustoCom6Pct}`);
  });

  // Executar updates em lote
  console.log('\nGravando novos valores com +6% no Supabase...');
  let sucessos = 0;
  for (let i = 0; i < atualizacoes.length; i += 20) {
    const lote = atualizacoes.slice(i, i + 20);
    await Promise.all(
      lote.map(async (item) => {
        const { error } = await sb
          .from('lancamentos')
          .update({ custo_consultor: item.novoCustoCom6Pct })
          .eq('id', item.id);
        if (error) {
          console.error(`Erro ao atualizar ID ${item.id}:`, error);
        } else {
          sucessos++;
        }
      })
    );
  }

  console.log(`\nFinalizado com sucesso: ${sucessos} lançamentos atualizados no Supabase com acréscimo de +6% de NF Sócio!`);
}

executar().catch(console.error);

