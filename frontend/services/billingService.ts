import { getFullUrl } from '../apiConfig';

export type CreditPackId = 'starter' | 'producer' | 'label' | 'studio';

export interface CreditPackInfo {
  id: CreditPackId;
  name: string;
  credits: number;
  price_usd: number;
  description: string;
  popular?: boolean;
  available?: boolean;
}

const billingUrl = (path: string) => getFullUrl(`/billing${path}`);

export async function fetchCreditPacks(): Promise<CreditPackInfo[]> {
  const res = await fetch(billingUrl('/packs'));
  if (!res.ok) {
    throw new Error('Could not load credit packs');
  }
  const data = await res.json();
  return data.packs ?? [];
}

export interface CreditPurchaseRecord {
  id: string;
  pack_id: string | null;
  credits_added: number;
  amount_total: number | null;
  currency: string | null;
  created_at: string | null;
}

export async function fetchPurchaseHistory(accessToken: string): Promise<CreditPurchaseRecord[]> {
  const res = await fetch(billingUrl('/history'), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('Could not load purchase history');
  }
  const data = await res.json();
  return data.purchases ?? [];
}

export async function createCheckoutSession(
  packId: CreditPackId,
  accessToken: string
): Promise<string> {
  const res = await fetch(billingUrl('/checkout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ pack_id: packId }),
  });

  const text = await res.text();
  let data: { detail?: string; checkout_url?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || 'Checkout failed');
  }

  if (!res.ok) {
    throw new Error(data.detail || 'Checkout failed');
  }

  if (!data.checkout_url) {
    throw new Error('No checkout URL returned');
  }

  return data.checkout_url;
}
