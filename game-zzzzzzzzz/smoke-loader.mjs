import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const root = path.dirname(fileURLToPath(import.meta.url));
const vendorThree = pathToFileURL(path.join(root, "vendor/three.module.js")).href;
const vendorAddons = pathToFileURL(path.join(root, "vendor/addons/")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "three") {
    return { shortCircuit: true, url: vendorThree };
  }
  if (specifier.startsWith("three/addons/")) {
    const rest = specifier.slice("three/addons/".length);
    return { shortCircuit: true, url: vendorAddons + rest };
  }
  return nextResolve(specifier, context);
}
