const fs = require('fs');
const path = require('path');

// 1. FATURAMENTO
const fatRaw = require('../../analise/FATURAMENTO.json');
const linhasFat = fatRaw.valores || fatRaw.grid;

let headerIdx = 4;
const headers = linhasFat[headerIdx];
const faturamentoDados = [];

for (let i = headerIdx + 1; i < linhasFat.length; i++) {
  const row = linhasFat[i];
  if (!row || row.length === 0 || !row[0]) continue;
  
  const valStr = String(row[5] || '0').replace(/\./g, '').replace(',', '.').trim();
  const valorNum = parseFloat(valStr) || 0;

  faturamentoDados.push({
    id: `fat-${i}`,
    realizado: String(row[0] || '').trim(),
    faturado: String(row[1] || '').trim(),
    projeto: String(row[2] || '').trim(),
    perfil: String(row[3] || '').trim(),
    numeroNota: String(row[4] || '').trim(),
    valor: valorNum,
    valorFormatado: String(row[5] || '').trim(),
    pedidoCompras: String(row[6] || '').trim(),
    status: String(row[7] || 'Pendente').trim(),
    vencimento: String(row[8] || '').trim(),
    dataPagto: String(row[9] || '').trim(),
    dias: parseInt(String(row[10] || '0'), 10) || 0,
    pagtoDescricao: String(row[11] || '').trim(),
    centroCusto: String(row[12] || '').trim(),
    area: String(row[13] || '').trim()
  });
}

const destFat = path.join(__dirname, '../src/lib/faturamento-base.json');
fs.writeFileSync(destFat, JSON.stringify(faturamentoDados, null, 2), 'utf8');
console.log('Salvo faturamento-base.json com', faturamentoDados.length, 'registros');

// 2. PAGAMENTOS (Planilha do usuário + BMs autorizados)
const pagamentosIniciais = [
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
    numeroNota: "26",
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
    projeto: "ADM E CONTROLE",
    numeroNota: "RDV 11757157",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 139.90,
    status: "Pago",
    bm: "",
    centroCusto: "01.01",
    observacoes: ""
  },
  {
    id: "pgto-10",
    realizado: "SETEMBRO",
    dataPagto: "14/10/2026",
    consultor: "VINICIUS SOUZA",
    tipo: "PARCEIRO",
    projeto: "ADM E CONTROLE",
    numeroNota: "RDV 11757090",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 205.56,
    status: "Pago",
    bm: "",
    centroCusto: "01.01",
    observacoes: ""
  },
  {
    id: "pgto-11",
    realizado: "SETEMBRO",
    dataPagto: "14/10/2026",
    consultor: "PEDRO COLARES",
    tipo: "SÓCIO",
    projeto: "PROSPECÇÃO",
    numeroNota: "RDV 11714784",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 225.15,
    status: "Pago",
    bm: "",
    centroCusto: "01.00.10.013",
    observacoes: ""
  },
  {
    id: "pgto-12",
    realizado: "SETEMBRO",
    dataPagto: "14/10/2026",
    consultor: "ACÁCIO FERREIRA",
    tipo: "FUNCIONÁRIO",
    projeto: "INSTRUTORES CNH",
    numeroNota: "RDV 11456474",
    tipoDespesa: "Relatório de Viagem (RDV)",
    valor: 489.54,
    status: "Pago",
    bm: "",
    centroCusto: "01.05.001.042",
    observacoes: ""
  },
  {
    id: "pgto-13",
    realizado: "SETEMBRO",
    dataPagto: "16/09/2026",
    consultor: "ACÁCIO FERREIRA",
    tipo: "FUNCIONÁRIO",
    projeto: "INSTRUTORES CNH",
    numeroNota: "RDV 11699366",
    tipoDespesa: "Cartão Corporativo",
    valor: 711.00,
    status: "Cartão Corporativo",
    bm: "",
    centroCusto: "01.05.001.042",
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
    tipoDespesa: "Honorários BM Homologado",
    valor: 1320.00,
    status: "Pago",
    bm: "885",
    centroCusto: "01.06.001.048",
    observacoes: "Pagamento de honorário BM 885"
  }
];

// Carregar BMs 2026 homologados e integrar como pagamentos autorizados
const bmsBase = require('../src/lib/bms-2026.json');
bmsBase.forEach((b, idx) => {
  // Evitar duplicar se já foi inserido
  const numBm = String(b.codigo);
  if (numBm === "885") return;

  const dataPrevisao = b.periodoTipo === "1ª Quinzena" ? "10/10/2026" : "25/10/2026";
  const projNome = b.atividades && b.atividades[0] ? b.atividades[0].projeto : "PROJETOS DIVERSOS";

  pagamentosIniciais.push({
    id: `bm-pgto-${b.codigo}`,
    realizado: "SETEMBRO",
    dataPagto: dataPrevisao,
    consultor: b.consultorNome,
    tipo: "PARCEIRO",
    projeto: projNome,
    numeroNota: `NF BM ${b.codigo}`,
    tipoDespesa: "Honorários BM Homologado",
    valor: Number(b.valorTotal) || 0,
    status: b.status.includes("Aprovado") ? "Programado" : "A Pagar",
    bm: b.codigo,
    centroCusto: "01.06.005.028",
    observacoes: `Honorários do BM ${b.codigo} (${b.periodoTipo || 'Integral'})`
  });
});

const destPgto = path.join(__dirname, '../src/lib/pagamentos-base.json');
fs.writeFileSync(destPgto, JSON.stringify(pagamentosIniciais, null, 2), 'utf8');
console.log('Salvo pagamentos-base.json com', pagamentosIniciais.length, 'registros');
