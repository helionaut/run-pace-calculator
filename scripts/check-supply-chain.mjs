import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(repoRoot, "package.json");
const lockfilePath = path.join(repoRoot, "package-lock.json");
const npmConfigPath = path.join(repoRoot, ".npmrc");

export const MINIMUM_RELEASE_AGE_DAYS = 7;

export async function checkSupplyChainPolicy({
  packageJsonPath = packagePath,
  packageLockPath = lockfilePath,
  npmrcPath = npmConfigPath
} = {}) {
  const [packageText, lockfileText, npmrcText] = await Promise.all([
    readFile(packageJsonPath, "utf8"),
    readFile(packageLockPath, "utf8"),
    readFile(npmrcPath, "utf8")
  ]);
  const packageJson = JSON.parse(packageText);
  const lockfile = JSON.parse(lockfileText);
  const policy = packageJson.supplyChain;
  const dependencySections = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies"
  ];
  const declaredDependencies = dependencySections.flatMap((section) =>
    Object.keys(packageJson[section] ?? {}).map((name) => `${section}:${name}`)
  );
  const npmConfig = Object.fromEntries(
    npmrcText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return separator < 1
          ? [line, ""]
          : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      })
  );

  if (npmConfig["min-release-age"] !== String(MINIMUM_RELEASE_AGE_DAYS)) {
    throw new Error(`.npmrc must set min-release-age=${MINIMUM_RELEASE_AGE_DAYS}.`);
  }

  if (policy?.minimumPackageReleaseAgeDays !== MINIMUM_RELEASE_AGE_DAYS) {
    throw new Error(
      `package.json must enforce a ${MINIMUM_RELEASE_AGE_DAYS}-day minimum package release age.`
    );
  }

  if (policy?.modelTurnDependencyInstallation !== "forbidden") {
    throw new Error("Dependency installation during model turns must remain forbidden.");
  }

  if (lockfile.lockfileVersion !== 3 || lockfile.packages?.[""]?.name !== packageJson.name) {
    throw new Error("package-lock.json must remain a version 3 lockfile for this package.");
  }

  if (declaredDependencies.length > 0 || Object.keys(lockfile.packages ?? {}).length > 1) {
    throw new Error(
      "This zero-dependency project rejects external packages; review release age before adding any."
    );
  }

  return {
    declaredDependencies,
    minimumReleaseAgeDays: policy.minimumPackageReleaseAgeDays,
    npmMinimumReleaseAgeDays: Number(npmConfig["min-release-age"])
  };
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const result = await checkSupplyChainPolicy();

  console.log(
    `Supply-chain policy passed: zero external packages, ${result.minimumReleaseAgeDays}-day minimum age.`
  );
}
