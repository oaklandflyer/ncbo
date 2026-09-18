/* ============================================================================
   NCBO_DATA — single source of truth for site content.
   Generated/edited via the admin content manager (admin/photos.html).
   You can still hand-edit this file; the admin overwrites the whole object.

   ── ACCURACY RULES ─────────────────────────────────────────────────────────
   Saving from the admin rewrites this file and drops any comments you added
   by hand, so the rules live here in the generator instead:

     1. Do not publish a name, school, number, date or title that is not
        confirmed in writing. If it cannot be sourced, cut it or ask.
     2. Anything not yet running is described in forward-looking language,
        never as existing.
     3. NCBO is free. No dues, no fees, no payment language anywhere.
     4. Do not publish an email address that nobody monitors.
     5. No em dashes in published copy.

   The `clubsHeld`, `boardHeld`, `advisoryHeld` and `voicesHeld` arrays are
   entries that are deliberately NOT published pending confirmation. Nothing
   renders them. Move an entry into `clubs` / `board` / `advisory` / `voices`
   only once confirmed.

   ── STRUCTURE ──────────────────────────────────────────────────────────────
   The people arrays run top-down in governance order:

     board        independent directors who oversee the CEO (being recruited)
     leadership   the CEO and the executive board that runs operations
     teamMembers  people reporting into an executive board director
     clubLeads    the students running each campus chapter
     advisory     coaching advisors to the clubs, NOT governance

   ========================================================================== */
