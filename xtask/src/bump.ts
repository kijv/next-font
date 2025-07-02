import { execSync } from "node:child_process";
import * as path from "node:path";
import * as inquirer from "@inquirer/prompts";
import { detect } from "package-manager-detector/detect";
import * as semver from "semver";

const pm = await detect({
  cwd: path.join(import.meta.dirname, "../../"),
});
if (!pm) throw new Error("Unable to detect package manager");

export const VERSION_TYPE = [
  "major",
  "minor",
  "patch",
  "alpha",
  "beta",
  "canary",
] as const;

export type VersionType = (typeof VERSION_TYPE)[number];

interface Workspace {
  name: string;
  path: string;
}

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  path: string;
  alias?: string;
}

export const isVersionType = (
  versionType: string
): versionType is VersionType => {
  return VERSION_TYPE.includes(versionType as VersionType);
};

export async function runBump(
  names: Set<string>,
  versionType?: VersionType,
  dryRun?: boolean
): Promise<void> {
  // 1. List workspaces
  let workspacesListText: string;
  let workspaces: Workspace[];
  if (pm?.name === "bun") {
    try {
      const ls = execSync("bun pm ls").toString();
      const root = ls.split(" ")[0]!;
      const lockfile = (await import(
        path.join(root, "bun.lock")
      )) as Bun.BunLockFile;

      workspaces = Object.entries(lockfile.workspaces).map(
        ([workspace, pkg]) => {
          return {
            name: pkg.name!,
            path: path.join(root, workspace),
          };
        }
      );
    } catch {
      throw new Error("Unable to parse workspaces list");
    }
  } else if (pm?.name === "pnpm") {
    try {
      workspacesListText = execSync(`pnpm ls -r --depth -1 --json`).toString();
    } catch {
      throw new Error("List workspaces failed");
    }
    try {
      console.log(workspacesListText);
      workspaces = JSON.parse(workspacesListText.trim());
    } catch {
      throw new Error("Unable to parse workspaces list");
    }
  } else {
    throw new Error("Unsupported package manager");
  }

  // 2. Read package.json for each workspace
  const workspacePkgs: PackageJson[] = [];
  for (const workspace of workspaces) {
    try {
      const pkgJsonPath = path.join(workspace.path, "package.json");
      const pkgJson = (await import(pkgJsonPath).then(
        (mod) => mod.default || mod
      )) as PackageJson;
      if (!workspace.name || pkgJson.private) continue;
      pkgJson.path = workspace.path;
      workspacePkgs.push(pkgJson);
    } catch (e) {
      console.log(e);
      throw new Error("Read workspace package.json failed");
    }
  }

  // 3. Filter workspaces to bump
  let workspacesToBump = workspacePkgs.filter((p) => names.has(p.name));
  if (workspacesToBump.length === 0) {
    // Prompt user to select packages
    const choices = workspacePkgs.map((pkg) => ({
      name: `${pkg.name}, current version is ${pkg.version || "unknown"}`,
      value: pkg.name,
    }));
    const selected = await inquirer.checkbox({
      message: "Select a package to bump",
      choices,
    });
    workspacesToBump = workspacePkgs.filter((pkg) =>
      selected.includes(pkg.name)
    );
  }

  // 4. Bump versions
  const tagsToApply: string[] = [];
  for (const pkg of workspacesToBump) {
    let vt: VersionType = versionType!;
    if (!vt) {
      const type = await inquirer.rawlist({
        message: `Version for ${pkg.name}`,
        choices: VERSION_TYPE.map((type) => ({
          name: type,
          value: type,
        })),
      });
      vt = type;
    }
    const semverVersion = semver.parse(pkg.version || "0.0.0");
    if (!semverVersion) {
      throw new Error(
        `Failed to parse ${pkg.version} in ${pkg.name} as semver`
      );
    }

    switch (vt) {
      case "major":
        semverVersion.inc("major");
        semverVersion.minor = 0;
        semverVersion.patch = 0;
        semverVersion.prerelease = [];
        break;
      case "minor":
        semverVersion.inc("minor");
        semverVersion.patch = 0;
        semverVersion.prerelease = [];
        break;
      case "patch":
        semverVersion.inc("patch");
        semverVersion.prerelease = [];
        break;
      case "alpha":
      case "beta":
      case "canary":
        if (semverVersion.prerelease.length === 0) {
          semverVersion.inc("patch");
          semverVersion.prerelease = [vt, 0];
        } else {
          let [prereleaseType, prereleaseVersion] = semverVersion.prerelease;
          prereleaseVersion = Number(prereleaseVersion);
          if (prereleaseType === vt) {
            semverVersion.prerelease = [vt, prereleaseVersion + 1];
          } else {
            // e.g. bump from 1.0.0-beta.12 to 1.0.0-canary.0
            const order: Record<string, number> = {
              alpha: 0,
              beta: 1,
              canary: 2,
            };
            if (order[vt] > order[prereleaseType as string]) {
              semverVersion.prerelease = [vt, 0];
            } else {
              throw new Error(
                `Previous version is ${prereleaseType}, so you can't bump to ${vt}`
              );
            }
          }
        }
        break;
      default:
        throw new Error("Unknown version type");
    }

    const semverVersionString = semverVersion.format();
    const versionCommandArgs = [semverVersionString];
    const cmd = `vc ${versionCommandArgs.join(" ")}`;
    if (!dryRun) {
      execSync(cmd, { cwd: pkg.path });
    } else {
      console.log(`[dry-run] ${cmd} (cwd: ${pkg.path})`);
    }
    tagsToApply.push(`${pkg.alias || pkg.name}@${semverVersionString}`);
  }

  // 5. Update lockfile, git add, commit, tag
  if (!dryRun) {
    execSync(`${pm!.name} install`, { stdio: "inherit" });
    execSync("git add .", { stdio: "inherit" });
  } else {
    console.log("[dry-run] pnpm install");
    console.log("[dry-run] git add .");
  }

  const tagsMessage = tagsToApply.map((s) => `- ${s}`).join("\n");
  const commitMsg = [
    `chore: release npm package${tagsToApply.length > 1 ? "s" : ""}`,
    tagsMessage,
  ];
  if (!dryRun) {
    execSync(`git commit -m "${commitMsg[0]}" -m "${commitMsg[1]}"`, {
      stdio: "inherit",
    });
  } else {
    console.log(
      `[dry-run] git commit -m "${commitMsg[0]}" -m "${commitMsg[1]}"`
    );
  }

  for (const tag of tagsToApply) {
    const tagCmd = `git tag ${tag} -m "${tag}"`;
    if (!dryRun) {
      execSync(tagCmd, { stdio: "inherit" });
    } else {
      console.log(`[dry-run] ${tagCmd}`);
    }
  }
}
