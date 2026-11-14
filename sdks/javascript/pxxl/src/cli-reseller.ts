import { Pxxl, readAuthConfig, readResellerKey, saveResellerKey } from "./index.js";
import type { ResellerDomain, ResellerQuote, ResellerRegisterInput } from "./reseller.js";

// `pxxl domains reseller ...` (also `pxxl reseller ...`): domain reselling with
// a reseller key, charged to the wallet.

const tty = () => !process.env.NO_COLOR && process.stdout.isTTY;
const paint = (code: number) => (value: string) => (tty() ? `\u001b[${code}m${value}\u001b[0m` : value);
const bold = paint(1);
const dim = paint(2);
const green = paint(32);
const yellow = paint(33);
const cyan = paint(36);
const print = (value = "") => process.stdout.write(`${value}\n`);
const json = (value: unknown) => print(JSON.stringify(value, null, 2));

export const resellerHelp = `${bold("pxxl domains reseller")} – sell domains to your users, charged to your Pxxl wallet (Pro and up)

  ${cyan("pxxl domains reseller login")} <pxxl_rsl_...>   Save a reseller key (or set PXXL_RESELLER_KEY)
  ${cyan("pxxl domains reseller account")}                Plan, wallet balance, markup and wholesale terms
  ${cyan("pxxl domains reseller prices")} [.cv .com]      Wholesale and customer prices
  ${cyan("pxxl domains reseller quote")} <domain> [--years 1]
  ${cyan("pxxl domains reseller buy")} <domain> [--years 1] [--ns ns1,ns2] [--contact-id 12]
        [--first-name A --last-name B --email e --phone +234... --street s --city c --state st --postal-code p --country NG]
        [--customer-ref id --customer-email e --customer-name n] [--max-charge 4.00] [--yes]
  ${cyan("pxxl domains reseller renew")} <domain> [--years 1] [--yes]
  ${cyan("pxxl domains reseller transfer")} <domain> --auth-code <epp> [--years 1] [--yes]
  ${cyan("pxxl domains reseller list")} [--customer-ref id] [--status active] [--search q]
  ${cyan("pxxl domains reseller status")} <domain>
  ${cyan("pxxl domains reseller customer")} <domain> --customer-ref id [--customer-email e] [--customer-name n]
  ${cyan("pxxl domains reseller dns")} <domain>                                  List records
  ${cyan("pxxl domains reseller dns set")} <domain> --type A --name @ --value 1.2.3.4 [--ttl 300]
  ${cyan("pxxl domains reseller dns replace")} <domain> --type TXT --name @ --value "v=spf1 ..."
  ${cyan("pxxl domains reseller dns delete")} <domain> --id <record-id> [--zone-id <zone>]
  ${cyan("pxxl domains reseller nameservers")} <domain>                          Verify
  ${cyan("pxxl domains reseller nameservers set")} <domain> ns1.example.com ns2.example.com
  ${cyan("pxxl domains reseller nameservers reset")} <domain>                    Back to Pxxl DNS
  ${cyan("pxxl domains reseller lock|unlock")} <domain>
  ${cyan("pxxl domains reseller transfer-code")} <domain>
  ${cyan("pxxl domains reseller settings")} [--markup-percent 20] [--markup-ngn 1000] [--markup-usd 1]
        [--round true] [--default-ns ns1,ns2] [--default-years 1] [--auto-renew true] [--brand "Acme"] [--support-email e]
  ${cyan("pxxl domains reseller charges")}                Wallet charges for reseller purchases

Add --json to any command for machine-readable output. Purchases ask before charging unless you pass --yes.
.cv costs ₦6,000 a year; other domains cost their regular price. Each adds a 2% reseller fee, at most $10 per domain.`;

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  args.splice(index, value === undefined || value.startsWith("--") ? 1 : 2);
  return value === undefined || value.startsWith("--") ? "" : value;
}
const has = (args: string[], name: string) => {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
};
const bool = (value?: string) => (value === undefined ? undefined : !["false", "0", "no", "off"].includes(value.toLowerCase()));
const num = (value?: string) => (value === undefined || value === "" ? undefined : Number(value));
const required = (value: string | undefined, what: string) => {
  if (!value) throw new Error(`Missing ${what}. Run \`pxxl domains reseller --help\`.`);
  return value;
};
const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;
const ngn = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;

