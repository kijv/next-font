import { xxh3 } from '@node-rs/xxhash'

export interface DeterministicHasher {
  writeBytes(bytes: Uint8Array): void
  finish(): bigint
}

export interface DeterministicHash {
  deterministicHash(hasher: DeterministicHasher): void
}

export class Xxh3Hash64Hasher implements DeterministicHasher {
  private chunks: Uint8Array[] = []

  private static readonly SEED = BigInt(0)

  constructor() {}

  writeBytes(bytes: Uint8Array): void {
    this.chunks.push(bytes)
  }

  finish(): bigint {
    const combined = concat(this.chunks)
    return xxh3.xxh64(combined, Xxh3Hash64Hasher.SEED)
  }

  writeValue(input: DeterministicHash): void {
    input.deterministicHash(this)
  }

  writeRef(input: DeterministicHash): void {
    input.deterministicHash(this)
  }
}

export function hashXxh3Hash64(input: DeterministicHash): bigint {
  const hasher = new Xxh3Hash64Hasher()
  input.deterministicHash(hasher)
  return hasher.finish()
}

export class HashableBytes implements DeterministicHash {
  constructor(private readonly bytes: Uint8Array) {}

  deterministicHash(hasher: DeterministicHasher): void {
    hasher.writeBytes(this.bytes)
  }
}

export class HashableString implements DeterministicHash {
  private static readonly encoder = new TextEncoder()

  constructor(private readonly value: string) {}

  deterministicHash(hasher: DeterministicHasher): void {
    hasher.writeBytes(HashableString.encoder.encode(this.value))
  }
}

export class HashableU64 implements DeterministicHash {
  constructor(private readonly value: bigint) {}

  deterministicHash(hasher: DeterministicHasher): void {
    const buf = new ArrayBuffer(8)
    new DataView(buf).setBigUint64(0, this.value, /* littleEndian */ true)
    hasher.writeBytes(new Uint8Array(buf))
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) return new Uint8Array(0)
  if (chunks.length === 1) return chunks[0]!

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
