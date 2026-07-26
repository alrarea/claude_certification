/**
 * Post-`prisma generate` patch: inlines the query compiler's .wasm bytes
 * directly into the generated client as a base64 string, instead of reading
 * `query_compiler_bg.wasm` from disk at runtime.
 *
 * Why: with `engineType = "client"` (see schema.prisma), Prisma's generated
 * client resolves the wasm file via `path.join(__dirname, ...)` +
 * `fs.readFileSync`. That's fine locally, but Amplify Gen 2's Lambda bundler
 * (esbuild under the hood, with no exposed config for external modules or
 * copying extra asset files - see resource.ts) inlines all JS into one file
 * and never copies the standalone .wasm file alongside it, so the deployed
 * Lambda throws ENOENT looking for it. Inlining the bytes as a JS string
 * turns the wasm into an ordinary part of the JS bundle, which esbuild
 * handles like any other code - no separate file to lose in transit.
 *
 * Fragile by nature (depends on Prisma's generated file's exact shape) -
 * this is expected to need updating if the generated code changes across a
 * Prisma version bump; the assertion below fails loudly instead of silently
 * doing nothing if the expected pattern isn't found.
 *
 * Run automatically after every `prisma generate` (see package.json's
 * "generate" script) - never run standalone.
 */
const fs = require("fs");
const path = require("path");

const clientDir = path.join(__dirname, "..", "..", "..", "node_modules", ".prisma", "client");
const indexPath = path.join(clientDir, "index.js");
const wasmPath = path.join(clientDir, "query_compiler_bg.wasm");

const ORIGINAL_SNIPPET = `      getQueryCompilerWasmModule: async () => {
        const queryCompilerWasmFilePath = require('path').join(config.dirname, 'query_compiler_bg.wasm')
        const queryCompilerWasmFileBytes = require('fs').readFileSync(queryCompilerWasmFilePath)

        return new WebAssembly.Module(queryCompilerWasmFileBytes)
      }`;

function patch() {
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`patch-prisma-wasm: expected ${wasmPath} to exist - did prisma generate run?`);
  }

  const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");
  const indexSource = fs.readFileSync(indexPath, "utf8");

  if (!indexSource.includes(ORIGINAL_SNIPPET)) {
    if (indexSource.includes("__INLINED_WASM_BASE64__")) {
      console.log("patch-prisma-wasm: already patched, skipping");
      return;
    }
    throw new Error(
      "patch-prisma-wasm: expected code snippet not found in generated client.js - " +
        "Prisma's generated output shape may have changed; update ORIGINAL_SNIPPET in this script."
    );
  }

  const patchedSnippet = `      getQueryCompilerWasmModule: async () => {
        const __INLINED_WASM_BASE64__ = "${wasmBase64}"
        const queryCompilerWasmFileBytes = Buffer.from(__INLINED_WASM_BASE64__, 'base64')

        return new WebAssembly.Module(queryCompilerWasmFileBytes)
      }`;

  fs.writeFileSync(indexPath, indexSource.replace(ORIGINAL_SNIPPET, patchedSnippet));
  console.log(`patch-prisma-wasm: inlined ${(wasmBase64.length / 1024).toFixed(0)}KB of base64 wasm into index.js`);
}

patch();