async function resellerClient(args: string[]) {
  const key = flag(args, "--key") || (await readResellerKey()) || (await readAuthConfig()).apiKey;
  if (!key) throw new Error("Run `pxxl domains reseller login <pxxl_rsl_...>` or set PXXL_RESELLER_KEY. Make a reseller key in Tools > Domain reseller.");
  return new Pxxl({ apiKey: key, resellerKey: key });
}

async function confirm(question: string, args: string[]) {
  if (has(args, "--yes") || has(args, "-y")) return true;
  if (!process.stdin.isTTY) throw new Error("This charges your wallet. Pass --yes to confirm.");
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
}

function printQuote(quote: ResellerQuote) {
  print(`${bold(quote.domain)}  ${quote.available ? green("available") : yellow(quote.reason || "not available")}${quote.premium ? yellow(" premium") : ""}`);
  print(`  ${quote.action} for ${quote.years} year(s)`);
  print(`  You pay        ${usd(quote.chargeMinor)}${quote.fixedPrice ? dim(` (${ngn(quote.wholesaleNgn)} at ${ngn(quote.nairaPerUsd)}/$)`) : ""}`);
  print(`  Customer price ${ngn(quote.customerPriceNgn)} / $${quote.customerPriceUsd.toFixed(2)}`);
  print(`  Renewal        ${quote.fixedPrice ? ngn(quote.renewalPerYearNgn) : `$${quote.renewalPerYearUsd.toFixed(2)}`} a year`);
}

function printDomain(domain: ResellerDomain) {
  const customer = domain.customer.reference || domain.customer.email || domain.customer.name || "-";
  print(`${bold(domain.domain)}  ${domain.status === "active" ? green(domain.status) : yellow(domain.status)}`);
  print(`  Customer   ${customer}`);
  print(`  Paid       ${usd(domain.wholesaleMinor)} for ${domain.years} year(s)`);
  if (domain.registrar) print(`  Registrar  ${domain.registrar.status}${domain.registrar.expiresAt ? `, expires ${domain.registrar.expiresAt.slice(0, 10)}` : ""}${domain.registrar.lockStatus ? `, ${domain.registrar.lockStatus}` : ""}`);
  if (domain.pxxlNameservers?.length) print(`  Pxxl NS    ${domain.pxxlNameservers.join(", ")}`);
}

function customerFlags(args: string[]) {
  const customer = { reference: flag(args, "--customer-ref"), email: flag(args, "--customer-email"), name: flag(args, "--customer-name") };
  return customer.reference || customer.email || customer.name ? customer : undefined;
}

