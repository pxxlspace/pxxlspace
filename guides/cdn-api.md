# Pxxl CDN API Guide

Pxxl CDN lets you upload files under your Pxxl account with an API key. The public API never exposes R2 credentials, bucket names, or provider endpoints.

## Authentication

Create an API key in the Pxxl dashboard:

- `scope=cdn`
- `permission=read_write` for uploads and deletes
- `permission=read` for list, summary, usage, and downloads

Send the key with either header:

```bash
Authorization: Bearer pxxl_...
```

or:

```bash
X-Pxxl-Api-Key: pxxl_...
```

## Upload

```bash
curl -X POST https://server.pxxl.app/api/v3/cdn/assets \
  -H "Authorization: Bearer $PXXL_API_KEY" \
  -F "file=@./logo.png" \
  -F "visibility=public"
```

Uploads are checked against your CDN upload size limit and cloud-credit balance before storage. Active content types such as HTML, SVG, JavaScript, and XML are not exposed as public executable assets.

## List Assets

```bash
curl https://server.pxxl.app/api/v3/cdn/assets \
  -H "Authorization: Bearer $PXXL_API_KEY"
```

## Download

```bash
curl -L https://server.pxxl.app/api/v3/cdn/assets/<asset-id>/download \
  -H "Authorization: Bearer $PXXL_API_KEY" \
  -o asset.bin
```

## SDKs

- Node: [`@pxxlapp/pxxl`](../sdks/javascript/pxxl/README.md)
- Go: [`sdks/go/pxxl`](../sdks/go/pxxl/README.md)

The JavaScript SDK exposes CDN operations through the grouped `Pxxl` client:

```ts
import { Pxxl } from "@pxxlapp/pxxl";

const pxxl = new Pxxl({ apiKey: process.env.PXXL_API_KEY });
const assets = await pxxl.cdn.list();
const uploaded = await pxxl.cdn.upload({
  file: new Blob(["hello"]),
  fileName: "hello.txt",
  visibility: "public",
});
```

`PxxlClient` remains available for applications using the original flat
method names.
