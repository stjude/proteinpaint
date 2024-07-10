// SSE = Server-Sent Events
// https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events

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
				console.log('Client closed.')
				connections.delete(res)
			})

			setTimeout(async () => {
				const files = await fs.promises.readdir(msgDir)
				files.forEach(f => notifyOnFileChange('change', f))
			}, 0)
		} catch (err) {
			res.send(err)
		}
	})

	async function notifyOnFileChange(eventType, fileName) {
		try {
			const f = path.join(msgDir, fileName)
			if (!(await fs.promises.stat(f))) delete messages[fileName]
			else {
				const message = await fs.promises.readFile(f, { encoding: 'utf8' })
				if (!message) delete messages[fileName]
				else messages[fileName] = JSON.parse(message)
			}
			const data = JSON.stringify(Object.values(messages)) //.map(d => ({key: d[0], message: d[1]})))
			console.log(46, data)
			for (const res of connections) {
				res.write(`event: message\n`)
				res.write(`data: ${data}\n\n`)
			}
		} catch (e) {
			console.log(59, e)
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
