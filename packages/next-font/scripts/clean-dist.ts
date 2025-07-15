import fs from 'node:fs/promises';
import path from 'node:path';

await fs.rm(path.join(import.meta.dirname, 'dist'), { recursive: true, force: true });
