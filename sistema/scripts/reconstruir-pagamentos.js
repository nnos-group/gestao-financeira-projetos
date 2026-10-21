const fs = require('fs');
const path = require('path');

// 1. Carregar base de consultores para nomes curtos padronizados
const consultores = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/lib/consultores-base.json'), 'utf8'));
const clean = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

const mapNomes = new Map();
consultores.forEach((c) => {
  if (c.nome) mapNomes.set(clean(c.nome), c.nome.toUpperCase());
  if (c.nome_completo) mapNomes.set(clean(c.nome_completo), c.nome.toUpperCase());
});

function getNomeCurto(name) {
  if (!name) return '';
  const c = clean(name);
  if (mapNomes.has(c)) return mapNomes.get(c);
  const parts = name.trim().split(/\s+/);
  if (parts.length > 2) return (parts[0] + ' ' + parts[parts.length - 1]).toUpperCase();
  return name.trim().toUpperCase();
}

// 2. 20 Lançamentos oficiais de despesas, RDVs e acordos
const despesasIniciais = [
  {
    id: "pgto-01",
    realizado: "SETEMBRO",
    dataPagto: "07/10/2026",
    consultor: "ALEJANDRO LAPUENTE",
    tipo: "PARCEIRO",
    projeto: "PARTS ACADEMY",
    numeroNota: "RDV 11681978",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 1262.72,
    status: "Pago",
    bm: "",
    centroCusto: "01.06.003.012",
    observacoes: ""
  },
  {
    id: "pgto-02",
    realizado: "SETEMBRO",
    dataPagto: "07/10/2026",
    consultor: "PEDRO LAGE",
    tipo: "SÓCIO",
    projeto: "PROSPECÇÃO",
    numeroNota: "RDV 11588161",
    tipoDespesa: "Cartão Corporativo",
    valor: 209.08,
    status: "Cartão Corporativo",
    bm: "",
    centroCusto: "01.00.10.013",
    observacoes: "Despesa corporativa de prospecção"
  },
  {
    id: "pgto-03",
    realizado: "SETEMBRO",
    dataPagto: "06/10/2026",
    consultor: "ANTONIO PEREZ",
    tipo: "SÓCIO",
    projeto: "TAPE RUVICHA",
    numeroNota: "RDV 11626682",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 646.56,
    status: "Pago",
    bm: "",
    centroCusto: "01.07.010.039",
    observacoes: ""
  },
  {
    id: "pgto-04",
    realizado: "SETEMBRO",
    dataPagto: "07/10/2026",
    consultor: "TIAGO ANGELO",
    tipo: "PARCEIRO",
    projeto: "TAPE RUVICHA",
    numeroNota: "RDV 11676482",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 445.34,
    status: "Pago",
    bm: "",
    centroCusto: "01.07.010.039",
    observacoes: ""
  },
  {
    id: "pgto-05",
    realizado: "SETEMBRO",
    dataPagto: "07/10/2026",
    consultor: "JULIANO MULLER",
    tipo: "PARCEIRO",
    projeto: "INSTRUTORES CNH",
    numeroNota: "RDV 11459914",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 363.19,
    status: "Pago",
    bm: "",
    centroCusto: "01.05.001.042",
    observacoes: ""
  },
  {
    id: "pgto-06",
    realizado: "SETEMBRO",
    dataPagto: "07/10/2026",
    consultor: "LOURIVAL JORDÃO",
    tipo: "FUNCIONÁRIO",
    projeto: "INSTRUTORES CNH",
    numeroNota: "RDV 11622638",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 307.03,
    status: "Pago",
    bm: "",
    centroCusto: "01.05.001.042",
    observacoes: ""
  },
  {
    id: "pgto-07",
    realizado: "SETEMBRO",
    dataPagto: "01/10/2026",
    consultor: "DOLORES LITZA",
    tipo: "SÓCIO",
    projeto: "DIRETORIA",
    numeroNota: "24",
    tipoDespesa: "Acordo Societário",
    valor: 18290.00,
    status: "Pago",
    bm: "",
    centroCusto: "01.00",
    observacoes: "VENDA DAS COTAS"
  },
  {
    id: "pgto-08",
    realizado: "SETEMBRO",
    dataPagto: "20/10/2026",
    consultor: "DOLORES LITZA",
    tipo: "SÓCIO",
    projeto: "DIRETORIA",
    numeroNota: "25",
    tipoDespesa: "Acordo Societário",
    valor: 18290.00,
    status: "Pago",
    bm: "",
    centroCusto: "01.00",
    observacoes: "VENDA DAS COTAS"
  },
  {
    id: "pgto-09",
    realizado: "SETEMBRO",
    dataPagto: "14/10/2026",
    consultor: "VINICIUS SOUZA",
    tipo: "PARCEIRO",
    projeto: "ACADEMIA DE VENDAS",
    numeroNota: "RDV 11603515",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 139.90,
    status: "Pago",
    bm: "",
    centroCusto: "01.06.002.043",
    observacoes: ""
  },
  {
    id: "pgto-10",
    realizado: "SETEMBRO",
    dataPagto: "14/10/2026",
    consultor: "VINICIUS SOUZA",
    tipo: "PARCEIRO",
    projeto: "ACADEMIA DE VENDAS",
    numeroNota: "RDV 11603534",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 205.56,
    status: "Pago",
    bm: "",
    centroCusto: "01.06.002.043",
    observacoes: ""
  },
  {
    id: "pgto-11",
    realizado: "SETEMBRO",
    dataPagto: "14/10/2026",
    consultor: "PEDRO COLARES",
    tipo: "PARCEIRO",
    projeto: "ACADEMIA DE VENDAS",
    numeroNota: "RDV 11601007",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 225.15,
    status: "Pago",
    bm: "",
    centroCusto: "01.06.002.043",
    observacoes: ""
  },
  {
    id: "pgto-12",
    realizado: "SETEMBRO",
    dataPagto: "14/10/2026",
    consultor: "ACÁCIO FERREIRA",
    tipo: "PARCEIRO",
    projeto: "ACADEMIA DE VENDAS",
    numeroNota: "RDV 11601633",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 489.54,
    status: "Pago",
    bm: "",
    centroCusto: "01.06.002.043",
    observacoes: ""
  },
  {
    id: "pgto-13",
    realizado: "SETEMBRO",
    dataPagto: "16/09/2026",
    consultor: "ACÁCIO FERREIRA",
    tipo: "PARCEIRO",
    projeto: "ACADEMIA DE VENDAS",
    numeroNota: "RDV 11601633",
    tipoDespesa: "Cartão Corporativo",
    valor: 711.00,
    status: "Cartão Corporativo",
    bm: "",
    centroCusto: "01.06.002.043",
    observacoes: ""
  },
  {
    id: "pgto-14",
    realizado: "SETEMBRO",
    dataPagto: "07/09/2026",
    consultor: "MARCELO LARA",
    tipo: "SÓCIO",
    projeto: "PROSPECÇÃO",
    numeroNota: "RDV 11601796",
    tipoDespesa: "Cartão Corporativo",
    valor: 560.27,
    status: "Cartão Corporativo",
    bm: "",
    centroCusto: "01.00.10.013",
    observacoes: ""
  },
  {
    id: "pgto-15",
    realizado: "SETEMBRO",
    dataPagto: "14/10/2026",
    consultor: "MARCELO LARA",
    tipo: "SÓCIO",
    projeto: "PROSPECÇÃO",
    numeroNota: "RDV 11601796",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 69.25,
    status: "Pago",
    bm: "",
    centroCusto: "01.00.10.013",
    observacoes: ""
  },
  {
    id: "pgto-16",
    realizado: "SETEMBRO",
    dataPagto: "14/10/2026",
    consultor: "MARCELO LARA",
    tipo: "SÓCIO",
    projeto: "PROSPECÇÃO",
    numeroNota: "RDV 11599884",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 380.79,
    status: "Pago",
    bm: "",
    centroCusto: "01.00.10.013",
    observacoes: ""
  },
  {
    id: "pgto-17",
    realizado: "SETEMBRO",
    dataPagto: "07/10/2026",
    consultor: "MARCELO LARA",
    tipo: "SÓCIO",
    projeto: "PROSPECÇÃO",
    numeroNota: "RDV 11599884",
    tipoDespesa: "Cartão Corporativo",
    valor: 509.40,
    status: "Cartão Corporativo",
    bm: "",
    centroCusto: "01.00.10.013",
    observacoes: ""
  },
  {
    id: "pgto-18",
    realizado: "SETEMBRO",
    dataPagto: "14/10/2026",
    consultor: "MARCELO LARA",
    tipo: "SÓCIO",
    projeto: "PROSPECÇÃO",
    numeroNota: "RDV 11601614",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 266.49,
    status: "Pago",
    bm: "",
    centroCusto: "01.00.10.013",
    observacoes: ""
  },
  {
    id: "pgto-19",
    realizado: "SETEMBRO",
    dataPagto: "07/10/2026",
    consultor: "MARCELO LARA",
    tipo: "SÓCIO",
    projeto: "PROSPECÇÃO",
    numeroNota: "RDV 11601614",
    tipoDespesa: "Cartão Corporativo",
    valor: 775.68,
    status: "Cartão Corporativo",
    bm: "",
    centroCusto: "01.00.10.013",
    observacoes: ""
  },
  {
    id: "pgto-20",
    realizado: "SETEMBRO",
    dataPagto: "25/10/2026",
    consultor: "LILIA OLIVEIRA",
    tipo: "PARCEIRO",
    projeto: "SERVIÇOS CNH",
    numeroNota: "34",
    tipoDespesa: "BM Homologado",
    valor: 1320.00,
    status: "Pago",
    bm: "885",
    centroCusto: "01.06.001.048",
    observacoes: "" // Removida menção a honorários conforme solicitado
  }
];

