const fs = require('fs');
const path = require('path');

// Ler o conteúdo de transcript_full.jsonl para capturar o bloco CSV exato da mensagem do usuário
const transcriptPath = 'C:/Users/Leonardo Campos/.gemini/antigravity-ide/brain/d85d30a6-c79d-417a-88ea-a2024a4f272a/.system_generated/logs/transcript_full.jsonl';
const fileData = fs.readFileSync(transcriptPath, 'utf8');

// Procurar onde começa a tabela CSV
const startTag = 'REALIZADO,DATA PGTO,CONSULTOR,TIPO,PROJETO,Nº NOTA,VALOR,STATUS,BM,CC,OBS.:';
const endTag = '317.383,38",,,,';

const startIdx = fileData.lastIndexOf(startTag);
if (startIdx === -1) {
  console.error('Início do CSV não encontrado');
  process.exit(1);
}

let endIdx = fileData.indexOf(endTag, startIdx);
if (endIdx === -1) {
  endIdx = fileData.length;
} else {
  endIdx += endTag.length;
}

const csvBlock = fileData.substring(startIdx, endIdx);
console.log('Bloco CSV extraído com sucesso, tamanho:', csvBlock.length);

const lines = csvBlock.split('\n');
const pagamentos = [];
let idSeq = 1;

for (let rawLine of lines) {
  // Limpar escapes se houver
  let line = rawLine.replace(/\\r/g, '').replace(/\\n/g, '').replace(/\\"/g, '"').trim();
  if (!line || line.startsWith('REALIZADO,') || line.startsWith(',,,,') || line.startsWith('-,-,-,-,--')) continue;

  // Parser com suporte a campos entre aspas
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

  const cleanVal = (valStr || '0').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(cleanVal) || 0;

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
console.log('Salvos', pagamentos.length, 'lançamentos de pagamentos em pagamentos-base.json');
