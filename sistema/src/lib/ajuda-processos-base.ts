export interface PassoProcesso {
  numero: number;
  titulo: string;
  descricao: string;
  dica?: string;
}

export interface ProcessoMenu {
  id: string;
  menuNome: string;
  rota: string;
  icone: string;
  categoria: "Operacional" | "Financeiro" | "Gestão & Diretoria" | "Consultoria" | "Segurança";
  descricaoGeral: string;
  publicoAlvo: string;
  passos: PassoProcesso[];
  regrasImportantes: string[];
  faq: { pergunta: string; resposta: string }[];
}

export const LISTA_PROCESSOS_AJUDA: ProcessoMenu[] = [
  {
    id: "projetos",
    menuNome: "Projetos & Atividades",
    rota: "/projetos",
    icone: "assignment",
    categoria: "Operacional",
    descricaoGeral: "Planejamento centralizado de turmas, alocação de consultores, controle de faturamento, custos de logística, notas de débito e acompanhamento de margem de contribuição.",
    publicoAlvo: "Líderes de Projeto, Coordenação, Financeiro e Administradores",
    passos: [
      {
        numero: 1,
        titulo: "Filtrar por Competência e Projeto",
        descricao: "Utilize os seletores de Ano e Mês no topo da tela para carregar as turmas da competência desejada. Você pode filtrar também por Centro de Custo, Projeto, Instrutor, Concessionária ou Cidade.",
        dica: "As datas sempre são apresentadas no formato brasileiro (DD/MM/AAAA)."
      },
      {
        numero: 2,
        titulo: "Cadastrar Nova Atividade ou Turma",
        descricao: "Clique no botão '+ Nova Atividade'. Selecione o Centro de Custo, o Projeto, a Concessionária/Localidade, as datas de início e fim e a carga horária (ex: 40h).",
      },
      {
        numero: 3,
        titulo: "Alocar Instrutor e Definir Tarifa",
        descricao: "Selecione o consultor responsável. O sistema preenche automaticamente o perfil (Júnior, Pleno, Sênior, Especialista) e os valores de faturamento e repasse com base na Tabela de Preços oficial.",
        dica: "Se o instrutor for Sócio Consultor emitindo NF, o sistema calcula automaticamente o acréscimo de 6% sobre o repasse bruto."
      },
      {
        numero: 4,
        titulo: "Configurar Logística e Despesas",
        descricao: "Defina se a atividade precisa de logística (Aéreo, Hotel, Traslado/Carro, Seguro e Diárias). Ao marcar 'Precisa Logística? SIM', uma solicitação é gerada automaticamente para a Agência de Viagens.",
      },
      {
        numero: 5,
        titulo: "Acompanhar Margem e Confirmar",
        descricao: "Verifique o card de resumo financeiro: Receita Faturar, Custo Consultores, Logística e Margem Operacional realizada antes de finalizar."
      }
    ],
    regrasImportantes: [
      "Acréscimo de 6% para Sócios: Quando o instrutor é sócio com nota fiscal emitida, aplica-se acréscimo de 6% no cálculo de repasse.",
      "Todas as datas seguem estritamente o formato DD/MM/AAAA.",
      "Atividades confirmadas alimentam diretamente a agenda do consultor e a geração de Boletins de Medição (BM)."
    ],
    faq: [
      {
        pergunta: "Como vincular uma Nota de Débito (ND) de reembolso à turma?",
        resposta: "Abra a linha da atividade clicando no card ou em 'Detalhes', localize o campo de Despesas Adicionais / Repasse e informe o número e valor da ND correspondente."
      },
      {
        pergunta: "Por que uma turma cancelada não gera BM?",
        resposta: "Turmas com status 'Cancelada' são congeladas para medição e faturamento, preservando apenas os custos logísticos já emitidos e não reembolsáveis."
      }
    ]
  },
  {
    id: "medicao",
    menuNome: "BM - Boletim de Medição",
    rota: "/medicao",
    icone: "receipt_long",
    categoria: "Financeiro",
    descricaoGeral: "Emissão individual e em massa de Boletins de Medição de consultores, controle de aprovação financeira, integração com Zoho Sign para assinatura digital e conciliação de pagamentos.",
    publicoAlvo: "Financeiro, Controladoria, Líderes e Sócios Diretores",
    passos: [
      {
        numero: 1,
        titulo: "Selecionar Competência e Consultor",
        descricao: "Escolha o mês de apuração e o consultor prestador de serviços. O sistema consolidará todas as atividades confirmadas realizadas no período.",
        dica: "Utilize a aba 'Emissão em Massa' para gerar os BMs de todos os prestadores ativos em um único clique."
      },
      {
        numero: 2,
        titulo: "Conferir Horas, Tarifas e Despesas",
        descricao: "Verifique o total de horas executadas, o valor hora contratual, o repasse base e quaisquer adicionais (reembolsos de quilometragem, alimentação ou acréscimo de 6% NF sócio).",
      },
      {
        numero: 3,
        titulo: "Homologar Medição Financeira",
        descricao: "A equipe financeira valida a medição e os dados bancários/PIX do prestador cadastrado no módulo de Pessoas.",
      },
      {
        numero: 4,
        titulo: "Disparar para Assinatura no Zoho Sign",
        descricao: "Clique em 'Disparar Zoho Sign'. O sistema envia automaticamente o documento PDF com os campos de assinatura para o e-mail do consultor e dos diretores responsáveis.",
        dica: "O webhook do Zoho Sign atualiza em tempo real o status no sistema assim que o documento for assinado por todas as partes."
      },
      {
        numero: 5,
        titulo: "Exportar Relatório e Enviar para Pagamento",
        descricao: "Após a assinatura completa, o BM ganha status 'Homologado' e fica disponível para liquidação no módulo de Pagamentos."
      }
    ],
    regrasImportantes: [
      "BMs só podem ser pagos após assinatura completa via Zoho Sign ou validação expressa da Controladoria.",
      "Dados bancários e chave PIX são puxados exclusivamente do cadastro oficial em Pessoas.",
      "A numeração do BM segue o padrão sequencial corporativo (ex: BM-2026-0042)."
    ],
    faq: [
      {
        pergunta: "O consultor pode assinar pelo celular?",
        resposta: "Sim, o e-mail disparado pelo Zoho Sign é 100% responsivo e permite assinatura digital em qualquer smartphone, tablet ou computador."
      },
      {
        pergunta: "Como reenviar o link de assinatura do Zoho Sign?",
        resposta: "Na tabela de BMs, localize o documento pendente e clique no botão com ícone de envelope 'Reenviar Notificação Zoho Sign'."
      }
    ]
  },
  {
    id: "viagens",
    menuNome: "Viagens & Logística",
    rota: "/viagens",
    icone: "flight",
    categoria: "Operacional",
    descricaoGeral: "Gestão completa do ciclo de viagens corporativas: solicitações geradas pelas atividades, cotações de passagens/hotéis pela agência parceira, aprovação pelo líder e emissão de vouchers.",
    publicoAlvo: "Agência de Viagens, Líderes de Projeto, Viajantes e Financeiro",
    passos: [
      {
        numero: 1,
        titulo: "Geração da Demanda de Viagem",
        descricao: "Criada automaticamente quando uma atividade em Projetos & Atividades marca 'Precisa Logística? SIM'. Os dados do viajante, datas e destino são carregados.",
      },
      {
        numero: 2,
        titulo: "Cotação pela Agência de Viagens",
        descricao: "A agência acessa a aba 'Agência de Viagens', visualiza as demandas pendentes e preenche as opções de voos, hotéis e tarifas conforme a política da empresa contratante.",
        dica: "A agência deve respeitar a política indicada (CNH Training, Iveco Group ou Geral NNÓS)."
      },
      {
        numero: 3,
        titulo: "Aprovação pelo Líder de Projeto",
        descricao: "O líder do projeto analisa a melhor opção cotada, verifica a aderência ao orçamento do contrato e clica em 'Aprovar Cotação'.",
      },
      {
        numero: 4,
        titulo: "Emissão e Anexo de Vouchers",
        descricao: "A agência emite os bilhetes aéreos, vouchers de hotel e encaminha ao sistema com localizador, horário de voo e anexos em PDF.",
      },
      {
        numero: 5,
        titulo: "Notificação e Prestação de Contas",
        descricao: "O consultor visualiza os vouchers no seu Portal e, após a viagem, faz a prestação de contas de eventuais despesas via aplicativo VExpenses ou formulário RDV."
      }
    ],
    regrasImportantes: [
      "Orientações ao viajante: O consultor deve verificar com antecedência para qual cliente estará viajando (CNH, Iveco ou NNÓS) para seguir as regras específicas de reembolso e limite de diárias.",
      "Se o cliente não tiver política própria homologada, a regra geral mandatória é a Política de Viagens da NNÓS Consultoria.",
      "Miniaturas de todas as políticas oficiais (PDFs) estão acessíveis diretamente no portal do consultor e nos e-mails disparados."
    ],
    faq: [
      {
        pergunta: "Por que uma viagem aparece como 'Não precisa logística'?",
        resposta: "Quando o treinamento ocorre na cidade-base do consultor ou quando não houve demanda de aéreo e hospedagem, o custo de logística é mantido zerado."
      },
      {
        pergunta: "Como o consultor acessa os vouchers da passagem e hotel?",
        resposta: "O consultor acessa o menu 'Portal do Consultor' -> 'Minhas Viagens', onde encontra o card da viagem com o botão 'Ver Detalhes & Vouchers'."
      }
    ]
  },
  {
    id: "centro-de-custo",
    menuNome: "Centro de Custo",
    rota: "/centro-de-custo",
    icone: "account_tree",
    categoria: "Gestão & Diretoria",
    descricaoGeral: "Estrutura organizacional de centros de custo, unidades de negócio (HRD, Dealer Development, Business Solutions, Outsourcing), líderes responsáveis e orçamentos.",
    publicoAlvo: "Controladoria, Diretoria Executiva e Gestores de Área",
    passos: [
      {
        numero: 1,
        titulo: "Consultar a Árvore Corporativa",
        descricao: "Visualize os centros de custos ativos divididos por área de atuação e empresa contratante (ex: CNH, Iveco, UVA, Porsche).",
      },
      {
        numero: 2,
        titulo: "Cadastrar ou Editar Centro de Custo",
        descricao: "Defina o código do CC (ex: CC-010), o nome do projeto/contrato, a unidade de negócio e o líder gestor responsável.",
        dica: "A vinculação correta do líder garante que os relatórios executivos do Painel por Líder exibam os dados precisos."
      },
      {
        numero: 3,
        titulo: "Acompanhar Orçado vs Realizado",
        descricao: "Analise a receita contratada, os custos acumulados e o saldo remanescente de horas e recursos alocados."
      }
    ],
    regrasImportantes: [
      "Cada atividade e faturamento DEVE estar atrelada a um Centro de Custo válido.",
      "Centros de Custo inativos preservam todo o histórico de medições e notas fiscais passadas para auditoria."
    ],
    faq: [
      {
        pergunta: "Quem pode criar novos Centros de Custo?",
        resposta: "Apenas usuários com perfil Administrador, Diretoria Executiva ou Financeiro & Controladoria possuem permissão de criação e edição estrutural."
      }
    ]
  },
  {
    id: "tabela-precos",
    menuNome: "Tabela de Preços",
    rota: "/tabela-precos",
    icone: "request_quote",
    categoria: "Financeiro",
    descricaoGeral: "Tarifário corporativo oficial da NNÓS, discriminando valores de venda/hora ao cliente e faixas de repasse por senioridade profissional.",
    publicoAlvo: "Financeiro, Líderes de Projeto e Diretoria",
    passos: [
      {
        numero: 1,
        titulo: "Consultar Tarifas por Cliente",
        descricao: "Verifique o valor/hora faturado para cada contrato homologado.",
      },
      {
        numero: 2,
        titulo: "Consultar Faixas de Repasse",
        descricao: "Consulte as faixas de valor hora para cada perfil de consultor: Júnior, Pleno, Sênior, Especialista e Diretor de Projeto.",
        dica: "As taxas servem como padrão automático na criação de turmas, podendo ser ajustadas conforme regras contratuais."
      }
    ],
    regrasImportantes: [
      "Alterações na tabela de preços aplicam-se a novas atividades criadas a partir da data de vigência.",
      "Valores históricos de turmas já homologadas ou faturadas permanecem inalterados."
    ],
    faq: [
      {
        pergunta: "O que acontece se uma turma tiver valor diferente da tabela?",
        resposta: "O usuário com permissão pode ajustar manualmente o valor na criação da atividade, gerando alerta de desvio de margem caso o repasse ultrapasse o teto percentual."
      }
    ]
  },
  {
    id: "pessoas",
    menuNome: "Pessoas & Prestadores de Serviços",
    rota: "/pessoas",
    icone: "group",
    categoria: "Operacional",
    descricaoGeral: "Cadastro centralizado de consultores parceiros (PJ), colaboradores CLT e sócios executivos. Controle de documentação, dados bancários, PIX, contratos e aeroportos base.",
    publicoAlvo: "RH, Controladoria, Apoio Administrativo e Diretoria",
    passos: [
      {
        numero: 1,
        titulo: "Buscar e Filtrar Integrantes",
        descricao: "Filtre por vínculo (Todos, Parceiros PJ, Funcionários CLT, Sócios), por perfil de senioridade ou busque por nome, CPF e CNPJ.",
      },
      {
        numero: 2,
        titulo: "Cadastrar Nova Pessoa",
        descricao: "Clique em 'Cadastrar Nova Pessoa'. Preencha os dados pessoais (Nome completo, CPF, Data de Nascimento, E-mail corporativo e Telefone/WhatsApp).",
        dica: "Para prestadores parceiros, selecione o vínculo 'Parceiro (PJ)' e preencha a Razão Social e CNPJ."
      },
      {
        numero: 3,
        titulo: "Configurar Dados Fiscais e Logística",
        descricao: "Informe a Chave PIX oficial, Banco, Agência e Conta. Defina a Cidade Base e o Aeroporto Preferencial (ex: CNF, GRU, CWB) para facilitar a cotação de viagens.",
      },
      {
        numero: 4,
        titulo: "Salvar e Homologar",
        descricao: "Revise os dados e clique em 'Salvar Integrante'. A pessoa estará apta para alocação em projetos e recebimento de BMs."
      }
    ],
    regrasImportantes: [
      "Chave PIX e dados bancários devem obrigatoriamente estar em conformidade com o CNPJ do prestador (se PJ) ou CPF (se pessoa física).",
      "O e-mail cadastrado é utilizado como destinatário dos disparos do Zoho Sign e comunicados de viagem."
    ],
    faq: [
      {
        pergunta: "Qual a diferença entre Parceiro PJ e Sócio Consultor?",
        resposta: "Parceiro PJ é um consultor/prestador credenciado que atua sob contrato de prestação de serviços. Sócio Consultor faz parte do quadro societário corporativo da NNÓS e possui regra fiscal específica de 6% sobre NFs."
      }
    ]
  },
  {
    id: "faturamento",
    menuNome: "Faturamento",
    rota: "/faturamento",
    icone: "receipt",
    categoria: "Financeiro",
    descricaoGeral: "Painel analítico e emissão de Notas Fiscais para clientes corporativos, apuração de impostos (12,25%), retenções na fonte e conciliação de recebimentos.",
    publicoAlvo: "Financeiro, Fiscal e Diretoria",
    passos: [
      {
        numero: 1,
        titulo: "Consultar Turmas Prontas para Faturar",
        descricao: "Filtre por competência e cliente para visualizar todas as atividades concluídas com medição aprovada.",
      },
      {
        numero: 2,
        titulo: "Registrar Emissão de Nota Fiscal",
        descricao: "Informe o Número da NF emitida, data de emissão e data de vencimento (conforme prazo contratual do cliente: 30, 45 ou 60 dias).",
        dica: "O sistema deduz automaticamente a carga tributária estimada de 12,25% para cálculo da receita líquida."
      },
      {
        numero: 3,
        titulo: "Conciliar Recebimento",
        descricao: "Ao identificar o crédito em conta corrente, registre a liquidação da NF, atualizando os relatórios financeiros de DRE."
      }
    ],
    regrasImportantes: [
      "Alíquota de Impostos Tributários: padrão de 12,25% sobre a receita bruta faturada.",
      "As datas de emissão e vencimento devem seguir o padrão brasileiro DD/MM/AAAA."
    ],
    faq: [
      {
        pergunta: "Como consultar notas em atraso de pagamento?",
        resposta: "No topo do módulo de Faturamento, clique no card de status 'Em Aberto / Vencidas' para filtrar instantaneamente todas as duplicatas pendentes."
      }
    ]
  },
  {
    id: "pagamentos",
    menuNome: "Pagamentos & Contas a Pagar",
    rota: "/pagamentos",
    icone: "payments",
    categoria: "Financeiro",
    descricaoGeral: "Programação e liquidação de contas a pagar: repasses de BMs a consultores, faturas de agências de viagens e fornecedores corporativos.",
    publicoAlvo: "Financeiro e Tesouraria",
    passos: [
      {
        numero: 1,
        titulo: "Filtrar por Vencimento e Status",
        descricao: "Consulte os compromissos financeiros ordenados por data de vencimento.",
      },
      {
        numero: 2,
        titulo: "Conferir Chave PIX e Comprovante",
        descricao: "Ao liquidar um pagamento de BM, utilize a chave PIX já validada no cadastro do consultor.",
      },
      {
        numero: 3,
        titulo: "Marcar como Pago",
        descricao: "Clique em 'Confirmar Pagamento' e anexe o comprovante bancário caso necessário.",
        dica: "O status do BM correspondente no Portal do Consultor é atualizado para 'PAGO'."
      }
    ],
    regrasImportantes: [
      "Pagamentos de medição requerem BM devidamente homologado pela Controladoria.",
      "Lançamentos pagos integram em tempo real a linha de custos operacionais do DRE."
    ],
    faq: [
      {
        pergunta: "Como exportar a remessa de pagamentos para o banco?",
        resposta: "Utilize o botão 'Exportar Lote PIX / Excel' no canto superior direito da tabela de pagamentos."
      }
    ]
  },
  {
    id: "relatorios",
    menuNome: "Central de Relatórios & DRE",
    rota: "/relatorios",
    icone: "bar_chart",
    categoria: "Gestão & Diretoria",
    descricaoGeral: "Demonstrativos consolidados em tempo real: DRE Gerencial, Relatório Financeiro YTD, Painel Executivo por Líder de Projeto, Contas a Pagar Campus BH UVA e Despesas de Prospecção.",
    publicoAlvo: "Sócios Diretores, Líderes de Projeto e Controladoria",
    passos: [
      {
        numero: 1,
        titulo: "Acessar o Painel de Relatórios 2026",
        descricao: "Selecione o demonstrativo que deseja consultar: DRE Gerencial, Painel por Líder, Campus BH UVA, Performance de Projetos ou Despesas de Prospecção.",
      },
      {
        numero: 2,
        titulo: "Painel Financeiro por Líder de Projeto",
        descricao: "Demonstra o faturamento consolidado, custos operacionais, impostos tributários (12,25%), logística e a margem líquida realizada de cada gestor.",
        dica: "As raias de projetos exibem a rentabilidade individual de cada contrato da carteira com leitura nativa em tempo real."
      },
      {
        numero: 3,
        titulo: "Visualizar Ranking de Rentabilidade",
        descricao: "Acesse a aba 'Ranking de Rentabilidade' para comparar os Top 20 projetos mais lucrativos e identificar contratos que demandam correção de rota.",
      },
      {
        numero: 4,
        titulo: "Exportar Demonstrações",
        descricao: "Utilize o botão de impressão/PDF ou exportação para gerar demonstrativos executivos para reuniões de diretoria."
      }
    ],
    regrasImportantes: [
      "Líderes de projeto em modo restrito visualizam exclusivamente os projetos sob sua liderança direta.",
      "Usuários com perfil Administrador e Diretoria possuem visão holística de todo o portfólio da NNÓS."
    ],
    faq: [
      {
        pergunta: "Por que a margem de um projeto aparece com cor verde ou vermelha?",
        resposta: "Projetos com margem operacional acima de 25% recebem a tag 'Margem Saudável' (verde), enquanto margens comprimidas ou negativas acionam alertas visuais amarelos ou vermelhos."
      }
    ]
  },
  {
    id: "consultor",
    menuNome: "Portal do Consultor",
    rota: "/consultor",
    icone: "badge",
    categoria: "Consultoria",
    descricaoGeral: "Área exclusiva para consultores e instrutores acompanharem sua agenda de treinamentos confirmados, vouchers de viagens corporativas, histórico de BMs e status de pagamentos.",
    publicoAlvo: "Consultores Parceiros, Sócios Especialistas e Instrutores",
    passos: [
      {
        numero: 1,
        titulo: "Consultar Minha Agenda",
        descricao: "Visualize seu calendário de turmas confirmadas, cliente, cidade e concessionária de atendimento.",
      },
      {
        numero: 2,
        titulo: "Minhas Viagens & Vouchers",
        descricao: "Acompanhe as viagens programadas. Ao entrar, o sistema aplica automaticamente o filtro da competência do mês atual.",
        dica: "Clique em 'Ver Detalhes' para visualizar horários de voos, localizadores de passagens aéreas e confirmações de hotel."
      },
      {
        numero: 3,
        titulo: "Consultar Políticas de Viagem",
        descricao: "No banner de Orientações, clique nas miniaturas oficiais para abrir o PDF das políticas: CNH Training, Iveco Group, NNÓS Consultoria ou Reembolso Vexpenses.",
      },
      {
        numero: 4,
        titulo: "Assinatura de BMs",
        descricao: "Confira o resumo mensal de horas na aba 'Meus BMs' e acompanhe a homologação e pagamento na aba 'Meus Pagamentos'."
      }
    ],
    regrasImportantes: [
      "O viajante deve conferir com antecedência para qual cliente estará viajando para seguir a política de despesas homologada.",
      "Se não houver política do cliente contratante, a política padrão aplicável é a da NNÓS Consultoria."
    ],
    faq: [
      {
        pergunta: "Como encontro meu voucher da passagem aérea?",
        resposta: "Em 'Minhas Viagens', clique no card da sua viagem confirmada; o arquivo PDF ou código localizador estará anexado na seção 'Vouchers & Reservas'."
      }
    ]
  },
  {
    id: "admin",
    menuNome: "Administração & Perfis de Acesso",
    rota: "/admin",
    icone: "admin_panel_settings",
    categoria: "Segurança",
    descricaoGeral: "Gestão completa de credenciais de usuários, controle de permissões por perfil (RBAC), configuração de Autenticação em Duas Etapas (2FA / Google Authenticator) e logs de auditoria.",
    publicoAlvo: "Administradores do Sistema (Leonardo Campos)",
    passos: [
      {
        numero: 1,
        titulo: "Gerenciar Usuários e Credenciais",
        descricao: "Cadastre novos usuários, redefina senhas ou vincule o usuário ao respectivo perfil (Admin, Diretoria, Líder, Financeiro, Agência, Sócio, Consultor).",
      },
      {
        numero: 2,
        titulo: "Configurar Matriz de Permissões (RBAC)",
        descricao: "Acesse a aba 'Matriz de Permissões' para habilitar ou restringir menus, abas e ações críticas (como homologar financeiro ou disparar Zoho Sign) por perfil.",
        dica: "As alterações de perfis sincronizam automaticamente com a nuvem do Supabase."
      },
      {
        numero: 3,
        titulo: "Ativar Autenticação em Duas Etapas (2FA)",
        descricao: "Gere o QR Code compatível com o aplicativo Google Authenticator para garantir máxima segurança no acesso às contas administrativas.",
      },
      {
        numero: 4,
        titulo: "Consultar Logs de Auditoria",
        descricao: "Acompanhe na aba 'Logs de Acesso' todos os eventos de login, logout, alterações de senhas e operações sensíveis com IP e dispositivo registrado."
      }
    ],
    regrasImportantes: [
      "O usuário 'Coordenação Central NNÓS' foi descontinuado; o acesso administrativo principal pertence a Leonardo Campos.",
      "O 2FA TOTP é altamente recomendado para todos os perfis com acesso financeiro e gerencial."
    ],
    faq: [
      {
        pergunta: "Como um líder de projeto tem seu acesso liberado?",
        resposta: "Basta cadastrar o usuário com o perfil 'Líder de Projeto' e selecionar o nome correspondente no campo 'Líder Vinculado'."
      }
    ]
  }
];

