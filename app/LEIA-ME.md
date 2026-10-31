# Código do app (Mercado e Investimentos)

O app publicado é um único arquivo, `index.html`, montado a partir dos módulos desta pasta.
**Nunca edite o `index.html` à mão**: edite os módulos e rode a montagem.

## Como funciona

| Arquivo | O que é |
|---|---|
| `shell.html` | A página: cabeçalho, menus e a marcação das telas. Tem três marcadores: `/*@CSS*/`, `/*@JS*/` e `'sha256-@HASH'`. |
| `css/*.css` | Os estilos, juntados em ordem alfabética no lugar de `/*@CSS*/`. |
| `js/<área>/NNN-nome.js` | O código, em pastas por área, juntado na ordem do número (`000`, `005`, …) no lugar de `/*@JS*/`. A pasta não muda a ordem: só o número. |
| `build.py` | Faz a montagem e calcula o hash do script para a política de segurança (CSP). |

Todo o código roda dentro de uma única função, aberta em `js/000-…` e fechada no último arquivo. Por isso os
módulos enxergam os nomes uns dos outros, como se fossem um arquivo só, e **a ordem importa**: uma constante
(`const`, `let`) só pode ser usada depois do arquivo em que é declarada; funções (`function`) podem ser usadas
de qualquer lugar. Para um módulo novo, escolha um número livre na posição certa (os números vão de 5 em 5
justamente para sobrar espaço). O número não pode se repetir; a montagem avisa se isso acontecer.

## Rotina para qualquer mudança

```
python app/build.py              # monta o index.html
python tests/robos.py            # cálculos dos robôs (sem internet)
python tests/numeros.py          # números do app: preços, impostos, TIR, risco… (abre o app num navegador sem tela)
python tests/checagem.py         # percorre todas as telas procurando erros
```

No GitHub, a checagem automática faz tudo isso em cada pull request e **recusa** a publicação se o
`index.html` não for exatamente o que os módulos geram (`python app/build.py --check`), se algum número não
bater com os casos conhecidos ou se alguma tela der erro. O ramo principal (`main`) é protegido: nada entra
sem passar.

## Testes dos números (`tests/numeros.py`)

Abre o app com `?teste=1`, que expõe as funções de cálculo em `window.APPT` (o gancho fica em
`js/622-ganchos-de-teste.js`; sem `?teste=1` nada é exposto), e confere contra casos com resposta conhecida:
dias úteis de 2024 e 2025 (253 e 252), a posição real de uma carteira com aplicações e resgates (cotas, ganho, IR por lote e TIR), feriados, IR regressivo, tabela oficial do IOF, preços de LTN, NTN-F e
NTN-B refeitos de forma independente pela metodologia da ANBIMA, **os preços publicados do dia pelo Tesouro
Direto e pela ANBIMA** (pelo menos 95% precisam bater), TIR, curva Nelson-Siegel-Svensson, equivalência
LCI × CDB, volatilidade, retorno e perda máxima numa série sintética, teste de estresse e o comparador de
investimento no exterior. Os testes dos robôs (`tests/robos.py`) conferem a montagem dos balanços da SEC
(trimestres, 12 meses, moeda, retificações), os indicadores, a ligação BDR → empresa, os juros de prazo
constante, o Focus semanal e a leitura das páginas do Fed e da EIA.

## Módulos


**`js/1-nucleo/`** — Núcleo: datas, calendário, VNA, preços dos títulos, dados embutidos

- `000-inicio-day.js` (1 KB)
- `005-series-historicas-embutidas.js` — séries históricas embutidas (3 KB)
- `010-retrato-de-mercado-embutido-substituido.js` — retrato de mercado embutido (substituído pelo botão Atualizar) (7 KB)
- `015-calendario.js` — calendário (1 KB)
- `020-numeros.js` — números (1 KB)
- `025-estado-de-mercado.js` — estado de mercado (1 KB)
- `030-vna.js` — VNA (2 KB)
- `035-precificacao.js` — precificação (1 KB)
- `040-aplicacao-dos-dados-de-mercado.js` — aplicação dos dados de mercado (3 KB)
- `045-conferencia-cada-taxa-baixada-precisa.js` — conferência: cada taxa baixada precisa reproduzir o preço publicado (2 KB)
- `050-interface.js` — interface (9 KB)
- `055-fluxo.js` — fluxo (1 KB)
- `060-grafico.js` — gráfico (4 KB)

