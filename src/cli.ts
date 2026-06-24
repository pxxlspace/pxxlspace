#!/usr/bin/env node

import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import {
  PXXL_API_BASE_URL,
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
  type DatabaseSummary,
  type DeployConfig,
  type EnvVarInput,
  type TeamSummary,
} from "./index.js";

const run = promisify(execFile);

const usage = `${bold("pxxl")} ${dim("official Pxxl CLI")}

${bold("Account")}
  ${cyan("pxxl login")} --api-key <key>       Validate and save a Pxxl API key
  ${cyan("pxxl logout")}                     Remove local credentials
  ${cyan("pxxl whoami")}                     Show the active account and API key scope
  ${cyan("pxxl status")}                     Same as whoami
  ${cyan("pxxl stats")}                      Show platform stats for the current scope
  ${cyan("pxxl usage")}                      Show usage for the current scope

${bold("Deploy")}
  ${cyan("pxxl init")} --new <starter>        Create a Pxxl-ready project
  ${cyan("pxxl deploy")}                     Zip this directory and deploy with SpaceDrop
  ${cyan("pxxl redeploy")} <project-id>       Trigger a fresh deployment
  ${cyan("pxxl pull")} <project-id> [folder]  Clone or update the attached Git repo

${bold("Project Config")}
  ${cyan("pxxl env list")} <project-id>       List project env names
  ${cyan("pxxl env push")} <project-id>       Push a local .env file

${bold("CDN")}
  ${cyan("pxxl cdn summary")}                 Show CDN usage summary
  ${cyan("pxxl cdn list")}                    List assets
  ${cyan("pxxl cdn upload")} <file>           Upload an asset
  ${cyan("pxxl cdn download")} <id> <file>    Download an asset
  ${cyan("pxxl cdn delete")} <id>             Delete an asset

${bold("Spaceships")}
  ${cyan("pxxl team list")}                   List teams
  ${cyan("pxxl team use")} <team-id>          Select a team for scoped commands
  ${cyan("pxxl team current")}                Show selected team
  ${cyan("pxxl team clear")}                  Clear selected team

${bold("Databases")}
  ${cyan("pxxl db list")}                     List databases
  ${cyan("pxxl db create")} --name <name> --type <type>
  ${cyan("pxxl db get")} <database-id>
  ${cyan("pxxl db start|stop|restart|delete")} <database-id>
  ${cyan("pxxl db stats|tables")} <database-id>

${bold("Environment")}
  ${dim("PXXL_API_KEY")} overrides stored credentials.
  ${dim("PXXL_TEAM_ID")} overrides the selected spaceship/team for scoped commands.
  Pass ${dim("--json")} to print raw API responses for scripting.
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
  if (command === "whoami" || command === "status") return whoami(client, args);
  if (command === "stats") return stats(client, args);
  if (command === "usage") return usageOverview(client, args);
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
  if (args.includes("--api-url")) throw new Error("Custom API URLs are not supported. Pxxl CLI uses the official Gateway endpoint.");
  const client = new PxxlClient({ apiKey });
  const identity = await spinner("Validating API key", () => client.whoami());
  await saveAuthConfig(apiKey);
  printSuccess(`Saved Pxxl credentials to ${configPath()}`);
  printIdentity(identity);
}

async function whoami(client: PxxlClient, args: string[]) {
  const identity = await spinner("Checking account", () => client.whoami());
  if (wantsJSON(args)) return printJSON(identity);
  const config = await readAuthConfig();
  let selectedTeam: TeamSummary | undefined;
  if (config.selectedTeamId) {
    selectedTeam = await client.getTeam(config.selectedTeamId).then((value) => value.team).catch(() => undefined);
  }
  printIdentity(identity, config.selectedTeamId, selectedTeam);
}

async function stats(client: PxxlClient, args: string[]) {
  const result = await spinner("Fetching stats", () => client.stats(flagValue(args, "--team")));
  if (wantsJSON(args)) return printJSON(result);
  printUsageOverview(result, "Pxxl stats");
}

async function usageOverview(client: PxxlClient, args: string[]) {
  const result = await spinner("Fetching usage", () => client.platformUsage(flagValue(args, "--team")));
  if (wantsJSON(args)) return printJSON(result);
  printUsageOverview(result, "Pxxl usage");
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
  const result = await spinner("Uploading SpaceDrop archive", () => client.deploy({ ...config, cwd }));
  printResult(result, "Deployment started");
}

async function redeploy(client: PxxlClient, args: string[]) {
  const id = required(args.shift(), "project id");
  const result = await spinner("Requesting redeploy", () => client.redeployProject(id, {
    commitSha: flagValue(args, "--commit") || flagValue(args, "--sha"),
    commitMessage: flagValue(args, "--message") || flagValue(args, "-m"),
  }));
  if (wantsJSON(args)) return printJSON(result);
  printResult(result, "Redeploy queued");
}

async function pullProject(client: PxxlClient, args: string[]) {
  const id = required(args.shift(), "project id");
  const destinationArg = args.find((arg) => !arg.startsWith("-"));
  const force = args.includes("--force");
  const response = await client.getProject(id);
  const project = ((response.project || response.data || response) as Record<string, unknown>);
  const githubUrl = stringValue(project.githubUrl);
  const branch = stringValue(project.githubBranch) || "main";
  assertSafeGitBranch(branch);
  if (!githubUrl) throw new Error("This project does not have a Git repository attached. SpaceDrop projects cannot be pulled with git.");
  const destination = resolve(destinationArg || await promptDestination(project.name ? String(project.name) : id));
  if (await isGitRepo(destination)) {
    const origin = (await run("git", ["-C", destination, "remote", "get-url", "origin"], { maxBuffer: 1024 * 1024 })).stdout.trim();
    if (!sameGitRemote(origin, githubUrl)) {
      throw new Error(`Refusing to update ${destination}: git origin (${origin}) does not match Pxxl project repo (${githubUrl}).`);
    }
    const status = (await run("git", ["-C", destination, "status", "--porcelain"], { maxBuffer: 1024 * 1024 })).stdout.trim();
    if (status) throw new Error(`Refusing to pull into ${destination}: working tree has local changes.`);
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
    const result = await spinner("Fetching environment variables", () => client.listProjectEnv(id, { global: args.includes("--global") }));
    if (wantsJSON(args)) return printJSON(result);
    return printEnvList(result);
  }
  if (command === "push") {
    const id = required(args.shift(), "project id");
    const file = flagValue(args, "--file") || flagValue(args, "-f") || ".env";
    const secret = (flagValue(args, "--secret") || "true").toLowerCase() !== "false";
    const vars = parseDotEnv(await readFile(resolve(file), "utf8"), secret);
    if (vars.length === 0) throw new Error(`No environment variables found in ${file}`);
    const result = await spinner("Pushing environment variables", () => client.pushProjectEnv(id, vars, { global: args.includes("--global") }));
    if (wantsJSON(args)) return printJSON(result);
    return printResult(result, `Pushed ${vars.length} environment variable${vars.length === 1 ? "" : "s"}`);
  }
  throw new Error(`Unknown env command: ${command || ""}`);
}

async function cdn(client: PxxlClient, args: string[]) {
  const command = args.shift();
  if (!command || command === "help") return print(usage);
  if (command === "summary") {
    const result = await spinner("Fetching CDN summary", () => client.summary());
    if (wantsJSON(args)) return printJSON(result);
    return printCDNSummary(result);
  }
  if (command === "list") {
    const result = await spinner("Fetching CDN assets", () => client.listAssets());
    if (wantsJSON(args)) return printJSON(result);
    return printAssets(result);
  }
  if (command === "usage") {
    const result = await spinner("Fetching CDN usage events", () => client.usage(Number(flagValue(args, "--limit") || 100)));
    if (wantsJSON(args)) return printJSON(result);
    return printCDNUsage(result);
  }
  if (command === "delete") {
    const id = required(args.shift(), "asset id");
    await client.deleteAsset(id);
    return printSuccess(`Deleted ${id}`);
  }
  if (command === "download") {
    const id = required(args.shift(), "asset id");
    const out = required(args.shift(), "output file");
    const blob = await client.downloadAsset(id);
    await writeFile(out, Buffer.from(await blob.arrayBuffer()));
    return printSuccess(`Downloaded ${id} to ${out}`);
  }
  if (command === "upload") {
    const file = required(args.shift(), "file path");
    const info = await stat(file);
    if (!info.isFile()) throw new Error(`${file} is not a file`);
    const visibility: CDNVisibility = args.includes("--private") ? "private" : "public";
    const bytes = await readFile(file);
    const asset = await spinner("Uploading CDN asset", () => client.uploadAsset({ file: new Blob([bytes]), fileName: basename(file), visibility }));
    if (wantsJSON(args)) return printJSON(asset);
    return printAsset(asset);
  }
  throw new Error(`Unknown CDN command: ${command}`);
}

async function teams(client: PxxlClient | undefined, args: string[]) {
  const command = args.shift();
  if (command === "list" || !command) {
    if (!client) throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
    const result = await spinner("Fetching spaceships", () => client.listTeams());
    if (wantsJSON(args)) return printJSON(result);
    return printTeams(result);
  }
  if (command === "get" || command === "show") {
    if (!client) throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
    const id = required(args.shift(), "team id");
    const result = await spinner("Fetching spaceship", () => client.getTeam(id));
    if (wantsJSON(args)) return printJSON(result);
    return printTeam(result.team);
  }
  if (command === "use" || command === "switch") {
    const id = required(args.shift(), "team id");
    await saveTeamSelection(id);
    return printSuccess(`Using spaceship ${id}`);
  }
  if (command === "current") {
    const config = await readAuthConfig();
    if (wantsJSON(args)) return printJSON({ selectedTeamId: config.selectedTeamId || null });
    return print(config.selectedTeamId ? `${bold("Selected spaceship")} ${config.selectedTeamId}` : dim("No spaceship selected."));
  }
  if (command === "clear") {
    await saveTeamSelection(undefined);
    return printSuccess("Cleared selected spaceship.");
  }
  throw new Error(`Unknown team command: ${command}`);
}

function teamCommandCanRunWithoutAuth(command: string | undefined): boolean {
  return command === "current" || command === "clear" || command === "use" || command === "switch";
}

async function databases(client: PxxlClient, args: string[]) {
  const command = args.shift();
  if (command === "list" || !command) {
    const result = await spinner("Fetching databases", () => client.listDatabases(flagValue(args, "--team")));
    if (wantsJSON(args)) return printJSON(result);
    return printDatabases(result);
  }
  if (command === "get" || command === "show") {
    const id = required(args.shift(), "database id");
    const result = await spinner("Fetching database", () => client.getDatabase(id, flagValue(args, "--team")));
    if (wantsJSON(args)) return printJSON(result);
    return printDatabase(result.database);
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
    if (wantsJSON(args)) return printJSON(result);
    return printDatabase(result.database, "Database created");
  }
  if (command === "update") {
    const id = required(args.shift(), "database id");
    const result = await spinner("Updating database", () => client.updateDatabase(id, {
      name: flagValue(args, "--name") || flagValue(args, "-n"),
      description: flagValue(args, "--description"),
      teamId: flagValue(args, "--team"),
    }));
    if (wantsJSON(args)) return printJSON(result);
    return printDatabase(result.database, "Database updated");
  }
  if (command === "delete" || command === "remove") {
    const id = required(args.shift(), "database id");
    const result = await spinner("Deleting database", () => client.deleteDatabase(id, flagValue(args, "--team")));
    if (wantsJSON(args)) return printJSON(result);
    return printResult(result, `Deleted database ${id}`);
  }
  if (command === "start") {
    const id = required(args.shift(), "database id");
    const result = await spinner("Starting database", () => client.startDatabase(id, flagValue(args, "--team")));
    if (wantsJSON(args)) return printJSON(result);
    return printResult(result, `Started database ${id}`);
  }
  if (command === "stop") {
    const id = required(args.shift(), "database id");
    const result = await spinner("Stopping database", () => client.stopDatabase(id, flagValue(args, "--team")));
    if (wantsJSON(args)) return printJSON(result);
    return printResult(result, `Stopped database ${id}`);
  }
  if (command === "restart") {
    const id = required(args.shift(), "database id");
    const result = await spinner("Restarting database", () => client.restartDatabase(id, flagValue(args, "--team")));
    if (wantsJSON(args)) return printJSON(result);
    return printResult(result, `Restarted database ${id}`);
  }
  if (command === "stats") {
    const id = required(args.shift(), "database id");
    const result = await spinner("Fetching database stats", () => client.databaseStats(id, flagValue(args, "--team")));
    if (wantsJSON(args)) return printJSON(result);
    return printNestedObject("Database stats", result);
  }
  if (command === "tables") {
    const id = required(args.shift(), "database id");
    const result = await spinner("Fetching database tables", () => client.databaseTables(id, flagValue(args, "--team")));
    if (wantsJSON(args)) return printJSON(result);
    return printNestedObject("Database tables", result);
  }
  throw new Error(`Unknown database command: ${command || ""}`);
}

async function authedClient(): Promise<PxxlClient> {
  const config = await readAuthConfig();
  if (!config.apiKey) throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
  return new PxxlClient({ apiKey: config.apiKey, teamId: config.selectedTeamId });
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

function assertSafeGitBranch(branch: string) {
  if (!branch || branch.startsWith("-") || /[\s\x00-\x1f\x7f]/.test(branch) || branch.includes("..") || /[~^:?*[\\]/.test(branch)) {
    throw new Error(`Refusing unsafe git branch name from project metadata: ${branch || "(empty)"}`);
  }
}

function sameGitRemote(a: string, b: string): boolean {
  return normalizeGitRemote(a) === normalizeGitRemote(b);
}

function normalizeGitRemote(value: string): string {
  return value.trim().replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();
}

function wantsJSON(args: string[]): boolean {
  return args.includes("--json");
}

async function spinner<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!process.stderr.isTTY || process.env.NO_COLOR) return fn();
  const frames = ["-", "\\", "|", "/"];
  let index = 0;
  process.stderr.write(`${dim(frames[index] || "-")} ${label}`);
  const timer = setInterval(() => {
    index = (index + 1) % frames.length;
    process.stderr.write(`\r${dim(frames[index] || "-")} ${label}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(timer);
    process.stderr.write(`\r${green("✓")} ${label}\n`);
    return result;
  } catch (error) {
    clearInterval(timer);
    process.stderr.write(`\r${red("✕")} ${label}\n`);
    throw error;
  }
}

