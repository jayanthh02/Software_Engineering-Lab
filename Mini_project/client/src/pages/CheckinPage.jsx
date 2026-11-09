import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';

// SCP-F-013: Club Lead checks tickets in at the venue (POST /api/tickets/checkin).
// Two ways in, as SRS 3.2 says:
//  1. Camera scan, where the browser can read QR codes (BarcodeDetector, on HTTPS
//     or localhost). No extra library is needed.
//  2. Manual entry of the QR text or ticket code. Always available; a USB barcode
//     scanner also works here because it types like a keyboard.
// The server decides Valid / Already used / Invalid / Wrong event; this page only shows it.

const RESULT_STYLE = {
  VALID: { bg: '#d1fae5', fg: '#065f46', title: 'Valid' },
  ALREADY_USED: { bg: '#fef3c7', fg: '#92400e', title: 'Already used' },
  WRONG_EVENT: { bg: '#fee2e2', fg: '#991b1b', title: 'Wrong event' },
  INVALID: { bg: '#fee2e2', fg: '#991b1b', title: 'Invalid' },
  ERROR: { bg: '#fee2e2', fg: '#991b1b', title: 'Error' },
};

const SCAN_EVERY_MS = 400;
const PAUSE_AFTER_SCAN_MS = 2500; // time to read the result before the next scan

function toResult(err) {
  const code = err.response?.data?.error;
  const message = err.response?.data?.message;
  if (code === 'ALREADY_USED') return { kind: 'ALREADY_USED', detail: 'This ticket was scanned before. Do not admit again.' };
  if (code === 'WRONG_EVENT') return { kind: 'WRONG_EVENT', detail: 'This ticket is for an event your club does not run.' };
  if (code === 'INVALID_TICKET') return { kind: 'INVALID', detail: 'Not a real ticket, or the code was mistyped.' };
  return { kind: 'ERROR', detail: message || 'Could not check the ticket. Try again.' };
}

const cameraSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

export default function CheckinPage() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const pausedUntil = useRef(0);
  const busyRef = useRef(false);

  const check = useCallback(async (token) => {
    const value = token.trim();
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let next;
    try {
      const res = await api.post('/tickets/checkin', { token: value });
      next = { kind: 'VALID', detail: `${res.data.studentName} · ${res.data.eventName}` };
    } catch (err) {
      next = toResult(err);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    pausedUntil.current = Date.now() + PAUSE_AFTER_SCAN_MS;
    setResult(next);
    setLog((l) => [{ ...next, at: new Date() }, ...l].slice(0, 10));
    setCode('');
    inputRef.current?.focus();
  }, []);

  // Camera scanning loop.
  useEffect(() => {
    if (!cameraOn) return undefined;
    let stream;
    let timer;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        timer = setInterval(async () => {
          if (Date.now() < pausedUntil.current || busyRef.current || video.readyState < 2) return;
          try {
            const found = await detector.detect(video);
            if (found.length > 0) check(found[0].rawValue);
          } catch {
            // one bad frame; try the next one
          }
        }, SCAN_EVERY_MS);
      } catch {
        setCameraError('Camera not available. Allow camera access, or use manual entry below.');
        setCameraOn(false);
      }
    })();

    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn, check]);

  function submit(e) {
    e.preventDefault();
    check(code);
  }

  const style = result && RESULT_STYLE[result.kind];

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Ticket check-in</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Scan a student&apos;s QR ticket, or type the ticket code. Each ticket works once.
      </p>

      {result && (
        <div role="status" aria-live="assertive" style={{ background: style.bg, color: style.fg, padding: '16px 18px', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {result.kind === 'VALID' ? '✓ ' : '✕ '}
            {style.title}
          </div>
          <div>{result.detail}</div>
        </div>
      )}

      {cameraSupported ? (
        <div style={{ marginBottom: 16 }}>
          <button type="button" onClick={() => { setCameraError(''); setCameraOn((on) => !on); }} style={{ background: cameraOn ? '#66788a' : '#2b6cb0' }}>
            {cameraOn ? 'Stop camera' : 'Scan with camera'}
          </button>
          {cameraOn && (
            <video ref={videoRef} muted playsInline style={{ display: 'block', width: '100%', maxWidth: 420, marginTop: 12, borderRadius: 8, background: '#000' }} />
          )}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Camera scanning is not supported in this browser (works in Chrome on Android, or on HTTPS / localhost). Use manual entry.
        </p>
      )}
      {cameraError && <p className="error">{cameraError}</p>}

      <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="ticket-code" style={{ marginTop: 0 }}>Ticket code or QR text</label>
          <input
            id="ticket-code"
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={300}
            autoComplete="off"
            autoFocus
            placeholder="e.g. 3f2b9c1e-...."
          />
        </div>
        <button type="submit" disabled={busy || code.trim() === ''}>
          {busy ? 'Checking...' : 'Check in'}
        </button>
      </form>

      {log.length > 0 && (
        <>
          <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>Recent scans</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {log.map((r, i) => (
              <li key={`${r.at.getTime()}-${i}`} style={{ padding: '6px 0', borderTop: '1px solid #e4e7eb', fontSize: '0.9rem' }}>
                <strong style={{ color: RESULT_STYLE[r.kind].fg }}>{RESULT_STYLE[r.kind].title}</strong>{' '}
                <span className="muted">{r.at.toLocaleTimeString()}</span> · {r.detail}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
