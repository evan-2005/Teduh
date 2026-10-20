import { useCallback, useEffect, useState } from 'react';
import { requestStatus, type StatusResult } from './client';
import { describeStatus } from './statusText';

/** Says whether the AI can run on this laptop and, if not, the exact step that fixes it. */
export function AiStatusCard() {
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setStatus(await requestStatus());
    setChecking(false);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  if (!status) {
    return (
      <p className="ai-status ai-status--checking" role="status">
        Checking the AI…
      </p>
    );
  }
  const text = describeStatus(status);
  return (
    <section className={`ai-status ai-status--${text.tone}`} role="status" aria-label="AI status">
      <p className="ai-status__title">{text.title}</p>
      {text.detail && <p className="ai-status__detail">{text.detail}</p>}
      {text.fix && <p className="ai-status__fix">{text.fix}</p>}
      {text.tone !== 'ok' && (
        <button type="button" className="link-button" onClick={check} disabled={checking}>
          {checking ? 'Checking…' : 'Check again'}
        </button>
      )}
    </section>
  );
}
