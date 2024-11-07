# Server Routes

## Background

The files in `server/routes` code exports route API expectations
and initialization methods in a standard 'shape'. In this way,
tools such as `augen` may easily auto-initialize server route handlers,
tests, and documentation from the exported route API. 

At a minimum, each file in `server/routes` imports request and response 
type definitions from the similarly named file in `shared/types/src/routes/`,
via the `#types` subpath alias. Since these type defininitions can be used
statically by client code, they are kept in the `shared/types` workspace instead
of server or client workspace. 


## Instructions

To create a `server/route` file, follow the comments/instructions in `shared/types/src/routes/_template_.ts`

