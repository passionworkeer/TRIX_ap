import { fetchWithTimeout } from './http.js';

export async function probeTrix(account: { accountId: string; serviceUrl: string; serviceToken?: string | null }) {
  const response = await fetchWithTimeout(
    `${account.serviceUrl.replace(/\/$/, '')}/api/service/probe?accountId=${encodeURIComponent(account.accountId)}`,
    {
      headers: {
        authorization: `Bearer ${account.serviceToken ?? ''}`,
      },
    },
    8_000,
  );

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  return await response.json();
}
