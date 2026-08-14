# Events

Empty on purpose. No NCBO event has been scheduled — the site says as much
("We're working toward a first event. Nothing is scheduled yet").

Adding a real event means dropping a JSON file here that satisfies the `events`
schema in `web/src/content.config.ts`. The build fails on an invalid one. See
`data/samples/events/` for shape examples — those load only under
`NCBO_DEMO_DATA=1` and never in a production build.