export async function resellerCommand(rawArgs: string[]) {
  const args = [...rawArgs];
  const asJSON = has(args, "--json");
  const command = args.shift() || "account";
  if (command === "help") return print(resellerHelp);
  if (command === "login") {
    const key = required(args[0] || process.env.PXXL_RESELLER_KEY, "reseller key");
    if (!key.startsWith("pxxl_rsl_")) throw new Error("That isn't a reseller key. Reseller keys start with pxxl_rsl_ and are made in Tools > Domain reseller.");
    await saveResellerKey(key);
    return print("Reseller key saved.");
  }
  if (command === "logout") {
    await saveResellerKey("");
    return print("Reseller key removed.");
  }
  const pxxl = await resellerClient(args);
  const r = pxxl.reseller;
  const out = (value: unknown, human: () => void) => (asJSON ? json(value) : human());

  switch (command) {
    case "account": {
      const account = await r.account();
      return out(account, () => {
        print(`${bold("Domain reseller")}  ${account.plan.allowed ? green(account.plan.planName) : yellow(`${account.plan.planName || "Free"}: needs ${account.plan.requiredPlan}`)}`);
        print(`  Wallet     ${usd(account.wallet.balanceMinor)}`);
        print(`  Markup     ${account.account.markupPercent}% + ${ngn(account.account.markupFixedNgn)} / $${account.account.markupFixedUsd} per year`);
        print(`  .cv        ${ngn(account.terms.cvWholesaleNgn)} a year (${ngn(account.terms.nairaPerUsd)} = $1 today)`);
        print(`  Auto-renew ${account.account.autoRenew ? "on" : "off"}`);
      });
    }
    case "prices": {
      const prices = await r.prices(args.filter((a) => !a.startsWith("--")));
      return out(prices, () => {
        for (const p of prices as Array<Record<string, number | string | boolean>>) {
          const fixed = Boolean(p.fixedPrice);
          print(`${String(p.tld).padEnd(10)} you ${fixed ? ngn(Number(p.registerWholesaleNgn)) : `$${Number(p.registerWholesaleUsd).toFixed(2)}`}  renew ${fixed ? ngn(Number(p.renewWholesaleNgn)) : `$${Number(p.renewWholesaleUsd).toFixed(2)}`}  customer ${fixed ? ngn(Number(p.registerCustomerNgn)) : `$${Number(p.registerCustomerUsd).toFixed(2)}`}`);
        }
      });
    }
    case "quote":
    case "check":
    case "availability": {
      const years = num(flag(args, "--years"));
      const quote = await r.quote(required(args[0], "domain"), years);
      return out(quote, () => printQuote(quote));
    }
    case "buy":
    case "register": {
      const domain = required(args.shift(), "domain");
      const years = num(flag(args, "--years"));
      const maxCharge = num(flag(args, "--max-charge"));
      const ns = flag(args, "--ns");
      const contactId = num(flag(args, "--contact-id"));
      const contact = { firstName: flag(args, "--first-name"), lastName: flag(args, "--last-name"), email: flag(args, "--email"), phone: flag(args, "--phone"), organization: flag(args, "--organization") };
      const address = { street: flag(args, "--street"), city: flag(args, "--city"), state: flag(args, "--state"), postalCode: flag(args, "--postal-code"), country: flag(args, "--country") };
      const input: ResellerRegisterInput = {
        domain,
        years,
        nameservers: ns ? ns.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        contactId,
        customer: customerFlags(args),
        maxChargeMinor: maxCharge ? Math.round(maxCharge * 100) : undefined,
        idempotencyKey: flag(args, "--idempotency-key"),
      };
      if (contact.email) input.contact = contact as ResellerRegisterInput["contact"];
      if (address.street) input.address = address as ResellerRegisterInput["address"];
      const quote = await r.quote(domain, years);
      if (!quote.available) {
        if (asJSON) return json(quote);
        printQuote(quote);
        throw new Error(`${domain} is not available.`);
      }
      if (!asJSON) printQuote(quote);
      if (!(await confirm(`Buy ${domain} and charge ${usd(quote.chargeMinor)} to your wallet?`, args))) return print("Cancelled. Nothing was charged.");
      input.maxChargeMinor ??= quote.chargeMinor;
      const result = await r.register(input);
      return out(result, () => {
        print(green(result.message));
        print(`Wallet balance ${usd(result.balanceMinor)}`);
        printDomain(result.domain);
      });
    }
    case "renew": {
      const domain = required(args.shift(), "domain");
      const years = num(flag(args, "--years")) ?? 1;
      if (!(await confirm(`Renew ${domain} for ${years} year(s) and charge your wallet?`, args))) return print("Cancelled. Nothing was charged.");
      const result = await r.renew(domain, { years, idempotencyKey: flag(args, "--idempotency-key") });
      return out(result, () => { print(green(result.message)); print(`Wallet balance ${usd(result.balanceMinor)}`); });
    }
    case "transfer": {
      const domain = required(args.shift(), "domain");
      const authCode = required(flag(args, "--auth-code"), "--auth-code");
      const years = num(flag(args, "--years"));
      const ns = flag(args, "--ns");
      if (!(await confirm(`Transfer ${domain} in and charge your wallet?`, args))) return print("Cancelled. Nothing was charged.");
      const result = await r.transferIn({ domain, authCode, years, nameservers: ns ? ns.split(",") : undefined, customer: customerFlags(args) });
      return out(result, () => { print(green(result.message)); printDomain(result.domain); });
    }
    case "list":
    case "ls": {
      const result = await r.list({ customerRef: flag(args, "--customer-ref"), status: flag(args, "--status"), search: flag(args, "--search"), limit: num(flag(args, "--limit")) });
      return out(result, () => {
        if (!result.domains.length) return print("No resold domains yet.");
        for (const d of result.domains) print(`${d.domain.padEnd(32)} ${d.status.padEnd(13)} ${usd(d.wholesaleMinor).padEnd(9)} ${d.customer.reference || d.customer.email || "-"}`);
        print(dim(`${result.total} domain(s)`));
      });
    }
    case "status":
    case "get": {
      const domain = await r.get(required(args[0], "domain"));
      return out(domain, () => printDomain(domain));
    }
    case "customer": {
      const domain = await r.updateCustomer(required(args.shift(), "domain"), customerFlags(args) ?? {});
      return out(domain, () => printDomain(domain));
    }
    case "dns":
    case "records": {
      const sub = ["set", "add", "replace", "delete", "rm", "logs"].includes(args[0] ?? "") ? args.shift()! : "list";
      const domain = required(args.shift(), "domain");
      if (sub === "list") return json(await r.dnsRecords(domain));
      if (sub === "logs") return json(await r.dnsChangeLogs(domain));
      if (sub === "delete" || sub === "rm") {
        const result = await r.deleteDNSRecord(domain, { id: flag(args, "--id"), zoneId: flag(args, "--zone-id"), type: flag(args, "--type"), name: flag(args, "--name"), value: flag(args, "--value") });
        return asJSON ? json(result) : print(green("Record deleted."));
      }
      const record = { type: required(flag(args, "--type"), "--type").toUpperCase(), name: flag(args, "--name") || "@", value: required(flag(args, "--value"), "--value"), ttl: num(flag(args, "--ttl")), priority: num(flag(args, "--priority")) };
      const result = sub === "replace" ? await r.replaceDNSRecords(domain, record) : await r.setDNSRecord(domain, record);
      return asJSON ? json(result) : print(green(`${record.type} ${record.name} saved.`));
    }
    case "nameservers":
    case "ns": {
      const sub = ["set", "reset", "verify"].includes(args[0] ?? "") ? args.shift()! : "verify";
      const domain = required(args.shift(), "domain");
      if (sub === "set") {
        const nameservers = args.filter((a) => !a.startsWith("--")).flatMap((a) => a.split(",")).map((a) => a.trim()).filter(Boolean);
        if (nameservers.length < 2) throw new Error("Give at least two nameservers.");
        const result = await r.setNameservers(domain, nameservers);
        return asJSON ? json(result) : print(green(`Nameservers set to ${nameservers.join(", ")}.`));
      }
      if (sub === "reset") {
        const result = await r.resetNameservers(domain);
        return asJSON ? json(result) : print(green("Back on Pxxl nameservers."));
      }
      return json(await r.verifyNameservers(domain));
    }
    case "lock":
    case "unlock": {
      const result = await r.setRegistrarLock(required(args[0], "domain"), command === "lock");
      return asJSON ? json(result) : print(green(command === "lock" ? "Locked." : "Unlocked."));
    }
    case "transfer-code": {
      const result = await r.transferCode(required(args[0], "domain"));
      return asJSON ? json(result) : print(result.authCode);
    }
    case "settings": {
      const ns = flag(args, "--default-ns");
      const input = {
        markupPercent: num(flag(args, "--markup-percent")),
        markupFixedNgn: num(flag(args, "--markup-ngn")),
        markupFixedUsd: num(flag(args, "--markup-usd")),
        roundCustomerPrices: bool(flag(args, "--round")),
        defaultNameservers: ns === undefined ? undefined : ns.split(",").map((s) => s.trim()).filter(Boolean),
        defaultYears: num(flag(args, "--default-years")),
        autoRenew: bool(flag(args, "--auto-renew")),
        brandName: flag(args, "--brand"),
        supportEmail: flag(args, "--support-email"),
      };
      const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
      if (!Object.keys(clean).length) return json((await r.account()).account);
      return json(await r.updateSettings(clean));
    }
    case "charges":
      return json(await r.charges(num(flag(args, "--limit"))));
    default:
      throw new Error(`Unknown reseller command "${command}". Run \`pxxl domains reseller --help\`.`);
  }
}
