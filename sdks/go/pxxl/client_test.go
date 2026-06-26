package pxxl

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSummarySendsBearerAuth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer pxxl_test" {
			t.Fatalf("Authorization = %q", r.Header.Get("Authorization"))
		}
		if r.URL.Path != "/cdn/summary" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"totalFiles": 2}})
	}))
	defer server.Close()

	client, err := NewClient("pxxl_test", WithBaseURL(server.URL))
	if err != nil {
		t.Fatal(err)
	}
	summary, err := client.Summary(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if summary.TotalFiles != 2 {
		t.Fatalf("TotalFiles = %d", summary.TotalFiles)
	}
}

func TestUploadAssetUsesMultipart(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data;") {
			t.Fatalf("Content-Type = %q", r.Header.Get("Content-Type"))
		}
		if err := r.ParseMultipartForm(1024); err != nil {
			t.Fatal(err)
		}
		if r.FormValue("visibility") != "private" {
			t.Fatalf("visibility = %q", r.FormValue("visibility"))
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			t.Fatal(err)
		}
		defer file.Close()
		body, _ := io.ReadAll(file)
		if header.Filename != "hello.txt" || string(body) != "hello" {
			t.Fatalf("file = %q %q", header.Filename, string(body))
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"asset": map[string]any{"id": "asset_1", "fileName": "hello.txt"}})
	}))
	defer server.Close()

	client, err := NewClient("pxxl_test", WithBaseURL(server.URL))
	if err != nil {
		t.Fatal(err)
	}
	asset, err := client.UploadAsset(context.Background(), UploadAssetInput{
		Reader:     strings.NewReader("hello"),
		FileName:   "hello.txt",
		Visibility: "private",
	})
	if err != nil {
		t.Fatal(err)
	}
	if asset.ID != "asset_1" {
		t.Fatalf("asset id = %q", asset.ID)
	}
}

func TestDownloadAsset(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cdn/assets/asset_1/download" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		_, _ = w.Write([]byte("hello"))
	}))
	defer server.Close()

	client, _ := NewClient("pxxl_test", WithBaseURL(server.URL))
	body, err := client.DownloadAsset(context.Background(), "asset_1")
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "hello" {
		t.Fatalf("body = %q", string(body))
	}
}

func TestTypedAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"message":"nope"}`))
	}))
	defer server.Close()

	client, _ := NewClient("pxxl_test", WithBaseURL(server.URL))
	_, err := client.ListAssets(context.Background(), nil)
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("error type = %T", err)
	}
	if apiErr.StatusCode != http.StatusForbidden || apiErr.Message != "nope" {
		t.Fatalf("api error = %#v", apiErr)
	}
}

func TestSearchDomains(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/domains/search" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s", r.Method)
		}
		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["query"] != "example.cv" {
			t.Fatalf("query = %q", payload["query"])
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"query":   "example.cv",
			"count":   1,
			"results": []map[string]any{{"domain": "example.cv", "available": true, "tld": ".cv", "registerDollar": 4.99}},
		})
	}))
	defer server.Close()

	client, _ := NewClient("pxxl_test", WithBaseURL(server.URL))
	result, err := client.SearchDomains(context.Background(), "example.cv")
	if err != nil {
		t.Fatal(err)
	}
	if result.Count != 1 || result.Results[0].Domain != "example.cv" {
		t.Fatalf("result = %#v", result)
	}
}

func TestConnectDomainUsesCLIDomainEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cli/domains" || r.URL.Query().Get("teamId") != "team_1" {
			t.Fatalf("path/query = %s?%s", r.URL.Path, r.URL.RawQuery)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s", r.Method)
		}
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["domain"] != "example.com" || payload["projectId"] != "proj_1" {
			t.Fatalf("payload = %#v", payload)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"domainId": "dom_1", "status": "pending"})
	}))
	defer server.Close()

	client, _ := NewClient("pxxl_test", WithBaseURL(server.URL))
	result, err := client.ConnectDomain(context.Background(), ConnectDomainInput{Domain: "example.com", ProjectID: "proj_1", TeamID: "team_1"})
	if err != nil {
		t.Fatal(err)
	}
	if result["domainId"] != "dom_1" {
		t.Fatalf("result = %#v", result)
	}
}

func TestCreateDomainDNSRecord(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cli/domains/dom_1/dns-records" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s", r.Method)
		}
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["type"] != "A" || payload["name"] != "@" || payload["value"] != "193.181.212.65" {
			t.Fatalf("payload = %#v", payload)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"message": "DNS record saved"})
	}))
	defer server.Close()

	client, _ := NewClient("pxxl_test", WithBaseURL(server.URL))
	result, err := client.CreateDomainDNSRecord(context.Background(), "dom_1", DomainDNSRecordInput{Type: "A", Name: "@", Value: "193.181.212.65", TTL: 60})
	if err != nil {
		t.Fatal(err)
	}
	if result["message"] != "DNS record saved" {
		t.Fatalf("result = %#v", result)
	}
}

func TestCreateCronJob(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cli/cronjobs" || r.URL.Query().Get("teamId") != "team_1" {
			t.Fatalf("path/query = %s?%s", r.URL.Path, r.URL.RawQuery)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s", r.Method)
		}
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["name"] != "cleanup" || payload["schedule"] != "*/5 * * * *" || payload["url"] != "https://example.com/job" {
			t.Fatalf("payload = %#v", payload)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "cron_1", "name": "cleanup", "schedule": "*/5 * * * *", "url": "https://example.com/job", "method": "GET", "status": "active"})
	}))
	defer server.Close()

	client, _ := NewClient("pxxl_test", WithBaseURL(server.URL))
	job, err := client.CreateCronJob(context.Background(), CreateCronJobInput{Name: "cleanup", Schedule: "*/5 * * * *", URL: "https://example.com/job", Method: "GET", TeamID: "team_1"})
	if err != nil {
		t.Fatal(err)
	}
	if job.ID != "cron_1" {
		t.Fatalf("job = %#v", job)
	}
}

func TestCronActionsAndRuns(t *testing.T) {
	paths := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.Method+" "+r.URL.String())
		if strings.HasSuffix(r.URL.Path, "/runs") {
			_ = json.NewEncoder(w).Encode(map[string]any{"runs": []map[string]any{{"id": "run_1", "cronJobId": "cron_1", "status": "success", "startedAt": "2026-06-26T00:00:00Z"}}})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"message": "ok"})
	}))
	defer server.Close()

	client, _ := NewClient("pxxl_test", WithBaseURL(server.URL))
	if _, err := client.TriggerCronJob(context.Background(), "cron_1", "team_1"); err != nil {
		t.Fatal(err)
	}
	runs, err := client.ListCronJobRuns(context.Background(), "cron_1", url.Values{"page": []string{"1"}, "limit": []string{"20"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(runs) != 1 || runs[0].ID != "run_1" {
		t.Fatalf("runs = %#v", runs)
	}
	if paths[0] != "POST /cli/cronjobs/cron_1/trigger?teamId=team_1" || paths[1] != "GET /cli/cronjobs/cron_1/runs?limit=20&page=1" {
		t.Fatalf("paths = %#v", paths)
	}
}

func TestValidateCronSchedule(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cli/cronjobs/validate-schedule" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["schedule"] != "*/5 * * * *" {
			t.Fatalf("payload = %#v", payload)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"valid": true})
	}))
	defer server.Close()

	client, _ := NewClient("pxxl_test", WithBaseURL(server.URL))
	result, err := client.ValidateCronSchedule(context.Background(), "*/5 * * * *")
	if err != nil {
		t.Fatal(err)
	}
	if result["valid"] != true {
		t.Fatalf("result = %#v", result)
	}
}

func TestDeployUsesMultipartArchive(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<h1>Hello</h1>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte("SECRET=1"), 0o644); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/projects/spacedrop" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if err := r.ParseMultipartForm(8 << 20); err != nil {
			t.Fatal(err)
		}
		if r.FormValue("sourceShape") != "clideploy" || r.FormValue("deploymentSource") != "clideploy" {
			t.Fatalf("source fields missing")
		}
		if r.FormValue("name") != "hello" || r.FormValue("domainChoice") != "pxxl.app" {
			t.Fatalf("name/domain = %q/%q", r.FormValue("name"), r.FormValue("domainChoice"))
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			t.Fatal(err)
		}
		defer file.Close()
		archive, _ := io.ReadAll(file)
		reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
		if err != nil {
			t.Fatal(err)
		}
		var hasIndex, hasEnv bool
		for _, zipped := range reader.File {
			if zipped.Name == "index.html" {
				hasIndex = true
			}
			if zipped.Name == ".env" {
				hasEnv = true
			}
		}
		if !hasIndex || hasEnv {
			t.Fatalf("archive files index=%v env=%v", hasIndex, hasEnv)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "projectId": "proj_1", "deploymentId": "dep_1"})
	}))
	defer server.Close()

	client, _ := NewClient("pxxl_test", WithBaseURL(server.URL))
	result, err := client.Deploy(context.Background(), DeployInput{
		Directory:     dir,
		Name:          "hello",
		DomainChoice:  "pxxl.app",
		Port:          3000,
		CommitMessage: "Initial deploy from Go SDK",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.ProjectID != "proj_1" || result.DeploymentID != "dep_1" {
		t.Fatalf("deploy result = %#v", result)
	}
}
