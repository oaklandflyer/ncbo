-- ============================================================================
-- The Q&A starter library.
--
-- Persona 2 in the brief is the person already lifting who wants to know how
-- prep works, what division they are, what a coach costs, and how far out to
-- start. Their whole Home screen leads with Q&A. If that board is empty on the
-- day they arrive, the app has answered "what is this for" with "nothing", and
-- they do not come back to check whether it filled up.
--
-- So the board opens with 30 answered questions rather than a prompt to be the
-- first to ask one.
--
-- ── Two things about the authorship, which matter more than the content ─────
--
-- These answers are written as reference material and attributed to an
-- editorial account, NOT to Neha Kotha, Jasmine Amato or Megan Chaney. Seeding
-- answers under a real advisor's name would be putting words in a real
-- person's mouth, on a board where their name is the entire reason a member
-- trusts what it says. The three of them can adopt, rewrite, or delete any of
-- these; until one of them does, the byline says where it actually came from.
--
-- The account is marked `advisor` so its answers pass the same policy an
-- advisor's do, and every row here carries `[starter]` in the notes so a
-- moderator can find and clear the whole set in one query:
--
--   delete from public.answers where body like '%[starter]%';
--
-- ── And one thing about the content ────────────────────────────────────────
--
-- Everything below is general, uncontroversial, and the kind of thing any
-- competent coach would say. Nothing here is medical advice, nothing names a
-- dose, and anything that turns on an individual's circumstances says so and
-- points at a person. That is deliberate: the failure mode for a seeded
-- knowledge base is sounding authoritative about something it cannot know.
-- ============================================================================

-- ── the editorial account ───────────────────────────────────────────────────
-- A profile with no auth user behind it: nobody signs in as this, it exists to
-- own the starter rows. `profiles.id` references `auth.users`, so the row is
-- created there first, without a password or a usable address.
do $$
declare
  editor uuid := '00000000-0000-4000-a000-00000000ed17';
  general uuid;
