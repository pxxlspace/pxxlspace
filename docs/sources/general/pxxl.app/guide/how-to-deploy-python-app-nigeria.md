# Source: https://pxxl.app/guide/how-to-deploy-python-app-nigeria

How-to Guide7 min read2026-05-23

# How to Deploy a Python App in Nigeria — Free Hosting Step-by-Step Guide

Python is widely used by Nigerian developers for web backends, data science APIs, and automation services. This guide covers deploying any Python web application — Django, FastAPI, or Flask — to a live URL for free.

## Preparing Your Python App for Deployment

Generate a requirements.txt file by running 'pip freeze > requirements.txt' in your virtual environment. Add a Procfile to your project root with the content 'web: gunicorn myapp.wsgi' for Django, or 'web: uvicorn main:app --host 0.0.0.0 --port $PORT' for FastAPI. Ensure your app reads configuration from environment variables rather than hardcoded values — use python-dotenv for local development and Pxxl's environment settings for production.

## Deploying Your Python App on Pxxl

Connect your GitHub repository to Pxxl. Pxxl detects Python automatically from your requirements.txt and configures the build. Add your environment variables — database URL, secret key, allowed hosts for Django, etc. For Django, set ALLOWED\_HOSTS to include your Pxxl domain. Pxxl installs dependencies from requirements.txt, runs collectstatic for Django apps, and starts your Gunicorn or Uvicorn server.

## Running Database Migrations

For Django apps with a database, run 'python manage.py migrate' after your first deployment. From the Pxxl console, you can run one-off commands against your live environment. For subsequent deployments, add migrate to your build command — for example, 'python manage.py migrate && python manage.py collectstatic --noinput'. This ensures your database schema is always in sync with your codebase after each push.

### Ready to deploy on Pxxl?

Connect your GitHub repository and go live in under 30 seconds. No credit card required.

[Get started free](https://pxxl.app/signup)

pythonnigeriadjangofastapiflask

## Related guides

[How-to Guide\\ \\ **How to Deploy a Django App in Nigeria — Free Hosting Guide**\\ \\ Deploy a Django application for free in Nigeria. This guide covers Gunicorn, database migrations, static files, and environment variables on Pxxl.](https://pxxl.app/guide/how-to-deploy-django-nigeria) [How-to Guide\\ \\ **How to Host a REST API for Free in Nigeria — Backend Deployment Guide**\\ \\ Host your REST API (Node.js, Python, PHP) for free in Nigeria with Pxxl. Get a live API URL, HTTPS, and always-on uptime without monthly USD bills.](https://pxxl.app/guide/how-to-host-api-nigeria) [How-to Guide\\ \\ **How to Get Free Database Hosting as a Nigerian Developer in 2026**\\ \\ Get free PostgreSQL, MySQL, or MongoDB database hosting in Nigeria. This guide covers Pxxl's managed databases, connection strings, and best practices.](https://pxxl.app/guide/free-database-hosting-nigeria)