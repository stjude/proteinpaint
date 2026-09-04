# ProteinPaint MCP server (proof of concept)

A minimal [MCP](https://modelcontextprotocol.io) server that exposes ProteinPaint's TermdbTest
dataset as two tools an AI agent can call: `search_terms` and `create_summary_plot`. This proves
the "PP as an MCP server" loop end-to-end: search the dictionary, build a plot config from the
result, get back a config the real Mass UI would accept — and now also a PNG of the plot actually
rendered in the real Mass UI, not just its JSON config.

This is a throwaway prototype. It is scoped to one bundled, non-PHI dataset, talks to an
already-running dev server over plain HTTP, and has no auth or versioning of its own. See "What it
would take to productionize" below.

Two interchangeable entry points expose the exact same tools (`server/src/mcp/toolServer.ts` is
the shared tool registration both of them call):
- `httpServer.ts` — MCP's **Streamable HTTP** transport (`POST http://localhost:4000/mcp`). **This
  is the primary/default workflow for this POC**, used both for local development and as the
  intended shape for a real deployment — see "Transports: stdio vs. Streamable HTTP" below for why.
- `server.ts` — MCP's **stdio** transport, for a local client that spawns this as a child process
  (e.g. Claude Desktop's config, or the Inspector CLI's `<command>` form). Kept available and
  working, not removed, but not the default path documented here — see "Transports" for the
  tradeoff that motivated standardizing on `httpServer.ts` instead.

## How it works

```
AI agent (MCP client, e.g. Inspector)
        │  stdio (server.ts)  OR  HTTP POST /mcp (httpServer.ts)
        ▼
server/src/mcp/toolServer.ts        (shared tool definitions — a thin, disposable client)
        │  HTTP GET
        ▼
running PP dev server on :3000:
        ├─ GET /termdb?findterm=...            (server/src/termdb.js, trigger_findterm)
        │       — the SAME endpoint the Mass UI's own tree/search box calls; reused as-is,
        │         no new server code for search_terms
        └─ GET /mcp/createSummaryPlot          (server/src/routes/mcpCreateSummaryPlot.ts)
                → resolveSummaryPlot()           (server/src/mcp/resolveSummaryPlot.ts)
                → screenshotSummaryPlot()        (server/src/mcp/renderPlot.ts, Puppeteer)
                     — headless Chrome loads the SAME running dev server at a
                       `?mass=<json>` URL seeded with the resolved plot config
```

**Deliberately independent of `server/src/chat/`** (that module backs the AI chat feature, which
isn't reliable enough to depend on for this POC):

- `search_terms` calls `/termdb?findterm=...&targetType=Dictionary Variables`, an existing,
  already-established production endpoint (dispatched from the generic `/termdb` handler in
  `termdb.js`, not from `chat/route.ts`) — the exact same one the real Mass UI's search box uses.
  No new server code was needed for this tool.
- `create_summary_plot` calls one new standalone route, because no existing endpoint builds or
  validates a full plot config from a term id: normally that assembly happens client-side
  (`getPlotConfig()` in `client/mass/store.ts`, browser-only code not reusable from Node), or —
  the one server-side exception — inside the chat pipeline's `resolveToPlotState()`, which this POC
  avoids on purpose. `resolveSummaryPlot()` resolves each term id via
  `ds.cohort.termdb.q.termjsonByOneid` and hand-assembles the `summary`/`barchart` config itself.

The MCP server process itself never touches a `ds`/`genome` object or a database — it only knows
how to call these two endpoints on the already-running dev server. All dictionary lookups and
plot-state assembly happen server-side, where the real `ds` is already initialized.
`create_summary_plot`'s output is never invented: an id that doesn't resolve to a real dictionary
term throws instead of producing a bogus config.

## Rendering the plot, not just its config

`create_summary_plot` also returns a PNG screenshot of the plot actually rendered by the real Mass
UI — not a separate rendering implementation. ProteinPaint charts are drawn entirely client-side
(D3/SVG in a browser DOM); there is no server-side code path that turns a plot config into an
image, so `renderPlot.ts` drives a real headless Chrome (via the `puppeteer` package, already
resolvable in this repo's `node_modules` from the client workspace's e2e tooling — added as an
explicit `server/package.json` dependency here) against the same running dev server:

1. Build a full initial Mass state — `{genome, dslabel, nav:{activeTab:1}, plots:[plotConfig]}` —
   and open it via the `?mass=<json>` URL param (`client/src/app.parseurl.js`). This is the exact
   pattern `e2e-tests/TermdbTest/massNav.e2e.spec.ts` already uses to open a specific chart
   directly, reused here rather than reverse-engineered from scratch.
2. `nav.activeTab` must NOT be the default `0` (COHORT) tab — that's a cohort-selection landing
   screen that hides chart sandboxes entirely; `1` (CHARTS) is what the e2e test also uses.
3. Wait for `.bars-cell-grp` (the actual rendered bar elements — confirmed via the e2e spec, not
   guessed) rather than Puppeteer's `networkidle0`, which never resolves against a dev server (it
   keeps a persistent hot-reload WebSocket open, so the network never goes idle).
4. Screenshot cropped to the chart sandbox's bounding box, trimming the mostly-empty page below it.

`create_summary_plot`'s config-validation step is unaffected by this: if rendering fails for any
reason (e.g. no headless Chrome available in a given environment), the tool still returns the
validated JSON config plus a `renderError` field, rather than failing the whole call.

## Transports: stdio vs. Streamable HTTP

This POC deliberately uses **one workflow for both local development and the intended production
shape**: `httpServer.ts`, rather than developing against stdio and switching to HTTP later. `server.ts`
(stdio) stays in the repo and works — it's a legitimate, simpler option for a purely local client —
but isn't the one these docs walk through.

```
cd proteinpaint/server
npx tsx src/mcp/httpServer.ts
# ProteinPaint MCP Streamable HTTP server listening on http://localhost:4000/mcp
```

**Known, accepted tradeoffs of standardizing on `httpServer.ts` for local dev too** (vs. stdio,
where the MCP client spawns and owns the process for you):
- **You own the process lifecycle.** Nothing kills a stale `httpServer.ts` for you — forgetting one
  is still running (or that something else already bound port 4000) causes the exact class of
  problem this same session hit with the PP dev server itself (`EADDRINUSE` from two `npm run dev`
  instances). Before starting it, check first: `lsof -nP -iTCP:4000 -sTCP:LISTEN`. To restart after
  editing `toolServer.ts` (no auto-reload): find and kill the old one, then relaunch —
  `pkill -f 'tsx src/mcp/httpServer.ts'`.
- **Auth friction once auth is added.** `httpServer.ts` has no auth yet (see "Auth / PHI boundary"
  below). Once it does, local dev against it will need to either satisfy that auth too or gate it
  behind an env var/flag for local use — unlike stdio's local-process trust, which never needed an
  auth story to begin with.

Then either point the Inspector's web UI at `http://localhost:4000/mcp` (transport type
"Streamable HTTP"), or use its CLI with `--server-url` instead of a `<command>`:

