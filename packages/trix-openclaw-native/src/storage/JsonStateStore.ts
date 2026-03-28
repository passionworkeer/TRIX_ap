import fs from 'node:fs/promises';
import path from 'node:path';
import type { NativeChannelState } from '../types.js';

const DEFAULT_STATE: NativeChannelState = {
  adminToken: '',
  serviceTokens: {},
  attachmentSigningSecret: '',
  pairings: [],
  conversations: [],
  messages: [],
  uploads: [],
  studyRooms: [],
};

export class JsonStateStore {
  private readonly filePath: string;
  private updateQueue: Promise<void> = Promise.resolve();

  constructor(storageDir: string) {
    this.filePath = path.join(storageDir, 'state.json');
  }

  async ensure(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write(DEFAULT_STATE);
    }
  }

  async read(): Promise<NativeChannelState> {
    await this.ensure();
    const raw = await fs.readFile(this.filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<NativeChannelState>;
    return {
      adminToken: parsed.adminToken ?? '',
      serviceTokens: parsed.serviceTokens ?? {},
      attachmentSigningSecret: parsed.attachmentSigningSecret ?? '',
      pairings: parsed.pairings ?? [],
      conversations: parsed.conversations ?? [],
      messages: parsed.messages ?? [],
      uploads: parsed.uploads ?? [],
      studyRooms: parsed.studyRooms ?? [],
    };
  }

  async write(state: NativeChannelState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await this.replaceStateFile(tempPath);
  }

  private async replaceStateFile(tempPath: string): Promise<void> {
    const maxAttempts = 6;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await fs.rename(tempPath, this.filePath);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        const shouldRetry = (code === 'EPERM' || code === 'EACCES') && attempt < maxAttempts;
        if (!shouldRetry) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 25));
      }
    }
  }

  async update(mutator: (state: NativeChannelState) => NativeChannelState | Promise<NativeChannelState>): Promise<NativeChannelState> {
    let nextState: NativeChannelState | undefined;
    const operation = this.updateQueue.then(async () => {
      const state = await this.read();
      nextState = await mutator(state);
      await this.write(nextState);
    });

    this.updateQueue = operation.then(() => undefined, () => undefined);
    await operation;

    if (!nextState) {
      throw new Error('JsonStateStore update did not produce a next state');
    }

    return nextState;
  }
}
