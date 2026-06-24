# Pxxl CLI Guide

The root `pxxl` npm package ships one binary:

```bash
npm install -g pxxl
pxxl --help
```

## Login

```bash
pxxl login --api-key pxxl_...
```

The CLI stores credentials at `~/.config/pxxl/config.json` with file mode `0600`.
`PXXL_API_KEY` and `PXXL_API_URL` override the stored config.

## Deploy

```bash
pxxl init --new vite-react-pxxl --name my-app --domain pxxl.pro
pxxl deploy
```

`pxxl deploy` reads `pxxl.toml`, applies `.pxxlignore`, creates a temporary ZIP, and sends it to Pxxl SpaceDrop.

Use an API key with `scope=all` or `scope=deploy` and `permission=read_write`.

## CDN

```bash
pxxl cdn summary
pxxl cdn upload ./logo.png
pxxl cdn list
pxxl cdn delete <asset-id>
```

Use `scope=cdn` or `scope=all`.

## Domains

```bash
pxxl domain search pxxl.cv
pxxl domain tlds
pxxl domain tlds --search cv
```

Domain search returns availability, prices, renewal pricing, transfer pricing, restrictions, and promo fields when the API has an active promotion.