```
npx @modelcontextprotocol/inspector --cli --server-url http://localhost:4000/mcp \
  --method tools/call --tool-name search_terms --tool-arg query=sex
```

...or speak the JSON-RPC wire protocol directly — no MCP client at all, just curl:

```
curl -s -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_terms","arguments":{"query":"sex"}}}'
```

All three were exercised directly and return identical results to the stdio path, screenshot
included — the tool logic in `toolServer.ts` doesn't know or care which transport carried the call.

`httpServer.ts` runs in **stateless mode** (`sessionIdGenerator: undefined`, mirroring the MCP
SDK's own `examples/server/simpleStatelessStreamableHttp.ts`): a fresh `McpServer` + transport per
POST, torn down when the response closes. That fits these two tools fine — each call is a
one-shot, independent request with no server-side state to keep between calls — and sidesteps
session-id bookkeeping entirely. A GET (server-initiated stream) or DELETE (session termination) on
`/mcp` correctly returns 405, since there's no session to resume or end in stateless mode.

**What switching transports did *not* require:** no changes to the tool definitions, schemas, or
handler logic — `toolServer.ts` is transport-agnostic by construction (this is standard MCP SDK
design: `Protocol`/`McpServer` vs. `Transport` are separate layers, connected via
`server.connect(transport)`).

**What it still doesn't have, and would need before being reachable over a real network:** auth.
Right now `httpServer.ts` accepts any POST from anyone who can reach port 4000 — fine on localhost
for this demo, not fine the moment it's bound to anything other than `127.0.0.1`. See "Auth / PHI
boundary" below.

## Local environment note

On this machine, `sjpp/serverconfig.json` (not part of any git repo — a local dev config) lists
`ClinVar`/`GDC`/`ASH`/`ALL-pharmacotyping` in `features.dslabelFilter` alongside `TermdbTest`. The
GDC dataset in particular initializes by calling the real NCI GDC API, which hung indefinitely with
no timeout in this sandboxed, no-internet environment — so the dev server never finished booting.
For this POC session those four were disabled (prefixed with `1`, the file's own documented
disable convention) so the server boots in ~1 minute instead of hanging. Revert by removing the
`1` prefixes if you need those datasets back:

```diff
-               "TermdbTest","ProtectedTest","1ClinVar",
-			"1GDC",
-			"1ASH",
-			"1ALL-pharmacotyping",
+               "TermdbTest","ProtectedTest","ClinVar",
+			"GDC",
+			"ASH",
+			"ALL-pharmacotyping",
```

## Setup

The MCP SDK, `zod`, and `puppeteer` (for rendering, see below) were added as dependencies of
`server/package.json`:

```json
"@modelcontextprotocol/sdk": "^1.30.0",
"puppeteer": "^25.8.0",
"zod": "^3.25.76"
```

`puppeteer` was already resolvable in this repo (a devDependency of the client workspace's e2e
tooling, hoisted to the root `node_modules`, with a Chrome-for-Testing binary already cached under
`~/.cache/puppeteer`) — adding it here makes that dependency explicit for the server workspace
rather than relying on hoisting from a sibling workspace.

Install (from `proteinpaint/`): `npm install --workspace=server`

The one new route is registered like every other server endpoint, in `server/src/app.routes.js`:

```js
import('./routes/mcpCreateSummaryPlot.ts'),
```

(`httpServer.ts` is a separate, standalone process — `npx tsx src/mcp/httpServer.ts` — not a route
on the main PP server; see "Transports" below.)

## Running the demo

1. Start the PP dev server (from the `sjpp` repo root):

   ```
   cd /Users/syalaman1/dev/sjpp && npm run dev
   ```

   Wait until it's serving `http://localhost:3000` (the TermdbTest dataset view is at
   `http://localhost:3000/?massnative=hg38-test,TermdbTest`).

