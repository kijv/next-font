import * as path from 'node:path';
import * as inquirer from '@inquirer/prompts';
import { detect } from 'package-manager-detector/detect';
import * as semver from 'semver';
import { createCommand } from './command';
import { getNightlyVersion } from './utils';

const workspaceRoot = path.join(import.meta.dirname, '../../');
const pm = await detect({
  cwd: workspaceRoot,
});
if (!pm) throw new Error('Unable to detect package manager');

export const VERSION_TYPE = [
  'major',
  'minor',
  'patch',
  'alpha',
  'beta',
  'canary',
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
  versionType: string,
): versionType is VersionType => {
  return VERSION_TYPE.includes(versionType as VersionType);
};

export async function runBump(
  names: Set<string>,
  versionType?: VersionType,
  dryRun?: boolean,
) {
  // 1. List workspaces
  const workspaces = await getWorkspaces();

  // 2. Read package.json for each workspace
  const workspacePkgs: PackageJson[] = [];
  for (const workspace of workspaces) {
    try {
      const pkgJsonPath = path.join(workspace.path, 'package.json');
      const pkgJson = (await import(pkgJsonPath).then(
        (mod) => mod.default || mod,
      )) as PackageJson;
      if (!workspace.name || pkgJson.private) continue;
      pkgJson.path = workspace.path;
      workspacePkgs.push(pkgJson);
    } catch (e) {
      console.log(e);
      throw new Error('Read workspace package.json failed');
    }
  }

  // 3. Filter workspaces to bump
  let workspacesToBump = workspacePkgs.filter((p) => names.has(p.name));
  if (workspacesToBump.length === 0) {
    // Prompt user to select packages
    const choices = workspacePkgs.map((pkg) => ({
      name: `${pkg.name}, current version is ${pkg.version || 'unknown'}`,
      value: pkg.name,
    }));
    const selected = await inquirer.checkbox({
      message: 'Select a package to bump',
      choices,
    });
    workspacesToBump = workspacePkgs.filter((pkg) =>
      selected.includes(pkg.name),
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
    const semverVersion = semver.parse(pkg.version || '0.0.0');
    if (!semverVersion) {
      throw new Error(
        `Failed to parse ${pkg.version} in ${pkg.name} as semver`,
      );
    }

    switch (vt) {
      case 'major':
        semverVersion.inc('major');
        semverVersion.minor = 0;
        semverVersion.patch = 0;
        semverVersion.prerelease = [];
        break;
      case 'minor':
        semverVersion.inc('minor');
        semverVersion.patch = 0;
        semverVersion.prerelease = [];
        break;
      case 'patch':
        semverVersion.inc('patch');
        semverVersion.prerelease = [];
        break;
      case 'alpha':
      case 'beta':
      case 'canary':
        if (semverVersion.prerelease.length === 0) {
          semverVersion.inc('patch');
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
            if (
              order[vt] != null &&
              order[prereleaseType as string] != null &&
              order[vt]! > order[prereleaseType as string]!
            ) {
              semverVersion.prerelease = [vt, 0];
            } else {
              throw new Error(
                `Previous version is ${prereleaseType}, so you can't bump to ${vt}`,
              );
            }
          }
        }
        break;
      default:
        throw new Error('Unknown version type');
    }

    const semverVersionString = semverVersion.format();
    const versionCommandArgs = [semverVersionString];
    await createCommand(`vc ${versionCommandArgs.join(' ')}`)
      .currentDir(pkg.path)
      .dryRun(dryRun)
      .execute();
    tagsToApply.push(`${pkg.alias || pkg.name}@${semverVersionString}`);
  }

  // 5. Update lockfile, git add, commit, tag
  await createCommand(`pnpm install`).dryRun(dryRun).execute();
  await createCommand(`git add .`).dryRun(dryRun).execute();

  const tagsMessage = tagsToApply.map((s) => `- ${s}`).join('\n');
  const commitMsg = [
    `chore: release npm package${tagsToApply.length > 1 ? 's' : ''}`,
    tagsMessage,
  ];
  await createCommand(`git commit -m "${commitMsg[0]}" -m "${commitMsg[1]}"`)
    .dryRun(dryRun)
    .execute();

  for await (const tag of tagsToApply) {
    await createCommand(`git tag ${tag} -m "${tag}"`).dryRun(dryRun).execute();
  }
}