function printIdentity(value: unknown, selectedTeamId?: string, selectedTeam?: TeamSummary) {
  const data = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const user = (data.user && typeof data.user === "object" ? data.user : {}) as Record<string, unknown>;
  print(`${green("Authenticated")} ${dim("via")} ${String(data.authMethod || "api_key")}`);
  if (user.email || user.id) print(`  ${bold("User")}        ${String(user.email || user.id)}`);
  if (data.apiKeyScope) print(`  ${bold("Scope")}       ${String(data.apiKeyScope)}:${String(data.apiKeyPermission || "read")}`);
  const keyTeam = stringValue(data.teamId);
  if (keyTeam) print(`  ${bold("Key team")}    ${keyTeam}`);
  if (selectedTeamId) {
    const label = selectedTeam?.name ? `${selectedTeam.name} ${dim(`(${selectedTeamId})`)}` : selectedTeamId;
    print(`  ${bold("Using team")}  ${label}`);
  } else if (!keyTeam) {
    print(`  ${bold("Using team")}  ${dim("Personal account")}`);
  }
}

function printUsageOverview(value: unknown, title: string) {
  const root = asRecord(value);
  const data = asRecord(root.data || root);
  const summary = asRecord(data.summary);
  const scope = asRecord(data.scope);
  printHeader(title);
  if (scope.type) {
    const team = scope.teamId ? `team ${scope.teamId}` : "personal account";
    print(`${bold("Scope")} ${team}`);
  }
  printKV([
    ["Projects", numberValue(summary.totalProjects)],
    ["Active", numberValue(summary.activeProjects)],
    ["Deployments", numberValue(summary.totalDeployments)],
    ["Successful", numberValue(summary.successfulDeployments)],
    ["Failed", numberValue(summary.failedDeployments)],
    ["Running", numberValue(summary.runningDeployments)],
    ["Build time", formatDuration(numberValue(summary.buildSeconds))],
    ["Monthly build", formatDuration(numberValue(summary.monthlyBuildSeconds))],
    ["Artifacts", formatBytes(numberValue(summary.totalArtifactBytes))],
    ["Artifact limit", formatBytes(numberValue(summary.artifactLimitBytes))],
  ]);
  const projects = arrayValue(data.projects).slice(0, 8).map((item) => {
    const row = asRecord(item);
    return {
      name: stringValue(row.name || row.id),
      deployments: String(numberValue(row.deploymentCount)),
      builds: formatDuration(numberValue(row.buildSeconds)),
      artifacts: formatBytes(numberValue(row.artifactBytes)),
      status: stringValue(row.status) || "-",
    };
  });
  if (projects.length) printTable("Top projects", projects, ["name", "deployments", "builds", "artifacts", "status"]);
  const recent = arrayValue(data.recentDeployments).slice(0, 6).map((item) => {
    const row = asRecord(item);
    return {
      project: stringValue(row.projectName || row.projectId),
      status: stringValue(row.buildStatus) || "-",
      build: formatDuration(numberValue(row.buildSeconds)),
      artifact: formatBytes(numberValue(row.artifactBytes)),
      created: shortDate(row.createdAt),
    };
  });
  if (recent.length) printTable("Recent deployments", recent, ["project", "status", "build", "artifact", "created"]);
}