**`js/2-calculadora/`** — Calculadora de títulos, crédito privado, IR/IOF e cenários

- `065-credito-privado-motor-de-calculo.js` — Crédito privado: motor de cálculo (1 KB)
- `070-dados-cdi-runs-raw.js` (24 KB)
- `075-cdi-runs-end.js` (14 KB)
- `080-credito-privado-interface.js` — Crédito privado: interface (27 KB)
- `085-cenarios-de-juros.js` — Cenários de juros (17 KB)
- `090-ir-iof-e-custodia.js` — IR, IOF e custódia (2 KB)
- `095-vender-agora-x-manter-ate.js` — Vender agora x manter até o vencimento (1 KB)
- `100-precos-de-resgate-do-tesouro.js` — Preços de resgate do Tesouro Direto (1 KB)
- `105-banco-de-dados-carteira-e.js` — Banco de dados: carteira e histórico (1 KB)
- `110-carteiras-varias-e-planilha.js` — Carteiras (várias) e planilha (1 KB)
- `115-resultado-essencial-a-vista-memoria.js` — resultado: essencial à vista, memória de cálculo recolhida (1 KB)
- `120-historico.js` — Histórico (1 KB)
- `125-alertas.js` — Alertas (1 KB)

**`js/3-assessor-original/`** — Carteiras e ferramentas do assessor (versão original do app)

