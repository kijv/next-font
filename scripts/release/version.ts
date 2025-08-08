import { existsSync } from 'node:fs'
import { join } from 'node:path'

// NOTE: This type may change over time.
type ChangesetStatusJson = {
  changesets: {
    releases: {
      name: string
      type: string
      summary: string
      id: string
    }[]
  }[]
  releases: {
    name: string
    type: string
    oldVersion: string
    changesets: string[]
    newVersion: string
  }[]
}

async function versionPackages() {
  const preConfigPath = join(process.cwd(), '.changeset', 'pre.json')

  // Exit previous pre mode to prepare for the next release.
  if (existsSync(preConfigPath)) {
    if (require(preConfigPath).mode !== 'exit') {
      // Since current repository is in pre mode, need
      // to exit before versioning the packages.
      await Bun.$`bun run changeset pre exit`
    }
  }

  // For prereleases, we need to set the "mode" on `pre.json`, which
  // can be done by running `changeset pre enter <mode>`.
  const releaseType = process.env.RELEASE_TYPE
  switch (releaseType) {
    case 'canary': {
      // Enter pre mode as "canary" tag.
      await Bun.$`bun run changeset pre enter canary`

      console.log('▲   Preparing to bump the canary version, checking if there are any changesets.')

      // Create an empty changeset for `next` to bump the canary version
      // even if there are no changesets for `next`.
      await Bun.$`bun run changeset status --output ./changeset-status.json`

      let anyHasChangeset = false
      const changesetStatusFile = Bun.file('./changeset-status.json')
      if (await changesetStatusFile.exists()) {
        const changesetStatus: ChangesetStatusJson = JSON.parse(await changesetStatusFile.text())

        console.log('▲   Changeset Status:')
        console.log(changesetStatus)

        anyHasChangeset = changesetStatus.releases.length > 0;

        await changesetStatusFile.unlink()
      }

      if (!anyHasChangeset) {
        throw new Error('No changesets found, cannot bump canary version.')
      }
      break
    }
    case 'release-candidate': {
      // Enter pre mode as "rc" tag.
      await Bun.$`bun run changeset pre enter rc`
      break
    }
    case 'stable': {
      // No additional steps needed for 'stable' releases since we've already
      // exited any pre-release mode. Only need to run `changeset version` after.
      break
    }
    default: {
      throw new Error(`Invalid release type: ${releaseType}`)
    }
  }

  await Bun.$`bun run changeset version`;
  // TODO: Update the pnpm-lock.yaml since the packages' depend on
  // each other. Remove this once they use `workspace:` protocol.
  await Bun.$`bun install --frozen-lockfile`;
}

versionPackages()
