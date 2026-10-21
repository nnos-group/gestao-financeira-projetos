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

const socios = [
  'LILIA OLIVEIRA', 'KARLA GOMES', 'PEDRO COLARES', 'FELIPE CAMPOS',
  'CLEIVSON VIEIRA', 'ANTONIO PEREZ', 'DOLORES LITZA', 'GABRIEL GOES',
  'JAYZA RODRIGUES', 'JEFFERSON SOUZA'
];

async function executarAtualizacao() {
  console.log('Iniciando busca de lancamentos de socios para 2026...');
  const todos = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('lancamentos')
      .select('id, atividade, consultor_id, consultores(nome), custo_consultor, horas, faturar')
      .gte('competencia', '2026-01-01')
      .lte('competencia', '2026-12-31')
      .range(from, from + 999);
    if (error) { console.error('Erro na busca:', error); return; }
    todos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const paraAtualizar = [];
  let custoOriginalTotal = 0;
  let custoNovoTotal = 0;

  for (const l of todos) {
    const cons = (l.consultores?.nome || '').toUpperCase().trim();
    const ativ = (l.atividade || '').toUpperCase().trim();
    const isSocio = socios.some(s => cons.includes(s));

    if (isSocio && !ativ.includes('COMISS') && !ativ.includes('COMISSÃO')) {
      const custoAtual = Number(l.custo_consultor) || 0;
      if (custoAtual > 0) {
        const novoCusto = Math.round(custoAtual * 1.06 * 100) / 100;
        custoOriginalTotal += custoAtual;
        custoNovoTotal += novoCusto;
        paraAtualizar.push({
          id: l.id,
          custoAtual,
          novoCusto,
        });
      }
    }
  }

  console.log(`Lançamentos elegíveis para o acréscimo de 6%: ${paraAtualizar.length}`);
  console.log(`Custo Original: R$ ${custoOriginalTotal.toFixed(2)}`);
  console.log(`Custo Novo (+6%): R$ ${custoNovoTotal.toFixed(2)}`);
  console.log(`Diferença (+6% NF): R$ ${(custoNovoTotal - custoOriginalTotal).toFixed(2)}`);

  console.log('Executando updates em lote de 50 no Supabase...');
  let atualizados = 0;
  for (let i = 0; i < paraAtualizar.length; i += 50) {
    const batch = paraAtualizar.slice(i, i + 50);
    for (const item of batch) {
      const { error } = await supabase
        .from('lancamentos')
        .update({ custo_consultor: item.novoCusto })
        .eq('id', item.id);
      if (error) {
        console.error(`Erro ao atualizar id ${item.id}:`, error);
      } else {
        atualizados++;
      }
    }
  }

  console.log(`Sucesso: ${atualizados} lançamentos atualizados com o acréscimo de +6% de NF.`);
}

executarAtualizacao();
