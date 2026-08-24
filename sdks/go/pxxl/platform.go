package pxxl

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const DefaultMCPEndpoint = "https://mcp.pxxl.app/mcp"
const MCPProtocolVersion = "2025-06-18"

// Request calls any Pxxl API path with this client's authentication.
// pathValue must be relative to /api/v3 and start with a slash.
func (c *Client) Request(ctx context.Context, method, pathValue string, input, output any) error {
	if !strings.HasPrefix(pathValue, "/") {
		return fmt.Errorf("pxxl: request path must start with /")
	}
	var body io.Reader
	if input != nil {
		payload, err := json.Marshal(input)
		if err != nil {
			return err
		}
		body = bytes.NewReader(payload)
	}
	return c.doJSON(ctx, strings.ToUpper(method), pathValue, body, output)
}

func (c *Client) requestMap(ctx context.Context, method, pathValue string, input any) (map[string]any, error) {
	var result map[string]any
	if err := c.Request(ctx, method, pathValue, input, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) WhoAmI(ctx context.Context) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cli/whoami", nil)
}

func (c *Client) Stats(ctx context.Context, teamID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cli/stats"+teamQuery(teamID), nil)
}

func (c *Client) PlatformUsage(ctx context.Context, teamID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cli/usage"+teamQuery(teamID), nil)
}

func (c *Client) GetCDNSpace(ctx context.Context) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cdn/space", nil)
}

func (c *Client) CreateCDNSpace(ctx context.Context, name string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, "/cdn/space", map[string]any{"name": name})
}

func (c *Client) CDNUsage(ctx context.Context, limit int) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, withValues("/cdn/usage", url.Values{"limit": {fmt.Sprint(limit)}}), nil)
}

func (c *Client) CDNProxyLogs(ctx context.Context, values url.Values) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, withValues("/cdn/proxy-logs", values), nil)
}

func (c *Client) ListEdgeFunctions(ctx context.Context, values url.Values) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, withValues("/cdn/edge-functions", values), nil)
}

func (c *Client) CreateEdgeFunction(ctx context.Context, input map[string]any) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, "/cdn/edge-functions", input)
}

func (c *Client) ListStorageBuckets(ctx context.Context) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/storage/buckets", nil)
}

func (c *Client) GetStorageBucket(ctx context.Context, id string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/storage/buckets/"+url.PathEscape(id), nil)
}

func (c *Client) CreateStorageBucket(ctx context.Context, input map[string]any) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, "/storage/buckets", input)
}

func (c *Client) UpdateStorageBucket(ctx context.Context, id string, input map[string]any) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPatch, "/storage/buckets/"+url.PathEscape(id), input)
}

func (c *Client) DeleteStorageBucket(ctx context.Context, id string) error {
	return c.Request(ctx, http.MethodDelete, "/storage/buckets/"+url.PathEscape(id), nil, nil)
}

func (c *Client) StorageAnalytics(ctx context.Context, id, timeframe string) (map[string]any, error) {
	if timeframe == "" {
		timeframe = "30d"
	}
	return c.requestMap(ctx, http.MethodGet, withValues("/storage/buckets/"+url.PathEscape(id)+"/analytics", url.Values{"timeframe": {timeframe}}), nil)
}

func (c *Client) StorageBilling(ctx context.Context, values url.Values) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, withValues("/storage/billing", values), nil)
}

func (c *Client) ListStorageAccessKeys(ctx context.Context, bucketID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/storage/buckets/"+url.PathEscape(bucketID)+"/access-keys", nil)
}

func (c *Client) CreateStorageAccessKey(ctx context.Context, bucketID string, input map[string]any) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, "/storage/buckets/"+url.PathEscape(bucketID)+"/access-keys", input)
}

func (c *Client) DeleteStorageAccessKey(ctx context.Context, bucketID, keyID string) error {
	return c.Request(ctx, http.MethodDelete, "/storage/buckets/"+url.PathEscape(bucketID)+"/access-keys/"+url.PathEscape(keyID), nil, nil)
}

func (c *Client) ProjectTraffic(ctx context.Context, projectID string, values url.Values) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, withValues("/projects/"+url.PathEscape(projectID)+"/analytics/traffic", values), nil)
}

func (c *Client) DomainTraffic(ctx context.Context, domainID string, values url.Values) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, withValues("/domains/my/"+url.PathEscape(domainID)+"/analytics", values), nil)
}

