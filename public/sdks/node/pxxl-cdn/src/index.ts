export type CDNVisibility = "private" | "public";
export type CDNAssetKind = "file" | "artifact";

export interface CDNAsset {
  id: string;
  userId: string;
  projectId?: string | null;
  deploymentId?: string | null;
  storageName?: string;
  key: string;
  fileName: string;
  contentType?: string;
  size: number;
  publicUrl?: string;
  sha256?: string;
  etag?: string;
  visibility: CDNVisibility;
  kind: CDNAssetKind;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface CDNAnalyticsSummary {
  enabled: boolean;
  available: boolean;
  hostname?: string;
  requests: number;
  bytes: number;
  cachedBytes: number;
  cacheHitRatio: number;
  statusCodes?: Record<string, number>;
  countries?: Record<string, number>;
  series?: Array<{ timestamp: string; requests: number; bytes: number; cachedBytes: number }>;
  error?: string;
}

export interface CDNSummary {
  totalFiles: number;
  storageBytes: number;
  uploadedBytes: number;
  downloadedBytes: number;
  uploadsLast24h: number;
  recentAssets: CDNAsset[];
  analytics: CDNAnalyticsSummary;
  configured: boolean;
  storageName: string;
  space?: { id: string; name: string; status: "active" | "suspended"; suspendedAt?: string | null } | null;
  credits?: {
    enabled: boolean;
    balance: number;
    usedCredits: number;
    lowCreditThreshold: number;
    projectedDailyStorageCredits: number;
    freeMonthlyCredits: number;
    uploadCreditUnitBytes: number;
    uploadCreditsPerUnit: number;
  };
}

export interface PxxlCDNOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface UploadAssetInput {
  file: Blob;
  fileName: string;
  visibility?: CDNVisibility;
  kind?: CDNAssetKind;
  projectId?: string;
  deploymentId?: string;
}

export interface ListAssetsInput {
  page?: number;
  limit?: number;
  search?: string;
  kind?: CDNAssetKind;
}

export class PxxlCDNError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "PxxlCDNError";
    this.status = status;
    this.details = details;
  }
}

export class PxxlCDN {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PxxlCDNOptions) {
    if (!options.apiKey || !options.apiKey.trim()) {
      throw new Error("PxxlCDN requires an apiKey");
    }
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl || "https://gateway.pxxl.app/api/v3").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async summary(): Promise<CDNSummary> {
    const response = await this.request<{ data: CDNSummary }>("/cdn/summary");
    return response.data;
  }

  async listAssets(input: ListAssetsInput = {}): Promise<{ assets: CDNAsset[]; pagination: unknown }> {
    const params = new URLSearchParams();
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    });
    const suffix = params.size ? `?${params.toString()}` : "";
    return this.request(`/cdn/assets${suffix}`);
  }

  async uploadAsset(input: UploadAssetInput): Promise<CDNAsset> {
    if (!input.fileName || !input.fileName.trim()) {
      throw new Error("uploadAsset requires fileName");
    }
    const form = new FormData();
    form.append("file", input.file, input.fileName);
    form.append("visibility", input.visibility || "public");
    if (input.kind) form.append("kind", input.kind);
    if (input.projectId) form.append("projectId", input.projectId);
    if (input.deploymentId) form.append("deploymentId", input.deploymentId);
    const response = await this.request<{ asset: CDNAsset }>("/cdn/assets", {
      method: "POST",
      body: form,
      skipContentType: true,
    });
    return response.asset;
  }

  async downloadAsset(id: string): Promise<Blob> {
    const response = await this.rawRequest(`/cdn/assets/${encodeURIComponent(id)}/download`);
    return response.blob();
  }

  async deleteAsset(id: string): Promise<void> {
    await this.request(`/cdn/assets/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async usage(limit = 100): Promise<unknown[]> {
    const response = await this.request<{ events: unknown[] }>(`/cdn/usage?limit=${encodeURIComponent(limit)}`);
    return response.events;
  }

  private async request<T>(path: string, init: RequestInit & { skipContentType?: boolean } = {}): Promise<T> {
    const response = await this.rawRequest(path, init);
    const data = await response.json().catch(() => ({}));
    return data as T;
  }

  private async rawRequest(path: string, init: RequestInit & { skipContentType?: boolean } = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    if (!init.skipContentType && init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      let details: unknown = null;
      try {
        details = await response.json();
      } catch {
        details = await response.text().catch(() => "");
      }
      throw new PxxlCDNError(`Pxxl CDN request failed with ${response.status}`, response.status, details);
    }
    return response;
  }
}
