const path = require('path'),
	{ spawn, exec } = require('child_process'),
	Readable = require('stream').Readable,
	Transform = require('stream').Transform,
	{ promisify } = require('util')

const execPromise = promisify(exec)

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
	const childStream = new Transform({
		transform(chunk, encoding, callback) {
			this.push(chunk)
			callback()
		}
	})
	// we only want to run this interval loop inside a container, not in dev/test CI
	if (binfile == 'gdcmaf') trackByPid(ps.pid, binfile)
	const stderr = []
	try {
		// from route handler -> input_data -> ps.stdin -> ps.stdout -> transformed stream -> express response.pipe()
		Readable.from(input_data).pipe(ps.stdin)
	} catch (error) {
		console.log(`Error piping input_data into ${binfile}`, error)
		return
	}

	ps.stdout.pipe(childStream)
	ps.stderr.on('data', data => stderr.push(data))
	ps.on('close', code => {
		trackedPids.delete(ps.pid)
		if (stderr.length) {
			// handle rust stderr
			const errors = stderr.join('').trim().split('\n').map(JSON.parse)
			//const errmsg = `!!! stream_rust('${binfile}') stderr: !!!`
			//console.log(errmsg, errors)
			emitJson({ errors })
		} else {
			emitJson({ ok: true, status: 'ok', message: 'Processing complete' })
		}
	})
	ps.on('error', err => {
		trackedPids.delete(ps.pid)
		// console.log(74, `stream_rust().on('error')`, err)
		const errors = stderr.join('').trim().split('\n').map(JSON.parse)
		emitJson({ errors })
	})

	// on('end') will duplicate ps.on('close') event above
	// childStream.on('end', () => console.log(`-- childStream done --`))

	// this may duplicate ps.on('error'), unless the error happened within the transform
	childStream.on('error', err => {
		console.log('stream_rust childStream.on(error)', err)
		try {
			childStream.destroy(err)
		} catch (e) {
			console.log(e)
		}
	})
	return childStream
}

const trackedPids = new Map()
const PSKILL_INTERVAL_MS = 30000 // every 30 seconds
let psKillInterval

// default maxElapsed = 5 * 60 * 1000 millisecond = 300000, change to 0 to test
// may allow configuration of maxElapsed by dataset/argument
function trackByPid(pid, name, maxElapsed = 300000) {
	if (!pid) return
	// only track by value (integer, string), not reference object
	trackedPids.set(pid, { name, expires: Date.now() + maxElapsed })
	if (!psKillInterval) psKillInterval = setInterval(killExpiredProcess, PSKILL_INTERVAL_MS)
	// uncomment below to test
	// console.log([...trackedPids.entries()])
	// setTimeout(killExpiredProcess, 5) // uncomment for testing only
}

//
// Use one setInterval() to monitor >= 1 process,
// instead of a separate setTimeout() for each process.
// This is more reliable as setTimeout would use spawned ps.kill(),
// which may not exist when the timeout callback is executed and
// thus would require clearTimeout(closured_variable). Tracking by
// pid does not rely on a usable 'ps' variable to kill itself.
//
function killExpiredProcess() {
	const time = Date.now()
	for (const [pid, info] of trackedPids.entries()) {
		if (info.expires > time) continue
		const label = `rust process ${info.name} (pid=${pid})`
		try {
			process.kill(pid, 'SIGINT')
			trackedPids.delete(pid)
			console.log(`killed ${label}`)
		} catch (err) {
			console.log(`unable to kill ${label}`, err)
		}
	}
}
