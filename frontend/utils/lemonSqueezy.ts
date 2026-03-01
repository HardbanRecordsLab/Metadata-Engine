
// utils/lemonSqueezy.ts

/**
 * INSTRUKCJA DLA WŁAŚCICIELA:
 * Linki zostały zaktualizowane zgodnie z Twoim sklepem HardbanRecords Lab.
 */

const PRODUCT_LINKS: Record<string, string> = {
    hobby:  'https://hardbanrecordslab-apps.lemonsqueezy.com/buy/aa97e1d4-c45a-4558-a736-b9da2235024b', // Hobby Plan ($19)
    basic:  'https://hardbanrecordslab-apps.lemonsqueezy.com/buy/094921dc-83b7-423e-9a3c-4e241b41c3e', // Basic Plan ($35)
    pro:    'https://hardbanrecordslab-apps.lemonsqueezy.com/buy/b83a6fc1-d6ce-4c38-b4a5-1adc991d246b',   // Pro Plan ($70)
    studio: 'https://hardbanrecordslab-apps.lemonsqueezy.com/buy/4c6feff6-a472-4dc2-a2f7-f13b02f23068'  // Studio Plan ($100)
};

export const getCheckoutUrl = (tier: string, userId: string, email: string): string | null => {
    const baseUrl = PRODUCT_LINKS[tier];
    
    if (!baseUrl) {
        console.warn(`Checkout link for ${tier} is not configured.`);
        return null;
    }

    // Append custom data to identify the user in the webhook
    // This allows us to know WHO paid when the webhook hits our server
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}checkout[custom][user_id]=${userId}&checkout[email]=${email}`;
};
