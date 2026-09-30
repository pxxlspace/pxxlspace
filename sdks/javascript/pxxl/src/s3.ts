import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type {
  CopyObjectCommandInput,
  GetObjectCommandInput,
  ListObjectsV2CommandInput,
  PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface PxxlS3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region?: string;
  bucket: string;
  pathStyle?: boolean;
}

export class PxxlS3 {
  readonly bucket: string;
  readonly client: S3Client;

  constructor(credentials: PxxlS3Credentials) {
    if (!credentials.accessKeyId?.trim() || !credentials.secretAccessKey?.trim()) {
      throw new Error("Pxxl S3 accessKeyId and secretAccessKey are required");
    }
    this.bucket = credentials.bucket;
    this.client = new S3Client({
      endpoint: credentials.endpoint,
      region: credentials.region || "auto",
      forcePathStyle: credentials.pathStyle ?? true,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });
  }

  list(input: Omit<ListObjectsV2CommandInput, "Bucket"> = {}) {
    return this.client.send(new ListObjectsV2Command({ ...input, Bucket: this.bucket }));
  }

  get(key: string, input: Omit<GetObjectCommandInput, "Bucket" | "Key"> = {}) {
    return this.client.send(new GetObjectCommand({ ...input, Bucket: this.bucket, Key: key }));
  }

  head(key: string) {
    return this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  put(key: string, body: PutObjectCommandInput["Body"], input: Omit<PutObjectCommandInput, "Bucket" | "Key" | "Body"> = {}) {
    return this.client.send(new PutObjectCommand({ ...input, Bucket: this.bucket, Key: key, Body: body }));
  }

  delete(key: string) {
    return this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  copy(sourceKey: string, destinationKey: string, input: Omit<CopyObjectCommandInput, "Bucket" | "Key" | "CopySource"> = {}) {
    const source = `${this.bucket}/${sourceKey}`.split("/").map(encodeURIComponent).join("/");
    return this.client.send(new CopyObjectCommand({ ...input, Bucket: this.bucket, Key: destinationKey, CopySource: source }));
  }

  signedGetUrl(key: string, expiresIn = 900) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  signedPutUrl(key: string, expiresIn = 900, input: Omit<PutObjectCommandInput, "Bucket" | "Key"> = {}) {
    return getSignedUrl(this.client, new PutObjectCommand({ ...input, Bucket: this.bucket, Key: key }), { expiresIn });
  }
}
