const SUPABASE_URL = "https://kqptrhxhoaxyyvgjevoq.supabase.co";
const SERVICE_KEY = "sb_secret_ON-dh_5cb-5GOZhR5dJpnQ_tFVWq4fG";

async function query() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lancamentos?select=id,atividade,consultor,custo_consultor,repasse,faturar,projetos(nome),viagens(custo_5)&order=id.asc`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`
    }
  });
  const data = await res.json();
  
  console.log(`Total lancamentos: ${data.length}`);
  
  // Vamos filtrar lancamentos onde custo_consultor e repasse sao iguais ou custo_consultor tem valor de diária/repasse
  const casos = data.filter(d => {
    return (d.custo_consultor && d.custo_consultor > 0) || (d.repasse && d.repasse > 0);
  });
  
  console.log(`Lancamentos com custo_consultor ou repasse: ${casos.length}`);
  for (const c of casos) {
    console.log(`ID: ${c.id} | Projeto: ${c.projetos?.nome} | Atividade: ${c.atividade} | Consultor: ${c.consultor} | CustoConsultor: ${c.custo_consultor} | Repasse: ${c.repasse} | DiariaViagem: ${c.viagens?.[0]?.custo_5}`);
  }
}

query().catch(console.error);
