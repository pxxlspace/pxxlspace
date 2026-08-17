# Source: https://pxxl.app/guide/how-to-deploy-laravel-nigeria

How-to Guide7 min read2026-05-23

# How to Deploy a Laravel App in Nigeria — Step-by-Step Guide

Laravel is the most popular PHP framework in Nigeria, used for everything from e-commerce platforms to government portals. This guide walks you through deploying a Laravel application for free with Pxxl.

## Laravel Production Environment Setup

Generate a production app key by running 'php artisan key:generate --show' and copy the output. In Pxxl's environment settings, add APP\_KEY with this value, APP\_ENV=production, APP\_DEBUG=false, and APP\_URL set to your Pxxl deployment URL. Configure your database connection variables: DB\_CONNECTION, DB\_HOST, DB\_PORT, DB\_DATABASE, DB\_USERNAME, and DB\_PASSWORD using values from a Pxxl-provisioned MySQL or PostgreSQL database.

## Deploying Laravel on Pxxl

Set your build command to 'composer install --no-dev --optimize-autoloader && php artisan config:cache && php artisan route:cache && php artisan view:cache'. Set your start command to serve the 'public' directory — Pxxl's PHP support handles Apache/Nginx configuration automatically. After your first deployment, run 'php artisan migrate --force' via Pxxl's console. For subsequent deployments, add 'php artisan migrate --force' to your build command to automate migrations.

## Running Laravel Queues and Scheduled Tasks

Laravel queue workers and the scheduler require persistent processes. On Pxxl, you can run a worker as a separate background service by creating a second project pointing to the same repository with the start command 'php artisan queue:work --sleep=3 --tries=3'. For scheduled tasks (Laravel's scheduler), add a cron job in Pxxl's project settings that runs 'php artisan schedule:run' every minute — this keeps your scheduled jobs running on the Nigerian production environment.

### Ready to deploy on Pxxl?

Connect your GitHub repository and go live in under 30 seconds. No credit card required.

[Get started free](https://pxxl.app/signup)

laravelphpnigeriadeployment

## Related guides

[How-to Guide\\ \\ **How to Deploy a PHP App for Free in Nigeria — Laravel, WordPress, and Vanilla PHP**\\ \\ Deploy PHP applications (Laravel, Symfony, WordPress, or vanilla PHP) for free in Nigeria. Step-by-step guide to live deployment with Pxxl.](https://pxxl.app/guide/how-to-deploy-php-app-nigeria) [How-to Guide\\ \\ **How to Get Free Database Hosting as a Nigerian Developer in 2026**\\ \\ Get free PostgreSQL, MySQL, or MongoDB database hosting in Nigeria. This guide covers Pxxl's managed databases, connection strings, and best practices.](https://pxxl.app/guide/free-database-hosting-nigeria) [Alternative\\ \\ **Best Render Alternative for Nigerian Developers in 2026**\\ \\ Render is popular but has USD pricing and payment friction for Nigerians. Discover a Render alternative that lets Nigerian developers deploy web apps, APIs, and databases easily.](https://pxxl.app/guide/render-alternative-nigeria)