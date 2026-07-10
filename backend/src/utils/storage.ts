import * as fs from "fs";
import * as path from "path";

function resolveBackendRoot() {
  const cwd = process.cwd();

  if (
    fs.existsSync(path.join(cwd, "src", "app")) &&
    fs.existsSync(path.join(cwd, "package.json"))
  ) {
    return cwd;
  }

  const nestedBackend = path.join(cwd, "backend");
  if (
    fs.existsSync(path.join(nestedBackend, "src", "app")) &&
    fs.existsSync(path.join(nestedBackend, "package.json"))
  ) {
    return nestedBackend;
  }

  return cwd;
}

export const backendRoot = resolveBackendRoot();
export const publicDir = path.join(backendRoot, "public");
export const uploadsDir = path.join(publicDir, "uploads");

function normalizePublicPath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function resolvePublicFilePath(filePath: string) {
  const normalized = normalizePublicPath(filePath);
  if (!normalized || normalized.split("/").includes("..")) {
    return null;
  }

  const resolvedPublicDir = path.resolve(publicDir);
  const resolvedFilePath = path.resolve(publicDir, normalized);

  if (
    resolvedFilePath !== resolvedPublicDir &&
    !resolvedFilePath.startsWith(`${resolvedPublicDir}${path.sep}`)
  ) {
    return null;
  }

  return resolvedFilePath;
}

export function resolveUploadFilePath(filePath: string) {
  const normalized = normalizePublicPath(filePath);
  if (!normalized.startsWith("uploads/")) {
    return null;
  }

  return resolvePublicFilePath(normalized);
}
