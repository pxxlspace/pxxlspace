package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/pxxlspace/pxxlspace/sdks/go/pxxl"
)

func newClient() *pxxl.Client {
	client, err := pxxl.NewClient(os.Getenv("PXXL_API_KEY"))
	if err != nil {
		log.Fatal(err)
	}
	return client
}

func deployLocalCodebase(ctx context.Context, client *pxxl.Client, directory string) (*pxxl.DeployResult, error) {
	return client.Deploy(ctx, pxxl.DeployInput{
		Directory:      directory,
		Name:           getenv("PXXL_PROJECT_NAME", "go-sdk-example"),
		DomainChoice:   getenv("PXXL_DOMAIN_CHOICE", "pxxl.app"),
		Port:           8080,
		Language:       "go",
		Framework:      "go",
		PackageManager: "go",
		InstallCommand: "go mod download",
		BuildCommand:   "go build -o app .",
		StartCommand:   "./app",
		CommitMessage:  "Deploy from the Pxxl Go SDK",
	})
}

func uploadPublicAsset(ctx context.Context, client *pxxl.Client, filePath string) (*pxxl.CDNAsset, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return client.UploadAsset(ctx, pxxl.UploadAssetInput{
		Reader:     file,
		FileName:   filepath.Base(filePath),
		Visibility: "public",
	})
}

func listCdnAssets(ctx context.Context, client *pxxl.Client) ([]pxxl.CDNAsset, error) {
	return client.ListAssets(ctx, nil)
}

func searchDomainsWithPrices(ctx context.Context, client *pxxl.Client, query string) (*pxxl.DomainSearchResponse, []pxxl.DomainTLD, error) {
	search, err := client.SearchDomains(ctx, query)
	if err != nil {
		return nil, nil, err
	}
	tlds, err := client.ListTLDs(ctx)
	if err != nil {
		return nil, nil, err
	}
	return search, tlds, nil
}

func main() {
	if os.Getenv("PXXL_API_KEY") == "" {
		log.Fatal("PXXL_API_KEY is required")
	}
	ctx := context.Background()
	client := newClient()
	search, tlds, err := searchDomainsWithPrices(ctx, client, "example.cv")
	if err != nil {
		log.Fatal(err)
	}
	out := map[string]any{
		"domainSearch": search,
		"tldCount":     len(tlds),
	}
	bytes, _ := json.MarshalIndent(out, "", "  ")
	fmt.Println(string(bytes))
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
