'use client';

import { useEffect, useState } from 'react';
import './verify.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function VerifyClient({ id }) {
  const [state, setState] = useState('loading'); // loading | verified | failed | error | captcha
  const [data, setData] = useState(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchVerification = (token = null) => {
    setState('loading');
    setErrorMessage('');
    
    const headers = {};
    if (token) {
      headers['x-captcha-token'] = token;
    }
    
    fetch(`${API_BASE}/api/reports/verify/${id}`, { headers })
      .then(async r => {
        const res = await r.json();
        if (r.ok) {
          if (res?.data?.verified) {
            setState('verified');
            setData(res.data);
            setCaptchaRequired(false);
          } else {
            setState('failed');
          }
        } else {
          const errCode = res?.error?.code;
          if (errCode === 'CAPTCHA_REQUIRED') {
            setCaptchaRequired(true);
            setState('captcha');
          } else if (errCode === 'CAPTCHA_FAILED') {
            setErrorMessage('CAPTCHA verification failed. Please try again.');
            setState('captcha');
          } else {
            setErrorMessage(res?.error?.message || 'Verification failed');
            setState('error');
          }
        }
      })
      .catch(() => {
        setState('error');
      });
  };

  useEffect(() => {
    if (!id) return;
    fetchVerification();
  }, [id]);

  // Load Cloudflare Turnstile script dynamically when CAPTCHA is required
  useEffect(() => {
    if (captchaRequired) {
      const scriptId = 'cloudflare-turnstile-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      }
    }
  }, [captchaRequired]);

  // Explicitly render Turnstile widget when script is ready and state is 'captcha'
  useEffect(() => {
    let widgetId = null;
    let isMounted = true;
    
    const initTurnstile = () => {
      if (state === 'captcha' && window.turnstile && isMounted) {
        try {
          widgetId = window.turnstile.render('#turnstile-container', {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
            callback: function(token) {
              if (isMounted) {
                fetchVerification(token);
              }
            },
            'error-callback': function() {
              if (isMounted) {
                setErrorMessage('Error loading CAPTCHA. Please try reloading.');
              }
            }
          });
        } catch (err) {
          console.error('Turnstile render error:', err);
        }
      }
    };

    if (state === 'captcha') {
      if (window.turnstile) {
        initTurnstile();
      } else {
        const interval = setInterval(() => {
          if (window.turnstile) {
            clearInterval(interval);
            initTurnstile();
          }
        }, 500);
        return () => {
          clearInterval(interval);
          isMounted = false;
          if (widgetId && window.turnstile) {
            try {
              window.turnstile.remove(widgetId);
            } catch (e) {}
          }
        };
      }
    }

    return () => {
      isMounted = false;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch (e) {}
      }
    };
  }, [state]);

  return (
    <div className="verify-shell">
      <div className="verify-card">
        {/* Header */}
        <div className="verify-header">
          <div className="verify-logo">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#0F3D3E"/>
              <path d="M10 20 L18 28 L30 14" stroke="#5FB3A5" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="verify-brand">Pehlix</span>
          </div>
          <p className="verify-subtitle">Diagnostic Report Verification</p>
        </div>

        {/* Loading */}
        {state === 'loading' && (
          <div className="verify-status-block">
            <div className="verify-spinner" />
            <p className="verify-status-text">Checking report authenticity…</p>
          </div>
        )}

        {/* Captcha Gate */}
        {state === 'captcha' && (
          <div className="verify-captcha-block">
            <h3 className="verify-captcha-title">Verification Required</h3>
            <p className="verify-captcha-text">
              To protect patient records against automated scraping, please complete the quick check below.
            </p>
            <div id="turnstile-container" className="verify-captcha-container" />
            {errorMessage && (
              <div className="verify-captcha-error">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Verified */}
        {state === 'verified' && data && (
          <>
            <div className="verify-badge verified">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="#16a34a" opacity="0.12"/>
                <path d="M5 12.5L9.5 17L19 8" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Report Verified</span>
            </div>

            <div className="verify-info-grid">
              <InfoRow label="Patient" value={data.patientName} />
              <InfoRow label="Laboratory" value={data.labName} />
              <InfoRow
                label="Tests Performed"
                value={Array.isArray(data.tests) && data.tests.length > 0
                  ? data.tests.join(', ')
                  : 'Not specified'}
              />
              <InfoRow
                label="Approved By"
                value={data.pathologistName || 'Authorized Pathologist'}
              />
              <InfoRow
                label="Approved On"
                value={data.approvedAt
                  ? new Date(data.approvedAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })
                  : '—'}
              />
            </div>

            <div className="verify-notice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#5FB3A5" strokeWidth="1.8"/>
                <path d="M12 8v4M12 16h.01" stroke="#5FB3A5" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              This report was digitally issued by <strong>{data.labName}</strong> through
              the Pehlix Lab Management Platform and has been verified as authentic.
            </div>
          </>
        )}

        {/* Not Found */}
        {state === 'failed' && (
          <>
            <div className="verify-badge failed">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="#dc2626" opacity="0.1"/>
                <path d="M8 8L16 16M16 8L8 16" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
              <span>Report Not Found</span>
            </div>
            <p className="verify-desc">
              We could not find a report matching this QR code. It may have been deleted,
              or the QR code might be invalid.
            </p>
            <p className="verify-desc">
              If you believe this is an error, contact the laboratory that issued this report.
            </p>
          </>
        )}

        {/* Network Error */}
        {state === 'error' && (
          <>
            <div className="verify-badge failed">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="#d97706" opacity="0.12"/>
                <path d="M12 8v4M12 16h.01" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Verification Unavailable</span>
            </div>
            <p className="verify-desc">
              {errorMessage || 'Could not reach the verification server. Please check your internet connection and try again.'}
            </p>
            <button className="verify-retry" onClick={() => fetchVerification()}>
              Try Again
            </button>
          </>
        )}

        {/* Footer */}
        <div className="verify-footer">
          <a href="https://pehlix.in" className="verify-footer-link">
            pehlix.in
          </a>
          <span className="verify-footer-sep">·</span>
          <span>Powered by Pehlix — Intelligent Lab Management</span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="verify-row">
      <span className="verify-row-label">{label}</span>
      <span className="verify-row-value">{value}</span>
    </div>
  );
}
