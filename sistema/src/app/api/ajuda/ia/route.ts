import { NextRequest, NextResponse } from "next/server";
import { LISTA_PROCESSOS_AJUDA } from "@/lib/ajuda-processos-base";

// Resposta inteligente e contextual gerada pelo motor nativo
function responderPorMotorNativo(pergunta: string): { resposta: string; rotaSugerida?: string; rotuloRota?: string } {
  const p = pergunta.toLowerCase().trim();

  // 1. BM e Boletim de Medição / Zoho Sign
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

  // 2. Viagens, Logística, Vouchers e Políticas
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

  // 3. Regra dos 6% de Sócio
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

  // 4. Projetos & Atividades / Turmas
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

  // 5. Painel Executivo por Líder & Relatórios
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

  // 6. Faturamento e Impostos
  if (p.includes("faturamento") || p.includes("faturar") || p.includes("nota fiscal") || p.includes("nf") || p.includes("imposto") || p.includes("12,25%")) {
    return {
      resposta: `### 💵 Faturamento & Gestão de Notas Fiscais

No módulo de **Faturamento** (\`/faturamento\`), a Controladoria gerencia todo o ciclo de emissão e liquidação de NFs para os clientes da NNÓS:

**Diretrizes:**
- **Alíquota Tributária Padrão:** O sistema aplica dedução de **12,25%** sobre o faturamento bruto para provisão de impostos corporativos (PIS, COFINS, ISS, etc.).
- **Vinculação de NF:** Ao emitir a Nota Fiscal contra o cliente, registre o número da NF, a data de emissão e o prazo de vencimento contratual.
- **Conciliação:** Assim que o cliente efetuar o pagamento, a baixa é realizada no sistema, alimentando imediatamente o DRE e os relatórios financeiros.`,
      rotaSugerida: "/faturamento",
      rotuloRota: "Ir para Faturamento"
    };
  }

  // 7. Pessoas e Cadastros
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

  // 8. Administração, Perfis e Segurança (MFA)
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

  // 9. Resposta Geral Abrangente
  return {
    resposta: `Olá! Sou o **Guia Virtual NNÓS**, seu assistente de Inteligência Artificial para suporte e navegação no sistema.

Posso te orientar em qualquer um dos seguintes processos:
- **Projetos & Atividades:** Criação de turmas, alocação de consultores e cálculo de margem.
- **Boletim de Medição (BM):** Emissão em massa, homologação e disparo Zoho Sign.
- **Viagens & Logística:** Solicitações, cotações pela agência, aprovação do líder e vouchers.
- **Políticas de Viagem:** Regras da CNH, Iveco e NNÓS Consultoria.
- **Regras Fiscais:** Acréscimo de 6% para sócios e tributos de 12,25%.
- **Central de Relatórios:** Painel por Líder, DRE Gerencial e Ranking de Rentabilidade.
- **Pessoas:** Cadastro de parceiros PJ, sócios, CLT e chaves PIX.
- **Administração:** Configuração de perfis RBAC e 2FA Google Authenticator.

Você pode me perguntar com suas próprias palavras (por exemplo: *"Como aprovar uma viagem?"* ou *"Como emitir um BM?"*) ou consultar os menus ao lado no Guia Passo a Passo!`,
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

    // Tentar Gemini API se GEMINI_API_KEY estiver configurada
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      try {
        const contextoBase = JSON.stringify(
          LISTA_PROCESSOS_AJUDA.map((m) => ({
            menu: m.menuNome,
            rota: m.rota,
            descricao: m.descricaoGeral,
            passos: m.passos.map((p) => `${p.numero}. ${p.titulo}: ${p.descricao}`),
            regras: m.regrasImportantes,
            faq: m.faq,
          }))
        );

        const promptSistema = `Você é o "Guia Virtual NNÓS", um assistente de IA nativo do sistema corporativo "NNÓS Gestão Financeira & Projetos".
Seu objetivo é orientar colaboradores, líderes e a diretoria com respostas claras, profissionais, didáticas e objetivas.
Regras fundamentais:
1. Todas as datas devem ser mencionadas no padrão brasileiro DD/MM/AAAA.
2. Em viagens, a regra geral é a Política de Viagens da NNÓS Consultoria, a menos que o cliente (CNH ou Iveco) possua política própria.
3. Sócios com NF têm acréscimo de 6% no repasse bruto.
4. BMs são assinados digitalmente via Zoho Sign.
5. Faturamento deduz 12,25% de impostos tributários padrão.
6. Sempre sugira o caminho de telas ou rotas (/projetos, /medicao, /viagens, /relatorios, /pessoas, etc.).

Base de processos do sistema:
${contextoBase}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: `${promptSistema}\n\nPergunta do usuário: ${pergunta}` }] },
              ],
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const respostaGemini = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (respostaGemini) {
            return NextResponse.json({
              resposta: respostaGemini,
              fonte: "gemini_ai",
            });
          }
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

