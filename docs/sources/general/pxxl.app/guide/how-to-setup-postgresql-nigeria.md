# Source: https://pxxl.app/guide/how-to-setup-postgresql-nigeria

How-to Guide7 min read2026-05-23

# How to Set Up a Free PostgreSQL Database in Nigeria — Complete Guide

PostgreSQL is the preferred relational database for Nigerian developers building production applications. This guide shows you how to set up a managed PostgreSQL database for free and connect it to your application.

## Provisioning a PostgreSQL Database on Pxxl

From your Pxxl dashboard, navigate to Databases and click 'New Database'. Select PostgreSQL and choose a database name. Pxxl creates a managed PostgreSQL instance in seconds and provides you with a full connection string: 'postgresql://username:password@host:port/dbname'. Store this connection string as an environment variable in your application — never in your source code.

## Connecting from Node.js and Python

In a Node.js application, install the 'pg' package and create a Pool using process.env.DATABASE\_URL. For ORMs, use Prisma with its DATABASE\_URL, or Sequelize by parsing the URL into host/port/user/password/database components. In Python, use psycopg2 with the connection string or SQLAlchemy with the DATABASE\_URL. Django uses dj-database-url to parse a PostgreSQL URL into Django's DATABASES setting.

## Production PostgreSQL Best Practices for Nigerian Apps

Enable automatic daily backups in Pxxl's database settings — restoration is one click from the dashboard. Use database migrations (via Knex, Prisma Migrate, or Django migrations) rather than manually altering tables, so your schema is version-controlled alongside your code. Set up a database user with only the permissions your application needs — SELECT, INSERT, UPDATE, DELETE — rather than using a superuser connection in production.

### Ready to deploy on Pxxl?

Connect your GitHub repository and go live in under 30 seconds. No credit card required.

[Get started free](https://pxxl.app/signup)

postgresqlnigeriadatabasebackend

## Related guides

[How-to Guide\\ \\ **How to Get Free Database Hosting as a Nigerian Developer in 2026**\\ \\ Get free PostgreSQL, MySQL, or MongoDB database hosting in Nigeria. This guide covers Pxxl's managed databases, connection strings, and best practices.](https://pxxl.app/guide/free-database-hosting-nigeria) [Alternative\\ \\ **PlanetScale Alternatives for Nigerian Developers — MySQL Database Hosting**\\ \\ PlanetScale removed its free tier and raised MySQL prices. Nigerian developers need a PlanetScale alternative with managed MySQL and affordable local pricing.](https://pxxl.app/guide/planetscale-alternative-nigeria) [How-to Guide\\ \\ **How to Deploy a Node.js App for Free in Nigeria — Complete Guide**\\ \\ Deploy Node.js apps (Express, NestJS, Fastify) for free in Nigeria. This guide covers Git deployment, environment variables, and keeping your app always online.](https://pxxl.app/guide/how-to-deploy-nodejs-app-nigeria)