package pxxl

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
)

const defaultBaseURL = "https://gateway.pxxl.app/api/v3"

type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

type Option func(*Client)

func WithBaseURL(baseURL string) Option {
	return func(c *Client) {
		if strings.TrimSpace(baseURL) != "" {
			c.baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
		}
	}
}

func WithHTTPClient(httpClient *http.Client) Option {
	return func(c *Client) {
		if httpClient != nil {
			c.httpClient = httpClient
		}
	}
}

func NewClient(apiKey string, opts ...Option) (*Client, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, fmt.Errorf("pxxl: api key is required")
	}
	client := &Client{apiKey: apiKey, baseURL: defaultBaseURL, httpClient: http.DefaultClient}
	for _, opt := range opts {
		opt(client)
	}
	return client, nil
}

type CDNAsset struct {
	ID           string `json:"id"`
	UserID       string `json:"userId"`
	ProjectID    string `json:"projectId,omitempty"`
	DeploymentID string `json:"deploymentId,omitempty"`
	StorageName  string `json:"storageName,omitempty"`
	Key          string `json:"key"`
	FileName     string `json:"fileName"`
	ContentType  string `json:"contentType"`
	Size         int64  `json:"size"`
	PublicURL    string `json:"publicUrl"`
	SHA256       string `json:"sha256"`
	ETag         string `json:"etag"`
	Visibility   string `json:"visibility"`
	Kind         string `json:"kind"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt,omitempty"`
}

type CDNSummary struct {
	TotalFiles      int64      `json:"totalFiles"`
	StorageBytes    int64      `json:"storageBytes"`
	UploadedBytes   int64      `json:"uploadedBytes"`
	DownloadedBytes int64      `json:"downloadedBytes"`
	UploadsLast24h  int64      `json:"uploadsLast24h"`
	RecentAssets    []CDNAsset `json:"recentAssets"`
	Configured      bool       `json:"configured"`
	StorageName     string     `json:"storageName"`
}

type UploadAssetInput struct {
	Reader       io.Reader
	FileName     string
	Visibility   string
	Kind         string
	ProjectID    string
	DeploymentID string
}

type DomainTLD struct {
	TLD             string  `json:"tld"`
	Usage           string  `json:"usage,omitempty"`
	RegisterDollar  float64 `json:"registerDollar,omitempty"`
	RegisterNaira   float64 `json:"registerNaira,omitempty"`
	RenewDollar     float64 `json:"renewDollar,omitempty"`
	RenewNaira      float64 `json:"renewNaira,omitempty"`
	TransferDollar  float64 `json:"transferDollar,omitempty"`
	TransferNaira   float64 `json:"transferNaira,omitempty"`
	BonusAmount     float64 `json:"bonusAmount,omitempty"`
	BonusAmountUSD  float64 `json:"bonusAmountUSD,omitempty"`
	BonusEndingDate string  `json:"bonusEndingDate,omitempty"`
	Privacy         string  `json:"privacy,omitempty"`
	IDN             string  `json:"idn,omitempty"`
	Restrictions    string  `json:"restrictions,omitempty"`
}

type DomainSearchResult struct {
	Domain          string  `json:"domain"`
	Available       bool    `json:"available"`
	IsPremium       bool    `json:"isPremium"`
	PurchaseType    string  `json:"purchaseType,omitempty"`
	Reason          string  `json:"reason,omitempty"`
	Provider        string  `json:"provider,omitempty"`
	TLD             string  `json:"tld"`
	RegisterDollar  float64 `json:"registerDollar,omitempty"`
	RegisterNaira   float64 `json:"registerNaira,omitempty"`
	RenewDollar     float64 `json:"renewDollar,omitempty"`
	RenewNaira      float64 `json:"renewNaira,omitempty"`
	BonusAmount     float64 `json:"bonusAmount,omitempty"`
	BonusAmountUSD  float64 `json:"bonusAmountUSD,omitempty"`
	BonusEndingDate string  `json:"bonusEndingDate,omitempty"`
}

type DomainSearchResponse struct {
	Query   string               `json:"query"`
	Count   int                  `json:"count"`
	Results []DomainSearchResult `json:"results"`
	Cached  bool                 `json:"cached,omitempty"`
	Latency float64              `json:"latency,omitempty"`
}

type DeployInput struct {
	Directory      string
	ArchivePath    string
	Name           string
	ProjectID      string
	DomainChoice   string
	Environment    string
	Port           int
	Language       string
	Framework      string
	PackageManager string
	InstallCommand string
	BuildCommand   string
	StartCommand   string
	BaseDirectory  string
	EntryFile      string
	CommitMessage  string
}

