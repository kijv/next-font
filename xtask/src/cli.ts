#!/usr/bin/env bun

import { cac } from 'cac'
import { isVersionType, publishWorkspace, runBump, VERSION_TYPE } from './workspace'

const cli = cac('xtask')

cli
  .command('workspace [...NAMES]', 'Manage packages in workspace')
  .option('--publish', 'publish npm packages in workspace')
  .option('--bump', 'bump new version for npm package in workspace')
  .option('--semver <VERSION_TYPE>', 'semver increment')
  .option('--dry-run', 'dry run all operations')
  // .option('[NAMES]', "the package to bump",)
  .action(
    async (
      names: string[],
      opts: {
        bump?: boolean
        semver?: string
        dryRun?: boolean
        publish?: boolean
      }
    ) => {
      if (opts.bump) {
        if (opts.semver != null && !isVersionType(opts.semver)) {
          console.error(`--semver must be one of ${VERSION_TYPE.join(', ')}`)
          return
        }
        try {
          await runBump(new Set(names), opts.semver, opts.dryRun)
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error))
        }
      } else if (opts.publish) {
        try {
          await publishWorkspace(false, opts.dryRun)
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error))
        }
      }
    }
  )

cli.help()
cli.parse()

if (!cli.matchedCommand) cli.outputHelp()