window.NCBO_DATA = {
  "org": {
    "name": "NCBO",
    "full": "National Collegiate Bodybuilding Organization",
    "tagline": "Student run. Free. Built for club boards.",
    "status": "A student-run organization. Free for every member club.",
    "statusLong": "A student-run organization. Free for every member club.",
    "email": "thencbo@gmail.com",
    "instagram": "https://instagram.com/ncboofficial",
    "instagramHandle": "@ncboofficial",
    "tiktok": "https://tiktok.com/@ncboofficial",
    "tiktokHandle": "@ncboofficial"
  },
  "nav": [
    {
      "label": "Clubs",
      "href": "clubs.html"
    },
    {
      "label": "Why Join",
      "href": "why-join.html"
    },
    {
      "label": "Start a Club",
      "href": "start-a-club.html"
    },
    {
      "label": "Resources",
      "href": "resources.html"
    },
    {
      "label": "About",
      "href": "about.html"
    },
    {
      "label": "Join the Network",
      "href": "contact.html",
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
    "Club boards",
    "Shared resources",
    "Officer handoff",
    "Free",
    "Student run",
    "Network"
  ],
  "hero": {
    "eyebrow": "A network of club boards",
    "title": [
      "The network for",
      "collegiate bodybuilding",
      "<span class='accent'>and fitness club boards.</span>"
    ],
    "sub": "NCBO connects the students running fitness and bodybuilding clubs across schools, so boards can ask each other for help, share what works, and hand the club off intact. Free, and 100% student run.",
    "primary": {
      "label": "Join the Network",
      "href": "contact.html"
    },
    "ghost": {
      "label": "See the clubs",
      "href": "clubs.html"
    }
  },
  "tiles": [
    {
      "kicker": "Member clubs",
      "title": "The Clubs",
      "text": "Every board in the network, and how to reach them.",
      "href": "clubs.html",
      "img": "assets/img/tile-clubs.jpg"
    },
    {
      "kicker": "For boards",
      "title": "Why Join",
      "text": "What your board gets, and what it costs. Nothing.",
      "href": "why-join.html",
      "img": "assets/img/tile-join.jpg"
    },
    {
      "kicker": "No club yet",
      "title": "Start a Club",
      "text": "The short guide to getting one off the ground.",
      "href": "start-a-club.html",
      "img": "assets/img/tile-start.jpg"
    }
  ],
  "about": {
    "label": "What we are",
    "headline": [
      "Built by the students",
      "<span class='accent'>who run the clubs.</span>"
    ],
    "body": [
      "NCBO is a network of collegiate bodybuilding and fitness club boards. It exists so the people running these clubs can reach each other: ask a question, borrow a template, and find out how another school solved the thing in front of you.",
      "It is 100% student run. Every person listed on this page runs or has run a club. There is no staff, no office, and nothing to pay, because there is nothing to pay for.",
      "The org is there when it is needed, not there when it's not."
    ],
    "stats": [
      {
        "num": "6",
        "lab": "Member clubs"
      },
      {
        "num": "4",
        "lab": "States"
      },
      {
        "num": "Free",
        "lab": "Cost to join"
      }
    ]
  },
  "pillars": [
    {
      "title": "A peer network of officers",
      "text": "Ask the board at another school how they did it. Recruiting, elections, gym access, a first show. Someone has already solved it."
    },
    {
      "title": "A shared resource library",
      "text": "Event playbooks, budget templates, waivers, sponsor decks, student government funding applications, and recruiting materials, built by boards like yours."
    },
    {
      "title": "Leadership handoff support",
      "text": "Most clubs die in the gap between one board and the next. We help you hand over what you built so the club survives the turnover."
    },
    {
      "title": "Coaching advisors",
      "text": "Access to competitive bodybuilding coaches who advise our member clubs on training and posing."
    },
    {
      "title": "National affiliation",
      "text": "Being part of a national network helps when you go to your student activities office for recognition, space, or funding."
    },
    {
      "title": "No cost, ever",
      "text": "No dues, no fees, no obligations. Nothing to sign, and nothing to pay. Use what helps and ignore the rest."
    }
  ],
  "clubs": [
    {
      "school": "University of Pittsburgh",
      "name": "Fitness and Bodybuilding Club",
      "lead": "Rachel Hare",
      "instagram": "TODO",
      "contact": "TODO",
      "status": "Active",
      "img": "assets/img/club-pitt.jpg"
    },
    {
      "school": "Penn State University",
      "name": "Bodybuilding & Fitness Club",
      "note": "University Park",
      "lead": "Isabel Ward",
      "instagram": "TODO",
      "contact": "TODO",
      "status": "Active",
      "img": "assets/img/club-pennstate.jpg"
    },
    {
      "school": "Purdue University",
      "name": "Purdue Bodybuilding Club",
      "lead": "Vincent Panzica",
      "instagram": "TODO",
      "contact": "TODO",
      "status": "Active",
      "img": "assets/img/club-purdue.jpg"
    },
    {
      "school": "Florida State University",
      "name": "Bodybuilding and Fitness Club at FSU",
      "lead": "Eli Korta",
      "instagram": "TODO",
      "contact": "TODO",
      "status": "Active",
      "img": "assets/img/club-fsu.jpg"
    },
    {
      "school": "University of Iowa",
      "name": "Bodybuilding Club at UIowa",
      "lead": "Alex Swanson",
      "instagram": "TODO",
      "contact": "TODO",
      "status": "Active",
      "img": "assets/img/club-iowa.jpg"
    },
    {
      "school": "Slippery Rock University",
      "name": "Slippery Rock Fitness and Wellness Club",
      "lead": "Sean Hanley",
      "instagram": "TODO",
      "contact": "TODO",
      "status": "Active",
      "img": "assets/img/club-slippery-rock-university.jpg",
      "state": "PA"
    }
  ],
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
      "title": "Find two or three people",
      "text": "A club needs a few committed students before it needs anything else. Start with the people who already train together."
    },
    {
      "step": "02",
      "title": "Check your school's process",
      "text": "Every student activities office has its own forms, deadlines, and advisor requirement. Find that page first, before you plan anything."
    },
    {
      "step": "03",
      "title": "Borrow what exists",
      "text": "Constitutions, waivers, budgets, and callout flyers have all been written by boards before you. Ask us and we will send what we have."
    },
    {
      "step": "04",
      "title": "Hold a first meeting",
      "text": "Pick a date, put it up, and run it. The first meeting is how you find out who is actually in."
    }
  ],
  "board": [],
  "boardHeld": [],
  "leadership": [
    {
      "name": "Andrew Coutinho",
      "role": "Chief Executive Officer",
      "img": "assets/img/team-andrew.jpg"
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
      "name": "Vincent Panzica",
      "role": "Director of Club Expansion",
      "img": "assets/img/team-vincent.jpg"
    }
  ],
  "teamMembers": [
    {
      "name": "Lauren Rowe",
      "role": "Marketing Team",
      "img": "assets/img/team-lauren-rowe.jpg"
    }
  ],
  "advisory": [
    {
      "name": "Neha Kotha",
      "role": "Coaching Advisor",
      "img": "assets/img/advisor-neha-kotha.jpg"
    },
    {
      "name": "Jasmine Amato",
      "role": "Coaching Advisor",
      "img": "assets/img/advisor-jasmine-amato.jpg"
    },
    {
      "name": "Megan Chaney",
      "role": "Coaching Advisor",
      "img": "assets/img/advisor-megan-chaney.jpg"
    }
  ],
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
      "a": "A network of the students who run collegiate bodybuilding and fitness clubs. Boards use it to ask each other for help, share resources, and hand the club off cleanly when officers change. It is 100% student run."
    },
    {
      "q": "What does it cost?",
      "a": "Nothing. There are no dues, no fees, and no payment of any kind. NCBO is free for every member club."
    },
    {
      "q": "Does NCBO run our club?",
      "a": "No. We are not a governing body. Your club stays yours, run your way, under your school's rules. There is nothing to sign and no standard to comply with. The org is there when it is needed, not there when it's not."
    },
    {
      "q": "Who can join?",
      "a": "Any bodybuilding or fitness club board at a college or university. You join as a board, not as individual students."
    },
    {
      "q": "What if my school has no club?",
      "a": "Start one. Head to Start a Club for the short guide, and get in touch if you want help."
    },
    {
      "q": "What is actually in the resource library?",
      "a": "Event playbooks, budget templates, waivers, sponsor decks, student government funding applications, and recruiting materials. It is built from what member boards have already made, so it grows as clubs join."
    },
    {
      "q": "What do you ask of member clubs?",
      "a": "Nothing required. Share what you have built when you can, and answer another board when they ask. That is the whole deal."
    },
    {
      "q": "Who runs NCBO?",
      "a": "Students. An executive board of club officers and recent grads, listed on the About page."
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
  },
  "voices": [],
  "clubLeads": [
    {
      "name": "Rachel Hare",
      "school": "University of Pittsburgh",
      "img": "assets/img/lead-rachel-hare.jpg"
    },
    {
      "name": "Isabel Ward",
      "school": "Penn State University",
      "img": ""
    },
    {
      "name": "Vincent Panzica",
      "school": "Purdue University",
      "img": "assets/img/lead-vincent-panzica.jpg"
    },
    {
      "name": "Eli Korta",
      "school": "Florida State University",
      "img": "assets/img/lead-eli-korta.jpg"
    },
    {
      "name": "Alex Swanson",
      "school": "University of Iowa",
      "img": "assets/img/lead-alex-swanson.jpg"
    },
    {
      "name": "Sean Hanley",
      "school": "Slippery Rock University",
      "img": "assets/img/lead-sean-hanley.jpg"
    }
  ]
};
