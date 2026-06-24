#!/usr/bin/env node

import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import {
  PxxlClient,
  clearAuthConfig,
  configPath,
  copyBoilerplate,
  createProjectZip,
  readBoilerplateManifest,
  readAuthConfig,
  saveAuthConfig,
  saveTeamSelection,
  sha256Hex,
  writeDefaultPxxlFiles,
  type CDNVisibility,
  type DeployConfig,
  type EnvVarInput,
} from "./index.js";

const run = promisify(execFile);

const usage = `pxxl

Usage:
  pxxl login --api-key <key> [--api-url <url>]
  pxxl logout
  pxxl whoami
  pxxl init [--new <boilerplate>] [--name <project>] [--domain <tld>] [--dir <path>]
  pxxl deploy [--name <project>] [--domain <tld>] [--port <port>]
  pxxl redeploy <project-id> [--commit <sha>] [--message <text>]
  pxxl pull <project-id> [.|./folder] [--force]
  pxxl env list <project-id> [--global]
  pxxl env push <project-id> [--file .env] [--global] [--secret=false]
  pxxl status
  pxxl cdn summary
  pxxl cdn list
  pxxl cdn usage
  pxxl cdn upload <file> [--private]
  pxxl cdn download <asset-id> <output-file>
  pxxl cdn delete <asset-id>
  pxxl team list
  pxxl team use <team-id>
  pxxl team current
  pxxl team clear
  pxxl db list
  pxxl db create --name <name> --type <postgres|mysql|redis|...>
  pxxl db get <database-id>
  pxxl db start|stop|restart|delete <database-id>
  pxxl db stats|tables <database-id>

Environment:
  PXXL_API_KEY overrides stored credentials.
  PXXL_API_URL overrides the API base URL.
  PXXL_TEAM_ID overrides the selected spaceship/team for scoped commands.
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
  if ((command === "team" || command === "teams" || command === "spaceship" || command === "spaceships") && teamCommandCanRunWithoutAuth(args[0])) {
    return teams(undefined, args);
  }

  const client = await authedClient();
  if (command === "whoami") return printJSON(await client.whoami());
  if (command === "status") return printJSON(await client.whoami());
  if (command === "deploy") return deploy(client, args);
  if (command === "redeploy") return redeploy(client, args);
  if (command === "pull") return pullProject(client, args);
  if (command === "env" || command === "envs") return envs(client, args);
  if (command === "cdn") return cdn(client, args);
  if (command === "team" || command === "teams" || command === "spaceship" || command === "spaceships") return teams(client, args);
  if (command === "db" || command === "database" || command === "databases") return databases(client, args);

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
  const manifest = boilerplate ? await readBoilerplateManifest(boilerplate) : undefined;
  if (boilerplate) await copyBoilerplate(boilerplate, dir);
  const config: DeployConfig = {
    name: flagValue(args, "--name") || basename(dir).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
    domainChoice: normalizeDomainChoice(flagValue(args, "--domain") || "pxxl.pro"),
    environment: "production",
    deployEnvironment: "prod",
    port: Number(flagValue(args, "--port") || manifest?.port || 3000),
    language: manifest?.language,
    framework: manifest?.framework,
    packageManager: manifest?.packageManager,
    installCommand: manifest?.installCommand,
    buildCommand: manifest?.buildCommand,
    startCommand: manifest?.startCommand,
    baseDirectory: manifest?.baseDirectory,
    entryFile: manifest?.entryFile,
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

async function redeploy(client: PxxlClient, args: string[]) {
  const id = required(args.shift(), "project id");
  const result = await client.redeployProject(id, {
    commitSha: flagValue(args, "--commit") || flagValue(args, "--sha"),
    commitMessage: flagValue(args, "--message") || flagValue(args, "-m"),
  });
  printJSON(result);
}

async function pullProject(client: PxxlClient, args: string[]) {
  const id = required(args.shift(), "project id");
  const destinationArg = args.find((arg) => !arg.startsWith("-"));
  const force = args.includes("--force");
  const response = await client.getProject(id);
  const project = ((response.project || response.data || response) as Record<string, unknown>);
  const githubUrl = stringValue(project.githubUrl);
  const branch = stringValue(project.githubBranch) || "main";
  if (!githubUrl) throw new Error("This project does not have a Git repository attached. SpaceDrop projects cannot be pulled with git.");
  const destination = resolve(destinationArg || await promptDestination(project.name ? String(project.name) : id));
  if (await isGitRepo(destination)) {
    print(`Updating existing git repo in ${destination}`);
    await run("git", ["-C", destination, "fetch", "origin", branch], { maxBuffer: 1024 * 1024 * 10 });
    await run("git", ["-C", destination, "checkout", branch], { maxBuffer: 1024 * 1024 * 10 });
    await run("git", ["-C", destination, "pull", "--ff-only", "origin", branch], { maxBuffer: 1024 * 1024 * 10 });
  } else {
    await ensureCloneDestination(destination, force);
    print(`Cloning ${githubUrl}#${branch} into ${destination}`);
    await run("git", ["clone", "--branch", branch, "--single-branch", githubUrl, destination], { maxBuffer: 1024 * 1024 * 10 });
  }
  print(`Pulled ${project.name || id} into ${destination}`);
}

