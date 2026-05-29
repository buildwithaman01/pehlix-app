import { Suspense } from 'react';
import VerifyClient from './VerifyClient';

export const metadata = {
  title: 'Verify Report — Pehlix',
  description: 'Verify the authenticity of a Pehlix diagnostic lab report.',
  robots: { index: false },
};

export default function VerifyPage({ params }) {
  return (
    <Suspense fallback={<VerifyLoading />}>
      <VerifyClient id={params.id} />
    </Suspense>
  );
}

function VerifyLoading() {
  return (
    <div className="verify-shell">
      <div className="verify-card">
        <div className="verify-spinner" />
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>Verifying report…</p>
      </div>
    </div>
  );
}
