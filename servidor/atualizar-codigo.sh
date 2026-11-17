#!/usr/bin/env bash
# Atualiza o código do servidor (robôs e app) para uma versão do GitHub, só quando você mandar.
#   sudo wf-atualizar            mostra o que mudou entre a versão instalada e a mais recente, e pede confirmação
#   sudo wf-atualizar <commit>   leva para um commit específico (do ramo main)
# Segurança: só aceita commits do ramo main assinados pelo GitHub (os que entram pela revisão de pull request).
# Um commit sem a assinatura do GitHub é recusado, mesmo que esteja no repositório.
set -euo pipefail
WF=${WF:-/srv/wf}
CODIGO=$WF/codigo
[ "$(id -u)" = 0 ] || { echo "rode com sudo"; exit 1; }
git config --global --add safe.directory "$CODIGO" 2>/dev/null || true
export GNUPGHOME=/etc/wf/gnupg
atual=$(git -C "$CODIGO" rev-parse HEAD)
git -C "$CODIGO" fetch --quiet origin main
alvo=${1:-$(git -C "$CODIGO" rev-parse origin/main)}
alvo=$(git -C "$CODIGO" rev-parse --verify "$alvo^{commit}")
git -C "$CODIGO" merge-base --is-ancestor "$alvo" origin/main || { echo "o commit $alvo não está no ramo main: recusado"; exit 1; }
if ! git -C "$CODIGO" verify-commit "$alvo" 2>/dev/null; then
  echo "o commit $alvo não tem a assinatura do GitHub: recusado"; exit 1
fi
if [ "$alvo" = "$atual" ]; then echo "o servidor já está na versão mais recente ($(git -C "$CODIGO" log -1 --format='%h %s' "$atual"))"; exit 0; fi
echo "Versão instalada: $(git -C "$CODIGO" log -1 --format='%h %ad %s' --date=format:'%d/%m/%Y' "$atual")"
echo "Nova versão:      $(git -C "$CODIGO" log -1 --format='%h %ad %s' --date=format:'%d/%m/%Y' "$alvo")"
echo; echo "Mudanças:"; git -C "$CODIGO" log --format='  %h %s' "$atual..$alvo" | head -40
echo; read -r -p "Atualizar? (digite sim) " r; [ "$r" = sim ] || { echo "nada mudou"; exit 0; }
git -C "$CODIGO" -c advice.detachedHead=false checkout --quiet "$alvo"
chown -R root:wf "$CODIGO"; chmod -R g-w,o-rwx "$CODIGO"
install -m 755 "$CODIGO/servidor/wf-status.sh" /usr/local/bin/wf-status
install -m 755 "$CODIGO/servidor/atualizar-codigo.sh" /usr/local/sbin/wf-atualizar
cp "$CODIGO"/servidor/systemd/* /etc/systemd/system/ && systemctl daemon-reload
echo "Atualizado. A próxima publicação leva o app novo ao ar (ou rode: sudo systemctl start wf-publicar)."
