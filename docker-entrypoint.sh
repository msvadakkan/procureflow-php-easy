#!/bin/sh
set -e

# Write .env from Docker environment so bootstrap.php can read it
cat > /var/www/html/.env << EOF
MONGO_URI=${MONGO_URI:-mongodb://mongo:27017}
MONGO_DB=${MONGO_DB:-purchase_approval}
JWT_SECRET=${JWT_SECRET:-change-this-secret-in-production}
APP_URL=${APP_URL:-http://localhost:8080}
EOF

# Seed the DB (approval levels + indexes). Retries until MongoDB is ready.
echo "[entrypoint] Waiting for MongoDB..."
i=0
until php /var/www/html/includes/seed.php > /dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge 30 ]; then
        echo "[entrypoint] MongoDB not ready after 60s — starting Apache anyway."
        break
    fi
    echo "[entrypoint] Retry $i/30 in 2s..."
    sleep 2
done
echo "[entrypoint] Database ready. Starting Apache."

exec apache2-foreground
