#!/usr/bin/env node

import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  PxxlClient,
  clearAuthConfig,
  configPath,
  copyBoilerplate,
  createProjectZip,
  readAuthConfig,
  saveAuthConfig,
  sha256Hex,
  writeDefaultPxxlFiles,
  type CDNVisibility,
  type DeployConfig,
} from "./index.js";

const usage = `pxxl

Usage:
  pxxl login --api-key <key> [--api-url <url>]
  pxxl logout
  pxxl whoami
  pxxl init [--new <boilerplate>] [--name <project>] [--domain <tld>] [--dir <path>]
  pxxl deploy [--name <project>] [--domain <tld>] [--port <port>]
  pxxl status
  pxxl cdn summary
  pxxl cdn list
  pxxl cdn usage
  pxxl cdn upload <file> [--private]
  pxxl cdn download <asset-id> <output-file>
  pxxl cdn delete <asset-id>
  pxxl domain tlds
  pxxl domain tlds --search <query>
  pxxl domain search <query> [--type <category>]

Environment:
  PXXL_API_KEY overrides stored credentials.
  PXXL_API_URL overrides the API base URL.
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (!command || command === "help" || command === "--help" || command === "-h") return print(usage);

  if (command === "login") return login(args);
  if (command === "logout") {
    await clearAuthConfig();
    return print("Logged out.");
  }
  if (command === "init") return initProject(args);

  const client = await authedClient();
  if (command === "whoami") return printJSON(await client.whoami());
  if (command === "status") return printJSON(await client.whoami());
  if (command === "deploy") return deploy(client, args);
  if (command === "cdn") return cdn(client, args);
  if (command === "domain" || command === "domains") return domains(client, args);

  throw new Error(`Unknown command: ${command}`);
}

async function login(args: string[]) {
  const apiKey = flagValue(args, "--api-key") || flagValue(args, "-k");
  if (!apiKey) throw new Error("pxxl login requires --api-key <key>");
  await saveAuthConfig(apiKey, flagValue(args, "--api-url") || process.env.PXXL_API_URL);
  print(`Saved Pxxl credentials to ${configPath()}`);
}

async function initProject(args: string[]) {
  const boilerplate = flagValue(args, "--new");
  const dir = resolve(flagValue(args, "--dir") || ".");
  if (boilerplate) await copyBoilerplate(boilerplate, dir);
  const config: DeployConfig = {
    name: flagValue(args, "--name") || basename(dir).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
    domainChoice: normalizeDomainChoice(flagValue(args, "--domain") || "pxxl.pro"),
    environment: "production",
    deployEnvironment: "prod",
    port: Number(flagValue(args, "--port") || 3000),
  };
  await writeDefaultPxxlFiles(dir, config);
  print(`Initialized Pxxl project in ${dir}`);
}

async function deploy(client: PxxlClient, args: string[]) {
  const config: DeployConfig = {};
  if (flagValue(args, "--name")) config.name = flagValue(args, "--name");
  if (flagValue(args, "--domain")) config.domainChoice = normalizeDomainChoice(flagValue(args, "--domain"));
  if (flagValue(args, "--port")) config.port = Number(flagValue(args, "--port"));
  const cwd = resolve(flagValue(args, "--dir") || ".");
  const archive = await createProjectZip(cwd);
  print(`Created SpaceDrop archive (${archive.length} bytes, sha256 ${sha256Hex(archive).slice(0, 16)}...)`);
  const result = await client.deploy({ ...config, cwd });
  printJSON(result);
}

async function cdn(client: PxxlClient, args: string[]) {
  const command = args.shift();
  if (!command || command === "help") return print(usage);
  if (command === "summary") return printJSON(await client.summary());
  if (command === "list") return printJSON(await client.listAssets());
  if (command === "usage") return printJSON(await client.usage(Number(flagValue(args, "--limit") || 100)));
  if (command === "delete") {
    const id = required(args.shift(), "asset id");
    await client.deleteAsset(id);
    return print(`Deleted ${id}`);
  }
  if (command === "download") {
    const id = required(args.shift(), "asset id");
    const out = required(args.shift(), "output file");
    const blob = await client.downloadAsset(id);
    await writeFile(out, Buffer.from(await blob.arrayBuffer()));
    return print(`Downloaded ${id} to ${out}`);
  }
  if (command === "upload") {
    const file = required(args.shift(), "file path");
    const info = await stat(file);
    if (!info.isFile()) throw new Error(`${file} is not a file`);
    const visibility: CDNVisibility = args.includes("--private") ? "private" : "public";
    const asset = await client.uploadAsset({ file: new Blob([await readFile(file)]), fileName: basename(file), visibility });
    return printJSON(asset);
  }
  throw new Error(`Unknown CDN command: ${command}`);
}

async function domains(client: PxxlClient, args: string[]) {
  const command = args.shift();
  if (command === "tlds") {
    const search = flagValue(args, "--search") || flagValue(args, "-s");
    return printJSON(search ? await client.searchTLDs(search) : await client.listTLDs());
  }
  if (command === "popular") return printJSON(await client.popularTLDs());
  if (command === "search") {
    const query = required(args.shift(), "domain query");
    return printJSON(await client.searchDomains({ query, type: flagValue(args, "--type") }));
  }
  throw new Error(`Unknown domain command: ${command || ""}`);
}

async function authedClient(): Promise<PxxlClient> {
  const config = await readAuthConfig();
  if (!config.apiKey) throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
  return new PxxlClient({ apiKey: config.apiKey, baseUrl: process.env.PXXL_API_URL || config.baseUrl });
}

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function normalizeDomainChoice(value?: string): string | undefined {
  if (!value) return value;
  return value.replace(/^\./, "");
}

function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function printJSON(value: unknown) {
  print(JSON.stringify(value, null, 2));
}

function print(value: string) {
  process.stdout.write(`${value}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
