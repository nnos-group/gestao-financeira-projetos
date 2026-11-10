import {
  calcularDiferencaDias,
  calcularMetricasDashboard,
  gerarContratosIniciais,
  processarSituacaoEAlertas,
} from "./contratos-service";
import { detectarInconsistencias } from "./contratos-ia-extractor";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FALHA: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ SUCESSO: ${msg}`);
  }
}

async function runTests() {
  console.log("=== INICIANDO SUÍTE DE TESTES DE QA — GESTÃO DE CONTRATOS ===");

  // 1. Teste de cálculo de dias
  const dias = calcularDiferencaDias("2026-11-20", "2026-11-10");
  assert(dias === 10, `Cálculo de dias deve ser 10 (obtido: ${dias})`);

  // 2. Teste dos contratos iniciais da Porsche
  const contratos = gerarContratosIniciais();
  assert(contratos.length === 2, "Devem existir 2 contratos iniciais de referência da Porsche");

  const cA = contratos.find((c) => c.codigo.includes("TREINAMENTO"));
  const cB = contratos.find((c) => c.codigo.includes("POE"));

  assert(!!cA, "Contrato A (Treinamento) deve existir");
  assert(!!cB, "Contrato B (POE) deve existir");

  // 3. Teste do Critério Financeiro: MRR vs Demanda
  assert(cA?.modalidadeCobranca.valor === "DEMANDA_SERVICOS", "Contrato A deve ser DEMANDA_SERVICOS");
  assert(cA?.valorMensalFixo.valor === null, "Contrato A não pode possuir mensalidade fixa garantida");

  assert(cB?.modalidadeCobranca.valor === "MENSAL_FIXO", "Contrato B deve ser MENSAL_FIXO");
  assert(Number(cB?.valorMensalFixo.valor) === 40586.0, "Contrato B deve ter mensalidade fixa de R$ 40.586,00");

  const metricas = calcularMetricasDashboard(contratos);
  assert(metricas.receitaMensalRecorrenteMRR === 40586.0, `MRR deve considerar apenas contratos de mensalidade fixa (obtido: ${metricas.receitaMensalRecorrenteMRR})`);
  assert(metricas.valorGlobalCarteira === 721200.0 + 974064.0, `Valor global combinado deve ser R$ 1.695.264,00 (obtido: ${metricas.valorGlobalCarteira})`);

  // 4. Teste de detecção de inconsistência de datas
  const inconsistencias = detectarInconsistencias({
    dataInicio: { valor: "2025-02-28", paginaOrigem: 3, clausulaOrigem: "Cláusula 3ª" },
    dataEncerramento: { valor: "2027-03-31", paginaOrigem: 15, clausulaOrigem: "Cronograma Anexo" },
    prazoMeses: { valor: 24, paginaOrigem: 3, clausulaOrigem: "Cláusula 3ª" },
  });

  assert(inconsistencias.length > 0, "Divergência entre 24 meses a partir de fev/2025 e março/2027 deve ser detectada");
  assert(inconsistencias[0].tipo === "DIVERGENCIA_DATAS", "Tipo da inconsistência deve ser DIVERGENCIA_DATAS");

  // 5. Teste da regra de alertas automáticos aos 90, 60, 30, 15 e 0 dias
  const contratosProcessados = processarSituacaoEAlertas(contratos);
  assert(Array.isArray(contratosProcessados), "Contratos processados devem retornar lista");

  console.log("=== TODOS OS TESTES PASSARAM COM SUCESSO! ===");
}

runTests();

