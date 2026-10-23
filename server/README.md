# ProteinPaint Server

The data server backend for the ProteinPaint application

## Installation

The client dependencies should be installed as a workspace, follow the README at the project root.

You can either use a docker container for development (../build/dev/README.md), or build from source.
See https://github.com/stjude/proteinpaint/wiki.

## Serverconfig

`server/serverconfig.json` is used:

- when running any server or test scripts from the pp/server directory
- if `${process.cwd()/serverconfig.json` does not exist wherever `@sjcrh/proteinpaint-server` is called (if can give example of this usecase)

If no `test:unit` code uses serverconfig, then it would have been okay to not have `server/serverconfig.json`.
However, it's safer to simply have that file available just in case any imported server code uses serverconfig
and runs as part of test:unit, and that's why `server/emitImports.js` creates one if it doesn't exist by
copying `container/ci/serverconfig.json`.

### Memory budget

Before a heavy run (GRIN2, differential expression, differential methylation and its DMR jobs, top variably
expressed genes), the server reads the memory that is free on the host or container, and estimates the run's peak
memory from costs measured on real runs (`GRIN2_MEMORY`, `DE_MEMORY`, `DM_MEMORY`, `TOPVE_MEMORY`, each next to its
route; the checks are in `server/src/utils/memory.ts`). Runs plan within a budget: a fixed cap in MB, `maxMB`, or
all of that free memory when less is free, less what runs in progress have reserved. `memoryBudget` in
serverconfig.json sets the cap, optionally a share of the free memory to plan within as well, and what happens to a
run that does not fit:

```json
"memoryBudget": { "mode": "enforce", "maxMB": 3072 }
```

Every key is optional. With no `memoryBudget`, the server enforces a 3,072 MB (3 GB) budget, or all the free memory
when less is free. `maxMB` is the total for all runs in progress, however much memory the host has, so a
high-memory host still has a fixed ceiling. The default fits one differential expression run at its largest (below)
beside smaller runs. A server that needs larger runs, such as differential methylation on a full cohort of the larger
element classes (MMRF allccre ~6,300 MB, panMB promoter ~4,500, DISCOVER allccre ~3,700, MMRF promoter ~3,200),
sets a higher `maxMB`. Runs are held to their estimated peak, which is set above the measured one.

A differential expression run also has its own ceiling, `DE_MAX_MB` (2,200 MB) next to `DE_MEMORY`: limma on the 500
samples that one DE run may compare, on ASH's genes. A file with more genes allows fewer samples per method.
Differential methylation and splicing have no ceiling of their own yet; they are still to be benchmarked, after
which the default `maxMB` can be revisited.

| key        | values                         | default                       |
| ---------- | ------------------------------ | ----------------------------- |
| `mode`     | `"enforce"` or `"report"`      | `"enforce"`                   |
| `maxMB`    | a number above 0               | `3072`, none in `report` mode |
| `fraction` | a number above 0 and at most 1 | `1`, all of the free memory   |

The server refuses to start if any value is invalid.

**`enforce`**: a run that does not fit is refused with a 503 error, code `LOW_MEMORY`, whose message tells the user
what to change, such as a smaller cohort or the Wilcoxon method for DE. GRIN2 is trimmed instead: its lesion cap is
lowered to what fits. It is refused only when the budget does not cover its base overhead, or when the cohort has
more lesions than a cap below 50,000, the smallest run worth doing. Use this on shared or
production servers, where one large request could otherwise use up the memory of every other request.

**`report`**: the server still reads the free memory and logs each estimate, but every run goes ahead in full.
Nothing is refused, and GRIN2 keeps its configured lesion cap (`features.grin2maxLesions`, at most about 641,000
lesions, a fixed 2 GB ceiling). Use this on a laptop or a dedicated server, where free memory is often low because
the OS keeps memory as cache, and an analysis that would finish would otherwise be refused. Without a `maxMB`,
report mode has no cap: each run is reported against the free memory alone, and its log line names no `maxMB`. With
a `maxMB`, the logs show how close each run came to it, to tune `maxMB` before enforcing.

`fraction` is optional: a share of the free memory that heavy runs may plan for together, so that the rest stays
free for the rest of the server and for error in the cost estimates. The budget is then the smaller of that share
and `maxMB`. Set it on a server whose free memory is close to `maxMB`, such as `0.4` where many users run analyses
at once.

Each run logs one line, naming the fixed cap that applies to it, whether it is under that cap, and the budget, for
example:

```text
[memory] DE limma admitted: needs 2,150 MB, under the 2,200 MB per-run maxMB, of a 3,072 MB budget (maxMB, below 16,000 MB free), 0 MB reserved by runs in progress
[memory] DM refused: needs 6,134 MB, over the 3,072 MB maxMB, of a 3,072 MB budget (maxMB, below 16,000 MB free), 0 MB reserved by runs in progress
[memory] DM does not fit (report only): needs 6,134 MB, over the 3,072 MB maxMB, of a 3,072 MB budget (maxMB, below 16,000 MB free), 0 MB reserved by runs in progress
[memory] DE edgeR admitted: needs 1,850 MB, under the 2,200 MB per-run maxMB, of a 2,400 MB budget (40% of 6,000 MB free), 0 MB reserved by runs in progress
```

The last line is from a server that sets `"fraction": 0.4`.

To change the budget without editing serverconfig.json, such as for one test server, set it in
`PP_SERVERCONFIG_OVERRIDES`. Overrides replace top-level keys, so give the whole object:

```bash
PP_SERVERCONFIG_OVERRIDES='{"memoryBudget":{"mode":"report"}}' npm start
```

## Develop

The local development environment is usually triggered following one of these:

- follow the `Develop` section in [proteinpaint/README.md](https://github.com/stjude/proteinpaint/blob/master/README.md) (preferred)
- `npm start` from the `server` dir

## Test

To run both type checks and test:unit: `npm run test`.

To run type check only: `npx tsc`.

To run unit tests only: `npm run test:unit`

To run specific test file: `npx tsx path/to/spec.ts`

## Build

```bash
npm pack
```

## Release

Use Github Actions to coordinate the release of related package updates.
The package versioning, build, and deployment uses the standard npm tooling under the hood
(`version`, `pack`, and `publish`, respectively).
