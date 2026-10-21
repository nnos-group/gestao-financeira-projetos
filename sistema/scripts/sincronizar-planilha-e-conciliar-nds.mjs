import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SPREADSHEET_ID = '1oyOo2Y5HXTEN_8LhW9ekMNRBssCxZ5uyCFFQnB9Z1PM';
const KEY_FILE = '../nnos-dashboard-9e61e1181de1.json';
const ANO = 2026;
const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const client = await auth.getClient();
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

async function ler(aba, range) {
  const r = encodeURIComponent(`'${aba}'!${range}`);
  const { data } = await client.request({ url: `${base}/values/${r}?valueRenderOption=UNFORMATTED_VALUE` });
  return data.values ?? [];
}

const txt = (v) => (v == null ? '' : String(v).trim());
const up = (v) => txt(v).toUpperCase().replace(/\s+/g, ' ');
const num = (v) => {
  if (typeof v === 'number') return v;
  const s = txt(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const dataConv = (v) => {
  if (typeof v !== 'number') return null;
  return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
};

// Normalização inteligente de ND considerando casos específicos do usuário
function normalizarND(val, contexto = {}) {
  if (val == null) return null;
  let s = String(val).trim();
  if (!s || s === '-' || s === '—' || s === '0' || s === '0000') return null;

  // Casos específicos informados pelo usuário:
  // Felipe Campos (Maio): -426236 -> 0733.1 e -426205 -> 0733.2
  if (s === '-426236' || s === '426236') return '0733.1';
  if (s === '-426205' || s === '426205') return '0733.2';

  // Pedro Colares (Junho): -410134 -> 0777.2
  if (s === '-410134' || s === '410134') return '0777.2';

  // Se tiver "0669 e 0673" ou similar com múltiplos números
  if (s.includes(' e ') || s.includes('/') || s.includes(',')) {
    return s;
  }

  // Preenchimento de 4 dígitos se puramente numérico
  if (/^\d{1,4}$/.test(s)) return s.padStart(4, '0');

  return s;
}

const check = (r) => {
  if (r.error) throw new Error(`${r.error.message} (${r.error.details ?? ''})`);
  return r.data;
};

async function inserirLotes(tabela, linhas, tam = 500) {
  for (let i = 0; i < linhas.length; i += tam) {
    check(await sb.from(tabela).insert(linhas.slice(i, i + tam)));
  }
}

console.log('=====================================================');
console.log('🚀 ETAPA 1: ATUALIZANDO DADOS DA PLANILHA NO SUPABASE');
console.log('=====================================================');

// 1. Centros de Custo, Áreas, Líderes
console.log('Lendo Centros de Custo...');
const cc = (await ler('Centro de Custo', 'A2:F1000')).filter((r) => txt(r[1]) && txt(r[2]));
const nomesArea = [...new Set(cc.map((r) => up(r[4])).filter(Boolean))];
const nomesLider = [...new Set(cc.map((r) => up(r[5])).filter(Boolean))];
check(await sb.from('areas').upsert(nomesArea.map((nome) => ({ nome })), { onConflict: 'nome' }));
check(await sb.from('lideres').upsert(nomesLider.map((nome) => ({ nome })), { onConflict: 'nome' }));
const areaId = Object.fromEntries(check(await sb.from('areas').select('id,nome')).map((a) => [a.nome, a.id]));
const liderId = Object.fromEntries(check(await sb.from('lideres').select('id,nome')).map((a) => [a.nome, a.id]));

const ccPorCodigo = new Map();
for (const r of cc) {
  const codigo = txt(r[1]);
  if (!ccPorCodigo.has(codigo)) {
    ccPorCodigo.set(codigo, {
      codigo,
      projeto: up(r[2]),
      contrato: txt(r[3]) || null,
      area_id: areaId[up(r[4])] ?? null,
      lider_id: liderId[up(r[5])] ?? null,
    });
  }
}
check(await sb.from('centros_custo').upsert([...ccPorCodigo.values()], { onConflict: 'codigo' }));
const ccId = Object.fromEntries(check(await sb.from('centros_custo').select('id,codigo,projeto')).map((c) => [c.codigo, c.id]));

const projCC = new Map();
for (const c of ccPorCodigo.values()) {
  if (!projCC.has(c.projeto)) projCC.set(c.projeto, ccId[c.codigo]);
}

// 2. Consultores
console.log('Lendo Consultores da Tabela Preços...');
const listas = await ler('Tabela Preços', 'P2:Q200');
const socios = new Set(listas.map((r) => up(r[0])).filter(Boolean));
const parceiros = new Set(listas.map((r) => up(r[1])).filter(Boolean));

// 3. Meses Detalhado
const lancs = [];
const viagensRaw = [];
const ndsPlanilhaRaw = [];
const projetosNovos = new Set();
const consultoresVistos = new Map();

for (let m = 0; m < 12; m++) {
  const aba = `Detalhado - ${MESES[m]}`;
  const linhas = (await ler(aba, 'A2:AF2000')).filter((r) => txt(r[1]));
  console.log(`Lendo ${aba}: ${linhas.length} lançamentos encontrados`);
  const competencia = `${ANO}-${String(m + 1).padStart(2, '0')}-01`;

  linhas.forEach((r, idx) => {
    const projeto = up(r[1]);
    if (!projCC.has(projeto)) projetosNovos.add(projeto);
    const instrutor = up(r[8]);
    if (instrutor) {
      const fornecedor = instrutor === 'FORNECEDOR';
      const tipo = fornecedor ? 'parceiro' : socios.has(instrutor) ? 'socio' : parceiros.has(instrutor) ? 'parceiro' : 'funcionario';
      consultoresVistos.set(instrutor, { nome: instrutor, tipo, fornecedor });
    }
    const custoBruto = r[14];
    const key = `${m}-${idx}`;

    lancs.push({
      _key: key,
      competencia,
      projeto,
      instrutor,
      atividade: txt(r[2]) || null,
      modalidade: up(r[3]) === 'PRESENCIAL' ? 'PRESENCIAL' : up(r[3]) === 'VIRTUAL' ? 'VIRTUAL' : null,
      local: txt(r[4]) || null,
      regiao: up(r[5]) === 'LATAM' ? 'LATAM' : 'BRA',
      data_inicial: dataConv(r[6]),
      data_final: dataConv(r[7]),
      perfil: txt(r[9]) || null,
      horas: num(r[10]),
      faturar: num(r[12]),
      repasse: num(r[13]),
      custo_consultor: typeof custoBruto === 'number' ? custoBruto : null,
      logistica: num(r[16]),
      status: txt(r[17]) || null,
      precisa_logistica: up(r[18]) === 'SIM' ? true : up(r[18]) === 'NAO' || up(r[18]) === 'NÃO' ? false : null,
    });

    const custos = [20, 21, 22, 23, 24].map((i) => num(r[i]) ?? 0);
    const temLogistica = custos.some((c) => c !== 0) || txt(r[19]) || up(r[18]) === 'SIM';

    if (temLogistica) {
      viagensRaw.push({
        _key: key,
        agencia: txt(r[19]) || null,
        custo_1: custos[0],
        custo_2: custos[1],
        custo_3: custos[2],
        custo_4: custos[3],
        custo_5: custos[4],
        observacao_agencia: txt(r[27]) || null,
      });

      // Captura NDs anotadas na planilha com normalização inteligente
      const ndAg = normalizarND(r[28], { mes: MESES[m], instrutor, projeto });
      const ndCo = normalizarND(r[29], { mes: MESES[m], instrutor, projeto });
      if (ndAg || ndCo) {
        ndsPlanilhaRaw.push({
          _key: key,
          ndAgencia: ndAg,
          ndConsultor: ndCo,
        });
      }
    }
  });
}

// Atualizar projetos e consultores
const todosProjetos = new Set([...projCC.keys(), ...projetosNovos]);
check(await sb.from('projetos').upsert([...todosProjetos].map((nome) => ({ nome, centro_custo_id: projCC.get(nome) ?? null })), { onConflict: 'nome' }));
const projetoId = Object.fromEntries(check(await sb.from('projetos').select('id,nome')).map((p) => [p.nome, p.id]));

check(await sb.from('consultores').upsert([...consultoresVistos.values()].map(({ nome, tipo, fornecedor }) => ({ nome, tipo, fornecedor })), { onConflict: 'nome' }));
const consultorId = Object.fromEntries(check(await sb.from('consultores').select('id,nome')).map((c) => [c.nome, c.id]));

// Recarregar lançamentos e viagens
console.log('Recarregando tabela de lançamentos no Supabase...');
check(await sb.from('lancamentos').delete().gte('competencia', `${ANO}-01-01`).lte('competencia', `${ANO}-12-31`));

const paraInserir = lancs.map(({ _key, projeto, instrutor, ...l }) => ({
  ...l,
  projeto_id: projetoId[projeto],
  consultor_id: instrutor ? consultorId[instrutor] : null,
}));

console.log(`Inserindo ${paraInserir.length} lançamentos...`);
const idsPorOrdem = [];
for (let i = 0; i < paraInserir.length; i += 500) {
  const ins = check(await sb.from('lancamentos').insert(paraInserir.slice(i, i + 500)).select('id'));
  idsPorOrdem.push(...ins.map((x) => x.id));
}
const idPorKey = new Map(lancs.map((l, i) => [l._key, idsPorOrdem[i]]));

console.log(`Inserindo ${viagensRaw.length} detalhamentos de viagens...`);
await inserirLotes('viagens', viagensRaw.map(({ _key, ...v }) => ({ ...v, lancamento_id: idPorKey.get(_key) })));

console.log('Planilha sincronizada no Supabase com sucesso!');

console.log('\n=====================================================');
console.log('🔗 ETAPA 2: VINCULAÇÃO E CONCILIAÇÃO DAS NOTAS DE DÉBITO');
console.log('=====================================================');

// Carregar faturamento atualizado
const faturamentoPath = path.resolve('src/lib/faturamento-base.json');
const faturamentoBase = JSON.parse(fs.readFileSync(faturamentoPath, 'utf-8'));

// Mapa de códigos provisórios no faturamento para NDs oficiais
const mapaProvisoriosFaturamento = {
  '-417105': '0758.1',
  '-417439': '0757.2',
  '-399907': '0805.2',
  '-399573': '0806.1',
  '-399542': '0806.2',
  '-399208': '0807.1',
  '-391507': '0828.2',
  '-387854': '0838.2',
};

const faturasLogistica = faturamentoBase
  .filter((f) => (f.perfil || '').toUpperCase().includes('LOG'))
  .map((f) => {
    let num = String(f.numeroNota || '').trim();
    if (mapaProvisoriosFaturamento[num]) {
      num = mapaProvisoriosFaturamento[num];
    }
    return {
      id: f.id,
      numeroNotaOriginal: String(f.numeroNota || '').trim(),
      numeroNota: num,
      projeto: String(f.projeto || '').trim().toUpperCase(),
      valor: Number(f.valor) || 0,
      realizado: String(f.realizado || '').trim().toUpperCase(),
      faturado: String(f.faturado || '').trim().toUpperCase(),
      status: f.status,
      pedidoCompras: f.pedidoCompras || '',
      conciliada: false,
      lancamentoVinculadoId: null,
    };
  });

console.log(`Total de NDs de Logística em Faturamento: ${faturasLogistica.length}`);

// Buscar todos os lançamentos com viagens e projetos
const { data: lancsComViagens } = await sb
  .from('lancamentos')
  .select(`
    id, competencia, atividade, data_inicial, repasse,
    projetos (nome),
    consultores (nome),
    viagens (id, custo_1, custo_2, custo_3, custo_4, custo_5)
  `)
  .not('viagens', 'is', null);

const mapaNdPlanilhaPorLancId = new Map();
for (const n of ndsPlanilhaRaw) {
  const lId = idPorKey.get(n._key);
  if (lId) mapaNdPlanilhaPorLancId.set(lId, n);
}

// Limpar notas_debito antes de repovoar com conciliação completa
await sb.from('notas_debito').delete().neq('id', '00000000-0000-0000-0000-000000000000');

const notasParaInserir = [];
const repassesParaAtualizar = new Map(); // lancamento_id -> repasse

let totalVinculacoesPlanilha = 0;
let totalVinculacoesInteligentes = 0;
const atividadesSemND = [];

// Função auxiliar para encontrar fatura por número
function encontrarFatura(numBuscado, projBuscado) {
  if (!numBuscado) return null;
  const numLimpo = numBuscado.trim();
  return faturasLogistica.find((f) => (f.numeroNota === numLimpo || f.numeroNotaOriginal === numLimpo) && !f.conciliada && f.projeto === projBuscado) ||
         faturasLogistica.find((f) => (f.numeroNota === numLimpo || f.numeroNotaOriginal === numLimpo) && !f.conciliada);
}

// Função auxiliar para extrair múltiplos números de uma célula (ex: "0669 e 0673")
function extrairNDs(str) {
  if (!str) return [];
  const parts = str.split(/\s+e\s+|\/|,/i).map((s) => normalizarND(s)).filter(Boolean);
  return parts.length > 0 ? parts : [str];
}

for (const item of lancsComViagens || []) {
  const v = Array.isArray(item.viagens) ? item.viagens[0] : item.viagens;
  if (!v) continue;

  const custoAgencia = (v.custo_1 || 0) + (v.custo_2 || 0) + (v.custo_3 || 0) + (v.custo_4 || 0);
  const custoConsultor = v.custo_5 || 0;
  const custoTotal = Math.round((custoAgencia + custoConsultor) * 100) / 100;
  const projNome = (item.projetos?.nome || '').trim().toUpperCase();
  const consNome = (item.consultores?.nome || '').trim().toUpperCase();

  // Caso específico Juliano Muller (Agosto 02/08 a 07/08): concilia 0822.1 (agência) + 0822 (consultor)
  if (consNome.includes('JULIANO') && item.data_inicial === '2026-08-02') {
    const fatAg = encontrarFatura('0822.1', projNome);
    const fatCo = encontrarFatura('0822', projNome);
    const valAg = fatAg ? fatAg.valor : 5145.96;
    const valCo = fatCo ? fatCo.valor : 3819.26;
    if (fatAg) { fatAg.conciliada = true; fatAg.lancamentoVinculadoId = item.id; }
    if (fatCo) { fatCo.conciliada = true; fatCo.lancamentoVinculadoId = item.id; }
    notasParaInserir.push({ lancamento_id: item.id, destino: 'agencia', numero: '0822.1', valor: valAg });
    notasParaInserir.push({ lancamento_id: item.id, destino: 'consultor', numero: '0822', valor: valCo });
    repassesParaAtualizar.set(item.id, Math.round((valAg + valCo) * 100) / 100);
    totalVinculacoesPlanilha++;
    continue;
  }

  // Caso específico Beatriz Torres (Agosto 24/08 a 28/08): concilia 0828.1 (agência R$ 2.707,53) + 0828.2 (consultor R$ 1.084,96)
  if (consNome.includes('BEATRIZ') && item.data_inicial === '2026-08-24' && projNome.includes('PARTS')) {
    const fatAg = encontrarFatura('0828.1', projNome);
    const fatCo = encontrarFatura('0828.2', projNome);
    const valAg = fatAg ? fatAg.valor : 2707.53;
    const valCo = fatCo ? fatCo.valor : 1084.96;
    if (fatAg) { fatAg.conciliada = true; fatAg.lancamentoVinculadoId = item.id; }
    if (fatCo) { fatCo.conciliada = true; fatCo.lancamentoVinculadoId = item.id; }
    notasParaInserir.push({ lancamento_id: item.id, destino: 'agencia', numero: '0828.1', valor: valAg });
    notasParaInserir.push({ lancamento_id: item.id, destino: 'consultor', numero: '0828.2', valor: valCo });
    repassesParaAtualizar.set(item.id, Math.round((valAg + valCo) * 100) / 100);
    totalVinculacoesPlanilha++;
    continue;
  }

  const ndPl = mapaNdPlanilhaPorLancId.get(item.id);
  let vinculou = false;
  let repasseCalculado = 0;

  // 1. CASO PLANILHA: Tem ND anotada na planilha
  if (ndPl) {
    const { ndAgencia, ndConsultor } = ndPl;
    const listaAg = extrairNDs(ndAgencia);
    const listaCo = extrairNDs(ndConsultor);

    // Se ambas forem exatamente iguais (ex: 0857 ou 0848 completo, ou "0669 e 0673")
    if (ndAgencia && ndAgencia === ndConsultor) {
      let somaTotal = 0;
      for (const numND of listaAg) {
        const fat = encontrarFatura(numND, projNome);
        const val = fat ? fat.valor : (listaAg.length === 1 ? custoTotal : 0);
        if (fat) {
          fat.conciliada = true;
          fat.lancamentoVinculadoId = item.id;
        }
        somaTotal += val;
      }
      const valFinal = somaTotal > 0 ? somaTotal : custoTotal;
      // Salva o registro exibindo o rótulo da célula (ex: "0669 e 0673" ou "0857")
      notasParaInserir.push({ lancamento_id: item.id, destino: 'agencia', numero: ndAgencia, valor: valFinal });
      notasParaInserir.push({ lancamento_id: item.id, destino: 'consultor', numero: ndConsultor, valor: valFinal });
      repasseCalculado = valFinal;
      vinculou = true;
      totalVinculacoesPlanilha++;
    } else {
      let valAgTotal = 0;
      let valCoTotal = 0;

      if (ndAgencia) {
        for (const numND of listaAg) {
          const fat = encontrarFatura(numND, projNome);
          const val = fat ? fat.valor : (listaAg.length === 1 ? custoAgencia : 0);
          if (fat) {
            fat.conciliada = true;
            fat.lancamentoVinculadoId = item.id;
          }
          valAgTotal += val;
        }
        notasParaInserir.push({ lancamento_id: item.id, destino: 'agencia', numero: ndAgencia, valor: valAgTotal || custoAgencia });
        vinculou = true;
      }

      if (ndConsultor) {
        for (const numND of listaCo) {
          const fat = encontrarFatura(numND, projNome);
          const val = fat ? fat.valor : (listaCo.length === 1 ? custoConsultor : 0);
          if (fat) {
            fat.conciliada = true;
            fat.lancamentoVinculadoId = item.id;
          }
          valCoTotal += val;
        }
        notasParaInserir.push({ lancamento_id: item.id, destino: 'consultor', numero: ndConsultor, valor: valCoTotal || custoConsultor });
        vinculou = true;
      }

      repasseCalculado = Math.round(((valAgTotal || (ndAgencia ? custoAgencia : 0)) + (valCoTotal || (ndConsultor ? custoConsultor : 0))) * 100) / 100;
      totalVinculacoesPlanilha++;
    }
  }

  // 2. CASO INTELIGENTE: Se ainda não vinculou, busca correspondência em Faturamento
  if (!vinculou && custoTotal > 0) {
    const faturasProjeto = faturasLogistica.filter((f) => f.projeto === projNome && !f.conciliada);

    // A. Busca ND Completa (sem .1 nem .2) com valor igual ao total da viagem (ou ao custo existente)
    const fatCompleta = faturasProjeto.find((f) => {
      const n = f.numeroNota;
      if (n.endsWith('.1') || n.endsWith('.2')) return false;
      return Math.abs(f.valor - custoTotal) < 0.05 ||
             (custoAgencia === 0 && Math.abs(f.valor - custoConsultor) < 0.05) ||
             (custoConsultor === 0 && Math.abs(f.valor - custoAgencia) < 0.05);
    });

    if (fatCompleta) {
      fatCompleta.conciliada = true;
      fatCompleta.lancamentoVinculadoId = item.id;
      notasParaInserir.push({ lancamento_id: item.id, destino: 'agencia', numero: fatCompleta.numeroNota, valor: fatCompleta.valor });
      notasParaInserir.push({ lancamento_id: item.id, destino: 'consultor', numero: fatCompleta.numeroNota, valor: fatCompleta.valor });
      repasseCalculado = fatCompleta.valor;
      vinculou = true;
      totalVinculacoesInteligentes++;
    } else {
      let valAg = 0;
      let valCo = 0;
      let achouAg = false;
      let achouCo = false;

      if (custoAgencia > 0) {
        const fatAg = faturasProjeto.find((f) => f.numeroNota.endsWith('.1') && Math.abs(f.valor - custoAgencia) < 0.05);
        if (fatAg) {
          fatAg.conciliada = true;
          fatAg.lancamentoVinculadoId = item.id;
          notasParaInserir.push({ lancamento_id: item.id, destino: 'agencia', numero: fatAg.numeroNota, valor: fatAg.valor });
          valAg = fatAg.valor;
          achouAg = true;
        }
      }

      if (custoConsultor > 0) {
        const fatCo = faturasProjeto.find((f) => f.numeroNota.endsWith('.2') && Math.abs(f.valor - custoConsultor) < 0.05);
        if (fatCo) {
          fatCo.conciliada = true;
          fatCo.lancamentoVinculadoId = item.id;
          notasParaInserir.push({ lancamento_id: item.id, destino: 'consultor', numero: fatCo.numeroNota, valor: fatCo.valor });
          valCo = fatCo.valor;
          achouCo = true;
        }
      }

      if (achouAg || achouCo) {
        repasseCalculado = Math.round((valAg + valCo) * 100) / 100;
        vinculou = true;
        totalVinculacoesInteligentes++;
      }
    }
  }

  // Regra Contábil: O REPASSE de logística NUNCA pode ser maior que o TOTAL VIAGEM
  if (custoTotal > 0 && repasseCalculado > custoTotal) {
    repasseCalculado = custoTotal;
  }
  // Se a atividade já possui repasse na planilha e ele é válido (<= custoTotal), prioriza o repasse original auditado
  if (item.repasse && item.repasse > 0 && item.repasse <= custoTotal) {
    repasseCalculado = item.repasse;
  }

  // Atualizar repasse se houve vinculação
  if (repasseCalculado > 0) {
    repassesParaAtualizar.set(item.id, repasseCalculado);
  } else if (custoTotal > 0) {
    atividadesSemND.push({
      id: item.id,
      projeto: item.projetos?.nome || '—',
      atividade: item.atividade || '—',
      consultor: item.consultores?.nome || '—',
      competencia: item.competencia,
      data_inicial: item.data_inicial || '—',
      custoAgencia,
      custoConsultor,
      custoTotal,
      repasseAtual: item.repasse || 0,
    });
  }
}

// Inserir todas as notas de débito conciliadas no Supabase
console.log(`Inserindo ${notasParaInserir.length} registros de Notas de Débito no banco...`);
await inserirLotes('notas_debito', notasParaInserir);

// Atualizar repasses das atividades no Supabase
console.log(`Atualizando ${repassesParaAtualizar.size} repasses de atividades no banco...`);
for (const [lId, repVal] of repassesParaAtualizar.entries()) {
  await sb.from('lancamentos').update({ repasse: repVal }).eq('id', lId);
}

// Lista das 13 NDs de almoço informadas pelo usuário + 0847 e 0858 (Alimentação CNH)
const ndsAlmocoUsuario = new Set([
  '0675', '0677', '0681', '0686', '0718', '0723', '0743',
  '0755', '0767', '0790', '0816', '0830', '0835', '0847', '0858'
]);

// Classificação das pendências do faturamento
const pendenciasFaturamentoReais = [];
const desconsideradasRegraNegocio = [];

faturasLogistica.forEach((f) => {
  if (f.conciliada) return;

  const num = f.numeroNota;
  const ped = (f.pedidoCompras || '').toUpperCase();

  // 1. Informadas pelo usuário como Almoço / Alimentação sem atividade
  if (ndsAlmocoUsuario.has(num)) {
    desconsideradasRegraNegocio.push({ ...f, motivo: 'Reembolso de Almoço / Alimentação CNH sem atividade operacional atrelada' });
    return;
  }

  // 2. Pedido de Compras contendo ALMOÇO
  if (ped.includes('ALMOÇO') || ped.includes('ALMOCO')) {
    desconsideradasRegraNegocio.push({ ...f, motivo: 'Despesa avulsa de Almoço no Pedido de Compras sem atividade operacional' });
    return;
  }

  // 3. Caso em averiguação pela equipe (0832.1 / -390077)
  if (num === '-390077' || num === '0832.1') {
    pendenciasFaturamentoReais.push({
      ...f,
      numeroNota: '0832.1 (-390077)',
      motivo: 'Refere-se a ND 0832.1 (valor da logística alterado para R$ 3.122,01 em averiguação pela equipe)'
    });
    return;
  }

  // Demais pendências
  pendenciasFaturamentoReais.push(f);
});

// Atividades sem ND filtrando Prospecção e Campus BH (custos comerciais internos)
const atividadesAguardandoND = atividadesSemND.filter((a) => {
  const p = a.projeto.toUpperCase();
  return !p.includes('PROSPECÇÃO') && !p.includes('PROSPECCAO') && !p.includes('CAMPUS BH') && !p.includes('VEIGA DE ALMEIDA');
});

console.log('\n=====================================================');
console.log('📊 RESUMO DA CONCILIAÇÃO CONTÁBIL FINAL');
console.log('=====================================================');
console.log(`Total de NDs de Logística em Faturamento: ${faturasLogistica.length}`);
console.log(`NDs Conciliadas com sucesso: ${faturasLogistica.filter((f) => f.conciliada).length}`);
console.log(`NDs Desconsideradas (Almoços e Alimentação sem atividade): ${desconsideradasRegraNegocio.length}`);
console.log(`PENDÊNCIAS REAIS RESTANTES NO FATURAMENTO: ${pendenciasFaturamentoReais.length}`);
console.log(`Atividades com Viagem aguardando emissão de ND: ${atividadesAguardandoND.length}`);

const relatorioFinal = {
  dataAtualizacao: new Date().toISOString(),
  resumo: {
    totalNDsFaturamento: faturasLogistica.length,
    ndsConciliadasSucesso: faturasLogistica.filter((f) => f.conciliada).length,
    despesasAlmocoDesconsideradas: desconsideradasRegraNegocio.length,
    pendenciasReaisFaturamento: pendenciasFaturamentoReais.length,
    atividadesAguardandoEmissaoND: atividadesAguardandoND.length,
  },
  pendenciasFaturamentoReais,
  desconsideradasRegraNegocio,
  atividadesAguardandoND,
};

fs.writeFileSync(path.resolve('src/lib/relatorio-conciliacao-nds.json'), JSON.stringify(relatorioFinal, null, 2), 'utf-8');
console.log('Relatório salvo em src/lib/relatorio-conciliacao-nds.json');