2. In `proteinpaint/server`, start the MCP server (check port 4000 is free first — see
   "Transports" above):

   ```
   cd proteinpaint/server
   npx tsx src/mcp/httpServer.ts
   ```

3. In a separate terminal, launch the MCP Inspector against it:

   ```
   npx @modelcontextprotocol/inspector
   ```

   This opens the Inspector UI in a browser. Connect with transport type "Streamable HTTP" and URL
   `http://localhost:4000/mcp`.

4. In the Inspector's "Tools" tab, call `search_terms` with `{"query": "sex"}`, then feed the `id`
   it returns into `create_summary_plot` as `{"term": "<id>"}`.

(To use stdio instead: `npx @modelcontextprotocol/inspector tsx src/mcp/server.ts` connects
directly, no separate server process or URL needed.)

## Demo transcript

Captured via
`npx @modelcontextprotocol/inspector --cli --server-url http://localhost:4000/mcp --method tools/call ...`
against the live dev server (identical results via stdio's
`--cli tsx src/mcp/server.ts --method tools/call ...` form, confirmed separately).

`search_terms({ query: "sex" })` →

```json
[
  { "id": "sex", "name": "Sex", "type": "categorical" }
]
```

`create_summary_plot({ term: "sex" })` → an `image` content block (PNG, see below) plus a `text`
block:

```json
{
  "plotState": {
    "type": "plot",
    "plot": {
      "chartType": "summary",
      "childType": "barchart",
      "term": {
        "id": "sex",
        "type": "categorical",
        "q": { "mode": "discrete" }
      }
    }
  },
  "deepLinkUrl": "http://localhost:3000/?mass=%7B%22genome%22%3A%22hg38-test%22...%7D"
}
```

The accompanying PNG is a screenshot of the real Mass UI's CHARTS tab, showing a "Sex" barchart
sandbox with `Female, n=36` / `Male, n=26` bars — this is the actual production chart-rendering
code running headlessly, not a mock or a hand-drawn approximation.

An unknown term id is rejected, not hallucinated — `create_summary_plot({ term: "not_a_real_term" })` →

```json
{ "error": "Unknown term id: not_a_real_term" }
```