begin
  if not exists (select 1 from auth.users where id = editor) then
    insert into auth.users (id, email) values (editor, 'coaching-desk@thencbo.invalid');
  end if;

  -- `.invalid` is reserved by RFC 2606 and can never be a deliverable
  -- address, so this account cannot be signed into by magic link even if
  -- somebody tried.
  update public.profiles
     set display_name = 'NCBO Coaching Desk',
         full_name    = 'NCBO Coaching Desk',
         status       = 'approved',
         approved_at  = coalesce(approved_at, now()),
         is_adult     = true
   where id = editor;

  insert into public.org_roles (user_id, role)
  values (editor, 'coaching_advisor')
  on conflict do nothing;

  select id into general from public.channels where slug = 'prep';

  -- Questions and answers as one list, so a reader can see the pairing and the
  -- two inserts below cannot drift apart. A temp table rather than a CTE
  -- because a CTE is scoped to one statement and this is read twice.
  create temp table starter_qa (body text, answer text) on commit drop;

  insert into starter_qa (body, answer) values
    ('How far out from a show should I start prep?',
     'For a first show, 16 to 20 weeks is the usual window, and the honest answer is that it depends far more on where you are starting than on the calendar. The number people actually need is how much fat they have to lose and how fast they can lose it without wrecking their training: roughly 0.5 to 1% of bodyweight per week is sustainable for most people. Work backwards from that. If that arithmetic says 24 weeks, take 24 weeks. Starting late and accelerating is the single most common way a first prep goes badly.'),

    ('How do I know which division I should compete in?',
     'Divisions differ by federation, so check the specific federation''s rules before anything else. Broadly: bodybuilding and classic physique are judged on muscular development with mandatory poses; men''s physique is judged in board shorts with less lower-body emphasis; bikini, wellness and figure differ mainly in how much muscle is rewarded and where. The practical way to choose is to look at last year''s results from the show you want to enter, find the class where the physiques look like where you can realistically be, and ask your club lead what they see. Most people should not decide this alone in a mirror.'),

    ('What does a coach actually cost?',
     'For online prep coaching in the US, roughly $150 to $400 a month is the common range, with the top of that range being people with long competitive or coaching track records. A one-off check-in or a peak-week consult is cheaper. Whether it is worth it depends on what you cannot do yourself: if you can run your own training and track your own food, you may be paying mostly for accountability and a second pair of eyes on conditioning, which is worth real money in the last eight weeks and less before that. Ask what is included, how often you get feedback, and what happens if you need to stop.'),

    ('Do I need a coach for my first show?',
     'No, but you do need somebody who has done it looking at you regularly. Plenty of people run a first prep off a good training plan, honest tracking and a club lead who will tell them the truth about their conditioning. What you should not do is your first peak week alone off the internet: that is where a good prep gets undone in seven days, and it is the cheapest thing to buy help for.'),

    ('What is peak week and how much does it matter?',
     'Peak week is the last week before a show, when people manipulate water, sodium and carbohydrates to look fuller and drier on stage. It matters far less than the sixteen weeks before it, and it is where the most damage gets done: a good physique can be flattened by an aggressive water cut, and no peak week rescues a physique that is not lean enough. If you are new, the sensible peak week is a boring one. Do not invent it yourself the week of.'),

    ('How much cardio should I be doing in prep?',
     'As little as gets the job done, and more as the deficit gets harder. Cardio is a tool for creating a deficit when food is already as low as you want it, not a thing to max out early. Starting prep at ninety minutes a day leaves you nowhere to go in the last month except further up. Most people start with little or none and add it in increments when weight loss stalls.'),

    ('Will I lose a lot of muscle during prep?',
     'Some loss is normal, and how much is mostly under your control. Keeping protein high, keeping training intensity up, and losing weight slowly are the three things that protect muscle. Cutting hard and fast, dropping training weights, and adding cardio faster than you add recovery are the three that do not. This is the main argument for a longer prep.'),

    ('What should I expect the last two weeks to feel like?',
     'Tired, hungry, cold, and less interested in most things than usual. Sleep often gets worse rather than better. This is normal and temporary, and it is also the point at which people make bad decisions about their diet, so it is a good stretch to have somebody else checking your plan. If it goes past uncomfortable into feeling genuinely unwell, that is a reason to talk to a doctor, not a badge.'),

    ('How do I find a show to enter?',
     'Check the calendar in this app first, then the federation''s own schedule for your region. For a first show, closer is better: travel adds cost, stress and a night of bad sleep to a day that already has plenty. Ask in your chapter who else is entering, because doing a first show with somebody who has done one is worth more than almost any other preparation.'),

    ('What does a show day actually look like?',
     'Long. Check-in and athlete meeting are often the night before or early morning. Prejudging is where the actual judging mostly happens, usually mid-morning, and finals are in the evening, so you have several hours in between. You will need food, your music if your division uses it, your suit, tanning appointments booked in advance, and someone to help with the parts you cannot do yourself. Ask your club for their checklist rather than building one from scratch.'),

    ('How much does competing cost in total?',
     'Budget more than the entry fee. Entry is commonly $100 to $200 per division, plus a federation membership, plus tanning, plus a suit, plus travel and a hotel if it is not local. Suits vary enormously: bikini and figure suits run into the hundreds new, and plenty of people buy secondhand from their own chapter. A realistic all-in number for a first local show is several hundred dollars, and asking your club is the fastest way to get an accurate one.'),

    ('Is a natural federation different from an untested one?',
     'Yes, and the difference is drug testing, not the athletes'' intentions. Natural federations test, with rules about what counts and how far back a ban goes, and those rules differ between them. If competing in a tested federation matters to you, read that federation''s banned list and its testing protocol before you enter anything, including which over-the-counter supplements are on it.'),

    ('What should I eat on show day?',
     'Whatever your plan says, and ideally nothing you have not eaten before. Show day is the worst possible time to try a new food, a new supplement, or a large amount of something you rarely eat. Bring your own food rather than relying on the venue.'),

    ('How do I track food accurately without losing my mind?',
     'Weigh what you eat for a couple of weeks until you know what portions look like, keep a small set of meals you repeat, and stop trying to hit macros to the gram. Consistency beats precision: a plan you follow at 90% for sixteen weeks beats a perfect plan you abandon in week five. Dining halls make this harder, which is a good reason to build two or three reliable meals you can get anywhere on campus.'),

    ('Can I do this on a dining hall meal plan?',
     'Yes, and plenty of people in NCBO chapters do. The trick is finding the reliable options rather than optimising every meal: a protein source you can get every day, a carbohydrate you can portion, and vegetables. Grilled chicken, eggs, rice, potatoes and whatever the salad bar has will get most people most of the way. Ask your chapter what works at your specific dining halls, because that knowledge is extremely local and somebody already has it.'),

    ('How do I train around exams and a heavy course load?',
     'Cut volume before you cut frequency. Three short sessions a week keeps far more than one long session and two skipped ones. Exam weeks are a good time to hold rather than push, and that is not a setback: over four years the people who make progress are the ones who never fully stop, not the ones with the best individual months.'),

    ('What is a realistic first-year goal if I have never lifted?',
     'Learn the main lifts properly, train consistently two or three times a week, and gain some muscle. That is it. Do not prep for a show in your first year unless somebody who has seen you train says otherwise. The people who compete well in their third and fourth years are usually the ones who spent the first one building something to reveal later.'),

    ('How do I pick my first training program?',
     'Almost any well-structured beginner program works if you actually run it. Look for something with the main compound movements, a clear progression rule, and three or four sessions a week. What matters far more than the program is running it for twelve weeks before deciding it does not work. Ask your club lead what their chapter uses, since training with people on the same plan makes it much easier to keep going.'),

    ('Do I need supplements?',
     'No. The ones with the best evidence behind them are unglamorous: creatine monohydrate, protein powder if you struggle to hit protein with food, and caffeine. Everything else is a long way behind those three. If you compete in a tested federation, check anything you take against that federation''s banned list, including things sold as ordinary supplements.'),

    ('How important is sleep, really?',
     'It is the single most undervalued variable for a student athlete, and the one most often traded away. Short sleep makes training worse, makes hunger harder to manage in a deficit, and makes technique sloppier. If you can only fix one thing about your routine this semester, fix your sleep before you touch your program.'),

    ('What is posing practice and how often should I do it?',
     'Posing is a skill, it is judged, and it is trainable. Two or three sessions a week from the middle of prep is a reasonable baseline, increasing as the show approaches. It is also exhausting in a way people do not expect, so practising it under fatigue is part of the point. Most chapters run posing sessions; going to those is far more useful than practising alone.'),

    ('How do I choose a suit?',
     'Ask your division''s rules first, since some federations are specific about cut and colour. Then ask your chapter, because somebody has a suit in your size that they are done with, and secondhand suits are a well-established part of this sport. Order or buy earlier than feels necessary: alterations take time, and a suit that arrives the week of the show is a problem.'),

    ('What happens after the show?',
     'This is the part nobody plans for and it is where a lot of harm happens. Coming out of a deep deficit, appetite is very high and it is easy to swing hard in the other direction. A structured reverse, where calories come up deliberately over weeks rather than all at once, is worth setting up before the show rather than after. Expect to gain some weight back, because you are supposed to.'),

    ('Is it normal to feel bad about how I look after a show?',
     'Yes, and it is common enough that it is worth saying out loud. Stage conditioning is temporary and not a healthy baseline, and coming off it while still holding the stage version of yourself as the standard is a well-known difficult stretch. Talk to somebody about it, and know that your campus counselling service is free and has seen this before. If food or your body is occupying more of your thinking than you are comfortable with, that is a reason to talk to a professional, not to prep harder.'),

    ('How do I balance competing with a social life?',
     'Badly, in the last month, and that is worth knowing in advance rather than discovering. Prep is genuinely restrictive at the end, so pick a show date that does not land in the middle of something you care about, tell your friends what you are doing so it is not a mystery, and remember that most of prep is not the last month. The first twelve weeks are far more normal than people expect.'),

    ('What are the mandatory poses and why do they matter?',
     'They are the standardised poses the judges compare everyone in, and they differ by division and federation. They matter because that is the comparison being judged: a physique that looks good in the mirror and does not present in the mandatories will place below one that does. Get the list for your specific division from the federation, and practise those specifically rather than posing generally.'),

    ('Should I bulk before I prep?',
     'If you are new and lean, almost certainly yes: prep reveals what is there and does not create it. A slow gaining phase for six months to a year before a first prep is a much better use of the time than dieting down on a physique that has not been built yet. Slow is doing a lot of work in that sentence, since gaining fast just makes the eventual prep longer and harder.'),

    ('How do I know if I am lean enough to compete?',
     'You will not be able to judge this reliably from photos of yourself, and neither will your friends who do not compete. This is one of the clearest cases for having somebody experienced look at you in person, whether that is a coach, a club lead, or an alumnus who has competed. Bodyfat percentage estimates from scales and calipers are not accurate enough to make this call.'),

    ('Can I compete if I am not on a scholarship or a varsity team?',
     'Yes. NCBO chapters are student clubs, not varsity programs, and bodybuilding federations are open to anyone who meets their eligibility and testing rules. There is no team selection to get through: you enter a show, you pay the fee, you compete.'),

    ('What is the biggest mistake first-time competitors make?',
     'Starting too late and then rushing. Almost every other first-show mistake, including the aggressive final weeks, the crash cardio and the improvised peak week, is downstream of not having given the prep enough runway. The second biggest is doing the whole thing alone. Both are fixable in advance and neither is fixable in week fourteen.')
  ;

  insert into public.questions (author_id, channel_id, body, anonymous, answered, status, moderated_at)
  select editor, general, s.body, false, true, 'approved', now()
    from starter_qa s
   where not exists (select 1 from public.questions q where q.body = s.body);

  insert into public.answers (question_id, author_id, body)
  select q.id, editor,
         s.answer || E'\n\n[starter] Reference answer from the NCBO Coaching Desk, not from a named advisor. Any coaching advisor can rewrite or replace it.'
    from starter_qa s
    join public.questions q on q.body = s.body and q.author_id = editor
   where not exists (select 1 from public.answers a where a.question_id = q.id);

  raise notice 'Q&A starter library seeded. Advisors should review and re-attribute before launch; clear with: delete from public.answers where body like ''%%[starter]%%'';';
end $$;
