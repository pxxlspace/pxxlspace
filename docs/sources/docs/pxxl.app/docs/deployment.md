# Source: https://pxxl.app/docs/deployment

# Deployment Reference

Complete reference for configuring install, build, and execution commands across Node.js, Python, Go, PHP, Java, and monorepo architectures.

Pxxl compiles and runs your code repository using a standardized build pipeline. To ensure successful compilation and execution, configure your commands according to your language and framework requirements.

---

## [Technical Stack Command Matrix](https://pxxl.app/#technical-stack-command-matrix)

| Tech Stack | Package Manager | Install Command | Build Command | Start Command |
| --- | --- | --- | --- | --- |
| **Static HTML** | None | None | None | `python3 -m http.server ${PORT:-8080} --bind 0.0.0.0` |
| **Vite / React** | `npm` / `pnpm` / `bun` | `npm install` | `npm run build` | `npm run preview -- --host 0.0.0.0 --port ${PORT:-4173}` |
| **Next.js** | `npm` / `pnpm` / `bun` | `npm install` | `npm run build` | `npm start` |
| **Express API** | `npm` / `pnpm` / `bun` | `npm install` | `npm run build` _(if TS)_ | `node dist/index.js` |
| **FastAPI** | `pip` / `poetry` | `pip install -r req.txt` | None | `uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}` |
| **Django** | `pip` / `poetry` | `pip install -r req.txt` | `python manage.py collectstatic` | `gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}` |
| **Go API** | Go Modules | `go mod download` | `go build -o app .` | `./app` |
| **Laravel** | Composer | `composer install --no-dev` | `php artisan config:cache` | `php artisan serve --host 0.0.0.0 --port ${PORT:-8000}` |
| **Ruby / Rails** | Bundler | `bundle install` | `bundle exec rails assets:precompile` | `bundle exec rails server -b 0.0.0.0 -p ${PORT:-3000}` |
| **Spring Boot** | Maven / Gradle | `./mvnw go-offline` | `./mvnw package -DskipTests` | `java -jar target/*.jar` |

---

## [Node.js Configurations](https://pxxl.app/#nodejs-configurations)

Pxxl supports all major Node.js package managers. By default, it detects files like `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb` and runs the matching binary.

```
# npm
npm install && npm run build && npm run start

# pnpm
pnpm install --frozen-lockfile && pnpm run build && pnpm run start

# yarn
yarn install --frozen-lockfile && yarn build && yarn start

# bun
bun install --no-save && bun run build && bun run start
```

### [Next.js Deployment](https://pxxl.app/#nextjs-deployment)

For Next.js applications, use the default build command and verify your startup script binds to all interfaces:

```
{
  "scripts": {
    "build": "next build",
    "start": "next start -H 0.0.0.0 -p ${PORT:-3000}"
  }
}
```

> \[!TIP\] If your application uses Next.js Standalone output (`output: 'standalone'` in `next.config.js`), ensure your start command executes the generated node entry point: `node .next/standalone/server.js`.

### [Vite, React, Vue, Svelte, and Astro](https://pxxl.app/#vite-react-vue-svelte-and-astro)

To serve a client-side single-page application (SPA), use Vite's built-in preview server configured for host routing, or configure an Express server to route fallback requests to `index.html`:

```
# Vite Preview Command
npm run preview -- --host 0.0.0.0 --port ${PORT:-4173}
```

---

## [Python Configurations](https://pxxl.app/#python-configurations)

### [FastAPI and Flask](https://pxxl.app/#fastapi-and-flask)

FastAPI applications require an ASGI server (such as Uvicorn) to handle asynchronous loops. Flask applications require a WSGI server (such as Gunicorn).

```
# FastAPI
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

# Flask
pip install -r requirements.txt
gunicorn app:app --bind 0.0.0.0:${PORT:-8000}
```

### [Django](https://pxxl.app/#django)

Ensure your database connection strings are mapped via environment variables instead of hardcoding database settings. Run migrations as part of your build/release phase:

```
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
gunicorn project_name.wsgi:application --bind 0.0.0.0:${PORT:-8000}
```

---

## [Go Configurations](https://pxxl.app/#go-configurations)

Go builds compile source code into a single statically-linked binary.

```
# Go Modules
go mod download
go build -o server ./cmd/api
./server
```

> \[!IMPORTANT\] Your Go code must dynamically parse the `PORT` environment variable:
> 
> ```
> port := os.Getenv("PORT")
> if port == "" {
>     port = "8080"
> }
> log.Fatal(http.ListenAndServe("0.0.0.0:"+port, router))
> ```

---

## [PHP and Laravel Configurations](https://pxxl.app/#php-and-laravel-configurations)

Laravel applications should use Composer with optimized classmaps and configurations cached for production:

```
composer install --no-dev --optimize-autoloader
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan serve --host 0.0.0.0 --port ${PORT:-8000}
```

---

## [Monorepo and Multi-Service Configurations](https://pxxl.app/#monorepo-and-multi-service-configurations)

Pxxl allows you to deploy multiple distinct applications from a single monorepo.

### [Base Directory Scoping](https://pxxl.app/#base-directory-scoping)

Set the **Base Directory** in your project settings to scope the build context to a specific subdirectory:

| Project Path | Configuration Value |
| --- | --- |
| `apps/web-client/` | `apps/web-client` |
| `services/user-api/` | `services/user-api` |
| `packages/admin/` | `packages/admin` |

### [Multi-Service Configurations](https://pxxl.app/#multi-service-configurations)

If you deploy a service that runs multiple background processes (e.g., a web server and a Celery worker), create two distinct Pxxl projects referencing the same repository but running different commands:

1. **Web Service:** Configured with your web entry point and port routing.
2. **Worker Service:** Configured as a background worker with no public port exposure.

[API Keys\\ \\ Create scoped API keys from the Pxxl dashboard and link to OAuth integration setup.](https://pxxl.app/docs/dashboard/api-integrations) [pxxl.toml\\ \\ Configure Pxxl deployments from your repository with safe command, environment, runtime, output, and system package overrides.](https://pxxl.app/docs/pxxl-toml)

### On this page

[Technical Stack Command Matrix](https://pxxl.app/#technical-stack-command-matrix) [Node.js Configurations](https://pxxl.app/#nodejs-configurations) [Next.js Deployment](https://pxxl.app/#nextjs-deployment) [Vite, React, Vue, Svelte, and Astro](https://pxxl.app/#vite-react-vue-svelte-and-astro) [Python Configurations](https://pxxl.app/#python-configurations) [FastAPI and Flask](https://pxxl.app/#fastapi-and-flask) [Django](https://pxxl.app/#django) [Go Configurations](https://pxxl.app/#go-configurations) [PHP and Laravel Configurations](https://pxxl.app/#php-and-laravel-configurations) [Monorepo and Multi-Service Configurations](https://pxxl.app/#monorepo-and-multi-service-configurations) [Base Directory Scoping](https://pxxl.app/#base-directory-scoping) [Multi-Service Configurations](https://pxxl.app/#multi-service-configurations)