function printCDNSummary(value: unknown) {
  const data = asRecord(value);
  printHeader("CDN summary");
  printKV([
    ["Files", numberValue(data.totalFiles)],
    ["Stored", formatBytes(numberValue(data.storageBytes))],
    ["Uploaded", formatBytes(numberValue(data.uploadedBytes))],
    ["Downloaded", formatBytes(numberValue(data.downloadedBytes))],
    ["Uploads 24h", numberValue(data.uploadsLast24h)],
    ["Configured", data.configured === false ? "No" : "Yes"],
  ]);
  const recent = arrayValue(data.recentAssets).slice(0, 6).map(assetRow);
  if (recent.length) printTable("Recent assets", recent, ["file", "size", "visibility", "kind", "created", "id"]);
}

function printAsset(value: unknown) {
  const asset = assetRow(value);
  printHeader("CDN asset");
  printKV([
    ["File", asset.file],
    ["Size", asset.size],
    ["Visibility", asset.visibility],
    ["Kind", asset.kind],
    ["Created", asset.created],
    ["ID", asset.id],
  ]);
  const url = stringValue(asRecord(value).publicUrl);
  if (url) print(`${bold("URL")} ${cyan(url)}`);
}

function printAssets(value: unknown) {
  const root = asRecord(value);
  const assets = arrayValue(root.assets || root.data || value).map(assetRow);
  printHeader("CDN assets");
  if (!assets.length) return print(dim("No assets found."));
  printTable("", assets, ["file", "size", "visibility", "kind", "created", "id"]);
}

