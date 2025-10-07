import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createHash } from "crypto";

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
  return `deps-${process.platform}-${cacheKey}`;
}

export function getCachePaths(): string[] {
  return [
    join(homedir(), ".npm"),
    join(homedir(), ".cache", "ms-playwright"),
  ];
}

export function getRestoreKeys(): string[] {
  return [`deps-${process.platform}-`];
}