- `130-nota-de-corretagem.js` — Nota de corretagem (1 KB)
- `135-dados-tx.js` (378 KB)
- `140-inicio.js` (1 KB)
- `145-historico-de-taxas-tesouro-direto.js` — Histórico de taxas (Tesouro Direto, dia a dia) (12 KB)
- `150-renda-fixa-bancaria-cdb-rdb.js` — Renda fixa bancária (CDB, RDB, LCI, LCA, LC, LCD, LIG, LF) (4 KB)
- `155-aba.js` — aba (4 KB)
- `160-carteiras-agenda-evolucao-risco-fgc.js` — Carteiras: agenda, evolução, risco, FGC, exportação, importação B3 (1 KB)
- `165-agenda-de-pagamentos.js` — agenda de pagamentos (5 KB)
- `170-evolucao.js` — evolução (1 KB)
- `175-risco.js` — risco (1 KB)
- `180-fgc.js` — FGC (1 KB)
- `185-exportacao.js` — exportação (1 KB)
- `190-importacao-do-arquivo-de-posicao.js` — importação do arquivo de posição da B3 (1 KB)
- `195-alocacao-metas-assistente-alertas-de.js` — Alocação, metas, assistente, alertas de taxa, simuladores (1 KB)
- `200-10-alocacao-e-concentracao.js` — 10. alocação e concentração (1 KB)
- `205-11-metas-e-projecao.js` — 11. metas e projeção (1 KB)
- `210-9-assistente.js` — 9. assistente (1 KB)
- `215-13-alertas-de-taxa-de.js` — 13. alertas de taxa de qualquer título do Tesouro (1 KB)
- `220-14-equivalencia-lci-lca-cdb.js` — 14. equivalência LCI/LCA × CDB (2 KB)
- `225-12-escada-de-vencimentos.js` — 12. escada de vencimentos (12 KB)
- `230-modo-assessor-clientes-movimentacoes-enc.js` — Modo assessor: clientes, movimentações, encerradas (1 KB)
- `235-movimentacoes-vendas-e-resgates.js` — movimentações: vendas e resgates (1 KB)
- `240-tese-custodiante-e-revisao.js` — tese, custodiante e revisão (1 KB)
- `245-posicoes-encerradas.js` — posições encerradas (1 KB)
- `250-livro-de-movimentacoes.js` — livro de movimentações (1 KB)
- `255-imposto-de-renda-ano-calendario.js` — imposto de renda (ano-calendário) (1 KB)
- `260-projecao-de-inflacao-implicita-anbima.js` — Projeção de inflação: implícita (ANBIMA) ou média dos últimos 12 meses (1 KB)
- `265-rentabilidade-real-twr-mensal-e.js` — Rentabilidade real: TWR mensal e TIR da carteira (1 KB)
- `270-analise-de-troca.js` — Análise de troca (1 KB)
- `275-painel-de-mercado.js` — Painel de mercado (8 KB)
- `280-teste-de-estresse.js` — Teste de estresse (1 KB)
- `285-fluxo-de-caixa-e-compromissos.js` — Fluxo de caixa e compromissos (1 KB)
- `290-rebalanceamento-com-aporte.js` — Rebalanceamento com aporte (1 KB)
- `295-enquadramento-politica-do-cliente.js` — Enquadramento (política do cliente) (1 KB)
- `300-painel-do-assessor.js` — Painel do assessor (1 KB)
- `305-relatorio-do-cliente-pdf.js` — Relatório do cliente (PDF) (1 KB)
- `310-fundos-de-investimento-e-previdencia.js` — Fundos de investimento e previdência (pelo CNPJ) (6 KB)
- `315-aba.js` — aba (6 KB)
- `320-relacionamento-com-o-cliente-contatos.js` — Relacionamento com o cliente: contatos e comentário do relatório (1 KB)
- `325-gestao-de-risco-fase-1.js` — Gestão de risco · fase 1 (1 KB)
- `330-classificacao-setorial-da-b3.js` — Classificação setorial da B3 (1 KB)
- `335-gestao-de-risco-fase-2.js` — Gestão de risco · fase 2 (1 KB)
- `340-fase-3-suitability-tributacao-ideias.js` — Fase 3: suitability, tributação, ideias, atribuição, benchmark, backup, auditoria, conciliação B3, eventos de debêntures (1 KB)
- `345-rotina-meu-dia-saude-dos.js` — Rotina: Meu dia, saúde dos dados, importação de documentos (6 KB)
- `350-proposta-de-investimento.js` — Proposta de investimento (1 KB)
- `355-rebalanceamento-com-vendas-escolhe-os.js` — Rebalanceamento com vendas (escolhe os lotes de menor custo) (1 KB)
- `360-indicadores-kpis-e-saude-da.js` — Indicadores (KPIs) e saúde da carteira (1 KB)
- `365-navegacao-por-grupos-indicadores-no.js` — Navegação por grupos, indicadores no PDF, histórico mensal dos indicadores (1 KB)
- `370-objetivos-indicadores-de-todos-os.js` — Objetivos, indicadores de todos os clientes, alertas de piora, cenários em linguagem natural (1 KB)
- `375-layout-para-desktop-barra-lateral.js` — Layout para desktop: barra lateral, faixa de indicadores (1 KB)
- `380-patrimonio-consolidado-conta-do-cliente.js` — Patrimônio consolidado, conta do cliente e modo reunião (1 KB)
- `385-concentracao-na-analise-de-risco.js` — Concentração na análise de risco (1 KB)
- `390-nome-do-produto-como-no.js` — nome do produto, como no extrato (ex.: CRA - BRF) (1 KB)
- `395-extrato-curva-x-mercado-e.js` — extrato: curva x mercado e calibragem pelo PU do banco (2 KB)
- `400-excluir-titulos-e-carteira-inteira.js` — excluir títulos e carteira inteira (1 KB)
- `405-nivel-de-confianca-do-calculo.js` — nível de confiança do cálculo de cada posição (1 KB)
- `410-leitura-do-documento-oficial-termo.js` — leitura do documento oficial (termo / escritura) (1 KB)
- `415-atualizacao-de-dados.js` — atualização de dados (1 KB)
- `420-curvas-de-juros-ettj-anbima.js` — Curvas de juros (ETTJ ANBIMA): atual, 1 dia, 1 semana, 1 mês e 1 ano atrás (11 KB)

**`js/4-fundos/`** — Fundos (CVM)

- `425-fundos-analise-ranking-e-comparador.js` — Fundos: análise, ranking e comparador com os dados oficiais da CVM (2 KB)
- `430-carga.js` — carga (4 KB)
- `435-series-e-retornos.js` — séries e retornos (2 KB)
- `440-indicadores-de-risco.js` — indicadores de risco (3 KB)
- `445-graficos.js` — gráficos (6 KB)
- `450-telas.js` — telas (27 KB)
- `455-fnrklist.js` (7 KB)

**`js/5-bolsa/`** — Bolsa (B3 e CVM)

- `460-bolsa-acoes-units-fiis-fiagros.js` — Bolsa: ações, units, FIIs, Fiagros, ETFs e BDRs (B3 e CVM) (3 KB)
- `465-casca-e-carga.js` — casca e carga (2 KB)
- `470-pagina-do-ativo.js` — página do ativo (17 KB)
- `475-ranking.js` — ranking (4 KB)
- `480-eventos.js` — eventos (2 KB)

