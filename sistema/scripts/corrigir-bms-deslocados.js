const fs = require('fs');
const path = require('path');
const { createClient } = require(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'));

const env = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf-8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    envVars[k] = v;
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const bmsPath = path.resolve(__dirname, '../src/lib/bms-2026.json');
const bms = JSON.parse(fs.readFileSync(bmsPath, 'utf-8'));

console.log('Iniciando correção cirúrgica dos BMs...');

// 1. BM 0882 - Alejandro Lapuente
const bm882 = bms.find(b => String(b.codigo) === '0882');
if (bm882) {
  bm882.totalHoras = 20.0;
  bm882.valorTotal = 2900.00;
  bm882.mediaHora = 145.00;
  bm882.atividades = [
    {
      projeto: "PARTS ACADEMY",
      atividade: "PRECISION SALES- VENTAS CONSULTIVAS EN AGRICULTURA DIGITAL",
      periodo: "07/09/2026 a 09/09/2026",
      dataInicial: "07/09/2026",
      dataFinal: "09/09/2026",
      horas: 20.0,
      valorHora: 145.00,
      valorTotal: 2900.00,
      rateioInterno: "63,42%"
    }
  ];
  console.log('BM 0882 corrigido com sucesso!');
}

// 2. BM 0697 - Eliza Rosa
const bm697 = bms.find(b => String(b.codigo) === '0697');
if (bm697 && bm697.atividades && bm697.atividades.length >= 2) {
  bm697.atividades[1] = {
    projeto: "EXCELÊNCIA EM SERVIÇOS IVECO",
    atividade: "IVECO MENTORIA 2 - 2º LUGAR EXCELÊNCIA EM VENDAS",
    periodo: "02/02/2026 a 27/02/2026",
    dataInicial: "02/02/2026",
    dataFinal: "27/02/2026",
    horas: 1.0,
    valorHora: 122.34,
    valorTotal: 122.34,
    rateioInterno: "0,00%"
  };
  bm697.totalHoras = 17.0;
  bm697.valorTotal = 2198.94;
  bm697.mediaHora = 129.35;
  console.log('BM 0697 corrigido com sucesso!');
}

// 3. BM 0678 - Fábio Canassa
const bm678 = bms.find(b => String(b.codigo) === '0678');
if (bm678 && bm678.atividades && bm678.atividades.length >= 2) {
  bm678.atividades[1] = {
    projeto: "INSTRUTORES PORSCHE",
    atividade: "INSTRUTOR DEDICADO PROJETO CUSTOMER EXPERIENCE (PV)",
    periodo: "01/01/2026 a 31/01/2026",
    dataInicial: "01/01/2026",
    dataFinal: "31/01/2026",
    horas: 80.0,
    valorHora: 106.25,
    valorTotal: 8500.00,
    rateioInterno: "0,00%"
  };
  bm678.totalHoras = 160.0;
  bm678.valorTotal = 17000.00;
  bm678.mediaHora = 106.25;
  console.log('BM 0678 corrigido com sucesso!');
}

// 4. BM 0677 - Eliza Rosa
const bm677 = bms.find(b => String(b.codigo) === '0677');
if (bm677 && bm677.atividades && bm677.atividades.length >= 1) {
  bm677.atividades[0] = {
    projeto: "EXCELÊNCIA EM SERVIÇOS IVECO",
    atividade: "IVECO MENTORIA 1 - 2º LUGAR EXCELÊNCIA EM VENDAS",
    periodo: "01/01/2026 a 31/01/2026",
    dataInicial: "01/01/2026",
    dataFinal: "31/01/2026",
    horas: 1.0,
    valorHora: 122.34,
    valorTotal: 122.34,
    rateioInterno: "0,00%"
  };
  bm677.totalHoras = 1.0;
  bm677.valorTotal = 122.34;
  bm677.mediaHora = 122.34;
  console.log('BM 0677 corrigido com sucesso!');
}

// 5. BM 0673 - Pedro Lage
const bm673 = bms.find(b => String(b.codigo) === '0673');
if (bm673 && bm673.atividades && bm673.atividades.length >= 1) {
  bm673.atividades[0] = {
    projeto: "PARTS ACADEMY",
    atividade: "PARTS ACADEMY TREINAMENTO",
    periodo: "01/01/2026 a 30/01/2026",
    dataInicial: "01/01/2026",
    dataFinal: "30/01/2026",
    horas: 136.0,
    valorHora: 122.34,
    valorTotal: 16638.30,
    rateioInterno: "56,35%"
  };
  bm673.totalHoras = 241.0;
  bm673.valorTotal = 30000.00;
  bm673.mediaHora = 124.48;
  console.log('BM 0673 corrigido com sucesso!');
}

// 6. BM 0671 - Pedro Colares
const bm671 = bms.find(b => String(b.codigo) === '0671');
if (bm671 && bm671.atividades && bm671.atividades.length >= 3) {
  bm671.atividades[2] = {
    projeto: "AGRO DIVEL | GESTÃO ORGANIZACIONAL",
    atividade: "COMISSÃO REF. DEZEMBRO DE 2025",
    periodo: "01/01/2026 a 31/01/2026",
    dataInicial: "01/01/2026",
    dataFinal: "31/01/2026",
    horas: 10.0,
    valorHora: 35.00,
    valorTotal: 350.00,
    rateioInterno: "0,00%"
  };
  bm671.totalHoras = 238.0;
  bm671.valorTotal = 47448.46;
  bm671.mediaHora = 199.36;
  console.log('BM 0671 corrigido com sucesso!');
}

// Salva localmente
fs.writeFileSync(bmsPath, JSON.stringify(bms, null, 2), 'utf-8');
console.log('Arquivo bms-2026.json atualizado com sucesso!');

// Atualiza no Supabase (chave: bms_lista_completa)
async function syncSupabase() {
  try {
    const { error } = await supabase
      .from('configuracoes')
      .upsert({
        chave: 'bms_lista_completa',
        descricao: JSON.stringify(bms),
        valor: bms.length
      }, { onConflict: 'chave' });

    if (error) {
      console.warn('Aviso ao sincronizar bms_lista_completa no Supabase:', error.message);
    } else {
      console.log('Supabase configuracoes (bms_lista_completa) atualizado com sucesso!');
    }
  } catch (e) {
    console.warn('Erro ao atualizar Supabase:', e);
  }
}

syncSupabase();
