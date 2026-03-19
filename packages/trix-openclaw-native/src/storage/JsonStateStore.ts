import fs from 'node:fs/promises';
import path from 'node:path';
import type { NativeChannelState } from '../types.js';

const DEFAULT_STATE: NativeChannelState = {
  adminToken: '',
  serviceTokens: {},
  pairings: [],
  conversations: [],
  messages: [],
  uploads: [],
  studyRooms: [],
};

export class JsonStateStore {
  private readonly filePath: string;

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
    await fs.rename(tempPath, this.filePath);
  }

  async update(mutator: (state: NativeChannelState) => NativeChannelState | Promise<NativeChannelState>): Promise<NativeChannelState> {
    const state = await this.read();
    const next = await mutator(state);
    await this.write(next);
    return next;
  }
}
