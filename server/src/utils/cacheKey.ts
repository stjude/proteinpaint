import crypto from 'crypto'

/*
	Derives the cache file names and the cachedir subdir name from one key, which is kept module-local, not in
	serverconfig, so that it is never part of a config dump or a response. This module does not import
	serverconfig.js, since serverconfig.js imports it.

	Set PP_CACHEID_CREDS, or PP_CACHEID_CREDS_FILE, to the same value on every instance that shares a cachedir,
	so that they derive the same names and keep finding the existing cache files across restarts.
	container/envHelpers.mjs passes it like the other <NAME>_CREDS values, so that it is not in the initial env
	of the server process. When not set, a random key is generated per process: the cache still works, but every
	restart or other instance misses on the files that were written before.

	The key is read on first use instead of when this module is loaded, since serverconfig.js sets the
	<NAME>_CREDS values in process.env from the envHelpers.mjs handoff file after its imports are loaded.
*/

let key: Buffer | undefined
// true if the key is from PP_CACHEID_CREDS, false if it is generated for this process only
let keyIsPersistent = false

function getKey(): Buffer {
	if (!key) {
		const value = process.env.PP_CACHEID_CREDS
		keyIsPersistent = !!value
		key = value ? Buffer.from(value, 'utf8') : crypto.randomBytes(32)
		// not inherited by spawned child processes, and not exposed by any code that reads process.env later
		delete process.env.PP_CACHEID_CREDS
	}
	return key
}

/** Derive a 32-hex-char cacheId from the given object via
 * HMAC-sha256(key, JSON.stringify([scope, args])). Truncation at 32 chars is safe
 * for cache keys — collision probability is negligible at realistic cache sizes.
 * Callers shape `args` to include only the fields whose identity
 * determines the cache key, and must construct it with a stable key order
 * (object literals do this naturally).
 *
 * `scope` is optional, and separates cacheIds for the same args, e.g. per user or session
 * when the result depends on what the requester may access. Without a scope, identical
 * args share one cacheId, which is the intended behavior for results that are the same for
 * every requester. */
export function generateHash(args: any, scope = ''): string {
	return crypto
		.createHmac('sha256', getKey())
		.update(JSON.stringify([scope, args]))
		.digest('hex')
		.slice(0, 32)
}

let dirNameTaken = false

/** Returns the name of the cachedir subdir, once: a later call throws, so that code which runs after server
 * startup cannot get the name from this module. The HMAC input is not a JSON array, so no generateHash()
 * argument can produce the same value. */
export function takeCacheDirName(): string {
	if (dirNameTaken) throw 'the cache dir name was already taken'
	dirNameTaken = true
	return crypto.createHmac('sha256', getKey()).update('cachedir').digest('hex').slice(0, 32)
}

/** true if the key is from PP_CACHEID_CREDS, false if it is generated for this process only */
export function hasPersistentKey(): boolean {
	getKey()
	return keyIsPersistent
}
