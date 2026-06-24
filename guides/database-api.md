# Pxxl Database API

The Pxxl CLI and SDK can create and manage managed databases through the same provisioning flow as the dashboard.

## CLI

```bash
pxxl login --api-key pxxl_...
pxxl team list
pxxl team use <team-id>
pxxl db create --name app-db --type postgres
pxxl db list
pxxl db get <database-id>
pxxl db start <database-id>
pxxl db stop <database-id>
pxxl db restart <database-id>
pxxl db stats <database-id>
pxxl db tables <database-id>
pxxl db delete <database-id>
```

Supported database types are `postgres`, `clickhouse`, `dragonfly`, `redis`, `keydb`, `mariadb`, `mysql`, and `mongodb`.

## SDK

```ts
import { PxxlClient } from "@pxxlapp/pxxl";

const pxxl = new PxxlClient({
  apiKey: process.env.PXXL_API_KEY,
  teamId: process.env.PXXL_TEAM_ID,
});

const created = await pxxl.createDatabase({ name: "app-db", type: "postgres" });
await pxxl.listDatabases();
await pxxl.restartDatabase(created.database.id);
```

## Scopes

- Use `scope=database` or `scope=all`.
- Use `permission=read` for list/detail/stats/tables.
- Use `permission=read_write` for create/update/start/stop/restart/delete.

Team context is passed as `teamId`. The server still checks spaceship membership and database permissions before returning or mutating anything.
