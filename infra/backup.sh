#!/bin/sh
# Nightly database dump. Example cron: 0 3 * * * /opt/tempo/infra/backup.sh
set -eu
cd "$(dirname "$0")"
mkdir -p ../backups
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U coach -Fc training_coach > "../backups/tempo-$(date +%F).dump"
find ../backups -name 'tempo-*.dump' -mtime +14 -delete
