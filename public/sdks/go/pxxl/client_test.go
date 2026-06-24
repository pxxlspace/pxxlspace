package pxxl

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
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
