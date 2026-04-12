import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { appBuilderPath } from "app-builder-bin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourceSvg = path.join(repoRoot, "assets", "logo-source.svg");
const rendererPng = path.join(repoRoot, "hormus.png");
const linuxPng = path.join(repoRoot, "build", "icon.png");
const macIcns = path.join(repoRoot, "build", "icon.icns");
const winIco = path.join(repoRoot, "build", "icon.ico");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function exportPng(outPath, width, height) {
  await run("rsvg-convert", ["--width", String(width), "--height", String(height), sourceSvg, "--output", outPath]);
}

async function buildPlatformIcon(format, inputPath, outDir) {
  await run(appBuilderPath, ["icon", "--format", format, "--input", inputPath, "--out", outDir]);
}

async function buildAll() {
  await exportPng(rendererPng, 228, 246);
  await exportPng(linuxPng, 512, 512);

  const tempDir = await mkdtemp(path.join(tmpdir(), "hormus-platform-icons-"));
  try {
    await mkdir(tempDir, { recursive: true });
    const source1024 = path.join(tempDir, "source-1024.png");
    await exportPng(source1024, 1024, 1024);
    await buildPlatformIcon("icns", source1024, tempDir);
    await buildPlatformIcon("ico", source1024, tempDir);
    await copyFile(path.join(tempDir, "icon.icns"), macIcns);
    await copyFile(path.join(tempDir, "icon.ico"), winIco);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

await buildAll();