async function envs(client: PxxlClient, args: string[]) {
  const command = args.shift();
  if (command === "list") {
    const id = required(args.shift(), "project id");
    return printJSON(await client.listProjectEnv(id, { global: args.includes("--global") }));
  }
  if (command === "push") {
    const id = required(args.shift(), "project id");
    const file = flagValue(args, "--file") || flagValue(args, "-f") || ".env";
    const secret = (flagValue(args, "--secret") || "true").toLowerCase() !== "false";
    const vars = parseDotEnv(await readFile(resolve(file), "utf8"), secret);
    if (vars.length === 0) throw new Error(`No environment variables found in ${file}`);
    const result = await client.pushProjectEnv(id, vars, { global: args.includes("--global") });
    return printJSON(result);
  }
  throw new Error(`Unknown env command: ${command || ""}`);
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

async function teams(client: PxxlClient | undefined, args: string[]) {
  const command = args.shift();
  if (command === "list" || !command) {
    if (!client) throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
    return printJSON(await client.listTeams());
  }
  if (command === "get" || command === "show") {
    if (!client) throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
    const id = required(args.shift(), "team id");
    return printJSON(await client.getTeam(id));
  }
  if (command === "use" || command === "switch") {
    const id = required(args.shift(), "team id");
    await saveTeamSelection(id);
    return print(`Using spaceship ${id}`);
  }
  if (command === "current") {
    const config = await readAuthConfig();
    return printJSON({ selectedTeamId: config.selectedTeamId || null });
  }
  if (command === "clear") {
    await saveTeamSelection(undefined);
    return print("Cleared selected spaceship.");
  }
  throw new Error(`Unknown team command: ${command}`);
}

function teamCommandCanRunWithoutAuth(command: string | undefined): boolean {
  return command === "current" || command === "clear" || command === "use" || command === "switch";
}

async function databases(client: PxxlClient, args: string[]) {
  const command = args.shift();
  if (command === "list" || !command) return printJSON(await client.listDatabases(flagValue(args, "--team")));
  if (command === "get" || command === "show") {
    const id = required(args.shift(), "database id");
    return printJSON(await client.getDatabase(id, flagValue(args, "--team")));
  }
  if (command === "create") {
    const name = required(flagValue(args, "--name") || flagValue(args, "-n"), "database name");
    const type = required(flagValue(args, "--type") || flagValue(args, "-t"), "database type");
    const result = await client.createDatabase({
      name,
      type,
      description: flagValue(args, "--description"),
      projectId: flagValue(args, "--project"),
      dailyBackupsEnabled: args.includes("--daily-backups"),
      teamId: flagValue(args, "--team"),
    });
    return printJSON(result);
  }
  if (command === "update") {
    const id = required(args.shift(), "database id");
    return printJSON(await client.updateDatabase(id, {
      name: flagValue(args, "--name") || flagValue(args, "-n"),
      description: flagValue(args, "--description"),
      teamId: flagValue(args, "--team"),
    }));
  }
  if (command === "delete" || command === "remove") {
    const id = required(args.shift(), "database id");
    return printJSON(await client.deleteDatabase(id, flagValue(args, "--team")));
  }
  if (command === "start") {
    const id = required(args.shift(), "database id");
    return printJSON(await client.startDatabase(id, flagValue(args, "--team")));
  }
  if (command === "stop") {
    const id = required(args.shift(), "database id");
    return printJSON(await client.stopDatabase(id, flagValue(args, "--team")));
  }
  if (command === "restart") {
    const id = required(args.shift(), "database id");
    return printJSON(await client.restartDatabase(id, flagValue(args, "--team")));
  }
  if (command === "stats") {
    const id = required(args.shift(), "database id");
    return printJSON(await client.databaseStats(id, flagValue(args, "--team")));
  }
  if (command === "tables") {
    const id = required(args.shift(), "database id");
    return printJSON(await client.databaseTables(id, flagValue(args, "--team")));
  }
  throw new Error(`Unknown database command: ${command || ""}`);
}

async function authedClient(): Promise<PxxlClient> {
  const config = await readAuthConfig();
  if (!config.apiKey) throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
  return new PxxlClient({ apiKey: config.apiKey, baseUrl: process.env.PXXL_API_URL || config.baseUrl, teamId: config.selectedTeamId });
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

function parseDotEnv(raw: string, secret: boolean): EnvVarInput[] {
  return raw.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [];
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) return [];
    const key = match[1] || "";
    let value = (match[2] || "").trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [{ key, value, isSecret: secret }];
  });
}

async function promptDestination(defaultName: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`Where should Pxxl pull this project? (${defaultName}) `);
    return answer.trim() || defaultName;
  } finally {
    rl.close();
  }
}

async function ensureCloneDestination(destination: string, force: boolean) {
  try {
    const entries = await readdir(destination);
    if (entries.length > 0 && !force) {
      throw new Error(`${destination} is not empty. Choose another folder or pass --force.`);
    }
    if (entries.length > 0 && force) {
      throw new Error(`${destination} is not empty and is not a git repo. Refusing to overwrite files.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(destination, { recursive: true });
      return;
    }
    throw error;
  }
  await access(destination);
}

async function isGitRepo(destination: string): Promise<boolean> {
  try {
    await access(resolve(destination, ".git"));
    return true;
  } catch {
    return false;
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
