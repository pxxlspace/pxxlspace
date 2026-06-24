# Pxxl Microservices Example

This example shows a small Pxxl project with two services:

- `api`: public Express HTTP API
- `worker`: private background worker that logs scheduled work

Use this when you want one deployable project with more than one process.

```bash
npm install -g @pxxlapp/pxxl
pxxl login --api-key pxxl_...
pxxl init --new microservices-node --name my-services --domain pxxl.pro
cd my-services
pxxl deploy
```

Docs: https://docs.pxxl.app
Deploy: https://pxxl.app
