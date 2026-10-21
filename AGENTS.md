# Diretrizes de Desenvolvimento e Premissas de Negócio - NNÓS Gestão Financeira Projetos

## 1. Premissa Obrigatória de Datas (Formato Brasileiro)
- **Todas as datas exibidas no sistema (interfaces web, prévias, e-mails disparados aos viajantes, relatórios, modais, tabelas e cards) DEVEM obrigatoriamente seguir o formato brasileiro (`DD/MM/AAAA` ou `DD/MM/AAAA a DD/MM/AAAA`).**
- **Nunca** exibir datas no formato ISO (`YYYY-MM-DD`) diretamente para o usuário.
- Para formatação consistente e centralizada, sempre utilize o módulo `@/lib/date-utils`:
  - `formatarDataBR(data)` -> converte ISO/Date para `DD/MM/AAAA`.
  - `formatarPeriodoBR(dataInicial, dataFinal)` -> converte períodos para `DD/MM/AAAA a DD/MM/AAAA` (ou `DD/MM/AAAA` se data única).
  - `formatarDataHoraBR(data)` -> converte para `DD/MM/AAAA às HH:mm`.

## 2. Padrões de Qualidade & Testes (BugHunter)
- Explicar sempre o diagnóstico, a causa-raiz, a correção e os casos de teste recomendados.
- Manter código limpo, seguro, modular e com tratamento gracioso de valores nulos ou indefinidos.

## 3. Políticas de Viagem e Prestação de Contas
- Em **Orientações para Prestação de Contas** (e-mails disparados ao viajante e modais de prévia), deve constar expressamente que o viajante precisa verificar para qual empresa estará viajando.
- Se a empresa contratante não possuir política própria, a política oficial utilizada como regra geral é a da **NNÓS Consultoria**.
- As políticas disponíveis (CNH Training, Iveco Group, NNÓS Consultoria e Reembolso Vexpenses) devem ser exibidas em formato de miniatura e, ao clicar, abrir o respectivo PDF oficial.

## 4. Padrão Visual de Dropdowns Modernos (ModernDropdown)
- **Todos os seletores e dropdowns do sistema (filtros, seletores de ano, mês, área, status, unidades, perfis, etc.) DEVEM obrigatoriamente utilizar o componente centralizado `@/components/ModernDropdown`.**
- **Nunca** utilizar tags `<select>` nativas do navegador com caixas de opções cruas.
- Manter a experiência moderna com popover flutuante customizado, cantos arredondados (`border-radius: 12px`), sombra suave, ícones temáticos do Material Symbols e indicação visual de check no item selecionado.
- Novos módulos criados devem adotar este componente por padrão arquitetural.
