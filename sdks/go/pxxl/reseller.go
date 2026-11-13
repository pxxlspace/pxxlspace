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

// Domain reselling (Pro plan and up). Make the client with a reseller key
// (pxxl_rsl_..., from Tools > Domain reseller) and use client.Reseller().
// Every purchase is charged to your Pxxl wallet at the wholesale price.
//
//	client, _ := pxxl.NewClient(os.Getenv("PXXL_RESELLER_KEY"))
//	quote, _ := client.Reseller().Quote(ctx, "example.cv", 1)
type Reseller struct{ c *Client }

// Reseller returns the domain reseller API.
func (c *Client) Reseller() *Reseller { return &Reseller{c: c} }

type ResellerCustomer struct {
	Reference string `json:"reference,omitempty"`
	Email     string `json:"email,omitempty"`
	Name      string `json:"name,omitempty"`
}

type ResellerContact struct {
	FirstName    string `json:"firstName"`
	LastName     string `json:"lastName"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Organization string `json:"organization,omitempty"`
}

type ResellerAddress struct {
	Street     string `json:"street"`
	City       string `json:"city"`
	State      string `json:"state"`
	PostalCode string `json:"postalCode"`
	Country    string `json:"country"`
}

// ResellerQuote is what a domain costs you (ChargeMinor, in US cents, is
// what your wallet is charged) and what your markup makes it for your customer.
type ResellerQuote struct {
	Domain            string  `json:"domain"`
	TLD               string  `json:"tld"`
	Available         bool    `json:"available"`
	Premium           bool    `json:"premium"`
	Reason            string  `json:"reason,omitempty"`
	Action            string  `json:"action"`
	Years             int     `json:"years"`
	WholesaleNGN      float64 `json:"wholesaleNgn"`
	WholesaleUSD      float64 `json:"wholesaleUsd"`
	ChargeMinor       int64   `json:"chargeMinor"`
	CustomerPriceNGN  float64 `json:"customerPriceNgn"`
	CustomerPriceUSD  float64 `json:"customerPriceUsd"`
	RenewalPerYearNGN float64 `json:"renewalPerYearNgn"`
	RenewalPerYearUSD float64 `json:"renewalPerYearUsd"`
	FixedPrice        bool    `json:"fixedPrice"`
	NairaPerUSD       float64 `json:"nairaPerUsd"`
}

type ResellerDomain struct {
	ID               string `json:"id"`
	Domain           string `json:"domain"`
	DomainID         string `json:"domainId,omitempty"`
	TLD              string `json:"tld"`
	Kind             string `json:"kind"`
	Status           string `json:"status"`
	Customer         ResellerCustomer `json:"customer"`
	Years            int     `json:"years"`
	InvoiceID        string  `json:"invoiceId"`
	WholesaleMinor   int64   `json:"wholesaleMinor"`
	WholesaleNGN     float64 `json:"wholesaleNgn"`
	CustomerPriceUSD float64 `json:"customerPriceUsd"`
	CustomerPriceNGN float64 `json:"customerPriceNgn"`
	CreatedAt        string  `json:"createdAt"`
	Registrar        *struct {
		Status     string `json:"status"`
		Active     bool   `json:"active"`
		ExpiresAt  string `json:"expiresAt,omitempty"`
		Provider   string `json:"provider,omitempty"`
		LockStatus string `json:"lockStatus,omitempty"`
	} `json:"registrar,omitempty"`
	PxxlNameservers []string `json:"pxxlNameservers,omitempty"`
}

type ResellerPurchase struct {
	Message      string         `json:"message"`
	Domain       ResellerDomain `json:"domain"`
	Quote        ResellerQuote  `json:"quote"`
	InvoiceID    string         `json:"invoiceId"`
	ChargedMinor int64          `json:"chargedMinor"`
	BalanceMinor int64          `json:"balanceMinor"`
}

type ResellerRegisterInput struct {
	Domain      string            `json:"domain"`
	Years       int               `json:"years,omitempty"`
	Nameservers []string          `json:"nameservers,omitempty"`
	ContactID   *uint             `json:"contactId,omitempty"`
	Contact     *ResellerContact  `json:"contact,omitempty"`
	Address     *ResellerAddress  `json:"address,omitempty"`
	Customer    *ResellerCustomer `json:"customer,omitempty"`
	// MaxChargeMinor refuses the purchase (nothing charged) above this many US cents.
	MaxChargeMinor int64 `json:"maxChargeMinor,omitempty"`
	// IdempotencyKey makes retries safe: the same key never buys twice.
	IdempotencyKey string `json:"-"`
}

type ResellerTransferInput struct {
	Domain         string            `json:"domain"`
	AuthCode       string            `json:"authCode"`
	Years          int               `json:"years,omitempty"`
	Nameservers    []string          `json:"nameservers,omitempty"`
	Customer       *ResellerCustomer `json:"customer,omitempty"`
	MaxChargeMinor int64             `json:"maxChargeMinor,omitempty"`
	IdempotencyKey string            `json:"-"`
}

type ResellerListOptions struct {
	CustomerRef string
	Status      string
	Search      string
	Limit       int
	Offset      int
}

func (r *Reseller) send(ctx context.Context, method, path, idempotencyKey string, input, out any) error {
	var body io.Reader
	if input != nil {
		payload, err := json.Marshal(input)
		if err != nil {
			return err
		}
		body = bytes.NewReader(payload)
	}
	req, err := r.c.newRequest(ctx, method, "/domain-reseller"+path, body)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	return r.c.do(req, out)
}

func esc(domain string) string { return url.PathEscape(strings.TrimSpace(domain)) }

// Account returns your plan access, wallet balance, markup settings and terms.
func (r *Reseller) Account(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	return out, r.send(ctx, http.MethodGet, "/account", "", nil, &out)
}

// UpdateSettings saves markup and flow defaults (markupPercent, markupFixedNgn,
// markupFixedUsd, roundCustomerPrices, defaultNameservers, defaultYears,
// defaultContactId, autoRenew, brandName, supportEmail).
func (r *Reseller) UpdateSettings(ctx context.Context, settings map[string]any) (map[string]any, error) {
	var out struct {
		Account map[string]any `json:"account"`
	}
	return out.Account, r.send(ctx, http.MethodPatch, "/account", "", settings, &out)
}

// Prices lists wholesale and customer prices, optionally for some TLDs.
func (r *Reseller) Prices(ctx context.Context, tlds ...string) ([]map[string]any, error) {
	path := "/prices"
	if len(tlds) > 0 {
		path += "?tld=" + url.QueryEscape(strings.Join(tlds, ","))
	}
	var out struct {
		Prices []map[string]any `json:"prices"`
	}
	return out.Prices, r.send(ctx, http.MethodGet, path, "", nil, &out)
}

// Quote checks availability and prices a registration.
func (r *Reseller) Quote(ctx context.Context, domain string, years int) (ResellerQuote, error) {
	path := "/availability?domain=" + url.QueryEscape(domain)
	if years > 0 {
		path += fmt.Sprintf("&years=%d", years)
	}
	var out struct {
		Quote ResellerQuote `json:"quote"`
	}
	return out.Quote, r.send(ctx, http.MethodGet, path, "", nil, &out)
}

// Register buys a domain and charges your wallet.
func (r *Reseller) Register(ctx context.Context, input ResellerRegisterInput) (ResellerPurchase, error) {
	var out ResellerPurchase
	return out, r.send(ctx, http.MethodPost, "/domains", input.IdempotencyKey, input, &out)
}

// Renew renews a domain for years more and charges your wallet.
func (r *Reseller) Renew(ctx context.Context, domain string, years int, idempotencyKey string) (ResellerPurchase, error) {
	var out ResellerPurchase
	return out, r.send(ctx, http.MethodPost, "/domains/"+esc(domain)+"/renew", idempotencyKey, map[string]any{"years": years}, &out)
}

// TransferIn transfers a domain in from another registrar (not .cv).
func (r *Reseller) TransferIn(ctx context.Context, input ResellerTransferInput) (ResellerPurchase, error) {
	var out ResellerPurchase
	return out, r.send(ctx, http.MethodPost, "/transfers", input.IdempotencyKey, input, &out)
}

// List lists the domains you resold.
func (r *Reseller) List(ctx context.Context, opts ResellerListOptions) ([]ResellerDomain, int64, error) {
	q := url.Values{}
	for key, value := range map[string]string{"customerRef": opts.CustomerRef, "status": opts.Status, "search": opts.Search} {
		if value != "" {
			q.Set(key, value)
		}
	}
	if opts.Limit > 0 {
		q.Set("limit", fmt.Sprint(opts.Limit))
	}
	if opts.Offset > 0 {
		q.Set("offset", fmt.Sprint(opts.Offset))
	}
	path := "/domains"
	if encoded := q.Encode(); encoded != "" {
		path += "?" + encoded
	}
	var out struct {
		Domains []ResellerDomain `json:"domains"`
		Total   int64            `json:"total"`
	}
	err := r.send(ctx, http.MethodGet, path, "", nil, &out)
	return out.Domains, out.Total, err
}

// Get returns one domain with its registrar status.
func (r *Reseller) Get(ctx context.Context, domain string) (ResellerDomain, error) {
	var out struct {
		Domain ResellerDomain `json:"domain"`
	}
	return out.Domain, r.send(ctx, http.MethodGet, "/domains/"+esc(domain), "", nil, &out)
}

// UpdateCustomer changes who a domain was sold to.
func (r *Reseller) UpdateCustomer(ctx context.Context, domain string, customer ResellerCustomer) (ResellerDomain, error) {
	var out struct {
		Domain ResellerDomain `json:"domain"`
	}
	return out.Domain, r.send(ctx, http.MethodPatch, "/domains/"+esc(domain), "", map[string]any{"customer": customer}, &out)
}

func (r *Reseller) mapCall(ctx context.Context, method, path string, input any) (map[string]any, error) {
	var out map[string]any
	return out, r.send(ctx, method, path, "", input, &out)
}

// DNSRecords lists a domain's DNS records.
func (r *Reseller) DNSRecords(ctx context.Context, domain string) (map[string]any, error) {
	return r.mapCall(ctx, http.MethodGet, "/domains/"+esc(domain)+"/dns-records", nil)
}

// SetDNSRecord adds or updates one record.
func (r *Reseller) SetDNSRecord(ctx context.Context, domain string, record DomainDNSRecordInput) (map[string]any, error) {
	return r.mapCall(ctx, http.MethodPost, "/domains/"+esc(domain)+"/dns-records", record)
}

// ReplaceDNSRecords replaces a record set (same type and name).
func (r *Reseller) ReplaceDNSRecords(ctx context.Context, domain string, record DomainDNSRecordInput) (map[string]any, error) {
	return r.mapCall(ctx, http.MethodPut, "/domains/"+esc(domain)+"/dns-records", record)
}

// DeleteDNSRecord deletes a record (by ID, or type, name and value).
func (r *Reseller) DeleteDNSRecord(ctx context.Context, domain string, record DomainDNSRecordInput) (map[string]any, error) {
	return r.mapCall(ctx, http.MethodDelete, "/domains/"+esc(domain)+"/dns-records", record)
}

// SetNameservers points the domain at other nameservers.
func (r *Reseller) SetNameservers(ctx context.Context, domain string, nameservers []string) (map[string]any, error) {
	return r.mapCall(ctx, http.MethodPost, "/domains/"+esc(domain)+"/nameservers", map[string]any{"nameservers": nameservers})
}

// ResetNameservers moves the domain back to Pxxl DNS.
func (r *Reseller) ResetNameservers(ctx context.Context, domain string) (map[string]any, error) {
	return r.mapCall(ctx, http.MethodPost, "/domains/"+esc(domain)+"/nameservers/reset", nil)
}

// VerifyNameservers reports the domain's live nameservers.
func (r *Reseller) VerifyNameservers(ctx context.Context, domain string) (map[string]any, error) {
	return r.mapCall(ctx, http.MethodPost, "/domains/"+esc(domain)+"/nameservers/verify", nil)
}

// ZoneStatus reports DNS zone activation.
func (r *Reseller) ZoneStatus(ctx context.Context, domain string) (map[string]any, error) {
	return r.mapCall(ctx, http.MethodGet, "/domains/"+esc(domain)+"/zone-status", nil)
}

// SetRegistrarLock locks or unlocks the domain at the registrar.
func (r *Reseller) SetRegistrarLock(ctx context.Context, domain string, locked bool) (map[string]any, error) {
	return r.mapCall(ctx, http.MethodPost, "/domains/"+esc(domain)+"/registrar-lock", map[string]any{"locked": locked})
}

// TransferCode returns the EPP code to move the domain away (and unlocks it).
func (r *Reseller) TransferCode(ctx context.Context, domain string) (map[string]any, error) {
	return r.mapCall(ctx, http.MethodPost, "/domains/"+esc(domain)+"/transfer-code", nil)
}

// Charges lists wallet charges for reseller purchases.
func (r *Reseller) Charges(ctx context.Context, limit int) ([]map[string]any, error) {
	path := "/charges"
	if limit > 0 {
		path += fmt.Sprintf("?limit=%d", limit)
	}
	var out struct {
		Charges []map[string]any `json:"charges"`
	}
	return out.Charges, r.send(ctx, http.MethodGet, path, "", nil, &out)
}
