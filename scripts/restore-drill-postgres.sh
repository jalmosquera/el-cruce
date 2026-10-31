#!/bin/sh
# Verify a dump and restore against an isolated PostgreSQL instance on port 55435.
set -eu

: "${RESTORE_DRILL_SOURCE_DATABASE_URL:?RESTORE_DRILL_SOURCE_DATABASE_URL must be set}"
: "${RESTORE_DRILL_ADMIN_DATABASE_URL:?RESTORE_DRILL_ADMIN_DATABASE_URL must be set}"
: "${RESTORE_DRILL_DISPOSABLE_MARKER:?Set RESTORE_DRILL_DISPOSABLE_MARKER=elcruce-restore-drill}"

if [ "$RESTORE_DRILL_DISPOSABLE_MARKER" != "elcruce-restore-drill" ]; then
    echo "The disposable restore-drill marker is incorrect." >&2
    exit 64
fi

for database_url in "$RESTORE_DRILL_SOURCE_DATABASE_URL" "$RESTORE_DRILL_ADMIN_DATABASE_URL"; do
    case "$database_url" in
        postgres://*|postgresql://*) ;;
        *) echo "Restore drill URLs must use PostgreSQL." >&2; exit 64 ;;
    esac

    authority=${database_url#*://}
    authority=${authority%%/*}
    host_and_port=${authority##*@}
    case "$host_and_port" in
        *:55435) ;;
        *)
        echo "Restore drill only permits the disposable PostgreSQL port 55435." >&2
        exit 65
        ;;
    esac
done

source_database=$(psql "$RESTORE_DRILL_SOURCE_DATABASE_URL" -Atqc 'SELECT current_database()')
case "$source_database" in
    elcruce_restore_*|elcruce_disposable_*) ;;
    *) echo "Restore drill source must itself be a disposable elcruce database." >&2; exit 65 ;;
esac

target_database="elcruce_restore_drill_$(date +%s)_$$"
dump_file=$(mktemp "${TMPDIR:-/tmp}/elcruce-restore-drill.dump.XXXXXX")
source_counts=$(mktemp "${TMPDIR:-/tmp}/elcruce-source-counts.XXXXXX")
target_counts=$(mktemp "${TMPDIR:-/tmp}/elcruce-target-counts.XXXXXX")
created_target=false

cleanup() {
    rm -f "$dump_file" "$source_counts" "$target_counts"
    if [ "$created_target" = true ]; then
        dropdb --maintenance-db="$RESTORE_DRILL_ADMIN_DATABASE_URL" --if-exists "$target_database"
    fi
}
trap cleanup 0 HUP INT TERM

pg_dump --format=custom --file="$dump_file" --no-owner --no-privileges "$RESTORE_DRILL_SOURCE_DATABASE_URL"
createdb --maintenance-db="$RESTORE_DRILL_ADMIN_DATABASE_URL" "$target_database"
created_target=true

case "$RESTORE_DRILL_ADMIN_DATABASE_URL" in
    *\?*)
        admin_base=${RESTORE_DRILL_ADMIN_DATABASE_URL%%\?*}
        admin_query="?${RESTORE_DRILL_ADMIN_DATABASE_URL#*\?}"
        ;;
    *)
        admin_base=$RESTORE_DRILL_ADMIN_DATABASE_URL
        admin_query=
        ;;
esac
target_url="${admin_base%/*}/$target_database$admin_query"
RESTORE_DATABASE_URL="$target_url" \
RESTORE_TARGET_DATABASE="$target_database" \
RESTORE_CONFIRM_TARGET="$target_database" \
"$(dirname "$0")/restore-postgres.sh" "$dump_file"

table_names=$(psql "$RESTORE_DRILL_SOURCE_DATABASE_URL" -Atqc "SELECT format('%I.%I', schemaname, relname) FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname")
for table_name in $table_names; do
    printf '%s|' "$table_name" >> "$source_counts"
    psql "$RESTORE_DRILL_SOURCE_DATABASE_URL" -Atqc "SELECT count(*) FROM $table_name" >> "$source_counts"
    printf '%s|' "$table_name" >> "$target_counts"
    psql "$target_url" -Atqc "SELECT count(*) FROM $table_name" >> "$target_counts"
done

if ! diff -u "$source_counts" "$target_counts"; then
    echo "Restore drill failed: schema data invariants differ." >&2
    exit 1
fi

echo "Restore drill passed: public-table row counts match in $target_database"
