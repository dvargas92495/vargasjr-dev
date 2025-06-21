export function getBaseUrl(): string {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
    (process.env.NODE_ENV === 'production' ? 'https://vargasjr.dev' : 'http://localhost:3000');
}

export function getEnvironmentPrefix(): string {
  if (process.env.VERCEL_ENV === 'preview') {
    return 'PREVIEW';
  }
  if (process.env.VERCEL_ENV === 'production') {
    return '';
  }
  return 'DEV';
}