function printCDNUsage(value: unknown) {
  const rows = arrayValue(value).map((item) => {
    const row = asRecord(item);
    return {
      type: stringValue(row.eventType || row.type) || "-",
      file: stringValue(row.fileName || row.assetId) || "-",
      bytes: formatBytes(numberValue(row.bytes)),
      created: shortDate(row.createdAt),
    };
  });
  printHeader("CDN usage");
  if (!rows.length) return print(dim("No usage events found."));
  printTable("", rows, ["type", "file", "bytes", "created"]);
}

function printTeams(value: unknown) {
  const root = asRecord(value);
  const rows = arrayValue(root.teams || root.data || value).map((item) => {
    const team = asRecord(item);
    return {
      name: stringValue(team.name || team.id),
      role: stringValue(team.myRole) || "-",
      status: stringValue(team.status) || "-",
      projects: String(numberValue(team.totalProjects)),
      databases: String(numberValue(team.totalDatabases)),
      domains: String(numberValue(team.totalDomains)),
      id: stringValue(team.id),
    };
  });
  printHeader("Spaceships");
  if (!rows.length) return print(dim("No spaceships found."));
  printTable("", rows, ["name", "role", "status", "projects", "databases", "domains", "id"]);
}

function printTeam(team: TeamSummary) {
  printHeader("Spaceship");
  printKV([
    ["Name", team.name || team.id],
    ["ID", team.id],
    ["Role", team.myRole || "-"],
    ["Status", team.status || "-"],
    ["Projects", team.totalProjects ?? 0],
    ["Databases", team.totalDatabases ?? 0],
    ["Domains", team.totalDomains ?? 0],
  ]);
}

