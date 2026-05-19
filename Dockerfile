FROM php:8.1-apache

# System deps required by the MongoDB PECL extension
RUN apt-get update && apt-get install -y --no-install-recommends \
        libssl-dev \
        libcurl4-openssl-dev \
        pkg-config \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# MongoDB PHP extension
RUN pecl install mongodb \
    && docker-php-ext-enable mongodb

# Enable mod_rewrite and configure AllowOverride for the document root
RUN a2enmod rewrite \
    && printf '<Directory /var/www/html>\n\tOptions -Indexes +FollowSymLinks\n\tAllowOverride All\n\tRequire all granted\n</Directory>\n' \
       > /etc/apache2/conf-available/procureflow.conf \
    && a2enconf procureflow

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install PHP dependencies (layer-cached until composer.json changes)
COPY composer.json composer.lock* ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress

# Application source
COPY . .

# Upload directories — writable by www-data
RUN mkdir -p uploads/vendors uploads/companies/logos \
    && chown -R www-data:www-data uploads \
    && chmod -R 775 uploads

# Entrypoint: writes .env, seeds DB, starts Apache
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]

EXPOSE 80
