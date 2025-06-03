export function getBaseUrl(): string {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
    (process.env.NODE_ENV === 'production' ? 'https://vargasjr.dev' : 'http://localhost:3000');
}
