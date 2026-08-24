# Pxxl Go SDK

Use one Go client for projects, deployments, environment variables, domains,
billing, CDN, Storage, databases, cron jobs, analytics, teams, and MCP.

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

The client also provides `Request` for new API routes without waiting for an SDK release.

## Platform services

```go
projects, _ := client.ListProjects(context.Background(), nil)
buckets, _ := client.ListStorageBuckets(context.Background())
databases, _ := client.ListDatabases(context.Background(), "")
identity, _ := client.WhoAmI(context.Background())
```

Use `client.MCP` to call tools and resources from the Pxxl MCP server.

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

## Connect and manage domains

```go
connected, err := client.ConnectDomain(context.Background(), pxxl.ConnectDomainInput{
  Domain: "example.com",
  ProjectID: "proj_123",
})

apiDomain, err := client.ConnectDomain(context.Background(), pxxl.ConnectDomainInput{
  Domain: "api.example.com",
  ProjectID: "proj_123",
  MicroserviceID: "api",
})

records, err := client.ListDomainDNSRecords(context.Background(), "dom_123", "")

created, err := client.CreateDomainDNSRecord(context.Background(), "dom_123", pxxl.DomainDNSRecordInput{
  Type: "A",
  Name: "@",
  Value: "193.181.212.65",
  TTL: 60,
})

activation, err := client.ActivateDomain(context.Background(), "dom_123", "")
certificate, err := client.DownloadDomainCertificate(context.Background(), "dom_123", "")
```

Domain write operations require an API key with `scope=domain`, `scope=domains`, or `scope=all` and `permission=read_write`.

## Manage cron jobs

```go
job, err := client.CreateCronJob(context.Background(), pxxl.CreateCronJobInput{
  Name: "cache warmer",
  Schedule: "*/5 * * * *",
  URL: "https://example.com/api/warm-cache",
  Method: "POST",
  TimeoutSeconds: 10,
})

runs, err := client.ListCronJobRuns(context.Background(), job.ID, nil)
triggered, err := client.TriggerCronJob(context.Background(), job.ID, "")
```

Cron read operations require `scope=cron`, `scope=cronjobs`, or `scope=all` with `permission=read`. Create, update, delete, start, stop, and trigger require `permission=read_write`.

See the [SDK documentation](../../../docs/integrations/sdk/overview.mdx) for every module and the [publishing guide](../../../docs/integrations/sdk/publishing.mdx) for release steps.
