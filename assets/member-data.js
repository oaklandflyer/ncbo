/* ============================================================================
   NCBO_MEMBER — content for the members-only area (members.html).

   Kept separate from assets/data.js on purpose: the admin content manager
   (admin/photos.html) rewrites data.js wholesale, so member content lives here
   where it won't get clobbered.

   ── Access codes ──────────────────────────────────────────────────────────
   `access.codes` is the list of codes that unlock the member app. Codes are
   compared case-insensitively with surrounding whitespace trimmed.

   IMPORTANT: this is a static site with no server, so the gate is a
   convenience lock, not real security — anyone who opens dev tools can read
   the codes out of this file. Don't put anything genuinely sensitive behind
   it (rosters with personal contact info, payment details, judging keys).
   Rotate the code each season and treat the material inside as
   "members-only" the way a printed handout is.
   ========================================================================== */
window.NCBO_MEMBER = {

  "access": {
    "codes": ["NCBO2026"],
    "eyebrow": "Members only",
    "title": ["The member", "locker room."],
    "sub": "Enter your member access code to get into the member hub — the chapter directory, and resources as they come online.",
    "placeholder": "Access code",
    "help": "Your club lead has the code. Lost it? Ask your lead or email us and we'll get you back in.",
    "error": "That code isn't right. Check with your club lead.",
    "remember": "Keep me signed in on this device"
  },

  /* ── Dashboard ──────────────────────────────────────────────────────── */
  "welcome": {
    "eyebrow": "Member hub",
    "title": "Welcome back.",
    "sub": "We're early — this hub fills in as the network builds. Right now it's the chapter directory and the people to ask."
  },

  /* Only numbers we can evidence. No season is scheduled, so there is no
     meet count and no countdown. */
  "stats": [
    { "num": "5", "lab": "Founding chapters" },
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

  /* ── Resources ──────────────────────────────────────────────────────── */
  "resourceGroups": [
    {
      "group": "Competition",
      "items": [
        { "title": "Rulebook & scoring", "text": "Divisions, weight classes, judging criteria, and how school-vs-school points are awarded.", "href": "#" },
        { "title": "Meet-day checklist", "text": "What to bring, weigh-in timing, tanning and trunks rules, backstage flow.", "href": "#" },
        { "title": "Posing library", "text": "Mandatory poses by division, with a printable stage-walk sheet.", "href": "#" }
      ]
    },
    {
      "group": "Prep",
      "items": [
        { "title": "Off-season to stage timeline", "text": "A 16-week framework club leads can adapt for first-time competitors.", "href": "#" },
        { "title": "Nutrition basics", "text": "Practical guidance built for a college dining hall and a student budget.", "href": "#" },
        { "title": "Training templates", "text": "Split templates for in-season, off-season, and peak week.", "href": "#" }
      ]
    },
    {
      "group": "Club operations",
      "items": [
        { "title": "Club lead playbook", "text": "Recruiting, running meetings, keeping a roster, and staying in good standing with your school.", "href": "#" },
        { "title": "Brand kit", "text": "NCBO crest, colors, and templates for club flyers and socials.", "href": "#" },
        { "title": "Travel & fundraising", "text": "How other clubs cover meet travel — sponsorships, dues, and school funding.", "href": "#" }
      ]
    }
  ],

  /* ── Channels + Q&A board ───────────────────────────────────────────── */
  "channels": [
    { "id": "general",     "name": "General",        "desc": "Anything network-wide." },
    { "id": "prep",        "name": "Prep & Training","desc": "Programming, peak week, and everything before stage." },
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
    "text": "Questions go to the NCBO exec team. Answered questions get posted back to the board so the next person doesn't have to ask.",
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
