# Pxxl Go SDK

Official Go client for Pxxl CDN uploads, domain search/pricing, and local codebase deploys.

```bash
go get github.com/pxxlspace/pxxlspace/sdks/go/pxxl
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

## Deploy a local codebase

```go
result, err := client.Deploy(context.Background(), pxxl.DeployInput{
  Directory: ".",
  Name: "my-go-app",
  DomainChoice: "pxxl.app",
  Port: 8080,
  Language: "go",
  Framework: "go",
  PackageManager: "go",
  InstallCommand: "go mod download",
  BuildCommand: "go build -o app .",
  StartCommand: "./app",
  CommitMessage: "Deploy from Go SDK",
})
```

## Search domains and prices

```go
search, err := client.SearchDomains(context.Background(), "example.cv")
tlds, err := client.ListTLDs(context.Background())
```

See `examples/go-sdk-functions` for copyable functions.
