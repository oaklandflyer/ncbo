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

  /* ---------- initials monogram -------------------------------------------
     Used for people who don't have a headshot on file yet. A named monogram
     reads as deliberate; the generic "Add photo" placeholder reads as broken. */
  function initials(name) {
    return String(name || '').trim().split(/\s+/).slice(0, 2)
      .map(w => w[0] || '').join('').toUpperCase();
  }

  /* Photo slot that falls back to an initials monogram instead of the
     "drop a file here" placeholder. */
  function personPhoto(src, name) {
    const mono = `<div class="mono" aria-hidden="true">${initials(name)}</div>`;
    if (!src) return `<div class="photo-slot person-photo" data-empty="true">${mono}</div>`;
    return `<div class="photo-slot person-photo" data-empty="true">
        <img alt="${String(name).replace(/"/g, '&quot;')}" src="${src}"
             onload="this.closest('.photo-slot').setAttribute('data-empty','false')">
        ${mono}
      </div>`;
  }

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
              <p>${D.org.full} — building collegiate bodybuilding into a real sport. Clubs at your school, and a community that shows up year-round.</p>
              <p class="tagline">${D.org.tagline}</p>
            </div>
            <div class="footer-col">
              <h4>Explore</h4>
              <ul>
                <li><a href="join.html">Become a Member</a></li>
                <li><a href="index.html#clubs">Find a Club</a></li>
                <li><a href="index.html#start">Start a Club</a></li>
                <li><a href="https://hub.thencbo.org/login">Member Hub</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Organization</h4>
              <ul>
                <li><a href="index.html#about">About</a></li>
                <li><a href="index.html#faqs">FAQs</a></li>
                <li><a href="contact.html">Contact</a></li>
                <li><a href="${ig}" target="_blank" rel="noopener">Instagram ${D.org.instagramHandle || ''}</a></li>
                ${tt ? `<li><a href="${tt}" target="_blank" rel="noopener">TikTok ${D.org.tiktokHandle || ''}</a></li>` : ''}
              </ul>
            </div>
          </div>
          ${D.org.statusLong ? `<p class="footer-legal">${D.org.statusLong}</p>` : ''}
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
      if (!el || !D.voices || !D.voices.length) return 0;
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
    clubs(el) { return R.clubsStrip(el, D.clubs.length); },
    /* A club with no confirmed lead shows a contact prompt, never a name we
       can't source and never an empty "Lead:" label. */
    clubsStrip(el, n) {
      if (!el) return;
      el.innerHTML = D.clubs.slice(0, n || 4).map(c => `
        <div class="club-card reveal">
          <div class="club-photo">${photoSlot(c.img, c.school + ' photo')}</div>
          <div class="club-body">
            <div class="club-school">${c.school}</div>
            <div class="club-name">${c.name}${c.note ? ` <span class="club-note">· ${c.note}</span>` : ''}</div>
            <div class="club-meta">
              <span class="club-lead">${c.lead
                ? `Lead: <b>${c.lead}</b>`
                : `<a href="contact.html">Contact us for this chapter</a>`}</span>
              <span class="badge ${c.status.toLowerCase().replace(/\s+/g, '-')}">${c.status}</span>
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
    /* Renders a people grid. Returns the number rendered so a page can hide
       the whole block (heading included) when a list is empty — an empty
       "Advisory board" heading is worse than no heading. A person with no
       confirmed title renders with the name alone; we never fill the gap. */
    people(el, list) {
      if (!el) return 0;
      const people = list || [];
      el.innerHTML = people.map(p => `
        <div class="person reveal">
          ${personPhoto(p.img, p.name)}
          <div class="person-body">
            <div class="person-name">${p.name}</div>
            ${p.role ? `<div class="person-role">${p.role}</div>` : ''}
            ${p.school ? `<div class="person-title">${p.school}</div>` : ''}
          </div>
        </div>`).join('');
      return people.length;
    },
    /* Board of directors. Same card as `people`, plus the director's outside
       professional title on a second line — the board office is the primary
       line because that's the role they hold here. Returns the count so the
       page can keep the whole block hidden while no director is seated. */
    board(el, list) {
      if (!el) return 0;
      const people = list || [];
      el.innerHTML = people.map(p => `
        <div class="person reveal">
          ${personPhoto(p.img, p.name)}
          <div class="person-body">
            <div class="person-name">${p.name}</div>
            ${p.role ? `<div class="person-role">${p.role}</div>` : ''}
            ${p.title ? `<div class="person-title">${p.title}</div>` : ''}
            ${p.bio ? `<p class="person-bio">${p.bio}</p>` : ''}
          </div>
        </div>`).join('');
      return people.length;
    },
    /* Club leads for the Team section, from two places that add up to one list:

         D.clubLeads   the roster edited in the admin's Team tab — the only
                       place a lead gets a photo, and where a club with more
                       than one lead gets its second and third
         D.clubs       any club whose "Lead / contact" names someone not
                       already on that roster, so filling in the Clubs tab
                       alone still puts them here

       Matched on name, case- and space-insensitively, so the same person
       entered in both places appears once. A club with no confirmed lead
       contributes nobody — we never invent a name to fill the grid. */
    clubLeads(el) {
      if (!el) return 0;
      const key = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

      const roster = (D.clubLeads || [])
        .filter(p => p.name && String(p.name).trim())
        .map(p => ({
          name: String(p.name).trim(),
          role: p.school || p.role || '',
          img: p.img || ''
        }));

      const named = new Set(roster.map(p => key(p.name)));

      const fromClubs = (D.clubs || [])
        .filter(c => c.lead && String(c.lead).trim() && !named.has(key(c.lead)))
        .map(c => ({
          name: String(c.lead).trim(),
          role: c.school + (c.note ? ' · ' + c.note : ''),
          img: c.leadImg || ''
        }));

      return R.people(el, roster.concat(fromClubs));
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

  /* ---------- newsletter --------------------------------------------------
     There is no provider wired up behind this form, so it must not claim a
     signup succeeded. Say what's actually true and point at a channel that
     works. Replace this handler when a list provider exists.               */
  function initNewsletter() {
    $$('.nl-form, form[data-newsletter]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = form.parentElement.querySelector('.nl-msg') || form.querySelector('.nl-msg');
        if (msg) msg.textContent = "Our mailing list isn't running yet — follow " +
          (D.org.instagramHandle || 'us on Instagram') + " for updates in the meantime.";
      });
    });
  }

  /* ---------- alternating photo background -------------------------------
     Cycles through NCBO_DATA.heroPhotos. Each photo is only added once it
     has actually loaded, so missing files are skipped silently and the
     gradient underneath is what shows if none of them exist yet.          */
  function initPhotoBg() {
    const host = $('.photo-bg');
    if (!host) return;
    const srcs = D.heroPhotos || [];
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let idx = 0, timer = null;

    srcs.forEach(src => {
      const probe = new Image();
      probe.onload = () => add(src);
      probe.src = src;
    });

    function add(src) {
      const layer = document.createElement('div');
      layer.className = 'photo-layer';
      layer.style.backgroundImage = 'url("' + src + '")';
      host.appendChild(layer);
      if (host.children.length === 1) {
        layer.classList.add('on');
        host.classList.add('has-photo');
      }
      if (!still) start();
    }

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        const layers = host.children;
        if (layers.length < 2 || document.hidden) return;
        layers[idx].classList.remove('on');
        idx = (idx + 1) % layers.length;
        layers[idx].classList.add('on');
      }, 6500);
    }
  }

  /* ---------- jump bar (home page section nav) ---------------------------- */
  function initJumpBar() {
    $$('.jump').forEach(initOneJumpBar);
  }

  function initOneJumpBar(bar) {
    const links = $$('a', bar);
    const targets = links
      .map(a => ({ a, el: document.getElementById(a.getAttribute('href').slice(1)) }))
      .filter(t => t.el);
    if (!targets.length || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const hit = targets.find(t => t.el === e.target);
        links.forEach(a => a.removeAttribute('aria-current'));
        if (hit) {
          hit.a.setAttribute('aria-current', 'true');
          hit.a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(t => io.observe(t.el));
  }

  /* ---------- boot -------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    buildNav();
    buildFooter();
    // pages call NCBO_RENDER.* themselves; then we run shared init below
    if (window.NCBO_PAGE) window.NCBO_PAGE(R);
    initPhotoBg();
    initJumpBar();
    initReveal();
    initNewsletter();
  });
})();
