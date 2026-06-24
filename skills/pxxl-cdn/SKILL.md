# Pxxl CDN Skill

Use this skill when a user wants to upload files to Pxxl CDN, generate CDN upload scripts, or integrate the Pxxl CDN SDK.

## Safety Rules

- Use a Pxxl API key with `scope=cdn`.
- Use `permission=read_write` only for upload or delete flows.
- Never ask for, store, print, or document Cloudflare R2 credentials.
- Never commit `.env` files or real API keys.
- Prefer private visibility for HTML, SVG, JavaScript, XML, or other active content.
- Treat `publicUrl` as empty for private files.

## Node

Use the `pxxl` package:

```ts
import { PxxlClient } from "pxxl";

const cdn = new PxxlClient({ apiKey: process.env.PXXL_API_KEY! });
```

## Go

Use `github.com/pxxlspace/pxxlspace/sdks/go/pxxl`:

```go
client, err := pxxl.NewClient(os.Getenv("PXXL_API_KEY"))
```
