import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
export class PxxlS3 {
    bucket;
    client;
    constructor(credentials) {
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
    list(input = {}) {
        return this.client.send(new ListObjectsV2Command({ ...input, Bucket: this.bucket }));
    }
    get(key, input = {}) {
        return this.client.send(new GetObjectCommand({ ...input, Bucket: this.bucket, Key: key }));
    }
    head(key) {
        return this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    }
    put(key, body, input = {}) {
        return this.client.send(new PutObjectCommand({ ...input, Bucket: this.bucket, Key: key, Body: body }));
    }
    delete(key) {
        return this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }
    copy(sourceKey, destinationKey, input = {}) {
        const source = `${this.bucket}/${sourceKey}`.split("/").map(encodeURIComponent).join("/");
        return this.client.send(new CopyObjectCommand({ ...input, Bucket: this.bucket, Key: destinationKey, CopySource: source }));
    }
    signedGetUrl(key, expiresIn = 900) {
        return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
    }
    signedPutUrl(key, expiresIn = 900, input = {}) {
        return getSignedUrl(this.client, new PutObjectCommand({ ...input, Bucket: this.bucket, Key: key }), { expiresIn });
    }
}
