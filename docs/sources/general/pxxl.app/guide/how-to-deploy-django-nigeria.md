# Source: https://pxxl.app/guide/how-to-deploy-django-nigeria

How-to Guide7 min read2026-05-23

# How to Deploy a Django App in Nigeria — Free Hosting Guide

Django is the most mature Python web framework, widely used by Nigerian developers for building APIs, admin panels, and full-featured web applications. This guide covers everything you need to deploy a Django app for free.

## Django Production Checklist Before Deploying

Before deploying, set DEBUG=False in your production settings and set ALLOWED\_HOSTS to include your Pxxl domain (e.g., 'myapp.pxxl.app' and 'myapp.com'). Generate a new SECRET\_KEY for production and store it as a Pxxl environment variable. Configure Django to use whitenoise for serving static files in production by adding 'whitenoise.middleware.WhiteNoiseMiddleware' to MIDDLEWARE. Run 'python manage.py check --deploy' locally to catch any remaining security warnings.

## Deploying Django on Pxxl

Add gunicorn to your requirements.txt. Set your Pxxl build command to 'pip install -r requirements.txt && python manage.py collectstatic --noinput'. Set the start command to 'gunicorn myproject.wsgi --bind 0.0.0.0:$PORT'. Add all environment variables: SECRET\_KEY, DATABASE\_URL, ALLOWED\_HOSTS. Provision a PostgreSQL database from Pxxl's Databases section, install dj-database-url, and configure your Django DATABASES setting to use 'dj\_database\_url.config()'. Run migrations via Pxxl's console after deployment.

## Serving Static and Media Files in Production

Django's development server serves static files, but in production you need whitenoise or a CDN. Install whitenoise ('pip install whitenoise') and add it to MIDDLEWARE. Set STATIC\_ROOT to '/staticfiles' and add STATICFILES\_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'. For user-uploaded media files, use a cloud storage service like AWS S3 or Cloudflare R2 — Pxxl's filesystem is ephemeral, so media files stored locally will be lost on the next deployment.

### Ready to deploy on Pxxl?

Connect your GitHub repository and go live in under 30 seconds. No credit card required.

[Get started free](https://pxxl.app/signup)

djangopythonnigeriadeployment

## Related guides

[How-to Guide\\ \\ **How to Deploy a Python App in Nigeria — Free Hosting Step-by-Step Guide**\\ \\ Deploy Django, FastAPI, or Flask Python apps for free in Nigeria. This guide covers requirements.txt, Procfiles, environment variables, and live deployment.](https://pxxl.app/guide/how-to-deploy-python-app-nigeria) [How-to Guide\\ \\ **How to Get Free Database Hosting as a Nigerian Developer in 2026**\\ \\ Get free PostgreSQL, MySQL, or MongoDB database hosting in Nigeria. This guide covers Pxxl's managed databases, connection strings, and best practices.](https://pxxl.app/guide/free-database-hosting-nigeria) [How-to Guide\\ \\ **How to Set Up a Free PostgreSQL Database in Nigeria — Complete Guide**\\ \\ Set up a free PostgreSQL database in Nigeria with Pxxl. This guide covers database creation, connecting from Node.js and Python, and production best practices.](https://pxxl.app/guide/how-to-setup-postgresql-nigeria)