const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/medicao/page.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// 1. Corrigir Print 2: "Voltar para Faturamento & CC / Lista de BMs" -> "Voltar para Lista de BMs"
content = content.replace(
  '<span>Voltar para Faturamento & CC / Lista de BMs</span>',
  '<span>Voltar para Lista de BMs</span>'
);

// 2. Adicionar função helper formatarNomeAssinatura antes do componente
const helperCode = `function formatarNomeAssinatura(nome: string) {
  if (!nome) return "";
  return nome
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

const MESES_LISTA = [
  { num: 1, nome: "Janeiro" },
  { num: 2, nome: "Fevereiro" },
  { num: 3, nome: "Março" },
  { num: 4, nome: "Abril" },
  { num: 5, nome: "Maio" },
  { num: 6, nome: "Junho" },
  { num: 7, nome: "Julho" },
  { num: 8, nome: "Agosto" },
  { num: 9, nome: "Setembro" },
  { num: 10, nome: "Outubro" },
  { num: 11, nome: "Novembro" },
  { num: 12, nome: "Dezembro" },
];\n\n`;

if (!content.includes('function formatarNomeAssinatura')) {
  content = content.replace('export default function BoletimMedicaoPage() {', helperCode + 'export default function BoletimMedicaoPage() {');
}

// 3. Atualizar CONSULTORES_DISPONIVEIS para incluir versão curta e dados completos
const regexCons = /const CONSULTORES_DISPONIVEIS = \(consultoresBase as any\[\]\)[\s\S]*?\n  \}\)\);\r?\n/;
const novoCons = `const CONSULTORES_DISPONIVEIS = (consultoresBase as any[])
  .filter((c: any) => c.ativo !== false)
  .map((c: any) => ({
    nome: c.nome, // Versão curta para vincular com a base de dados de Projetos
    nomeCompleto: c.nome_completo || c.nome,
    razaoSocial: c.razao_social || c.nome_completo || c.nome,
    cnpj: c.cnpj || '',
    email: c.email || '',
    endereco: c.endereco_empresa || c.cidade_base || '',
    contrato: c.contrato_ativo ? (c.contrato_ativo + ' • NNÓS') : 'Contrato Vigente • NNÓS',
  }));\n\n`;

content = content.replace(regexCons, novoCons);

// 4. Corrigir Print 1: Assinatura do Prestador dinâmica com o nome do consultor
content = content.replace(
  `<span style={{ fontFamily: "cursive", fontSize: "28px", color: "var(--primary)", fontStyle: "italic", letterSpacing: "2px" }}>
                            Tiago Angelo
                          </span>`,
  `<span style={{ fontFamily: "cursive", fontSize: "28px", color: "var(--primary)", fontStyle: "italic", letterSpacing: "2px" }}>
                            {formatarNomeAssinatura(bmVisualizando.consultorNome)}
                          </span>`
);

content = content.replace(
  `<span style={{ fontFamily: "cursive", fontSize: "28px", color: "var(--secondary)", fontStyle: "italic", letterSpacing: "2px" }}>
                            Marcela Lara da Silva
                          </span>`,
  `<span style={{ fontFamily: "cursive", fontSize: "28px", color: "var(--secondary)", fontStyle: "italic", letterSpacing: "2px" }}>
                            {formatarNomeAssinatura(bmVisualizando.responsavelNnosNome || "Marcelo Lara da Silva")}
                          </span>`
);

content = content.replace(
  `<span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Razão Social: {bmVisualizando.consultorNome} • CNPJ: {bmVisualizando.consultorCnpj}</span>`,
  `<span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Razão Social: {bmVisualizando.consultorRazaoSocial || bmVisualizando.consultorNome} • CNPJ: {bmVisualizando.consultorCnpj || "Não informado"}</span>`
);

// Atualizar IP e datas dos logs de assinatura
content = content.replace(
  `<span>IP: 187.55.204.12</span>
                        <span>Data: 01/10/2026 às 14:32:09</span>`,
  `<span>{bmVisualizando.logs[0]?.detalhe?.includes("IP:") ? bmVisualizando.logs[0].detalhe.split("•")[0].trim() : "IP: 187.55.204.12"}</span>
                        <span>Data: {bmVisualizando.logs[0]?.dataHora || bmVisualizando.dataEnvio}</span>`
);

content = content.replace(
  `<span>Token: NX-VAL-903-88B</span>
                        <span>Data: 01/10/2026 às 16:15:40</span>`,
  `<span>Token: NX-VAL-{bmVisualizando.codigo}-88B</span>
                        <span>Data: {bmVisualizando.logs[2]?.dataHora || bmVisualizando.dataEnvio}</span>`
);

fs.writeFileSync(targetFile, content, 'utf-8');
console.log('Etapa 1 de atualização do medicao/page.tsx concluída!');
