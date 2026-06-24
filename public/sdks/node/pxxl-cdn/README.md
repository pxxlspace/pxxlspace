# @pxxl/cdn

Official Node.js SDK and CLI for uploading files to Pxxl CDN.

```bash
npm install @pxxl/cdn
```

```ts
import { readFile } from "node:fs/promises";
import { PxxlCDN } from "@pxxl/cdn";

const cdn = new PxxlCDN({ apiKey: process.env.PXXL_API_KEY! });
const bytes = await readFile("./public/logo.png");

const asset = await cdn.uploadAsset({
  file: new Blob([bytes]),
  fileName: "logo.png",
  visibility: "public",
});

console.log(asset.publicUrl);
```

The SDK only uses Pxxl API keys. It never asks for storage provider credentials, bucket names, or R2 secrets.

## CLI

```bash
export PXXL_API_KEY="pxxl_..."
pxxl-cdn upload ./public/logo.png
pxxl-cdn list
pxxl-cdn usage
pxxl-cdn delete <asset-id>
```

Use an API key with `scope=cdn` and `permission=read_write` for uploads and deletes.
