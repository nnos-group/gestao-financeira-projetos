const { createClient } = require('@supabase/supabase-js');
const url = 'https://kqptrhxhoaxyyvgjevoq.supabase.co';
const key = 'sb_secret_ON-dh_5cb-5GOZhR5dJpnQ_tFVWq4fG';
const supabase = createClient(url, key);

async function testFetch(consultorNome, ano, mesNum) {
  const compStr = `${ano}-${String(mesNum).padStart(2, '0')}-01`;
  
  // Find consultor
  const { data: cList } = await supabase.from('consultores').select('id, nome');
  const matched = (cList || []).find(c => {
    const n = (c.nome || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const q = (consultorNome || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return n === q || n.includes(q) || q.includes(n);
  });
  
  console.log('Matched consultor:', matched);
  if (!matched) return;
  
  // Find lancamentos for this competencia
  const { data: lancs, error } = await supabase
    .from('lancamentos')
    .select('id, competencia, atividade, horas, custo_consultor, repasse, projetos(nome)')
    .eq('consultor_id', matched.id)
    .eq('competencia', compStr);
    
  console.log(`Lancamentos for ${compStr} count:`, lancs ? lancs.length : 0);
  console.log(lancs);
  
  // Find all competencias for this consultor
  const { data: allComp } = await supabase
    .from('lancamentos')
    .select('competencia')
    .eq('consultor_id', matched.id);
  const comps = [...new Set((allComp || []).map(l => l.competencia))].sort();
  console.log(`All competencias for ${matched.nome}:`, comps);
}

testFetch('TIAGO ANGELO', 2026, 9);
