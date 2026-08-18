/* ============================================================================
   NCBO_MEMBER — content for the members-only area (members.html).

   Kept separate from assets/data.js on purpose: the admin content manager
   (admin/photos.html) rewrites data.js wholesale, so member content lives here
   where it won't get clobbered.

   ── Who gets in ───────────────────────────────────────────────────────────
   Sign-in is a magic link sent to the member's email, handled by Supabase
   (assets/ncbo-auth.js). Accounts live in Postgres; a .edu address at a
   chapter school is approved on signup, everyone else waits for an admin on
   review.html. There is no password file in this repository any more.

   This file is only fetched once the hub actually renders — but that is a
   convenience, not a wall. On static hosting anyone can request it directly.
   Treat what you put here the way you'd treat a printed members-only handout:
   fine for schedules, resources and Q&A; not for personal contact details,
   payment information, or anything you'd be upset to see forwarded.
   See SECURITY-NOTES.md.
   ========================================================================== */
window.NCBO_MEMBER = {

  /* ── Dashboard ──────────────────────────────────────────────────────── */
  "welcome": {
    "eyebrow": "Member hub",
    "title": "Welcome back.",
    "sub": "We're early — this hub fills in as the network builds. Right now it's the chapter directory and the people to ask."
  },

  /* Only numbers we can evidence. No season is scheduled, so there is no
     meet count and no countdown.

     Keep "Founding chapters" in step with NCBO_DATA.clubs in assets/data.js --
     the chapter directory further down this same page is rendered from that
     array, so a stale number here contradicts the list directly below it.
     Six chapters as of Aug 2026. */
  "stats": [
    { "num": "6", "lab": "Founding chapters" },
    { "num": "4", "lab": "States" }
  ],

  /* Announcements cleared (Aug 2026 accuracy pass).
     The three entries here announced a registration window, a posted meet
     schedule and a published posing library — none of which exist. Post
     only things that have actually happened. */
  "announcements": [],

  /* ── Season calendar ────────────────────────────────────────────────
     Cleared. The four dated meets previously listed here (a Sep 13 opener
     at Pitt, an Oct 11 dual at Purdue, a Nov 8 regional at Penn State and
     "NCBO Nationals" in December, three of them marked Confirmed) were not
     scheduled with any of those schools. No season is on the calendar. */
  "calendar": [],
  "calendarEmpty": "No season is scheduled yet. When the first event is confirmed with a host school, it will appear here.",

  /* ── Resources ──────────────────────────────────────────────────────
     These describe the member hub reference pages (see web/ in this repo):
     four written pages plus four downloadable club templates.

     Every href is "#" on purpose. app.js renders a non-clickable row flagged
     "In development" for anything that is not an absolute http(s) URL, which is
     the honest state until the hub is actually deployed -- see
     docs/DEFERRED.md, "Deployment". Once it is live, swap each "#" for its real
     URL (https://thencbo.org/resources/prep and so on) and the rows become
     links with no other change needed.

     Two entries were removed in this pass rather than rewritten:

       - "Training templates ... in-season, off-season, and peak week." NCBO's
         content policy prohibits publishing peak-week water, electrolyte or
         diuretic protocols, which is what a peak-week template is usually asked
         for. Advertising one commits us to writing something we will not write.
         See docs/CONTENT-POLICY.md.
       - "Off-season to stage timeline -- a 16-week framework." The same policy
         rules out publishing cut timelines. Rate-of-loss guidance from the
         published literature is in the prep guide instead, without a countdown.

     "Brand kit" is also gone: nobody is writing one, and a resource list is not
     a wish list. Add it back when it exists. */
  "resourceGroups": [
    {
      "group": "Competing",
      "items": [
        { "title": "The competition pathway", "text": "How collegiate competitors actually get on stage today: NPC collegiate eligibility, the NPC card you have to buy in advance, the divisions, and the drug-tested federations as a separate route. Sourced and dated.", "href": "#" },
        { "title": "How standing works", "text": "The scoring formula in full -- points per 1,000 undergraduates, shrunk toward the league mean -- plus a worked example and an honest account of its limits.", "href": "#" }
      ]
    },
    {
      "group": "Prep & health",
      "items": [
        { "title": "Evidence-based contest prep", "text": "Rate of loss, protein, fat and carbohydrate, meal distribution, and the three supplements with real evidence behind them. Grounded in Helms et al. (2014) and the ISSN protein position stand, with sources on the page.", "href": "#" },
        { "title": "Health & wellbeing", "text": "Relative Energy Deficiency in Sport per the 2023 IOC consensus, eating disorder risk in aesthetic sport, and where to get help -- starting with your campus counselling and sports medicine services.", "href": "#" },
        { "title": "Supplement safety", "text": "Third-party certification, what NSF Certified for Sport does and does not protect you from, and why an uncertified product is an eligibility risk. Part of the prep guide.", "href": "#" }
      ]
    },
    {
      "group": "Club operations",
      "items": [
        { "title": "Club lead playbook", "text": "Officer structure, annual recertification, waivers and emergency contacts, first aid and CPR cover, travel rules, hazing prohibition and reporting, fundraising approval, and facility booking.", "href": "#" },
        { "title": "Club templates", "text": "Officer transition checklist, event risk assessment, recruiting table kit and meeting agenda -- editable Markdown and printable PDF.", "href": "#" }
      ]
    }
  ],

  /* ── Channels + Q&A board ───────────────────────────────────────────── */
  "channels": [
    { "id": "general",     "name": "General",        "desc": "Anything network-wide." },
    /* "peak week" was dropped from this description deliberately. The topic is
       not banned -- training, posing, travel and nerves in the final week are
       all fair questions. But answers posted to this board appear publicly on
       this page, and NCBO does not publish water, electrolyte or diuretic
       manipulation protocols in any form. Naming peak week in the invitation
       solicits exactly the question we cannot answer. See docs/CONTENT-POLICY.md. */
    { "id": "prep",        "name": "Prep & Training","desc": "Programming, training through a prep, and everything before stage." },
    { "id": "nutrition",   "name": "Nutrition",      "desc": "Dining halls, budgets, cutting and filling." },
    { "id": "posing",      "name": "Posing",         "desc": "Mandatories, routines, stage presence." },
    { "id": "club-leads",  "name": "Club Leads",     "desc": "Running a club: roster, school paperwork, recruiting." },
    { "id": "meets",       "name": "Meets",          "desc": "Travel, logistics, and meet-day questions." }
  ],

  /* Q&A board cleared (Aug 2026 accuracy pass).
     The seven entries here were invented: questions attributed to unnamed
     members and club leads at Pitt, Purdue, Penn State, Iowa, Florida State
     and Ohio State (which has no chapter), answered by an "NCBO staff" and a
     "Coach panel" that don't exist as standing bodies. One answer claimed a
     funding template "worked at Pitt and Penn State"; another promised NCBO
     would follow up with a student activities office. Seed this board with
     real questions only. */
  "questions": [],
  "questionsEmpty": "No questions on the board yet. Be the first — ask below and we'll post the answer here.",

  "ask": {
    "title": "Ask the network",
    "text": "Questions go to the NCBO exec team. Answered questions get posted back to the board so the next person doesn't have to ask. Some things we won't answer here: we don't publish water, electrolyte or diuretic protocols, or anything about banned substances beyond what the rules are — those belong with your campus sports medicine service, not a message board.",
    "note": "Drafts you write here stay in this browser until you send them — this site has no server behind it.",
    "form": "#"
  },

  /* ── Directory / map ────────────────────────────────────────────────── */
  "directory": {
    "eyebrow": "The network",
    "title": "Who's out there.",
    "sub": "Our founding chapters. Where a lead is confirmed, reach out — cross-club training sessions and carpools start here."
  }
};
