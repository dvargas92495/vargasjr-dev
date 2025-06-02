export const InboxTypes = ["FORM", "EMAIL", "SMS", "SLACK", "CHAT_SESSION", "NONE"] as const;
export const InboxMessageOperationTypes = ["READ", "ARCHIVED"] as const;

export function getBaseUrl(): string {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
    (process.env.NODE_ENV === 'production' ? 'https://vargasjr.dev' : 'http://localhost:3000');
}