function printDatabases(value: unknown) {
  const root = asRecord(value);
  const rows = arrayValue(root.databases || root.data || value).map(databaseRow);
  printHeader("Databases");
  if (!rows.length) return print(dim("No databases found."));
  printTable("", rows, ["name", "type", "status", "host", "port", "id"]);
}

function printDatabase(database: DatabaseSummary, title = "Database") {
  const row = databaseRow(database);
  printHeader(title);
  printKV([
    ["Name", row.name],
    ["Type", row.type],
    ["Status", row.status],
    ["Host", row.host],
    ["Port", row.port],
    ["ID", row.id],
  ]);
}

function printEnvList(value: unknown) {
  const root = asRecord(value);
  const vars = arrayValue(root.envs || root.variables || root.data || value).map((item) => {
    const row = asRecord(item);
    return {
      key: stringValue(row.key || row.name),
      secret: row.isSecret === true || row.secret === true ? "yes" : "no",
      scope: stringValue(row.scope || row.environment) || "-",
    };
  });
  printHeader("Environment variables");
  if (!vars.length) return print(dim("No environment variables found."));
  printTable("", vars, ["key", "secret", "scope"]);
}

function printResult(value: unknown, fallback: string) {
  const root = asRecord(value);
  printSuccess(stringValue(root.message) || fallback);
  const id = stringValue(root.id || root.projectId || asRecord(root.project).id || asRecord(root.deployment).id);
  const status = stringValue(root.status || root.deploymentStatus || root.buildStatus || asRecord(root.project).status || asRecord(root.deployment).status);
  const url = stringValue(root.url || root.domain || root.publicUrl || asRecord(root.project).url || asRecord(root.deployment).url);
  const rows: [string, unknown][] = [];
  if (id) rows.push(["ID", id]);
  if (status) rows.push(["Status", status]);
  if (url) rows.push(["URL", url]);
  if (rows.length) printKV(rows);
}

