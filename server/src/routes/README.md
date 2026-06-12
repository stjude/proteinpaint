# Server Routes

## Background

IMPORTANT: A route must be imported in `src/app.routes.js` in order
for it to be included in the `augen.setRoutes(..., routes, ...)` argument 
as called in `app.ts`.  

The files in `server/src/routes` code exports route API expectations
and initialization methods in a standard 'shape'. In this way,
tools such as `augen` may easily auto-initialize server route handlers,
tests, and documentation from the exported route API. 

At a minimum, each file in `server/routes` imports request and response 
type definitions from a similarly named file in `shared/types/src/routes/`,
via the `#types` subpath alias. Since these type definitions can be used
statically by both server and client code, they are kept in the `shared/types` 
workspace instead of server or client workspace. 


## Instructions

To create a `server/src/route` file, follow the comments/instructions in `server/src/routes/_template_.ts`.
Note that a payload validator or checker code in each file is optional, but it's very important in 
cleaning up and ensuring a stable, reliable backend code.
