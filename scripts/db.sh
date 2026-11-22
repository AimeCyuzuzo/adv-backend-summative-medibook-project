#!/usr/bin/env sh
# Database management for the MediBook MySQL container.
# Runs everything INSIDE the running container — no need to take Docker down.
#
# Usage: sh scripts/db.sh <schema|seed|reset|drop|shell>
#
# The SQL files are read from /docker-entrypoint-initdb.d, which is where
# docker-compose.yml mounts ./database. The root password comes from the
# container's own MYSQL_ROOT_PASSWORD env var, so it never appears on the host.

set -e

SERVICE=mysql
DIR=/docker-entrypoint-initdb.d

# Run a mysql command inside the container. Extra args go to the mysql client.
run_mysql() {
  docker compose exec -T "$SERVICE" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$@"' -- "$@"
}

# Run a .sql file from the mounted database/ folder.
run_file() {
  file="$1"
  if [ ! -f "database/$file" ]; then
    echo "✗ database/$file not found" >&2
    exit 1
  fi
  echo "→ running database/$file"
  docker compose exec -T "$SERVICE" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE" < "$1"' -- "$DIR/$file"
}

# Fail early with a helpful message if the container isn't running.
if ! docker compose ps --status running --services 2>/dev/null | grep -qx "$SERVICE"; then
  echo "✗ The '$SERVICE' container is not running. Start it with: docker compose up -d" >&2
  exit 1
fi

case "$1" in
  schema)
    run_file schema.sql
    ;;
  seed)
    run_file seed.sql
    ;;
  drop)
    echo "→ dropping and recreating the database"
    docker compose exec -T "$SERVICE" sh -c \
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\`;"'
    ;;
  reset)
    sh "$0" drop
    sh "$0" schema
    sh "$0" seed
    echo "✓ database reset"
    ;;
  shell)
    docker compose exec "$SERVICE" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"'
    ;;
  *)
    echo "Usage: sh scripts/db.sh <schema|seed|reset|drop|shell>" >&2
    exit 1
    ;;
esac
