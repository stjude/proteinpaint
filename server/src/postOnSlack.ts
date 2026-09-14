import https from 'https'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * Sends a message to a specified Slack webhook. If the last message sent has the same hash value as the current message, the message will not be sent.
 * @param webhookUrl The URL of the Slack webhook.
 * @param message The message to be sent.
 * @param lastMessageHashFile The path of the file where the last message hash value is stored.
 */
export async function sendMessageToSlack(
	webhookUrl: string,
	message: string,
	lastMessageHashFile: string,
	// bound every request so an unreachable or unresponsive webhook can never leave this promise
	// pending — e.g. the `validate` startup awaits this notification and must not hang on Slack
	timeoutMs = 10_000
): Promise<void> {
	return new Promise((resolve, reject) => {
		// Validate inputs
		if (!webhookUrl) {
			reject(new Error('Webhook URL is not defined'))
			return
		}
		if (!lastMessageHashFile) {
			reject(new Error('lastMessageHashFile is not defined'))
			return
		}

		// Ensure the directory exists
		const directory = path.dirname(lastMessageHashFile)
		if (!fs.existsSync(directory)) {
			fs.mkdirSync(directory, { recursive: true })
		}

		// Initialize hash file if it doesn't exist
		if (!fs.existsSync(lastMessageHashFile)) {
			fs.writeFileSync(lastMessageHashFile, '', 'utf8')
		}

		// Calculate the current message hash
		const hash = crypto.createHash('sha256').update(message).digest('hex')

		// Read the last message hash from file
		const lastMessageHash = fs.readFileSync(lastMessageHashFile, 'utf8').match(/lastSlackMessageHash=(\w+)/)?.[1] ?? ''

		// Skip sending if the hash is unchanged
		if (lastMessageHash === hash) {
			console.log('The message hash is the same as the last one. Skipping sending the Slack message.')
			resolve()
			return
		}

		// Prepare request data
		const data = JSON.stringify({ text: message })
		const options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(data)
			}
		}

		// Settle the promise exactly once and always clear the timer. Every terminal event routes here so
		// none can leave the promise pending (which would hang an awaiting caller) or settle it twice.
		let settled = false

		const settle = (err?: Error) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			if (err) {
				console.error(`Error posting message to Slack: ${err.message}`)
				reject(err)
			} else {
				resolve()
			}
		}

		// Send message to Slack
		const req = https.request(new URL(webhookUrl), options, res => {
			// drain the response so 'end' fires and the socket is freed even though the body is ignored;
			// without this the stream stays paused and the promise could never settle, even on success
			res.resume()
			if (res.statusCode === 200) {
				console.log(`Message posted successfully on Slack`)
				// Save the new hash to the file
				fs.writeFileSync(lastMessageHashFile, `lastSlackMessageHash=${hash}`, 'utf8')
			} else {
				console.log(`Error posting message on Slack: ${res.statusCode} ${res.statusMessage}`)
			}

			// Settle on every terminal response event: 'end' on a clean finish, but also 'error'/'aborted'
			// when the connection is cut mid-response. Without the latter two, only 'end' resolves — so an
			// aborted response would hang the promise, and its unhandled 'error' would crash the process.
			res.on('end', () => settle())
			res.on('error', settle)
			res.on('aborted', () => settle(new Error('Slack webhook response aborted before completion')))
		})

		req.on('error', settle)

		// Fail fast on a hung or unreachable webhook so an awaiting caller (e.g. the validate startup
		// notification) can never block indefinitely. An explicit timer fires at timeoutMs regardless of
		// connection state — request.setTimeout only arms the socket timeout AFTER the socket connects,
		// which a blackholed host never does. Settle the promise directly here rather than relying on
		// req.destroy(err) to emit 'error': if the request was already destroyed/closed without an error,
		// a later destroy(error) is a no-op and no handler would fire, leaving the promise pending past the
		// timeout. Then destroy the request (no-op if already closed) to release its socket.
		const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
			settle(new Error(`Slack webhook request timed out after ${timeoutMs}ms`))
			req.destroy()
		}, timeoutMs)

		req.write(data)
		req.end()
	})
}
