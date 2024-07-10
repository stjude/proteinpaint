/* these routes are for testing only */
import fs from 'fs'
import path from 'path'
import serverconfig from '../../serverconfig.js'

export default function setRoutes(app, basepath) {
	const connections = new Set()
	app.get(basepath + '/notifications', (req, res) => {
		console.log(24, '/notifications')
		connections.add(res)
		try {
			res.writeHead(200, {
				Connection: 'keep-alive',
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Content-Encoding': 'none',
				'X-Accel-Buffering': 'no'
			})
			res.flushHeaders()
			// let x = 0;
			// const id = setInterval(() => {
			// 	const message = JSON.stringify({
			//   	key: 'test',
			//   	message: `x==${x++}`
			//   }); console.log(32, message)
			//   res.write(`event: message\n`);
			//   res.write(`data: ${message}\n\n`);
			// }, 3000);

			res.on('close', () => {
				console.log('Client closed.')
				connections.delete(res)
			})
		} catch (err) {
			res.send(err)
		}
	})

	app.post('/notifications', async (req, res) => {
		console.log(56, req.query)
		for (const res of connections) {
			const data = JSON.stringify(req.query)
			console.log(18, data)
			res.write(`event: message\n`)
			res.write(`data: ${data}\n\n`)
		}
	})
}
