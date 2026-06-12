'use client';
import React from 'react';

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  example?: { header_handle?: string[]; body_text?: string[][] };
}

export function WhatsAppPreview({ template, data, variables, headerType, headerText, bodyText, footerText, buttons: inlineButtons, mediaPreviewUrl }: {
  template?: any;
  data?: TemplateComponent[];
  variables?: Record<string, string>;
  headerType?: string;
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  mediaPreviewUrl?: string;
}) {
  let components: TemplateComponent[] = data || template?.components || [];

  // Build components from inline props (create template form)
  if (components.length === 0 && (headerType || bodyText || footerText || inlineButtons)) {
    const built: TemplateComponent[] = [];
    if (headerType && headerType !== 'NONE') {
      built.push({ type: 'HEADER', format: headerType, text: headerType === 'TEXT' ? headerText : undefined });
    }
    if (bodyText) built.push({ type: 'BODY', text: bodyText });
    if (footerText) built.push({ type: 'FOOTER', text: footerText });
    if (inlineButtons && inlineButtons.length > 0) {
      built.push({ type: 'BUTTONS', buttons: inlineButtons });
    }
    components = built;
  }

  if (!components || components.length === 0) {
    return (
      <div className="bg-[#e5ddd5] rounded-lg p-4 min-h-[200px] flex items-center justify-center">
        <div className="bg-white rounded-lg p-3 max-w-[280px] shadow-sm">
          <p className="text-sm text-muted-foreground">No template components found.</p>
        </div>
      </div>
    );
  }

  const header = components.find(c => c.type === 'HEADER');
  const body = components.find(c => c.type === 'BODY');
  const footer = components.find(c => c.type === 'FOOTER');
  const buttons = components.find(c => c.type === 'BUTTONS');

  const replaceVars = (text: string) => {
    if (!text) return '';
    return text.replace(/\{\{(\d+)\}\}/g, (match, num) => {
      if (variables && variables[num]) return variables[num];
      return `{{${num}}}`;
    });
  };

  return (
    <div className="bg-[#e5ddd5] rounded-2xl p-5 min-h-[200px] flex items-center justify-center">
      <div className="bg-white rounded-xl max-w-[300px] w-full shadow-lg overflow-hidden">
        {/* Header */}
        {header && (
          <div>
            {header.format === 'IMAGE' && (
              <div className="overflow-hidden">
                {(mediaPreviewUrl || header.example?.header_handle?.[0]) ? (
                  <img
                    src={mediaPreviewUrl || header.example?.header_handle?.[0]}
                    alt="Header"
                    className="w-full h-auto"
                    onError={(e) => {
                      const el = (e.target as HTMLImageElement);
                      el.parentElement!.innerHTML = '<div style="width:100%;height:150px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#dbeafe,#bfdbfe)"><svg width="40" height="40" fill="none" stroke="#93c5fd" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>';
                    }}
                  />
                ) : (
                  <div className="w-full h-[150px] bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                    <svg className="h-10 w-10 text-blue-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
            )}
            {header.format === 'VIDEO' && (
              <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg h-36 flex items-center justify-center mx-3 mt-2 mb-1">
                <svg className="h-10 w-10 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {header.format === 'DOCUMENT' && (
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 flex items-center gap-2 mx-3 mt-2 mb-1">
                <svg className="h-8 w-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                </svg>
                <span className="text-xs text-muted-foreground">Document</span>
              </div>
            )}
            {header.format === 'TEXT' && header.text && (
              <p className="font-bold text-sm text-gray-900 px-3 pt-2">{replaceVars(header.text)}</p>
            )}
          </div>
        )}

        {/* Body */}
        {body && body.text && (
          <div className="px-3 py-1.5">
            <p className="text-[13px] text-gray-900 whitespace-pre-wrap leading-relaxed">
              {replaceVars(body.text)}
            </p>
          </div>
        )}

        {/* Footer */}
        {footer && footer.text && (
          <div className="px-3 pb-1">
            <p className="text-[11px] text-muted-foreground">{footer.text}</p>
          </div>
        )}

        {/* Timestamp */}
        <div className="flex justify-end px-3 pb-1">
          <span className="text-[10px] text-muted-foreground/60">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Buttons */}
        {buttons && buttons.buttons && buttons.buttons.length > 0 && (
          <div className="border-t border-gray-200">
            {buttons.buttons.map((btn, i) => (
              <div key={i} className={`flex items-center justify-center py-2 text-[13px] font-medium text-blue-500 ${i > 0 ? 'border-t border-gray-200' : ''}`}>
                {btn.type === 'URL' && (
                  <svg className="h-3.5 w-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
                {btn.type === 'PHONE_NUMBER' && (
                  <svg className="h-3.5 w-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                )}
                {btn.type === 'QUICK_REPLY' && (
                  <svg className="h-3.5 w-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                )}
                {btn.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
