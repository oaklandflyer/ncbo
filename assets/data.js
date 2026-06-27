/* ============================================================================
   NCBO_DATA  —  single source of truth for site content
   ----------------------------------------------------------------------------
   Edit THIS file to change copy, clubs, voices, FAQs, news, etc.
   No HTML changes are needed. Every page reads from this object.

   PHOTOS: anywhere you see  img: "assets/img/xxxx.jpg"  you can drop a real
   image at that path and it appears automatically. Until then a labeled
   placeholder shows so the layout never breaks.
   ========================================================================== */

window.NCBO_DATA = {

  /* --- Org identity ----------------------------------------------------- */
  org: {
    name: "NCBO",
    full: "National Collegiate Bodybuilding Organization",
    tagline: "Clubs. Competition. Community.",
    established: "Est. 2024",
    email: "thencbo@gmail.com",
    instagram: "https://instagram.com/ncboofficial",
    instagramHandle: "@ncboofficial",
    tiktok: "https://tiktok.com/@ncboofficial",
    tiktokHandle: "@ncboofficial"
  },

  /* --- Primary navigation ----------------------------------------------- *
   * Order = display order. `cta:true` renders the highlighted button.      */
  nav: [
    { label: "Home",          href: "index.html" },
    { label: "Join",          href: "join.html" },
    { label: "Find a Club",   href: "clubs.html" },
    { label: "Start a Club",  href: "start-a-club.html" },
    { label: "About",         href: "about.html" },
    { label: "FAQs",          href: "faqs.html" },
    { label: "News",          href: "news.html" },
    { label: "Join NCBO",     href: "join.html", cta: true }
  ],

  /* --- Marquee value words (the scrolling strip) ------------------------ */
  marquee: [
    "Clubs", "Competition", "Community", "Strength",
    "Discipline", "Brotherhood & Sisterhood", "A Real Season", "Pathway"
  ],

  /* --- Home hero -------------------------------------------------------- */
  hero: {
    eyebrow: "Est. 2024 · The collegiate governing body",
    title: ["College bodybuilding", "is better with a", "<span class='accent'>team behind you.</span>"],
    sub: "NCBO gives competitive bodybuilding a real home on campus — school-affiliated clubs, a structured season, school-vs-school competition, and a year-round community. Find your club, become a member, and start building.",
    primary: { label: "Become a member", href: "join.html" },
    ghost:   { label: "How it works", href: "about.html" }
  },

  /* --- Home CTA tiles (Girl-Gains-style, minus the shop) ---------------- */
  tiles: [
    { kicker: "Join Now",      title: "Become a Member",  text: "Get plugged into a club at your school.",        href: "join.html",          img: "assets/img/tile-join.jpg" },
    { kicker: "Chapters",      title: "Find a Club",      text: "See which schools already have NCBO clubs.",     href: "clubs.html",         img: "assets/img/tile-clubs.jpg" },
    { kicker: "Start a Club",  title: "Apply Today",      text: "Bring NCBO to your campus — we'll help you build.", href: "start-a-club.html", img: "assets/img/tile-start.jpg" },
    { kicker: "News",          title: "Latest Updates",   text: "Season news, events, and community wins.",       href: "news.html",          img: "assets/img/tile-news.jpg" }
  ],

  /* --- "What we are" band ----------------------------------------------- */
  about: {
    label: "What We Are",
    headline: ["Not another open show.", "A real <span class='accent'>collegiate sport.</span>"],
    body: [
      "NCBO sits above independently-run student clubs and gives them the things a single club can't build alone: a season, school-vs-school competition, coaching access, and a national network.",
      "At a traditional open show, \"collegiate\" is just an eligibility checkbox. NCBO adds the part that's been missing — a club at your school, a season to train for, and a community that shows up year-round."
    ],
    stats: [
      { num: "6+",   lab: "Founding clubs" },
      { num: "5",    lab: "Campuses" },
      { num: "2024", lab: "Founded" },
      { num: "1",    lab: "National title — the goal" }
    ]
  },

  /* --- Value pillars (what members actually get) ------------------------ */
  pillars: [
    { title: "Coach & pro access",   text: "Posing and prep guidance from IFBB and OCB pros who work with our clubs." },
    { title: "A club operating system", text: "Recruiting templates, officer structure, and a run-it playbook so your club doesn't start from zero." },
    { title: "Legitimacy on campus", text: "The NCBO member-club seal — leverage for official org status and student-government funding." },
    { title: "A national network",   text: "Cross-campus connection, shared events, and a path to school-vs-school competition." }
  ],

  /* --- Member voices (Girl Gains "Love Notes") -------------------------- *
   * PLACEHOLDER COPY — swap in real member quotes + photos before launch.  */
  voices: [
    {
      quote: "NCBO turned lifting alone into showing up with a team. Having a club at my school changed how I train and who I train with.",
      name: "Founding member",
      club: "Pitt club",
      img: "assets/img/voice-1.jpg"
    },
    {
      quote: "The structure is the difference. A season to point at, a club to run, people to answer to — it makes the work mean something.",
      name: "Club officer",
      club: "Purdue club",
      img: "assets/img/voice-2.jpg"
    },
    {
      quote: "Getting posing feedback from actual pros, as a college student, is something I never thought I'd have access to.",
      name: "Member",
      club: "Penn State club",
      img: "assets/img/voice-3.jpg"
    }
  ],

  /* --- Founding clubs (Find a Club page + home strip) ------------------- */
  clubs: [
    { school: "University of Pittsburgh", name: "Fitness & Bodybuilding Club", lead: "Luke Rudolph",   status: "Active",    img: "assets/img/club-pitt.jpg" },
    { school: "Penn State University",    name: "Bodybuilding & Fitness Club", lead: "Isabel Ward",    status: "Active",    img: "assets/img/club-pennstate.jpg" },
    { school: "Purdue University",        name: "Bodybuilding Club",           lead: "Vincent Panzica", status: "Active",    img: "assets/img/club-purdue.jpg" },
    { school: "Slippery Rock University", name: "Bodybuilding & Fitness Club", lead: "TBD",            status: "Forming",   img: "assets/img/club-slipperyrock.jpg" },
    { school: "Florida State University", name: "Bodybuilding Club",           lead: "Eli Korta",      status: "Forming",   img: "assets/img/club-fsu.jpg" },
    { school: "University of Iowa",       name: "Bodybuilding Club",           lead: "Alex Swanson",   status: "Forming",   img: "assets/img/club-iowa.jpg" }
  ],

  /* --- Membership tiers (Join page) ------------------------------------ *
   * All $0 during the founding phase.                                      */
  tiers: [
    {
      name: "Core",
      price: "$0",
      note: "Founding phase",
      tagline: "Be part of the club.",
      features: ["Club membership at your school", "Year-round community & events", "Access to the NCBO network"]
    },
    {
      name: "Competitive",
      price: "$0",
      note: "Founding phase",
      featured: true,
      tagline: "Train for the season.",
      features: ["Everything in Core", "Posing & prep coaching access", "Season + competition eligibility", "Officer pathway"]
    },
    {
      name: "Premier",
      price: "$0",
      note: "Founding phase",
      tagline: "Lead the movement.",
      features: ["Everything in Competitive", "Club leadership support", "Priority for national events", "Direct line to NCBO staff"]
    }
  ],

  /* --- How to join steps ----------------------------------------------- */
  joinSteps: [
    { step: "01", title: "Find your club", text: "Check the Find a Club page. If your school is listed, you're one form away." },
    { step: "02", title: "No club yet?",   text: "Start one. We give you the playbook, templates, and support to launch fast." },
    { step: "03", title: "Become a member", text: "Join through your club. During the founding phase, membership is free." },
    { step: "04", title: "Train the season", text: "Show up, get coached, and represent your school when the season runs." }
  ],

  /* --- Leadership (About page) ----------------------------------------- */
  leadership: [
    { name: "Andrew Coutinho", role: "CEO & Founder",                      img: "assets/img/team-andrew.jpg" },
    { name: "Neha Kotha",      role: "VP of Operations · leads the exec team", img: "assets/img/team-neha.jpg" },
    { name: "Luke Rudolph",    role: "Director of Finance",                img: "assets/img/team-luke.jpg" },
    { name: "Vincent Panzica", role: "Director of Club Development",       img: "assets/img/team-vincent.jpg" },
    { name: "Alex Swanson",    role: "Director of Events",                 img: "assets/img/team-alex.jpg" },
    { name: "Olivia Durbin",   role: "Director of Marketing",             img: "assets/img/team-olivia.jpg" }
  ],

  /* --- Advisory board (About page) ------------------------------------- */
  advisory: [
    { name: "Jasmine Amato", role: "IFBB Pro · Advisory",        img: "assets/img/advisor-jasmine.jpg" },
    { name: "Megan Chaney",  role: "OCB Wellness Pro · Advisory", img: "assets/img/advisor-megan.jpg" },
    { name: "Gab Martin",    role: "Advisory",                    img: "assets/img/advisor-gab.jpg" }
  ],

  /* --- FAQs ------------------------------------------------------------- */
  faqs: [
    { q: "What is NCBO?", a: "NCBO is a national governing body for collegiate bodybuilding. We sit above independently-run student clubs and provide the season, competition structure, coaching access, and network that an individual club can't build on its own." },
    { q: "How is this different from competing at an open show?", a: "At an open show, \"collegiate\" is just an eligibility line. NCBO adds a club at your school, a structured season, school-vs-school competition, and a year-round community." },
    { q: "Does it cost anything to join?", a: "During our founding phase, membership is free across all tiers. Any individual club dues are set and kept by your local club — NCBO does not touch them." },
    { q: "My school doesn't have a club. Can I start one?", a: "Yes — that's how most clubs begin. Head to Start a Club and we'll give you the playbook, templates, and support to launch." },
    { q: "Do I need to compete to be a member?", a: "No. Plenty of members join for the community, the training, and the events. Competition is there when you're ready for it." },
    { q: "Who runs NCBO?", a: "A founding executive team of students and recent grads, backed by an advisory board that includes IFBB and OCB pros. Meet them on the About page." }
  ],

  /* --- News / updates (the "blog" equivalent) -------------------------- */
  news: [
    { date: "Coming soon", tag: "Season",    title: "Founding season details",        text: "We're locking the first sanctioned event. Dates and format will be posted here.", img: "assets/img/news-1.jpg" },
    { date: "Coming soon", tag: "Clubs",     title: "New clubs joining the network",  text: "Campuses are forming clubs now. Watch this space as the map fills in.",          img: "assets/img/news-2.jpg" },
    { date: "Coming soon", tag: "Coaching",  title: "Pro posing workshops",           text: "Workshop schedule with our advisory pros is being finalized.",                  img: "assets/img/news-3.jpg" }
  ],

  /* --- Forms (replace # with your real Google Form links) -------------- */
  forms: {
    becomeMember: "#",                                  // member signup
    startClub:    "https://forms.gle/p1raPYK4cnLqD4Rb7", // start a club application
    contact:      "#",                                  // general contact form (optional)
    board:        "https://forms.gle/pHHXN3kaTstF2Sw79" // board recruitment (from your records)
  }
};
