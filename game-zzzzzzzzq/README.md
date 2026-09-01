# Field to Finish

A taxidermy vocabulary game. The definition is on the bench. You name the term.

160 shop terms, played along the real workflow from field care to finish work.

## Play

From this folder:

```bash
python3 -m http.server 8765
```

Then open [http://localhost:8765](http://localhost:8765).

(Opening `index.html` as a file also works — the glossary is inlined in `data/glossary.js`.)

## Modes

- **Apprentice** — multiple choice. Keys `1`–`4`.
- **Journeyman** — type the term. Aliases count. One-letter typos allowed on longer terms.
- **Master run** — all 160, typed, one integrity bar.
- **Field Notes** — study the glossary by workflow chapter, no clock.

## Integrity

You start at 100%. A miss costs 20 / 25 / 30% by difficulty. A correct answer in the first 10 seconds restores 10% (capped at 100). At 0% the mount is ruined.

Timer is 15–20 seconds from term length and obscurity.

Esc pauses.

## Art

Victorian workshop plates in `assets/` (WebP). Source paintings in `art/`.
