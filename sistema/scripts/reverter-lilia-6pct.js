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

async function reverterLiliaOliveira() {
  console.log('Buscando lançamentos de Lilia Oliveira em 2026 para reverter o acréscimo de 6%...');
  const todos = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('lancamentos')
      .select('id, atividade, consultor_id, consultores(nome), custo_consultor, horas')
      .gte('competencia', '2026-01-01')
      .lte('competencia', '2026-12-31')
      .range(from, from + 999);
    if (error) { console.error('Erro na busca:', error); return; }
    todos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const paraReverter = [];
  let totalReducao = 0;

  for (const l of todos) {
    const cons = (l.consultores?.nome || '').toUpperCase().trim();
    const ativ = (l.atividade || '').toUpperCase().trim();

    if (cons.includes('LILIA OLIVEIRA') && !ativ.includes('COMISS') && !ativ.includes('COMISSÃO')) {
      const vAtual = Number(l.custo_consultor) || 0;
      if (vAtual > 0) {
        // vOrig = vAtual / 1.06
        const vOriginal = Math.round((vAtual / 1.06) * 100) / 100;
        const diff = vAtual - vOriginal;
        if (diff > 0) {
          totalReducao += diff;
          paraReverter.push({
            id: l.id,
            vAtual,
            vOriginal,
            diff,
          });
        }
      }
    }
  }

  console.log(`Lançamentos de Lilia Oliveira a reverter: ${paraReverter.length}`);
  console.log(`Total a ser reduzido do custo: R$ ${totalReducao.toFixed(2)}`);

  let concluidos = 0;
  for (let i = 0; i < paraReverter.length; i += 50) {
    const batch = paraReverter.slice(i, i + 50);
    for (const item of batch) {
      const { error } = await supabase
        .from('lancamentos')
        .update({ custo_consultor: item.vOriginal })
        .eq('id', item.id);
      if (error) {
        console.error(`Erro ao atualizar id ${item.id}:`, error);
      } else {
        concluidos++;
      }
    }
  }

  console.log(`Sucesso: ${concluidos} lançamentos de Lilia Oliveira revertidos com sucesso.`);
}

reverterLiliaOliveira();
