# Server Routes

## Introduction

This directory contains files that specify server route APIs. By following this guidelines,
the auto-generation of server routes, tests, and API documentation will work as expected.

## Guidelines

### 1. Use Express to do most of the routing logic

- decentralize the route handling code into smaller, independent handler functions
- common request processing logic, like genome, dataset, termdb set-up should be imported
from a shared helper module that is common to a group of routes, or for more advanced cases,
moved to a [router-level middleware](https://expressjs.com/en/guide/using-middleware.html#middleware.router)

### 2. Export an `api` from the route file

Use the code from other files in this directory as examples

TODO: define the `api` type

```ts
// work-in-progress
type RouteApi {
	[key as methods]: RouteApiMethod
}

type methods = 'get' | 'post'

type initArg = {
	app?: any // Express app instance
	genome: any // `Genome` from shared/types/genome.ts 
}

/**
	@param endpoint    should be a noun (method is based on HTTP GET, POST, etc), don't add 'Data' as response is assumed to be data
*/
type RouteApiMethod = {
	endpoint: string
	init: (initArg) => void
	request: {
		typeId: string
		body?: any // specific to the route
	}
	response: {
		typeId: string
		header?: {
			status: number
		}
		body?: any // specific to the route
	}
	examples: RouteExample[]
}

type RouteExample = {
	request: {
		body?: any
	}
	response?: {
		header: {
			status: number
		}
		body?: any 
	}
}
```
### 3. Use the appropriate [HTTP response code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

This is a best practice especially for error responses. Use `res.status(code)` to set the error code.
This convention helps with error troubleshooting. Examples:
- Status `400` 'Bad Request', something is wrong with the http request payload
- Status `401` 'Unauthorized', the user must authenticate. The `server/src/auth.js` sets this status code
- Status `403` 'Forbidden', the user is authenticated/signed-in, but is not permitted to access the requested data
- Status `404` 'Not Found' for genome, dataset, or other data that is not found
- Status `500` 'Server Error' for errors related to the server process or host machine, such as the GDC API
not being available. Do not use code=`500` for errors that are related to specific request handler or data processing functions.

### 4. Auto-generate

- the server code will detect the routes in `server/src/run.sh`
- `npm run doc` to see the documented routes in http://localhost:3000/server.html
- `./augen/readme.sh > public/docs/readme.json` for content in http://localhost:3000/readme.html