export async function publishWorkspace(isNightly?: boolean, dryRun?: boolean) {
  {
    const commitMessage = await createCommand('git log -1 --pretty=%B')
      .dryRun(dryRun)
      .errorMessage('Get commit hash failed')
      .outputString();
  }
  const commitMessage = `chore: release npm package

  - next-font@1.0.1`;

  const tags = commitMessage
    .trim()
    .split('\n')
    // Skip commit title
    .slice(1)
    .filter(Boolean)
    .map((s) => s.trim().replace(/^-\s*/, '').trim())
    .map((m) => {
      const scope = /^@.+\//.exec(m)?.[0];
      const withoutScope = scope ? m.replace(new RegExp(`^${scope}`), '') : m;
      const fullTag = withoutScope.split('@');
      const pkgNameWithoutScope = fullTag[0];
      const version = isNightly
        ? getNightlyVersion(`${scope || ''}${pkgNameWithoutScope}`)
        : fullTag[1];
      return { pkgNameWithoutScope, scope, version };
    });

  const workspaces = tags.length > 0 ? await getWorkspaces() : [];

  for (const { pkgNameWithoutScope, scope, version } of tags) {
    const pkgName = `${scope || ''}${pkgNameWithoutScope}`;
    const semverVersion = semver.parse(version);
    if (!semverVersion)
      throw new Error(`Parse semver version failed ${version}`);

    const workspace = workspaces.find((w) => w.name === pkgName);
    if (!workspace) throw new Error(`Workspace not found for ${pkgName}`);

    const isAlpha = semverVersion.prerelease.some((p) =>
      p.toString().includes('alpha'),
    );
    const isBeta = semverVersion.prerelease.some((p) =>
      p.toString().includes('beta'),
    );
    const isCanary = semverVersion.prerelease.some((p) =>
      p.toString().includes('canary'),
    );

    const tag = isNightly
      ? 'nightly'
      : isAlpha
        ? 'alpha'
        : isBeta
          ? 'beta'
          : isCanary
            ? 'canary'
            : 'latest';

    createCommand(
      `cp ${path.join(workspaceRoot, 'LICENSE')} ${path.join(
        workspace.path,
        'LICENSE',
      )}`,
    )
      .dryRun(dryRun)
      .execute();

    const args = ['publish', '--tag', tag, dryRun ? '--dry-run' : ''];

    createCommand(`bun ${args.join(' ')}`)
      .currentDir(path.relative(workspaceRoot, workspace.path))
      .execute();
  }
}

const getWorkspaces = async () => {
  let workspacesListText: string;
  let workspaces: Workspace[];
  if (pm?.name === 'bun') {
    try {
      const ls = await createCommand('bun pm ls').outputString();
      const root = ls.split(' ')[0]!;
      const lockfile = (await import(
        path.join(root, 'bun.lock')
      )) as Bun.BunLockFile;

      workspaces = Object.entries(lockfile.workspaces).map(
        ([workspace, pkg]) => {
          return {
            name: pkg.name!,
            path: path.join(root, workspace),
          };
        },
      );
    } catch {
      throw new Error('Unable to parse workspaces list');
    }
  } else if (pm?.name === 'pnpm') {
    try {
      workspacesListText = await createCommand(
        `pnpm ls -r --depth -1 --json`,
      ).outputString();
    } catch {
      throw new Error('List workspaces failed');
    }
    try {
      workspaces = JSON.parse(workspacesListText.trim());
    } catch {
      throw new Error('Unable to parse workspaces list');
    }
  } else {
    throw new Error('Unsupported package manager');
  }

  return workspaces;
};
