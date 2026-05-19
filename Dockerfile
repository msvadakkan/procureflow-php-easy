FROM php:8.1-apache

# System deps for MongoDB PECL extension + curl (used by healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libssl-dev \
        libcurl4-openssl-dev \
        pkg-config \
        unzip \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Pin MongoDB extension to match composer.json (mongodb/mongodb ^1.18 needs ext-mongodb ^1.18)
RUN pecl install mongodb-1.18.0 \
    && docker-php-ext-enable mongodb

# Apache: enable rewrite, silence ServerName warning, allow .htaccess overrides
RUN a2enmod rewrite \
    && echo "ServerName localhost" >> /etc/apache2/apache2.conf \
    && printf '<Directory /var/www/html>\n\tOptions -Indexes +FollowSymLinks\n\tAllowOverride All\n\tRequire all granted\n</Directory>\n' \
       > /etc/apache2/conf-available/procureflow.conf \
    && a2enconf procureflow

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install PHP dependencies — cached layer until composer.json changes
# Commit composer.lock to git so this produces a reproducible build
COPY composer.json composer.lock* ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress

# Application source
COPY . .

# Create upload directories with base permissions
# (entrypoint fixes ownership at runtime after the volume is mounted)
RUN mkdir -p uploads/vendors uploads/companies/logos \
    && chmod -R 775 uploads

# Install entrypoint to a system path
RUN cp docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]
