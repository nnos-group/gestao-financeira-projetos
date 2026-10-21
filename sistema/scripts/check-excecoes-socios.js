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
      .select('id, atividade, consultor_id, consultores(nome), custo_consultor, horas, faturar, competencia, projetos(nome, centros_custo(codigo, areas(nome)))')
      .gte('competencia', '2026-01-01')
      .lte('competencia', '2026-12-31')
      .range(from, from + 999);
    todos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const nomes = ['PEDRO COLARES', 'MARCELO LARA', 'PEDRO LAGE'];
  
  const sociosGerais = [
    'LILIA OLIVEIRA', 'KARLA GOMES', 'FELIPE CAMPOS',
    'CLEIVSON VIEIRA', 'ANTONIO PEREZ', 'DOLORES LITZA', 'GABRIEL GOES',
    'JAYZA RODRIGUES', 'JEFFERSON SOUZA'
  ];

  console.log('--- EXCEÇÕES INDICADAS PELO USUÁRIO (NÃO APLICAR 6%) ---');
  for (const n of nomes) {
    const regs = todos.filter(l => (l.consultores?.nome || '').toUpperCase().includes(n));
    const custoTot = regs.reduce((s, l) => s + (Number(l.custo_consultor) || 0), 0);
    console.log(`${n}: ${regs.length} lançamentos | Custo Total: R$ ${custoTot.toFixed(2)}`);
  }

  // Verificar quantos lançamentos de PEDRO COLARES têm valor de 6% adicionado
  const colaresRegs = todos.filter(l => (l.consultores?.nome || '').toUpperCase().includes('PEDRO COLARES'));
  let revertidosDiff = 0;
  const colaresParaReverter = [];
  colaresRegs.forEach(l => {
    const ativ = (l.atividade || '').toUpperCase();
    if (!ativ.includes('COMISS')) {
      const vAtual = Number(l.custo_consultor) || 0;
      // Quando multiplicamos por 1.06: vAtual = Math.round(vOrig * 1.06 * 100) / 100
      // Logo vOrig = Math.round((vAtual / 1.06) * 100) / 100
      const vOrig = Math.round((vAtual / 1.06) * 100) / 100;
      const diff = vAtual - vOrig;
      if (diff > 0) {
        revertidosDiff += diff;
        colaresParaReverter.push({ id: l.id, vAtual, vOrig, diff });
      }
    }
  });

  console.log(`\nPedro Colares: ${colaresParaReverter.length} lançamentos para reverter os 6%.`);
  console.log(`Diferença a reduzir em Pedro Colares: R$ ${revertidosDiff.toFixed(2)}`);

  console.log('\n--- DEMAIS SÓCIOS QUE PERMANECEM COM 6% ---');
  let custoOutrosSocios = 0;
  let countOutrosSocios = 0;
  sociosGerais.forEach(s => {
    const regs = todos.filter(l => (l.consultores?.nome || '').toUpperCase().includes(s));
    const tot = regs.reduce((acc, l) => acc + (Number(l.custo_consultor) || 0), 0);
    custoOutrosSocios += tot;
    countOutrosSocios += regs.length;
    console.log(`${s}: ${regs.length} lançamentos | Custo Total: R$ ${tot.toFixed(2)}`);
  });
  console.log(`Total Outros Sócios: ${countOutrosSocios} lançamentos | R$ ${custoOutrosSocios.toFixed(2)}`);
}

check();
