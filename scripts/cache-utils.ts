import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import { execSync } from "child_process";

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
  return `v7-deps-${process.platform}-${cacheKey}`;
}

export function getCachePaths(): string[] {
  return [
    join(homedir(), ".cache", "ms-playwright"),
    join(process.cwd(), "node_modules"),
  ];
}

export function getRestoreKeys(): string[] {
  return [`deps-${process.platform}-`];
}

const S3_BUCKET = "vargas-jr-memory";
const AWS_REGION = "us-east-1";

export async function downloadCacheFromS3(cacheKey: string): Promise<boolean> {
  const s3Key = `cache/${cacheKey}.tar.gz`;
  const s3Uri = `s3://${S3_BUCKET}/${s3Key}`;
  const tempFile = `/tmp/cache-${Date.now()}.tar.gz`;

  try {
    console.log(`Checking for cache in S3: ${s3Key}`);
    const checkStartTime = Date.now();

    execSync(
      `aws s3 cp ${s3Uri} ${tempFile} --region ${AWS_REGION} --only-show-errors`,
      { stdio: "inherit" }
    );

    const checkDuration = ((Date.now() - checkStartTime) / 1000).toFixed(2);
    console.log(`Cache downloaded from S3 in ${checkDuration}s`);

    console.log("Extracting cache...");
    const extractStartTime = Date.now();
    execSync(`tar -xzf ${tempFile} -C ${homedir()}`, { stdio: "inherit" });
    const extractDuration = ((Date.now() - extractStartTime) / 1000).toFixed(2);
    console.log(`Extraction completed in ${extractDuration}s`);

    execSync(`rm ${tempFile}`);
    console.log(`Cache restored from S3: ${cacheKey}`);
    return true;
  } catch (error: any) {
    console.log("No cache found in S3, will create new cache after install");
    return false;
  }
}

export async function uploadCacheToS3(cacheKey: string): Promise<boolean> {
  const s3Key = `cache/${cacheKey}.tar.gz`;
  const s3Uri = `s3://${S3_BUCKET}/${s3Key}`;
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
    execSync(
      `aws s3 cp ${tempFile} ${s3Uri} --region ${AWS_REGION} --only-show-errors`,
      { stdio: "inherit" }
    );

    execSync(`rm ${tempFile}`);
    console.log(`Cache uploaded to S3: ${cacheKey}`);
    return true;
  } catch (error: any) {
    console.error("Failed to upload cache to S3:", error.message);
    return false;
  }
}
