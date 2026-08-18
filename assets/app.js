/* ============================================================================
   NCBO — app.js
   The member hub itself: Calendar · Updates · Resources · Q&A · Clubs, one
   scrolling column, no tabs and no side rails.

   This file no longer knows anything about signing in. Supabase decides who
   is signed in and whether their account is approved (assets/ncbo-auth.js);
   this file is handed a member and draws the hub:

       window.NCBOHub.buildHub(member)

   `member` is { id, email, name, role, status, isAdmin, client }. It is called
   once, from ncbo-auth.js, only after the profile row comes back approved —
   so member content is never fetched by a browser that hasn't signed in.

   The markup it fills lives inside <section data-auth-view="approved"> in
   members.html; `#app` is the hub root.
   ========================================================================== */
(function () {
  const DRAFTS = 'ncbo-member-drafts';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const norm = s => String(s || '').trim().toLowerCase();

  /* member-data.js is loaded on demand, at render time — nothing member-only
     is fetched by a browser sitting on the sign-in screen. */
  let memberDataPromise = null;
  function loadMemberData() {
    if (!memberDataPromise) {
      memberDataPromise = window.NCBO_MEMBER
        ? Promise.resolve()
        : new Promise(resolve => {
            const s = document.createElement('script');
            s.src = 'assets/member-data.js';
            s.onload = () => resolve();
            s.onerror = () => resolve();      // hub renders its empty states
            document.head.appendChild(s);
          });
    }
    return memberDataPromise;
  }

  /* ── hub shell ────────────────────────────────────────────────────── */
  let built = false;
  let who = null;

  /* The render hook ncbo-auth.js calls. Idempotent: a session refresh or a
     second auth event must not rebuild the hub underneath someone. */
  function buildHub(member) {
    const app = $('#app');
    if (!app) return;
    who = member || who;
    if (built) return;
    built = true;
    loadMemberData().then(buildApp);
  }

  /* Signing out is ncbo-auth.js's job — it has the Supabase client. The hub
     only asks. */
  function signOut() {
    const btn = $('[data-auth-action="sign-out"]');
    if (btn) { btn.click(); return; }
    location.replace(location.pathname);
  }

  function buildApp() {
    const M = window.NCBO_MEMBER || {};
    const W = M.welcome || {};

    const bar = $('#app-bar');
    if (bar) {
      const stats = (M.stats || []).map(s =>
        `<div class="stat"><span class="stat-num">${esc(s.num)}</span><span class="stat-lab">${esc(s.lab)}</span></div>`).join('');
      /* Greet by name when we have one, and give an admin a visible way
         through to the admin pages rather than a URL they have to remember. */
      const hello = who && who.name
        ? `Welcome back, ${esc(String(who.name).split(/\s+/)[0])}.`
        : esc(W.title || 'Welcome back.');
      const adminLink = (who && who.isAdmin)
        ? `<a class="admin-link" href="review.html?v=2026-08-15">Member review</a>`
        : '';

      bar.innerHTML = `
        <div class="app-bar-inner">
          <div class="app-bar-head">
            <div>
              <p class="eyebrow">${esc(W.eyebrow || 'Season hub')}${who && who.role ? ' · ' + esc(who.role) : ''}</p>
              <h1>${hello}</h1>
              <p class="app-sub">${esc(W.sub || '')}</p>
            </div>
            <div class="app-bar-actions">
              ${adminLink}
              <button class="sign-out" type="button" id="sign-out">Sign out</button>
            </div>
          </div>
          ${stats ? `<div class="stats">${stats}</div>` : ''}
        </div>`;
      $('#sign-out').addEventListener('click', signOut);
    }

    buildCalendar();
    buildUpdates();
    buildResources();
    buildBoard();
    buildDirectory();
  }

  function head(eyebrow, title, sub) {
    return `<div class="panel-head">
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h2>${esc(title)}</h2>
        ${sub ? `<p>${esc(sub)}</p>` : ''}
      </div>`;
  }

  /* ── calendar ─────────────────────────────────────────────────────── */
  function buildCalendar() {
    const M = window.NCBO_MEMBER || {};
    const host = $('#calendar');
    if (!host) return;
    const rows = (M.calendar || []).map(c => `
      <div class="cal-row">
        <div class="cal-date">${esc(c.date)}</div>
        <div class="cal-main">
          <div class="cal-title">${esc(c.title)}</div>
          <div class="cal-where">${esc(c.where)}</div>
        </div>
        <span class="badge ${norm(c.status) === 'confirmed' ? 'active' : 'forming'}">${esc(c.status)}</span>
      </div>`).join('');
    host.innerHTML = `<div class="wrap">
        ${head('Season', 'Calendar.', 'Confirmed dates, in order.')}
        ${rows
          ? `<div class="cal">${rows}</div>`
          : `<p class="m-empty">${esc(M.calendarEmpty || 'Nothing scheduled yet.')}</p>`}
      </div>`;
  }

  /* ── updates ──────────────────────────────────────────────────────── */
  function buildUpdates() {
    const M = window.NCBO_MEMBER || {};
    const host = $('#updates');
    if (!host) return;
    const anns = (M.announcements || []).map(a => `
      <article class="ann">
        <div class="ann-meta"><span class="ann-tag">${esc(a.tag)}</span><span class="ann-date">${esc(a.date)}</span></div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.text)}</p>
      </article>`).join('');
    host.innerHTML = `<div class="wrap">
        ${head('Latest', 'Updates.', 'What changed since you were last here.')}
        ${anns
          ? `<div class="ann-list">${anns}</div>`
          : `<p class="m-empty">No updates yet. We'll post here when something actually changes.</p>`}
      </div>`;
  }

  /* ── resources ────────────────────────────────────────────────────── */
  function buildResources() {
    const M = window.NCBO_MEMBER || {};
    const host = $('#resources');
    if (!host) return;

    const groups = (M.resourceGroups || []).map(g => `
      <section class="res-group">
        <h3>${esc(g.group)}</h3>
        <div class="res-list">
          ${(g.items || []).map(i => {
            /* Nothing is written yet — every one of these links is a stub.
               Render an un-clickable row flagged "In development" rather than
               a link that looks live and goes nowhere. */
            const live = /^https?:/.test(i.href || '');
            const inner = `
              <span class="res-text">
                <span class="res-title">${esc(i.title)}</span>
                <span class="res-sub">${esc(i.text)}</span>
              </span>
              ${live ? '' : '<span class="res-flag">In development</span>'}`;
            return live
              ? `<a class="res-row" href="${esc(i.href)}" target="_blank" rel="noopener">${inner}</a>`
              : `<div class="res-row is-pending">${inner}</div>`;
          }).join('')}
        </div>
      </section>`).join('');

    host.innerHTML = `<div class="wrap">
        ${head('Library', 'Resources.', "What we're writing for members. Nothing here is finished yet.")}
        ${groups}
      </div>`;
  }

  /* ── Q&A board ────────────────────────────────────────────────────── */
  function drafts() {
    try { return JSON.parse(localStorage.getItem(DRAFTS)) || []; }
    catch (e) { return []; }
  }
  function saveDraft(d) {
    const all = drafts();
    all.unshift(d);
    try { localStorage.setItem(DRAFTS, JSON.stringify(all)); } catch (e) { /* private mode */ }
  }

  function buildBoard() {
    const M = window.NCBO_MEMBER || {};
    const host = $('#board');
    if (!host) return;
    const channels = M.channels || [];
    const ask = M.ask || {};
    let current = 'all';

    host.innerHTML = `<div class="wrap">
        ${head('The board', 'Q&A.', 'Ask the exec team. Answers get posted back here for the next person.')}
        <div class="chips" role="tablist" aria-label="Channels">
          <button class="chip" type="button" data-ch="all" aria-pressed="true">All</button>
          ${channels.map(c => `<button class="chip" type="button" data-ch="${esc(c.id)}" aria-pressed="false">${esc(c.name)}</button>`).join('')}
        </div>
        <div class="qa-list" id="qa-list"></div>
        <div class="qa-ask">
          <h3>${esc(ask.title || 'Ask the network')}</h3>
          <p>${esc(ask.text || '')}</p>
          <form id="ask-form">
            <div class="field">
              <label for="ask-ch">Channel</label>
              <select id="ask-ch">
                ${channels.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="ask-q">Your question</label>
              <textarea id="ask-q" placeholder="What do you want to know?"></textarea>
            </div>
            <div class="qa-ask-actions">
              <button class="btn btn-primary" type="submit">Save question</button>
              ${ask.form && ask.form !== '#'
                ? `<a class="btn btn-ghost btn-arrow" href="${esc(ask.form)}" target="_blank" rel="noopener">Send to the panel</a>`
                : ''}
            </div>
            <p class="qa-msg" id="ask-msg" role="status" aria-live="polite"></p>
            <p class="qa-note">${esc(ask.note || '')}</p>
          </form>
        </div>
      </div>`;

    const list = $('#qa-list', host);
    const nameOf = id => (channels.find(c => c.id === id) || {}).name || id;

    function itemsFor(id) {
      const seeded = (M.questions || []).filter(q => id === 'all' || q.channel === id);
      const mine = drafts().filter(q => id === 'all' || q.channel === id)
        .map(q => ({ channel: q.channel, q: q.q, who: 'You', when: q.when, answers: [], pending: true }));
      return mine.concat(seeded);
    }

    function render(id) {
      current = id;
      $$('.chip', host).forEach(b =>
        b.setAttribute('aria-pressed', b.getAttribute('data-ch') === id ? 'true' : 'false'));

      const items = itemsFor(id);
      if (!items.length) {
        list.innerHTML = `<p class="qa-empty">Nothing here yet — the ask box below is how it starts.</p>`;
        return;
      }

      list.innerHTML = items.map(q => `
        <div class="qa-item">
          <button class="qa-q" type="button" aria-expanded="false">
            <span class="qa-text">${esc(q.q)}</span>
            <span class="qa-who">${esc(nameOf(q.channel))} · ${esc(q.who || 'Member')}${q.when ? ' · ' + esc(q.when) : ''}${q.pending ? ' · your draft' : ''}</span>
          </button>
          <div class="qa-a">
            ${q.pending
              ? `<p class="qa-pending">Saved on this device. Send it through the ask box below to get it in front of the panel.</p>`
              : (q.answers || []).map(a => `
                  <div class="qa-answer">
                    <div class="qa-answer-who">${esc(a.who)}</div>
                    <p>${esc(a.text)}</p>
                  </div>`).join('')}
          </div>
        </div>`).join('');

      $$('.qa-q', list).forEach(btn => btn.addEventListener('click', () => {
        const item = btn.closest('.qa-item');
        const ans = $('.qa-a', item);
        const open = item.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        ans.style.maxHeight = open ? ans.scrollHeight + 'px' : '0';
      }));
    }

    $$('.chip', host).forEach(b =>
      b.addEventListener('click', () => render(b.getAttribute('data-ch'))));

    $('#ask-form', host).addEventListener('submit', e => {
      e.preventDefault();
      const ta = $('#ask-q', host);
      const text = ta.value.trim();
      if (!text) return;
      const ch = $('#ask-ch', host).value;
      saveDraft({ channel: ch, q: text, when: 'just now' });
      ta.value = '';
      $('#ask-msg', host).textContent = 'Saved to this device. Open the form link to send it to the panel.';
      render(current === 'all' ? 'all' : ch);
    });

    render(current);
  }

  /* ── club directory ───────────────────────────────────────────────── */
  function buildDirectory() {
    const M = window.NCBO_MEMBER || {};
    const D = window.NCBO_DATA || {};
    const host = $('#directory');
    if (!host) return;
    const dir = M.directory || {};
    const clubs = D.clubs || [];

    host.innerHTML = `<div class="wrap">
        ${head(dir.eyebrow || 'The network', dir.title || "Who's out there.", dir.sub || '')}
        <div class="dir-list">
          ${clubs.map(c => `
            <div class="dir-item">
              <div class="dir-school">${esc(c.school)}</div>
              <div class="dir-club">${esc(c.name)}</div>
              <div class="dir-meta">
                <span class="dir-lead">${c.lead
                  ? `Lead: <b>${esc(c.lead)}</b>`
                  : 'Lead not yet confirmed'}</span>
                <span class="badge ${norm(c.status)}">${esc(c.status)}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ── the one entry point ──────────────────────────────────────────
     ncbo-auth.js may have finished deciding before this file even parses, so
     announce readiness as well as exposing the hook — whichever happens
     second wins the race. */
  window.NCBOHub = { buildHub };
  document.dispatchEvent(new CustomEvent('ncbo:hub-ready'));
})();
