import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

type EditMode = 'beautify-selfie' | 'enhance-photo';

type CliOptions = {
  input: string;
  output: string;
  mode: EditMode;
};

const DEFAULT_OUTPUT_DIR = path.resolve(process.env.HOME ?? '', '.openclaw', 'media', 'outbound');

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current?.startsWith('--')) {
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(current, 'true');
      continue;
    }
    args.set(current, next);
    index += 1;
  }

  const input = args.get('--input')?.trim();
  if (!input) {
    throw new Error('Missing --input');
  }

  const output = args.get('--output')?.trim() || path.join(DEFAULT_OUTPUT_DIR, `edited-${Date.now()}.jpg`);
  const modeArg = (args.get('--mode')?.trim() || 'beautify-selfie') as EditMode;
  const mode: EditMode = modeArg === 'enhance-photo' ? 'enhance-photo' : 'beautify-selfie';

  return {
    input: path.resolve(input),
    output: path.resolve(output),
    mode,
  };
}

function resolveFfmpegBinary(): string {
  return process.env.TRIX_NATIVE_FFMPEG_BIN?.trim() || '/Users/jiajingqiu/.local/bin/ffmpeg';
}

function resolveFilter(mode: EditMode): string {
  if (mode === 'enhance-photo') {
    return 'eq=brightness=0.01:contrast=1.03:saturation=1.05,unsharp=5:5:0.55:5:5:0.0';
  }
  return 'hqdn3d=1.2:1.2:6:6,eq=brightness=0.018:contrast=1.04:saturation=1.07,unsharp=5:5:0.4:5:5:0.0';
}

function resolveOutputArgs(outputPath: string): string[] {
  const extension = path.extname(outputPath).toLowerCase();
  if (extension === '.png') {
    return ['-compression_level', '4'];
  }
  if (extension === '.webp') {
    return ['-quality', '92'];
  }
  return ['-q:v', '2'];
}

async function assertReadableFile(filePath: string): Promise<void> {
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw new Error(`Input is not a file: ${filePath}`);
  }
}

async function runFfmpeg(params: CliOptions): Promise<void> {
  const ffmpeg = resolveFfmpegBinary();
  await assertReadableFile(params.input);
  await fs.mkdir(path.dirname(params.output), { recursive: true });

  const args = [
    '-y',
    '-loglevel',
    'error',
    '-i',
    params.input,
    '-frames:v',
    '1',
    '-vf',
    resolveFilter(params.mode),
    ...resolveOutputArgs(params.output),
    params.output,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await runFfmpeg(options);
  process.stdout.write(JSON.stringify({
    ok: true,
    input: options.input,
    output: options.output,
    mode: options.mode,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message);
  process.exit(1);
});
