# Pxxl Node Microservices Boilerplate

Deploy an API service and a background worker together on Pxxl.

- API service: `services/api`
- Worker service: `services/worker`
- Package manager: pnpm

## Deploy on Pxxl

```bash
npm install -g @pxxlapp/pxxl
pxxl login --api-key pxxl_...
pxxl init --new microservices-node --name my-services --domain pxxl.pro
cd my-services
pxxl deploy
```

Read the docs at https://docs.pxxl.app and deploy from https://pxxl.app.
