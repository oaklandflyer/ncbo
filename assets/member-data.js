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
    "sub": "Enter your member access code to get into the season hub — meet schedules, posing and prep resources, club channels, and the Q&A board.",
    "placeholder": "Access code",
    "help": "Your club lead sends the code out at the start of each season. Lost it? Ask your lead or email us and we'll get you back in.",
    "error": "That code isn't right. Check with your club lead — codes rotate each season.",
    "remember": "Keep me signed in on this device"
  },

  /* ── Dashboard ──────────────────────────────────────────────────────── */
  "welcome": {
    "eyebrow": "Season hub",
    "title": "Welcome back.",
    "sub": "Everything the network is running right now — dates, resources, and the people to ask."
  },

  "stats": [
    { "num": "6", "lab": "Clubs in network" },
    { "num": "4", "lab": "Meets this season" },
    { "num": "12", "lab": "Weeks to nationals" },
    { "num": "24/7", "lab": "Q&A board" }
  ],

  "announcements": [
    {
      "tag": "Season",
      "date": "Aug 18",
      "title": "Fall season registration is open",
      "text": "Club leads: submit your roster and school affiliation form before the first meet. Members compete under their club, so you need to be on the roster to be scored."
    },
    {
      "tag": "Meets",
      "date": "Aug 04",
      "title": "Regional meet schedule posted",
      "text": "Four scored meets plus nationals. Check the calendar for host schools, weigh-in windows, and division cutoffs."
    },
    {
      "tag": "Resources",
      "date": "Jul 28",
      "title": "New posing library up",
      "text": "Mandatory pose breakdowns for men's classic physique and women's wellness are in Resources, with a stage-walk checklist you can print."
    }
  ],

  /* ── Season calendar ────────────────────────────────────────────────── */
  "calendar": [
    { "date": "Sep 13", "title": "Season opener — Pittsburgh", "where": "University of Pittsburgh", "status": "Confirmed" },
    { "date": "Oct 11", "title": "Midwest dual meet", "where": "Purdue University", "status": "Confirmed" },
    { "date": "Nov 08", "title": "East regional", "where": "Penn State University", "status": "Confirmed" },
    { "date": "Dec 06", "title": "NCBO Nationals", "where": "Host TBA", "status": "Tentative" }
  ],

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

  "questions": [
    {
      "channel": "general",
      "q": "Do I have to compete to be a member?",
      "who": "Member · Florida State",
      "when": "2d ago",
      "answers": [
        { "who": "NCBO staff", "text": "No. Plenty of members train with their club and never step on stage — the club is the point, competing is an option inside it. Membership gets you the resources, the board, and the network whether or not you ever register for a meet." }
      ]
    },
    {
      "channel": "general",
      "q": "Can I be a member if my school doesn't have a club yet?",
      "who": "Member · Ohio State",
      "when": "6d ago",
      "answers": [
        { "who": "NCBO staff", "text": "Yes — you join as an unaffiliated member and get everything here. If you want to compete for a school you need a recognized club, and most of them started with exactly one person in your position. The club lead playbook in Resources is the whole process start to finish." }
      ]
    },
    {
      "channel": "prep",
      "q": "How early should a first-time competitor start prep?",
      "who": "Member · Pitt",
      "when": "3d ago",
      "answers": [
        { "who": "Coach panel", "text": "For a first show, 16–20 weeks is the honest range. Starting earlier lets you lose slower, hold more muscle, and still have room if school gets heavy. Anything under 12 weeks usually means an aggressive deficit on top of a full course load — it works for some people and wrecks others." }
      ]
    },
    {
      "channel": "posing",
      "q": "Do I need a coach for posing, or can I learn the mandatories myself?",
      "who": "Member · Purdue",
      "when": "5d ago",
      "answers": [
        { "who": "Coach panel", "text": "Start with the posing library in Resources and film yourself weekly — most first-timers fix half their issues just by watching the footage. Bring the video to a club posing night before you pay anyone; club leads run these and they're free." }
      ]
    },
    {
      "channel": "meets",
      "q": "Who covers travel to away meets?",
      "who": "Club lead · Slippery Rock",
      "when": "1w ago",
      "answers": [
        { "who": "NCBO staff", "text": "It varies by school. Most clubs split gas and rooms across the traveling group; a few have pulled student-government funding once they were officially recognized. The travel & fundraising doc in Resources has the funding request template that worked at Pitt and Penn State." }
      ]
    },
    {
      "channel": "club-leads",
      "q": "What does my school need from me to recognize the club?",
      "who": "Club lead · Iowa",
      "when": "1w ago",
      "answers": [
        { "who": "NCBO staff", "text": "Usually a constitution, an advisor, and a roster minimum — the club lead playbook has an NCBO-ready constitution you can drop your school's name into. Email us once you've submitted and we'll follow up with your student activities office if they have questions about the org." }
      ]
    },
    {
      "channel": "nutrition",
      "q": "Any way to hit protein on a meal plan?",
      "who": "Member · Penn State",
      "when": "2w ago",
      "answers": [
        { "who": "Coach panel", "text": "Anchor every dining-hall trip to a lean protein first and build the plate around it, then cover the gap with shakes you keep in your room. The nutrition doc has a swap list for the ten most common dining-hall setups." }
      ]
    }
  ],

  "ask": {
    "title": "Ask the network",
    "text": "Questions go to the coach panel and NCBO staff. Answered questions get posted back to the board so the next person doesn't have to ask.",
    "note": "Drafts you write here stay in this browser until you send them — this site has no server behind it.",
    "form": "#"
  },

  /* ── Directory / map ────────────────────────────────────────────────── */
  "directory": {
    "eyebrow": "The network",
    "title": "Who's out there.",
    "sub": "Tap a campus to pull up the club and its lead. Reach out — cross-club training sessions and carpools start here."
  }
};
