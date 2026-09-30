import { S3Client } from "@aws-sdk/client-s3";
import type { CopyObjectCommandInput, GetObjectCommandInput, ListObjectsV2CommandInput, PutObjectCommandInput } from "@aws-sdk/client-s3";
export interface PxxlS3Credentials {
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    region?: string;
    bucket: string;
    pathStyle?: boolean;
}
export declare class PxxlS3 {
    readonly bucket: string;
    readonly client: S3Client;
    constructor(credentials: PxxlS3Credentials);
    list(input?: Omit<ListObjectsV2CommandInput, "Bucket">): Promise<import("@aws-sdk/client-s3").ListObjectsV2CommandOutput>;
    get(key: string, input?: Omit<GetObjectCommandInput, "Bucket" | "Key">): Promise<import("@aws-sdk/client-s3").GetObjectCommandOutput>;
    head(key: string): Promise<import("@aws-sdk/client-s3").HeadObjectCommandOutput>;
    put(key: string, body: PutObjectCommandInput["Body"], input?: Omit<PutObjectCommandInput, "Bucket" | "Key" | "Body">): Promise<import("@aws-sdk/client-s3").PutObjectCommandOutput>;
    delete(key: string): Promise<import("@aws-sdk/client-s3").DeleteObjectCommandOutput>;
    copy(sourceKey: string, destinationKey: string, input?: Omit<CopyObjectCommandInput, "Bucket" | "Key" | "CopySource">): Promise<import("@aws-sdk/client-s3").CopyObjectCommandOutput>;
    signedGetUrl(key: string, expiresIn?: number): Promise<string>;
    signedPutUrl(key: string, expiresIn?: number, input?: Omit<PutObjectCommandInput, "Bucket" | "Key">): Promise<string>;
}
//# sourceMappingURL=s3.d.ts.map