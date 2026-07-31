/* ============================================================================
   NCBO — app.js
   Members-only area controller.

   - Access-code gate (codes live in assets/member-data.js)
   - Tabbed app shell: Dashboard · Channels & Q&A · Resources · Directory
   - Renders dashboard/resources/directory; the Q&A board is channels-qa.js
     and the map is usmap.js

   The gate is a convenience lock on a static site, not authentication — see
   the note at the top of assets/member-data.js.
   ========================================================================== */
(function () {
  const KEY = 'ncbo-member-access';
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

  /* ── app shell ────────────────────────────────────────────────────── */
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

    /* header */
    const bar = $('#app-bar');
    if (bar) {
      bar.innerHTML = `
        <div class="app-bar-inner">
          <div>
            <p class="eyebrow">${esc(W.eyebrow || 'Season hub')}</p>
            <h1>${esc(W.title || 'Welcome back.')}</h1>
            <p class="app-sub">${esc(W.sub || '')}</p>
          </div>
          <button class="sign-out" type="button" id="sign-out">Sign out</button>
        </div>`;
      $('#sign-out').addEventListener('click', closeApp);
    }

    buildDashboard();
    if (window.NCBO_QA) window.NCBO_QA.mount($('#qa-root'));
    buildResources();
    buildDirectory();
    initTabs();
  }

  function buildDashboard() {
    const M = window.NCBO_MEMBER || {};
    const host = $('#panel-dashboard');
    if (!host) return;

    const stats = (M.stats || []).map(s =>
      `<div class="stat"><span class="stat-num">${esc(s.num)}</span><span class="stat-lab">${esc(s.lab)}</span></div>`).join('');

    const anns = (M.announcements || []).map(a => `
      <article class="ann">
        <div class="ann-meta"><span class="ann-tag">${esc(a.tag)}</span><span class="ann-date">${esc(a.date)}</span></div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.text)}</p>
      </article>`).join('');

    const cal = (M.calendar || []).map(c => `
      <div class="cal-row">
        <div class="cal-date">${esc(c.date)}</div>
        <div>
          <div class="cal-title">${esc(c.title)}</div>
          <div class="cal-where">${esc(c.where)}</div>
        </div>
        <span class="badge ${norm(c.status) === 'confirmed' ? 'active' : 'forming'}">${esc(c.status)}</span>
      </div>`).join('');

    host.innerHTML = `
      <div class="wrap">
        <div class="stats" style="margin-top:0">${stats}</div>
        <div class="app-split" style="margin-top:clamp(2rem,5vw,3.4rem)">
          <div>
            <div class="panel-head"><p class="eyebrow">Latest</p><h2>Announcements.</h2></div>
            <div class="ann-list">${anns}</div>
          </div>
          <div>
            <div class="panel-head"><p class="eyebrow">Season</p><h2>Calendar.</h2></div>
            <div class="cal">${cal}</div>
          </div>
        </div>
      </div>`;
  }

  function buildResources() {
    const M = window.NCBO_MEMBER || {};
    const host = $('#panel-resources');
    if (!host) return;

    const groups = (M.resourceGroups || []).map(g => `
      <section class="res-group">
        <h3>${esc(g.group)}</h3>
        <div class="res-grid">
          ${(g.items || []).map(i => `
            <a class="res" href="${esc(i.href || '#')}"${/^https?:/.test(i.href || '') ? ' target="_blank" rel="noopener"' : ''}>
              <h4>${esc(i.title)}</h4>
              <p>${esc(i.text)}</p>
              <span class="res-go">Open</span>
            </a>`).join('')}
        </div>
      </section>`).join('');

    host.innerHTML = `
      <div class="wrap">
        <div class="panel-head"><p class="eyebrow">Library</p><h2>Resources.</h2>
          <p>Everything the network has written down — competition rules, prep frameworks, and the playbook for running a club.</p></div>
        ${groups}
      </div>`;
  }

  function buildDirectory() {
    const M = window.NCBO_MEMBER || {};
    const D = window.NCBO_DATA || {};
    const host = $('#panel-directory');
    if (!host) return;
    const dir = M.directory || {};
    const clubs = D.clubs || [];

    host.innerHTML = `
      <div class="wrap">
        <div class="panel-head"><p class="eyebrow">${esc(dir.eyebrow || 'The network')}</p>
          <h2>${esc(dir.title || "Who's out there.")}</h2>
          <p>${esc(dir.sub || '')}</p></div>
        <div class="dir-layout">
          <div class="map-card"><div class="map-stage" id="member-map"></div>
            <div class="map-foot">
              <p class="map-hint">Tap a campus to pull up its club. <b>${clubs.length} clubs</b> in the network.</p>
              <div class="map-legend">
                <span class="lg active"><i></i>Active</span>
                <span class="lg forming"><i></i>Forming</span>
              </div>
            </div>
          </div>
          <div class="dir-list" id="dir-list">
            ${clubs.map(c => `
              <button class="dir-item" type="button" data-school="${esc(c.school)}">
                <div class="dir-school">${esc(c.school)}</div>
                <div class="dir-club">${esc(c.name)}</div>
                <div class="dir-meta">
                  <span class="dir-lead">Lead: <b>${esc(c.lead)}</b></span>
                  <span class="badge ${norm(c.status)}">${esc(c.status)}</span>
                </div>
              </button>`).join('')}
          </div>
        </div>
      </div>`;

    function select(school) {
      $$('#dir-list .dir-item').forEach(b => {
        const hit = b.getAttribute('data-school') === school;
        b.classList.toggle('selected', hit);
        if (hit) b.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    if (window.NCBO_USMAP) {
      window.NCBO_USMAP.render($('#member-map'), clubs, { onSelect: select });
    }
    $$('#dir-list .dir-item').forEach(b =>
      b.addEventListener('click', () => select(b.getAttribute('data-school'))));
  }

  /* ── tabs ─────────────────────────────────────────────────────────── */
  function initTabs() {
    const tabs = $$('.app-tab');
    if (!tabs.length) return;

    function show(id) {
      tabs.forEach(t => {
        const on = t.getAttribute('data-panel') === id;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      $$('.app-panel').forEach(p => { p.hidden = p.id !== 'panel-' + id; });
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    }

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(t.getAttribute('data-panel')));
      t.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        show(next.getAttribute('data-panel'));
      });
    });

    const want = (location.hash || '').replace('#', '');
    show(tabs.some(t => t.getAttribute('data-panel') === want) ? want : tabs[0].getAttribute('data-panel'));
  }

  /* ── boot ─────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    buildGate();
    if (isValid(remembered())) openApp();
    else { const i = $('#gate-code'); if (i) i.focus(); }
  });
})();
