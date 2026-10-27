# dados-mercado

Robô que busca, todo dia útil, dados públicos oficiais e publica o app **Mercado e Títulos**
(GitHub Pages: https://wagneria206-app.github.io/dados-mercado/).

## Onde ficam os dados

- **Ramo `site`** (reescrito a cada coleta, sem histórico): os arquivos que o app lê, em `data/`.
- **Ramo `main`**: o código, o app (`index.html`) e o estado que o robô precisa guardar entre execuções
  (índice dos termos de securitização, cronogramas de CRI/CRA lidos, histórico mensal de cotas de fundos).

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
| `curvas_hist.json` | Curva de juros da ANBIMA dia a dia (parâmetros da ETTJ) | ANBIMA |
| `status.json` | Resultado de cada fonte na última execução | — |

**Quando roda:** coleta completa às 19h30 (dias úteis) e 8h (segunda a sábado); Tesouro Direto a cada
30 minutos, das 9h às 18h30 nos dias úteis (horário de Brasília). Para rodar na hora: aba **Actions** →
escolha o fluxo → **Run workflow**.

**Importante:** este repositório é público. Aqui ficam só dados de mercado.
Nada de nomes de clientes, posições ou valores de carteira.
