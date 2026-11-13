import type { PxxlClient } from "./index.js";

/**
 * Domain reselling (Pro plan and up). Buy, renew, transfer and manage domains
 * for your own users; every purchase is charged to your Pxxl wallet at the
 * wholesale price. Authenticate with a reseller key (pxxl_rsl_...) from
 * Tools > Domain reseller: `new Pxxl({ resellerKey })` or PXXL_RESELLER_KEY.
 */

export type ResellerCustomer = { reference?: string; email?: string; name?: string };
export type ResellerContact = { firstName: string; lastName: string; email: string; phone: string; organization?: string };
export type ResellerAddress = { street: string; city: string; state: string; postalCode: string; country: string };

export type ResellerQuote = {
  domain: string;
  tld: string;
  available: boolean;
  premium: boolean;
  reason?: string;
  action: "register" | "renew" | "transfer";
  years: number;
  /** Wholesale for the whole term. */
  wholesaleNgn: number;
  wholesaleUsd: number;
  /** What your wallet is charged, in US cents. */
  chargeMinor: number;
  /** Wholesale plus your markup: what you'd charge your customer. */
  customerPriceNgn: number;
  customerPriceUsd: number;
  renewalPerYearNgn: number;
  renewalPerYearUsd: number;
  fixedPrice: boolean;
  nairaPerUsd: number;
  minYears?: number;
  maxYears?: number;
};

export type ResellerDomain = {
  id: string;
  domain: string;
  domainId?: string;
  tld: string;
  kind: "registration" | "transfer";
  status: "pending" | "registering" | "transferring" | "active" | "failed" | string;
  customer: { reference: string; email: string; name: string };
  years: number;
  invoiceId: string;
  wholesaleMinor: number;
  wholesaleNgn: number;
  customerPriceUsd: number;
  customerPriceNgn: number;
  lastRenewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  registrar?: { status: string; active: boolean; expiresAt?: string | null; provider?: string; lockStatus?: string };
  pxxlNameservers?: string[];
};

export type ResellerSettings = {
  brandName: string;
  supportEmail: string;
  markupPercent: number;
  markupFixedUsd: number;
  markupFixedNgn: number;
  roundCustomerPrices: boolean;
  defaultNameservers: string[];
  defaultContactId: number | null;
  defaultYears: number;
  autoRenew: boolean;
};

export type ResellerAccount = {
  account: ResellerSettings;
  plan: { allowed: boolean; planName: string; requiredPlan: string };
  wallet: { balanceMinor: number; currency: "USD"; status: string };
  terms: Record<string, unknown> & { cvWholesaleNgn: number; nairaPerUsd: number };
};

export type ResellerPurchase = {
  message: string;
  domain: ResellerDomain;
  quote: ResellerQuote;
  invoiceId: string;
  chargedMinor: number;
  balanceMinor: number;
};

export type ResellerRegisterInput = {
  domain: string;
  years?: number;
  /** Nameservers to register with; your default ones, then Pxxl's, when left out. */
  nameservers?: string[];
  /** A saved contact's id, instead of contact and address. */
  contactId?: number;
  contact?: ResellerContact;
  address?: ResellerAddress;
  customer?: ResellerCustomer;
  /** Refuse (nothing charged) if the wallet charge would be more than this, in US cents. */
  maxChargeMinor?: number;
  /** Retries with the same key never buy twice. */
  idempotencyKey?: string;
};

export type ResellerTransferInput = {
  domain: string;
  authCode: string;
  years?: number;
  nameservers?: string[];
  customer?: ResellerCustomer;
  maxChargeMinor?: number;
  idempotencyKey?: string;
};

export type ResellerDNSRecord = { type: string; name: string; value: string; ttl?: number; priority?: number; proxied?: boolean };

const enc = encodeURIComponent;

export class PxxlReseller {
  constructor(private readonly client: PxxlClient) {}

  private read<T>(path: string) {
    return this.client.request<T>(`/domain-reseller${path}`);
  }

