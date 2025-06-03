export function getBaseUrl(): string {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
    (process.env.NODE_ENV === 'production' ? 'https://vargasjr.dev' : 'http://localhost:3000');
}

export function getEnvironmentPrefix(): string {
  if (process.env.VERCEL_URL && process.env.VERCEL_URL.includes('preview')) {
    return 'PREVIEW';
  }
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
    return '';
  }
  return 'DEV';
}
