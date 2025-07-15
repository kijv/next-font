import { parse } from 'shell-quote'

interface CommandOptions {
  currentDir?: string
  dryRun?: boolean
  errorMessage?: string
  quiet?: boolean
}

export const createCommand = (bin: string) => {
  const options: CommandOptions = {}

  const commandFunctions = {
    async execute() {
      const cmd = prepareCommand(bin, options)
      if (!cmd) return

      try {
        await cmd
      } catch (error) {
        if (options.errorMessage) {
          throw new Error(options.errorMessage)
        }
        throw error
      }
    },
    async outputString() {
      const cmd = prepareCommand(
        bin,
        Object.assign({}, options, {
          quiet: options.quiet ?? true,
        })
      )
      if (!cmd) return ''

      let output: Bun.$.ShellOutput

      try {
        output = await cmd
      } catch (error) {
        if (options.errorMessage) {
          throw new Error(options.errorMessage)
        }
        throw error
      }

      try {
        return output.text('utf-8')
      } catch {
        throw Error('Stdout contains non UTF-8 characters')
      }
    },
  }

  const optionModifiers = Object.fromEntries(
    (['currentDir', 'dryRun', 'errorMessage', 'quiet'] as const).map((key) => [
      key,
      function (this: typeof command, value?: (typeof options)[typeof key]) {
        ;(options as Record<typeof key, typeof value>)[key] = value
        return this
      },
    ])
  ) as {
    [K in Required<keyof typeof options>]: (value?: (typeof options)[K]) => typeof command
  }

  const command = Object.assign({}, commandFunctions, optionModifiers)

  return new Proxy(command, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as keyof typeof target]
      }
      return undefined
    },
  })
}

const prepareCommand = (command: string, { currentDir, dryRun, quiet }: CommandOptions = {}) => {
  const cmd = Bun.$`${parse(command)}`

  if (currentDir) {
    cmd.cwd(currentDir)
  }

  if (quiet) {
    cmd.quiet()
  }

  if (dryRun) {
    console.log(command)
    return
  }

  return cmd
}
