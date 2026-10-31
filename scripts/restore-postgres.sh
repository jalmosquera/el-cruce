#!/bin/sh
# Restore only into an explicitly named disposable database.
set -eu

if [ "$#" -ne 1 ]; then
    echo "Usage: RESTORE_DATABASE_URL=... RESTORE_TARGET_DATABASE=... RESTORE_CONFIRM_TARGET=... $0 backup.dump" >&2
    exit 64
fi

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must be set}"
: "${RESTORE_TARGET_DATABASE:?RESTORE_TARGET_DATABASE must be set}"
: "${RESTORE_CONFIRM_TARGET:?RESTORE_CONFIRM_TARGET must be set}"
dump_file=$1

case "$RESTORE_DATABASE_URL" in
    postgres://*|postgresql://*) ;;
    *) echo "RESTORE_DATABASE_URL must be a PostgreSQL URL." >&2; exit 64 ;;
esac
case "$RESTORE_TARGET_DATABASE" in
    elcruce_restore_*|elcruce_disposable_*) ;;
    *) echo "Restore target must start with elcruce_restore_ or elcruce_disposable_." >&2; exit 64 ;;
esac
if [ "$RESTORE_CONFIRM_TARGET" != "$RESTORE_TARGET_DATABASE" ]; then
    echo "RESTORE_CONFIRM_TARGET must exactly match RESTORE_TARGET_DATABASE." >&2
    exit 64
fi
if [ ! -f "$dump_file" ]; then
    echo "Backup file does not exist." >&2
    exit 66
fi

connected_database=$(psql "$RESTORE_DATABASE_URL" -Atqc 'SELECT current_database()')
if [ "$connected_database" != "$RESTORE_TARGET_DATABASE" ]; then
    echo "The restore URL is not connected to the explicitly confirmed target." >&2
    exit 65
fi

pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname="$RESTORE_DATABASE_URL" "$dump_file"
echo "Restore completed in disposable database $RESTORE_TARGET_DATABASE"