function printNestedObject(title: string, value: unknown) {
  printHeader(title);
  const root = asRecord(value);
  const entries = Object.entries(root).filter(([, item]) => item !== undefined && item !== null);
  if (!entries.length) return print(dim("No data returned."));
  for (const [key, item] of entries) {
    if (Array.isArray(item)) {
      print(`${bold(labelize(key))} ${dim(`${item.length} item${item.length === 1 ? "" : "s"}`)}`);
      const rows = item.slice(0, 10).map((row) => flattenRecord(asRecord(row)));
      if (rows.length) printTable("", rows, Object.keys(rows[0] || {}).slice(0, 6));
    } else if (typeof item === "object") {
      print(`${bold(labelize(key))}`);
      printKV(Object.entries(asRecord(item)).slice(0, 12).map(([k, v]) => [labelize(k), primitive(v)]));
    } else {
      printKV([[labelize(key), primitive(item)]]);
    }
  }
}

function assetRow(value: unknown) {
  const asset = asRecord(value);
  return {
    file: stringValue(asset.fileName || asset.name || asset.id) || "-",
    size: formatBytes(numberValue(asset.size)),
    visibility: stringValue(asset.visibility) || "-",
    kind: stringValue(asset.kind) || "-",
    created: shortDate(asset.createdAt),
    id: stringValue(asset.id),
  };
}

function databaseRow(value: unknown) {
  const db = asRecord(value);
  return {
    name: stringValue(db.name || db.actualDatabaseName || db.id),
    type: stringValue(db.type) || "-",
    status: stringValue(db.status) || "-",
    host: stringValue(db.proxyHost || db.routeKey || db.externalUrl) || "-",
    port: db.proxyPort || db.port ? String(db.proxyPort || db.port) : "-",
    id: stringValue(db.id),
  };
}

function printHeader(value: string) {
  print(`\n${bold(value)}`);
}

function printKV(rows: [string, unknown][]) {
  const width = rows.reduce((max, [key]) => Math.max(max, key.length), 0);
  for (const [key, value] of rows) {
    print(`  ${dim(key.padEnd(width))}  ${String(value)}`);
  }
}

function printTable(title: string, rows: Record<string, string>[], columns: string[]) {
  if (title) print(`\n${bold(title)}`);
  if (!rows.length) return;
  const widths = columns.map((column) => Math.max(column.length, ...rows.map((row) => (row[column] || "").length)));
  print(`  ${columns.map((column, index) => dim(column.padEnd(widths[index] || column.length))).join("  ")}`);
  for (const row of rows) {
    print(`  ${columns.map((column, index) => (row[column] || "").padEnd(widths[index] || column.length)).join("  ")}`);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function flattenRecord(value: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value).slice(0, 8)) out[labelize(key)] = primitive(item);
  return out;
}

function primitive(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "number") return Number.isFinite(value) ? new Intl.NumberFormat("en").format(value) : "-";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatBytes(value: number): string {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function shortDate(value: unknown): string {
  const raw = stringValue(value);
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toISOString().slice(0, 10);
}

function labelize(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function printJSON(value: unknown) {
  print(JSON.stringify(value, null, 2));
}

function printSuccess(value: string) {
  print(`${green("✓")} ${value}`);
}

function print(value: string) {
  process.stdout.write(`${value}\n`);
}

function color(code: number, value: string): string {
  if (process.env.NO_COLOR || !process.stdout.isTTY) return value;
  return `\u001b[${code}m${value}\u001b[0m`;
}

function bold(value: string): string {
  return color(1, value);
}

function dim(value: string): string {
  return color(2, value);
}

function green(value: string): string {
  return color(32, value);
}

function red(value: string): string {
  return color(31, value);
}

function cyan(value: string): string {
  return color(36, value);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
