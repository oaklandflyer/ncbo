/* ============================================================================
   NCBO — app.js
   Members-only area controller.

   - Access-code gate (codes live in assets/member-data.js)
   - One scrolling hub: Calendar · Updates · Resources · Q&A · Clubs
     (no tabs, no side rails — everything stacks in one column on phones)

   The gate is a convenience lock on a static site, not authentication — see
   the note at the top of assets/member-data.js.
   ========================================================================== */
(function () {
  const KEY = 'ncbo-member-access';
  const DRAFTS = 'ncbo-member-drafts';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const norm = s => String(s || '').trim().toLowerCase();

  function codes() {
    const M = window.NCBO_MEMBER || {};
    return ((M.access && M.access.codes) || []).map(norm);
  }
  function isValid(input) { return codes().indexOf(norm(input)) !== -1; }

  /* remembered unlock — sessionStorage by default, localStorage if the member
     ticked "keep me signed in". Stores the code so a rotation locks it again. */
  function remembered() {
    try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY); }
    catch (e) { return null; }
  }
  function remember(code, persist) {
    try {
      (persist ? localStorage : sessionStorage).setItem(KEY, norm(code));
      if (!persist) localStorage.removeItem(KEY);
    } catch (e) { /* private mode — they'll just re-enter the code */ }
  }
  function forget() {
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}
  }

  /* ── gate ─────────────────────────────────────────────────────────── */
  function buildGate() {
    const M = window.NCBO_MEMBER || {};
    const A = M.access || {};
    const D = window.NCBO_DATA || {};
    const host = $('#gate');
    if (!host) return;

    host.innerHTML = `
      <div class="gate-card">
        <img class="gate-crest" src="assets/ncbo-logo.webp" alt="NCBO crest">
        <p class="eyebrow">${esc(A.eyebrow || 'Members only')}</p>
        <h1>${(A.title || ['Member access']).map(esc).join('<br>')}</h1>
        <p class="gate-sub">${esc(A.sub || '')}</p>
        <form class="gate-form" id="gate-form">
          <input type="text" id="gate-code" autocomplete="off" spellcheck="false"
                 autocapitalize="characters" enterkeyhint="go"
                 aria-label="Member access code" placeholder="${esc(A.placeholder || 'Access code')}">
          <label class="gate-remember">
            <input type="checkbox" id="gate-remember">
            <span>${esc(A.remember || 'Keep me signed in on this device')}</span>
          </label>
          <button class="btn btn-primary" type="submit">Enter</button>
          <p class="gate-msg" id="gate-msg" role="status" aria-live="polite"></p>
        </form>
        <p class="gate-help">${esc(A.help || '')}
          ${D.org && D.org.email ? `<a href="mailto:${esc(D.org.email)}">${esc(D.org.email)}</a>` : ''}</p>
      </div>`;

    $('#gate-form').addEventListener('submit', e => {
      e.preventDefault();
      const val = $('#gate-code').value;
      const msg = $('#gate-msg');
      if (isValid(val)) {
        remember(val, $('#gate-remember').checked);
        msg.textContent = '';
        openApp();
      } else {
        msg.textContent = A.error || "That code isn't right.";
        const card = $('.gate-card', host);
        card.classList.remove('shake');
        void card.offsetWidth;          // restart the animation
        card.classList.add('shake');
        $('#gate-code').select();
      }
    });
  }

  /* ── hub shell ────────────────────────────────────────────────────── */
  let built = false;

  function openApp() {
    const gate = $('#gate'), app = $('#app');
    if (!app) return;
    gate.hidden = true;
    app.hidden = false;
    document.body.classList.add('member-in');
    if (!built) { buildApp(); built = true; }
    window.scrollTo(0, 0);
  }

  function closeApp() {
    forget();
    const gate = $('#gate'), app = $('#app');
    app.hidden = true;
    gate.hidden = false;
    document.body.classList.remove('member-in');
    const input = $('#gate-code');
    if (input) { input.value = ''; input.focus(); }
    window.scrollTo(0, 0);
  }

  function buildApp() {
    const M = window.NCBO_MEMBER || {};
    const W = M.welcome || {};

    const bar = $('#app-bar');
    if (bar) {
      const stats = (M.stats || []).map(s =>
        `<div class="stat"><span class="stat-num">${esc(s.num)}</span><span class="stat-lab">${esc(s.lab)}</span></div>`).join('');
      bar.innerHTML = `
        <div class="app-bar-inner">
          <div class="app-bar-head">
            <div>
              <p class="eyebrow">${esc(W.eyebrow || 'Season hub')}</p>
              <h1>${esc(W.title || 'Welcome back.')}</h1>
              <p class="app-sub">${esc(W.sub || '')}</p>
            </div>
            <button class="sign-out" type="button" id="sign-out">Sign out</button>
          </div>
          ${stats ? `<div class="stats">${stats}</div>` : ''}
        </div>`;
      $('#sign-out').addEventListener('click', closeApp);
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

  /* ── boot ─────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    buildGate();
    if (isValid(remembered())) openApp();
    else { const i = $('#gate-code'); if (i) i.focus(); }
  });
})();
