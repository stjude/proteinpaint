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
	lastMessageHashFile: string
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

		// Send message to Slack
		const req = https.request(new URL(webhookUrl), options, res => {
			if (res.statusCode === 200) {
				console.log(`Message posted successfully on Slack`)
				// Save the new hash to the file
				fs.writeFileSync(lastMessageHashFile, `lastSlackMessageHash=${hash}`, 'utf8')
			} else {
				console.log(`Error posting message on Slack: ${res.statusCode} ${res.statusMessage}`)
			}

			res.on('end', () => {
				resolve()
			})
		})

		req.on('error', e => {
			console.error(`Error posting message to Slack: ${e.message}`)
			reject(e)
		})

		req.write(data)
		req.end()
	})
}
