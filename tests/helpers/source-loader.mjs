import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));
let sequence = 0;

// Exercise the real TypeScript modules without starting a second application
// framework. Each loader owns its source-module cache and explicit public env.
export async function createSourceLoader(options = {}) {
  const identity = String(++sequence);
  const define = {
    "process.env.NEXT_PUBLIC_API_BASE_URL": JSON.stringify("http://localhost:3000"),
    "process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_TMDB_API_KEY": JSON.stringify(""),
    ...options.define,
  };
  const owns = (url) => url?.startsWith("file:") && new URL(url).searchParams.get("umcine-test") === identity;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (!owns(context.parentURL)) return nextResolve(specifier, context);
      if (specifier === "next/link" || specifier === "next/navigation") {
        return nextResolve(`${specifier}.js`, context);
      }
      if (specifier.startsWith(".")) {
        const candidate = fileURLToPath(new URL(specifier, context.parentURL));
        const filename = [candidate, `${candidate}.ts`, `${candidate}.tsx`, resolve(candidate, "index.ts")]
          .find((value) => existsSync(value) && /\.[cm]?[jt]sx?$/.test(value));
        if (filename) {
          const url = pathToFileURL(filename);
          url.searchParams.set("umcine-test", identity);
          return { url: url.href, shortCircuit: true };
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (!owns(url)) return nextLoad(url, context);
      const filename = fileURLToPath(url);
      const result = transformSync(readFileSync(filename, "utf8"), {
        loader: extname(filename) === ".tsx" ? "tsx" : "ts",
        format: "esm", target: "es2022", jsx: "automatic", define,
        sourcefile: filename, sourcemap: "inline",
      });
      return { source: result.code, format: "module", shortCircuit: true };
    },
  });
  return {
    async load(filename) {
      const url = pathToFileURL(resolve(root, filename.replace(/^\//, "")));
      url.searchParams.set("umcine-test", identity);
      return import(url.href);
    },
    async close() { hooks.deregister(); },
  };
}
