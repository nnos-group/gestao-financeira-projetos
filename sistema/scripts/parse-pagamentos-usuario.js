const fs = require('fs');
const path = require('path');

// Ler o arquivo raw de pagamentos fornecido pelo usuário
const rawCsvPath = path.join(__dirname, 'raw-pagamentos-usuario.csv');
const content = fs.readFileSync(rawCsvPath, 'utf8');

const lines = content.split('\n');
const pagamentos = [];

let start = false;
let idSeq = 1;

for (let line of lines) {
  line = line.trim();
  if (!line) continue;
  if (line.startsWith('REALIZADO,DATA PGTO,CONSULTOR,TIPO')) {
    start = true;
    continue;
  }
  if (!start) continue;
  if (line.startsWith('-,-,-,-,--') || line.startsWith(',,,,')) continue;

  // Parser de linha CSV com suporte a campos entre aspas
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur.trim());

  if (parts.length < 7) continue;

  const [realizado, dataPgto, consultor, tipo, projeto, numeroNota, valStr, status, bm, cc, obs] = parts;

  if (!realizado || !consultor || realizado === 'TOTAL') continue;

  // Valor
  const cleanVal = (valStr || '0').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(cleanVal) || 0;

  // Identificação do tipo de despesa
  let tipoDespesa = "Honorário / Prestação de Serviços";
  if ((numeroNota && numeroNota.toUpperCase().includes('RDV')) || (obs && obs.toUpperCase().includes('RDV'))) {
    tipoDespesa = "Relatório de Viagem (RDV)";
  } else if (status === "Cartão Corporativo") {
    tipoDespesa = "Cartão Corporativo";
  } else if (numeroNota && (numeroNota.includes('AJUDA DE CUSTO') || numeroNota.includes('PRÓ-LABORE'))) {
    tipoDespesa = "Pró-Labore / Ajuda de Custo";
  } else if (numeroNota && numeroNota.includes('NNÓS MONEY')) {
    tipoDespesa = "Adiantamento / NNÓS Money";
  }

  pagamentos.push({
    id: `pgto-${String(idSeq++).padStart(4, '0')}`,
    realizado: realizado.toUpperCase(),
    dataPgto: dataPgto || "",
    consultor: consultor || "",
    tipo: (tipo || "PARCEIRO").toUpperCase(),
    projeto: projeto || "",
    numeroNota: numeroNota || "",
    tipoDespesa,
    valor,
    status: status || "Pago",
    bm: bm || "",
    centroCusto: cc || "",
    observacoes: obs || ""
  });
}

const dest = path.join(__dirname, '../src/lib/pagamentos-base.json');
fs.writeFileSync(dest, JSON.stringify(pagamentos, null, 2), 'utf8');
console.log('Base de pagamentos gerada com sucesso:', pagamentos.length, 'lançamentos.');
const totalSoma = pagamentos.reduce((acc, p) => acc + p.valor, 0);
console.log('Valor total acumulado:', totalSoma.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