  private write<T>(method: string, path: string, body?: unknown, idempotencyKey?: string) {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return this.client.request<T>(`/domain-reseller${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  /** Your plan access, wallet balance, markup settings and wholesale terms. */
  account() { return this.read<ResellerAccount>("/account"); }
  /** Save markup and flow defaults. */
  async updateSettings(input: Partial<Omit<ResellerSettings, "defaultContactId">> & { defaultContactId?: number; clearDefaultContact?: boolean }) {
    return (await this.write<{ account: ResellerSettings }>("PATCH", "/account", input)).account;
  }
  /** Wholesale and customer prices per TLD, e.g. prices([".cv", ".com"]). */
  async prices(tlds?: string[]) {
    const query = tlds?.length ? `?tld=${enc(tlds.join(","))}` : "";
    return (await this.read<{ prices: Record<string, unknown>[]; nairaPerUsd: number }>(`/prices${query}`)).prices;
  }
  /** Is a domain free, and what does it cost you and your customer? */
  async quote(domain: string, years?: number) {
    return (await this.read<{ quote: ResellerQuote }>(`/availability?domain=${enc(domain)}${years ? `&years=${years}` : ""}`)).quote;
  }
  availability(domain: string, years?: number) { return this.quote(domain, years); }

  /** Register a domain and charge your wallet. */
  register(input: ResellerRegisterInput) {
    const { idempotencyKey, ...body } = input;
    return this.write<ResellerPurchase>("POST", "/domains", body, idempotencyKey);
  }
  buy(input: ResellerRegisterInput) { return this.register(input); }
  /** Renew for more years and charge your wallet. */
  renew(domain: string, input: { years?: number; maxChargeMinor?: number; idempotencyKey?: string } = {}) {
    const { idempotencyKey, ...body } = input;
    return this.write<Omit<ResellerPurchase, "domain">>("POST", `/domains/${enc(domain)}/renew`, body, idempotencyKey);
  }
  /** Transfer a domain in from another registrar (not .cv) and charge your wallet. */
  transferIn(input: ResellerTransferInput) {
    const { idempotencyKey, ...body } = input;
    return this.write<ResellerPurchase>("POST", "/transfers", body, idempotencyKey);
  }

  /** Domains you resold, newest first. */
  list(input: { customerRef?: string; status?: string; search?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) if (value !== undefined && value !== "") params.set(key, String(value));
    const query = params.toString();
    return this.read<{ domains: ResellerDomain[]; total: number; limit: number; offset: number }>(`/domains${query ? `?${query}` : ""}`);
  }
  /** One domain with its registrar status. */
  async get(domain: string) { return (await this.read<{ domain: ResellerDomain }>(`/domains/${enc(domain)}`)).domain; }
  status(domain: string) { return this.get(domain); }
  /** Change who a domain was sold to. */
  async updateCustomer(domain: string, customer: ResellerCustomer) {
    return (await this.write<{ domain: ResellerDomain }>("PATCH", `/domains/${enc(domain)}`, { customer })).domain;
  }

  dnsRecords(domain: string) { return this.read<Record<string, unknown>>(`/domains/${enc(domain)}/dns-records`); }
  /** Add or update one DNS record. */
  setDNSRecord(domain: string, record: ResellerDNSRecord) { return this.write<Record<string, unknown>>("POST", `/domains/${enc(domain)}/dns-records`, record); }
  /** Replace a record set (same type and name). */
  replaceDNSRecords(domain: string, record: ResellerDNSRecord) { return this.write<Record<string, unknown>>("PUT", `/domains/${enc(domain)}/dns-records`, record); }
  deleteDNSRecord(domain: string, record: { id?: string; recordId?: string; type?: string; name?: string; value?: string }) {
    return this.write<Record<string, unknown>>("DELETE", `/domains/${enc(domain)}/dns-records`, record);
  }
  dnsChangeLogs(domain: string) { return this.read<Record<string, unknown>>(`/domains/${enc(domain)}/dns-change-logs`); }
  rollbackDNSChange(domain: string, logId: string) { return this.write<Record<string, unknown>>("POST", `/domains/${enc(domain)}/dns-change-logs/${enc(logId)}/rollback`); }

  /** Point the domain at other nameservers. */
  setNameservers(domain: string, nameservers: string[]) { return this.write<Record<string, unknown>>("POST", `/domains/${enc(domain)}/nameservers`, { nameservers }); }
  /** Back to Pxxl's nameservers (Pxxl hosts the DNS). */
  resetNameservers(domain: string) { return this.write<Record<string, unknown>>("POST", `/domains/${enc(domain)}/nameservers/reset`); }
  verifyNameservers(domain: string) { return this.write<Record<string, unknown>>("POST", `/domains/${enc(domain)}/nameservers/verify`); }
  zoneStatus(domain: string) { return this.read<Record<string, unknown>>(`/domains/${enc(domain)}/zone-status`); }

  /** Lock or unlock the domain at the registrar. */
  setRegistrarLock(domain: string, locked: boolean) { return this.write<Record<string, unknown>>("POST", `/domains/${enc(domain)}/registrar-lock`, { locked }); }
  /** The EPP code to move the domain to another registrar (unlocks it). */
  transferCode(domain: string) { return this.write<{ authCode: string; registrarLockStatus: string }>("POST", `/domains/${enc(domain)}/transfer-code`); }

  /** Wallet charges for reseller purchases. */
  async charges(limit?: number) {
    return (await this.read<{ charges: Record<string, unknown>[] }>(`/charges${limit ? `?limit=${limit}` : ""}`)).charges;
  }
}
