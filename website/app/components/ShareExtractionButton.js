'use client';

import { useState } from 'react';

const SITE = 'https://designlang.app';

export default function ShareExtractionButton({ url, hash, summary, files }) {
  const [done, setDone] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  const permalink = hash ? `${SITE}/x/${hash}` : `${SITE}/#extract`;
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'a website'; } })();
  const tokens = summary?.colors ?? '?';
  const grade = summary?.score?.grade || '—';
  const text = `extracted ${host} with designlang — ${tokens} tokens, grade ${grade}`;

  // Find the AGENT.md content if it's in the streamed files map.
  const agentBody = files ? Object.entries(files).find(([n]) => n.endsWith('-AGENT.md'))?.[1] : null;
  const pdfUrl = hash ? `/api/pdf/${hash}` : null;

  function tweet() {
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(permalink)}`;
    window.open(intent, '_blank', 'noopener,noreferrer');
    setDone('tweet'); setTimeout(() => setDone(null), 1500);
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(permalink); setDone('copy'); setTimeout(() => setDone(null), 1500); } catch { /* noop */ }
  }

  async function copyAgent() {
    if (!agentBody) return;
    try { await navigator.clipboard.writeText(agentBody); setDone('agent'); setTimeout(() => setDone(null), 1800); } catch { /* noop */ }
  }

  // Fetch the PDF and only save it if the server actually returned a PDF.
  // A bare <a download> saves whatever comes back — including a JSON/HTML
  // error body — as host-brand.pdf, which then "won't open". Validate first.
  async function downloadPdf() {
    if (!pdfUrl || pdfBusy) return;
    setPdfBusy(true); setPdfError(null);
    try {
      const res = await fetch(pdfUrl);
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.includes('application/pdf')) {
        let msg = `PDF unavailable (${res.status})`;
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* not json */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${host}-brand.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e) {
      setPdfError(e?.message || 'Download failed');
      setTimeout(() => setPdfError(null), 4000);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="share-row">
      {pdfUrl && (
        <button type="button" onClick={downloadPdf} disabled={pdfBusy} className="btn btn-primary btn-sm">
          {pdfBusy ? 'Rendering PDF…' : pdfError ? pdfError : 'Download brand PDF'}
        </button>
      )}
      {agentBody && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyAgent}>
          {done === 'agent' ? `Copied ${(agentBody.length / 1024).toFixed(1)}KB!` : 'Copy agent prompt'}
        </button>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={tweet}>
        {done === 'tweet' ? 'opened…' : 'Share on X'}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>
        {done === 'copy' ? 'copied!' : 'Copy link'}
      </button>
    </div>
  );
}
