import { applyTrixAccountConfig } from './account.js';

export const trixSetupAdapter = {
  resolveAccountId: ({ accountId }: { accountId?: string }) => accountId ?? 'default',
  applyAccountConfig: ({ cfg, accountId, input }: {
    cfg: Record<string, unknown>;
    accountId: string;
    input: Record<string, unknown>;
  }) => applyTrixAccountConfig({ cfg, accountId, input }),
};

