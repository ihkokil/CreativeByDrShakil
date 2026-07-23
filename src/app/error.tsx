'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h2 style={{ marginBottom: '1rem' }}>Something went wrong</h2>
      <p style={{ color: '#888', marginBottom: '1.5rem' }}>
        {error?.message || 'An unexpected error occurred.'}
      </p>
      <button onClick={reset}>Try Again</button>
    </div>
  );
}
