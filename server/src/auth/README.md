# Server auth

This directory has the code that controls access to datasets that have credentials configured.
If no dataset credentials are loaded, the server uses `AuthApiOpen`, which applies no auth checks.

## Specifying credentials

Dataset credentials, also called `dsCredentials`, are read once at server startup by `../serverconfig.js`.
The supported ways to set them are:

1. **`process.env.PP_CREDS`**: the credentials as a JSON string, for example from a k8s or podman secret.
   It is parsed and then deleted from `process.env`.
2. **`PP_CREDS_FILE`**: the path to a credentials JSON file, when the server is started with
   `container/envHelpers.mjs`. That script reads the file and passes its content to the server as `PP_CREDS`.
   The server process itself does not need read access to the file. See the comments at the top of
   `container/envHelpers.mjs`.

**Deprecated:** setting `dsCredentials` as an object in `serverconfig.json` still works but logs a warning at
startup, and will not be supported in a future release. This also applies to a `dsCredentials` entry in
`PP_SERVERCONFIG_OVERRIDES`. When `PP_CREDS` is set, a `serverconfig.json` value is ignored.

**No longer supported:** setting `dsCredentials` to a credentials file path in `serverconfig.json` throws at
startup, unless `PP_CREDS` is set. Use `PP_CREDS_FILE` instead.

These are not deployment options, and are not deprecated:

- In `debugmode`, a `ProtectedTest` entry is added for test datasets, see `mayUpdateTestDatasets()` in
  `../serverconfig.js`.
- Tests may pass credentials directly to `getAuthApi(app, genomes, config)` in `../auth.ts`, as raw
  `{ dsCredentials }` or as already extracted `{ validatedCreds }`.
- `server/test/testServer.ts` passes its `dsCredentials` option to the test server as `PP_CREDS`.

Once loaded, `extractValidatedCreds()` in `../auth.ts` removes `dsCredentials` from the shared serverconfig
object, so that other code that imports serverconfig cannot read them.

## Credentials format

```
{
  [dslabelPattern]: {
    [routePattern]: {
      [embedderPattern]: { type: 'jwt' | 'basic' | 'forbidden' | 'open', ... }
    }
  }
}
```

- `dslabelPattern`, `embedderPattern`: an exact value or a glob pattern; list the catch-all `'*'` last.
  A key that starts with `#` is treated as a comment and ignored.
- `routePattern`: `'termdb'` allows a public view of aggregated data, `'*'` or `'/**'` protects all routes,
  `'burden'` is for the cumulative burden app.
- `type: 'jwt'`: `secret`, and optionally `dsnames`, `headerKey`, `processor`, `demoToken`.
- `type: 'basic'`: `secret`, or the legacy `password`.

See `ServerConfigDsCredentials` and the examples in `auth.dsCredentials.ts`. Older formats are converted by
`mayReshapeDsCredentials()` in the same file.

## Files

| File | Purpose |
| --- | --- |
| `../auth.ts` | `extractValidatedCreds()` and `getAuthApi()`, which app.ts calls once at launch |
| `auth.dsCredentials.ts` | validates and normalizes the loaded credentials |
| `auth.demoToken.ts` | validates a credential's `demoToken` option |
| `Auth.ts` | the private `Auth` class: sessions, credential matching, token checks |
| `AuthApi.ts` | wraps a private `Auth` instance and exposes only the methods that other server code needs |
| `AuthApiOpen.ts` | the `AuthApi` replacement when there are no credentials |
| `AuthMiddleWare.ts` | the app-level auth middleware and the route-level middleware implementations |
| `AuthRoutes.ts` | `/dslogin`, `/dslogout`, `/jwt-status`, `/authorizedActions`, `/demoToken` |
| `protectedRoutes.ts` | the route-level middlewares to list in a data route's `RouteApi.middlewares[]` |

## Tests

- Unit tests: `./test/*.unit.spec.ts`, plus `../test/auth.unit.spec.js` and `../test/serverconfig.unit.spec.js`
- Request tests against a launched server: `../test/auth.request.integration.spec.ts`, run with
  `npm run test:request` from the server dir
