// Build script: bundles src/index.js into dist/index.js using esbuild
const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["src/index.js"],
    bundle: true,
    platform: "node",
    target: "node20",
    outfile: "dist/index.js",
    external: ["express"],
    minify: true,
  })
  .then(() => {
    console.log("Build complete: dist/index.js");
  })
  .catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
  });
