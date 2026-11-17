#!/usr/bin/env bash
# Cópia de segurança diária dos dados do servidor num disco USB (etiqueta WFBACKUP), criptografada com o restic.
# O disco pode ficar ligado no servidor; se não estiver, a cópia do dia fica de fora e o aviso vai para o registro.
# Guarda: 14 cópias diárias, 8 semanais e 12 mensais. A senha da cópia está em /etc/wf/restic.senha (anote-a também
# em papel: sem ela, ninguém, nem você, abre a cópia).
set -euo pipefail
WF=${WF:-/srv/wf}
DISCO=/dev/disk/by-label/WFBACKUP
PONTO=/mnt/wf-backup
export RESTIC_REPOSITORY=$PONTO/restic RESTIC_PASSWORD_FILE=/etc/wf/restic.senha
if [ ! -e "$DISCO" ]; then echo "disco de backup (WFBACKUP) não está ligado: cópia de hoje não feita"; exit 0; fi
mkdir -p "$PONTO"
mountpoint -q "$PONTO" || mount -o nodev,nosuid,noexec "$DISCO" "$PONTO"
trap 'sync; umount "$PONTO" 2>/dev/null || true' EXIT
[ -d "$RESTIC_REPOSITORY" ] || restic init
restic backup --one-file-system --tag diario \
  "$WF/dados.git" "$WF/logs" "$WF/publicar" /etc/wf/app.env   # dados.git tem tudo (inclusive o estado do robô do site)
restic forget --prune --keep-daily 14 --keep-weekly 8 --keep-monthly 12
restic check --read-data-subset=2%
echo "$(date '+%F %T') cópia feita: $(restic snapshots --latest 1 --compact | tail -2 | head -1)"
