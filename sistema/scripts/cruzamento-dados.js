const fs = require('fs');
const path = require('path');

function norm(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDigits(str) {
  if (!str) return '';
  return str.replace(/\D/g, '');
}

function formatCPF(cpf) {
  if (!cpf) return '';
  const d = cleanDigits(cpf);
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }
  return cpf;
}

function formatCNPJ(cnpj) {
  if (!cnpj) return '';
  const d = cleanDigits(cnpj);
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  }
  return cnpj;
}

function parseCSVLine(line, delimiter) {
  const cols = [];
  let cur = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '"') {
      if (inQuotes && line[j + 1] === '"') {
        cur += '"';
        j++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      cols.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  cols.push(cur.trim());
  return cols;
}

// 1. Ler Fornecedores
const rawFornPath = path.join(__dirname, 'raw-fornecedores.csv');
const fornLines = fs.readFileSync(rawFornPath, 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const fornecedores = [];
for (let i = 1; i < fornLines.length; i++) {
  const cols = parseCSVLine(fornLines[i], ';');
  if (cols.length >= 10) {
    fornecedores.push({
      nome: cols[0] || '',
      razao_social: cols[1] || '',
      cnpj: cols[2] || '',
      cpf: cols[3] || '',
      email: cols[10] || cols[21] || '',
      telefone: cols[11] || '',
      data_nasc: cols[12] || '',
      cep: cols[13] || '',
      estado: cols[14] || '',
      cidade: cols[15] || '',
      endereco: cols[16] || '',
      numero: cols[17] || '',
      bairro: cols[18] || '',
      complemento: cols[19] || '',
      nome_contato: cols[20] || ''
    });
  }
}

// 2. Ler Contratos
const rawContratosPath = path.join(__dirname, 'raw-contratos.csv');
const contLines = fs.readFileSync(rawContratosPath, 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const contratos = [];
for (let i = 1; i < contLines.length; i++) {
  const cols = parseCSVLine(contLines[i], ',');
  if (cols.length >= 6 && cols[0] !== 'FORNECEDOR' && cols[0].length > 0) {
    contratos.push({
      consultor: cols[0] || '',
      razao_social: cols[1] || '',
      cnpj: cols[2] || '',
      endereco: cols[3] || '',
      email: cols[4] || '',
      contrato: cols[5] || ''
    });
  }
}

// 3. Ler Formulário de Consultores (NOVA FONTE DE DADOS)
const rawFormPath = path.join(__dirname, 'raw-formulario-consultores.csv');
const formLines = fs.readFileSync(rawFormPath, 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const respostasFormulario = [];
for (let i = 1; i < formLines.length; i++) {
  const cols = parseCSVLine(formLines[i], ';');
  if (cols.length >= 10) {
    respostasFormulario.push({
      nome_completo: cols[6] || '',
      cpf: cols[7] || '',
      rg: cols[8] || '',
      cnpj: cols[9] || '',
      razao_social: cols[10] || '',
      endereco: cols[11] || '',
      email: cols[12] || '',
      telefone: cols[13] || '',
      pix: cols[14] || ''
    });
  }
}

console.log(`Bases carregadas: ${fornecedores.length} fornecedores, ${contratos.length} contratos, ${respostasFormulario.length} respostas de formulário.`);

// Função para buscar no formulário de consultores
function findInFormulario(nome, cpf, cnpj) {
  const nomeNorm = norm(nome);
  const cpfDig = cleanDigits(cpf);
  const cnpjDig = cleanDigits(cnpj);

  return respostasFormulario.find(f => {
    if (cpfDig && cleanDigits(f.cpf) === cpfDig) return true;
    if (cnpjDig && cleanDigits(f.cnpj) === cnpjDig) return true;
    if (nomeNorm) {
      const fNomeNorm = norm(f.nome_completo);
      if (fNomeNorm.includes(nomeNorm) || nomeNorm.includes(fNomeNorm)) return true;
      // Casos com primeiro e ultimo nome
      const words = nomeNorm.split(' ');
      if (words.length >= 2 && fNomeNorm.includes(words[0]) && fNomeNorm.includes(words[words.length - 1])) {
        return true;
      }
    }
    return false;
  });
}

function detectAeroporto(texto) {
  const t = (texto || '').toUpperCase();
  if (t.includes('BELO HORIZONTE') || t.includes('BETIM') || t.includes('PARÁ DE MINAS') || t.includes('PARA DE MINAS') || t.includes('MG')) return 'CNF (Confins / BH)';
  if (t.includes('CURITIBA') || t.includes('PR') || t.includes('PINHAIS') || t.includes('CAMPINA GRANDE DO SUL')) return 'CWB (Afonso Pena / Curitiba)';
  if (t.includes('SÃO PAULO') || t.includes('SAO PAULO') || t.includes('CAMPINAS') || t.includes('SOROCABA') || t.includes('PIRACICABA') || t.includes('SP')) return 'GRU (Guarulhos / SP)';
  if (t.includes('BRASÍLIA') || t.includes('BRASILIA') || t.includes('DF')) return 'BSB (Brasília / DF)';
  if (t.includes('RIO DE JANEIRO') || t.includes('RJ')) return 'SDU (Santos Dumont / RJ)';
  if (t.includes('URUGUAIANA') || t.includes('LAJEADO') || t.includes('RS') || t.includes('PORTO ALEGRE')) return 'POA (Salgado Filho / RS)';
  if (t.includes('PARNAMIRIM') || t.includes('NATAL') || t.includes('RN')) return 'NAT (Natal / RN)';
  if (t.includes('CARUARU') || t.includes('RECIFE') || t.includes('PE')) return 'REC (Recife / PE)';
  if (t.includes('JOÃO PESSOA') || t.includes('JOAO PESSOA') || t.includes('PB')) return 'JPA (João Pessoa / PB)';
  if (t.includes('ALTA FLORESTA') || t.includes('SINOP') || t.includes('MT') || t.includes('CUIABÁ')) return 'CGB (Cuiabá / MT)';
  if (t.includes('BARRA VELHA') || t.includes('NAVEGANTES') || t.includes('CRICIÚMA') || t.includes('SC')) return 'NVT (Navegantes / SC)';
  return '';
}

function detectCidadeBase(texto) {
  if (!texto) return '';
  const parts = texto.split(/[,-|]/).map(p => p.trim());
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.includes('Belo Horizonte') || p.includes('Betim') || p.includes('Curitiba') || p.includes('São Paulo') || p.includes('Sorocaba') || p.includes('Piracicaba') || p.includes('Pará de Minas') || p.includes('Brasília') || p.includes('Uruguaiana') || p.includes('Parnamirim') || p.includes('Caruaru') || p.includes('Juiz de Fora') || p.includes('Ribeirão Preto') || p.includes('Alta Floresta') || p.includes('Pitanga') || p.includes('Lajeado') || p.includes('Nova Lima')) {
      return p;
    }
  }
  return '';
}

// 3. Montar lista de Sócios
const SOCIOS_DEF = [
  {
    nome: "MARCELO LARA",
    nome_completo: "MARCELO LARA DA SILVA",
    cargo: "Sócio Diretor Executivo",
    perfil: "DIRETORIA",
    buscaFornPF: ["Marcelo Lara"],
    buscaFornPJ: ["MLS", "DRONEX"]
  },
  {
    nome: "PEDRO LAGE",
    nome_completo: "PEDRO LAGE",
    cargo: "Sócio Diretor de Operações",
    perfil: "DIRETORIA",
    buscaFornPF: ["Pedro Lage"],
    buscaFornPJ: []
  },
  {
    nome: "ANTONIO PEREZ",
    nome_completo: "ANTONIO PEREZ AMIEVA",
    cargo: "Sócio Consultor Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["Perez"],
    buscaFornPJ: ["APA GESTAO"]
  },
  {
    nome: "CLEIVSON VIEIRA",
    nome_completo: "CLEIVSON MOURA VIEIRA",
    cargo: "Sócio Consultor Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["CLEIVSON MOURA VIEIRA"],
    buscaFornPJ: ["CIABRENT"]
  },
  {
    nome: "C. DOURADO",
    nome_completo: "CLORISVALDO TEIXEIRA DOURADO",
    cargo: "Sócio Consultor Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["Clorisvaldo Teixeira Dourado"],
    buscaFornPJ: ["C T DOURADO"]
  },
  {
    nome: "ELIZA FORTUNA",
    nome_completo: "ELIZA FORTUNA TORRES ROSA",
    cargo: "Sócia Consultora Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["ELIZA FORTUNA TORRES ROSA"],
    buscaFornPJ: ["FORT CONSULTING"]
  },
  {
    nome: "FELIPE CAMPOS",
    nome_completo: "FELIPE ALVES FRANCA CAMPOS",
    cargo: "Sócio Consultor Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["FELIPE ALVES FRANÇA CAMPOS"],
    buscaFornPJ: ["FELIPE CAMPOS CONSULTORIA"]
  },
  {
    nome: "GABRIEL GOES",
    nome_completo: "GABRIEL ROCHA GOES DA SILVA",
    cargo: "Sócio Consultor Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["Gabriel Rocha Goes da Silva"],
    buscaFornPJ: []
  },
  {
    nome: "JOAO GILBERTO",
    nome_completo: "JOAO GILBERTO DE MELLO SANTOS JUNIOR",
    cargo: "Sócio Consultor Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["JOÃO GILBERTO DE MELLO SANTOS JUNIOR"],
    buscaFornPJ: ["ESSETRES"]
  },
  {
    nome: "MARISTELA GARCIA",
    nome_completo: "MARISTELA NEVES GARCIA",
    cargo: "Sócia Consultora Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["Maristela Neves Garcia"],
    buscaFornPJ: ["SATORI NEGOCIOS"]
  },
  {
    nome: "PEDRO COLARES",
    nome_completo: "PEDRO ERNESTO COLARES DE PAULA",
    cargo: "Sócio Consultor Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["PEDRO ERNESTO COLARES DE PAULA"],
    buscaFornPJ: ["PEDRO COLARES DESENVOLVIMENTO"]
  },
  {
    nome: "LEONARDO CAMPOS",
    nome_completo: "LEONARDO CAMPOS SILVA",
    cargo: "Sócio Diretor Financeiro & Controladoria",
    perfil: "DIRETORIA",
    buscaFornPF: ["Leonardo Campos"],
    buscaFornPJ: ["LEO FINANCE"]
  },
  {
    nome: "JEFFERSON SOUZA",
    nome_completo: "JEFFERSON DE ANDRADE SOUZA",
    cargo: "Sócio Consultor Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["JEFFERSON DE ANDRADE SOUZA"],
    buscaFornPJ: ["NODUS SOLUCOES"]
  },
  {
    nome: "BEATRIZ PICORELLI",
    nome_completo: "MARIA BEATRIZ PICORELLI SANTOS SILVA",
    cargo: "Sócia Consultora Especialista",
    perfil: "DIRETORIA",
    buscaFornPF: ["MARIA BEATRIZ PICORELLI SANTOS SILVA"],
    buscaFornPJ: ["MB PICORELLI"]
  }
];

// 4. Montar lista de 33 Funcionários do Anexo 4
const FUNCIONARIOS_DEF = [
  { nomeCurto: "ACÁCIO FERREIRA", nomeCompleto: "Acácio Campos Ferreira", busca: "Acácio Campos Ferreira", cargo: "Analista de Operações" },
  { nomeCurto: "ANA CAROLINA DELL'ISOLA", nomeCompleto: "Ana Carolina Thomaino Dell'Isola Santos", busca: "Dell'Isola", cargo: "Consultora de Treinamento" },
  { nomeCurto: "ANA CECÍLIA FRANCO", nomeCompleto: "Ana Cecília Caetano Franco", busca: "Ana Cecília Caetano Franco", cargo: "Analista de Planejamento" },
  { nomeCurto: "ANA PAULA PEREIRA", nomeCompleto: "Ana Paula dos Santos Pereira", busca: "Ana Paula dos Santos Pereira", cargo: "Analista Administrativo" },
  { nomeCurto: "ANDRÉ LUIS GARCIA", nomeCompleto: "André Luis Garcia Júnior", busca: "André Luis Garcia Júnior", cargo: "Assistente Operacional" },
  { nomeCurto: "CARLOS LONGO", nomeCompleto: "Carlos Henrique de Almeida Longo", busca: "CARLOS HENRIQUE DE ALMEIDA LONGO", cargo: "Analista de Suporte" },
  { nomeCurto: "CAROLINE AMIEVA", nomeCompleto: "Caroline Albuquerque Amieva", busca: "Caroline Albuquerque Amieva", cargo: "Consultora Educacional" },
  { nomeCurto: "CÁSSIA NUNES", nomeCompleto: "Cássia Cristina Lins Nunes", busca: "CASSIA CRISTINA LINS NUNES", cargo: "Assistente Administrativo" },
  { nomeCurto: "DANIELA OLIVEIRA", nomeCompleto: "Daniela Gonçalves de Almeida Oliveira", busca: "Daniela Gonçalves de Almeida Oliveira", cargo: "Supervisora de Operações" },
  { nomeCurto: "DIEGO COSTA", nomeCompleto: "Diego Matheus de Souza da Costa", busca: "DIEGO MATHEUS DE SOUZA DA COSTA", cargo: "Analista de Tecnologia" },
  { nomeCurto: "GABRIELE SILVA", nomeCompleto: "Gabriele Furtado Silva", busca: "Gabriele Furtado Silva", cargo: "Assistente de Projetos" },
  { nomeCurto: "GUILHERME MOREIRA", nomeCompleto: "Guilherme de Paula Moreira", busca: "Guilherme de Paula Moreira", cargo: "Analista Financeiro" },
  { nomeCurto: "JOÃO PEDRO PAULA", nomeCompleto: "João Pedro Lima de Paula", busca: "João Pedro Lima de Paula", cargo: "Jovem Aprendiz / Apoio" },
  { nomeCurto: "JÚLIA OLIVEIRA", nomeCompleto: "Júlia Proença Oliveira", busca: "JULIA PROENÇA OLIVEIRA", cargo: "Assistente Operacional" },
  { nomeCurto: "JULIANA SANTOS", nomeCompleto: "Juliana Sant'Anna Santos", busca: "JULIANA SANT'ANNA SANTOS", cargo: "Analista de RH & Gente" },
  { nomeCurto: "KAREN KRUEGER", nomeCompleto: "Karen Miranda Gomes Krueger", busca: "KAREN MIRANDA GOMES KRUEGER", cargo: "Analista de Comunicação" },
  { nomeCurto: "KARINA RIBEIRO", nomeCompleto: "Karina Domingues Ribeiro", busca: "Karina Domingues Ribeiro", cargo: "Analista de Qualidade" },
  { nomeCurto: "LARISSA CATTENA", nomeCompleto: "Larissa Curi Rocha Cattena", busca: "Larissa Curi Rocha Cattena", cargo: "Assistente de Projetos" },
  { nomeCurto: "LETÍCIA CARDOSO", nomeCompleto: "Letícia Pereira Cardoso", busca: "Letícia Pereira Cardoso", cargo: "Analista Operacional" },
  { nomeCurto: "LOURIVAL JORDÃO", nomeCompleto: "Lourival dos Anjos Jordão", busca: "LOURIVAL DOS ANJOS JORDAO", cargo: "Coordenador Logístico" },
  { nomeCurto: "LUANA STALBERG", nomeCompleto: "Luana Cardoso Stalberg", busca: "Luana Cardoso Stalberg", cargo: "Analista de Atendimento" },
  { nomeCurto: "LUANA MARQUES", nomeCompleto: "Luana Melo Marques", busca: "Luana Melo Marques", cargo: "Consultora Jr" },
  { nomeCurto: "LUCAS PADOVESE", nomeCompleto: "Lucas Matheus Padovese", busca: "Lucas Matheus Padovese", cargo: "Analista de Projetos" },
  { nomeCurto: "MARCUS DE CARVALHO", nomeCompleto: "Marcus Vinícius de Carvalho", busca: "Marcus Vinícius de Carvalho", cargo: "Analista de Negócios" },
  { nomeCurto: "MARIA LAURA ANCHETA", nomeCompleto: "Maria Laura Sánchez Ancheta", busca: "MARIA LAURA SANCHEZ ANCHETA", cargo: "Designer Instrucional" },
  { nomeCurto: "MARINA MOTA", nomeCompleto: "Marina Machado Mota", busca: "MARINA MACHADO MOTA", cargo: "Analista de Conteúdo" },
  { nomeCurto: "MERYAN MIRANDA", nomeCompleto: "Meryan Campos de Miranda", busca: "Meryan Campos de Miranda", cargo: "Supervisora Financeira" },
  { nomeCurto: "RENAN NOGUEIRA", nomeCompleto: "Renan de Carvalho Garcia Nogueira", busca: "RENAN DE CARVALHO GARCIA NOGUEIRA", cargo: "Analista de Sistemas" },
  { nomeCurto: "RÚBIA PEREIRA", nomeCompleto: "Rúbia dos Santos Pereira", busca: "Rubia dos Santos Pereira", cargo: "Assistente de Operações" },
  { nomeCurto: "SUELEN PRADO", nomeCompleto: "Suelen da Silva Prado", busca: "Suelen da Silva Prado", cargo: "Analista Contábil" },
  { nomeCurto: "TAINARA MORAIS", nomeCompleto: "Tainara Araújo Diniz de Morais", busca: "Tainara Araújo Diniz de Morais", cargo: "Assistente Administrativo" },
  { nomeCurto: "TÂNIA LAGOS", nomeCompleto: "Tânia do Lago Martins Vilas Bôas", busca: "Tânia do Lago Martins Vilas Bôas", cargo: "Analista de Projetos" },
  { nomeCurto: "VITÓRIA GUILLEN", nomeCompleto: "Vitória Carolina de Oliveira Soares Guillen", busca: "Vitória Carolina de Oliveira Soares Guillen", cargo: "Assistente de Logística" }
];

const pessoasFinais = [];

function formataEndereco(f) {
  if (!f) return '';
  const parts = [];
  if (f.endereco) parts.push(f.endereco);
  if (f.numero) parts.push(f.numero);
  if (f.complemento) parts.push(f.complemento);
  if (f.bairro) parts.push(f.bairro);
  if (f.cidade && f.estado) parts.push(`${f.cidade}/${f.estado}`);
  if (f.cep) parts.push(`CEP: ${f.cep}`);
  return parts.join(', ');
}

// 1. PROCESSAR SÓCIOS
for (const s of SOCIOS_DEF) {
  let fPF = null;
  for (const bp of s.buscaFornPF) {
    fPF = fornecedores.find(f => norm(f.nome).includes(norm(bp)) && f.cpf);
    if (fPF) break;
  }
  let fPJ = null;
  for (const bp of s.buscaFornPJ) {
    fPJ = fornecedores.find(f => (norm(f.nome).includes(norm(bp)) || norm(f.razao_social).includes(norm(bp))) && f.cnpj);
    if (fPJ) break;
  }
  if (!fPF) {
    fPF = fornecedores.find(f => norm(f.nome).includes(norm(s.nome)) && f.cpf);
  }

  // Cruzar com Formulário
  const fForm = findInFormulario(s.nome, fPF?.cpf, fPJ?.cnpj);

  const emailReal = (fForm && fForm.email) || (fPF && fPF.email) || (fPJ && fPJ.email) || `${s.nome.toLowerCase().replace(/\s+/g, '.')}@nnos.com.br`;
  const telReal = (fForm && fForm.telefone) || (fPF && fPF.telefone) || (fPJ && fPJ.telefone) || '';
  
  let enderecoReal = (fForm && fForm.endereco) || formataEndereco(fPJ) || formataEndereco(fPF);
  let cidadeBase = (fPF && fPF.cidade) ? `${fPF.cidade} - ${fPF.estado}` : ((fPJ && fPJ.cidade) ? `${fPJ.cidade} - ${fPJ.estado}` : detectCidadeBase(enderecoReal));
  let aeroporto = detectAeroporto(cidadeBase || enderecoReal);

  const cpfReal = formatCPF((fForm && cleanDigits(fForm.cpf).length >= 11 ? fForm.cpf : '') || (fPF && fPF.cpf) || '');
  const rgReal = (fForm && fForm.rg && fForm.rg !== 'N/A' ? fForm.rg : '');
  const pixReal = (fForm && fForm.pix && fForm.pix !== 'N/A' ? fForm.pix : '') || (fPF && fPF.cpf) || (fPJ && fPJ.cnpj) || telReal || emailReal;

  pessoasFinais.push({
    id: `socio-${pessoasFinais.length + 1}`,
    nome: s.nome,
    nome_completo: (fForm && fForm.nome_completo) || s.nome_completo,
    tipo: "socio",
    perfil: s.perfil,
    cargo: s.cargo,
    email: emailReal,
    telefone: telReal,
    ativo: true,

    // Viagens / PF
    cpf: cpfReal,
    rg: rgReal,
    data_nascimento: (fPF && fPF.data_nasc) || '',
    cidade_base: cidadeBase,
    aeroporto_preferencial: aeroporto,

    // PJ
    razao_social: (fForm && fForm.razao_social && fForm.razao_social !== 'O mesmo acima ' && fForm.razao_social !== 'Como Sócio não precisa mencionar' ? fForm.razao_social : '') || (fPJ && fPJ.razao_social) || (fPJ && fPJ.nome) || '',
    nome_fantasia: (fPJ && fPJ.nome) || '',
    cnpj: formatCNPJ((fForm && cleanDigits(fForm.cnpj).length >= 14 ? fForm.cnpj : '') || (fPJ && fPJ.cnpj) || ''),
    inscricao_municipal: '',
    endereco_empresa: enderecoReal,
    banco: '',
    agencia: '',
    conta: '',
    pix: pixReal,
    contrato_ativo: 'SÓCIO',
    valor_hora_padrao: 0
  });
}

// 2. PROCESSAR FUNCIONÁRIOS ATIVOS (33)
for (const func of FUNCIONARIOS_DEF) {
  const fMatch = fornecedores.find(f => {
    const fn = norm(f.nome + ' ' + f.razao_social);
    return fn.includes(norm(func.busca));
  });

  const fForm = findInFormulario(func.nomeCompleto, fMatch?.cpf);

  const cidadeBase = (fMatch && fMatch.cidade) ? `${fMatch.cidade} - ${fMatch.estado}` : detectCidadeBase(fForm?.endereco);
  const aeroporto = detectAeroporto(cidadeBase || fForm?.endereco);

  pessoasFinais.push({
    id: `func-${pessoasFinais.length + 1}`,
    nome: func.nomeCurto.toUpperCase(),
    nome_completo: (fMatch && fMatch.nome) || (fForm && fForm.nome_completo) || func.nomeCompleto.toUpperCase(),
    tipo: "funcionario",
    perfil: "OPERACIONAL",
    cargo: func.cargo,
    email: (fForm && fForm.email) || (fMatch && fMatch.email) || `${func.nomeCurto.toLowerCase().replace(/[^a-z]/g, '.')}@nnos.com.br`,
    telefone: (fForm && fForm.telefone) || (fMatch && fMatch.telefone) || '',
    ativo: true,

    // Viagens / PF
    cpf: formatCPF((fForm && fForm.cpf) || (fMatch && fMatch.cpf) || ''),
    rg: (fForm && fForm.rg) || '',
    data_nascimento: (fMatch && fMatch.data_nasc) || '',
    cidade_base: cidadeBase,
    aeroporto_preferencial: aeroporto,

    // PJ
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_municipal: '',
    endereco_empresa: (fForm && fForm.endereco) || formataEndereco(fMatch),
    banco: '',
    agencia: '',
    conta: '',
    pix: (fForm && fForm.pix) || (fMatch && fMatch.cpf) || (fMatch && fMatch.telefone) || (fMatch && fMatch.email) || '',
    contrato_ativo: 'CLT - Ativo',
    valor_hora_padrao: 0
  });
}

// 3. PROCESSAR PARCEIROS / PRESTADORES PJ
for (const c of contratos) {
  if (c.razao_social === 'SÓCIO') continue;

  const cnpjDigits = cleanDigits(c.cnpj);
  let fMatch = null;
  if (cnpjDigits.length > 8) {
    fMatch = fornecedores.find(f => cleanDigits(f.cnpj) === cnpjDigits);
  }
  if (!fMatch) {
    fMatch = fornecedores.find(f => {
      const fn = norm(f.nome + ' ' + f.razao_social);
      return fn.includes(norm(c.consultor)) || (c.razao_social && fn.includes(norm(c.razao_social)));
    });
  }

  let fPF = fornecedores.find(f => norm(f.nome).includes(norm(c.consultor)) && f.cpf);

  // Cruzar com Formulário de Consultores
  const fForm = findInFormulario(c.consultor, fPF?.cpf, c.cnpj || fMatch?.cnpj);

  const cpfReal = formatCPF((fForm && cleanDigits(fForm.cpf).length >= 11 ? fForm.cpf : '') || (fPF && fPF.cpf) || '');
  const rgReal = (fForm && fForm.rg && fForm.rg !== 'N/A' ? fForm.rg : '');
  const telReal = (fForm && fForm.telefone) || (fMatch && fMatch.telefone) || (fPF && fPF.telefone) || '';
  const emailReal = (fForm && fForm.email) || c.email || (fMatch && fMatch.email) || (fPF && fPF.email) || '';
  const enderecoReal = (fForm && fForm.endereco) || c.endereco || formataEndereco(fMatch) || formataEndereco(fPF);
  const cnpjReal = formatCNPJ((fForm && cleanDigits(fForm.cnpj).length >= 14 ? fForm.cnpj : '') || c.cnpj || (fMatch && fMatch.cnpj) || '');
  const pixReal = (fForm && fForm.pix && fForm.pix !== 'N/A' && !fForm.pix.includes('Desconhecido') ? fForm.pix : '') || cnpjReal || cpfReal || telReal || emailReal;

  let cidadeBase = (fPF && fPF.cidade) ? `${fPF.cidade} - ${fPF.estado}` : ((fMatch && fMatch.cidade) ? `${fMatch.cidade} - ${fMatch.estado}` : detectCidadeBase(enderecoReal));
  let aeroporto = detectAeroporto(cidadeBase || enderecoReal);

  const nomeCompleto = (fForm && fForm.nome_completo) || (fPF && fPF.nome) || c.consultor.toUpperCase();

  pessoasFinais.push({
    id: `parceiro-${pessoasFinais.length + 1}`,
    nome: c.consultor.toUpperCase(),
    nome_completo: nomeCompleto,
    tipo: "parceiro",
    perfil: "SÊNIOR",
    cargo: "Consultor Especialista & Instrutor",
    email: emailReal,
    telefone: telReal,
    ativo: true,

    // Viagens / PF
    cpf: cpfReal,
    rg: rgReal,
    data_nascimento: (fPF && fPF.data_nasc) || (fMatch && fMatch.data_nasc) || '',
    cidade_base: cidadeBase,
    aeroporto_preferencial: aeroporto,

    // PJ
    razao_social: (fForm && fForm.razao_social && !fForm.razao_social.includes('PESSOA F') && fForm.razao_social !== 'N/A' ? fForm.razao_social : '') || c.razao_social || (fMatch && fMatch.razao_social) || (fMatch && fMatch.nome) || '',
    nome_fantasia: (fMatch && fMatch.nome) || '',
    cnpj: cnpjReal,
    inscricao_municipal: '',
    endereco_empresa: enderecoReal,
    banco: '',
    agencia: '',
    conta: '',
    pix: pixReal,
    contrato_ativo: c.contrato || 'Contrato Vigente',
    valor_hora_padrao: 180
  });
}

console.log(`\nTOTAL DE PESSOAS PROCESSADAS: ${pessoasFinais.length}`);
console.log(`Sócios: ${pessoasFinais.filter(p => p.tipo === 'socio').length}`);
console.log(`Funcionários: ${pessoasFinais.filter(p => p.tipo === 'funcionario').length}`);
console.log(`Parceiros: ${pessoasFinais.filter(p => p.tipo === 'parceiro').length}`);

const comCpf = pessoasFinais.filter(p => p.cpf && p.cpf.trim().length > 0).length;
const comRg = pessoasFinais.filter(p => p.rg && p.rg.trim().length > 0).length;
const comPix = pessoasFinais.filter(p => p.pix && p.pix.trim().length > 0).length;
const comCidade = pessoasFinais.filter(p => p.cidade_base && p.cidade_base.trim().length > 0).length;
console.log(`Pessoas com CPF preenchido: ${comCpf} de ${pessoasFinais.length}`);
console.log(`Pessoas com RG preenchido: ${comRg} de ${pessoasFinais.length}`);
console.log(`Pessoas com Chave PIX: ${comPix} de ${pessoasFinais.length}`);
console.log(`Pessoas com Cidade Base: ${comCidade} de ${pessoasFinais.length}`);

// Salvar consultores-base.json
const jsonPath = path.join(__dirname, '../src/lib/consultores-base.json');
fs.writeFileSync(jsonPath, JSON.stringify(pessoasFinais, null, 2), 'utf8');
console.log(`Salvo em ${jsonPath}`);
