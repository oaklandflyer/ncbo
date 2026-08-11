/* ============================================================================
   NCBO_DATA — single source of truth for site content.
   Generated/edited via the admin content manager (admin/photos.html).
   You can still hand-edit this file; the admin overwrites the whole object.

   ── ACCURACY NOTE (Aug 2026) ───────────────────────────────────────────────
   This file was audited against internal records. Two rules apply to edits:

     1. Do not publish a name, school, number, date or title that isn't
        confirmed in writing. If it can't be sourced, cut it or ask.
     2. Anything not yet running (season, competitions, dues model, app)
        is described in forward-looking language, never as existing.

   `clubsHeld` and `advisoryHeld` below are entries deliberately NOT published
   pending confirmation. They are kept here so restoring one is a one-line
   move back into `clubs` / `advisory` — do not render them.
   ========================================================================== */
window.NCBO_DATA = {
  "org": {
    "name": "NCBO",
    "full": "National Collegiate Bodybuilding Organization",
    "tagline": "Clubs. Competition. Community.",
    /* Legal status — NCBO is not yet incorporated and is not a 501(c)(3). */
    "status": "A Pennsylvania nonprofit corporation in formation.",
    "statusLong": "NCBO is a Pennsylvania nonprofit corporation in formation. We intend to apply for 501(c)(3) status; that status has not been granted, and contributions are not tax-deductible.",
    /* QUESTION OPEN: is this inbox live and owned? The chapter playbook still
       publishes info@ncbo.org, which does not exist. Do not add a response-time
       promise to any address until someone owns the inbox. */
    "email": "thencbo@gmail.com",
    "instagram": "https://instagram.com/ncboofficial",
    "instagramHandle": "@ncboofficial",
    "tiktok": "https://tiktok.com/@ncboofficial",
    "tiktokHandle": "@ncboofficial"
  },
  "nav": [
    {
      "label": "Home",
      "href": "index.html"
    },
    {
      "label": "Members",
      "href": "members.html"
    },
    {
      "label": "Join NCBO",
      "href": "join.html",
      "cta": true
    }
  ],
  "heroPhotos": [
    "assets/img/hero-1.jpg",
    "assets/img/hero-2.jpg",
    "assets/img/hero-3.jpg",
    "assets/img/hero-4.jpg"
  ],
  "marquee": [
    "Clubs",
    "Competition",
    "Community",
    "Strength",
    "Discipline",
    "Pathway"
  ],
  "hero": {
    "eyebrow": "Building the collegiate bodybuilding network",
    "title": [
      "Collegiate",
      "bodybuilding,",
      "<span class='accent'>built like a real sport.</span>"
    ],
    "sub": "At an open show, “collegiate” is just an eligibility checkbox. We're building the part that's missing — a club at your school, a season to train for, and school-vs-school competition. Find your chapter and help build it.",
    "primary": {
      "label": "Find your club",
      "href": "#clubs"
    },
    "ghost": {
      "label": "How it works",
      "href": "#about"
    }
  },
  "tiles": [
    {
      "kicker": "Chapters",
      "title": "Find a Club",
      "text": "See the schools with an NCBO founding chapter.",
      "href": "#clubs",
      "img": "assets/img/tile-clubs.jpg"
    },
    {
      "kicker": "Start a Club",
      "title": "Apply Today",
      "text": "Bring NCBO to your campus — we'll help you build.",
      "href": "#start",
      "img": "assets/img/tile-start.jpg"
    },
    {
      "kicker": "Join Now",
      "title": "Become a Member",
      "text": "Get plugged into a club at your school.",
      "href": "join.html",
      "img": "assets/img/tile-join.jpg"
    }
  ],
  "about": {
    "label": "What We Are",
    "headline": [
      "Not another open show.",
      "A real <span class='accent'>collegiate sport.</span>"
    ],
    "body": [
      "NCBO is being built to sit alongside independently-run student clubs and give them what a single club can't build alone: a season, school-vs-school competition, coaching access, and a national network.",
      "At a traditional open show, \"collegiate\" is just an eligibility checkbox. We're adding the part that's been missing — a club at your school, a season to train for, and a community that shows up year-round.",
      "We're early, and we'd rather say so. NCBO is a Pennsylvania nonprofit corporation in formation. Our founding chapters are live; the season, the competition calendar and the dues model are still being built."
    ],
    "stats": [
      {
        "num": "5",
        "lab": "Founding chapters"
      },
      {
        "num": "4",
        "lab": "States"
      },
      {
        "num": "In formation",
        "lab": "Org status"
      }
    ]
  },
  "pillars": [
    {
      "title": "Coach & pro access",
      "text": "Posing and prep guidance we're lining up for our chapters, so members aren't figuring out stage craft alone."
    },
    {
      "title": "A club operating system",
      "text": "Recruiting templates, officer structure, and a run-it playbook so your club doesn't start from zero."
    },
    {
      "title": "Legitimacy on campus",
      "text": "Shared structure and standards you can take to your student activities office when you apply for recognition."
    },
    {
      "title": "A national network",
      "text": "Cross-campus connection, shared events, and a path to school-vs-school competition."
    }
  ],
  "clubs": [
    {
      "school": "University of Pittsburgh",
      "name": "Fitness and Bodybuilding Club",
      "lead": "",
      "status": "Active",
      "img": "assets/img/club-pitt.jpg"
    },
    {
      "school": "Penn State University",
      "name": "Bodybuilding & Fitness Club",
      "note": "University Park",
      "lead": "",
      "status": "Active",
      "img": "assets/img/club-pennstate.jpg"
    },
    {
      "school": "Purdue University",
      "name": "Purdue Bodybuilding Club",
      "lead": "",
      "status": "Active",
      "img": "assets/img/club-purdue.jpg"
    },
    {
      "school": "Florida State University",
      "name": "Bodybuilding and Fitness Club at FSU",
      "lead": "",
      "status": "Active",
      "img": "assets/img/club-fsu.jpg"
    },
    {
      "school": "University of Iowa",
      "name": "Bodybuilding Club at UIowa",
      "lead": "Alex Swanson",
      "status": "Active",
      "img": "assets/img/club-iowa.jpg"
    }
  ],
  /* NOT PUBLISHED — pending confirmation. Do not render.
     Slippery Rock appears in the founding-club list but has no named lead,
     so it cannot be listed as an active chapter. Awaiting a decision on
     whether to include it (and how to label it) or drop it. */
  "clubsHeld": [
    {
      "school": "Slippery Rock University",
      "name": "Bodybuilding & Fitness Club",
      "lead": "",
      "status": "No lead",
      "img": "assets/img/club-slipperyrock.jpg",
      "heldReason": "No named, contactable lead as of Aug 2026."
    }
  ],
  "joinSteps": [
    {
      "step": "01",
      "title": "Find your chapter",
      "text": "Check the Find a Club section. If your school is listed, you're one message away."
    },
    {
      "step": "02",
      "title": "No club yet?",
      "text": "Start one. We give you the playbook, templates, and support to launch."
    },
    {
      "step": "03",
      "title": "Join through your club",
      "text": "Membership runs through your campus club. Dues aren't finalized yet — we'll publish the model before anyone is asked to pay anything."
    },
    {
      "step": "04",
      "title": "Train with your club",
      "text": "Show up and train. When the first season runs, you'll have the option to represent your school."
    }
  ],
  "leadership": [
    {
      "name": "Andrew Coutinho",
      "role": "President & Founder",
      "img": "assets/img/team-andrew.jpg"
    },
    {
      "name": "Neha Kotha",
      "role": "Vice President of Operations",
      "img": "assets/img/team-neha.jpg"
    },
    {
      "name": "Luke Rudolph",
      "role": "Director of Finance",
      "img": "assets/img/team-luke.jpg"
    },
    {
      "name": "Olivia Durbin",
      "role": "Director of Marketing",
      "img": "assets/img/team-olivia.jpg"
    },
    {
      "name": "Alex Swanson",
      "role": "Director of Events",
      "img": "assets/img/team-alex.jpg"
    },
    {
      /* Title intentionally blank: four conflicting titles on record.
         Do not publish one until it is resolved. */
      "name": "Vincent Panzica",
      "role": "",
      "img": "assets/img/team-vincent.jpg"
    },
    {
      "name": "Matt Deemer",
      "role": "Co-Founder",
      "img": "assets/img/team-matt.jpg"
    },
    {
      "name": "Will Gordinier",
      "role": "Co-Founder",
      "img": "assets/img/team-will.jpg"
    }
  ],
  "advisory": [],
  /* NOT PUBLISHED — pending confirmation. Do not render.
     Listed internally as advisors but never formally confirmed, and the
     IFBB/OCB pro designations are not sourced. */
  "advisoryHeld": [
    {
      "name": "Jasmine Amato",
      "role": "",
      "img": "assets/img/advisor-jasmine.jpg",
      "heldReason": "Advisory appointment never formally confirmed."
    },
    {
      "name": "Megan Chaney",
      "role": "",
      "img": "assets/img/advisor-megan.jpg",
      "heldReason": "Advisory appointment never formally confirmed."
    }
  ],
  /* NOT PUBLISHED — pending confirmation. Do not render.
     Three testimonials that ran on the home page. None is attributed to a
     named, reachable person and none can be sourced, so they read as
     invented. Restore only if they can be tied to real members who agreed. */
  "voicesHeld": [
    {
      "quote": "NCBO turned lifting alone into showing up with a team. Having a club at my school changed how I train and who I train with.",
      "name": "NCBO member",
      "club": "Bodybuilding and Fitness Club at Pitt",
      "img": "assets/img/voice-1.jpg"
    },
    {
      "quote": "The structure is the difference. A season to point at, a club to run, people to answer to — it makes the work mean something.",
      "name": "Club officer",
      "club": "Purdue club",
      "img": "assets/img/voice-2.jpg"
    },
    {
      "quote": "Getting posing feedback from actual pros, as a college student, is something I never thought I'd have access to.",
      "name": "Member",
      "club": "Penn State club",
      "img": "assets/img/voice-3.jpg"
    }
  ],
  "faqs": [
    {
      "q": "What is NCBO?",
      "a": "NCBO is a national organization being built for collegiate bodybuilding. The idea is to sit alongside independently-run student clubs and provide the season, competition structure, coaching access, and network that an individual club can't build on its own. Our founding chapters are live; most of the rest is in development."
    },
    {
      "q": "Is NCBO a registered nonprofit?",
      "a": "Not yet. NCBO is a Pennsylvania nonprofit corporation in formation. We intend to apply for 501(c)(3) status, but that status has not been granted and contributions are not tax-deductible."
    },
    {
      "q": "How will this be different from competing at an open show?",
      "a": "At an open show, \"collegiate\" is just an eligibility line. NCBO adds a club at your school and a year-round community — and, once it's built, a structured season and school-vs-school competition."
    },
    {
      "q": "What will it cost?",
      "a": "We haven't finalized dues. Two models are still being worked through with our chapters, and neither has been approved. We'll publish the model here before anyone is asked to pay anything."
    },
    {
      "q": "My school doesn't have a club. Can I start one?",
      "a": "Yes — that's how our chapters began. Head to Start a Club and we'll give you the playbook, templates, and support to launch."
    },
    {
      "q": "Do I need to compete to be a member?",
      "a": "No. Plenty of members join for the community and the training. Competition will be there when you're ready for it."
    },
    {
      "q": "Who runs NCBO?",
      "a": "A founding team of students and recent grads. You can see them in the Leadership section above."
    }
  ],
  "news": [
    {
      "date": "Coming soon",
      "tag": "Season",
      "title": "Founding season details",
      "text": "We're working toward a first event. Nothing is scheduled yet — dates and format will be posted here once they are.",
      "img": "assets/img/news-1.jpg"
    },
    {
      "date": "Coming soon",
      "tag": "Chapters",
      "title": "New chapters joining the network",
      "text": "More campuses are in conversation with us. Watch this space as the map fills in.",
      "img": "assets/img/news-2.jpg"
    },
    {
      "date": "Coming soon",
      "tag": "Coaching",
      "title": "Pro posing workshops",
      "text": "We're working on a workshop schedule with coaches we're bringing in. Nothing is booked yet.",
      "img": "assets/img/news-3.jpg"
    }
  ],
  "forms": {
    "becomeMember": "#",
    "startClub": "https://forms.gle/p1raPYK4cnLqD4Rb7",
    "contact": "#",
    "board": "https://forms.gle/pHHXN3kaTstF2Sw79"
  }
};
