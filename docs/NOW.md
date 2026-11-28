# Now

Status as of 2026-11-28. Update this file whenever something moves between states.

## Waiting on owner
- **Review stop: landing refresh phases 0 to 3** (Chime's plan, before phases 4 and 5). Live on thevicefiles.com since 26 Nov 2026. The sections with Rockstar pictures (hero art and trailer, Spotlight stills, By type stills, Regions stills, Watch the clips) can only be checked by the owner; grey-block before and after screenshots of the rest are on the owner's private review board (images stay out of the repository: the CI asset guard blocks them).
- **Merge the content pull requests** #69, then #73, then #64 once Chime has checked and approved each (plan on each PR, 26 Nov 2026). Each is refreshed from `staging`, reviewed, and merged by the owner with `gh pr merge <n> --squash --admin --match-head-commit <sha>`.
- **Release `staging` to `main`** after #81's pull request merges (RC3, merge commit). `main` is behind by #67, #71, #77, #80, #75 and #76.
- **Phases 8 and 9** need decisions first: a cursor exception for Jason and Lucia (like L5), and whether to override the no-cursor-effects rule for game cursors.
- **Find titles have no length limit.** An 86-character title still fits the Spotlight on five lines; set a soft limit in the validator, or leave it?
- **Launch.** Flipping `site.indexable` to `true` in `src/lib/site.ts` (search engines in, sitemap and robots open) waits for Chime's first pins. Today every page is `noindex`.
- **Mailboxes.** Send a test message to takedown@thevicefiles.com and conduct@thevicefiles.com and record that both arrive. Not done yet; `docs/LEGAL.md`, `SECURITY.md` and the Code of Conduct send people there.
- Confirm or change the open slice decisions in [DECISIONS.md](DECISIONS.md), newest first: RG2 to RG5, LR1 to LR17, P8, SR1 and SR2, CM1 and CM2, RC2 and RC3.
- Answer the open questions below.

## Chime's first queue (research conflicts)
Chime owns content and pins. Each item needs a first-hand check in game or a better source, then a fix to `notes`, `area`, `verification` or the linked connection. Details are in the notes of each record and in PR #4.

**Locations**
1. `alien-rescue-south-point-airfield`: south of Hamlet, or Pelican Valley near the Mariana County border?
2. `golden-ak-palmer-fishing`: Bobcat Key or Watson Bay?
3. `pegassi-infernus-96`: Crosstown police car park or an Ambrosia garage?
4. `merman`: Gambit Bay or Cottonmouth Lake? Also replace or back up the gta6tuto source.
5. `mount-kalaga-meteorite`: summit or Hillside Campsite?
6. `conspiracist-trailer-bunker`: which directions and contents are right, and is Chapter 1 mission "Building a Life" required?
7. Region `hamlet`: Vice-Dale County or Mariana County?
8. Region `ambrosia`: GTABase says "Ambrosia County", the map shows five counties without it.
9. Region `leonida-bay`: same water as the Gulf of Leonida map label?

**Facts**
10. `brainwashing-chair`: pistol "Brainwasher 1992" or "1922"?
11. `mount-kalaga-tower-shed`: code 691865 or 69185?
12. `alien-rescue-south-point-airfield`: keypad 2314, or a code from the dream?
13. `crashed-glider-turnt-nipper`: sniper or Turnt Nipper .38?
14. `arthur-morgan-hat` (find and connection): $5 or $35?
15. `michaels-boat-los-santos-gps` and connection `marquis-boat`: Marquis or "Sonata"?
16. `mount-chiliad-bar-chatter` (multi-source) vs connection `chiliad-gta6-callback` (speculative): align the levels.
17. `fabien-larouche-body-copy` vs connection `liberty-city-memoir`: Michael's or Amanda's yoga instructor?
18. `tenebrae-lux-puzzle-game` vs connection `tenebrae-lux`: Clair Obscur parody, or a send-up of games like The Witness?
19. `dexter-trinity-apartments` vs connection `dexter-apartment`: GameSpot reportedly found nothing Dexter-related.
20. `skunk-ape-bigfoot`: is there a real Red Dead Redemption 2 Bigfoot link? No connection supports it yet.
21. `macca-and-friends-cartoon` (rumor) vs connection `weazel` (states it as fact).
22. Meteorites layer: 11 or 16?

**Sourcing**
23. Rumors held as draft: `kyle-busch-18-car`, `macca-and-friends-cartoon`, `little-sam-houser-cameo`, `mount-kalaga-tower-shed`, `roadside-ghost-woman`, `skeeters-bar-south-park`. Each needs a second independent source to publish.
24. Multi-source finds that rest only on GTA6Info plus gta6wiki.eu (for example `michael-wind-chimes-ringtone`, `fabien-larouche-body-copy`, `eddie-low-podcast`, `dumpster-lawyer`): find an independent clip.
25. Vice City districts La Perle, Tequesta, Tisha-Wocka and Peacock Bay: find a source URL before adding them to regions.

## Asked, not built
- **Map pins and labels (Chime).** The owner chose that Chime places pins by hand, from clips and in game, with the harness picker ([MAP.md](MAP.md)); Chime records the place labels the same way. No agent views the official map (LEGAL.md, decision OS7); the only exception is the Game Checklists collectible maps (decision C1). Today 0 of 85 finds are pinned and `content/map.json` has no labels, so every find opens from the list.
- "Missables before Tourist Trap" spoiler-gated checklist guide.
- Daily update pipeline from research/gta6-sources.md section 9.
- Follow-up on leads from public community posts (X, GTAForums, YouTube).
- **Landing refresh phases 4 to 9** ([LANDING-REFRESH.md](LANDING-REFRESH.md)): the GTAverse dashed path, map and regions behaviour, search on the home page (after #76), five Mobbin redesigns (Chime picks a reference for each), Jason and Lucia, game cursors.
- **Chime's six open items** from the handoff (LANDING-REFRESH.md, "Open items found on the way"), each the owner's call: Spotlight buttons overlap at 1024 to 1100px, the sound toggle overlaps the island at 768, hero text over a white frame, the hero intro width at 1024 and 1280, the phone map teaser's coast, `--text-3` on `--surface-1`.
- The map's "Sort: Newest" label stays while a search orders by match (`MapApp.tsx`, from Chime's handoff).
- Non-blocking findings carried from the reviews of #77 and #80 (listed in their review comments).

## Built, not pushed
- Nothing.

## Pushed, not live
- Issue #117: a mature find's clip and first finder links stay on its own page (the map's mature gate opens the find page; `/finders`, the map data and `/data/finds.json` keep the names without links), no "Reveal spoiler clip" gate on a spoiler find with no clip, the map's chip reads "N sources on the find page", and the build's mature check covers clip and finder links, mature finds that share a source, titles split by block tags, and titles shared with other content (LR85). Pull request into `staging`, in review.
- #64: fact-check of the 14 bookmark candidates and the 5 draft explainers (issue #63): 4 new draft finds, explainer corrections and 12 conflicts. Waiting on Chime (4 clips to watch, 2 images to view).
- #69: clips for 35 published finds (issue #68). Waiting on Chime's check.
- #73: 4 draft finds from the X bookmarks, round 2 (issue #72). Waiting on Chime's check.
- #74 (two find summaries corrected and reworded): Chime's third version, 7004cc9, is in review after two fails (copied wording, then a wrong fact).
- Issue #81: the review-stop gaps for phases 0 to 3 (this file's update is part of it).

## Live
- Mature finds (#112, #114, #116; LR78, LR83, LR84): outside its own page a mature find shows "Mature find: <type>", the gate line and no sources, and the build checks it. Live since 28 Nov 2026 (Worker version fb5ee67c) and released to `main` the same day (#118, 9f825f2).
- thevicefiles.com serves `staging` through the `thevicefiles` Worker (Cloudflare static assets): home, map, finds, explainers, the GTAverse, hubs, `/design` and the PRD at `/prd`. Every page is `noindex` until launch.
- The Case File logo by Chime (#60) is in the header, the Open Graph cards and the favicons.
- Map tiles, the hero trailer loop and key art, game logos and cover art are built at deploy from Rockstar's official files and never committed.
- 892 collectible locations in 12 layers, transcribed from the Game Checklists maps and credited to them (decisions C1 to C7).
- X and Reddit clip stills and tap-to-play players (#71).
- Landing refresh phases 0 to 3 (#77 by Chime, #80): no cut text, the hero fade, the Spotlight readout mask, the manifesto highlighter, smoother stats and clean swaps. #80 also fixed scripted motion that was instant in production (LR17). Deployed 26 Nov 2026 from `staging` ae5eb59.
- Find pages open on Details, then Clips, Related, Nearby (#75, decision P8), and search reads plain questions (#76, SR1 and SR2). Both merged after that deploy; live at the next deploy.

## Resolved
- Stage B (#20): licences, contributor files, CI and Dependabot are merged; the repository settings in [release/STAGE-B-SETTINGS.md](release/STAGE-B-SETTINGS.md) are applied and read back as matching on 24 Nov 2026.
- Dependabot's first update (#21, `@types/leaflet`) is merged, through CI.
- The old `vicefiles-prd` Worker was deleted on 24 Nov 2026; the PRD is served by the main site at https://thevicefiles.com/prd.
- Owner decisions on 24 Nov 2026: `prd/public/_headers` removed (RC1); the 11 old merged or closed branches deleted from GitHub; the rockstarworld.elvisobi.com redirect kept; fork pull request approval stays at first-time contributors.
- Stage C passed (GO, #62) and `staging` was released to `main` on 25 Nov 2026. Releases from `staging` to `main` are merge commits from now on (decision RC3); `staging` stays squash-only.
- 26 old agent worktrees were deleted on 24 Nov 2026.
- Chime's workspace branch (with a private preview link and an instructions file) was deleted from the public repository on 26 Nov 2026 on the owner's go; Chime re-created it the same morning, and it was deleted again on the owner's go, with issue #83 telling Chime why. Both versions are kept as local backup refs.
- Map labels and pins: Chime places them by hand (owner's choice; see "Asked, not built").
- Pick a logo: done. Case File by Chime, implemented from Chime's SVGs (decisions LG5, LG6; [LOGO.md](LOGO.md)). Chime may polish it later.
- Icon style: GTA-native-style near-identical original lookalikes for this project, overriding the Capsa default (decision 18).
- Branching: `staging` is ground truth; branch from it and target it (decision 16).
- Takedown contact: takedown@thevicefiles.com (decision 20).
- Domain: thevicefiles.com (decision 15).
- Licences: MIT for code, CC BY-NC 4.0 for original content, holder "The Vice Files contributors" (decision OS1).
- Personal data: removed from the current files; history is left as it is (decision OS3).
- Takedown and credit requests: answered within 48 hours (decision OS5).

## Open questions
1. **Display font.** Which licensed display face replaces GTAArtDeco?
2. **Rumors on the site.** Rumors are draft-only today (slice decision S2). Should the site show them in a clearly labelled "unconfirmed" section instead?
3. **Game Checklists.** Contact them about a data partnership or credit arrangement? Their original post or site was not found, so the credit links to a repost (decision C7).
4. **Paul Walker Eclipse credit.** HotCars names two early finders (BattleFieldBosh and Jokemen FC). Credit both, or leave first_finder empty until the earliest post is traced?
