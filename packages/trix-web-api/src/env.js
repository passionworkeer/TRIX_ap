import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, '../.env.local'),
  path.resolve(here, '../.env'),
  path.resolve(here, '../../../.env.local'),
  path.resolve(here, '../../../.env'),
];

for (const envFile of candidates) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false, quiet: true });
  }
}
