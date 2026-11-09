#!/usr/bin/env bash
# Roda um robô no servidor, do mesmo jeito que rodava no GitHub, e publica o resultado para o app.
#   rodar.sh <robô> [argumentos]
#   robôs: ativos, eua, fundos, macro, insiders (pasta de entrada → pasta de saída), atualizar, rapido (dados do site),
#          saude (confere tudo), exportar (só republica)
# Os dados ficam num repositório git local (um ramo por robô, como no GitHub). Depois de cada coleta bem-sucedida o
# ramo é trocado de uma vez e exportado para a pasta que o servidor web entrega ao app.
set -uo pipefail
WF=${WF:-/srv/wf}
CODIGO=$WF/codigo            # cópia do código (repositório no GitLab)
DADOS=$WF/dados.git          # ramos de dados
TRAB=$WF/trabalho            # pasta de trabalho do robô do site (scripts + data/)
WWW=$WF/www                  # o que o servidor web entrega (https://dados.wfinvestimentos.com.br/)
LOGS=$WF/logs
PY=$WF/venv/bin/python
ROBO=${1:?informe o robô}; shift || true
mkdir -p "$LOGS" "$WWW"
exec 9>"$WF/.trava-$ROBO"; flock -n 9 || { echo "$(date '+%F %T') $ROBO já está rodando; esta vez fica de fora"; exit 0; }
export TZ=America/Sao_Paulo PYTHONUNBUFFERED=1

publicar() {  # publicar <ramo> <pasta> [prefixo]: grava o conteúdo da pasta como o ramo (sem histórico, como antes)
  local ramo=$1 pasta=$2 idx; idx=$(mktemp)
  GIT_INDEX_FILE=$idx git --git-dir "$DADOS" --work-tree "$pasta" add -A . >/dev/null
  local arvore; arvore=$(GIT_INDEX_FILE=$idx git --git-dir "$DADOS" write-tree)
  local c; c=$(git --git-dir "$DADOS" -c user.name=robo-dados -c user.email=robo@wfinvestimentos.com.br commit-tree "$arvore" -m "$ramo $(date '+%F %H:%M')")
  git --git-dir "$DADOS" update-ref "refs/heads/$ramo" "$c"
  git --git-dir "$DADOS" update-ref "refs/remotes/origin/$ramo" "$c"   # o robô de saúde lê origin/<ramo>
  rm -f "$idx"
}
entrada() {  # entrada <ramo> <pasta>: copia o ramo atual para a pasta de entrada do robô
  if git --git-dir "$DADOS" rev-parse -q --verify "refs/heads/$1" >/dev/null; then
    git --git-dir "$DADOS" archive "refs/heads/$1" | tar -x -C "$2"
  fi
}
exportar() { "$PY" "$CODIGO/servidor/exportar.py" "$DADOS" "$WWW" "$@"; }

inicio=$(date +%s); st=0
case "$ROBO" in
  ativos|eua|fundos|macro|insiders)
    ent=$(mktemp -d) sai=$(mktemp -d)
    entrada "$ROBO" "$ent"
    ( cd "$CODIGO" && "$PY" "scripts/$ROBO.py" "$ent" "$sai" "$@" ); st=$?
    if [ $st = 0 ] && [ -n "$(ls -A "$sai")" ]; then publicar "$ROBO" "$sai" && exportar "$ROBO"; fi
    rm -rf "$ent" "$sai" ;;
  atualizar|rapido)
    mkdir -p "$TRAB/data"
    rsync -a --delete --exclude data --exclude .git "$CODIGO/" "$TRAB/"
    if [ -z "$(ls -A "$TRAB/data")" ]; then t=$(mktemp -d); entrada site "$t"; cp -a "$t/data/." "$TRAB/data/" 2>/dev/null; entrada estado "$t"; cp -an "$t/data/." "$TRAB/data/" 2>/dev/null; rm -rf "$t"; fi
    if [ "$ROBO" = rapido ]; then ( cd "$TRAB" && "$PY" scripts/atualizar.py --rapido ); st=$?
    else ( cd "$TRAB" && "$PY" scripts/atualizar.py "$@" ); st=$?; fi
    # o site é publicado mesmo com falha de alguma fonte (como no GitHub): o robô guarda o último dado bom de cada uma
    pub=$(mktemp -d); mkdir -p "$pub/data"; cp -a "$TRAB/data/." "$pub/data/"
    publicar site "$pub"; rm -rf "$pub"
    est=$(mktemp -d); mkdir -p "$est/data"
    for p in termos cri_cra_cronogramas.json papeis_cadastrados.json curvas_hist.json fundos_hist; do [ -e "$TRAB/data/$p" ] && cp -a "$TRAB/data/$p" "$est/data/"; done
    publicar estado "$est"; rm -rf "$est"
    exportar site ;;
  saude)
    sai=$(mktemp -d)
    ( cd "$CODIGO" && GIT_DIR="$DADOS" "$PY" scripts/saude.py "$sai" ); st=$?
    [ -n "$(ls -A "$sai")" ] && publicar saude "$sai" && exportar saude
    rm -rf "$sai" ;;
  exportar) exportar "$@" ;;
  *) echo "robô desconhecido: $ROBO"; exit 2 ;;
esac
echo "$(date '+%F %T') $ROBO terminou com código $st em $(( $(date +%s) - inicio )) s"
exit $st
