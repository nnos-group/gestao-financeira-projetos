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
    const { data, error } = await supabase
      .from('lancamentos')
      .select('id, atividade, consultor_id, consultores(nome), custo_consultor, horas, faturar, repasse, projetos(centros_custo(codigo, areas(nome)))')
      .gte('competencia', '2026-01-01')
      .lte('competencia', '2026-12-31')
      .range(from, from + 999);
    if (error) { console.error(error); return; }
    todos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  console.log('Total lancamentos 2026:', todos.length);
  
  const socios = [
    'LILIA OLIVEIRA', 'KARLA GOMES', 'PEDRO COLARES', 'FELIPE CAMPOS',
    'CLEIVSON VIEIRA', 'ANTONIO PEREZ', 'DOLORES LITZA', 'GABRIEL GOES',
    'JAYZA RODRIGUES', 'JEFFERSON SOUZA'
  ];
  
  let totalCustoAtual = 0;
  let totalCustoCom6PctSocios = 0;
  let diff6Pct = 0;
  let countSocios = 0;
  let countSociosComissao = 0;
  let custoTotalSocios = 0;
  
  for (const l of todos) {
    const custo = Number(l.custo_consultor) || 0;
    totalCustoAtual += custo;
    const cons = (l.consultores?.nome || '').toUpperCase().trim();
    const ativ = (l.atividade || '').toUpperCase().trim();
    const isSocio = socios.some(s => cons.includes(s));
    
    if (isSocio) {
      countSocios++;
      custoTotalSocios += custo;
      if (ativ.includes('COMISS') || ativ.includes('COMISSÃO')) {
        countSociosComissao++;
        totalCustoCom6PctSocios += custo;
      } else {
        const acrescimo = custo * 0.06;
        diff6Pct += acrescimo;
        totalCustoCom6PctSocios += (custo + acrescimo);
      }
    } else {
      totalCustoCom6PctSocios += custo;
    }
  }
  
  console.log('Total custo consultor atual:', totalCustoAtual.toFixed(2));
  console.log('Total custo socios:', custoTotalSocios.toFixed(2));
  console.log('Contagem lancamentos socios:', countSocios, 'com comissao:', countSociosComissao);
  console.log('Diferenca de 6% nos socios (sem comissao): R$', diff6Pct.toFixed(2));
  console.log('Diferenca entre sistema (-481.476) e planilha (-536.374): R$', (536374 - 481476).toFixed(2));
}

check();
