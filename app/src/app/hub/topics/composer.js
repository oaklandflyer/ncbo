'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createPost } from './actions';

export default function Composer({ slug }) {
  const [state, action, pending] = useActionState(createPost, {});
  const [body, setBody] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.ok) { setBody(''); formRef.current?.reset(); }
  }, [state]);

  return (
    <form className="composer" action={action} ref={formRef}>
      <input type="hidden" name="slug" value={slug} />
      <label htmlFor="body">Post to this channel</label>
      <textarea
        id="body" name="body" maxLength={240} value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share something short…"
      />
      <div className="composer-bar">
        <span className="muted" style={{ fontSize: '0.82rem' }}>{240 - body.length} left</span>
        <label className="checkline" style={{ margin: 0, textTransform: 'none', letterSpacing: 0 }}>
          <input type="checkbox" name="anonymous" />
          <span>Post anonymously</span>
        </label>
        <button className="btn btn-primary btn-sm" type="submit" disabled={pending || !body.trim()}>
          {pending ? 'Posting…' : 'Post'}
        </button>
      </div>
      {state?.error && <p className="msg err">{state.error}</p>}
    </form>
  );
}
