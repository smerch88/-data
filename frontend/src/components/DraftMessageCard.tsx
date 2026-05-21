import { useEffect, useRef, useState } from 'react';
import { Mail, Loader2, ChevronsRight, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from './ui/card';
import { Button } from './ui/button';

/**
 * "Чернетка повідомлення" card — the mentor's action layer for the AI draft.
 *
 * Four states, lifted 1:1 from the Figma "Draft message" variants:
 *   default → editing → (Зберегти) → default
 *   default → sending (3 s mock) → sent
 *   default/editing → skipped
 *
 * Everything here is a FRONTEND MOCK: "Відправити в Slack" does not hit the
 * backend — it waits 3 s, flips to the `sent` state and fires a success toast.
 * Wiring a real Slack call is a separate step.
 */

type DraftState = 'default' | 'editing' | 'sending' | 'sent' | 'skipped';

/** Mock send latency — the loading state the designer asked for. */
const SEND_DELAY_MS = 3000;

/** Official Slack brand mark (4-colour octothorpe) — matches the Figma design. */
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 122.8 122.8" className={className} aria-hidden="true">
      <path
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
        fill="#E01E5A"
      />
      <path
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
        fill="#36C5F0"
      />
      <path
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
        fill="#2EB67D"
      />
      <path
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
        fill="#ECB22E"
      />
    </svg>
  );
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function DraftMessageCard({ draftMessage }: { draftMessage: string | null }) {
  const hasDraft = Boolean(draftMessage);
  const [state, setState] = useState<DraftState>('default');
  // The current message body — editable in `editing`, persisted on save.
  const [text, setText] = useState(draftMessage ?? '');
  // Snapshot taken when entering `editing`, restored on "Скасувати".
  const [textBeforeEdit, setTextBeforeEdit] = useState('');
  // Timestamp shown on the `sent` / `skipped` status chips.
  const [stamp, setStamp] = useState('');
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (sendTimer.current) clearTimeout(sendTimer.current);
    },
    [],
  );

  function send() {
    setState('sending');
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(() => {
      setStamp(nowStamp());
      setState('sent');
      toast.success('Повідомлення надіслано в Slack', {
        description: 'Студент отримає його у своєму каналі найближчим часом.',
      });
    }, SEND_DELAY_MS);
  }

  function startEdit() {
    setTextBeforeEdit(text);
    setState('editing');
  }

  function saveEdit() {
    setState('default');
    toast.success('Зміни збережено');
  }

  function cancelEdit() {
    setText(textBeforeEdit);
    setState('default');
  }

  function skip() {
    setStamp(nowStamp());
    setState('skipped');
  }

  /** "Створити нове повідомлення" — mock regenerate: reset to the AI draft. */
  function regenerate() {
    setText(draftMessage ?? '');
    setState('default');
  }

  return (
    <Card>
      <div className="p-8 flex flex-col gap-5">
        {/* Header: title + status chip */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-brand" />
            <h3 className="text-lg font-bold">Чернетка повідомлення</h3>
          </div>
          <StatusChip state={state} stamp={stamp} />
        </div>

        {/* Body */}
        {state === 'editing' ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            className="w-full min-h-[200px] resize-none rounded-card border border-brand-200 bg-neutral-50 p-6 text-[15px] leading-6 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        ) : state === 'skipped' ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-1 rounded-card bg-neutral-50 p-6 text-center">
            <div className="text-lg font-bold">Повідомлення пропущено!</div>
            <p className="text-[15px] leading-6 text-neutral-500">
              Можна повернутися пізніше
              <br />
              та надіслати вручну
            </p>
            <button
              onClick={() => setState('default')}
              className="mt-3 border-t border-neutral-200 px-6 pt-3 text-[15px] font-medium text-ink hover:text-brand"
            >
              Повернутися
            </button>
          </div>
        ) : (
          <div
            className={`whitespace-pre-wrap rounded-card bg-neutral-50 p-6 text-[15px] leading-6 min-h-[200px] ${
              state === 'sent' ? 'text-neutral-400' : 'text-neutral-700'
            }`}
          >
            {hasDraft ? text : 'Повідомлення з’явиться після аналізу.'}
          </div>
        )}

        {/* Actions */}
        {state === 'default' && (
          <>
            <Button className="h-12 w-full text-base" disabled={!hasDraft} onClick={send}>
              Відправити в Slack
            </Button>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="subtle" disabled={!hasDraft} onClick={startEdit}>
                Редагувати
              </Button>
              <Button variant="subtle" disabled={!hasDraft} onClick={skip}>
                Пропустити
              </Button>
            </div>
          </>
        )}

        {state === 'sending' && (
          <>
            <Button className="h-12 w-full text-base" disabled>
              <Loader2 className="size-4 animate-spin" />
              Відправляємо в Slack…
            </Button>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="subtle" disabled>
                Редагувати
              </Button>
              <Button variant="subtle" disabled>
                Пропустити
              </Button>
            </div>
          </>
        )}

        {state === 'editing' && (
          <>
            <Button className="h-12 w-full text-base" onClick={saveEdit}>
              Зберегти зміни
            </Button>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="subtle" onClick={cancelEdit}>
                Скасувати
              </Button>
              <Button variant="subtle" onClick={skip}>
                <ChevronsRight className="size-4 text-brand" />
                Пропустити
              </Button>
            </div>
          </>
        )}

        {state === 'sent' && (
          <>
            <Button
              className="h-12 w-full text-base"
              onClick={() => toast('Відкриваємо Slack…')}
            >
              <SlackIcon className="size-4" />
              Переглянути в Slack
            </Button>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="subtle" onClick={send}>
                <RotateCw className="size-4 text-brand" />
                Повторно відправити
              </Button>
              <Button variant="subtle" onClick={regenerate}>
                Створити нове повідомлення
              </Button>
            </div>
          </>
        )}

        {state === 'skipped' && (
          <Button variant="subtle" className="h-12 w-full text-base" onClick={regenerate}>
            Створити нове повідомлення
          </Button>
        )}
      </div>
    </Card>
  );
}

function StatusChip({ state, stamp }: { state: DraftState; stamp: string }) {
  if (state === 'editing') {
    return (
      <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-500">
        Редагування
      </span>
    );
  }
  if (state === 'sent') {
    return (
      <div className="text-right">
        <div className="text-sm font-bold text-ok">Надіслано</div>
        <div className="text-xs text-neutral-400">{stamp}</div>
      </div>
    );
  }
  if (state === 'skipped') {
    return (
      <div className="text-right">
        <div className="text-sm font-bold text-risk-medium">Пропущено</div>
        <div className="text-xs text-neutral-400">{stamp}</div>
      </div>
    );
  }
  // default + sending
  return <span className="text-sm font-bold text-brand">Згенеровано AI</span>;
}
