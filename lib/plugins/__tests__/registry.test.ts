import { describe, it, expect } from 'vitest';
import { isPluginInstalled, getInstalledPlugins } from '../registry';

describe('Plugin Registry', () => {
  it('should detect installed plugins', () => {
    expect(isPluginInstalled('ai-chat')).toBe(true);
    expect(isPluginInstalled('meta-cloud')).toBe(true);
  });

  it('should return false for unknown or disabled plugin IDs', () => {
    expect(isPluginInstalled('voice-call')).toBe(false);
    expect(isPluginInstalled('unknown-plugin')).toBe(false);
    expect(isPluginInstalled('')).toBe(false);
  });

  it('should list all installed plugins', () => {
    const plugins = getInstalledPlugins();
    expect(plugins).toContain('ai-chat');
    expect(plugins).toContain('meta-cloud');
    expect(plugins).toHaveLength(2);
  });
});
