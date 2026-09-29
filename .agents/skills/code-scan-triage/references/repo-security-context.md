# proteinpaint security context

Repo-specific facts for assessing scanner findings. Verify a helper's current behavior in the source before relying on it: these notes can go out of date.

## Request data flow

- `server/src/app.middlewares.js` parses a JSON body with `secure-json-parse` (which rejects `__proto__` / `constructor.prototype` keys), then runs `Object.assign(req.query, req.body)`. **For a JSON POST, every `req.query.*` / `q.*` field is controlled by the request**, including nested objects and arrays.
- The same middleware rejects any payload key, or whole string value, that is a prototype-related name (`findForbiddenName()` in `server/src/routes/common.ts`). Prototype pollution findings on `req.query` are often already covered by this.
- A repeated query string parameter (`?a=1&a=2`) becomes an array. A value from a JSON body can be any JSON type. Never assume a request value is a string without a `typeof` check.

## Guard helpers (`server/src/utils.js`)

| Helper | Use for | Notes |
|---|---|---|
| `illegalpath(s, checkWhiteList = false, checkBlackList = true)` | A relative path under `serverconfig.tpmasterdir` | Returns true (illegal) for non-strings, absolute paths, `..`, quotes, `\|`, `&`, whitespace, control characters, `<script`. **The default blacklist rejects `.bam .bai .gz .tbi .csi .bw .bb`**, so pass `checkBlackList = false` for data files. |
| `illegalPathSegment(s)` | A single file or folder name, such as a session id or cache id | `illegalpath` plus no `/` or `\`, and not the name `.` itself. Periods within a name, such as `a.b_at_c.org` or `FI.bam`, are allowed |
| `fileurl(req, checkWhiteList = true)` | `req.query.file` or `req.query.url` together | Returns `[err, file, isurl]`; joins a file onto `tpmasterdir` after `illegalpath`, validates a url with `test_url` and `illegalUrlHost` |
| `test_url(u)` (not exported) | A remote url | Protocol must be http, https or ftp; no `..` path segment; no leading `-` |
| `illegalUrlHost(u)` | SSRF | Rejects localhost and non-public IP literals, or hosts not in `serverconfig.urlHosts` when set. Does not catch a hostname that resolves to a private IP. |
| `cache_index(gzurl, indexurl)` | Downloading a remote index into the cache dir | Calls `test_url` and `illegalUrlHost` on both urls. Returns the cache dir, which is safe to use as a `cwd`. |
| `spawnTool(bin, args, opts)` | Spawning samtools/tabix etc. | Rejects an argument that starts with `-` and contains `:` (a region parsed as an option). Does not validate file paths. |

## What does not protect you

- **The Node permission model does not cover spawned tools.** The container runs Node with `allow-fs-read` / `allow-fs-write` lists (`container/envHelpers.mjs`), but samtools, tabix, bcftools, straw, bigBedToBed, pyBigWig and R/Python scripts can read any file the process user can. A path given to a spawned tool needs its own check.
- `path.join(serverconfig.tpmasterdir, x)` alone does not keep `x` inside `tpmasterdir`: `../` walks out.
- A check done in the client does not count.

## Known false positive patterns

- **Type confusion (`js/type-confusion-through-parameter-tampering`) after a helper that checks the type.** CodeQL does not follow a `typeof` check made inside another function that returns a boolean. Example: code-scanning #135 and #136 on `s.includes()` in `illegalPathSegment()`, which is only reached after `illegalpath()` rejects non-strings (tested in `utils.unit.spec.js`, `'array bad'`). Adding a local `typeof s != 'string'` check silences it.
- **Path injection through a value that went through `illegalpath` / `illegalPathSegment`,** where the scanner does not recognize the helper as a sanitizer. Confirm the helper is on every path to the sink.

## Known real issue patterns

- **`path.join(serverconfig.tpmasterdir, q.somefile)` with no `illegalpath()` check.** Allows reading files outside `tpmasterdir` through spawned tools.
- **A server-side field that the request can also supply.** For example, a cache dir field that the server assigns from `cache_index()` in only one branch (such as when a url is given, but not a file). In the other branch, a value sent in the request is used instead, for example as the `cwd` of spawned tools. Fix by always assigning or clearing the field on the server.
- **Argument injection into spawned tools** (a value starting with `-`). See `server/src/test/argvInjection.unit.spec.js` and commit 86ac469d5.

## Tests

- Unit tests: `server/src/test/*.unit.spec.js`, using `tape`. Run with `cd server && npm run test:unit`.
- Security regression examples: `utils.unit.spec.js` (path and url helpers), `argvInjection.unit.spec.js` (spawned tool arguments, calling route handlers directly).
