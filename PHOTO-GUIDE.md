# Photo guide — drop images here

Every photo on the site has a labeled placeholder until you add the real file.
To add a photo: **save your image at the exact path below.** That's it — it
appears automatically, no code changes. Until then, a styled placeholder shows
so the layout never looks broken.

Use `.jpg` (or change the path in `assets/data.js` if you prefer `.png`/`.webp`).
Keep files reasonably sized (under ~400 KB each) so pages stay fast.

## Hero background (home page)

The hero cycles through photos, crossfading every 6.5 seconds. Drop files at
these paths and each one joins the rotation automatically; any that don't exist
are skipped, so you can add them one at a time.

| File | Best shape |
|------|-----------|
| `hero-1.jpg` … `hero-4.jpg` | wide landscape, ~1920×1200, subject to the right |

Stage shots and packed-gym shots work best — the copy sits over the left half,
so keep that side uncluttered. The list lives in `heroPhotos` in
`assets/data.js` if you want different filenames or more than four.

## Home page
| File | Shows up as | Best shape |
|------|-------------|-----------|
| `tile-clubs.jpg`  | "Find a Club" tile background     | tall / portrait |
| `tile-start.jpg`  | "Apply Today" tile background     | tall / portrait |
| `tile-join.jpg`   | "Become a Member" tile background | tall / portrait |
| `voice-1.jpg` … `voice-3.jpg` | Member testimonial photos | 4:3 landscape |

## Find a Club page
| File | Shows up as | Best shape |
|------|-------------|-----------|
| `club-map.jpg` | The big map banner (or swap for a Google My Maps embed) | wide 21:9 |
| `club-pitt.jpg` | Pitt club card | 16:10 |
| `club-pennstate.jpg` | Penn State club card | 16:10 |
| `club-purdue.jpg` | Purdue club card | 16:10 |
| `club-slipperyrock.jpg` | Slippery Rock club card | 16:10 |
| `club-fsu.jpg` | FSU club card | 16:10 |
| `club-iowa.jpg` | Iowa club card | 16:10 |

## About page
| File | Shows up as | Best shape |
|------|-------------|-----------|
| `team-andrew.jpg`, `team-neha.jpg`, `team-luke.jpg`, `team-vincent.jpg`, `team-rachel.jpg`, `team-alex.jpg`, `team-olivia.jpg` | Leadership headshots | square 1:1 |
| `advisor-jasmine.jpg`, `advisor-megan.jpg`, `advisor-gab.jpg` | Advisory headshots | square 1:1 |

## News page
| File | Shows up as | Best shape |
|------|-------------|-----------|
| `news-1.jpg`, `news-2.jpg`, `news-3.jpg` | News card images | 16:9 |

---

**Want a different photo or filename?** Open `assets/data.js` and change the
`img:` path for that item. Add or remove clubs, voices, team members, and news
posts there too — the pages rebuild themselves from that file.
