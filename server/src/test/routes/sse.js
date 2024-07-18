// SSE = Server-Sent Events
// see proteinpaint/.sse/README.md for background, design

/* these routes are for dev environment only */
import fs from 'fs'
import path from 'path'
import serverconfig from '../../serverconfig.js'
const __dirname = import.meta.dirname

export default function setRoutes(app, basepath) {
	const messages = {}
	const connections = new Set()
	const msgDir = path.join(serverconfig.sseDir, 'messages')

	fs.watch(msgDir, {}, notifyOnFileChange)

	app.get(basepath + '/sse', async (req, res) => {
		connections.add(res)
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
				//console.log('Client closed.')
				connections.delete(res)
			})

			// emit the message on the next process tick, since the client connection
			// would not be ready for a message while the initial fetch response is still active
			setTimeout(async () => {
				const files = await fs.promises.readdir(msgDir)
				// the 3rd argument type should match the variable connections Set type
				files.forEach(f => !f.startsWith('.') && notifyOnFileChange('change', f, new Set([res])))
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
			for (const res of conn) {
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
