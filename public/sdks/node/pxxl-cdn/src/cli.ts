#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { PxxlCDN, type CDNVisibility } from "./index.js";

const print = (value: string) => process.stdout.write(`${value}\n`);

const usage = `pxxl-cdn

Usage:
  pxxl-cdn list
  pxxl-cdn usage
  pxxl-cdn upload <file> [--private]
  pxxl-cdn delete <asset-id>

Environment:
  PXXL_API_KEY   Required Pxxl API key with scope=cdn
  PXXL_API_URL   Optional API base URL, defaults to https://gateway.pxxl.app/api/v3
`;

async function main() {
  const [command, value, ...flags] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    print(usage);
    return;
  }

  const apiKey = process.env.PXXL_API_KEY || process.env.PXXL_API_TOKEN;
  if (!apiKey) {
    throw new Error("PXXL_API_KEY is required");
  }

  const client = new PxxlCDN({ apiKey, baseUrl: process.env.PXXL_API_URL });

  if (command === "list") {
    const result = await client.listAssets();
    print(JSON.stringify(result.assets, null, 2));
    return;
  }
  if (command === "usage") {
    print(JSON.stringify(await client.usage(), null, 2));
    return;
  }
  if (command === "delete") {
    if (!value) throw new Error("delete requires an asset id");
    await client.deleteAsset(value);
    print(`Deleted ${value}`);
    return;
  }
  if (command === "upload") {
    if (!value) throw new Error("upload requires a file path");
    const info = await stat(value);
    if (!info.isFile()) throw new Error(`${value} is not a file`);
    const bytes = await readFile(value);
    const visibility: CDNVisibility = flags.includes("--private") ? "private" : "public";
    const asset = await client.uploadAsset({
      file: new Blob([bytes]),
      fileName: basename(value),
      visibility,
    });
    print(JSON.stringify(asset, null, 2));
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
