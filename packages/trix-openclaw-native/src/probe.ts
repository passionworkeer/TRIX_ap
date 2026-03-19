export async function probeTrix(account: { accountId: string; serviceUrl: string; serviceToken?: string | null }) {
  const response = await fetch(
    `${account.serviceUrl.replace(/\/$/, '')}/api/service/probe?accountId=${encodeURIComponent(account.accountId)}`,
    {
      headers: {
        authorization: `Bearer ${account.serviceToken ?? ''}`,
      },
    },
  );

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  return await response.json();
}

