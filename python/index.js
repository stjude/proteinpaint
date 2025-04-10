const path = require('path'),
	{ spawn, exec } = require('child_process'),
	Readable = require('stream').Readable,
	{ promisify } = require('util'),
	serverconfig = require('../server/src/serverconfig.js')

const execPromise = promisify(exec)
const pythonExec = serverconfig.pythonExec || 'python3'

exports.run_python = function (pyfile, input_data) {
	return new Promise((resolve, reject) => {
		const pypath = path.join(__dirname, '/src/', pyfile)

		const ps = spawn(pythonExec, [pypath])
		const stdout = []
		const stderr = []

		try {
			Readable.from(input_data).pipe(ps.stdin)
		} catch (error) {
			ps.kill()
			let errmsg = error
			if (stderr.length) errmsg += `killed run_python('${pyfile}'), stderr: ${stderr.join('').trim()}`
			reject(errmsg)
		}

		ps.stdout.on('data', data => stdout.push(data))
		ps.stderr.on('data', data => stderr.push(data))
		ps.on('error', err => {
			if (stderr.length) console.log(`run_python('${pyfile}') ps.on('error') stderr:`, stderr)
			reject(err)
		})
		ps.on('close', code => {
			const stderrStr = stderr.join('').trim()
			if (code !== 0) {
				const errorMessage = `spawned '${pyfile}' exited with code ${code} and stderr:\n${stderr.join('')}`
				console.error('Python error:', errorMessage) // Log full error
				reject(errorMessage)
				// reject(`spawned '${pyfile}' exited with a non-zero status and this stderr:\n${stderr.join('')}`)
			} else if (stderr.length) {
				// python stderr
				const err = stderr.join('').trim()
				const errmsg = `run_python('${pyfile}') emitted standard error\n stderr: ${err}`
				reject(err)
			} else {
				if (pyfile === 'plotBrainImaging.py') {
					// Handle binary data
					const imageBuffer = Buffer.concat(stdout)
					const base64Data = imageBuffer.toString('base64')
					const imgUrl = `data:image/png;base64,${base64Data}`
					resolve(imgUrl)
				} else {
					// Handle text data
					resolve(stdout.join(''))
				}
			}
		})
	})
}
