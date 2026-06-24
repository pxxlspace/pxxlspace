# Publish `pxxl` to npm

Run releases from the root of `pxxlspace/pxxlspace`.

```bash
npm login
npm test
npm run build
npm pack --dry-run
npm version patch
npm publish --access public
```

Before publishing, confirm that the Pxxl npm account controls the `pxxl` package name. If it does not, publish as `@pxxl/cli` and keep the binary name as `pxxl`.

## Release Checklist

- Use npm 2FA on publish.
- Enable provenance where the npm account and CI environment support it.
- Inspect `npm pack --dry-run` output before publishing.
- Never publish local `.env`, API keys, build caches, or test fixtures with secrets.
- Smoke test after publishing:

```bash
npm install -g pxxl
pxxl --help
```
