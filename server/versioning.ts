import fs from "fs";
import path from "path";

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
