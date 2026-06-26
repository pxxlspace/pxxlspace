#!/usr/bin/env node
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { resolve4, resolve6, resolveCname, resolveNs } from "node:dns/promises";
import { platform } from "node:os";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { PXXL_API_BASE_URL, PxxlAPIError, PxxlClient, clearAuthConfig, configPath, copyBoilerplate, createProjectZip, readPxxlToml, readBoilerplateManifest, readAuthConfig, saveAuthConfig, saveTeamSelection, sha256Hex, writeDefaultPxxlFiles, } from "./index.js";
const run = promisify(execFile);
const cliVersion = "0.1.11";
const databaseTypes = ["postgres", "clickhouse", "dragonfly", "redis", "keydb", "mariadb", "mysql", "mongodb"];
const timeframes = ["24h", "48h", "72h", "7d", "30d"];
const logo = `${magenta("██████╗ ██╗  ██╗██╗  ██╗██╗     ")}
${magenta("██╔══██╗╚██╗██╔╝╚██╗██╔╝██║     ")}
${magenta("██████╔╝ ╚███╔╝  ╚███╔╝ ██║     ")}
${magenta("██╔═══╝  ██╔██╗  ██╔██╗ ██║     ")}
${magenta("██║     ██╔╝ ██╗██╔╝ ██╗███████╗")}
${magenta("╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝")}`;
const usage = `${logo}

${bold("Go live on Pxxl in seconds!")} ${dim(`v${cliVersion}`)}
${bold("Website")} ${link("https://pxxl.app")}
${bold("Docs")}    ${link("https://docs.pxxl.app")}

${bold("Account")}
  ${cyan("pxxl login")} --api-key <key>       Validate and save a Pxxl API key
  ${cyan("pxxl logout")}                     Remove local credentials
  ${cyan("pxxl whoami")}                     Show the active account and API key scope
  ${cyan("pxxl status")}                     Same as whoami
  ${cyan("pxxl stats")}                      Show platform stats for the current scope
  ${cyan("pxxl usage")}                      Show usage for the current scope

${bold("Deploy")}
  ${cyan("pxxl doctor")}                     Check auth, git, config, package manager, and deploy issues
  ${cyan("pxxl inspect")}                    Show detected framework, runtime, env files, and deploy size
  ${cyan("pxxl init")} --new <starter>        Create a Pxxl-ready project
  ${cyan("pxxl deploy")}                     Package this directory and deploy on Pxxl
  ${cyan("pxxl deploy")} -m "message"        Deploy with a custom commit message
  ${cyan("pxxl redeploy")} <project-id>       Trigger a fresh deployment
  ${cyan("pxxl pull")} <project-id> [folder]  Clone or update the attached Git repo
  ${cyan("pxxl projects list")}               List projects
  ${cyan("pxxl projects get")} [project-id]   Show project details
  ${cyan("pxxl deployments recent")}          Show recent deployments
  ${cyan("pxxl deployments get")} [id]        Show deployment details
  ${cyan("pxxl logs")}                       Fetch recent project/deployment logs
  ${cyan("pxxl logs")} --since 1h             Fetch recent logs by time window
  ${cyan("pxxl logs")} --follow               Poll live project logs
  ${cyan("pxxl open")}                       Open the current dashboard, deployment, or live URL

${bold("Project Config")}
  ${cyan("pxxl env list")} <project-id>       List project env names
  ${cyan("pxxl env diff")} [project-id]       Compare local .env with encrypted remote envs
  ${cyan("pxxl env push")} [project-id]       Push a local .env file
  ${cyan("pxxl env push")} --force            Replace remote envs with local .env

${bold("CDN")}
  ${cyan("pxxl cdn summary")}                 Show CDN usage summary
  ${cyan("pxxl cdn list")}                    List assets
  ${cyan("pxxl cdn upload")} <file>           Upload an asset
  ${cyan("pxxl cdn download")} <id> <file>    Download an asset
  ${cyan("pxxl cdn delete")} <id>             Delete an asset

${bold("Spaceships")}
  ${cyan("pxxl team list")}                   List teams
  ${cyan("pxxl team use")} [team-id]          Select a team for scoped commands
  ${cyan("pxxl team current")}                Show selected team
  ${cyan("pxxl team clear")}                  Clear selected team

${bold("Databases")}
  ${cyan("pxxl db list")}                     List databases
  ${cyan("pxxl db create")} [--name <name>] [--type <type>]
  ${cyan("pxxl db get")} [database-id]
  ${cyan("pxxl db start|stop|restart|delete")} [database-id]
  ${cyan("pxxl db stats|tables")} [database-id]

${bold("Domains")}
  ${cyan("pxxl domains list")}                List domains available for stats
  ${cyan("pxxl domains check")} <domain>      Check DNS, ownership, SSL, and proxy route
  ${cyan("pxxl domains connect")} <domain>    Add a custom domain to a project
  ${cyan("pxxl domains verify")} <domain>     Verify expected project DNS records
  ${cyan("pxxl domains records")} <id>         List or edit managed DNS records
  ${cyan("pxxl domains cert")} <id> --out file Download the proxy public certificate
  ${cyan("pxxl domains activate")} <id>        Check activation and SSL routing
  ${cyan("pxxl domains stats")} [domain]      Show proxy stats for a domain

${bold("Cron Jobs")}
  ${cyan("pxxl cron list")}                    List scheduled HTTP cron jobs
  ${cyan("pxxl cron create")}                  Create an HTTP cron job
  ${cyan("pxxl cron get")} [id]                Show cron job details
  ${cyan("pxxl cron update")} [id]             Update a cron job
  ${cyan("pxxl cron start|stop|trigger")} [id] Control or run a cron job
  ${cyan("pxxl cron runs")} [id]               Show cron run history
  ${cyan("pxxl cron validate-schedule")} "*/5 * * * *"
  ${cyan("pxxl cron validate-url")} <url>

${bold("Environment")}
  ${dim("PXXL_API_KEY")} overrides stored credentials.
  ${dim("PXXL_TEAM_ID")} overrides the selected spaceship/team for scoped commands.
  Pass ${dim("--json")} to print raw API responses for scripting.
`;
async function main() {
    const args = process.argv.slice(2);
    const command = args.shift();
    if (command === "version" || command === "--version" || command === "-v")
        return print(cliVersion);
    if (!command || command === "help" || command === "--help" || command === "-h")
        return print(usage);
    if (command === "login")
        return login(args);
    if (command === "logout") {
        await clearAuthConfig();
        return print("Logged out.");
    }
    if (command === "init")
        return initProject(args);
    if (command === "doctor")
        return doctor(args);
    if (command === "inspect")
        return inspectProject(args);
    if (command === "open")
        return openCurrent(args);
    if ((command === "team" || command === "teams" || command === "spaceship" || command === "spaceships") && teamCommandCanRunWithoutAuth(args)) {
        return teams(undefined, args);
    }
    const client = await authedClient();
    if (command === "whoami" || command === "status")
        return whoami(client, args);
    if (command === "stats")
        return stats(client, args);
    if (command === "usage")
        return usageOverview(client, args);
    if (command === "deploy")
        return deploy(client, args);
    if (command === "redeploy")
        return redeploy(client, args);
    if (command === "project" || command === "projects")
        return projects(client, args);
    if (command === "deployment" || command === "deployments")
        return deployments(client, args);
    if (command === "pull")
        return pullProject(client, args);
    if (command === "logs" || command === "log")
        return logs(client, args);
    if (command === "env" || command === "envs")
        return envs(client, args);
    if (command === "cdn")
        return cdn(client, args);
    if (command === "domain" || command === "domains")
        return domains(client, args);
    if (command === "cron")
        return cron(client, args);
    if (command === "team" || command === "teams" || command === "spaceship" || command === "spaceships")
        return teams(client, args);
    if (command === "db" || command === "database" || command === "databases")
        return databases(client, args);
    throw new Error(`Unknown command: ${command}`);
}
async function login(args) {
    const apiKey = flagValue(args, "--api-key") || flagValue(args, "-k");
    if (!apiKey)
        throw new Error("pxxl login requires --api-key <key>");
    if (args.includes("--api-url"))
        throw new Error("Custom API URLs are not supported. Pxxl CLI uses the official Gateway endpoint.");
    const client = new PxxlClient({ apiKey });
    const identity = await spinner("Validating API key", () => client.whoami());
    await saveAuthConfig(apiKey);
    printSuccess(`Saved Pxxl credentials to ${configPath()}`);
    printIdentity(identity);
}
async function whoami(client, args) {
    const identity = await spinner("Checking account", () => client.whoami());
    if (wantsJSON(args))
        return printJSON(identity);
    const config = await readAuthConfig();
    let selectedTeam;
    if (config.selectedTeamId) {
        selectedTeam = await client.getTeam(config.selectedTeamId).then((value) => value.team).catch(() => undefined);
    }
    printIdentity(identity, config.selectedTeamId, selectedTeam);
}
async function stats(client, args) {
    const result = await spinner("Fetching stats", () => client.stats(flagValue(args, "--team")));
    if (wantsJSON(args))
        return printJSON(result);
    printUsageOverview(result, "Pxxl stats");
}
async function usageOverview(client, args) {
    const result = await spinner("Fetching usage", () => client.platformUsage(flagValue(args, "--team")));
    if (wantsJSON(args))
        return printJSON(result);
    printUsageOverview(result, "Pxxl usage");
}
async function doctor(args) {
    const cwd = resolve(flagValue(args, "--dir") || ".");
    const checks = [];
    const add = (check, ok, detail, warn = false) => checks.push({ check, status: ok ? green("ok") : warn ? cyan("warn") : red("fail"), detail });
    const config = await readAuthConfig();
    if (config.apiKey) {
        try {
            const identity = await new PxxlClient({ apiKey: config.apiKey, teamId: config.selectedTeamId }).whoami();
            const user = asRecord(asRecord(identity).user);
            add("auth", true, stringValue(user.email || user.id) || "API key is valid");
        }
        catch (error) {
            add("auth", false, error instanceof Error ? error.message : "Invalid API key");
        }
    }
    else {
        add("auth", false, "Run pxxl login --api-key <key> or set PXXL_API_KEY", true);
    }
    try {
        const response = await fetch(`${PXXL_API_BASE_URL}/cli/whoami`, { method: "GET" });
        const reachable = response.status < 500;
        add("internet", reachable, reachable ? `Pxxl Gateway is reachable (HTTP ${response.status})` : `Gateway returned HTTP ${response.status}`, !reachable);
    }
    catch {
        add("internet", false, "Could not reach Pxxl Gateway. Check your internet connection.");
    }
    const git = await gitState(cwd);
    add("git", git.inside && git.clean, git.detail, git.inside && !git.clean);
    add("pxxl.toml", await exists(resolve(cwd, "pxxl.toml")), (await exists(resolve(cwd, "pxxl.toml"))) ? "Found project config" : "Missing pxxl.toml; run pxxl init", true);
    add(".pxxlignore", await exists(resolve(cwd, ".pxxlignore")), (await exists(resolve(cwd, ".pxxlignore"))) ? "Found deploy ignore file" : "Missing .pxxlignore; run pxxl init", true);
    const inspection = await analyzeLocalProject(cwd);
    add("package manager", Boolean(inspection.packageManager), inspection.packageManager || "No lockfile/package manager detected", !inspection.packageManager);
    add("framework", Boolean(inspection.framework), inspection.framework || "No framework detected", true);
    add("build command", Boolean(inspection.buildCommand || inspection.scripts.build), inspection.buildCommand || inspection.scripts.build || "No build command detected", !inspection.buildCommand && !inspection.scripts.build);
    add("start command", Boolean(inspection.startCommand), inspection.startCommand || "No start command detected", !inspection.startCommand);
    add("env files", true, inspection.envFiles.length ? inspection.envFiles.join(", ") : "No local env files found");
    add("deploy archive", inspection.archiveError ? false : true, inspection.archiveError || formatBytes(inspection.deploySizeBytes));
    if (wantsJSON(args))
        return printJSON({ checks, inspection });
    printHeader("Pxxl doctor");
    printTable("", checks, ["check", "status", "detail"]);
}
async function inspectProject(args) {
    const cwd = resolve(flagValue(args, "--dir") || ".");
    const inspection = await analyzeLocalProject(cwd);
    if (wantsJSON(args))
        return printJSON(inspection);
    printHeader("Pxxl inspect");
    printKV([
        ["Directory", cwd],
        ["Framework", inspection.framework || "-"],
        ["Package manager", inspection.packageManager || "-"],
        ["Runtime", inspection.runtime || "-"],
        ["Install", inspection.installCommand || "-"],
        ["Build", inspection.buildCommand || "-"],
        ["Start", inspection.startCommand || "-"],
        ["Env files", inspection.envFiles.length ? inspection.envFiles.join(", ") : "-"],
        ["Deploy size", inspection.archiveError ? red(inspection.archiveError) : formatBytes(inspection.deploySizeBytes)],
    ]);
    const configRows = Object.entries(inspection.config).filter(([, value]) => value !== undefined && value !== "");
    if (configRows.length)
        printKV(configRows.map(([key, value]) => [labelize(key), primitive(value)]));
}
async function openCurrent(args) {
    const cwd = resolve(flagValue(args, "--dir") || ".");
    const config = await readPxxlToml(cwd);
    let url = flagValue(args, "--url");
    if (!url && args.includes("--deployment"))
        url = config.deploymentUrl;
    if (!url && (args.includes("--live") || args.includes("--domain")))
        url = config.projectUrl;
    if (!url && config.projectId)
        url = `https://pxxl.app/dashboard/projects/${config.projectId}`;
    if (!url)
        url = config.projectUrl || config.deploymentUrl || "https://pxxl.app/dashboard";
    await openUrl(url);
    print(`${bold("Opened")} ${link(url)}`);
}
async function initProject(args) {
    let boilerplate = flagValue(args, "--new");
    if (args.includes("--new") && !boilerplate) {
        boilerplate = await chooseBoilerplate();
    }
    if (boilerplate)
        boilerplate = await resolveBoilerplateName(boilerplate);
    const manifest = boilerplate ? await readBoilerplateManifest(boilerplate) : undefined;
    const nameFromFlag = flagValue(args, "--name");
    const defaultNameSeed = nameFromFlag || manifest?.family || manifest?.framework || manifest?.id || basename(process.cwd());
    const defaultName = slugifyProjectName(defaultNameSeed) || "pxxl-app";
    const projectName = nameFromFlag || (isInteractive() ? await promptText("Project name", defaultName) : defaultName);
    assertValidProjectName(projectName);
    const dir = await resolveInitDirectory(args, projectName, Boolean(boilerplate));
    if (boilerplate)
        await copyBoilerplate(boilerplate, dir);
    const domainChoice = normalizeDomainChoice(flagValue(args, "--domain") || await chooseDomainSuffix()) || "pxxl.pro";
    assertValidDomainChoice(domainChoice);
    const config = {
        name: projectName,
        domainChoice,
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
    const shouldDeploy = args.includes("--deploy") || (!args.includes("--no-deploy") && Boolean((await readAuthConfig()).apiKey) && await promptConfirm("Deploy now?", true));
    if (shouldDeploy) {
        const client = await authedClient();
        const result = await spinner("Creating first deployment", () => client.deploy({ cwd: dir }));
        await persistDeploymentResult(dir, result);
        printDeployResult(result, "Deployment started");
    }
}
async function deploy(client, args) {
    const config = {};
    if (flagValue(args, "--name"))
        config.name = flagValue(args, "--name");
    if (flagValue(args, "--domain"))
        config.domainChoice = normalizeDomainChoice(flagValue(args, "--domain"));
    if (flagValue(args, "--port"))
        config.port = Number(flagValue(args, "--port"));
    if (flagValue(args, "--message") || flagValue(args, "-m"))
        config.commitMessage = flagValue(args, "--message") || flagValue(args, "-m");
    const cwd = resolve(flagValue(args, "--dir") || ".");
    const archive = await createProjectZip(cwd);
    print(`Created Pxxl deploy archive (${archive.length} bytes, sha256 ${sha256Hex(archive).slice(0, 16)}...)`);
    const result = await spinner("Uploading deploy archive", () => client.deploy({ ...config, cwd }));
    await persistDeploymentResult(cwd, result);
    printDeployResult(result, "Deployment started");
}
async function redeploy(client, args) {
    const id = required(args.shift(), "project id");
    const result = await spinner("Requesting redeploy", () => client.redeployProject(id, {
        commitSha: flagValue(args, "--commit") || flagValue(args, "--sha"),
        commitMessage: flagValue(args, "--message") || flagValue(args, "-m"),
    }));
    if (wantsJSON(args))
        return printJSON(result);
    printResult(result, "Redeploy queued");
}
async function projects(client, args) {
    const command = args.shift() || "list";
    if (command === "list" || command === "ls") {
        return pagedProjects(client, args);
    }
    if (command === "get" || command === "show") {
        const id = await resolveProjectId(client, args.shift(), args);
        const result = await spinner("Fetching project", () => client.getProject(id));
        if (wantsJSON(args))
            return printJSON(result);
        return printProjectDetails(result);
    }
    throw new Error(`Unknown projects command: ${command}`);
}
async function deployments(client, args) {
    const command = args.shift() || "recent";
    if (command === "recent" || command === "list" || command === "ls") {
        return pagedDeployments(client, args);
    }
    if (command === "get" || command === "show") {
        const id = await resolveDeploymentId(client, args.shift(), args);
        const result = await spinner("Fetching deployment", () => client.getDeployment(id));
        if (wantsJSON(args))
            return printJSON(result);
        return printDeploymentDetails(result);
    }
    throw new Error(`Unknown deployments command: ${command}`);
}
async function pullProject(client, args) {
    const id = required(args.shift(), "project id");
    const destinationArg = args.find((arg) => !arg.startsWith("-"));
    const force = args.includes("--force");
    const response = await client.getProject(id);
    const project = (response.project || response.data || response);
    const githubUrl = stringValue(project.githubUrl);
    const branch = stringValue(project.githubBranch) || "main";
    assertSafeGitBranch(branch);
    if (!githubUrl)
        throw new Error("This project does not have a Git repository attached. SpaceDrop projects cannot be pulled with git.");
    const destination = resolve(destinationArg || await promptDestination(project.name ? String(project.name) : id));
    if (await isGitRepo(destination)) {
        const origin = (await run("git", ["-C", destination, "remote", "get-url", "origin"], { maxBuffer: 1024 * 1024 })).stdout.trim();
        if (!sameGitRemote(origin, githubUrl)) {
            throw new Error(`Refusing to update ${destination}: git origin (${origin}) does not match Pxxl project repo (${githubUrl}).`);
        }
        const status = (await run("git", ["-C", destination, "status", "--porcelain"], { maxBuffer: 1024 * 1024 })).stdout.trim();
        if (status)
            throw new Error(`Refusing to pull into ${destination}: working tree has local changes.`);
        print(`Updating existing git repo in ${destination}`);
        await run("git", ["-C", destination, "fetch", "origin", branch], { maxBuffer: 1024 * 1024 * 10 });
        await run("git", ["-C", destination, "checkout", branch], { maxBuffer: 1024 * 1024 * 10 });
        await run("git", ["-C", destination, "pull", "--ff-only", "origin", branch], { maxBuffer: 1024 * 1024 * 10 });
    }
    else {
        await ensureCloneDestination(destination, force);
        print(`Cloning ${githubUrl}#${branch} into ${destination}`);
        await run("git", ["clone", "--branch", branch, "--single-branch", githubUrl, destination], { maxBuffer: 1024 * 1024 * 10 });
    }
    print(`Pulled ${project.name || id} into ${destination}`);
}
async function envs(client, args) {
    const command = args.shift();
    if (command === "list") {
        const id = await resolveProjectId(client, args.shift(), args);
        const result = await spinner("Fetching environment variables", () => client.listProjectEnv(id, { global: args.includes("--global") }));
        if (wantsJSON(args))
            return printJSON(result);
        return printEnvList(result);
    }
    if (command === "diff") {
        const id = await resolveProjectIdFromArgsOrConfig(client, firstValueArg(args), args);
        const file = flagValue(args, "--file") || flagValue(args, "-f") || ".env";
        const vars = parseDotEnv(await readFile(resolve(file), "utf8"), true);
        if (vars.length === 0)
            throw new Error(`No environment variables found in ${file}`);
        const result = await spinner("Comparing environment variables", () => client.diffProjectEnv(id, vars, { global: args.includes("--global") }));
        if (wantsJSON(args))
            return printJSON(result);
        return printEnvDiff(result);
    }
    if (command === "push") {
        const id = await resolveProjectIdFromArgsOrConfig(client, firstValueArg(args), args);
        const file = flagValue(args, "--file") || flagValue(args, "-f") || ".env";
        const secret = (flagValue(args, "--secret") || "true").toLowerCase() !== "false";
        const vars = parseDotEnv(await readFile(resolve(file), "utf8"), secret);
        if (vars.length === 0)
            throw new Error(`No environment variables found in ${file}`);
        const replace = args.includes("--force") || args.includes("--replace");
        const result = await spinner(replace ? "Replacing environment variables" : "Pushing environment variables", () => client.pushProjectEnv(id, vars, { global: args.includes("--global"), replace }));
        if (wantsJSON(args))
            return printJSON(result);
        return printResult(result, `${replace ? "Replaced" : "Pushed"} ${vars.length} environment variable${vars.length === 1 ? "" : "s"}`);
    }
    throw new Error(`Unknown env command: ${command || ""}`);
}
async function cdn(client, args) {
    const command = args.shift();
    if (!command || command === "help")
        return print(usage);
    if (command === "summary") {
        const result = await spinner("Fetching CDN summary", () => client.summary());
        if (wantsJSON(args))
            return printJSON(result);
        return printCDNSummary(result);
    }
    if (command === "list") {
        const result = await spinner("Fetching CDN assets", () => client.listAssets());
        if (wantsJSON(args))
            return printJSON(result);
        return printAssets(result);
    }
    if (command === "usage") {
        const result = await spinner("Fetching CDN usage events", () => client.usage(Number(flagValue(args, "--limit") || 100)));
        if (wantsJSON(args))
            return printJSON(result);
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
        if (!info.isFile())
            throw new Error(`${file} is not a file`);
        const visibility = args.includes("--private") ? "private" : "public";
        const bytes = await readFile(file);
        const asset = await spinner("Uploading CDN asset", () => client.uploadAsset({ file: new Blob([bytes]), fileName: basename(file), visibility }));
        if (wantsJSON(args))
            return printJSON(asset);
        return printAsset(asset);
    }
    throw new Error(`Unknown CDN command: ${command}`);
}
async function domains(client, args) {
    const command = args.shift() || "list";
    if (command === "list" || command === "ls") {
        const result = await spinner("Fetching domains", () => client.listDomains(flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printDomains(result);
    }
    if (command === "stats") {
        const domain = await resolveDomainName(client, args.shift(), args);
        const timeframe = flagValue(args, "--timeframe") || await maybePromptSelect("Choose timeframe", timeframes, "30d");
        const result = await spinner(`Fetching stats for ${domain}`, () => client.domainStats(domain, { timeframe, teamId: flagValue(args, "--team") }));
        if (wantsJSON(args))
            return printJSON(result);
        return printDomainStats(result, domain);
    }
    if (command === "check") {
        const domain = required(args.shift(), "domain");
        const [remote, dns] = await Promise.all([
            spinner(`Checking ${domain} on Pxxl`, () => client.checkDomain(domain, flagValue(args, "--team"))),
            checkDNS(domain),
        ]);
        if (wantsJSON(args))
            return printJSON({ ...asRecord(remote), dns });
        return printDomainCheck(remote, dns);
    }
    if (command === "connect") {
        const domains = valueArgs(args);
        if (!domains.length)
            domains.push(await promptText("Domain"));
        const projectId = await resolveProjectIdFromArgsOrConfig(client, flagValue(args, "--project"), args);
        const teamId = flagValue(args, "--team");
        const inputs = domains.map((domain) => ({ domain, projectId, teamId, alias: hasFlag(args, "--alias") }));
        const result = await spinner(`Connecting ${domains.length} domain${domains.length === 1 ? "" : "s"}`, () => client.connectDomains(inputs));
        if (wantsJSON(args))
            return printJSON(result);
        return printDomainConnectResult(result, projectId);
    }
    if (command === "verify" || command === "checkrecord") {
        const domain = firstValueArg(args) || await promptText("Domain");
        const projectId = await resolveProjectIdFromArgsOrConfig(client, flagValue(args, "--project"), args);
        const result = await spinner(`Verifying ${domain}`, () => client.verifyDomainRecord({ domain, projectId, teamId: flagValue(args, "--team") }));
        if (wantsJSON(args))
            return printJSON(result);
        return printNestedObject("Domain verification", result);
    }
    if (command === "get") {
        const id = firstValueArg(args) || await resolveDomainId(client, args);
        const result = await spinner("Fetching domain", () => client.getDomain(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printNestedObject("Domain", result);
    }
    if (command === "activate") {
        const id = firstValueArg(args) || await resolveDomainId(client, args);
        const result = await spinner("Checking activation", () => client.activateDomain(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printNestedObject("Domain activation", result);
    }
    if (command === "zone") {
        const id = firstValueArg(args) || await resolveDomainId(client, args);
        const result = await spinner("Fetching zone status", () => client.getDomainZoneStatus(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printNestedObject("Domain zone", result);
    }
    if (command === "cert" || command === "certificate") {
        const id = firstValueArg(args) || await resolveDomainId(client, args);
        const out = flagValue(args, "--out") || `${id}_public_certificate.pem`;
        const cert = await spinner("Downloading certificate", () => client.downloadDomainCertificate(id, flagValue(args, "--team")));
        const bytes = new Uint8Array(await cert.arrayBuffer());
        await writeFile(out, bytes);
        return printSuccess(`Certificate saved to ${out}`);
    }
    if (command === "switch-to-pxxl-dns") {
        const id = firstValueArg(args) || await resolveDomainId(client, args);
        const result = await spinner("Switching to Pxxl DNS", () => client.switchDomainToPxxlDNS(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printNestedObject("Pxxl DNS", result);
    }
    if (command === "nameservers" || command === "ns") {
        const action = args.shift() || "verify";
        const id = firstValueArg(args) || await resolveDomainId(client, args);
        let result;
        if (action === "set") {
            const nameservers = (flagValue(args, "--values") || valueArgs(args).slice(1).join(",")).split(",").map((item) => item.trim()).filter(Boolean);
            if (!nameservers.length)
                throw new Error("Pass nameservers with --values ns1.example.com,ns2.example.com");
            result = await spinner("Updating nameservers", () => client.updateDomainNameservers(id, nameservers, flagValue(args, "--team")));
        }
        else if (action === "reset") {
            result = await spinner("Resetting nameservers", () => client.resetDomainNameservers(id, flagValue(args, "--team")));
        }
        else {
            result = await spinner("Verifying nameservers", () => client.verifyDomainNameservers(id, flagValue(args, "--team")));
        }
        if (wantsJSON(args))
            return printJSON(result);
        return printNestedObject("Nameservers", result);
    }
    if (command === "records" || command === "dns") {
        return domainRecords(client, args);
    }
    throw new Error(`Unknown domains command: ${command}`);
}
async function domainRecords(client, args) {
    const action = ["add", "create", "set", "update", "delete", "del", "rm", "list", "ls"].includes(args[0] || "") ? args.shift() || "list" : "list";
    const id = firstValueArg(args) || await resolveDomainId(client, args);
    const teamId = flagValue(args, "--team");
    let result;
    if (action === "add" || action === "create") {
        result = await spinner("Creating DNS record", () => client.createDomainDNSRecord(id, dnsRecordFromFlags(args, false, teamId)));
    }
    else if (action === "set" || action === "update") {
        result = await spinner("Updating DNS record", () => client.updateDomainDNSRecords(id, dnsRecordFromFlags(args, true, teamId)));
    }
    else if (action === "delete" || action === "del" || action === "rm") {
        const recordId = flagValue(args, "--record-id") || flagValue(args, "--id") || await promptText("Record ID");
        result = await spinner("Deleting DNS record", () => client.deleteDomainDNSRecord(id, { recordId, zoneId: flagValue(args, "--zone-id"), teamId }));
    }
    else {
        result = await spinner("Fetching DNS records", () => client.listDomainDNSRecords(id, teamId));
    }
    if (wantsJSON(args))
        return printJSON(result);
    if (action === "list" || action === "ls")
        return printDNSRecords(result);
    return printNestedObject("DNS records", result);
}
function dnsRecordFromFlags(args, includeId, teamId) {
    const recordId = flagValue(args, "--record-id") || flagValue(args, "--id");
    const priority = flagValue(args, "--priority");
    return {
        type: (flagValue(args, "--type") || (includeId ? undefined : "A"))?.toUpperCase(),
        name: flagValue(args, "--name") || (includeId ? undefined : "@"),
        value: flagValue(args, "--value"),
        ttl: Number(flagValue(args, "--ttl") || "60"),
        priority: priority ? Number(priority) : undefined,
        recordId,
        id: recordId,
        zoneId: flagValue(args, "--zone-id"),
        teamId,
    };
}
function valueArgs(args) {
    const out = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (!arg || arg.startsWith("-")) {
            if (arg && !arg.includes("=") && flagTakesValue(arg))
                index += 1;
            continue;
        }
        out.push(arg);
    }
    return out;
}
function flagTakesValue(flag) {
    return !["--json", "--alias", "--force", "--global", "--follow", "--dashboard"].includes(flag);
}
async function cron(client, args) {
    const command = args.shift() || "list";
    const teamId = flagValue(args, "--team");
    if (command === "list" || command === "ls") {
        const result = await spinner("Fetching cron jobs", () => client.listCronJobs({ teamId }));
        if (wantsJSON(args))
            return printJSON(result);
        return printCronJobs(result);
    }
    if (command === "create") {
        const input = await cronInputFromArgs(client, args, false);
        const body = requireCronCreateInput(input);
        try {
            const result = await spinner("Creating cron job", () => client.createCronJob({ ...body, teamId }));
            if (wantsJSON(args))
                return printJSON(result);
            return printCronJobDetails(result, "Cron job created");
        }
        catch (error) {
            if (isCronPlanLimitError(error)) {
                printCronPlanLimit(error);
                return;
            }
            throw error;
        }
    }
    if (command === "get") {
        const id = firstValueArg(args) || await resolveCronJobId(client, args);
        const result = await spinner("Fetching cron job", () => client.getCronJob(id, teamId));
        if (wantsJSON(args))
            return printJSON(result);
        return printCronJobDetails(result, "Cron job");
    }
    if (command === "update") {
        const id = firstValueArg(args) || await resolveCronJobId(client, args);
        const input = await cronInputFromArgs(client, args, true);
        const result = await spinner("Updating cron job", () => client.updateCronJob(id, { ...input, teamId }));
        if (wantsJSON(args))
            return printJSON(result);
        return printCronJobDetails(result, "Cron job updated");
    }
    if (command === "delete" || command === "rm") {
        const id = firstValueArg(args) || await resolveCronJobId(client, args);
        const result = await spinner("Deleting cron job", () => client.deleteCronJob(id, teamId));
        if (wantsJSON(args))
            return printJSON(result);
        return printResult(result, "Cron job deleted");
    }
    if (command === "start" || command === "stop" || command === "trigger") {
        const id = firstValueArg(args) || await resolveCronJobId(client, args);
        const method = command === "start" ? client.startCronJob.bind(client) : command === "stop" ? client.stopCronJob.bind(client) : client.triggerCronJob.bind(client);
        const result = await spinner(`${labelize(command)} cron job`, () => method(id, teamId));
        if (wantsJSON(args))
            return printJSON(result);
        return printResult(result, `Cron job ${command === "trigger" ? "triggered" : command + "ed"}`);
    }
    if (command === "runs") {
        const id = firstValueArg(args) || await resolveCronJobId(client, args);
        const result = await spinner("Fetching cron runs", () => client.listCronJobRuns(id, { page: Number(flagValue(args, "--page") || 1), limit: Number(flagValue(args, "--limit") || 20), teamId }));
        if (wantsJSON(args))
            return printJSON(result);
        return printCronRuns(result);
    }
    if (command === "validate-schedule") {
        const schedule = firstValueArg(args) || await promptText("Schedule", "*/5 * * * *");
        const result = await spinner("Validating schedule", () => client.validateCronSchedule(schedule));
        if (wantsJSON(args))
            return printJSON(result);
        return printNestedObject("Cron schedule", result);
    }
    if (command === "validate-url") {
        const url = firstValueArg(args) || await promptText("URL");
        const result = await spinner("Validating URL", () => client.validateCronURL(url));
        if (wantsJSON(args))
            return printJSON(result);
        return printNestedObject("Cron URL", result);
    }
    throw new Error(`Unknown cron command: ${command}`);
}
async function cronInputFromArgs(client, args, partial) {
    const name = flagValue(args, "--name") || (partial ? undefined : await promptText("Name"));
    const schedule = flagValue(args, "--schedule") || (partial ? undefined : await promptText("Schedule", "*/5 * * * *"));
    const url = flagValue(args, "--url") || (partial ? undefined : await promptText("URL"));
    const method = (flagValue(args, "--method") || (partial ? undefined : await promptSelect("Method", ["GET", "POST", "PUT", "PATCH", "DELETE"].map((value) => ({ label: value, value })))));
    const timeout = flagValue(args, "--timeout") || flagValue(args, "--timeout-seconds");
    const headersRaw = flagValue(args, "--headers");
    const projectFlag = flagValue(args, "--project");
    const projectId = projectFlag === "none" ? undefined : projectFlag || undefined;
    const input = {};
    if (name)
        input.name = name;
    if (schedule)
        input.schedule = schedule;
    if (url)
        input.url = url;
    if (method)
        input.method = method.toUpperCase();
    if (timeout)
        input.timeoutSeconds = Number(timeout);
    if (headersRaw)
        input.headers = parseHeadersJSON(headersRaw);
    if (projectId)
        input.projectId = projectId === "select" ? await resolveProjectId(client, undefined, args) : projectId;
    return input;
}
function requireCronCreateInput(input) {
    if (!input.name || !input.schedule || !input.url) {
        throw new Error("Cron job name, schedule, and URL are required. Pass --name, --schedule, and --url or run interactively.");
    }
    return input;
}
function isCronPlanLimitError(error) {
    return error instanceof PxxlAPIError && stringValue(asRecord(error.details).code) === "CRON_JOB_LIMIT_REACHED";
}
function parseHeadersJSON(raw) {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("--headers must be a JSON object");
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
}
function firstValueArg(args) {
    return args.find((arg, index) => {
        if (arg.startsWith("-"))
            return false;
        const previous = args[index - 1];
        return !previous || !previous.startsWith("-");
    });
}
async function logs(client, args) {
    const cwd = resolve(flagValue(args, "--dir") || ".");
    const config = await readPxxlToml(cwd);
    const lines = Number(flagValue(args, "--lines") || flagValue(args, "-n") || 100);
    const since = flagValue(args, "--since");
    const projectId = flagValue(args, "--project") || flagValue(args, "--project-id") || config.projectId;
    const deploymentId = flagValue(args, "--deployment") || flagValue(args, "--deployment-id") || (!projectId ? config.deploymentId : undefined);
    const fetchLogs = async () => {
        if (deploymentId)
            return client.deploymentLogs(deploymentId, { build: true, since });
        if (projectId)
            return client.projectLogs(projectId, { lines, live: args.includes("--live") || args.includes("--follow"), since });
        throw new Error("No project or deployment found. Pass --project <id>, --deployment <id>, or run inside a folder with pxxl.toml.");
    };
    if (args.includes("--follow")) {
        while (true) {
            const result = await fetchLogs();
            printLogs(result, since);
            await new Promise((resolveTimer) => setTimeout(resolveTimer, 3000));
        }
    }
    const result = await spinner("Fetching logs", fetchLogs);
    if (wantsJSON(args))
        return printJSON(result);
    printLogs(result, since);
}
async function teams(client, args) {
    const command = args.shift();
    if (command === "list" || !command) {
        if (!client)
            throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
        const result = await spinner("Fetching spaceships", () => client.listTeams());
        if (wantsJSON(args))
            return printJSON(result);
        return printTeams(result);
    }
    if (command === "get" || command === "show") {
        if (!client)
            throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
        const id = required(args.shift(), "team id");
        const result = await spinner("Fetching spaceship", () => client.getTeam(id));
        if (wantsJSON(args))
            return printJSON(result);
        return printTeam(result.team);
    }
    if (command === "use" || command === "switch") {
        const provided = args.shift();
        if (!provided && !client)
            throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
        const id = provided || await resolveTeamId(client, undefined, args);
        await saveTeamSelection(id);
        return printSuccess(`Using spaceship ${id}`);
    }
    if (command === "current") {
        const config = await readAuthConfig();
        if (wantsJSON(args))
            return printJSON({ selectedTeamId: config.selectedTeamId || null });
        return print(config.selectedTeamId ? `${bold("Selected spaceship")} ${config.selectedTeamId}` : dim("No spaceship selected."));
    }
    if (command === "clear") {
        await saveTeamSelection(undefined);
        return printSuccess("Cleared selected spaceship.");
    }
    throw new Error(`Unknown team command: ${command}`);
}
function teamCommandCanRunWithoutAuth(args) {
    const command = args[0];
    return command === "current" || command === "clear" || ((command === "use" || command === "switch") && Boolean(args[1]));
}
async function databases(client, args) {
    const command = args.shift();
    if (command === "list" || !command) {
        const result = await spinner("Fetching databases", () => client.listDatabases(flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printDatabases(result);
    }
    if (command === "get" || command === "show") {
        const id = await resolveDatabaseId(client, args.shift(), args);
        const result = await spinner("Fetching database", () => client.getDatabase(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printDatabaseDetails(result.database);
    }
    if (command === "create") {
        const name = flagValue(args, "--name") || flagValue(args, "-n") || await promptText("Database name");
        const type = flagValue(args, "--type") || flagValue(args, "-t") || await promptSelect("Database type", databaseTypes.map((value) => ({ label: value, value })));
        const result = await client.createDatabase({
            name,
            type,
            description: flagValue(args, "--description"),
            projectId: flagValue(args, "--project"),
            dailyBackupsEnabled: args.includes("--daily-backups"),
            teamId: flagValue(args, "--team"),
        });
        if (wantsJSON(args))
            return printJSON(result);
        return printDatabase(result.database, "Database created");
    }
    if (command === "update") {
        const id = required(args.shift(), "database id");
        const result = await spinner("Updating database", () => client.updateDatabase(id, {
            name: flagValue(args, "--name") || flagValue(args, "-n"),
            description: flagValue(args, "--description"),
            teamId: flagValue(args, "--team"),
        }));
        if (wantsJSON(args))
            return printJSON(result);
        return printDatabase(result.database, "Database updated");
    }
    if (command === "delete" || command === "remove") {
        const id = await resolveDatabaseId(client, args.shift(), args);
        if (!args.includes("--yes") && !await promptConfirm(`Delete database ${id}?`, false))
            return print(dim("Cancelled."));
        const result = await spinner("Deleting database", () => client.deleteDatabase(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printResult(result, `Deleted database ${id}`);
    }
    if (command === "start") {
        const id = await resolveDatabaseId(client, args.shift(), args);
        const result = await spinner("Starting database", () => client.startDatabase(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printResult(result, `Started database ${id}`);
    }
    if (command === "stop") {
        const id = await resolveDatabaseId(client, args.shift(), args);
        const result = await spinner("Stopping database", () => client.stopDatabase(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printResult(result, `Stopped database ${id}`);
    }
    if (command === "restart") {
        const id = await resolveDatabaseId(client, args.shift(), args);
        const result = await spinner("Restarting database", () => client.restartDatabase(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printResult(result, `Restarted database ${id}`);
    }
    if (command === "stats") {
        const id = await resolveDatabaseId(client, args.shift(), args);
        const result = await spinner("Fetching database stats", () => client.databaseStats(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printNestedObject("Database stats", result);
    }
    if (command === "tables") {
        const id = await resolveDatabaseId(client, args.shift(), args);
        const result = await spinner("Fetching database tables", () => client.databaseTables(id, flagValue(args, "--team")));
        if (wantsJSON(args))
            return printJSON(result);
        return printNestedObject("Database tables", result);
    }
    throw new Error(`Unknown database command: ${command || ""}`);
}
async function analyzeLocalProject(cwd) {
    const config = await readPxxlToml(cwd);
    const packageJson = await readPackageJson(cwd);
    const scripts = asRecord(packageJson.scripts);
    const deps = { ...asRecord(packageJson.dependencies), ...asRecord(packageJson.devDependencies) };
    const packageManager = config.packageManager || await detectPackageManager(cwd);
    const framework = config.framework || detectFramework(deps, cwd);
    const runtime = config.language || detectRuntime(framework, deps, cwd);
    const startCommand = config.startCommand || await detectStartCommand(cwd, framework, packageManager, scripts);
    const buildCommand = config.buildCommand || stringValue(scripts.build) || "";
    const installCommand = config.installCommand || defaultInstallCommand(packageManager);
    const envFiles = (await Promise.all([".env", ".env.local", ".env.production", ".env.development"].map(async (file) => await exists(resolve(cwd, file)) ? file : ""))).filter(Boolean);
    let deploySizeBytes = 0;
    let archiveError = "";
    try {
        deploySizeBytes = (await createProjectZip(cwd)).byteLength;
    }
    catch (error) {
        archiveError = error instanceof Error ? error.message : String(error);
    }
    return {
        directory: cwd,
        framework,
        packageManager,
        runtime,
        installCommand,
        buildCommand,
        startCommand,
        envFiles,
        deploySizeBytes,
        archiveError,
        scripts: Object.fromEntries(Object.entries(scripts).map(([key, value]) => [key, stringValue(value)])),
        config,
    };
}
async function readPackageJson(cwd) {
    try {
        return JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8"));
    }
    catch {
        return {};
    }
}
async function detectPackageManager(cwd) {
    if (await exists(resolve(cwd, "bun.lockb")) || await exists(resolve(cwd, "bun.lock")))
        return "bun";
    if (await exists(resolve(cwd, "pnpm-lock.yaml")))
        return "pnpm";
    if (await exists(resolve(cwd, "yarn.lock")))
        return "yarn";
    if (await exists(resolve(cwd, "package-lock.json")))
        return "npm";
    if (await exists(resolve(cwd, "package.json")))
        return "npm";
    return "";
}
function detectFramework(deps, cwd) {
    const names = Object.keys(deps);
    if (names.includes("@tanstack/react-start") || names.includes("@tanstack/start"))
        return "tanstack-start";
    if (names.includes("@tanstack/react-router"))
        return "tanstack-router";
    if (names.includes("next"))
        return "nextjs";
    if (names.includes("astro"))
        return "astro";
    if (names.includes("vite") || names.includes("@vitejs/plugin-react"))
        return "vite";
    if (names.includes("express"))
        return "express";
    if (names.includes("fastify"))
        return "fastify";
    if (names.includes("hono"))
        return "hono";
    if (cwd.endsWith(".php"))
        return "php";
    return "";
}
function detectRuntime(framework, deps, cwd) {
    if (framework === "php" || cwd.endsWith(".php"))
        return "php";
    if (framework || Object.keys(deps).length)
        return "node";
    return "static";
}
async function detectStartCommand(cwd, framework, packageManager, scripts) {
    const serverFiles = ["dist/server.js", "dist/server/index.js", ".output/server/index.mjs", ".output/server/index.js", "server.js"];
    for (const file of serverFiles) {
        if (await exists(resolve(cwd, file)))
            return `node ${file}`;
    }
    if (stringValue(scripts.start))
        return packageManager === "bun" ? "bun start" : `${packageManager || "npm"} run start`;
    if (framework === "nextjs")
        return `${packageManager || "npm"} run start`;
    if (framework === "astro" || framework === "vite")
        return stringValue(scripts.preview) ? `${packageManager || "npm"} run preview` : "";
    return "";
}
function defaultInstallCommand(packageManager) {
    if (packageManager === "bun")
        return "bun install";
    if (packageManager === "pnpm")
        return "pnpm install --frozen-lockfile";
    if (packageManager === "yarn")
        return "yarn install --frozen-lockfile";
    if (packageManager === "npm")
        return "npm ci";
    return "";
}
async function gitState(cwd) {
    try {
        await run("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"], { maxBuffer: 1024 * 1024 });
        const status = (await run("git", ["-C", cwd, "status", "--porcelain"], { maxBuffer: 1024 * 1024 })).stdout.trim();
        return { inside: true, clean: !status, detail: status ? "Working tree has local changes" : "Working tree is clean" };
    }
    catch {
        return { inside: false, clean: false, detail: "Not inside a git repository" };
    }
}
async function exists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
async function openUrl(url) {
    const os = platform();
    if (os === "darwin")
        return run("open", [url]);
    if (os === "win32")
        return run("cmd", ["/c", "start", "", url]);
    return run("xdg-open", [url]);
}
async function checkDNS(domain) {
    const clean = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const [a, aaaa, cname, ns] = await Promise.all([
        resolve4(clean).catch(() => []),
        resolve6(clean).catch(() => []),
        resolveCname(clean).catch(() => []),
        resolveNs(clean).catch(() => []),
    ]);
    let ssl = "unknown";
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`https://${clean}`, { method: "HEAD", signal: controller.signal });
        clearTimeout(timer);
        ssl = response.ok || response.status < 500 ? "reachable" : `http_${response.status}`;
    }
    catch {
        ssl = "not_reachable";
    }
    return { a, aaaa, cname, ns, ssl };
}
async function authedClient() {
    const config = await readAuthConfig();
    if (!config.apiKey)
        throw new Error("Run `pxxl login --api-key <key>` or set PXXL_API_KEY.");
    return new PxxlClient({ apiKey: config.apiKey, teamId: config.selectedTeamId });
}
function flagValue(args, name) {
    const index = args.indexOf(name);
    if (index === -1)
        return undefined;
    return args[index + 1];
}
function hasFlag(args, name) {
    return args.includes(name);
}
function normalizeDomainChoice(value) {
    if (!value)
        return value;
    return value.replace(/^\./, "");
}
function required(value, label) {
    if (!value)
        throw new Error(`Missing ${label}`);
    return value;
}
function parseDotEnv(raw, secret) {
    return raw.split(/\r?\n/).flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            return [];
        const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match)
            return [];
        const key = match[1] || "";
        let value = (match[2] || "").trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))
            value = value.slice(1, -1);
        return [{ key, value, isSecret: secret }];
    });
}
async function promptDestination(defaultName) {
    return promptText("Where should Pxxl pull this project?", defaultName);
}
async function promptText(label, defaultValue = "") {
    if (!isInteractive()) {
        if (defaultValue)
            return defaultValue;
        throw new Error(`${label} is required. Pass it as a CLI argument or run in an interactive terminal.`);
    }
    const rl = createInterface({ input, output });
    try {
        const suffix = defaultValue ? ` (${defaultValue})` : "";
        const answer = await rl.question(`${label}${suffix}: `);
        const value = answer.trim() || defaultValue;
        if (!value)
            throw new Error(`${label} is required.`);
        return value;
    }
    finally {
        rl.close();
    }
}
async function promptConfirm(label, defaultValue) {
    if (!isInteractive())
        return defaultValue;
    const suffix = defaultValue ? "Y/n" : "y/N";
    const answer = (await promptText(`${label} [${suffix}]`, defaultValue ? "yes" : "no")).toLowerCase();
    return ["y", "yes", "true", "1"].includes(answer);
}
async function promptSelect(label, options) {
    if (!options.length)
        throw new Error(`No options available for ${label}.`);
    if (!isInteractive())
        throw new Error(`${label} is required. Pass a value as a CLI argument or run in an interactive terminal.`);
    print(`\n${bold(label)}`);
    options.forEach((option, index) => print(`  ${cyan(String(index + 1).padStart(2, " "))}. ${option.label}`));
    while (true) {
        const answer = await promptText("Select", "1");
        const index = Number(answer) - 1;
        if (Number.isInteger(index) && options[index])
            return options[index].value;
        const match = options.find((option) => option.value === answer || option.label.toLowerCase() === answer.toLowerCase());
        if (match)
            return match.value;
        print(red("Invalid selection. Try again."));
    }
}
async function maybePromptSelect(label, values, defaultValue) {
    if (!isInteractive())
        return defaultValue;
    return promptSelect(label, values.map((value) => ({ label: value, value })));
}
async function resolveInitDirectory(args, projectName, isNew) {
    const explicit = flagValue(args, "--dir");
    if (explicit)
        return resolve(explicit);
    if (!isNew)
        return resolve(".");
    if (!isInteractive())
        return resolve(projectName);
    const mode = await promptSelect("Where should the boilerplate go?", [
        { label: `New folder: ${projectName}`, value: "new" },
        { label: "Current folder", value: "current" },
        { label: "Choose another folder", value: "custom" },
    ]);
    if (mode === "current")
        return resolve(".");
    if (mode === "custom")
        return resolve(await promptText("Folder", projectName));
    return resolve(projectName);
}
async function chooseDomainSuffix() {
    const fallback = ["pxxl.pro", "pxxl.app", "pxxl.dev", "pxxl.codes", "pxxl.bio"];
    if (!isInteractive())
        return fallback[0] || "pxxl.pro";
    const config = await readAuthConfig();
    if (!config.apiKey)
        return promptSelect("Domain suffix", fallback.map((value) => ({ label: value, value })));
    try {
        const client = new PxxlClient({ apiKey: config.apiKey, teamId: config.selectedTeamId });
        const result = await client.deployDomainOptions();
        const options = extractDomainOptions(result);
        if (options.length)
            return promptSelect("Domain suffix", options.map((value) => ({ label: value, value })));
    }
    catch {
        // Fall back to the public defaults if the account-specific option lookup is unavailable.
    }
    return promptSelect("Domain suffix", fallback.map((value) => ({ label: value, value })));
}
function extractDomainOptions(value) {
    const root = asRecord(value);
    const candidates = [
        ...arrayValue(root.options),
        ...arrayValue(root.domainOptions),
        ...arrayValue(root.suffixes),
        ...arrayValue(asRecord(root.data).options),
        ...arrayValue(asRecord(root.data).suffixes),
    ];
    const suffixes = candidates.map((item) => {
        if (typeof item === "string")
            return normalizeDomainChoice(item) || "";
        const row = asRecord(item);
        return normalizeDomainChoice(stringValue(row.value || row.suffix || row.domain || row.tld)) || "";
    }).filter(Boolean);
    return [...new Set(suffixes)];
}
function isInteractive() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
async function listBoilerplateNames() {
    const root = resolve(dirname(new URL(import.meta.url).pathname), "..", "boilerplates");
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}
async function listBoilerplateOptions() {
    const names = await listBoilerplateNames();
    const options = [];
    for (const id of names) {
        const manifest = await readBoilerplateManifest(id);
        options.push({
            id,
            name: manifest?.displayName || manifest?.name || titleFromId(id),
            family: manifest?.family || manifest?.framework || id,
            packageManager: manifest?.packageManager,
            description: manifest?.description,
        });
    }
    return options.sort((a, b) => a.name.localeCompare(b.name) || String(a.packageManager || "").localeCompare(String(b.packageManager || "")));
}
async function chooseBoilerplate() {
    const options = await listBoilerplateOptions();
    const grouped = new Map();
    for (const option of options) {
        const key = option.family || option.name;
        grouped.set(key, [...(grouped.get(key) || []), option]);
    }
    const families = [...grouped.entries()].map(([family, items]) => ({
        label: items[0]?.name || titleFromId(family),
        value: family,
    })).sort((a, b) => a.label.localeCompare(b.label));
    const family = await promptSelect("Choose a boilerplate", families);
    const matches = grouped.get(family) || [];
    if (matches.length === 1)
        return matches[0]?.id || family;
    const withPM = matches.filter((item) => item.packageManager);
    if (withPM.length) {
        const pm = await promptSelect("Choose package manager", withPM.map((item) => ({ label: item.packageManager || item.id, value: item.id })));
        return pm;
    }
    return matches[0]?.id || family;
}
async function resolveBoilerplateName(input) {
    const names = await listBoilerplateNames();
    if (names.includes(input))
        return input;
    const aliases = {
        "express-api-pxxl": "express-npm",
        "express-api": "express-npm",
        "express": "express-npm",
        "vite-react-pxxl": "vite-react-pnpm",
        "vite-react": "vite-react-npm",
        "static": "static-cdn-gallery",
        "html": "static-cdn-gallery",
        "php": "php-basic",
    };
    const withoutSuffix = input.replace(/-pxxl$/, "");
    if (names.includes(withoutSuffix))
        return withoutSuffix;
    if (aliases[input] && names.includes(aliases[input]))
        return aliases[input];
    const matches = (await listBoilerplateOptions()).filter((option) => option.family === input || option.name.toLowerCase() === input.toLowerCase());
    if (matches.length === 1)
        return matches[0]?.id || input;
    if (matches.length > 1 && isInteractive()) {
        return promptSelect("Choose package manager", matches.map((item) => ({ label: item.packageManager || item.id, value: item.id })));
    }
    throw new Error(`Unknown boilerplate: ${input}`);
}
function titleFromId(id) {
    return id.split("-").filter((part) => part !== "pxxl").map((part) => part === "npm" || part === "pnpm" ? part : part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
function slugifyProjectName(value) {
    return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
}
function assertValidProjectName(value) {
    if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(value)) {
        throw new Error("Project name must be 3-63 lowercase letters, numbers, or hyphens, without leading or trailing hyphens.");
    }
}
function assertValidDomainChoice(value) {
    if (!value || !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(value) || value.includes("..")) {
        throw new Error("Domain suffix must be a valid suffix such as pxxl.pro.");
    }
}
async function persistDeploymentResult(cwd, result) {
    const root = asRecord(result);
    const config = await readPxxlToml(cwd);
    config.projectId = stringValue(root.projectId || asRecord(root.project).id) || config.projectId;
    config.deploymentId = stringValue(root.deploymentId || asRecord(root.deployment).id) || config.deploymentId;
    const domainName = stringValue(root.domainName || asRecord(root.deployment).domain || asRecord(root.project).domain);
    if (domainName)
        config.projectUrl = domainName.startsWith("http") ? domainName : `https://${domainName}`;
    if (config.projectId && config.deploymentId)
        config.deploymentUrl = `https://pxxl.app/dashboard/projects/${config.projectId}/deployments/${config.deploymentId}`;
    config.lastDeployedAt = new Date().toISOString();
    await writeDefaultPxxlFiles(cwd, config);
}
async function resolveDatabaseId(client, id, args) {
    if (id)
        return id;
    const result = await spinner("Fetching databases", () => client.listDatabases(flagValue(args, "--team")));
    const databases = arrayValue(asRecord(result).databases || asRecord(result).data).map(asRecord);
    return promptSelect("Choose database", databases.map((db) => ({
        label: `${stringValue(db.name || db.id)} ${dim(`${stringValue(db.type)} ${stringValue(db.status)}`)}`,
        value: stringValue(db.id),
    })).filter((option) => option.value));
}
async function resolveTeamId(client, id, args) {
    if (id)
        return id;
    const result = await spinner("Fetching spaceships", () => client.listTeams());
    const teams = arrayValue(asRecord(result).teams || asRecord(result).data).map(asRecord);
    return promptSelect("Choose spaceship", teams.map((team) => ({
        label: `${stringValue(team.name || team.id)} ${dim(stringValue(team.myRole || team.status))}`,
        value: stringValue(team.id),
    })).filter((option) => option.value));
}
async function resolveDomainName(client, domain, args) {
    if (domain)
        return domain;
    const result = await spinner("Fetching domains", () => client.listDomains(flagValue(args, "--team")));
    const domains = normalizeDomainRows(result);
    return promptSelect("Choose domain", domains.map((row) => ({ label: row.domain || "-", value: row.domain || "" })).filter((option) => option.value));
}
async function resolveDomainId(client, args) {
    const result = await spinner("Fetching domains", () => client.listDomains(flagValue(args, "--team")));
    const domains = normalizeDomainRows(result);
    return promptSelect("Choose domain", domains.map((row) => ({
        label: `${row.domain || row.id} ${dim(row.status || row.type || "")}`,
        value: row.id || "",
    })).filter((option) => option.value && option.value !== "-"));
}
async function resolveCronJobId(client, args) {
    const result = await spinner("Fetching cron jobs", () => client.listCronJobs({ teamId: flagValue(args, "--team") }));
    const jobs = normalizeCronRows(result);
    return promptSelect("Choose cron job", jobs.map((job) => ({
        label: `${job.name || job.id} ${dim(job.status || job.schedule || "")}`,
        value: job.id || "",
    })).filter((option) => option.value));
}
async function resolveProjectIdFromArgsOrConfig(client, id, args) {
    if (id)
        return id;
    const config = await readPxxlToml(resolve(flagValue(args, "--dir") || "."));
    if (config.projectId)
        return config.projectId;
    return resolveProjectId(client, undefined, args);
}
async function resolveProjectId(client, id, args) {
    if (id)
        return id;
    const result = await spinner("Fetching projects", () => client.listProjects({ teamId: flagValue(args, "--team"), page: 1, limit: 10 }));
    const root = asRecord(result);
    const projects = arrayValue(root.projects || asRecord(root.data).projects || root.data).map(asRecord);
    return promptSelect("Choose project", projects.map((project) => ({
        label: `${stringValue(project.name || project.id)} ${dim(stringValue(project.status || project.framework))}`,
        value: stringValue(project.id),
    })).filter((option) => option.value));
}
async function pagedProjects(client, args) {
    let page = Number(flagValue(args, "--page") || 1);
    const limit = Number(flagValue(args, "--limit") || 10);
    while (true) {
        const result = await spinner(`Fetching projects page ${page}`, () => client.listProjects({ teamId: flagValue(args, "--team"), page, limit }));
        if (wantsJSON(args))
            return printJSON(result);
        printProjects(result);
        const info = pageInfo(result);
        if (!isInteractive() || page >= info.totalPages || !(await promptConfirm(`Show next page (${page + 1}/${info.totalPages})?`, false)))
            return;
        page += 1;
    }
}
async function pagedDeployments(client, args) {
    let page = Number(flagValue(args, "--page") || 1);
    const limit = Number(flagValue(args, "--limit") || 10);
    while (true) {
        const result = await spinner(`Fetching deployments page ${page}`, () => client.listDeployments({ projectId: flagValue(args, "--project"), page, limit, teamId: flagValue(args, "--team") }));
        if (wantsJSON(args))
            return printJSON(result);
        printDeployments(result);
        const info = pageInfo(result);
        if (!isInteractive() || page >= info.totalPages || !(await promptConfirm(`Show next page (${page + 1}/${info.totalPages})?`, false)))
            return;
        page += 1;
    }
}
async function resolveDeploymentId(client, id, args) {
    if (id)
        return id;
    const result = await spinner("Fetching recent deployments", () => client.listDeployments({ projectId: flagValue(args, "--project"), limit: 20, teamId: flagValue(args, "--team") }));
    const deployments = normalizeDeploymentRows(result);
    const options = deployments.map((deployment) => ({
        label: `${deployment.project || "-"} ${deployment.status || "-"} ${dim(deployment.created || "-")}`,
        value: deployment.id || "",
    })).filter((option) => Boolean(option.value));
    return promptSelect("Choose deployment", options);
}
async function ensureCloneDestination(destination, force) {
    try {
        const entries = await readdir(destination);
        if (entries.length > 0 && !force) {
            throw new Error(`${destination} is not empty. Choose another folder or pass --force.`);
        }
        if (entries.length > 0 && force) {
            throw new Error(`${destination} is not empty and is not a git repo. Refusing to overwrite files.`);
        }
    }
    catch (error) {
        if (error.code === "ENOENT") {
            await mkdir(destination, { recursive: true });
            return;
        }
        throw error;
    }
    await access(destination);
}
async function isGitRepo(destination) {
    try {
        await access(resolve(destination, ".git"));
        return true;
    }
    catch {
        return false;
    }
}
function assertSafeGitBranch(branch) {
    if (!branch || branch.startsWith("-") || /[\s\x00-\x1f\x7f]/.test(branch) || branch.includes("..") || /[~^:?*[\\]/.test(branch)) {
        throw new Error(`Refusing unsafe git branch name from project metadata: ${branch || "(empty)"}`);
    }
}
function sameGitRemote(a, b) {
    return normalizeGitRemote(a) === normalizeGitRemote(b);
}
function normalizeGitRemote(value) {
    return value.trim().replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();
}
function wantsJSON(args) {
    return args.includes("--json");
}
async function spinner(label, fn) {
    if (!process.stderr.isTTY || process.env.NO_COLOR)
        return fn();
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
    }
    catch (error) {
        clearInterval(timer);
        process.stderr.write(`\r${red("✕")} ${label}\n`);
        throw error;
    }
}
function printIdentity(value, selectedTeamId, selectedTeam) {
    const data = (value && typeof value === "object" ? value : {});
    const user = (data.user && typeof data.user === "object" ? data.user : {});
    print(`${green("Authenticated")} ${dim("via")} ${String(data.authMethod || "api_key")}`);
    if (user.email || user.id)
        print(`  ${bold("User")}        ${String(user.email || user.id)}`);
    if (data.apiKeyScope)
        print(`  ${bold("Scope")}       ${String(data.apiKeyScope)}:${String(data.apiKeyPermission || "read")}`);
    const keyTeam = stringValue(data.teamId);
    if (keyTeam)
        print(`  ${bold("Key team")}    ${keyTeam}`);
    if (selectedTeamId) {
        const label = selectedTeam?.name ? `${selectedTeam.name} ${dim(`(${selectedTeamId})`)}` : selectedTeamId;
        print(`  ${bold("Using team")}  ${label}`);
    }
    else if (!keyTeam) {
        print(`  ${bold("Using team")}  ${dim("Personal account")}`);
    }
}
function printUsageOverview(value, title) {
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
    if (projects.length)
        printTable("Top projects", projects, ["name", "deployments", "builds", "artifacts", "status"]);
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
    if (recent.length)
        printTable("Recent deployments", recent, ["project", "status", "build", "artifact", "created"]);
}
function printCDNSummary(value) {
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
    if (recent.length)
        printTable("Recent assets", recent, ["file", "size", "visibility", "kind", "created", "id"]);
}
function printAsset(value) {
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
    if (url)
        print(`${bold("URL")} ${link(url)}`);
}
function printAssets(value) {
    const root = asRecord(value);
    const assets = arrayValue(root.assets || root.data || value).map(assetRow);
    printHeader("CDN assets");
    if (!assets.length)
        return print(dim("No assets found."));
    printTable("", assets, ["file", "size", "visibility", "kind", "created", "id"]);
}
function printCDNUsage(value) {
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
    if (!rows.length)
        return print(dim("No usage events found."));
    printTable("", rows, ["type", "file", "bytes", "created"]);
}
function printTeams(value) {
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
    if (!rows.length)
        return print(dim("No spaceships found."));
    printTable("", rows, ["name", "role", "status", "projects", "databases", "domains", "id"]);
}
function printTeam(team) {
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
function printDatabases(value) {
    const root = asRecord(value);
    const rows = arrayValue(root.databases || root.data || value).map(databaseRow);
    printHeader("Databases");
    if (!rows.length)
        return print(dim("No databases found."));
    printTable("", rows, ["id", "name", "type", "status"]);
}
function printDatabase(database, title = "Database") {
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
function printDatabaseDetails(database) {
    const db = asRecord(database);
    printHeader("Database");
    printKV([
        ["ID", stringValue(db.id)],
        ["Name", stringValue(db.name || db.actualDatabaseName)],
        ["Type", stringValue(db.type)],
        ["Status", stringValue(db.status)],
        ["Database URL", stringValue(db.databaseUrl || db.externalUrl || db.externalDbUrl || db.external_db_url) || "-"],
        ["Username", stringValue(db.dbUser || db.username) || "-"],
        ["Database", stringValue(db.dbName || db.database || db.actualDatabaseName) || "-"],
        ["Password", stringValue(db.dbPassword || db.password) || "-"],
        ["Root password", stringValue(db.rootPassword) || "-"],
        ["Host", stringValue(db.proxyHost || db.routeKey) || "-"],
        ["Port", db.proxyPort || db.port ? String(db.proxyPort || db.port) : "-"],
        ["Provisioning", stringValue(db.provisioningMode) || "-"],
        ["Storage", `${formatBytes(numberValue(db.storageUsedBytes))} / ${formatBytes(numberValue(db.storageLimitBytes))}`],
        ["Created", shortDate(db.createdAt)],
    ]);
}
function printDomains(value) {
    const rows = normalizeDomainRows(value);
    printHeader("Domains");
    if (!rows.length)
        return print(dim("No domains found."));
    printTable("", rows, ["domain", "status", "type", "id"]);
}
function printCronJobs(value) {
    const rows = normalizeCronRows(value);
    printHeader("Cron jobs");
    if (!rows.length)
        return print(dim("No cron jobs found."));
    printTable("", rows, ["name", "status", "schedule", "method", "next", "id"]);
}
function printCronJobDetails(value, title) {
    const job = asRecord(value);
    printHeader(title);
    printKV([
        ["ID", stringValue(job.id)],
        ["Name", stringValue(job.name)],
        ["Status", cronStatusLabel(stringValue(job.status))],
        ["Schedule", stringValue(job.schedule)],
        ["URL", stringValue(job.url)],
        ["Method", stringValue(job.method)],
        ["Timeout", job.timeoutSeconds ? `${job.timeoutSeconds}s` : "-"],
        ["Project", stringValue(job.projectId) || "-"],
        ["Team", stringValue(job.teamId) || "-"],
        ["Failures", numberValue(job.consecutiveFailures)],
        ["Next run", shortDate(job.nextRunAt)],
        ["Last run", shortDate(job.lastRunAt)],
    ]);
    if (job.disabledReason)
        print(`${red("Disabled")} ${stringValue(job.disabledReason)}`);
}
function printCronRuns(value) {
    const root = asRecord(value);
    const rows = arrayValue(root.runs || root.data || value).map((item) => {
        const run = asRecord(item);
        return {
            status: cronStatusLabel(stringValue(run.status)),
            code: run.statusCode === undefined || run.statusCode === null ? "-" : String(run.statusCode),
            timedOut: run.timedOut ? "yes" : "no",
            started: shortDate(run.startedAt),
            finished: shortDate(run.finishedAt),
            id: stringValue(run.id),
        };
    });
    printHeader("Cron runs");
    if (!rows.length)
        return print(dim("No cron runs found."));
    printTable("", rows, ["status", "code", "timedOut", "started", "finished", "id"]);
    printPageInfo(value);
}
function printCronPlanLimit(error) {
    const details = asRecord(error.details);
    if (stringValue(details.code) !== "CRON_JOB_LIMIT_REACHED")
        return;
    print(`${red("Cron job limit reached")} ${stringValue(details.message)}`);
    printKV([
        ["Limit", details.limit ?? "-"],
        ["Current", details.current ?? "-"],
    ]);
}
function printProjects(value) {
    const root = asRecord(value);
    const projects = arrayValue(root.projects || asRecord(root.data).projects || root.data || value).map(projectRow);
    printHeader("Projects");
    if (!projects.length)
        return print(dim("No projects found."));
    printTable("", projects, ["name", "framework", "status", "domain", "id"]);
    printPageInfo(value);
}
function printProjectDetails(value) {
    const root = asRecord(value);
    const project = asRecord(root.project || root.data || root);
    printHeader("Project");
    printKV([
        ["ID", stringValue(project.id)],
        ["Name", stringValue(project.name)],
        ["Status", stringValue(project.status)],
        ["Framework", stringValue(project.framework)],
        ["Language", stringValue(project.language)],
        ["Domain", stringValue(project.domain || project.domainName)],
        ["Source", stringValue(project.source || project.repositoryProvider)],
        ["Branch", stringValue(project.githubBranch || project.branch)],
        ["Created", shortDate(project.createdAt)],
    ]);
}
function printDeployments(value) {
    const deployments = normalizeDeploymentRows(value);
    printHeader("Deployments");
    if (!deployments.length)
        return print(dim("No deployments found."));
    printTable("", deployments, ["project", "status", "build", "domain", "created", "id"]);
    printPageInfo(value);
}
function printDeploymentDetails(value) {
    const root = asRecord(value);
    const deployment = asRecord(root.deployment || root.data || root);
    printHeader("Deployment");
    printKV([
        ["ID", stringValue(deployment.id)],
        ["Project", stringValue(deployment.projectName || deployment.projectId)],
        ["Build", stringValue(deployment.buildStatus)],
        ["Status", stringValue(deployment.deploymentStatus || deployment.status)],
        ["Domain", stringValue(deployment.domain)],
        ["Branch", stringValue(deployment.branch)],
        ["Commit", stringValue(deployment.commitSha).slice(0, 12) || "-"],
        ["Message", stringValue(deployment.commitMessage) || "-"],
        ["Created", shortDate(deployment.createdAt)],
    ]);
    const projectId = stringValue(deployment.projectId);
    const deploymentId = stringValue(deployment.id);
    if (projectId && deploymentId)
        print(`${bold("View")} ${link(`https://pxxl.app/dashboard/projects/${projectId}/deployments/${deploymentId}`)}`);
}
function printDeployResult(value, fallback) {
    const root = asRecord(value);
    printSuccess(stringValue(root.message) || fallback);
    const projectId = stringValue(root.projectId || asRecord(root.project).id);
    const deploymentId = stringValue(root.deploymentId || asRecord(root.deployment).id);
    const domainName = stringValue(root.domainName || asRecord(root.deployment).domain || asRecord(root.project).domain);
    const rows = [];
    if (projectId)
        rows.push(["Project ID", projectId]);
    if (deploymentId)
        rows.push(["Deployment ID", deploymentId]);
    if (domainName) {
        const liveUrl = domainName.startsWith("http") ? domainName : `https://${domainName}`;
        rows.push(["Live URL", link(liveUrl)]);
    }
    if (projectId && deploymentId)
        rows.push(["Deployment", link(`https://pxxl.app/dashboard/projects/${projectId}/deployments/${deploymentId}`)]);
    if (rows.length)
        printKV(rows);
}
function printDomainStats(value, fallbackDomain) {
    const root = asRecord(value);
    const data = asRecord(root.data || root);
    const analytics = asRecord(data.analytics);
    const observability = asRecord(data.observability);
    const domain = stringValue(root.domain) || fallbackDomain;
    printHeader(`Domain stats: ${domain}`);
    printKV([
        ["Available", data.available === false || root.available === false ? "No" : "Yes"],
        ["Timeframe", stringValue(data.timeframe) || "-"],
        ["Requests", numberValue(analytics.pageViews || observability.edgeRequests)],
        ["Bandwidth", formatBytes(numberValue(analytics.bandwidthBytes || observability.bandwidthBytes))],
        ["Avg latency", `${numberValue(analytics.avgLatencyMs || observability.avgLatencyMs).toFixed(0)}ms`],
        ["Blocked", numberValue(analytics.blockedRequests || observability.blockedRequests)],
        ["Errors", numberValue(analytics.errorRequests || observability.errorRequests)],
    ]);
    const topCountries = arrayValue(analytics.topCountries || data.topCountries).slice(0, 8).map(locationRow);
    if (topCountries.length)
        printTable("Top countries", topCountries, ["name", "requests"]);
    const topCities = arrayValue(analytics.topCities || data.topCities).slice(0, 8).map(locationRow);
    if (topCities.length)
        printTable("Top cities", topCities, ["name", "requests"]);
}
function printEnvList(value) {
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
    if (!vars.length)
        return print(dim("No environment variables found."));
    printTable("", vars, ["key", "secret", "scope"]);
}
function printEnvDiff(value) {
    const root = asRecord(value);
    const counts = asRecord(root.counts);
    const rows = arrayValue(root.diff).map((item) => {
        const row = asRecord(item);
        return {
            key: stringValue(row.key),
            status: envStatusLabel(stringValue(row.status)),
            local: row.local ? "yes" : "no",
            remote: row.remote ? "yes" : "no",
        };
    });
    printHeader(`Environment diff (${stringValue(root.scope) || "app"})`);
    printKV([
        ["Same", numberValue(counts.same)],
        ["Changed", numberValue(counts.changed)],
        ["Missing remote", numberValue(counts.missingRemote)],
        ["Missing local", numberValue(counts.missingLocal)],
    ]);
    if (!rows.length)
        return print(dim("No variables to compare."));
    printTable("", rows, ["key", "status", "local", "remote"]);
    print(dim("Remote values are decrypted and compared on Pxxl servers, but secret values are never printed by the CLI."));
}
function printDomainCheck(value, dns) {
    const root = asRecord(value);
    const checks = asRecord(root.checks);
    const proxy = asRecord(root.proxy);
    const domain = stringValue(root.domain);
    const dnsRow = asRecord(dns);
    printHeader(`Domain check: ${domain}`);
    printKV([
        ["Status", domainStatusLabel(stringValue(root.status))],
        ["Message", stringValue(root.message)],
        ["Used on Pxxl", checks.used ? "yes" : "no"],
        ["Owned by you", checks.owned ? "yes" : "no"],
        ["Proxy route", proxy.routeExists ? `${stringValue(proxy.status) || "exists"}` : "none"],
        ["SSL", proxy.sslEnabled ? "enabled" : stringValue(dnsRow.ssl) || "-"],
        ["A", arrayValue(dnsRow.a).join(", ") || "-"],
        ["AAAA", arrayValue(dnsRow.aaaa).join(", ") || "-"],
        ["CNAME", arrayValue(dnsRow.cname).join(", ") || "-"],
        ["NS", arrayValue(dnsRow.ns).slice(0, 4).join(", ") || "-"],
    ]);
    const instructions = asRecord(root.dnsInstructions);
    const apex = asRecord(instructions.apex);
    if (apex.value) {
        printHeader("Expected DNS");
        printKV([
            ["A @", stringValue(apex.value)],
            ["CNAME www", domain || "your apex domain"],
        ]);
    }
}
function printDomainConnectResult(value, projectId) {
    const root = asRecord(value);
    const accepted = arrayValue(root.accepted);
    const rejected = arrayValue(root.rejected);
    printHeader("Domain connect");
    if (accepted.length) {
        printSuccess(`${accepted.length} domain${accepted.length === 1 ? "" : "s"} connected`);
        const rows = accepted.map((item) => {
            const row = asRecord(item);
            const domain = asRecord(row.domain);
            return {
                domain: stringValue(domain.name || row.domain || row.name) || "-",
                status: stringValue(row.status || domain.status) || "-",
                mode: stringValue(row.managementMode) || "-",
                id: stringValue(row.domainId || domain.id) || "-",
            };
        });
        printTable("", rows, ["domain", "status", "mode", "id"]);
        const first = asRecord(accepted[0]);
        const expectedIP = stringValue(first.expectedARecordIp);
        if (expectedIP) {
            printHeader("Expected DNS");
            printKV([
                ["A @", expectedIP],
                ["CNAME www", stringValue(asRecord(first.domain).name || first.domain) || "your-domain.com"],
            ]);
        }
    }
    if (rejected.length) {
        print(`\n${red(`${rejected.length} rejected`)}`);
        const rows = rejected.map((item) => {
            const row = asRecord(item);
            const details = asRecord(row.details);
            return {
                domain: stringValue(row.domain) || "-",
                status: String(numberValue(row.status)),
                message: stringValue(row.message || details.message) || "-",
                limit: details.limit !== undefined ? String(details.limit) : "-",
                used: details.used !== undefined ? String(details.used) : "-",
            };
        });
        printTable("", rows, ["domain", "status", "message", "limit", "used"]);
    }
    if (projectId)
        print(`${bold("Dashboard")} ${link(`https://pxxl.app/dashboard/projects/${projectId}/domains`)}`);
}
function printDNSRecords(value) {
    const root = asRecord(value);
    const records = arrayValue(root.records || asRecord(root.data).records || root.data || value).map((item) => {
        const row = asRecord(item);
        return {
            type: stringValue(row.type) || "-",
            name: stringValue(row.name || row.host) || "-",
            value: stringValue(row.value || row.target || row.content) || "-",
            ttl: row.ttl !== undefined ? String(row.ttl) : "-",
            id: stringValue(row.id || row.recordId) || "-",
        };
    });
    printHeader("DNS records");
    if (!records.length)
        return print(dim("No DNS records found."));
    printTable("", records, ["type", "name", "value", "ttl", "id"]);
    const expected = stringValue(root.expectedARecordIp);
    if (expected)
        print(`\n${dim(`Expected A @ -> ${expected}`)}`);
}
function printLogs(value, since) {
    const root = asRecord(value);
    printHeader(`Logs${since ? ` since ${since}` : ""}`);
    let logs = normalizeLogRows(root.logs || root.buildLogs || root.data || value);
    const cutoff = since ? sinceCutoff(since) : undefined;
    if (cutoff) {
        logs = logs.filter((row) => {
            if (!row.timestamp)
                return true;
            const date = new Date(row.timestamp);
            return Number.isNaN(date.getTime()) || date >= cutoff;
        });
    }
    if (!logs.length)
        return print(dim("No logs found."));
    for (const row of logs.slice(-300)) {
        const type = row.type === "error" ? red(row.type) : row.type === "warning" ? cyan(row.type) : dim(row.type || "info");
        const ts = row.timestamp ? `${dim(row.timestamp)} ` : "";
        print(`${ts}${type} ${row.content}`);
    }
}
function sinceCutoff(value) {
    const match = value.trim().match(/^(\d+)(m|h|d)$/i);
    if (!match)
        return undefined;
    const amount = Number(match[1]);
    const unit = match[2]?.toLowerCase();
    const ms = unit === "m" ? amount * 60_000 : unit === "h" ? amount * 3_600_000 : amount * 86_400_000;
    return new Date(Date.now() - ms);
}
function normalizeLogRows(value) {
    if (typeof value === "string") {
        return value.split(/\r?\n/).filter(Boolean).map((line) => ({ timestamp: "", type: "info", content: line }));
    }
    return arrayValue(value).flatMap((item) => {
        if (typeof item === "string")
            return [{ timestamp: "", type: "info", content: item }];
        const row = asRecord(item);
        const content = stringValue(row.content || row.message || row.line || row.log);
        if (!content)
            return [];
        return [{
                timestamp: stringValue(row.timestamp || row.time || row.createdAt),
                type: stringValue(row.type || row.level) || "info",
                content,
            }];
    });
}
function envStatusLabel(value) {
    if (value === "same")
        return green("same");
    if (value === "changed")
        return cyan("changed");
    if (value === "missing_remote")
        return red("missing_remote");
    if (value === "missing_local")
        return cyan("missing_local");
    return value || "-";
}
function domainStatusLabel(value) {
    if (value === "available")
        return green("available");
    if (value === "owned")
        return cyan("owned");
    if (value === "taken" || value === "blocked")
        return red(value);
    return value || "-";
}
function printResult(value, fallback) {
    const root = asRecord(value);
    printSuccess(stringValue(root.message) || fallback);
    const id = stringValue(root.id || root.projectId || asRecord(root.project).id || asRecord(root.deployment).id);
    const status = stringValue(root.status || root.deploymentStatus || root.buildStatus || asRecord(root.project).status || asRecord(root.deployment).status);
    const url = stringValue(root.url || root.domain || root.publicUrl || asRecord(root.project).url || asRecord(root.deployment).url);
    const rows = [];
    if (id)
        rows.push(["ID", id]);
    if (status)
        rows.push(["Status", status]);
    if (url)
        rows.push(["URL", url]);
    if (rows.length)
        printKV(rows);
}
function pageInfo(value) {
    const root = asRecord(value);
    const data = asRecord(root.data);
    return {
        page: numberValue(root.page || data.page) || 1,
        limit: numberValue(root.limit || data.limit) || 10,
        total: numberValue(root.total || data.total),
        totalPages: numberValue(root.totalPages || data.totalPages) || 1,
    };
}
function printPageInfo(value) {
    const info = pageInfo(value);
    if (info.total || info.totalPages > 1) {
        print(dim(`Page ${info.page}/${info.totalPages} · ${info.total} total · ${info.limit} per page`));
    }
}
function projectRow(value) {
    const project = asRecord(value);
    return {
        name: stringValue(project.name || project.id),
        framework: stringValue(project.framework || project.language) || "-",
        status: stringValue(project.status) || "-",
        domain: stringValue(project.domain || project.domainName || project.url) || "-",
        id: stringValue(project.id),
    };
}
function normalizeDeploymentRows(value) {
    const root = asRecord(value);
    return arrayValue(root.deployments || asRecord(root.data).deployments || root.data || value).map((item) => {
        const deployment = asRecord(item);
        return {
            project: stringValue(deployment.projectName || deployment.projectId) || "-",
            status: stringValue(deployment.deploymentStatus || deployment.status) || "-",
            build: stringValue(deployment.buildStatus) || "-",
            domain: stringValue(deployment.domain) || "-",
            created: shortDate(deployment.createdAt),
            id: stringValue(deployment.id),
        };
    }).filter((row) => row.id);
}
function printNestedObject(title, value) {
    printHeader(title);
    const root = asRecord(value);
    const entries = Object.entries(root).filter(([, item]) => item !== undefined && item !== null);
    if (!entries.length)
        return print(dim("No data returned."));
    for (const [key, item] of entries) {
        if (Array.isArray(item)) {
            print(`${bold(labelize(key))} ${dim(`${item.length} item${item.length === 1 ? "" : "s"}`)}`);
            const rows = item.slice(0, 10).map((row) => flattenRecord(asRecord(row)));
            if (rows.length)
                printTable("", rows, Object.keys(rows[0] || {}).slice(0, 6));
        }
        else if (typeof item === "object") {
            print(`${bold(labelize(key))}`);
            printKV(Object.entries(asRecord(item)).slice(0, 12).map(([k, v]) => [labelize(k), primitive(v)]));
        }
        else {
            printKV([[labelize(key), primitive(item)]]);
        }
    }
}
function assetRow(value) {
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
function databaseRow(value) {
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
function normalizeDomainRows(value) {
    const root = asRecord(value);
    return arrayValue(root.domains || root.data || value).map((item) => {
        if (typeof item === "string") {
            return { domain: item, status: "-", type: "-", id: "-" };
        }
        const domain = asRecord(item);
        return {
            domain: stringValue(domain.domain || domain.name || domain.hostname || domain.id),
            status: stringValue(domain.status) || "-",
            type: stringValue(domain.type) || "-",
            id: stringValue(domain.id) || "-",
        };
    }).filter((row) => row.domain);
}
function normalizeCronRows(value) {
    const root = asRecord(value);
    return arrayValue(root.cronJobs || root.data || value).map((item) => {
        const job = asRecord(item);
        return {
            name: stringValue(job.name || job.id),
            status: stringValue(job.status) || "-",
            schedule: stringValue(job.schedule) || "-",
            method: stringValue(job.method) || "-",
            next: shortDate(job.nextRunAt),
            id: stringValue(job.id),
        };
    }).filter((row) => row.id);
}
function cronStatusLabel(value) {
    if (value === "active" || value === "success")
        return green(value);
    if (value === "paused" || value === "running")
        return cyan(value);
    if (value === "disabled" || value === "failed")
        return red(value);
    return value || "-";
}
function locationRow(value) {
    const row = asRecord(value);
    return {
        name: stringValue(row.name || row.country || row.city || row.region || row.code) || "-",
        requests: String(numberValue(row.requests || row.count || row.value)),
    };
}
function printHeader(value) {
    print(`\n${bold(value)}`);
}
function printKV(rows) {
    const width = rows.reduce((max, [key]) => Math.max(max, key.length), 0);
    for (const [key, value] of rows) {
        print(`  ${dim(key.padEnd(width))}  ${String(value)}`);
    }
}
function printTable(title, rows, columns) {
    if (title)
        print(`\n${bold(title)}`);
    if (!rows.length)
        return;
    const widths = columns.map((column) => Math.max(column.length, ...rows.map((row) => (row[column] || "").length)));
    print(`  ${columns.map((column, index) => dim(column.padEnd(widths[index] || column.length))).join("  ")}`);
    for (const row of rows) {
        print(`  ${columns.map((column, index) => (row[column] || "").padEnd(widths[index] || column.length)).join("  ")}`);
    }
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function arrayValue(value) {
    return Array.isArray(value) ? value : [];
}
function flattenRecord(value) {
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 8))
        out[labelize(key)] = primitive(item);
    return out;
}
function primitive(value) {
    if (value === undefined || value === null || value === "")
        return "-";
    if (typeof value === "number")
        return Number.isFinite(value) ? new Intl.NumberFormat("en").format(value) : "-";
    if (typeof value === "boolean")
        return value ? "yes" : "no";
    if (typeof value === "object")
        return JSON.stringify(value);
    return String(value);
}
function numberValue(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
function stringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}
function formatBytes(value) {
    if (!value)
        return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}
function formatDuration(seconds) {
    if (!seconds)
        return "0s";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours)
        return `${hours}h ${minutes}m`;
    if (minutes)
        return `${minutes}m ${secs}s`;
    return `${secs}s`;
}
function shortDate(value) {
    const raw = stringValue(value);
    if (!raw)
        return "-";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime()))
        return raw;
    return date.toISOString().slice(0, 10);
}
function labelize(value) {
    return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function printJSON(value) {
    print(JSON.stringify(value, null, 2));
}
function printSuccess(value) {
    print(`${green("✓")} ${value}`);
}
function print(value) {
    process.stdout.write(`${value}\n`);
}
function color(code, value) {
    if (process.env.NO_COLOR || !process.stdout.isTTY)
        return value;
    return `\u001b[${code}m${value}\u001b[0m`;
}
function bold(value) {
    return color(1, value);
}
function dim(value) {
    return color(2, value);
}
function green(value) {
    return color(32, value);
}
function red(value) {
    return color(31, value);
}
function magenta(value) {
    return color(35, value);
}
function cyan(value) {
    return color(36, value);
}
function link(url, label = url) {
    if (process.env.NO_COLOR || !process.stdout.isTTY)
        return cyan(label);
    return `\u001b]8;;${url}\u0007${cyan(label)}\u001b]8;;\u0007`;
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
