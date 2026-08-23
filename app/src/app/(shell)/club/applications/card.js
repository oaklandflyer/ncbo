'use client';

import { useActionState, useState } from 'react';
import { decideApplication, askApplicant } from './actions';
import {
  Card, Badge, Meta, field, fieldLabel, btnPrimary, btnGhost, btnDanger,
  btnSmall, buttonReset, fineprint, FormMessage,
} from '@/app/ui';

/**
 * One application, with every field from signup on one card.
 *
 * All of it, in one place, on purpose: a lead deciding whether they recognise
 * somebody should not have to open a second screen, and a decision made
 * without the group-chat handle in front of you is a coin toss with extra
 * steps.
 */
export default function ApplicationCard({ application, clubId }) {
  const [decision, decide, deciding] = useActionState(decideApplication, {});
  const [question, ask, asking] = useActionState(askApplicant, {});
  const [showAsk, setShowAsk] = useState(false);

  const a = application;
  const waited = Math.floor(Number(a.hours_waiting) || 0);

  /* Decided: the card collapses to its outcome rather than disappearing, so a
     lead who has just clicked can see what they did. */
  if (decision.ok) {
    return (
      <Card className="p-5">
        <p className="text-[0.95rem] text-body">
          <b className="font-semibold text-ink">{a.legal_name || a.display_name}</b>. {decision.ok}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[1.1rem] font-bold uppercase tracking-[0.02em] text-ink">
            {a.legal_name || a.display_name || 'No name given'}
          </p>
          {a.preferred_name && (
            <Meta className="mt-1">Goes by {a.preferred_name}</Meta>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {a.vouch_count > 0 && (
            <Badge tone="active">
              {a.vouch_count} vouch{a.vouch_count === 1 ? '' : 'es'}
            </Badge>
          )}
          {a.claimed_lead && (
            <Badge tone="pending">Says they run this chapter</Badge>
          )}
          {a.escalation_level > 0 && (
            <Badge tone="forming">
              {a.escalation_level === 2 ? 'With Club Relations' : 'Escalated'}
            </Badge>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-edge pt-4 sm:grid-cols-2">
        <Fact label="Expected graduation" value={a.grad_year} />
        <Fact
          label="Group chat"
          value={a.group_chat_handle
            ? `${a.group_chat_handle}${a.group_chat_platform ? ` on ${a.group_chat_platform}` : ''}`
            : null}
          emphasis
        />
        <Fact label="Found the club via" value={a.found_via} />
        <Fact label="Referred by" value={a.referred_by_name} />
        <Fact
          label="Waiting"
          value={waited < 24 ? `${waited} hour${waited === 1 ? '' : 's'}` : `${Math.floor(waited / 24)} days`}
        />
      </dl>

      {a.student_id_photo_path && (
        <p className={`mt-3 ${fineprint}`}>
          A student ID photo was uploaded. Open it from the storage bucket to check it.
        </p>
      )}

      {/* 0032 records the claim at signup and nothing showed it until now.
          It matters most at a chapter whose lead has never been appointed:
          there, the only person who can act on this queue is an admin, and
          approving grants membership, never leadership — an admin appoints a
          lead from the roster afterwards. */}
      {a.claimed_lead && (
        <p className={`mt-4 rounded-[6px] bg-band px-4 py-3 ${fineprint}`}>
          They said they run this chapter. Approving adds them as a member;
          making them the lead is a separate step on the roster, and an admin's.
        </p>
      )}

      {!a.group_chat_handle && !a.referred_by_name && (
        <p className={`mt-4 rounded-[6px] bg-band px-4 py-3 ${fineprint}`}>
          No handle and no referral. If you do not recognise this name, ask before deciding
          rather than guessing.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <form action={decide}>
          <input type="hidden" name="membership_id" value={a.membership_id} />
          <input type="hidden" name="club_id" value={clubId} />
          <input type="hidden" name="decision" value="approve" />
          <button type="submit" disabled={deciding} className={`${btnPrimary} ${btnSmall}`}>
            Approve
          </button>
        </form>

        <form action={decide}>
          <input type="hidden" name="membership_id" value={a.membership_id} />
          <input type="hidden" name="club_id" value={clubId} />
          <input type="hidden" name="decision" value="deny" />
          <button type="submit" disabled={deciding} className={`${btnDanger} ${btnSmall}`}>
            Deny
          </button>
        </form>

        <button
          type="button"
          onClick={() => setShowAsk((v) => !v)}
          className={`${btnGhost} ${btnSmall}`}
        >
          Ask a question
        </button>
      </div>

      {showAsk && (
        <form action={ask} className="mt-4 border-t border-edge pt-4">
          <label className={fieldLabel} htmlFor={`ask-${a.membership_id}`}>
            Your question
          </label>
          <input type="hidden" name="membership_id" value={a.membership_id} />
          <input type="hidden" name="club_id" value={clubId} />
          <textarea
            id={`ask-${a.membership_id}`}
            name="body"
            rows={2}
            maxLength={1000}
            required
            className={field}
            placeholder="Which lift do you usually come to?"
          />
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={asking} className={`${btnPrimary} ${btnSmall}`}>
              {asking ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => setShowAsk(false)}
              className={`${buttonReset} px-2 text-[0.85rem] text-meta hover:text-ink`}
            >
              Cancel
            </button>
          </div>
          <FormMessage error={question.error} ok={question.ok} />
        </form>
      )}

      <FormMessage error={decision.error} />
    </Card>
  );
}

function Fact({ label, value, emphasis = false }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-meta">
        {label}
      </dt>
      <dd className={`mt-1 text-[0.95rem] ${emphasis ? 'font-semibold text-ink' : 'text-body'}`}>
        {value}
      </dd>
    </div>
  );
}
