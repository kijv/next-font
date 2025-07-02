#!/usr/bin/env bun

import { cac } from "cac";
import { isVersionType, runBump, VERSION_TYPE } from "./bump";

const cli = cac("xtask");

cli
  .command("workspace [...NAMES]", "Manage packages in workspace")
  .option("--bump", "bump new version for packages in workspace")
  .option("--semver <VERSION_TYPE>", "semver increment")
  .option("--dry-run", "dry run all operations")
  // .option('[NAMES]', "the package to bump",)
  .action(
    async (
      names: string[],
      opts: {
        bump?: boolean;
        semver?: string;
        dryRun?: boolean;
      }
    ) => {
      if (opts.bump) {
        if (!opts.semver) {
          console.error("--semver is required");
          return;
        } else if (!isVersionType(opts.semver)) {
          console.error(`--semver must be one of ${VERSION_TYPE.join(", ")}`);
          return;
        }
        try {
          await runBump(new Set(names), opts.semver, opts.dryRun);
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error));
        }
      }
    }
  );

cli.help();
cli.parse();

if (!cli.matchedCommand) cli.outputHelp();
