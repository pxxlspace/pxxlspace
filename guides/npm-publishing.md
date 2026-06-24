# Publish `@pxxlapp/pxxl` to npm

Run releases from the root of `pxxlspace/pxxlspace`.

```bash
npm login
npm test
npm run build
npm pack --dry-run
npm version patch
npm publish --access public
```

The package is published as `@pxxlapp/pxxl` because npm blocks the bare `pxxl` package name for similarity with existing packages. The installed binary remains `pxxl`.

## Release Checklist

- Use npm 2FA on publish.
- Enable provenance where the npm account and CI environment support it.
- Inspect `npm pack --dry-run` output before publishing.
- Never publish local `.env`, API keys, build caches, or test fixtures with secrets.
- Smoke test after publishing:

```bash
npm install -g @pxxlapp/pxxl
pxxl --help
```