`create_summary_plot({ term: "sex", term2: "diaggrp" })` (categorical overlay) renders the full
overlay chart correctly too — stacked bars, the 2x2 association test table, and legend, all
produced by the real Mass UI. A numeric term (`create_summary_plot({ term: "agedx" })`,
`type: "float"`) was also exercised directly against `/mcp/createSummaryPlot` and resolves
correctly.

## Design choices (per the findings review this POC follows)

- **Narrow, purpose-built tools.** Two tools, each with a tight description so an agent can pick
  the right one from its name/description alone — not one do-everything tool.
- **Deterministic validation, not LLM trust.** `create_summary_plot` never asks a model to invent a
  plot config; it resolves term ids against the real dictionary via plain termdb queries. An
  unknown term id throws.
- **Independent of the unreliable chat feature.** Nothing here imports from `server/src/chat/` or
  the `termdb/chat` endpoint; `search_terms` reuses the pre-existing, non-chat `/termdb?findterm=`
  endpoint, and `create_summary_plot`'s new route calls the same lower-level termdb query API that
  module also uses. A bug or outage in the AI chat pipeline can't take this POC down with it.
- **Reuse the real endpoint where one already exists.** `search_terms` doesn't reinvent dictionary
  search — it calls the same endpoint the production Mass UI search box calls, rather than adding
  parallel server code that could drift from it.
- **Small tool outputs.** `search_terms` returns only `{id, name, type}` per term, not full
  dictionary rows — keeps the agent's context from flooding on a broad query.
- **Reuse the real render path, not a reimplementation.** The screenshot comes from driving the
  actual Mass UI headlessly (via the same `?mass=` URL / nav-tab / selector pattern the project's
  own e2e tests already use), not from a parallel/simplified chart-drawing implementation that
  could drift from what users actually see.
- **Graceful degradation.** Rendering is additive on top of the validated config: a rendering
  failure returns `renderError` alongside the still-valid `plotState`, rather than failing the tool
  call outright.

## What it would take to productionize

- **Auth / PHI boundary.** This POC calls an unauthenticated dev endpoint and is hardcoded to the
  bundled, non-PHI TermdbTest dataset. A real deployment must never let an MCP tool reach a PHI
  dataset without the same session/role checks the Mass UI enforces (see
  `userCanAccessDsData`/`resolveSampleAccess` in `chat/search.ts` for the existing pattern) — the
  MCP server would need to carry and forward real credentials, not assume an open localhost server.
- **Transport — mostly done, minus auth.** `httpServer.ts` already demonstrates MCP's Streamable
  HTTP transport working end-to-end (see "Transports" above); what's missing for a real deployment
  isn't the transport itself but everything around it: auth (see above), running as its own
  service rather than a loose script (see "Deployment shape" below), and likely stateful mode with
  real session handling if a future tool needs to keep state across calls (these two tools don't).
- **Deployment shape.** Bolting `httpServer.ts` onto the main PP web server process isn't the right
  move even once it has auth: headless Chrome is a heavier, occasionally-flaky dependency (hung
  pages, memory growth over many renders) with a different resource profile than normal PP request
  serving — a hang there shouldn't be able to degrade the main product. Better as its own service,
  deployed via the same container/CI conventions the main PP server already uses, talking to the
  real (authenticated) PP backend instead of a local dev instance.
- **Versioning.** No compatibility story yet between this MCP server's tool schemas and the PP
  server's plot-state shape; a real build needs the tools versioned alongside the API they wrap.
- **Observability.** No logging/metrics on tool calls, no rate limiting, no way to see what an
  agent actually asked for after the fact.
- **Multi-dataset / more chart types.** Scoped to TermdbTest + `summary` plots only; a real build
  should generalize `search_terms`/`create_*_plot` across datasets and the other chart types the
  codebase supports (`dge`, `hiercluster`, `matrix`, `survival`, `cox`, …) — likely still hand-built
  per type here, given the decision to stay off the chat pipeline's assembler.
- **Rendering cost/scale.** Launching a headless Chrome per `create_summary_plot` call (~2-4s) is
  fine for a one-agent local POC, not for concurrent production traffic — a real build would need a
  pooled/shared browser (or headless-render workers), a cache keyed by plot config, and a hard cap
  on concurrent renders. It also means `create_summary_plot` is no longer a cheap, side-effect-free
  call; an agent-facing API might want rendering as an explicit opt-in parameter rather than always-on.
