// SSE = Server-Sent Events
// see proteinpaint/.sse/README.md for background, design

/* these routes are for dev environment only */
import fs from 'fs'
import path from 'path'
import serverconfig from '../../serverconfig.js'
const __dirname = import.meta.dirname

export default function setRoutes(app, basepath) {
	const messages = {}
	const connections = new Map()
	const msgDir = path.join(serverconfig.sseDir, 'messages')

	// when validating server ds and routes init, no need to watch file
	// that would cause the validation to hang, should exit with no error
	if (!process.argv.includes('validate')) fs.watch(msgDir, {}, notifyOnFileChange)

	app.get(basepath + '/sse?', async (req, res) => {
		const host = req.header('host')
		if (connections.has(host)) connections.get(host).end()
		connections.set(host, res)
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
				// console.log('Sse client connection closed.')
				res.end()
				connections.delete(res)
			})

			// emit the message on the next process tick, since the client connection
			// would not be ready for a message while the initial fetch response is still active
			setTimeout(async () => {
				const files = await fs.promises.readdir(msgDir)
				const now = Date.now()
				const time = req.query.time || 0
				// approximate diff in client versus server unix timestamp,
				// to adjust the time comparison between client request and message file mtime
				const nowDiff = Math.abs((req.query.now || now) - now)
				// the 3rd argument type should match the variable connections Set type
				files.forEach(async f => {
					if (f.startsWith('.')) return
					const s = await fs.promises.stat(path.join(msgDir, f))
					// for initial connection, filter out message files
					// that has already been sent to the client based on time and nowDiff
					// console.log(54, Math.abs(time - s.mtimeMs) < 100, Math.abs(time - s.mtimeMs))
					if (!s.isFile() || Math.abs(time - s.mtimeMs) < 100) return
					notifyOnFileChange('change', f, new Set([res]))
				})
			}, 0)
		} catch (err) {
			res.send(err)
		}
	})

	// 3rd agument is to limit to an initial connection,
	// to not trigger infinite reload loops across browser tabs/windows
	async function notifyOnFileChange(eventType, fileName, initialConnection = undefined) {
		try {
			const f = path.join(msgDir, fileName)
			if (!(await fs.promises.stat(f))) delete messages[fileName]
			else {
				const message = await fs.promises.readFile(f, { encoding: 'utf8' })
				if (!message) delete messages[fileName]
				else {
					try {
						messages[fileName] = JSON.parse(message)
					} catch (e) {
						// TODO: handle parsing error
						delete messages[fileName]
						console.log(e)
					}
				}
			}
			const data = JSON.stringify(Object.values(messages))
			const conn = initialConnection || connections
			for (const res of conn.values()) {
				res.write(`event: message\n`)
				res.write(`data: ${data}\n\n`)
			}
		} catch (e) {
			console.log(e)
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
