# Pxxl Go SDK

Official Go client for Pxxl CDN uploads.

```bash
go get github.com/pxxlspace/pxxlspace/public/sdks/go/pxxl
```

```go
client, err := pxxl.NewClient(os.Getenv("PXXL_API_KEY"))
if err != nil {
  log.Fatal(err)
}

file, err := os.Open("logo.png")
if err != nil {
  log.Fatal(err)
}
defer file.Close()

asset, err := client.UploadAsset(context.Background(), pxxl.UploadAssetInput{
  Reader: file,
  FileName: "logo.png",
  Visibility: "public",
})
if err != nil {
  log.Fatal(err)
}

fmt.Println(asset.PublicURL)
```

Use a Pxxl API key with `scope=cdn` and `permission=read_write` for upload and delete operations.
