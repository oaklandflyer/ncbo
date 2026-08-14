# Conferences

Empty on purpose.

NCBO has not defined a conference structure. Rather than invent one — regions
grouped by geography would read as a real NCBO decision that nobody has made —
this directory ships empty and `/standings/[conference]` renders an honest
"no conferences defined yet" state.

To add one, drop a JSON file here:

```json
{
  "slug": "northeast",
  "name": "Northeast Conference",
  "description": "One sentence on what this conference is."
}
```

Then set `"conference": "northeast"` on the relevant club files in `data/clubs/`.
The standings pages pick it up on the next build; the schema in
`web/src/content.config.ts` will fail the build if a club references a
conference that does not exist here.
