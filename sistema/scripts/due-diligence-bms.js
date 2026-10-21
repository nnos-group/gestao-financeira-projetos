const bms = require('../src/lib/bms-2026.json');
const pagamentos = require('../src/lib/pagamentos-base.json');
const consultores = require('../src/lib/consultores-base.json');

const cleanStr = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

const mapNome = new Map();
consultores.forEach(c => {
  const curto = cleanStr(c.nome);
  if (curto) mapNome.set(curto, curto);
  if (c.nome_completo) mapNome.set(cleanStr(c.nome_completo), curto);
});
mapNome.set('TIAGO ANGELO DE QUEIROZ LOPES', 'TIAGO LOPES');
mapNome.set('PEDRO ERNESTO COLARES DE PAULA', 'PEDRO ERNESTO');
mapNome.set('IGOR PICORELLI SANTOS E SILVA', 'IGOR PICORELLI');
mapNome.set('ANTONIO PEREZ AMIEVA', 'ANTONIO PEREZ');
mapNome.set('JEFFERSON DE ANDRADE SOUZA', 'JEFFERSON SOUZA');
mapNome.set('RODRIGO MARTINELLI KAIRALLA', 'RODRIGO MARTINELLI');
mapNome.set('CEZAR TEIXEIRA HENRIQUE', 'CEZAR TEIXEIRA');
mapNome.set('MARCELO LARA DA SILVA', 'MARCELO LARA');
mapNome.set('WILLIAM BONFIM NUNES SANTOS', 'WILLIAM BONFIM');
mapNome.set('LEONARDO FERREIRA CAMPOS', 'LEONARDO CAMPOS');
mapNome.set('FABIO CANASSA', 'FABIO CANASSA');
mapNome.set('MARISTELA NEVES GARCIA', 'MARISTELA GARCIA');
mapNome.set('LUIS OTAVIO', 'LUIS OTAVIO');
mapNome.set('PEDRO LAGE', 'PEDRO LAGE');

function getNomeCurto(nome) {
  const limpo = cleanStr(nome);
  if (mapNome.has(limpo)) return mapNome.get(limpo);
  for (const [k, v] of mapNome.entries()) {
    if (limpo.includes(k) || k.includes(limpo)) return v;
  }
  return limpo;
}

const missingCodes = ['0907', '0887', '0876', '0846', '0770', '0760', '0755', '0751', '0750', '0723', '0699', '0682', '0681', '0678', '0676', '0675', '0671', '0667'];

const analise = [];

missingCodes.forEach(cod => {
  const bm = bms.find(b => String(b.codigo).padStart(4, '0') === cod);
  if (!bm) return;
  const cCurto = getNomeCurto(bm.consultorNome);
  const mesBm = bm.mesReferencia.split('/')[0].trim().toUpperCase();
  const valorBm = Math.round(Number(bm.valorTotal) * 100) / 100;
  
  // Buscar pagamentos do consultor
  const pagtosConsultor = pagamentos.filter(p => getNomeCurto(p.consultor) === cCurto);
  
  // Agrupar pagamentos por NF/data/mês (desconsiderando RDVs)
  const grupos = {};
  pagtosConsultor.forEach(p => {
    if (String(p.numeroNota || '').toUpperCase().includes('RDV')) return;
    const key = p.realizado + ' | ' + (p.numeroNota || 'S/N') + ' | ' + p.dataPagto;
    if (!grupos[key]) grupos[key] = { itens: [], total: 0, realizado: p.realizado, nota: p.numeroNota, data: p.dataPagto, bm: p.bm };
    grupos[key].itens.push(p);
    grupos[key].total += Number(p.valor) || 0;
  });
  
  // Procurar grupo cuja soma bata com o BM (diferenca < R$ 1,00)
  let grupoExato = null;
  for (const k in grupos) {
    const g = grupos[k];
    const diff = Math.abs(g.total - valorBm);
    if (diff < 1.0) {
      grupoExato = g;
      break;
    }
  }

  // Tentar tambem soma de NF sem descontos de adiantamento
  if (!grupoExato) {
    for (const k in grupos) {
      const g = grupos[k];
      const positivos = g.itens.filter(i => (Number(i.valor) || 0) > 0).reduce((acc, i) => acc + Number(i.valor), 0);
      if (Math.abs(positivos - valorBm) < 1.0) {
        grupoExato = { ...g, total: positivos, isBruto: true };
        break;
      }
    }
  }

  analise.push({
    bm: cod,
    consultor: bm.consultorNome,
    cCurto,
    mes: mesBm,
    valorBm,
    grupoExato,
    totalPagtosConsultorNoMes: pagtosConsultor.filter(p => cleanStr(p.realizado).includes(mesBm.slice(0, 3))).length
  });
});

console.log('=== BMs QUE JÁ FORAM PAGOS NA PLANILHA (MAS FALTAVA VINCULAR O CÓDIGO DO BM) ===');
analise.filter(a => a.grupoExato).forEach(a => {
  console.log('BM #' + a.bm + ' (' + a.consultor + ') - R$ ' + a.valorBm.toFixed(2) + ' [Mês Ref: ' + a.mes + ']');
  console.log('  -> LOCALIZADO na planilha: Mês ' + a.grupoExato.realizado + ', Data ' + a.grupoExato.data + ', Nota ' + a.grupoExato.nota + ', Soma R$ ' + a.grupoExato.total.toFixed(2) + ', BM atual no campo: ' + (a.grupoExato.bm || 'EM BRANCO') + ' (' + a.grupoExato.itens.length + ' linhas)');
});

console.log('\n=== BMs QUE NÃO ESTÃO NA PLANILHA (PENDENTES DE LANÇAMENTO OU SEM PAGAMENTO) ===');
analise.filter(a => !a.grupoExato).forEach(a => {
  console.log('BM #' + a.bm + ' (' + a.consultor + ') - R$ ' + a.valorBm.toFixed(2) + ' [Mês Ref: ' + a.mes + ']');
  console.log('  -> Total de outros lançamentos do consultor no mês ' + a.mes + ': ' + a.totalPagtosConsultorNoMes);
});
