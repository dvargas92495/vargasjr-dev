import {
  readFileSync,
  existsSync,
  createWriteStream,
  createReadStream,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { execSync } from "child_process";
import { AWS_DEFAULT_REGION } from "@/server/constants";

export function createStableCacheKey(): string {
  const packageLockPath = join(process.cwd(), "package-lock.json");
  if (!existsSync(packageLockPath)) {
    throw new Error("package-lock.json not found");
  }

  const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));

  const stablePackageLock = { ...packageLock };
  delete stablePackageLock.version;
  delete stablePackageLock.lockfileVersion;

  if (stablePackageLock.packages && stablePackageLock.packages[""]) {
    const rootPackage = { ...stablePackageLock.packages[""] };
    delete rootPackage.version;
    stablePackageLock.packages[""] = rootPackage;
  }

  const stableContent = JSON.stringify(stablePackageLock, null, 2);
  return createHash("sha256")
    .update(stableContent)
    .digest("hex")
    .substring(0, 16);
}

export function getFullCacheKey(): string {
  const cacheKey = createStableCacheKey();
  return `v2-deps-${process.platform}-${cacheKey}`;
}

export function getCachePaths(): string[] {
  return [
    join(homedir(), ".npm"),
    join(homedir(), ".cache", "ms-playwright"),
    join(process.cwd(), "node_modules"),
  ];
}

export function getRestoreKeys(): string[] {
  return [`deps-${process.platform}-`];
}

const S3_BUCKET = "vargas-jr-memory";

const s3Client = new S3Client({
  region: AWS_DEFAULT_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function downloadCacheFromS3(cacheKey: string): Promise<boolean> {
  const s3Key = `cache/${cacheKey}.tar.gz`;
  const tempFile = `/tmp/cache-${Date.now()}.tar.gz`;

  try {
    console.log(`Checking for cache in S3: ${s3Key}`);
    const checkStartTime = Date.now();

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const checkDuration = ((Date.now() - checkStartTime) / 1000).toFixed(2);
    console.log(`S3 check completed in ${checkDuration}s`);

    if (!response.Body) {
      console.log("Cache not found in S3");
      return false;
    }

    console.log("Downloading cache from S3...");
    const downloadStartTime = Date.now();
    const bodyStream = response.Body as Readable;
    const fileStream = createWriteStream(tempFile);
    await pipeline(bodyStream, fileStream);
    const downloadDuration = ((Date.now() - downloadStartTime) / 1000).toFixed(
      2
    );
    console.log(`Download completed in ${downloadDuration}s`);

    console.log("Extracting cache...");
    const extractStartTime = Date.now();
    execSync(`tar -xzf ${tempFile} -C ${homedir()}`, { stdio: "inherit" });
    const extractDuration = ((Date.now() - extractStartTime) / 1000).toFixed(2);
    console.log(`Extraction completed in ${extractDuration}s`);

    execSync(`rm ${tempFile}`);
    console.log(`Cache restored from S3: ${cacheKey}`);
    return true;
  } catch (error: any) {
    if (error.name === "NoSuchKey") {
      console.log("No cache found in S3, will create new cache after install");
      return false;
    }
    console.warn("Failed to download cache from S3:", error.message);
    return false;
  }
}

export async function uploadCacheToS3(cacheKey: string): Promise<boolean> {
  const s3Key = `cache/${cacheKey}.tar.gz`;
  const tempFile = `/tmp/cache-${Date.now()}.tar.gz`;

  try {
    const cachePaths = getCachePaths();
    console.log(`Creating cache tarball from: ${cachePaths.join(", ")}`);

    const relativePaths = cachePaths.map((p) => p.replace(homedir() + "/", ""));
    const tarCommand = `tar -czf ${tempFile} -C ${homedir()} ${relativePaths.join(
      " "
    )}`;
    execSync(tarCommand, { stdio: "inherit" });

    console.log("Uploading cache to S3...");
    const fileStream = createReadStream(tempFile);

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileStream,
      ContentType: "application/gzip",
    });

    await s3Client.send(command);

    execSync(`rm ${tempFile}`);
    console.log(`Cache uploaded to S3: ${cacheKey}`);
    return true;
  } catch (error: any) {
    console.error("Failed to upload cache to S3:", error.message);
    return false;
  }
}
