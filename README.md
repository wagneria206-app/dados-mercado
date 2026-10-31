# dados-mercado

Robô que busca, todo dia útil, dados públicos oficiais e publica o app **Mercado e Investimentos**
(GitHub Pages: https://wagneria206-app.github.io/dados-mercado/).

## Onde ficam os dados

- **Ramo `main`**: o código dos robôs (`scripts/`), os módulos do app (`app/`, veja `app/LEIA-ME.md`),
  o app montado (`index.html`) e os testes (`tests/`). É protegido: só recebe mudanças que passam na checagem.
- **Ramos de dados** (reescritos a cada coleta, sem histórico): `site` (mercado, em `data/`), `ativos` (Bolsa),
  `fundos` (CVM), `eua` (Bolsa americana), `macro` (economia), `saude` (saúde das fontes) e `estado` (o que o
  robô de mercado guarda entre execuções: termos de securitização lidos, cronogramas de CRI/CRA, curvas e
  cotas mensais de fundos). **Não apague esses ramos.**

## Como o app é montado e testado

O `index.html` é gerado a partir dos módulos em `app/` (`python app/build.py`). Nunca edite o `index.html`
à mão. Os testes (`tests/robos.py`, `tests/numeros.py` e `tests/checagem.py`) rodam em cada pull request e
todo dia; a explicação completa está em `app/LEIA-ME.md`.

| Arquivo (ramo site) | Conteúdo | Fonte |
|---|---|---|
| `mercado.json` | Títulos públicos, Tesouro Direto, curva de juros, CDI, Selic, IPCA | ANBIMA, Tesouro Direto, Banco Central, IBGE |
| `td_historico.json` | Tesouro Direto: últimos 90 dias | Tesouro Direto |
| `debentures.json`, `cri_cra_anbima.json`, `taxas_hist.json` | Taxas indicativas e PU (e 60 dias de histórico) | ANBIMA |
| `catalogo_debentures.json` | Características e agenda de todas as debêntures | SND (debentures.com.br) |
| `cri_cra_cvm.json` | Dados de todos os CRI e CRA | CVM – informes mensais |
| `cri_cra_cronogramas.json` | Cronograma de pagamentos lido de cada termo de securitização | Fundos.NET |
| `fundos/XX.json`, `fundos_hist/XX.json` | Cotas e cadastro de todos os fundos (por início do CNPJ) e cotas de fim de mês desde 2021 | CVM – informe diário |
| `dolar.json` | Dólar PTAX: fechamento diário (compra e venda) desde 1995 e boletins do dia | Banco Central (PTAX) |
| `dolar_futuro.json` | Dólar futuro: preço de ajuste de cada vencimento do contrato DOL, dia a dia | B3 |
| `dolar_fundamentos.json` | Inflação dos EUA, dólar global, commodities, juros dos EUA e risco-país (para o dólar justo) | Banco Central, BLS, Fed de Nova York |
| `curvas_hist.json` | Curva de juros da ANBIMA dia a dia (parâmetros da ETTJ) | ANBIMA |
| `status.json` | Resultado de cada fonte na última execução | — |

**Quando roda:** coleta completa às 19h30 (dias úteis) e 8h (segunda a sábado); Tesouro Direto a cada
30 minutos, das 9h às 18h30 nos dias úteis (horário de Brasília). Para rodar na hora: aba **Actions** →
escolha o fluxo → **Run workflow**.

**Importante:** este repositório é público. Aqui ficam só dados de mercado.
Nada de nomes de clientes, posições ou valores de carteira.
