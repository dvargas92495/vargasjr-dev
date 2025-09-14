import fs from "fs";
import path from "path";

/** @public */
export function findPackageJson(): string {
  let packageJsonPath = "package.json";
  const LIMIT = 10;
  let count = 0;

  while (!fs.existsSync(packageJsonPath)) {
    packageJsonPath = path.join("..", packageJsonPath);
    count++;
    if (count > LIMIT) {
      throw new Error("Package.json not found");
    }
  }

  return fs.readFileSync(packageJsonPath, "utf-8");
}

/** @public */
export function getVersion(): string {
  try {
    const content = findPackageJson();
    const packageJson = JSON.parse(content);
    return packageJson.version || "unknown";
  } catch (error) {
    return "unknown";
  }
}
