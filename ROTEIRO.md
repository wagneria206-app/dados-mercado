# Roteiro: o app completo de investimentos

Objetivo: um único app para **acompanhar** a carteira, **avaliar o risco**, **rebalancear** e **encontrar novas
oportunidades**, sempre com dados oficiais. Dados de clientes ficam só no repositório privado (código ou apelido,
nunca nome completo). Este arquivo guarda o plano combinado em 01/11/2026; cada item marcado [x] já está no ar.

Referências de mercado consultadas: Gorila (consolidação para escritórios), Morningstar X-Ray (exposição real
e sobreposição entre fundos), Mais Retorno (filtros e comparadores de fundos), Kinvo, Status Invest.

## Fase 1 — base do assessor (acompanhar → avaliar → agir)

- [ ] **Painel de indicadores da carteira (dashboard)**: patrimônio, rentabilidade no mês, no ano, em 12 meses e
      desde o início (e % do CDI), ganho, TIR, volatilidade, perda máxima, Sharpe, liquidez, concentração,
      alocação por classe contra a política, exposição ao FGC, próximos eventos.
- [ ] **Classe de cada item** (pós-fixado, prefixado, inflação, crédito privado, multimercado, ações Brasil,
      internacional, imobiliário, cripto, ouro/commodities, outros), com ajuste manual.
- [ ] **Política de investimento por carteira**: perfil (conservador, moderado, arrojado ou personalizado),
      alocação-alvo e limites por classe; enquadramento com alerta.
- [ ] **Rebalanceamento sugerido**: desvio em relação ao alvo; quanto aplicar em cada item só com o aporte e,
      se preciso, as vendas mínimas, levando em conta IR, IOF, come-cotas, prazo de resgate e carência.
- [ ] **Liquidez da carteira**: quanto dá para resgatar em D+0, D+1, até D+5, até D+30 e acima, pelo prazo de
      resgate da CVM; **quando faltar o dado, o usuário informa à mão** (prazo de resgate e carência por item).
- [ ] **Crédito e FGC**: concentração por emissor/conglomerado e limite de R$ 250 mil por instituição;
      emissor informado nos itens de renda fixa bancária.
- [ ] **Fluxo de caixa da carteira**: calendário de cupons, amortizações, vencimentos e proventos previstos.
- [ ] **Painel do assessor**: todas as carteiras numa tela, com patrimônio, mês e ano contra o CDI e pendências
      (fora da política, vencimento próximo, fundo com problema).

## Fase 2 — risco profundo

- [ ] **Raio-X e sobreposição**: abrir a carteira de cada fundo (CDA da CVM) e somar a exposição real
      (ações, títulos públicos, crédito por emissor, exterior, caixa); mostrar **sobreposição entre os fundos**
      ("diversificado ou só pulverizado?") e o número efetivo de posições.
- [ ] **Risco de mercado da carteira**: VaR e CVaR históricos, duration da renda fixa, divisão pós/pré/IPCA/dólar.
- [ ] **Benchmark personalizado e meta** (ex.: 70% CDI + 30% Ibovespa; IPCA + 5%).
- [ ] **Atribuição de resultado**: quanto cada classe e cada item contribuiu no mês e no ano.

## Fase 3 — descoberta de oportunidades

- [ ] **Quartis e consistência por categoria**: quartil em 12, 24 e 36 meses e % de janelas acima do CDI/benchmark.
- [ ] **Buscador de crédito privado**: debêntures, CRI e CRA por taxa, spread sobre a NTN-B, duration,
      indexador e isenção.
- [ ] **Substitutos melhores** para cada item da carteira (mesma categoria, mais retorno, menos risco,
      menor taxa ou melhor liquidez), ligando a descoberta ao rebalanceamento.
- [ ] **Filtros salvos e busca por objetivo** (ex.: renda fixa D+1 acima de 105% do CDI, taxa até 0,5%).
- [ ] **Ideias automáticas** semanais (Tesouro em taxa historicamente alta, debêntures com spread acima do normal,
      fundos de 1º quartil que caíram mais que os pares).

## Pendências técnicas

- [ ] **ETFs**: incluir os ETFs de renda fixa (IMAB11, FIXA11, B5P211, LFTS11…), que hoje não entram na base da
      Bolsa, e melhorar a categoria (a B3 não informa o CNPJ; usar a lista oficial de ETFs da B3 com o nome completo
      e o índice de referência).
- Limite conhecido: taxas de CDB, LCI e LCA de bancos e corretoras não têm fonte pública oficial; esses produtos
  entram pela taxa contratada informada.
