// https://github.com/vercel/next.js/blob/34d0bcb94234db1615662cc77a5204f3a6d22cb5/scripts/automated-update-workflow.js
import { Octokit } from 'octokit'
import { exec as execOriginal } from 'node:child_process'
import { promisify } from 'node:util'

/* oxlint-disable no-console */

const exec = promisify(execOriginal)

const {
  GITHUB_TOKEN = '',
  SCRIPT = '',
  BRANCH_NAME = 'unknown',
  PR_TITLE = 'Automated update',
  PR_BODY = '',
} = process.env

if (!GITHUB_TOKEN) {
  console.log('missing GITHUB_TOKEN env')
  process.exit(1)
}
if (!SCRIPT) {
  console.log('missing SCRIPT env')
  process.exit(1)
}

async function main() {
  const octokit = new Octokit({ auth: GITHUB_TOKEN })
  const branchName = `update/${BRANCH_NAME}-${Date.now()}`

  await exec(`node ${SCRIPT}`)

  await exec(`git config user.name "github-actions[bot]"`)
  await exec(
    `git config user.email "github-actions[bot]@users.noreply.github.com"`
  )
  await exec(`git checkout -b ${branchName}`)
  await exec(`git add -A`)
  await exec(`git commit --message ${branchName}`)

  const changesResult = await exec(`git diff HEAD~ --name-only`)
  const changedFiles = changesResult.stdout
    .split('\n')
    .filter((line) => line.trim())

  if (changedFiles.length === 0) {
    console.log('No files changed skipping.')
    return
  }

  await exec(`git push origin ${branchName}`)

  const repo = 'next-font'
  const owner = 'kijv'

  const { data: pullRequests } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    sort: 'created',
    direction: 'desc',
    per_page: 100,
  })

  const pullRequest = await octokit.rest.pulls.create({
    owner,
    repo,
    head: branchName,
    base: 'main',
    title: PR_TITLE,
    body: PR_BODY,
  })

  console.log('Created pull request', pullRequest.url)

  const previousPullRequests = pullRequests.filter(({ title, user }) => {
    return title.includes(PR_TITLE) && user.login === 'jujutsu-bot'
  })

  if (previousPullRequests.length) {
    await Promise.all(
      previousPullRequests.map(async (previousPullRequest) => {
        console.log(
          `Closing previous pull request: ${previousPullRequest.html_url}`
        )

        await octokit.rest.pulls.update({
          owner,
          repo,
          pull_number: previousPullRequest.number,
          state: 'closed',
        })
      })
    )
  }
}

main().catch((err) => {
  console.error(err)
  // Ensure the process exists with a non-zero exit code so that the workflow fails
  process.exit(1)
})
