# Publish `@pxxlapp/pxxl` to npm

Run releases from the root of `pxxlspace/pxxlspace`. The package contains the
JavaScript SDK and the `pxxl` CLI, so publish them together.

## Before releasing

Make sure the working tree only contains the changes you intend to release:

```bash
git status --short
npm ci
npm test
npm run build
node dist/cli.js --version
node dist/cli.js --help
npm pack --dry-run
```

`npm pack --dry-run` is the final contents check. Confirm that it includes the
compiled `dist/` files, the root `readme.md`, guides, examples, and the
JavaScript SDK guide. It should not include `.env` files, API keys, local
caches, or test fixtures containing secrets.

## Choose the version

Use semantic versioning and a Conventional Commit-style release message:

```bash
npm version patch -m "chore(release): %s"
```

Use `minor` for a backwards-compatible feature or `major` for a breaking
change. The command updates `package.json` and `package-lock.json` and creates
a release commit and tag.

Run the checks again after the version change:

```bash
npm test
npm pack --dry-run
```

## Publish

Log in with an npm account that has publish access to the `@pxxlapp` scope:

```bash
npm whoami
npm publish --access public --provenance
```

If your npm account or publishing environment does not support provenance,
remove `--provenance`. npm 2FA should remain enabled for the account.

Only push the release commit and tag after reviewing them:

```bash
git push origin main --follow-tags
```

The package name is `@pxxlapp/pxxl`; the installed command is still `pxxl`.
The source lives in `sdks/javascript/pxxl/src/`, while TypeScript compiles it
to the root `dist/` directory used by npm.

## Verify the published package

Test the exact version from a clean temporary directory:

```bash
release_version="$(node -p "require('./package.json').version")"
verify_dir="$(mktemp -d)"

npm view "@pxxlapp/pxxl@$release_version" version
npm install --prefix "$verify_dir" "@pxxlapp/pxxl@$release_version"
"$verify_dir/node_modules/.bin/pxxl" --version
"$verify_dir/node_modules/.bin/pxxl" --help

(cd "$verify_dir" && node --input-type=module -e \
  'import("@pxxlapp/pxxl").then(({ PxxlClient, Pxxl }) => {
    if (!PxxlClient || !Pxxl) process.exit(1);
  })')
```

The version printed by the CLI should match the published version, and both
`PxxlClient` (the backwards-compatible flat API) and `Pxxl` (the grouped API)
should import successfully.

## Commit prefixes

Use clear prefixes for work leading up to a release: `feat:`, `fix:`,
`refactor:`, `test:`, `docs:`, and `chore:`. Release commits use
`chore(release): <version>`.
