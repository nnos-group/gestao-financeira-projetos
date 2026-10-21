// Leitura SOMENTE LEITURA da planilha para mapear estrutura (abas, dimensões, amostra e fórmulas).
import { GoogleAuth } from 'google-auth-library';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const SPREADSHEET_ID = '1oyOo2Y5HXTEN_8LhW9ekMNRBssCxZ5uyCFFQnB9Z1PM';
const KEY_FILE = './nnos-dashboard-9e61e1181de1.json';

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const client = await auth.getClient();
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
const get = async (url) => (await client.request({ url })).data;

const meta = await get(`${base}?fields=properties.title,sheets.properties`);
mkdirSync('./analise', { recursive: true });
const resumo = [];

for (const s of meta.sheets) {
  const { title, gridProperties: g } = s.properties;
  const range = encodeURIComponent(`'${title}'!A1:AZ80`);
  try {
    const valores = await get(`${base}/values/${range}?valueRenderOption=FORMATTED_VALUE`);
    const formulas = await get(`${base}/values/${range}?valueRenderOption=FORMULA`);
    writeFileSync(`./analise/${title.replace(/[^\w]+/g, '_')}.json`,
      JSON.stringify({ title, grid: g, valores: valores.values, formulas: formulas.values }, null, 1));
    resumo.push({ title, linhas: g.rowCount, colunas: g.columnCount });
  } catch (e) {
    resumo.push({ title, erro: e.message });
  }
}
console.log(meta.properties.title);
console.table(resumo);
