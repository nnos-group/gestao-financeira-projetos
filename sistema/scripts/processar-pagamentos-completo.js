const fs = require('fs');
const path = require('path');

// Ler o arquivo faturamento-base.json para termos a lista de projetos e centros de custo atualizados
const fatBase = require('../src/lib/faturamento-base.json');
const ccBase = require('../src/lib/centros-de-custo.json');

// Mapeamento de centros de custo por projeto
const ccPorProjeto = {};
ccBase.centrosDeCusto.forEach(c => {
  if (c.projeto && c.centroDeCusto) {
    ccPorProjeto[c.projeto.toUpperCase()] = c.centroDeCusto;
  }
});
fatBase.forEach(f => {
  if (f.projeto && f.centroCusto) {
    ccPorProjeto[f.projeto.toUpperCase()] = f.centroCusto;
  }
});

console.log('Mapeamento CC carregado para', Object.keys(ccPorProjeto).length, 'projetos.');
