# server/routes 

## Background

This directory has been DEPRECATED. Most of the route payload APIs have been moved to
`server/src/routes` directory - see the README under that directory.

The main requirement for these route files is to export an `init()` function to
create server endpoint handlers. This transition also deprecates the requirement
to export a RouteAPI-shaped object - that will now be done from `server/src/routes` 
code files.

## Migrating

Smaller `server/routes/*` files, with less than ~150 lines, have been moved directly
in `server/src/routes`.

The larger code files that remain in this directory should be moved under `server/src`.
The following are suggested destinations:

- `routes/aiProject*.ts` -> `src/aiProject/`
- `routes/brainImaging*.ts` -> `src/brainImaging/` or maybe use `src/imaging` for all image/slide related route code
- `routes/chat/*` -> `src/chat`
- `routes/gdc.*, grin*` -> `src/grin/*`
- `routes/gene*` -> `src/geneLookup/`
- `routes/hic*` -> `src/hic/*`
- `routes/profile*` -> `src/profile/*`

... and so on. Remember to update consumer `import`s from these files to use the destination file location.

## Rationale for deprecation

The auto-generated payload checkers are hard-to-read, do not emit easy-to-trace error messages,
and uses an `IS` assertion for the validator's returned value, instead of type checking the
shape of the returned value. More importantly, manually written validation code is more likely to have custom logic that can be tailored to specific route handler needs, which is very hard to do with auto-generated payload validation code.

The auto-generated documentation were also tricky to set up and provided little value for
developers who can readily view payload type definitions and validation code in their favorite IDE.
More importantly, unlike more common data hosting portals, the ProteinPaint backend is not meant 
to serve open-ended data queries. The ProteinPaint server endpoints are all designed to meet the 
needs of specific ProteinPaint client-side tools. 
