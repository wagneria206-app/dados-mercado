# dados-mercado

Robô que busca, todo dia útil, dados públicos oficiais para o app **Mercado e Títulos**
e grava os arquivos prontos na pasta `data/`.

| Arquivo | Conteúdo | Fonte |
|---|---|---|
| `data/mercado.json` | Retrato do dia (títulos públicos, Tesouro Direto, CDI, Selic, IPCA) | ANBIMA, Tesouro Transparente, Banco Central, IBGE |
| `data/td_historico.json` | Preços e taxas do Tesouro Direto dos últimos 90 dias | Tesouro Transparente |
| `data/debentures.json` | Taxa indicativa e PU de todas as debêntures | ANBIMA |
| `data/fundos.json` | Cotas dos fundos listados em `config/fundos.txt` | CVM |
| `data/status.json` | Resultado de cada fonte na última execução | — |

**Quando roda:** coleta completa às 19h30 (dias úteis) e 8h (segunda a sábado); Tesouro Direto a cada 30 minutos, das 9h às 18h30 nos dias úteis (horário de Brasília).

**App:** a página `index.html` (Mercado e Títulos: Mercado, Simular e Calcular título) é publicada pelo GitHub Pages e lê os arquivos de `data/` a cada 30 minutos. Ela não guarda dados de clientes.
Para rodar na hora: aba **Actions** → *Atualizar dados de mercado* → **Run workflow**.

**Importante:** este repositório é público. Aqui ficam só dados de mercado.
Nada de nomes de clientes, posições ou valores de carteira.
