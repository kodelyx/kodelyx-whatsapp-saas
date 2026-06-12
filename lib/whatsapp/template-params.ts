// Shared, framework-agnostic helpers for working with WhatsApp Cloud API
// template variables. Pure TS (no db / no server-only imports) so it can be
// imported from both client components and API routes.

export type TemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text?: string; url?: string }>;
  example?: { header_handle?: string[]; body_text?: string[][] };
};

export type DetectedVariables = {
  // body placeholder numbers, e.g. [1,2,3,4]
  body: number[];
  // header (TEXT) placeholder numbers, e.g. [1]
  header: number[];
  // url buttons that contain a {{n}} placeholder, with their button index
  buttons: Array<{ index: number; param: number }>;
};

// Canonical variable keys used everywhere:
//   body var n    -> "<n>"            (e.g. "1", "2")
//   header var n  -> "header_<n>"     (e.g. "header_1")
//   button idx i  -> "button_<i>"     (e.g. "button_0")
export const bodyKey = (n: number) => `${n}`;
export const headerKey = (n: number) => `header_${n}`;
export const buttonKey = (index: number) => `button_${index}`;

const PLACEHOLDER = /\{\{(\d+)\}\}/g;

function placeholderNumbers(text?: string): number[] {
  if (!text) return [];
  const nums: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER);
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (!nums.includes(n)) nums.push(n);
  }
  return nums.sort((a, b) => a - b);
}

export function extractTemplateVariables(
  components: TemplateComponent[] | undefined | null
): DetectedVariables {
  const result: DetectedVariables = { body: [], header: [], buttons: [] };
  if (!Array.isArray(components)) return result;

  for (const comp of components) {
    if (comp.type === 'BODY') {
      result.body = placeholderNumbers(comp.text);
    }
    if (comp.type === 'HEADER' && comp.format === 'TEXT') {
      result.header = placeholderNumbers(comp.text);
    }
    if (comp.type === 'BUTTONS' && Array.isArray(comp.buttons)) {
      comp.buttons.forEach((btn, index) => {
        if (btn.type === 'URL' && btn.url) {
          const nums = placeholderNumbers(btn.url);
          if (nums.length > 0) {
            // URL buttons support a single dynamic suffix variable
            result.buttons.push({ index, param: nums[0] });
          }
        }
      });
    }
  }
  return result;
}

// Returns true if a template needs any variable filled in.
export function hasTemplateVariables(
  components: TemplateComponent[] | undefined | null
): boolean {
  const v = extractTemplateVariables(components);
  return v.body.length > 0 || v.header.length > 0 || v.buttons.length > 0;
}

export type BuildResult =
  | { components: any[]; error?: undefined }
  | { components?: undefined; error: string };

// Build the Meta Cloud API `template.components` payload from the template
// definition + a flat variables map. Returns { error } if any required
// variable is missing/empty so callers can fail the send cleanly instead of
// letting Meta reject it with 131008.
export function buildTemplateComponents(
  components: TemplateComponent[] | undefined | null,
  variables: Record<string, string> | undefined | null
): BuildResult {
  const detected = extractTemplateVariables(components);
  const vars = variables || {};
  const payload: any[] = [];

  const valueFor = (key: string, fallbackIndex: number): string => {
    const direct = vars[key];
    if (direct !== undefined && String(direct).trim() !== '') return String(direct);
    // legacy fallback: positional key from the raw uploaded row
    const keys = Object.keys(vars).filter((k) => k !== 'phone');
    const byPos = vars[keys[fallbackIndex]];
    if (byPos !== undefined && String(byPos).trim() !== '') return String(byPos);
    return '';
  };

  // HEADER (media handle or text variables)
  const headerComp = (components || []).find((c) => c.type === 'HEADER');
  if (headerComp) {
    if (
      headerComp.format === 'IMAGE' ||
      headerComp.format === 'VIDEO' ||
      headerComp.format === 'DOCUMENT'
    ) {
      const handle = headerComp.example?.header_handle?.[0];
      if (handle) {
        const mediaType = headerComp.format.toLowerCase();
        payload.push({
          type: 'header',
          parameters: [{ type: mediaType, [mediaType]: { link: handle } }],
        });
      }
    } else if (headerComp.format === 'TEXT' && detected.header.length > 0) {
      const params: any[] = [];
      for (let i = 0; i < detected.header.length; i++) {
        const n = detected.header[i];
        const val = valueFor(headerKey(n), i);
        if (val === '') return { error: `Missing header variable {{${n}}}` };
        params.push({ type: 'text', text: val });
      }
      payload.push({ type: 'header', parameters: params });
    }
  }

  // BODY
  if (detected.body.length > 0) {
    const params: any[] = [];
    for (let i = 0; i < detected.body.length; i++) {
      const n = detected.body[i];
      const val = valueFor(bodyKey(n), i);
      if (val === '') return { error: `Missing body variable {{${n}}}` };
      params.push({ type: 'text', text: val });
    }
    payload.push({ type: 'body', parameters: params });
  }

  // BUTTONS (dynamic URL suffix)
  for (const b of detected.buttons) {
    const val = vars[buttonKey(b.index)];
    if (val === undefined || String(val).trim() === '') {
      return { error: `Missing button variable for button ${b.index + 1}` };
    }
    payload.push({
      type: 'button',
      sub_type: 'url',
      index: String(b.index),
      parameters: [{ type: 'text', text: String(val) }],
    });
  }

  return { components: payload };
}

// Substitute variables into a template body string for previews / chat history.
export function renderTemplateText(
  text: string | undefined,
  variables: Record<string, string> | undefined | null
): string {
  if (!text) return '';
  const vars = variables || {};
  return text.replace(/\{\{(\d+)\}\}/g, (_m, num: string) => {
    const direct = vars[num];
    if (direct !== undefined && String(direct).trim() !== '') return String(direct);
    const keys = Object.keys(vars).filter((k) => k !== 'phone');
    const byPos = vars[keys[parseInt(num, 10) - 1]];
    if (byPos !== undefined && String(byPos).trim() !== '') return String(byPos);
    return `{{${num}}}`;
  });
}