// 3. Processar BMs de 2026 distribuídos por cada mês de referência
const bmsPath = path.join(__dirname, '../src/lib/bms-2026.json');
const bmsBase = JSON.parse(fs.readFileSync(bmsPath, 'utf8'));

const mesParaData = {
  'JANEIRO': '10/02/2026',
  'FEVEREIRO': '10/03/2026',
  'MARÇO': '10/04/2026',
  'ABRIL': '10/05/2026',
  'MAIO': '10/06/2026',
  'JUNHO': '10/07/2026',
  'JULHO': '10/08/2026',
  'AGOSTO': '10/09/2026',
  'SETEMBRO': '10/10/2026'
};

const pagamentosFinais = [...despesasIniciais];

bmsBase.forEach((b) => {
  const numBm = String(b.codigo);
  if (numBm === "885") return; // já presente nas despesas iniciais como pgto-20

  const mesRef = (b.mesReferencia || 'Setembro / 2026').split(' / ')[0].trim().toUpperCase();
  const dataPrevisao = b.periodoTipo === '1ª Quinzena'
    ? (mesParaData[mesRef] ? mesParaData[mesRef].replace(/^10\//, '25/') : '25/10/2026')
    : (mesParaData[mesRef] || '10/10/2026');

  const projNome = b.atividades && b.atividades[0] ? b.atividades[0].projeto : "PROJETOS DIVERSOS";

  // Não existe status 'Programado'. Meses anteriores já pagos, Setembro 'A Pagar'
  const statusCalculado = mesRef === 'SETEMBRO' ? 'A Pagar' : 'Pago';

  pagamentosFinais.push({
    id: `bm-pgto-${b.codigo}`,
    realizado: mesRef,
    dataPagto: dataPrevisao,
    consultor: getNomeCurto(b.consultorNome),
    tipo: "PARCEIRO",
    projeto: projNome,
    numeroNota: `NF BM ${b.codigo}`,
    tipoDespesa: "BM Homologado",
    valor: Number(b.valorTotal) || 0,
    status: statusCalculado,
    bm: b.codigo,
    centroCusto: "01.06.005.028",
    observacoes: "" // Nenhuma informação com menção a honorários
  });
});

const destPgto = path.join(__dirname, '../src/lib/pagamentos-base.json');
fs.writeFileSync(destPgto, JSON.stringify(pagamentosFinais, null, 2), 'utf8');
console.log('SUCESSO: Salvos', pagamentosFinais.length, 'lançamentos de pagamentos em pagamentos-base.json');

// Exibir resumo por mês
const porMes = {};
pagamentosFinais.forEach(p => {
  porMes[p.realizado] = (porMes[p.realizado] || 0) + 1;
});
console.log('Lançamentos por mês:', porMes);
