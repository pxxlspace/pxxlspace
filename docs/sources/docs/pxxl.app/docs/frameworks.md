# Source: https://pxxl.app/docs/frameworks

# Framework Recipes

Select a supported language or stack category, then copy the deployment configuration that matches your project.

Pxxl auto-detects most repositories, but these recipes help when you want to review or override install, build, and start commands. Choose the language or stack family below.

**Static HTML**

Best for plain HTML, CSS, and browser JavaScript with no package manager.

| Setting | Value |
| --- | --- |
| Install Command | `None` |
| Build Command | `None` |
| Start Command | Leave empty when Pxxl serves it as static HTML |

```
index.html
styles.css
script.js
assets/
```

**JavaScript and TypeScript**

Use this section for Node.js apps, SPAs, and full-stack JavaScript frameworks.

### [React, Vue, Svelte, Astro, Or Vite SPA](https://pxxl.app/#react-vue-svelte-astro-or-vite-spa)

| Setting | Value |
| --- | --- |
| Install Command | `npm install`, `pnpm install --frozen-lockfile`, `yarn install --frozen-lockfile`, or `bun install` |
| Build Command | `npm run build`, `pnpm run build`, `yarn build`, or `bun run build` |
| Start Command | Leave empty when Pxxl serves the generated static output |

```
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### [Next.js](https://pxxl.app/#nextjs)

| Setting | Value |
| --- | --- |
| Install Command | Package-manager install command |
| Build Command | `npm run build` or your package-manager equivalent |
| Start Command | `npm run start` when the script uses `next start` |

```
{
  "scripts": {
    "build": "next build",
    "start": "next start -H 0.0.0.0 -p ${PORT:-3000}"
  }
}
```

### [Nuxt](https://pxxl.app/#nuxt)

| Setting | Value |
| --- | --- |
| Install Command | Package-manager install command |
| Build Command | `npm run build` or your package-manager equivalent |
| Start Command | `node .output/server/index.mjs` |

Nuxt reads `PORT` automatically in most Nitro presets.

### [Express Or NestJS API](https://pxxl.app/#express-or-nestjs-api)

| Setting | Value |
| --- | --- |
| Install Command | Package-manager install command |
| Build Command | `npm run build` only when TypeScript or a framework compiler is required |
| Start Command | Prefer `npm run start:prod` when present, otherwise `npm run start` |

```
const express = require("express");
const app = express();
const port = Number(process.env.PORT || 3000);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(port, "0.0.0.0");
```

**Python**

Use this section for Python web APIs and server-rendered apps.

### [FastAPI](https://pxxl.app/#fastapi)

| Setting | Value |
| --- | --- |
| Install Command | `pip install -r requirements.txt` |
| Build Command | `None` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}` |

```
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "healthy"}
```

### [Django](https://pxxl.app/#django)

| Setting | Value |
| --- | --- |
| Install Command | `pip install -r requirements.txt` |
| Build Command | `python manage.py collectstatic --noinput` when static files are configured |
| Start Command | `gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}` |

Use your actual WSGI module, for example `core.wsgi:application`, `project.wsgi:application`, or `config.wsgi:application`.

### [Flask](https://pxxl.app/#flask)

| Setting | Value |
| --- | --- |
| Install Command | `pip install -r requirements.txt` |
| Build Command | `None` |
| Start Command | `gunicorn app:app --bind 0.0.0.0:${PORT:-8000}` |

**PHP**

Use this section for Laravel, Symfony, Slim, and plain PHP projects.

### [Plain PHP](https://pxxl.app/#plain-php)

| Setting | Value |
| --- | --- |
| Install Command | Leave empty unless `composer.json` exists |
| Build Command | `None` |
| Start Command | `php -S 0.0.0.0:${PORT:-8080}` |

### [Laravel](https://pxxl.app/#laravel)

| Setting | Value |
| --- | --- |
| Install Command | `composer install --no-dev --optimize-autoloader` |
| Build Command | `php artisan config:cache && php artisan route:cache` |
| Start Command | `php artisan serve --host 0.0.0.0 --port ${PORT:-8000}` |

If your Laravel app includes frontend assets, add the matching Node package-manager install and build scripts.

**Go**

Use this section for Gin, Fiber, Echo, Chi, or standard-library HTTP services.

| Setting | Value |
| --- | --- |
| Install Command | `go mod download` |
| Build Command | `go build -o bin/server ./cmd/api` |
| Start Command | `./bin/server` |

Your Go server should read `PORT` and bind to `0.0.0.0`.

```
port := os.Getenv("PORT")
if port == "" {
  port = "3000"
}
router.Run("0.0.0.0:" + port)
```

**Java**

Use this section for Spring Boot services.

| Setting | Value |
| --- | --- |
| Install Command | `./mvnw dependency:go-offline` or `./gradlew dependencies` |
| Build Command | `./mvnw package -DskipTests` or `./gradlew build -x test` |
| Start Command | `java -jar target/*.jar` or the generated Gradle jar |

Set `SERVER_PORT=${PORT}` or configure Spring to read the `PORT` environment variable.

**Ruby**

Use this section for Rails and Rack applications.

| Setting | Value |
| --- | --- |
| Install Command | `bundle install` |
| Build Command | `bundle exec rails assets:precompile` when assets are enabled |
| Start Command | `bundle exec rails server -b 0.0.0.0 -p ${PORT:-3000}` |

**.NET**

Use this section for ASP.NET Core apps.

| Setting | Value |
| --- | --- |
| Install Command | `dotnet restore` |
| Build Command | `dotnet publish -c Release -o out` |
| Start Command | `dotnet out/YourApp.dll` |

Pxxl sets `ASPNETCORE_URLS` and `DOTNET_URLS` for the selected port.

**Rust**

Use this section for Axum, Actix, Rocket, or Warp.

| Setting | Value |
| --- | --- |
| Install Command | `cargo fetch` |
| Build Command | `cargo build --release` |
| Start Command | `./target/release/your-binary` |

Read `PORT` and bind to `0.0.0.0` so the proxy can reach the container.

**Workers**

Workers process queues and background jobs. They do not receive public HTTP traffic.

| Setting | Value |
| --- | --- |
| Service Type | Worker |
| Install Command | Package or language install command |
| Build Command | Optional compiler/build command |
| Start Command | The worker entrypoint, such as `npm run worker`, `celery -A app worker`, or `bundle exec sidekiq` |

Workers do not need a listening port, but their process should stay running.

[pxxl.toml\\ \\ Configure Pxxl deployments from your repository with safe command, environment, runtime, output, and system package overrides.](https://pxxl.app/docs/pxxl-toml) [Quick Fixes\\ \\ Direct fixes for common deployment, domain, DNS, SSL, proxy, database, and OAuth issues on Pxxl.](https://pxxl.app/docs/quick-fixes)

### On this page

[React, Vue, Svelte, Astro, Or Vite SPA](https://pxxl.app/#react-vue-svelte-astro-or-vite-spa) [Next.js](https://pxxl.app/#nextjs) [Nuxt](https://pxxl.app/#nuxt) [Express Or NestJS API](https://pxxl.app/#express-or-nestjs-api) [FastAPI](https://pxxl.app/#fastapi) [Django](https://pxxl.app/#django) [Flask](https://pxxl.app/#flask) [Plain PHP](https://pxxl.app/#plain-php) [Laravel](https://pxxl.app/#laravel)