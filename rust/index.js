const path = require('path'),
	spawn = require('child_process').spawn,
	Readable = require('stream').Readable,
	Transform = require('stream').Transform

exports.run_rust = function (binfile, input_data) {
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

exports.stream_rust = function (binfile, input_data, emitJson) {
	const binpath = path.join(__dirname, '/target/release/', binfile)
	const ps = spawn(binpath)
	const stderr = []
	try {
		// from GDC API -> ps.stdin -> ps.stdout -> transformed stream
		Readable.from(input_data).pipe(ps.stdin)
		//reader.on('data', ps.stdout.pipe)
		//reader.on('error', ps.stderr.pipe)
		//return reader
	} catch (error) {
		ps.kill()
		let errmsg = error
		//if (stderr.length) errmsg += `killed run_rust('${binfile}'), stderr: ${stderr.join('').trim()}`
		//reject(errmsg)
		console.log(59, error)
	}

	const childStream = new Transform({
		transform(chunk, encoding, callback) {
			this.push(chunk)
			callback()
		}
	})
	ps.stdout.pipe(childStream)
	ps.stderr.on('data', data => stderr.push(data))
	ps.on('close', code => { //console.log(72, stderr.length)
		if (stderr.length) {
			// handle rust stderr
			const errors = stderr.join('').trim().split('\n').map(JSON.parse); console.log(75, errors)
			const errmsg = `!!! stream_rust('${binfile}') stderr: !!!\n${errors}`
			console.log(errmsg)
			emitJson({errors})
		} else {
			emitJson({ ok: true, status: 'ok', message: 'Processing complete' })
		}
	})
	ps.on('error', err => {
		console.log(74, `stream_rust().on('error')`, err)
		const errors = stderr.join('').trim().split('\n').map(JSON.parse)
		emitJson({errors})
	})
	// below will duplicate ps.on('close') event above
	// childStream.on('end', () => console.log(`-- childStream done --`))
	return childStream
}
