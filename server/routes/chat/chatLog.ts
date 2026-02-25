import serverconfig from '#src/serverconfig.js'

/**
 * Log a message only when serverconfig.features.chatVerbose is enabled.
 * Set `"chatVerbose": true` inside the `features` block of serverconfig.json
 * to activate chat pipeline logging independently of debugmode.
 */
export function chatLog(...args: unknown[]): void {
	if (serverconfig.features?.chatVerbose) console.log(...args)
}
