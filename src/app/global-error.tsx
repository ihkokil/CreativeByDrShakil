'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#0a0a0a',
          color: '#ffffff',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          Something went wrong
        </h1>
        <p style={{ color: '#888', marginBottom: '1.5rem', maxWidth: '400px' }}>
          {error?.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: '#fff',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            marginBottom: '1rem',
          }}
        >
          Try Again
        </button>
        <button
          onClick={() => (window.location.href = '/')}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: 'transparent',
            color: '#888',
            border: '1px solid #333',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Go Home
        </button>
      </body>
    </html>
  );
}