func (c *Client) UserDomainTraffic(ctx context.Context, domain, timeframe string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, withValues("/user/analytics", url.Values{"domain": {domain}, "timeframe": {timeframe}}), nil)
}

func (c *Client) GetTLD(ctx context.Context, tld string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/domains/tlds/"+url.PathEscape(tld), nil)
}

func (c *Client) ListTLDTypes(ctx context.Context) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/domains/types", nil)
}

func (c *Client) ListTLDsByType(ctx context.Context, typeValue string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/domains/types/"+url.PathEscape(typeValue)+"/tlds", nil)
}

func (c *Client) CheckDomainAvailability(ctx context.Context, domain string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, "/domains/check-availability", map[string]any{"domain": domain})
}

func (c *Client) CreateCustomer(ctx context.Context, input map[string]any) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, "/cli/contacts", input)
}

func (c *Client) ListCustomers(ctx context.Context) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cli/contacts", nil)
}

func (c *Client) GetCustomer(ctx context.Context, id string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cli/contacts/"+url.PathEscape(id), nil)
}

func (c *Client) UpdateCustomer(ctx context.Context, id string, input map[string]any) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPut, "/cli/contacts/"+url.PathEscape(id), input)
}

func (c *Client) DeleteCustomer(ctx context.Context, id string) error {
	return c.Request(ctx, http.MethodDelete, "/cli/contacts/"+url.PathEscape(id), nil, nil)
}

func (c *Client) PurchaseDomain(ctx context.Context, input map[string]any) (map[string]any, error) {
	payload := make(map[string]any, len(input)+1)
	for key, value := range input {
		payload[key] = value
	}
	if customerID, ok := payload["customerId"]; ok {
		if _, hasContactID := payload["contactId"]; !hasContactID {
			payload["contactId"] = customerID
		}
		delete(payload, "customerId")
	}
	return c.requestMap(ctx, http.MethodPost, "/cli/domainprovider/domain/register", payload)
}

func (c *Client) ListDomainInvoices(ctx context.Context, teamID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cli/domainprovider/invoices"+teamQuery(teamID), nil)
}

func (c *Client) GetDomainInvoice(ctx context.Context, id, teamID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cli/domainprovider/invoice/"+url.PathEscape(id)+teamQuery(teamID), nil)
}

func (c *Client) GetPaymentURL(ctx context.Context, id, currency, teamID string) (map[string]any, error) {
	values := url.Values{}
	if currency != "" {
		values.Set("currency", currency)
	}
	if teamID != "" {
		values.Set("teamId", teamID)
	}
	return c.requestMap(ctx, http.MethodGet, withValues("/cli/domainprovider/invoice/"+url.PathEscape(id)+"/payment-url", values), nil)
}

func (c *Client) PayDomainInvoice(ctx context.Context, id, teamID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, "/cli/domainprovider/invoice/pay", map[string]any{"invoiceId": id, "teamId": teamID})
}

func (c *Client) CancelDomainInvoice(ctx context.Context, id, teamID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, "/cli/domainprovider/invoice/"+url.PathEscape(id)+"/cancel"+teamQuery(teamID), map[string]any{})
}

func (c *Client) ListPurchasedDomains(ctx context.Context) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cli/purchased-domains", nil)
}

func (c *Client) ListProjects(ctx context.Context, values url.Values) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, withValues("/cli/projects", values), nil)
}

func (c *Client) GetProject(ctx context.Context, id string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cli/projects/"+url.PathEscape(id), nil)
}

func (c *Client) ProjectDeployments(ctx context.Context, id string, values url.Values) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, withValues("/cli/projects/"+url.PathEscape(id)+"/deployments", values), nil)
}

func (c *Client) ProjectLogs(ctx context.Context, id string, live bool, values url.Values) (map[string]any, error) {
	suffix := "/logs"
	if live {
		suffix = "/live-logs"
	}
	return c.requestMap(ctx, http.MethodGet, withValues("/cli/projects/"+url.PathEscape(id)+suffix, values), nil)
}

func (c *Client) ListDeployments(ctx context.Context, values url.Values) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, withValues("/cli/deployments", values), nil)
}

func (c *Client) GetDeployment(ctx context.Context, id string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/cli/deployments/"+url.PathEscape(id), nil)
}

func (c *Client) DeploymentLogs(ctx context.Context, id string, build bool, values url.Values) (map[string]any, error) {
	suffix := "/logs"
	if build {
		suffix = "/build-logs"
	}
	return c.requestMap(ctx, http.MethodGet, withValues("/cli/deployments/"+url.PathEscape(id)+suffix, values), nil)
}

