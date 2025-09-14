import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}', 
    'scripts/**/*.ts',
    'worker/**/*.ts',
    'server/**/*.ts',
    'utils/**/*.ts',
    'db/**/*.ts',
    'terraform/**/*.ts'
  ],
  project: [
    'app/**/*.{ts,tsx,js,jsx}',
    'components/**/*.{ts,tsx,js,jsx}',
    'scripts/**/*.{ts,tsx,js,jsx}',
    'worker/**/*.{ts,tsx,js,jsx}',
    'server/**/*.{ts,tsx,js,jsx}',
    'utils/**/*.{ts,tsx,js,jsx}',
    'db/**/*.{ts,tsx,js,jsx}',
    'terraform/**/*.{ts,tsx,js,jsx}',
    '!**/*.test.{ts,tsx,js,jsx}',
    '!**/*.spec.{ts,tsx,js,jsx}',
    '!eslint-rules/**/*.js',
    '!drizzle.config.ts',
    '!next.config.ts',
    '!tailwind.config.ts',
    '!vitest.config.ts',
    '!knip.config.ts'
  ],
  include: ['exports'],
  ignoreDependencies: [
  ]
};

export default config;
