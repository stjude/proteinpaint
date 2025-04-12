// SSE = Server-Sent Events
// see proteinpaint/.sse/README.md for background, design

/* these routes are for dev environment only */
import fs from 'fs'
import path from 'path'
import serverconfig from '../../serverconfig.js'
import notifier from 'node-notifier'

const __dirname = import.meta.dirname
notifier.notify({ title: 'PP server', message: 'restarted' })

const sse = serverconfig.features.sse && path.join(serverconfig.binpath, '.sse')
const serverEntry = path.join(process.cwd(), 'server.ts')

export default function setRoutes(app, basepath) {
	// when validating server ds and routes init, no need to watch file
	// that would cause the validation to hang, should exit with no error
	if (process.argv.includes('validate') || !serverconfig.debugmode) return
	if (!fs.existsSync(serverEntry)) return

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

	// messages will buffer/store all current message to be sent as notifications
	// - key: message filename or source
	// - value: message text
	// - notify() will clear this buffer/store once all connections have been notified
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

		// detect server bundle file stat, to use for filtering message files by time
		const bundleStat = await fs.promises.stat(serverEntry)

		// scan msgDir once to initialize filename keys in messages,
		// additional file event sources will be added via fs.watch() callback
		const files = await fs.promises.readdir(msgDir)
		const msgFiles = await Promise.all(
			files.map(async file => {
				if (file.startsWith('.')) return false
				try {
					const s = await fs.promises.stat(path.join(msgDir, file))
					// console.log(88, bundleStat.mtimeMs - s.mtimeMs)
					// only show messages that are < 30 seconds older than server bundle on restart
					return s.isFile() && bundleStat.mtimeMs < s.mtimeMs + 30000 && file
				} catch (e) {
					console.log(e)
				}
			})
		)
		await setMessageFromFile(msgFiles.filter(f => typeof f == 'string'))
		// message events will detected via file events, which is more reliable
		// than posting to a server route that will not be available on server
		// code rebundling/restart
		fs.watch(msgDir, {}, notifyOnFileChange)
	}, 0)

	// initialConnection will avoid re-notifying previous connections
	function notify(initialConnection) {
		const msgArr = [...messages.values()].map(markPendingDeletion).sort(sortByTime)
		const data = JSON.stringify(msgArr)
		const text = `data: ${data}\n\n`
		const conn = initialConnection || connections.values()
		for (const res of conn) {
			res.write(`event: message\n`)
			res.write(text)
		}
		// delay clearing messages to allow re-connections to receive very recent messages
		setTimeout(clearMessages, 3000)
	}

	async function setMessageFromFile(files) {
		const now = Date.now()
		try {
			const p = await Promise.all(
				files.map(async f => {
					const file = path.join(msgDir, f)
					try {
						const message = await fs.promises.readFile(file, { encoding: 'utf8' })
						if (message) messages.set(f, JSON.parse(message))
					} catch (e) {
						if (message.has(f)) message.delete(f)
					}
				})
			)
		} catch (e) {
			console.log(e)
		}
	}

	async function notifyOnFileChange(_, fileName) {
		await setMessageFromFile([fileName])
		if (messages.has(fileName)) notify()
	}

	function markPendingDeletion(message) {
		message.pendingDeletion = true
		return message
	}

	function sortByTime(a, b) {
		return a.time < b.time ? -1 : 1
	}

	function clearMessages() {
		for (const [file, message] of messages.entries()) {
			// if this function was called with setTimeout,
			// then it's possible that the message is newer than
			// when the timeout was set, in that case the new
			// message would not have pendingDeletion flag and
			// should not be deleted
			if (message.pendingDeletion) messages.delete(file)
		}
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
