package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"path/filepath"

	"github.com/pxxlspace/pxxlspace/public/sdks/go/pxxl"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: PXXL_API_KEY=pxxl_... go run . ./logo.png")
	}
	apiKey := os.Getenv("PXXL_API_KEY")
	if apiKey == "" {
		log.Fatal("PXXL_API_KEY is required")
	}
	client, err := pxxl.NewClient(apiKey)
	if err != nil {
		log.Fatal(err)
	}
	file, err := os.Open(os.Args[1])
	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()
	asset, err := client.UploadAsset(context.Background(), pxxl.UploadAssetInput{
		Reader:     file,
		FileName:   filepath.Base(os.Args[1]),
		Visibility: "public",
	})
	if err != nil {
		log.Fatal(err)
	}
	if err := json.NewEncoder(os.Stdout).Encode(asset); err != nil {
		log.Fatal(err)
	}
}
