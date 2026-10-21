const SUPABASE_URL = "https://kqptrhxhoaxyyvgjevoq.supabase.co";
const SERVICE_KEY = "sb_secret_ON-dh_5cb-5GOZhR5dJpnQ_tFVWq4fG";

async function run() {
  let all = [];
  let from = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/lancamentos?select=id,competencia,atividade,custo_consultor,repasse,faturar,viagens(total,custo_5)&order=id.asc&offset=${from}&limit=1000`;
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    const batch = await res.json();
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }
  console.log('Total registros no banco:', all.length);

  // Casos onde custo_consultor === repasse e > 0
  const iguais = all.filter(d => d.custo_consultor && d.repasse && d.custo_consultor === d.repasse);
  console.log('Casos onde custo_consultor === repasse:', iguais.length);
  for (const i of iguais) {
    console.log(i);
  }

  // Casos onde custo_consultor é igual ao valor da viagem/diária (custo_5 ou total)
  const confundiViagem = all.filter(d => {
    const v = d.viagens?.[0];
    if (!v) return false;
    return (d.custo_consultor && (d.custo_consultor === v.custo_5 || d.custo_consultor === v.total));
  });
  console.log('Casos onde custo_consultor coincide com viagem/diária:', confundiViagem.length);
  for (const c of confundiViagem) {
    console.log(c);
  }
}

run().catch(console.error);
