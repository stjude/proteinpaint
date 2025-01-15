// SSE = Server-Sent Events
// see proteinpaint/.sse/README.md for background, design

/* these routes are for dev environment only */
import fs from 'fs'
import path from 'path'
import serverconfig from '../../serverconfig.js'
import notifier from 'node-notifier'

const __dirname = import.meta.dirname
notifier.notify({ title: 'PP server', message: 'restarted' })

const sse = serverconfig.sse !== false && path.join(serverconfig.binpath, '.sse')

export default function setRoutes(app, basepath) {
	// when validating server ds and routes init, no need to watch file
	// that would cause the validation to hang, should exit with no error
	if (process.argv.includes('validate') || !serverconfig.debugmode) return
	// dev or test script will create .sse/messages as needed in non-prod environments,
	// sse routes, notification is disabled if this msgDir is not present
	const msgDir = path.join(serverconfig.binpath, '../.sse/messages')
	if (!fs.existsSync(msgDir)) return

	// will track only one active sse connection per origin
	// - key: req.header('host')
	// - value: res (second argument to route handler)
	const connections = new Map()

	app.get(basepath + '/sse?', async (req, res) => {
		const host = req.header('host')
		if (connections.has(host)) connections.get(host).end()
		connections.set(host, res)
		// console.log(25, 'num conn=', connections.size)
		try {
			res.writeHead(200, {
				Connection: 'keep-alive',
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'X-Accel-Buffering': 'no',
				'Content-encoding': 'none'
			})
			res.flushHeaders()

			res.on('close', () => {
				// console.log('--- Sse client connection closed. ---')
				res.end()
				connections.delete(res)
			})

			// emit the message on the next process tick, since the client connection
			// would not be ready for a message while the initial fetch response is still active
			setTimeout(() => notify([res]), 0)
		} catch (err) {
			res.send(err)
		}
	})

	// messages will store all current message to be sent as notifications
	// - key: message filename or source, value: message text
	// - notify() will clear this store once all connections have been notified
	const messages = new Map()

	// initiliaze message detection
	setTimeout(async () => {
		messages.set('server', {
			key: 'server',
			message: 'restarted',
			status: 'ok',
			color: 'green',
			duration: 2500,
			reload: true,
			time: Date.now()
		})
		// messages initialization will delete files, so do not watch the directory
		// until that is done since the deletion will trigger a watched event
		await setMessageFromFile()
		// message events will detected via file events, which is more reliable
		// than posting to a server route that will not be available on server
		// code rebundling/restart
		fs.watch(msgDir, {}, notifyOnFileChange)
	}, 0)

	// initialConnection will avoid re-notifying previous connections
	function notify(initialConnection) {
		const msgArr = [...messages.values()].sort((a, b) => (a.time < b.time ? -1 : 1))
		const data = JSON.stringify(msgArr)
		const text = `data: ${data}\n\n`
		const conn = initialConnection || connections.values()
		for (const res of conn) {
			res.write(`event: message\n`)
			res.write(text)
		}
		// delay clearing messages to allow re-connections to receive recent messages
		setTimeout(clearMessages, 3000)
	}

	async function setMessageFromFile(fileName) {
		const now = Date.now()
		try {
			const files = await fs.promises.readdir(msgDir)
			if (fileName && !files.includes(fileName)) {
				messages.delete(fileName)
			} else {
				const p = await Promise.all(
					files.map(async f => {
						const file = path.join(msgDir, f)
						const s = await fs.promises.stat(file)
						if (!f.startsWith('.') && s.isFile()) {
							const message = await fs.promises.readFile(file, { encoding: 'utf8' })
							messages.set(f, JSON.parse(message))
							fs.unlink(file, logErr)
						}
					})
				)
			}
		} catch (e) {
			console.log(e)
		}
	}

	async function notifyOnFileChange(_, fileName) {
		await setMessageFromFile(fileName)
		if (messages.has(fileName)) notify()
	}

	function clearMessages() {
		messages.clear()
	}

	// deprecated since messages cannot be posted when the server is rebundling/restarting
	// app.post('/notifications', async (req, res) => {
	// 	for (const res of connections) {
	// 		const data = JSON.stringify(req.query)
	// 		console.log(18, data)
	// 		res.write(`event: message\n`)
	// 		res.write(`data: ${data}\n\n`)
	// 	}
	// })
}

function logErr(e) {
	if (e) console.log(e)
}
