/* ============================================================================
   NCBO — channels-qa.js
   Channel rail + Q&A board for the member app.

     NCBO_QA.mount(el)   builds the whole module into `el`

   Seeded questions come from NCBO_MEMBER.questions. Questions a member writes
   in the ask box are held in localStorage on that device only — this is a
   static site, so nothing is transmitted until they send it through the form
   link in NCBO_MEMBER.ask.form.
   ========================================================================== */
(function () {
  const STORE = 'ncbo-member-drafts';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function drafts() {
    try { return JSON.parse(localStorage.getItem(STORE)) || []; }
    catch (e) { return []; }
  }
  function saveDraft(d) {
    const all = drafts();
    all.unshift(d);
    try { localStorage.setItem(STORE, JSON.stringify(all)); } catch (e) { /* private mode */ }
  }

  function mount(el) {
    const M = window.NCBO_MEMBER || {};
    if (!el || !M.channels) return;

    const channels = M.channels;
    let current = channels[0].id;

    el.innerHTML = `
      <div class="qa-layout">
        <nav class="qa-channels" aria-label="Channels">
          <h3>Channels</h3>
          ${channels.map(c => `
            <button class="qa-chan" type="button" data-ch="${esc(c.id)}" aria-pressed="false">
              <span class="ch-name">${esc(c.name)} <span class="ch-count" data-count="${esc(c.id)}">0</span></span>
              <span class="ch-desc">${esc(c.desc || '')}</span>
            </button>`).join('')}
        </nav>
        <div class="qa-board">
          <div class="qa-board-head">
            <h3 data-board-name></h3>
            <p data-board-desc></p>
          </div>
          <div class="qa-list" data-list></div>
          ${askMarkup(M, channels)}
        </div>
      </div>`;

    const list = el.querySelector('[data-list]');
    const boardName = el.querySelector('[data-board-name]');
    const boardDesc = el.querySelector('[data-board-desc]');

    function itemsFor(id) {
      const seeded = (M.questions || []).filter(q => q.channel === id);
      const mine = drafts().filter(q => q.channel === id)
        .map(q => ({ q: q.q, who: 'You', when: q.when, answers: [], pending: true }));
      return mine.concat(seeded);
    }

    function counts() {
      channels.forEach(c => {
        const n = itemsFor(c.id).length;
        const badge = el.querySelector(`[data-count="${c.id}"]`);
        if (badge) badge.textContent = n;
      });
    }

    function renderChannel(id) {
      current = id;
      const ch = channels.find(c => c.id === id) || channels[0];
      boardName.textContent = ch.name;
      boardDesc.textContent = ch.desc || '';

      Array.from(el.querySelectorAll('.qa-chan')).forEach(b =>
        b.setAttribute('aria-pressed', b.getAttribute('data-ch') === id ? 'true' : 'false'));

      const items = itemsFor(id);
      if (!items.length) {
        list.innerHTML = `<div class="qa-empty">No questions in this channel yet. Be the first — the ask box is right below.</div>`;
        return;
      }

      list.innerHTML = items.map(q => `
        <div class="qa-item">
          <button class="qa-q" type="button" aria-expanded="false">
            ${esc(q.q)}${q.pending ? '<span class="qa-badge">Your draft</span>' : ''}
            <span class="qa-who">${esc(q.who || 'Member')}${q.when ? ' · ' + esc(q.when) : ''}</span>
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

      Array.from(list.querySelectorAll('.qa-q')).forEach(btn => {
        btn.addEventListener('click', () => {
          const item = btn.closest('.qa-item');
          const ans = item.querySelector('.qa-a');
          const open = item.classList.toggle('open');
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
          ans.style.maxHeight = open ? ans.scrollHeight + 'px' : '0';
        });
      });
    }

    Array.from(el.querySelectorAll('.qa-chan')).forEach(btn =>
      btn.addEventListener('click', () => renderChannel(btn.getAttribute('data-ch'))));

    /* ask box */
    const form = el.querySelector('[data-ask-form]');
    if (form) {
      const msg = el.querySelector('[data-ask-msg]');
      form.addEventListener('submit', e => {
        e.preventDefault();
        const sel = form.querySelector('select');
        const ta = form.querySelector('textarea');
        const text = ta.value.trim();
        if (!text) return;
        saveDraft({ channel: sel.value, q: text, when: 'just now' });
        ta.value = '';
        if (msg) msg.textContent = 'Saved to this device. Open the form link to send it to the panel.';
        counts();
        renderChannel(sel.value);
      });
    }

    counts();
    renderChannel(current);
  }

  function askMarkup(M, channels) {
    const ask = M.ask || {};
    return `
      <div class="qa-ask">
        <h4>${esc(ask.title || 'Ask the network')}</h4>
        <p>${esc(ask.text || '')}</p>
        <form data-ask-form>
          <select aria-label="Channel">
            ${channels.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
          </select>
          <textarea placeholder="What do you want to know?" aria-label="Your question"></textarea>
          <div class="qa-ask-actions">
            <button class="btn btn-primary" type="submit">Save question</button>
            ${ask.form && ask.form !== '#'
              ? `<a class="btn btn-ghost btn-arrow" href="${esc(ask.form)}" target="_blank" rel="noopener">Send to the panel</a>`
              : ''}
          </div>
          <p class="qa-msg" data-ask-msg></p>
          <p class="qa-note">${esc(ask.note || '')}</p>
        </form>
      </div>`;
  }

  window.NCBO_QA = { mount };
})();
