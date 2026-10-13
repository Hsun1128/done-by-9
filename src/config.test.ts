import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from './config';

describe('parseConfig', () => {
  it('uses documented defaults when nothing is set', () => {
    expect(parseConfig({})).toEqual({
      siteUrl: 'http://localhost:5173',
      analyticsUrl: undefined,
      ctaUrl: undefined,
    });
  });

  it('treats empty strings from .env as unset', () => {
    const config = parseConfig({ VITE_SITE_URL: '', VITE_ANALYTICS_URL: '', VITE_CTA_URL: '' });
    expect(config.siteUrl).toBe('http://localhost:5173');
    expect(config.analyticsUrl).toBeUndefined();
    expect(config.ctaUrl).toBeUndefined();
  });

  it('accepts valid URLs', () => {
    const config = parseConfig({
      VITE_SITE_URL: 'https://done-by-nine.example',
      VITE_ANALYTICS_URL: 'https://events.example/collect',
      VITE_CTA_URL: 'https://forms.example/routine-chart',
    });
    expect(config.siteUrl).toBe('https://done-by-nine.example');
    expect(config.analyticsUrl).toBe('https://events.example/collect');
    expect(config.ctaUrl).toBe('https://forms.example/routine-chart');
  });

  it('fails loudly and names the offending variable', () => {
    expect(() => parseConfig({ VITE_CTA_URL: 'not a url' })).toThrow(ConfigError);
    expect(() => parseConfig({ VITE_CTA_URL: 'not a url' })).toThrow(/VITE_CTA_URL/);
  });
});
