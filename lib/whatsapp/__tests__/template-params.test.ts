import { describe, it, expect } from 'vitest';
import {
  extractTemplateVariables,
  buildTemplateComponents,
  bodyKey,
  buttonKey,
} from '../template-params';

// Mirrors the real `akash_reviews_utility_v3` template: 4 body vars + 1 url button var
const components = [
  {
    type: 'BODY',
    text:
      'Hello {{1}},\n\nThank you for contacting us. Please find the requested details of your query below:\n\n{{2}}\n\n{{3}}\n\n{{4}}\n\nPlease let us know if you need any further information.',
  },
  {
    type: 'BUTTONS',
    buttons: [
      { url: 'https://wa.kodelyx.in/{{1}}', text: 'WhatsApp Now', type: 'URL' },
      { text: 'Stop Promotions', type: 'QUICK_REPLY' },
    ],
  },
];

describe('extractTemplateVariables', () => {
  it('detects all body vars and the url button var', () => {
    const v = extractTemplateVariables(components as any);
    expect(v.body).toEqual([1, 2, 3, 4]);
    expect(v.header).toEqual([]);
    expect(v.buttons).toEqual([{ index: 0, param: 1 }]);
  });
});

describe('buildTemplateComponents', () => {
  it('builds body(4) + url button(1) when all vars present', () => {
    const vars: Record<string, string> = {
      [bodyKey(1)]: 'Akash',
      [bodyKey(2)]: 'Your order is processed',
      [bodyKey(3)]: 'Item details',
      [bodyKey(4)]: 'Thanks for shopping',
      [buttonKey(0)]: '80d04c',
    };
    const res = buildTemplateComponents(components as any, vars);
    expect(res.error).toBeUndefined();
    const body = res.components!.find((c: any) => c.type === 'body');
    expect(body.parameters).toHaveLength(4);
    expect(body.parameters[0]).toEqual({ type: 'text', text: 'Akash' });
    const btn = res.components!.find((c: any) => c.type === 'button');
    expect(btn).toEqual({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: '80d04c' }],
    });
  });

  it('returns an error (no empty param sent) when a body var is blank', () => {
    const vars: Record<string, string> = {
      [bodyKey(1)]: 'Akash',
      [bodyKey(2)]: '',
      [buttonKey(0)]: '80d04c',
    };
    const res = buildTemplateComponents(components as any, vars);
    expect(res.components).toBeUndefined();
    expect(res.error).toMatch(/\{\{2\}\}/);
  });

  it('returns an error when the button var is missing', () => {
    const vars: Record<string, string> = {
      [bodyKey(1)]: 'a',
      [bodyKey(2)]: 'b',
      [bodyKey(3)]: 'c',
      [bodyKey(4)]: 'd',
    };
    const res = buildTemplateComponents(components as any, vars);
    expect(res.error).toMatch(/button/i);
  });
});
