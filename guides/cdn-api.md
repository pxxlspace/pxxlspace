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
curl -X POST https://gateway.pxxl.app/api/v3/cdn/assets \
  -H "Authorization: Bearer $PXXL_API_KEY" \
  -F "file=@./logo.png" \
  -F "visibility=public"
```

Uploads are checked against your CDN upload size limit and cloud-credit balance before storage. Active content types such as HTML, SVG, JavaScript, and XML are not exposed as public executable assets.

## List Assets

```bash
curl https://gateway.pxxl.app/api/v3/cdn/assets \
  -H "Authorization: Bearer $PXXL_API_KEY"
```

## Download

```bash
curl -L https://gateway.pxxl.app/api/v3/cdn/assets/<asset-id>/download \
  -H "Authorization: Bearer $PXXL_API_KEY" \
  -o asset.bin
```

## SDKs

- Node: root package `pxxl`
- Go: `sdks/go/pxxl`
