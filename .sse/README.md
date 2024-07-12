# Server-Sent Events

## Background

In the dev enviroment, we'd like to notify the browser of events like:
- bundling errors or success
- type check errors or success (TODO)
- inform of the active GDC API environment if it changes (TODO): this may be
the qa/prod alias or IP address to minimize confusion while testing and as 
CloudFlare WARP disconnects/reconnects

The native browser server-side events can be subscribed to by client-side code,
enabling one-way notification from the server to the browser. See
https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events

## Technical Design

### Logic

1. If `serverconfig.debugmode == true`, then
	a. set `serverconfig.sse` to `abs/path/proteinpaint/.sse`.
	This is done in `server/src/serverconfig.js`.

	b. set optional routes that include `server/src/test/routes/sse.js`.

2. In `server/src/test/routes/sse.js`, the `app.get('/sse')` route handler is set up.
Within the handler, `fs.watch()` is used to detect file changes in `serverconfig.sse/messages`.

3. On detecting `messages/${file}` changes, a notification is triggered in the route handler.

4. In `client/src/nofify.js`, an event subcription/listener to the `/sse` route is created.
This creates notification divs to render messages as they are streamed by the server.

5. Some message may trigger browser refresh (must prevent accidental infinite reload loop).

### Creating a new message by filename

1. All code that wish to trigger a server-sent event should write the message in a file at `proteinpaint/.sse/messages`.
For example, in `client/esbuild.config.mjs`, a bundling `onEnd` hook will write to `.sse/messages/client`.

2. As noted in Logic #2, fs.watch() will detect the file change (e.g, `.sse/messages/client`) and trigger a notification.

3. New messages must use a non-conflicting `.sse/messages/${filename}`, the notification divs are rendered based on
either message.key or filename.

4. TODO: support messages that are not JSON string, for example the output from `tsc --watch`.

