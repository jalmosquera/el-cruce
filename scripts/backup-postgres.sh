#!/bin/sh
# Create a PostgreSQL custom-format backup without printing connection credentials.
set -eu

if [ "$#" -ne 1 ]; then
    echo "Usage: BACKUP_DATABASE_URL=... $0 /secure/backup.dump" >&2
    exit 64
fi

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL must be set}"
output_file=$1

case "$BACKUP_DATABASE_URL" in
    postgres://*|postgresql://*) ;;
    *) echo "BACKUP_DATABASE_URL must be a PostgreSQL URL." >&2; exit 64 ;;
esac

umask 077
if [ -e "$output_file" ]; then
    echo "Refusing to overwrite an existing backup file." >&2
    exit 65
fi

pg_dump --format=custom --file="$output_file" --no-owner --no-privileges "$BACKUP_DATABASE_URL"
echo "Backup created at $output_file"
