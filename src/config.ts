import { z } from 'zod';

/** Treats empty strings (the `.env.example` default) as "not set". */
const emptyAsUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

const optionalUrl = z.preprocess(emptyAsUndefined, z.url().optional());

const EnvSchema = z.object({
  VITE_SITE_URL: z.preprocess(
    emptyAsUndefined,
    z.url().default('http://localhost:5173'),
  ),
  VITE_ANALYTICS_URL: optionalUrl,
  VITE_CTA_URL: optionalUrl,
});

export interface AppConfig {
  /** Public URL of the game, used in share text and on the share card. */
  readonly siteUrl: string;
  /** Anonymous event endpoint. `undefined` disables analytics entirely. */
  readonly analyticsUrl: string | undefined;
  /** Where the routine-chart call to action leads. `undefined` records the click locally only. */
  readonly ctaUrl: string | undefined;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Validates raw environment values once, at startup. Throws `ConfigError` listing every problem. */
export function parseConfig(raw: Readonly<Record<string, unknown>>): AppConfig {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Invalid environment configuration — ${problems}`);
  }
  return {
    siteUrl: result.data.VITE_SITE_URL,
    analyticsUrl: result.data.VITE_ANALYTICS_URL,
    ctaUrl: result.data.VITE_CTA_URL,
  };
}
