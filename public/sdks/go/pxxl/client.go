package pxxl

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
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
