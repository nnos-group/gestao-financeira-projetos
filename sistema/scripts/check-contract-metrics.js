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

const tab = JSON.parse(fs.readFileSync('src/lib/tabela-precos.json', 'utf8'));
const cnh = tab.contratos.find(c => c.id === 'contrato-cnh');
const ccs = new Set(cnh.centrosDeCusto);

async function run() {
  const todos = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('lancamentos')
      .select('horas, faturar, repasse, custo_consultor, projetos(centros_custo(codigo))')
      .gte('competencia', '2026-01-01')
      .lte('competencia', '2026-12-31')
      .range(from, from + 999);
    todos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  
  let horasTotal = 0;
  let faturarTotal = 0;
  let custoTotal = 0;
  let countLancs = 0;
  
  todos.forEach(l => {
    const cod = l.projetos?.centros_custo?.codigo;
    if (ccs.has(cod)) {
      countLancs++;
      horasTotal += Number(l.horas) || 0;
      faturarTotal += Number(l.faturar) || 0;
      custoTotal += Number(l.custo_consultor) || 0;
    }
  });
  
  console.log('CNH Industrial em Lancamentos 2026:');
  console.log('Lancamentos vinculados:', countLancs);
  console.log('Horas Totais:', horasTotal.toFixed(0), 'h (', (horasTotal/8).toFixed(0), 'dias)');
  console.log('Total Previsto a Faturar: R$', faturarTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  console.log('Total Custo Consultor: R$', custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
}

run();
