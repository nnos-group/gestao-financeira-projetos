const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.trim().split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const todos = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('lancamentos')
      .select('id, atividade, consultor_id, consultores(nome), custo_consultor, horas')
      .gte('competencia', '2026-01-01')
      .lte('competencia', '2026-12-31')
      .range(from, from + 999);
    todos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const liliaRegs = todos.filter(l => (l.consultores?.nome || '').toUpperCase().includes('LILIA OLIVEIRA'));
  console.log('Lilia Oliveira: lancamentos totais em 2026:', liliaRegs.length);
  
  let totalCusto = 0;
  let totalDiff6 = 0;
  const paraReverter = [];

  liliaRegs.forEach(l => {
    const ativ = (l.atividade || '').toUpperCase();
    const vAtual = Number(l.custo_consultor) || 0;
    totalCusto += vAtual;
    if (vAtual > 0 && !ativ.includes('COMISS')) {
      const vOrig = Math.round((vAtual / 1.06) * 100) / 100;
      const diff = vAtual - vOrig;
      if (diff > 0) {
        totalDiff6 += diff;
        paraReverter.push({ id: l.id, vAtual, vOrig, diff });
      }
    }
  });

  console.log('Custo Total Atual Lilia:', totalCusto.toFixed(2));
  console.log('Lancamentos para reverter:', paraReverter.length);
  console.log('Total de 6% a reverter:', totalDiff6.toFixed(2));
}

check();