**`js/6-comparador-carteiras/`** — Comparador, simulador de carteiras e relatório em PDF

- `485-comparador-fundos-e-ativos-ate.js` — Comparador (fundos e ativos, até 25), janelas móveis, similares, gross-up, gestoras (21 KB)
- `490-janelas-moveis-na-pagina-do.js` — janelas móveis na página do fundo ou ativo (1 KB)
- `495-fundos-similares-e-gross-up.js` — fundos similares e gross-up (página do fundo) (5 KB)
- `500-gestoras-e-administradoras.js` — gestoras e administradoras (3 KB)
- `505-s-p-500-em-reais.js` — S&P 500 em reais com dividendos (ETF IVVB11, que reinveste os dividendos) como índice de referência: a Cboe só publica o S&P 500 sem dividendos (1 KB)
- `510-simulador-de-carteiras-fundos-ativos.js` — Simulador de carteiras: fundos, ativos da B3 e renda fixa (dados mensais) (29 KB)
- `515-spcorhtml.js` (26 KB)
- `520-spclasse.js` (5 KB)
- `525-relatorio-em-pdf-com-a.js` — Relatório em PDF com a identidade do escritório (14 KB)

**`js/7-saude-favoritos-alertas/`** — Agenda, saúde das fontes, favoritos, alertas e sincronização

- `530-agenda-de-proventos-situacao-das.js` — Agenda de proventos, situação das bases, app instalável e importação de posição (11 KB)
- `533-saude-das-fontes.js` — Mercado › Resumo: saúde das fontes (robô "Saúde das fontes", ramo saude) (6 KB)
- `535-fv.js` (24 KB)
- `540-risco.js` (3 KB)

**`js/8-mercado-eua-economia/`** — Mercado › Resumo, posição real, Bolsa americana, economia, estresse e exterior

- `545-proximas-divulgacoes-do-ibge-calendario.js` — Próximas divulgações do IBGE (calendário oficial, lido direto pelo navegador; se não carregar, a seção some) (1 KB)
- `550-mercado-resumo-capital-estrangeiro-banco.js` — Mercado › Resumo: capital estrangeiro (Banco Central) e risco-país implícito (3 KB)
- `555-sptemmov.js` (14 KB)
- `560-painel-de-indices-e-bolsa.js` — Painel de índices e Bolsa americana (Cboe, Nasdaq, Tesouro dos EUA, SEC; B3 e Banco Central) (10 KB)
- `565-bolsa-eua.js` — Bolsa › EUA (6 KB)
- `570-pagina-do-bdr-dados-da.js` — página do BDR: dados da empresa nos EUA (9 KB)
- `575-eventos.js` — eventos (1 KB)
- `580-economia-brasil-e-eua-e.js` — Economia (Brasil) e EUA e mundo: Focus, IBGE, Banco Central, Tesouro, BLS, Fed e EIA (1 KB)
- `585-economia-brasil.js` — Economia (Brasil) (12 KB)
- `590-eua-e-mundo.js` — EUA e mundo (11 KB)
- `595-carteira-exposicoes-e-teste-de.js` — Carteira: exposições e teste de estresse (modelo de fatores com retornos mensais) (9 KB)
- `600-bolsa-eua-comparar-formas-de.js` — Bolsa › EUA: comparar formas de investir no S&P 500 a partir do Brasil (7 KB)

**`js/9-mercado-abas-e-inicio/`** — Mercado: abas Juros, Crédito, Inflação, Índices e Dólar; dados dos robôs; inicialização

- `605-mercado-dados-das-abas-resumo.js` — Mercado: dados das abas Resumo, Juros, Crédito, Inflação e Índices (26 KB)
- `610-dolar-futuro-b3-e-dolar.js` — Dólar futuro (B3) e dólar justo (17 KB)
- `615-dolar-ptax-do-banco-central.js` — Dólar: PTAX do Banco Central (15 KB)
- `620-pcrebase.js` (1 KB)
- `622-ganchos-de-teste.js` — ganchos para os testes automáticos (tests/numeros.py): só existem com ?teste=1 no endereço (1 KB)
- `625-dados-do-robo-github-lidos.js` — dados do robô (GitHub) lidos direto pela página (12 KB)
