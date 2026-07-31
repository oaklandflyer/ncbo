/* ============================================================================
   NCBO  —  shared site script
   - Injects the nav + footer (defined once, used on every page)
   - Renders data-driven sections from NCBO_DATA
   - Handles: mobile menu, scrolled-nav, scroll reveal, photo slots,
     FAQ accordion, hero canvas, newsletter handler
   ========================================================================== */
(function () {
  const D = window.NCBO_DATA || {};
  const PATH = location.pathname.split('/').pop() || 'index.html';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- photo slot helper ------------------------------------------
     Returns markup for an image that falls back to a labeled placeholder
     if the file doesn't exist yet. Drop a real file at `src` to replace.   */
  function photoSlot(src, label) {
    const lab = label || 'Add photo';
    return `<div class="photo-slot" data-empty="true">
        <img alt="${lab.replace(/"/g, '&quot;')}" src="${src}"
             onload="this.closest('.photo-slot').setAttribute('data-empty','false')">
        <div class="photo-ph">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          <span class="lab">${lab}</span>
          <span class="path">${src}</span>
        </div>
      </div>`;
  }
  window.ncboPhotoSlot = photoSlot;

  /* ---------- NAV --------------------------------------------------------- */
  function buildNav() {
    const host = $('#site-nav');
    if (!host || !D.nav) return;
    const links = D.nav.filter(n => !n.cta);
    const cta = D.nav.find(n => n.cta);
    const isCur = h => h === PATH ? ' aria-current="page"' : '';

    host.innerHTML = `
      <nav class="site-nav">
        <a class="brand" href="index.html" aria-label="NCBO home">
          <img src="assets/ncbo-logo.webp" alt="NCBO crest" width="40" height="40">
          <span class="brand-word">${D.org.name}</span>
        </a>
        <ul class="nav-links">
          ${links.map(l => `<li><a href="${l.href}"${isCur(l.href)}>${l.label}</a></li>`).join('')}
        </ul>
        ${cta ? `<a class="nav-cta" href="${cta.href}">${cta.label}</a>` : ''}
        <button class="nav-toggle" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </nav>
      <div class="mobile-menu">
        ${links.map(l => `<a href="${l.href}"${isCur(l.href)}>${l.label}</a>`).join('')}
        ${cta ? `<a class="nav-cta" href="${cta.href}">${cta.label}</a>` : ''}
      </div>`;

    const navEl = $('.site-nav', host);
    const toggle = $('.nav-toggle', host);
    toggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('.mobile-menu a', host).forEach(a =>
      a.addEventListener('click', () => document.body.classList.remove('nav-open')));

    const onScroll = () => navEl.classList.toggle('scrolled', window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- FOOTER ------------------------------------------------------ */
  function buildFooter() {
    const host = $('#site-footer');
    if (!host || !D.org) return;
    const ig = D.org.instagram || '#';
    const tt = D.org.tiktok || '';
    host.innerHTML = `
      <footer class="site-footer">
        <div class="wrap">
          <div class="footer-top">
            <div class="footer-brand">
              <img src="assets/ncbo-logo.webp" alt="NCBO crest">
              <span class="brand-word">${D.org.name}</span>
              <p>${D.org.full} — the governing body for collegiate bodybuilding. Clubs at your school, a real season, and a community that shows up year-round.</p>
              <p class="tagline">${D.org.tagline}</p>
            </div>
            <div class="footer-col">
              <h4>Explore</h4>
              <ul>
                <li><a href="join.html">Become a Member</a></li>
                <li><a href="clubs.html">Find a Club</a></li>
                <li><a href="start-a-club.html">Start a Club</a></li>
                <li><a href="members.html">Member Hub</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Organization</h4>
              <ul>
                <li><a href="about.html">About</a></li>
                <li><a href="faqs.html">FAQs</a></li>
                <li><a href="contact.html">Contact</a></li>
                <li><a href="${ig}" target="_blank" rel="noopener">Instagram ${D.org.instagramHandle || ''}</a></li>
                ${tt ? `<li><a href="${tt}" target="_blank" rel="noopener">TikTok ${D.org.tiktokHandle || ''}</a></li>` : ''}
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <p>© ${new Date().getFullYear()} ${D.org.full}. All rights reserved.</p>
            <div class="socials">
              <a href="${ig}" target="_blank" rel="noopener" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
              </a>
              ${tt ? `<a href="${tt}" target="_blank" rel="noopener" aria-label="TikTok">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.3 2.1 1.5 3.6 3.5 3.9v2.4c-1.2.1-2.3-.2-3.4-.8v5.9c0 3.2-2.5 5.6-5.6 5.6S5.4 17.6 5.4 14.5c0-2.9 2.3-5.3 5.2-5.5v2.5c-1.5.2-2.6 1.4-2.6 3 0 1.7 1.3 3 3 3s3-1.3 3-3V3h2.5z"/></svg>
              </a>` : ''}
              <a href="mailto:${D.org.email}" aria-label="Email">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>`;
  }

  /* ---------- generic data renderers (called from each page) ------------- */
  const R = {
    marquee(el) {
      if (!el || !D.marquee) return;
      const crest = `<img class="marquee-sep" src="assets/ncbo-logo.webp" alt="">`;
      const one = D.marquee.map(w => `<span class="marquee-item">${w}${crest}</span>`).join('');
      el.innerHTML = `<div class="marquee-track">${one}${one}</div>`;
    },
    tiles(el) {
      if (!el) return;
      el.innerHTML = D.tiles.map(t => `
        <a class="tile" href="${t.href}">
          ${photoSlot(t.img, t.title + ' photo')}
          <span class="tile-kicker">${t.kicker}</span>
          <h3>${t.title}</h3>
          <p>${t.text}</p>
          <span class="tile-go">${t.text ? 'Go' : ''}</span>
        </a>`).join('');
    },
    pillars(el) {
      if (!el) return;
      el.innerHTML = D.pillars.map((p, i) => `
        <div class="card reveal">
          <div class="num">0${i + 1}</div>
          <h3>${p.title}</h3>
          <p>${p.text}</p>
        </div>`).join('');
    },
    voices(el) {
      if (!el) return;
      el.innerHTML = D.voices.map(v => `
        <figure class="voice reveal">
          <div class="voice-photo">${photoSlot(v.img, 'Member photo')}</div>
          <figcaption class="voice-body">
            <div class="voice-mark">&ldquo;</div>
            <blockquote class="voice-quote">${v.quote}</blockquote>
            <div class="voice-who">${v.name}</div>
            <div class="voice-club">${v.club}</div>
          </figcaption>
        </figure>`).join('');
    },
    clubs(el) {
      if (!el) return;
      el.innerHTML = D.clubs.map(c => `
        <div class="club-card reveal">
          <div class="club-photo">${photoSlot(c.img, c.school + ' photo')}</div>
          <div class="club-body">
            <div class="club-school">${c.school}</div>
            <div class="club-name">${c.name}</div>
            <div class="club-meta">
              <span class="club-lead">Lead: <b>${c.lead}</b></span>
              <span class="badge ${c.status.toLowerCase()}">${c.status}</span>
            </div>
          </div>
        </div>`).join('');
    },
    clubsStrip(el, n) {
      if (!el) return;
      el.innerHTML = D.clubs.slice(0, n || 4).map(c => `
        <div class="club-card reveal">
          <div class="club-photo">${photoSlot(c.img, c.school + ' photo')}</div>
          <div class="club-body">
            <div class="club-school">${c.school}</div>
            <div class="club-name">${c.name}</div>
            <div class="club-meta">
              <span class="club-lead">Lead: <b>${c.lead}</b></span>
              <span class="badge ${c.status.toLowerCase()}">${c.status}</span>
            </div>
          </div>
        </div>`).join('');
    },
    steps(el) {
      if (!el) return;
      el.innerHTML = D.joinSteps.map(s => `
        <div class="step reveal">
          <div class="s-num">${s.step}</div>
          <h3>${s.title}</h3>
          <p>${s.text}</p>
        </div>`).join('');
    },
    people(el, list) {
      if (!el) return;
      el.innerHTML = (list || []).map(p => `
        <div class="person reveal">
          ${photoSlot(p.img, p.name + ' photo')}
          <div class="person-name">${p.name}</div>
          <div class="person-role">${p.role}</div>
        </div>`).join('');
    },
    news(el) {
      if (!el) return;
      el.innerHTML = D.news.map(n => `
        <article class="news-card reveal">
          <div class="news-photo">${photoSlot(n.img, n.title + ' photo')}</div>
          <div class="news-body">
            <div class="news-meta"><span class="news-tag">${n.tag}</span><span class="news-date">${n.date}</span></div>
            <h3>${n.title}</h3>
            <p>${n.text}</p>
          </div>
        </article>`).join('');
    },
    faqs(el) {
      if (!el) return;
      el.innerHTML = D.faqs.map((f, i) => `
        <div class="faq-item">
          <button class="faq-q" aria-expanded="false" id="faq-${i}">${f.q}</button>
          <div class="faq-a" role="region" aria-labelledby="faq-${i}"><p>${f.a}</p></div>
        </div>`).join('');
      $$('.faq-q', el).forEach(btn => btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const ans = $('.faq-a', item);
        const open = item.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        ans.style.maxHeight = open ? ans.scrollHeight + 'px' : '0';
      }));
    }
  };
  window.NCBO_RENDER = R;

  /* ---------- scroll reveal ---------------------------------------------- */
  function initReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window) || !els.length) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(e => io.observe(e));
  }

  /* ---------- newsletter (front-end only; wire to a provider later) ------- */
  function initNewsletter() {
    $$('.nl-form, form[data-newsletter]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = form.parentElement.querySelector('.nl-msg') || form.querySelector('.nl-msg');
        if (msg) msg.textContent = "You're on the list — welcome to NCBO.";
        form.reset();
      });
    });
  }

  /* ---------- hero canvas (ambient drifting nodes) ----------------------- */
  function initHeroCanvas() {
    const cv = $('#hero-canvas');
    if (!cv) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d');
    let w, h, nodes, raf;
    const COUNT = 46;
    function size() {
      w = cv.width = cv.offsetWidth * devicePixelRatio;
      h = cv.height = cv.offsetHeight * devicePixelRatio;
    }
    function make() {
      nodes = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18 * devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.18 * devicePixelRatio,
        r: (Math.random() * 1.6 + 0.6) * devicePixelRatio
      }));
    }
    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j], dx = n.x - m.x, dy = n.y - m.y, d = Math.hypot(dx, dy);
          const lim = 140 * devicePixelRatio;
          if (d < lim) {
            ctx.strokeStyle = `rgba(91,134,196,${(1 - d / lim) * 0.16})`;
            ctx.lineWidth = devicePixelRatio * 0.6;
            ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(143,176,221,0.55)';
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }
    size(); make(); tick();
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); size(); make(); tick(); });
  }

  /* ---------- boot -------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    buildNav();
    buildFooter();
    // pages call NCBO_RENDER.* themselves; then we run shared init below
    if (window.NCBO_PAGE) window.NCBO_PAGE(R);
    initHeroCanvas();
    initReveal();
    initNewsletter();
  });
})();