func (c *Client) ListProjectEnv(ctx context.Context, id string, global bool) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, projectEnvPath(id, global), nil)
}

func (c *Client) DiffProjectEnv(ctx context.Context, id string, global bool, input map[string]any) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, projectEnvPath(id, global)+"/diff", input)
}

func (c *Client) PushProjectEnv(ctx context.Context, id string, global bool, input map[string]any) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, projectEnvPath(id, global)+"/bulk", input)
}

func (c *Client) ListDatabases(ctx context.Context, teamID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/databases"+teamQuery(teamID), nil)
}

func (c *Client) GetDatabase(ctx context.Context, id, teamID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/databases/"+url.PathEscape(id)+teamQuery(teamID), nil)
}

func (c *Client) CreateDatabase(ctx context.Context, input map[string]any) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPost, "/databases", input)
}

func (c *Client) UpdateDatabase(ctx context.Context, id, teamID string, input map[string]any) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodPatch, "/databases/"+url.PathEscape(id)+teamQuery(teamID), input)
}

func (c *Client) DeleteDatabase(ctx context.Context, id, teamID string) error {
	return c.Request(ctx, http.MethodDelete, "/databases/"+url.PathEscape(id)+teamQuery(teamID), nil, nil)
}

func (c *Client) DatabaseAction(ctx context.Context, id, action, teamID string) (map[string]any, error) {
	if action != "start" && action != "stop" && action != "restart" {
		return nil, fmt.Errorf("pxxl: database action must be start, stop, or restart")
	}
	return c.requestMap(ctx, http.MethodPost, "/databases/"+url.PathEscape(id)+"/"+action+teamQuery(teamID), map[string]any{})
}

func (c *Client) DatabaseStats(ctx context.Context, id, teamID string) (map[string]any, error) {
	return c.databaseRead(ctx, id, "stats", teamID)
}

func (c *Client) DatabaseMetrics(ctx context.Context, id, teamID string) (map[string]any, error) {
	return c.databaseRead(ctx, id, "metrics", teamID)
}

func (c *Client) DatabaseUsage(ctx context.Context, id, teamID string) (map[string]any, error) {
	return c.databaseRead(ctx, id, "usage", teamID)
}

func (c *Client) DatabaseTables(ctx context.Context, id, teamID string) (map[string]any, error) {
	return c.databaseRead(ctx, id, "tables", teamID)
}

func (c *Client) RevealDatabaseCredential(ctx context.Context, id, field, teamID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/databases/"+url.PathEscape(id)+"/credentials/"+url.PathEscape(field)+teamQuery(teamID), nil)
}

func (c *Client) ListTeams(ctx context.Context) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/teams", nil)
}

func (c *Client) GetTeam(ctx context.Context, id string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/teams/"+url.PathEscape(id), nil)
}

func (c *Client) ListTeamDatabases(ctx context.Context, id string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/teams/"+url.PathEscape(id)+"/databases", nil)
}

// MCP performs one JSON-RPC call against the public Pxxl MCP endpoint.
func (c *Client) MCP(ctx context.Context, endpoint, method string, params map[string]any) (map[string]any, error) {
	if strings.TrimSpace(endpoint) == "" {
		endpoint = DefaultMCPEndpoint
	}
	payload, err := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": "pxxl-go", "method": method, "params": params})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("MCP-Protocol-Version", MCPProtocolVersion)
	var response struct {
		Result map[string]any `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := c.do(req, &response); err != nil {
		return nil, err
	}
	if response.Error != nil {
		return nil, fmt.Errorf("pxxl: MCP request failed: %s", response.Error.Message)
	}
	return response.Result, nil
}

func (c *Client) databaseRead(ctx context.Context, id, suffix, teamID string) (map[string]any, error) {
	return c.requestMap(ctx, http.MethodGet, "/databases/"+url.PathEscape(id)+"/"+suffix+teamQuery(teamID), nil)
}

func projectEnvPath(id string, global bool) string {
	suffix := "/envs"
	if global {
		suffix = "/global-envs"
	}
	return "/cli/projects/" + url.PathEscape(id) + suffix
}

func withValues(pathValue string, values url.Values) string {
	if len(values) == 0 {
		return pathValue
	}
	return pathValue + "?" + values.Encode()
}
