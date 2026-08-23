import React from 'react';

/**
 * Parses a plain text string and replaces email addresses (such as support@creativebydrshakil.com)
 * with accessible, clickable <a href="mailto:..."> links.
 */
export function renderTextWithEmailLinks(text: string | null | undefined): React.ReactNode {
  if (!text) return null;

  // Match email addresses
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const parts = text.split(emailRegex);

  return parts.map((part, index) => {
    if (emailRegex.test(part)) {
      return (
        <a
          key={index}
          href={`mailto:${part}`}
          style={{
            color: 'inherit',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            fontWeight: 600,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
