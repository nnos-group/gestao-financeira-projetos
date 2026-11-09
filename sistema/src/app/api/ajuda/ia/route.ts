import { NextRequest, NextResponse } from "next/server";
import { LISTA_PROCESSOS_AJUDA } from "@/lib/ajuda-processos-base";

// Resposta inteligente e contextual gerada pelo motor semântico nativo NNÓS
function responderPorMotorNativo(pergunta: string): { resposta: string; rotaSugerida?: string; rotuloRota?: string } {
  const p = pergunta.toLowerCase().trim();

  // 1. FORNECEDORES / NOTAS FISCAIS DE FORNECEDORES / CONTAS A PAGAR / DESPESAS / COMPRAS
  // (Tratamento prioritário para NUNCA confundir com Faturamento de clientes!)
  if (
    p.includes("fornecedor") ||
    p.includes("fornecedores") ||
    p.includes("nf de fornecedor") ||
    p.includes("nota de fornecedor") ||
    p.includes("nota fiscal de fornecedor") ||
    p.includes("contas a pagar") ||
    p.includes("conta a pagar") ||
    p.includes("boleto") ||
    p.includes("comprovante de despesa") ||
    p.includes("pagar despesa") ||
    p.includes("cadastrar fornecedor")
  ) {
    return {
      resposta: `### 💳 Gestão de Fornecedores, Despesas & Contas a Pagar

No sistema NNÓS, as obrigações com terceiros são tratadas no fluxo de **Contas a Pagar** (diferente do *Faturamento*, que cuida apenas da emissão de notas fiscais contra os clientes da NNÓS):

**1. Cadastro do Fornecedor / Prestador:**
- Acesse o módulo **Pessoas & Prestadores** (\`/pessoas\`).
- Clique em **"+ Cadastrar Nova Pessoa"** e selecione o vínculo **Parceiro (PJ)**.
- Preencha a **Razão Social**, **CNPJ**, **Chave PIX** e dados bancários para liquidação.

**2. Lançamento e Pagamento da Nota Fiscal / Boleto:**
- Acesse o menu **Pagamentos & Contas a Pagar** (\`/pagamentos\`).
- Localize ou registre a duplicata com a data de vencimento, valor do documento e fornecedor vinculado.
- Ao efetuar a baixa bancária, anexe o comprovante e confirme a quitação. O lançamento alimenta automaticamente a linha de custos operacionais do **DRE Gerencial**.

**3. Notas Fiscais Emitidas por Consultores PJ (Medições):**
- Caso a NF seja emitida por um consultor parceiro PJ referente a turmas executadas, o envio do documento fiscal é vinculado diretamente ao respectivo **Boletim de Medição (BM)** em \`/medicao\`.

> **💡 Regra de Ouro:**
> - **Faturamento (\`/faturamento\`):** Notas que a NNÓS emite para cobrar seus clientes (Entrada de Receita).
> - **Pagamentos (\`/pagamentos\`):** Notas e boletos que a NNÓS paga a seus fornecedores e prestadores (Saída / Despesa).`,
      rotaSugerida: "/pagamentos",
      rotuloRota: "Ir para Pagamentos & Contas"
    };
  }

  // 2. BM e Boletim de Medição / Zoho Sign
  if (p.includes("bm") || p.includes("boletim") || p.includes("medição") || p.includes("medicao") || p.includes("zoho")) {
    return {
      resposta: `### 📄 Fluxo de BM (Boletim de Medição) & Zoho Sign

O Boletim de Medição é o documento oficial que consolida as horas executadas e os repasses devidos aos instrutores e consultores.

**Passo a passo no sistema:**
1. Acesse o menu **BM - Boletim de Medição** (\`/medicao\`).
2. Escolha a **Competência** (mês de referência) e selecione o consultor na lista (ou utilize a aba **Emissão em Massa** para gerar todos de uma só vez).
3. **Conferência de Valores:** Valide a quantidade de horas/dias executados, o repasse base e eventuais acréscimos (como o acréscimo de 6% para sócios com NF ou reembolsos de deslocamento).
4. **Homologação Financeira:** A equipe de Controladoria revisa e homologa a medição.
5. **Disparo para Assinatura:** Clique no botão **"Disparar Zoho Sign"**. O sistema envia automaticamente o PDF para o e-mail do consultor e dos diretores signatários.
6. **Webhook & Notificação:** Quando o consultor e os diretores assinam, o status no sistema muda instantaneamente para **"Assinado / Homologado"** e fica liberado para pagamento.

> **💡 Dica:** Se o consultor não receber o e-mail, verifique se o endereço cadastrado em **Pessoas** está correto e use o botão *"Reenviar Notificação Zoho Sign"*.`,
      rotaSugerida: "/medicao",
      rotuloRota: "Ir para BM - Boletim de Medição"
    };
  }

  // 3. Regra dos 6% de Sócio com NF
  if (p.includes("6%") || p.includes("6 por cento") || p.includes("seis por cento") || p.includes("sócio") || p.includes("socio") || p.includes("acréscimo") || p.includes("acrescimo")) {
    return {
      resposta: `### 💼 Regra Tributária de 6% para Sócios com NF

A regra de 6% destina-se a compensar encargos fiscais decorrentes da emissão de nota fiscal de prestação de serviços por sócios consultores:

**Como funciona:**
- Quando uma turma ou atividade tem como instrutor um integrante com enquadramento de **Sócio** que emite Nota Fiscal, o sistema adiciona automaticamente **6% sobre o valor base do repasse**.
- **Fórmula de Cálculo:** \`Repasse Final = Repasse Base * 1.06\`
- **Exemplo Prático:** Se o repasse base de 5 dias for R$ 4.600,00:
  - Repasse com 6%: \`R$ 4.600,00 * 1,06 = R$ 4.876,00\` (com badge visual informando *"R$ 4.876,00 (+6% NF Sócio)"*).
- Essa bonificação reflete tanto na previsão de margem do projeto quanto no valor final gerado no Boletim de Medição (BM).`,
      rotaSugerida: "/projetos",
      rotuloRota: "Conferir em Projetos & Atividades"
    };
  }

  // 4. Notas de Débito (ND) e Reembolsos de Despesas de Viagem
  if (p.includes("nota de débito") || p.includes("nota de debito") || p.includes(" nd ") || p.startsWith("nd ") || p.includes("reembolso") || p.includes("rdv") || p.includes("vexpenses")) {
    return {
      resposta: `### 📑 Notas de Débito (ND) & Prestação de Contas

As Notas de Débito (ND) são utilizadas para refaturamento de despesas reembolsáveis de viagens e deslocamentos aos clientes contratantes:

**Como vincular e conciliar:**
1. **Lançamento na Atividade:** Em **Projetos & Atividades** (\`/projetos\`), clique na linha da turma e abra os detalhes. Localize o campo de *Notas de Débito* para vincular o número da ND e o valor comprovado.
2. **Prestação de Contas pelo Viajante:** O consultor registra os comprovantes de alimentação, táxi/combustível e diárias pelo aplicativo **VExpenses** ou formulário RDV corporativo.
3. **Faturamento contra o Cliente:** No módulo de **Faturamento** (\`/faturamento\`), a Controladoria emite a ND formal de cobrança contra a empresa contratante com base nos comprovantes anexados.`,
      rotaSugerida: "/projetos",
      rotuloRota: "Ver Detalhes em Projetos"
    };
  }

  // 5. Viagens, Logística, Vouchers e Políticas
  if (p.includes("viagem") || p.includes("viagens") || p.includes("logística") || p.includes("logistica") || p.includes("voucher") || p.includes("voo") || p.includes("hotel") || p.includes("cotação") || p.includes("cotacao") || p.includes("política") || p.includes("politica")) {
    return {
      resposta: `### ✈️ Gestão de Viagens & Logística Corporativa

O ciclo de viagens conecta Líderes de Projeto, Agência de Viagens parceira e Consultores Viajantes:

**Fluxo Completo em 5 Etapas:**
1. **Geração da Demanda:** Em **Projetos & Atividades** (\`/projetos\`), ao marcar *"Precisa Logística? SIM"*, a demanda vai automaticamente para a fila da Agência.
2. **Cotação pela Agência:** A agência acessa a aba **Agência de Viagens** em \`/viagens\`, insere as opções de voos, hotéis e tarifas conforme a política do cliente.
3. **Aprovação do Líder:** O líder do projeto recebe a notificação e clica em **"Aprovar Cotação"** no painel de logística.
4. **Emissão de Vouchers:** A agência emite as passagens aéreas e confirmações de hotelaria, anexando os vouchers em PDF no sistema.
5. **Acesso do Viajante & Prestação de Contas:** O consultor visualiza os localizadores no **Portal do Consultor** (\`/consultor/viagens\`). Após a viagem, presta contas via aplicativo VExpenses ou formulário RDV.

> **⚠️ Regra de Ouro das Políticas de Viagem:**
> O viajante deve conferir com antecedência para qual cliente estará viajando:
> - **CNH Training:** Política específica da CNH.
> - **Iveco Group:** Política específica da Iveco.
> - **Demais clientes / Regra Geral:** Se o cliente não tiver política própria homologada, a regra oficial mandatória é a **Política de Viagens da NNÓS Consultoria**.`,
      rotaSugerida: "/viagens",
      rotuloRota: "Acessar Viagens & Logística"
    };
  }

  // 6. Faturamento para Clientes e Impostos da NNÓS (Apenas quando NÃO for sobre fornecedores)
  if (
    p.includes("faturamento") ||
    p.includes("faturar") ||
    p.includes("nf de cliente") ||
    p.includes("imposto") ||
    p.includes("12,25%") ||
    p.includes("duplicata") ||
    p.includes("nfse") ||
    (p.includes("nota fiscal") && !p.includes("fornecedor"))
  ) {
    return {
      resposta: `### 💵 Faturamento & Gestão de Notas Fiscais contra Clientes

No módulo de **Faturamento** (\`/faturamento\`), a Controladoria gerencia todo o ciclo de emissão e liquidação de Notas Fiscais emitidas pela NNÓS para cobrança de clientes contratantes:

**Diretrizes:**
- **Alíquota Tributária Padrão:** O sistema aplica dedução de **12,25%** sobre o faturamento bruto para provisão de impostos corporativos (PIS, COFINS, ISS, etc.).
- **Vinculação de NF:** Ao emitir a Nota Fiscal contra o cliente, registre o número da NF, a data de emissão e o prazo de vencimento contratual (ex: 30 ou 45 dias).
- **Conciliação:** Assim que o cliente efetuar o pagamento, a baixa é realizada no sistema, alimentando imediatamente o DRE e os relatórios financeiros.

> **Atenção:** Para cadastrar notas fiscais de **fornecedores** e prestadores que a NNÓS precisa pagar, utilize o menu **Pagamentos & Contas a Pagar** (\`/pagamentos\`).`,
      rotaSugerida: "/faturamento",
      rotuloRota: "Ir para Faturamento"
    };
  }

  // 7. Pessoas e Cadastros (Prestadores, Parceiros PJ, CLT, Chave PIX)
  if (p.includes("pessoa") || p.includes("pessoas") || p.includes("cadastro") || p.includes("cadastrar") || p.includes("pix") || p.includes("parceiro") || p.includes("clt") || p.includes("cnpj")) {
    return {
      resposta: `### 👥 Gestão de Pessoas & Prestadores de Serviços

O módulo **Pessoas** (\`/pessoas\`) centraliza todos os dados cadastrais, contratuais e fiscais dos integrantes da NNÓS:

**Tipos de Vínculos:**
- **Parceiros (PJ):** Prestadores terceirizados com CNPJ, Razão Social, contrato ativo e emissão de notas fiscais de serviço.
- **Funcionários (CLT):** Equipe interna operacional com registro CLT.
- **Sócios / Diretoria:** Corpo executivo societário da NNÓS Consultoria.

**Dados Obrigatórios para Pagamentos:**
- Para garantir que a liquidação de BMs ocorra sem bloqueios, é fundamental que o integrante possua:
  - **Chave PIX válida** (e dados bancários conferidos).
  - **CPF ou CNPJ cadastrado**.
  - **E-mail corporativo ou oficial** (utilizado para disparo de viagens e Zoho Sign).
  - **Cidade Base e Aeroporto Preferencial** (para emissão logística sem erros).`,
      rotaSugerida: "/pessoas",
      rotuloRota: "Ir para Cadastro de Pessoas"
    };
  }

  // 8. Tabela de Preços e Tarifas por Senioridade
  if (p.includes("tabela de preço") || p.includes("tabela de preco") || p.includes("tabela de preços") || p.includes("tarifa") || p.includes("valor hora") || p.includes("senioridade") || p.includes("júnior") || p.includes("junior") || p.includes("pleno") || p.includes("especialista")) {
    return {
      resposta: `### 🏷️ Tabela de Preços & Tarifas Homologadas

No módulo **Tabela de Preços** (\`/tabela-precos\`), ficam registradas as tarifas padrão de faturamento e repasse:

**Estrutura:**
- **Tarifas de Venda:** Valor/hora contratual faturado para cada cliente corporativo.
- **Faixas de Repasse por Senioridade:** Valores repassados aos consultores nos níveis *Júnior*, *Pleno*, *Sênior* e *Especialista*.
- Essas tarifas são sugeridas automaticamente no momento da criação da turma em **Projetos & Atividades**, garantindo padronização e margem operacional saudável.`,
      rotaSugerida: "/tabela-precos",
      rotuloRota: "Consultar Tabela de Preços"
    };
  }

  // 9. Centro de Custo e Unidades de Negócio
  if (p.includes("centro de custo") || p.includes("centros de custo") || p.includes(" cc ") || p.startsWith("cc ") || p.includes("unidade de negócio") || p.includes("unidade de negocio") || p.includes("hrd") || p.includes("dealer development")) {
    return {
      resposta: `### 🏢 Centros de Custo & Estrutura Organizacional

No módulo **Centro de Custo** (\`/centro-de-custo\`), a Diretoria e Controladoria organizam as contas contábeis e projetos:

- Cada atividade criada no sistema precisa obrigatoriamente estar associada a um Centro de Custo ativo.
- Cada Centro de Custo está vinculado a uma Unidade de Negócio (*Dealer Development*, *HRD*, *Business Solutions*, *Outsourcing*) e a um **Líder Gestor**.
- O correto preenchimento garante a consolidação precisa nos relatórios executivos do **Painel por Líder** e no **DRE**.`,
      rotaSugerida: "/centro-de-custo",
      rotuloRota: "Ir para Centros de Custo"
    };
  }

  // 10. Projetos & Atividades / Turmas
  if (p.includes("projeto") || p.includes("turma") || p.includes("atividade") || p.includes("instrutor") || p.includes("cadastrar turma")) {
    return {
      resposta: `### 📅 Planejamento em Projetos & Atividades

O módulo **Projetos & Atividades** (\`/projetos\`) é o coração operacional do sistema NNÓS.

**Como criar e gerenciar turmas:**
1. No topo da página, certifique-se de que a **Competência** (Ano e Mês) selecionada é a que deseja trabalhar.
2. Clique no botão azul **"+ Nova Atividade"**.
3. Selecione o **Centro de Custo**, o **Projeto**, a **Concessionária / Localidade**, as datas e a carga horária.
4. Escolha o **Instrutor / Consultor**. O sistema preenche automaticamente o perfil de remuneração e os valores contratuais.
5. Indique se haverá necessidade de **Logística (Aéreo, Hotel, Traslado)**.
6. Acompanhe os cards de totais: *Total Faturar*, *Total Consultores*, *Total Logística* e *Total Cancelado*.

> **📌 Formato de Datas:** Todas as datas devem ser informadas e são exibidas no formato brasileiro **DD/MM/AAAA**.`,
      rotaSugerida: "/projetos",
      rotuloRota: "Ir para Projetos & Atividades"
    };
  }

  // 11. Painel Executivo por Líder & Relatórios
  if (p.includes("lider") || p.includes("líder") || p.includes("painel do lider") || p.includes("dre") || p.includes("relatório") || p.includes("relatorio") || p.includes("rentabilidade") || p.includes("margem")) {
    return {
      resposta: `### 📊 Central de Relatórios & Painel Executivo por Líder

A Central de Relatórios (\`/relatorios\`) fornece inteligência financeira e controle de margens para a tomada de decisão:

**Principais Demonstrativos:**
1. **Painel Financeiro por Líder de Projeto (\`/relatorios/painel-lider\`):**
   - Apresenta a Receita Bruta Consolidada, Custos Operacionais, Impostos Tributários (12,25%), Logística e a Margem Líquida Realizada da carteira de cada gestor.
   - Possui raias dinâmicas com leitura em tempo real direto da base de dados e do Supabase.
   - Aba **Ranking de Rentabilidade (Top 20 / Bottom 10):** Mostra os contratos com melhor margem operacional e os que exigem atenção.
2. **DRE Gerencial:** Demonstrativo de resultados acumulados com detalhamento de faturamento mensal e unidades de negócio.
3. **Contas a Pagar Campus BH UVA:** Acompanhamento analítico de contratos, obras e imobilizado.
4. **Despesas & Prospecção:** Dashboard corporativo de viagens e prospecções comerciais estratégicas.`,
      rotaSugerida: "/relatorios/painel-lider",
      rotuloRota: "Abrir Painel Financeiro por Líder"
    };
  }

  // 12. Administração, Perfis e Segurança (MFA)
  if (p.includes("admin") || p.includes("perfil") || p.includes("senha") || p.includes("2fa") || p.includes("mfa") || p.includes("google authenticator") || p.includes("permissao") || p.includes("permissão")) {
    return {
      resposta: `### 🛡️ Administração, Segurança & Perfis RBAC

No menu **Administração** (\`/admin\`), o gestor administrativo gerencia os acessos corporativos:

**Perfis de Acesso Disponíveis:**
- **Administrador (ADMIN):** Acesso total irrestrito a todos os módulos, configurações e relatórios. (Usuário principal: *Leonardo Campos*).
- **Diretoria Executiva (DIRETORIA):** Visão estratégica global, DRE e aprovações societárias.
- **Líder de Projeto (LÍDER):** Visão restrita à sua respectiva carteira de projetos e aprovação de viagens.
- **Financeiro & Controladoria (FINANCEIRO):** Medição, faturamento, pagamentos, BMs e relatórios contábeis.
- **Agência de Viagens (AGÊNCIA):** Acesso exclusivo à cotação e emissão de passagens e vouchers.
- **Consultor / Instrutor:** Portal do Consultor com visualização de sua agenda, viagens e BMs.

**Segurança em Duas Etapas (2FA / MFA):**
- É possível ativar a autenticação via **Google Authenticator (TOTP)** para cada usuário. Ao habilitar, o sistema gera o QR Code para leitura no aplicativo.`,
      rotaSugerida: "/admin",
      rotuloRota: "Ir para Administração"
    };
  }

  // 13. Resposta Geral Abrangente
  return {
    resposta: `Olá! Sou o **Guia Virtual NNÓS**, seu assistente de Inteligência Artificial para suporte e navegação no sistema.

Posso te orientar em qualquer um dos seguintes processos:
- **Fornecedores & Contas a Pagar:** Cadastro de fornecedores PJ, liquidação de boletos e despesas operacionais.
- **Projetos & Atividades:** Criação de turmas, alocação de consultores e cálculo de margem.
- **Boletim de Medição (BM):** Emissão em massa, homologação e disparo Zoho Sign.
- **Viagens & Logística:** Solicitações, cotações pela agência, aprovação do líder e vouchers.
- **Políticas de Viagem:** Regras da CNH, Iveco e NNÓS Consultoria.
- **Regras Fiscais:** Acréscimo de 6% para sócios com NF e tributos de 12,25% no faturamento.
- **Central de Relatórios:** Painel por Líder, DRE Gerencial e Ranking de Rentabilidade.
- **Pessoas:** Cadastro de parceiros PJ, sócios, CLT e chaves PIX.
- **Administração:** Configuração de perfis RBAC e 2FA Google Authenticator.

Você pode me perguntar com suas próprias palavras (por exemplo: *"Como cadastrar nf de fornecedor?"*, *"Como aprovar uma viagem?"* ou *"Como emitir um BM?"*) ou consultar os menus ao lado no Guia Passo a Passo!`,
    rotaSugerida: "/relatorios",
    rotuloRota: "Explorar Central do Sistema"
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pergunta = String(body.pergunta || "").trim();
    const historico = body.historico || [];

    if (!pergunta) {
      return NextResponse.json({ error: "Pergunta não informada." }, { status: 400 });
    }

    // Tentar Gemini API se GEMINI_API_KEY ou GOOGLE_API_KEY estiver configurada
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      try {
        const contextoBase = JSON.stringify(
          LISTA_PROCESSOS_AJUDA.map((m) => ({
            menu: m.menuNome,
            subtitulo: m.subtitulo,
            rota: m.rota,
            categoria: m.categoria,
            descricao: m.descricaoGeral,
            passos: m.passos.map((p) => `${p.numero}. ${p.titulo}: ${p.descricao}`),
            regras: m.regrasImportantes,
            faq: m.faq,
          }))
        );

        const promptSistema = `Você é o "Guia Virtual NNÓS", o assistente oficial de Inteligência Artificial do ERP corporativo "NNÓS Gestão Financeira & Projetos".
Seu objetivo é orientar colaboradores, líderes, instrutores e a diretoria com respostas claras, profissionais, didáticas, precisas e objetivas.

DIRETRIZES FUNDAMENTAIS DO NEGÓCIO:
1. DISTINÇÃO CRUCIAL ENTRE FATURAMENTO E CONTAS A PAGAR:
   - "Faturamento" (/faturamento): Trata EXCLUSIVAMENTE de emissão de Notas Fiscais da NNÓS contra CLIENTES para recebimento de receita. Deduz 12,25% de impostos corporativos.
   - "Pagamentos & Contas a Pagar" (/pagamentos): Trata de Notas Fiscais e boletos recebidos de FORNECEDORES, prestadores e parceiros que a NNÓS deve PAGAR (Despesas).
   - "Pessoas & Prestadores" (/pessoas): Onde se cadastra um novo fornecedor ou consultor parceiro PJ (CNPJ, Razão Social, Chave PIX, Banco).
   - "BM - Boletim de Medição" (/medicao): Onde consultores parceiros têm suas horas apuradas e suas NFs de prestação de serviços vinculadas antes do pagamento.
2. POLÍTICAS DE VIAGEM E LOGÍSTICA:
   - O viajante deve conferir com antecedência para qual cliente estará viajando (CNH Training, Iveco Group ou Geral NNÓS).
   - Se o cliente não tiver política própria homologada, a regra mandatória utilizada é a Política de Viagens da NNÓS Consultoria.
3. REGRA TRIBUTÁRIA DOS 6% PARA SÓCIOS:
   - Quando o instrutor for Sócio Consultor emitindo Nota Fiscal (NF), o sistema calcula e acrescenta automaticamente +6% sobre o repasse bruto para compensação tributária.
4. DATAS:
   - Todas as datas devem ser mencionadas e formatadas estritamente no padrão brasileiro DD/MM/AAAA.
5. ASSINATURAS DIGITAIS:
   - Boletins de Medição (BM) são disparados e assinados digitalmente via Zoho Sign.
6. ROTA SUGERIDA:
   - Sempre indique os caminhos exatos (/projetos, /medicao, /viagens, /pagamentos, /faturamento, /pessoas, /relatorios, /admin).

BASE DE CONHECIMENTO OFICIAL DOS PROCESSOS DO SISTEMA:
${contextoBase}`;

        // Modelos Gemini suportados: gemini-1.5-flash, gemini-2.0-flash, gemini-1.5-pro
        const modelosParaTentar = [
          process.env.GEMINI_MODEL || "gemini-1.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-pro",
        ];

        let respostaGemini: string | undefined;

        for (const modelo of modelosParaTentar) {
          try {
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": apiKey,
                },
                body: JSON.stringify({
                  contents: [
                    {
                      role: "user",
                      parts: [{ text: `${promptSistema}\n\nPergunta do usuário: ${pergunta}` }],
                    },
                  ],
                  generationConfig: {
                    temperature: 0.2,
                    topP: 0.8,
                    maxOutputTokens: 1024,
                  },
                }),
              }
            );

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              respostaGemini = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (respostaGemini) break;
            } else {
              const errText = await geminiRes.text();
              console.warn(`Resposta não-OK da API Gemini (${modelo}):`, errText);
            }
          } catch (mErr) {
            console.warn(`Erro na chamada do modelo ${modelo}:`, mErr);
          }
        }

        if (respostaGemini) {
          // Tenta inferir rota sugerida com base na resposta do Gemini
          let rotaSugerida: string | undefined;
          let rotuloRota: string | undefined;

          if (respostaGemini.includes("/pagamentos")) {
            rotaSugerida = "/pagamentos";
            rotuloRota = "Ir para Pagamentos & Contas";
          } else if (respostaGemini.includes("/medicao")) {
            rotaSugerida = "/medicao";
            rotuloRota = "Ir para Boletim de Medição (BM)";
          } else if (respostaGemini.includes("/viagens")) {
            rotaSugerida = "/viagens";
            rotuloRota = "Acessar Viagens & Logística";
          } else if (respostaGemini.includes("/pessoas")) {
            rotaSugerida = "/pessoas";
            rotuloRota = "Ir para Cadastro de Pessoas";
          } else if (respostaGemini.includes("/faturamento")) {
            rotaSugerida = "/faturamento";
            rotuloRota = "Ir para Faturamento";
          } else if (respostaGemini.includes("/projetos")) {
            rotaSugerida = "/projetos";
            rotuloRota = "Ir para Projetos & Atividades";
          } else if (respostaGemini.includes("/relatorios")) {
            rotaSugerida = "/relatorios";
            rotuloRota = "Abrir Relatórios";
          } else if (respostaGemini.includes("/admin")) {
            rotaSugerida = "/admin";
            rotuloRota = "Ir para Administração";
          }

          return NextResponse.json({
            resposta: respostaGemini,
            rotaSugerida,
            rotuloRota,
            fonte: "gemini_ai",
          });
        }
      } catch (geminiError) {
        console.warn("Aviso ao conectar ao Gemini, utilizando motor nativo:", geminiError);
      }
    }

    // Motor Semântico Nativo NNÓS (execução 100% segura, determinística e resiliente)
    const resultadoNativo = responderPorMotorNativo(pergunta);
    return NextResponse.json({
      ...resultadoNativo,
      fonte: "motor_nativo_nnos",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        resposta: "Desculpe, ocorreu uma instabilidade momentânea ao processar sua consulta. Por favor, tente novamente ou consulte as abas do Guia Passo a Passo.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
