const path = require('path'),
	spawn = require('child_process').spawn,
	Readable = require('stream').Readable

exports.run_rust = function(binfile, input_data) {
	return new Promise((resolve, reject) => {
		const binpath = path.join(__dirname, '/target/release/', binfile)
		const ps = spawn(binpath)
		const stdout = []
		const stderr = []

		try {
			Readable.from(input_data).pipe(ps.stdin)
		} catch (error) {
			ps.kill()
			let errmsg = error
			if (stderr.length) errmsg += `killed run_rust('${binfile}'), stderr: ${stderr.join('').trim()}`
			reject(errmsg)
		}

		ps.stdout.on('data', data => stdout.push(data))
		ps.stderr.on('data', data => stderr.push(data))
		ps.on('error', err => {
			if (stderr.length) console.log(`run_rust('${binfile}') ps.on('error') stderr:`, stderr)
			reject(err)
		})
		ps.on('close', code => {
			if (code !== 0) reject(`spawned '${binfile}' exited with a non-zero status and this stderr:\n${stderr.join('')}`)
			else if (stderr.length) {
				// handle rust stderr
				const err = stderr.join('').trim()
				const errmsg = `run_rust('${binfile}') emitted standard error\n stderr: ${err}`
				reject(errmsg)
			} else if (stdout.join('').includes('Cannot read bigWig file') == true) {
				// When bigfile is not found, the promise should be rejected with message given below
				reject(stdout.join(''))
			} else {
				//console.log("stdout:",stdout)
				resolve(stdout.join(''))
			}
		})
	})
}