type DeployResult struct {
	Success       bool           `json:"success,omitempty"`
	Message       string         `json:"message,omitempty"`
	Project       map[string]any `json:"project,omitempty"`
	Deployment    map[string]any `json:"deployment,omitempty"`
	ProjectID     string         `json:"projectId,omitempty"`
	DeploymentID  string         `json:"deploymentId,omitempty"`
	URL           string         `json:"url,omitempty"`
	DeploymentURL string         `json:"deploymentUrl,omitempty"`
	Raw           map[string]any `json:"-"`
}

type APIError struct {
	StatusCode int
	Message    string
	Body       []byte
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("pxxl: request failed with %d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("pxxl: request failed with %d", e.StatusCode)
}

func (c *Client) Summary(ctx context.Context) (*CDNSummary, error) {
	var out struct {
		Data CDNSummary `json:"data"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/cdn/summary", nil, &out); err != nil {
		return nil, err
	}
	return &out.Data, nil
}

func (c *Client) ListAssets(ctx context.Context, values url.Values) ([]CDNAsset, error) {
	path := "/cdn/assets"
	if len(values) > 0 {
		path += "?" + values.Encode()
	}
	var out struct {
		Assets []CDNAsset `json:"assets"`
	}
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, err
	}
	return out.Assets, nil
}

func (c *Client) UploadAsset(ctx context.Context, input UploadAssetInput) (*CDNAsset, error) {
	if input.Reader == nil {
		return nil, fmt.Errorf("pxxl: upload reader is required")
	}
	if strings.TrimSpace(input.FileName) == "" {
		return nil, fmt.Errorf("pxxl: upload file name is required")
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filepath.Base(input.FileName))
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(part, input.Reader); err != nil {
		return nil, err
	}
	writeField(writer, "visibility", defaultString(input.Visibility, "public"))
	writeField(writer, "kind", defaultString(input.Kind, "file"))
	writeField(writer, "projectId", input.ProjectID)
	writeField(writer, "deploymentId", input.DeploymentID)
	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := c.newRequest(ctx, http.MethodPost, "/cdn/assets", &body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	var out struct {
		Asset CDNAsset `json:"asset"`
	}
	if err := c.do(req, &out); err != nil {
		return nil, err
	}
	return &out.Asset, nil
}

func (c *Client) DownloadAsset(ctx context.Context, id string) ([]byte, error) {
	req, err := c.newRequest(ctx, http.MethodGet, "/cdn/assets/"+url.PathEscape(id)+"/download", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, decodeAPIError(resp)
	}
	return io.ReadAll(resp.Body)
}

func (c *Client) DeleteAsset(ctx context.Context, id string) error {
	return c.doJSON(ctx, http.MethodDelete, "/cdn/assets/"+url.PathEscape(id), nil, nil)
}

func (c *Client) ListTLDs(ctx context.Context) ([]DomainTLD, error) {
	var out struct {
		TLDs []DomainTLD `json:"tlds"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/domains/tlds", nil, &out); err != nil {
		return nil, err
	}
	return out.TLDs, nil
}

func (c *Client) SearchDomains(ctx context.Context, query string) (*DomainSearchResponse, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, fmt.Errorf("pxxl: domain search query is required")
	}
	payload, _ := json.Marshal(map[string]string{"query": query})
	var out DomainSearchResponse
	if err := c.doJSON(ctx, http.MethodPost, "/domains/search", bytes.NewReader(payload), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) Deploy(ctx context.Context, input DeployInput) (*DeployResult, error) {
	var archive []byte
	var fileName string
	var err error
	if strings.TrimSpace(input.ArchivePath) != "" {
		archive, err = os.ReadFile(input.ArchivePath)
		fileName = filepath.Base(input.ArchivePath)
	} else {
		directory := strings.TrimSpace(input.Directory)
		if directory == "" {
			directory = "."
		}
		archive, err = CreateProjectZip(directory)
		fileName = "pxxl-source.zip"
	}
	if err != nil {
		return nil, err
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(archive); err != nil {
		return nil, err
	}
	writeField(writer, "projectId", input.ProjectID)
	if input.ProjectID == "" {
		writeField(writer, "name", input.Name)
		writeField(writer, "domainChoice", input.DomainChoice)
	} else {
		writeField(writer, "name", input.Name)
		writeField(writer, "domainChoice", input.DomainChoice)
	}
	writeField(writer, "environment", defaultString(input.Environment, "production"))
	writeField(writer, "sourceShape", "clideploy")
	writeField(writer, "deploymentSource", "clideploy")
	writeField(writer, "language", input.Language)
	writeField(writer, "framework", input.Framework)
	writeField(writer, "packageManager", input.PackageManager)
	writeField(writer, "installCommand", input.InstallCommand)
	writeField(writer, "buildCommand", input.BuildCommand)
	writeField(writer, "startCommand", input.StartCommand)
	writeField(writer, "baseDirectory", input.BaseDirectory)
	writeField(writer, "entryFile", input.EntryFile)
	writeField(writer, "commitMessage", input.CommitMessage)
	if input.Port > 0 {
		writeField(writer, "port", fmt.Sprint(input.Port))
	}
	if input.ProjectID == "" && strings.TrimSpace(input.Name) == "" {
		return nil, fmt.Errorf("pxxl: deploy name is required for a new project")
	}
	if input.ProjectID == "" && strings.TrimSpace(input.DomainChoice) == "" {
		return nil, fmt.Errorf("pxxl: domain choice is required for a new project")
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := c.newRequest(ctx, http.MethodPost, "/projects/spacedrop", &body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	var raw map[string]any
	if err := c.do(req, &raw); err != nil {
		return nil, err
	}
	result := &DeployResult{Raw: raw}
	bytes, _ := json.Marshal(raw)
	_ = json.Unmarshal(bytes, result)
	return result, nil
}

func CreateProjectZip(root string) ([]byte, error) {
	root, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	var files []string
	if err := filepath.WalkDir(root, func(filePath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if filePath == root {
			return nil
		}
		rel, err := filepath.Rel(root, filePath)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		if shouldSkipDeployPath(rel, entry.IsDir()) {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		if looksSensitive(rel) {
			return fmt.Errorf("pxxl: refusing to package sensitive file %s", rel)
		}
		files = append(files, rel)
		return nil
	}); err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("pxxl: no deployable files found")
	}
	sort.Strings(files)
	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)
	for _, rel := range files {
		info, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel)))
		if err != nil {
			return nil, err
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return nil, err
		}
		header.Name = path.Clean(rel)
		header.Method = zip.Deflate
		fileWriter, err := zipWriter.CreateHeader(header)
		if err != nil {
			return nil, err
		}
		file, err := os.Open(filepath.Join(root, filepath.FromSlash(rel)))
		if err != nil {
			return nil, err
		}
		_, copyErr := io.Copy(fileWriter, file)
		closeErr := file.Close()
		if copyErr != nil {
			return nil, copyErr
		}
		if closeErr != nil {
			return nil, closeErr
		}
	}
	if err := zipWriter.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (c *Client) doJSON(ctx context.Context, method, path string, body io.Reader, out any) error {
	req, err := c.newRequest(ctx, method, path, body)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.do(req, out)
}

func (c *Client) do(req *http.Request, out any) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeAPIError(resp)
	}
	if out == nil {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *Client) newRequest(ctx context.Context, method, path string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("User-Agent", "pxxl-go-sdk/0.1")
	return req, nil
}

