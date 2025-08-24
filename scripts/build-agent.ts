import { findPackageJson } from "@/server/versioning";
import * as esbuild from "esbuild";
import { existsSync, mkdirSync } from "fs";

async function buildAgent() {
  console.log("🔨 Building VargasJR Agent...");

  if (!existsSync("dist")) {
    mkdirSync("dist", { recursive: true });
  }

  console.log("📦 Building worker service...");
  await esbuild.build({
    entryPoints: ["worker/index.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "dist/worker.js",
    external: ["playwright-core"],
    /*
    TODO: In order to resolve playwright-core, we need to fix our use here:
    external: [
      "chromium-bidi",
    ],
    plugins: [
      {
        name: "resolve-package-json",
        setup(build) {
          build.onResolve({ filter: /.+\/package\.json$/ }, (args) => {
            console.log("ON RESOLVE", args.path);
            return { path: args.path, namespace: "resolve-package-json" };
          });

          build.onLoad(
            { filter: /.* /, namespace: "resolve-package-json" },
            async (args) => {
              console.log("ON LOAD", args.path);
              const contents = findPackageJson();
              console.log("contents", contents.slice(0, 20));

              return { contents, loader: "json" };
            }
          );
        },
      },
    ],
    */
  });

  console.log("✅ Build complete! Artifacts in ./dist/");
}

buildAgent().catch(console.error);
