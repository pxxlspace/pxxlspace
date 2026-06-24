import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { PxxlClient } from "@pxxlapp/pxxl";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: PXXL_API_KEY=pxxl_... npm run upload -- ./logo.png");
  process.exit(1);
}

const apiKey = process.env.PXXL_API_KEY;
if (!apiKey) {
  console.error("PXXL_API_KEY is required");
  process.exit(1);
}

const cdn = new PxxlClient({ apiKey, baseUrl: process.env.PXXL_API_URL });
const bytes = await readFile(filePath);
const asset = await cdn.uploadAsset({
  file: new Blob([bytes]),
  fileName: basename(filePath),
  visibility: "public",
});

console.log(JSON.stringify(asset, null, 2));
