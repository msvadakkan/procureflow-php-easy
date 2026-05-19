#!/bin/sh
set -e

# ── JWT_SECRET safety check ───────────────────────────────────────────────────
if [ "${JWT_SECRET:-change-this-secret-in-production}" = "change-this-secret-in-production" ]; then
    echo "[entrypoint] WARNING: JWT_SECRET is still the default placeholder."
    echo "[entrypoint]          Set a strong random value before going to production."
fi

# ── Write .env from environment variables ─────────────────────────────────────
# Ensures bootstrap.php and the setup guard (index.php) can read config.
cat > /var/www/html/.env << EOF
MONGO_URI=${MONGO_URI:-mongodb://mongo:27017}
MONGO_DB=${MONGO_DB:-purchase_approval}
JWT_SECRET=${JWT_SECRET:-change-this-secret-in-production}
APP_URL=${APP_URL:-http://localhost:3000}
EOF

# ── Fix upload directory ownership after volume mount ─────────────────────────
# Named volumes may be mounted as root; ensure www-data can write files.
chown -R www-data:www-data /var/www/html/uploads
chmod -R 775 /var/www/html/uploads

# ── Seed database ─────────────────────────────────────────────────────────────
# Creates indexes and default approval levels. Retries until MongoDB is ready.
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
echo "[entrypoint] Database ready."

exec "$@"
