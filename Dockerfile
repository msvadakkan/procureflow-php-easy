FROM php:8.1-apache

# Install system deps needed by the MongoDB PECL extension
RUN apt-get update && apt-get install -y --no-install-recommends \
        libssl-dev \
        libcurl4-openssl-dev \
        pkg-config \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# Install the MongoDB PHP extension
RUN pecl install mongodb \
    && docker-php-ext-enable mongodb

# Enable Apache mod_rewrite (required by .htaccess routing)
RUN a2enmod rewrite

# Allow .htaccess overrides in the document root
RUN sed -i 's|AllowOverride None|AllowOverride All|g' /etc/apache2/apache2.conf

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install PHP dependencies first (layer-cached until composer.json changes)
COPY composer.json composer.lock* ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress

# Copy application source
COPY . .

# Ensure upload directories exist and are writable by www-data
RUN mkdir -p uploads/vendors uploads/companies/logos \
    && chown -R www-data:www-data uploads \
    && chmod -R 775 uploads

EXPOSE 80
