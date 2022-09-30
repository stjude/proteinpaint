# React-Wrapper

The react wrapper for Proteinpaint simulates the GDC PP server 
and rebundled frontend.

## Develop

There are two GDC endpoints that can be used:
- when using an API token, use https://api.gdc.cancer.gov/v0 and `header['X-Auth-Token'] = token`
- when using the sessionid as embedded in the GDC portal, use https://portal.gdc.cancer.gov/auth/api/v0 and `header['Cookie'] = 'sessionid=...'`

To simulate the embedded sessionid usage, launch the dev bundling and server process with
the optional PP_GDC_HOST process environment variable:

```bash
PP_GDC_HOST=https://portal.gdc.cancer.gov/auth/api/v0 npm run dev1
```

### Note on Logged-in User Testing 

Some Proteinpaint tracks in the GDC portal require logged-user access to see the fully rendered feature.
See the [Running Auth section of the GFF Readme](https://github.com/NCI-GDC/gdc-frontend-framework#readme) for setting up a local https proxy.