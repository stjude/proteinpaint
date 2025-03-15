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

let detectInterval

exports.stream_rust = function (binfile, input_data, emitJson) {
	const binpath = path.join(__dirname, '/target/release/', binfile)
	// we only want to run this interval loop inside a container, not in dev/test CI
	if (!detectInterval && binfile == 'gdcmaf') {
		detectInterval = setInterval(detectAndKillLongRunningRustProcess, 60000) // in millseconds
	}

	const ps = spawn(binpath)
	const stderr = []
	try {
		// from GDC API -> ps.stdin -> ps.stdout -> transformed stream
		Readable.from(input_data).pipe(ps.stdin)
		//reader.on('data', ps.stdout.pipe)
		//reader.on('error', ps.stderr.pipe)
		//return reader
	} catch (error) {
		console.log(error)
		//let errmsg = error
		//if (stderr.length) errmsg += `killed run_rust('${binfile}'), stderr: ${stderr.join('').trim()}`
		//console.log(errmsg)
	}

	const childStream = new Transform({
		transform(chunk, encoding, callback) {
			this.push(chunk)
			callback()
		}
	})

	ps.stdout.pipe(childStream)
	ps.stderr.on('data', data => stderr.push(data))
	ps.on('close', code => {
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
		//console.log(74, `stream_rust().on('error')`, err)
		const errors = stderr.join('').trim().split('\n').map(JSON.parse)
		emitJson({ errors })
	})

	// displayRustProcesses(binpath, 1) // use only for testing

	// on('end') will duplicate ps.on('close') event above
	// childStream.on('end', () => console.log(`-- childStream done --`))
	// this may duplicate ps.on('error'), unless the error happened within the transformation
	childStream.on('error', err => console.log('stream_rust childStream.on(error)', err))
	return childStream
}

// to test, run `sleep 5555` in 1 or more terminal windows,
// which should be all killed when making a request to gdc/MafBuild
// const srcpath = 'sleep 5555' // uncomment to test and comment out below
const srcpath = path.join(__dirname, 'target/release/gdcmaf')
const PROCESS_TIMEOUT = 5 * 60 // in seconds

async function detectAndKillLongRunningRustProcess() {
	try {
		// console.log(`\n--- detecting and killing long running rust streams (>${PROCESS_TIMEOUT} seconds) using exec() ---`)
		const ps = await execPromise(`ps -eo pid,etime,command | grep '${srcpath}'`, {
			encoding: 'utf-8',
			stdio: 'inherit'
		})
		if (!ps.stderr && typeof ps.stdout === 'string') {
			const lines = ps.stdout.trim().split('\n')
			for (const line of lines) {
				if (!line || typeof line != 'string') continue
				if (line.includes(srcpath)) {
					const [pid, etime, ...rest] = line
						.split(' ')
						.filter(f => !!f)
						.map(v => v.trim()) //; console.log(132, rest)
					if (rest.includes('grep')) continue
					const [sec, min, hour] = etime.split(':').reverse() //; console.log(134, etime.split(':').reverse(), line)
					const elapsed = Number(sec) + 60 * Number(min) + 3600 * (Number(hour) || 0) //; console.log(127, {elapsed})
					if (elapsed >= PROCESS_TIMEOUT) {
						//console.log(136, 'killing process')
						execPromise(`kill -9 ${pid}`, (_, out) => console.log(out))
					}
				}
			}
		}
		// console.log('--- after detecting/killing long running process --')
		// displayRustProcesses(srcpath)
		// console.log('--- done detecting/killing long running process --\n')
	} catch (e) {
		//console.log(140, e)
		// okay to not have any process to kill
		//console.log(e)
	}
}

function displayRustProcesses(binpath, killTimeout = 0) {
	exec(`ps -eo comm,pid,etime | grep "${binpath}"`, { encoding: 'utf-8' }, (err, out) => console.log(out))
	if (killTimeout) setTimeout(detectAndKillLongRunningRustProcess, killTimeout)
}
