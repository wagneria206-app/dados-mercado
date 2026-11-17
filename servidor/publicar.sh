#!/usr/bin/env bash
# Publica o app com os dados mais recentes na Cloudflare (projeto wf-investimentos, domínio wfinvestimentos.com.br).
# O servidor só ENVIA: ninguém acessa o servidor; o app lê tudo da Cloudflare.
#
# Chamado pelo systemd (wf-publicar.service), com o usuário wf. A chave da Cloudflare chega pela variável
# CLOUDFLARE_API_TOKEN, lida pelo systemd do arquivo /etc/wf/cloudflare.env (só o administrador lê esse arquivo).
#   publicar.sh            publica se os dados mudaram desde a última publicação
#   publicar.sh --forcar   publica mesmo sem mudança
set -euo pipefail
WF=${WF:-/srv/wf}
CODIGO=$WF/codigo
DADOS=$WF/dados.git
PY=${PY:-/usr/bin/python3}
PROJETO=${WF_PROJETO:-wf-investimentos}
LIMITE_MES=${WF_LIMITE_MES:-450}          # o plano gratuito da Cloudflare aceita 500 publicações por mês
EST=$WF/publicar; mkdir -p "$EST"
export TMPDIR=${TMPDIR:-$WF/tmp}; mkdir -p "$TMPDIR"
export TZ=America/Sao_Paulo WRANGLER_SEND_METRICS=false HOME=$WF/home
mkdir -p "$HOME"
exec 9>"$EST/.trava"; flock -n 9 || { echo "publicação já em andamento"; exit 0; }

: "${CLOUDFLARE_API_TOKEN:?falta a chave da Cloudflare em /etc/wf/cloudflare.env}"
: "${CLOUDFLARE_ACCOUNT_ID:?falta o número da conta da Cloudflare em /etc/wf/cloudflare.env}"

# 1) os dados mudaram? (assinatura = os ramos de dados + a versão do código)
assin=$( { git --git-dir "$DADOS" for-each-ref --format='%(refname) %(objectname)' refs/heads; git -C "$CODIGO" rev-parse HEAD; } | sha256sum | cut -c1-16)
if [ "${1:-}" != "--forcar" ] && [ -f "$EST/ultima" ] && [ "$(cat "$EST/ultima")" = "$assin" ]; then
  echo "$(date '+%F %T') nada mudou desde a última publicação"; exit 0
fi

# 2) limite do mês (deixa folga para publicações à mão)
mes=$(date +%Y-%m); n=$(cat "$EST/$mes" 2>/dev/null || echo 0)
if [ "$n" -ge "$LIMITE_MES" ]; then echo "$(date '+%F %T') limite de $LIMITE_MES publicações no mês atingido; fica para o mês que vem"; exit 0; fi

# 3) monta o pacote (o mesmo formato dos pacotes enviados até aqui) e confere antes de enviar
pac=$(mktemp -d); trap 'rm -rf "$pac"' EXIT
WF_VERSAO=$(date '+%d/%m/%Y %H:%M') "$PY" "$CODIGO/servidor/exportar.py" --pacote "$DADOS" "$pac/site" "$CODIGO/index.html" local >/dev/null
[ -s "$pac/site/index.html" ] || { echo "pacote sem index.html"; exit 1; }
grep -q '<meta name="wf-senha" content="v1:' "$pac/site/index.html" || { echo "pacote sem a senha de acesso: não publico (WF_SENHA em /etc/wf/app.env)"; exit 1; }
narq=$(find "$pac/site" -type f | wc -l)
[ "$narq" -lt 19000 ] || { echo "pacote com $narq arquivos (limite da Cloudflare: 20 mil)"; exit 1; }
grande=$(find "$pac/site" -type f -size +24M | head -1)
[ -z "$grande" ] || { echo "arquivo acima de 24 MB: $grande"; exit 1; }
for r in site ativos fundos; do [ -d "$pac/site/dados/$r" ] || { echo "pacote sem os dados de $r: não publico"; exit 1; }; done

# 4) envia (só os arquivos que mudaram sobem; a Cloudflare compara pelo conteúdo)
"$WF/node/node_modules/.bin/wrangler" pages deploy "$pac/site" --project-name "$PROJETO" --branch main --commit-dirty=true \
  --commit-message "dados $(date '+%d/%m %H:%M')"
echo "$assin" > "$EST/ultima"; echo $((n + 1)) > "$EST/$mes"
echo "$(date '+%F %T') publicado ($narq arquivos; $((n + 1)) publicações em $mes)"