func decodeAPIError(resp *http.Response) error {
	body, _ := io.ReadAll(resp.Body)
	var payload struct {
		Message string `json:"message"`
		Error   string `json:"error"`
	}
	_ = json.Unmarshal(body, &payload)
	message := payload.Message
	if message == "" {
		message = payload.Error
	}
	return &APIError{StatusCode: resp.StatusCode, Message: message, Body: body}
}

func writeField(writer *multipart.Writer, key, value string) {
	if strings.TrimSpace(value) != "" {
		_ = writer.WriteField(key, value)
	}
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func shouldSkipDeployPath(rel string, isDir bool) bool {
	parts := strings.Split(rel, "/")
	if len(parts) > 0 {
		switch parts[0] {
		case ".git", "node_modules", ".next", ".turbo", ".cache", "dist", "build", ".output":
			return true
		}
	}
	base := filepath.Base(rel)
	if base == ".pxxlignore" || strings.HasPrefix(base, ".env") || strings.HasSuffix(base, ".log") || base == "pxxl-source.zip" {
		return true
	}
	return false
}

func looksSensitive(filePath string) bool {
	lower := strings.ToLower(filePath)
	return strings.HasSuffix(lower, ".pem") || strings.HasSuffix(lower, ".key") || strings.Contains(lower, "id_rsa") || strings.Contains(lower, "service-account") || strings.Contains(lower, "credentials.json")
}
