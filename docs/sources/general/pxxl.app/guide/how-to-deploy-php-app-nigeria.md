# Source: https://pxxl.app/guide/how-to-deploy-php-app-nigeria

How-to Guide7 min read2026-05-23

# How to Deploy a PHP App for Free in Nigeria — Laravel, WordPress, and Vanilla PHP

PHP remains one of the most widely used languages for web development in Nigeria, powering everything from Laravel APIs to custom CMS solutions. This guide shows you how to deploy any PHP application for free.

## Preparing Your PHP App for Deployment

Ensure your project has a composer.json file with all dependencies listed. For Laravel apps, your application key should be stored as an environment variable (APP\_KEY), never committed to Git. Set APP\_ENV=production and APP\_DEBUG=false for your Pxxl environment variables. Confirm your .htaccess file (for Apache) or nginx.conf (for Nginx-based hosts) is correctly configured to route all requests through index.php.

## Deploying Laravel on Pxxl

Connect your Laravel repository to Pxxl. Set the build command to 'composer install --no-dev --optimize-autoloader && php artisan optimize'. Set the start command to point to the 'public' directory. Add all Laravel environment variables: APP\_KEY, DB\_CONNECTION, DB\_HOST, DB\_DATABASE, DB\_USERNAME, DB\_PASSWORD. For your database, provision a Pxxl MySQL or PostgreSQL instance and use its connection details. Run 'php artisan migrate' via Pxxl's console after your first deployment.

## Common PHP Deployment Issues in Nigeria

The most common issue Nigerian PHP developers encounter is file permission errors — ensure your storage and bootstrap/cache directories are writable. If your app shows a 500 error in production, check your Pxxl deployment logs for PHP fatal errors. Ensure your PHP version in your Pxxl settings matches the version you developed with locally. For WordPress deployments, check that your wp-config.php reads database credentials from environment variables.

### Ready to deploy on Pxxl?

Connect your GitHub repository and go live in under 30 seconds. No credit card required.

[Get started free](https://pxxl.app/signup)

phpnigerialaraveldeployment

## Related guides

[How-to Guide\\ \\ **How to Deploy a Laravel App in Nigeria — Step-by-Step Guide**\\ \\ Deploy a Laravel PHP application for free in Nigeria. This guide covers Composer, .env configuration, database migrations, and queue workers on Pxxl.](https://pxxl.app/guide/how-to-deploy-laravel-nigeria) [How-to Guide\\ \\ **How to Get Free Database Hosting as a Nigerian Developer in 2026**\\ \\ Get free PostgreSQL, MySQL, or MongoDB database hosting in Nigeria. This guide covers Pxxl's managed databases, connection strings, and best practices.](https://pxxl.app/guide/free-database-hosting-nigeria) [How-to Guide\\ \\ **How to Host Your First Website as a Nigerian Developer — Step-by-Step Guide**\\ \\ A complete step-by-step guide for Nigerian developers hosting their first website. Learn to deploy from GitHub to a live URL with free SSL and a custom domain.](https://pxxl.app/guide/how-to-host-first-website-nigeria)