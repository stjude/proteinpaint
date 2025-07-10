// Import necessary modules
import fs from 'fs'
import path from 'path'
import { spawn, exec } from 'child_process'
import { Readable, Transform } from 'stream'
import { promisify } from 'util'
import { bin } from 'd3'

const __dirname = import.meta.dirname // set __dirname for consistency with cjs code

const execPromise = promisify(exec)

// Check if rust binary directory exists and is not empty
const binaryDir = path.join(__dirname, '/target/release/')
if (!fs.existsSync(binaryDir)) throw `missing rust binary directory='${binaryDir}'`
if (!fs.readdirSync(binaryDir).length) throw `empty rust binary directory='${binaryDir}'`

export function run_rust(binfile, input_data, args = []) {
	return new Promise((resolve, reject) => {
		const binpath = path.join(__dirname, '/target/release/', binfile)
		const ps = spawn(binpath, args)
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

export function stream_rust(binfile, input_data, emitJson) {
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
		Readable.from(input_data)
			.pipe(ps.stdin)
			.on('error', err => {
				emitErrors({ error: `error piping input data to spawned ${binfile} process` })
			})
	} catch (error) {
		console.log(`Error piping input_data into ${binfile}`, error)
		return
	}

	// uncomment to trigger childStream.destroy()
	// setTimeout(() => { console.log(74, 'childStream.destroy()'); childStream.destroy();}, 1000)
	// childStream.destroy() does not seem to trigger ps.stdout.pipe('...').on('error') callback,
	// which is okay as long as the server doesn't crash and ps get's killed eventually
	ps.stdout.pipe(childStream).on('error', err => console.log('ps.stdout.pipe(childStream) error', err))

	ps.stderr.on('data', data => stderr.push(data))

	ps.on('close', code => {
		if (trackedPids.has(ps.pid)) trackedPids.delete(ps.pid)
		if (stderr.length || killedPids.has(ps.pid) || code !== 0) {
			emitErrors(null, ps.pid, code)
		} else {
			emitJson()
		}
	})
	ps.on('error', err => {
		if (trackedPids.has(ps.pid)) trackedPids.delete(ps.pid)
		// console.log(74, `stream_rust().on('error')`, err)
		emitErrors(null, ps.pid)
	})
	ps.on('SIGTERM', err => {
		console.log(err)
	})

	function emitErrors(error, pid, code = 0) {
		// concatenate stderr uint8arr into a string
		let errors = stderr.join('').trim()
		if (error) errors += `\n` + error
		if (pid && killedPids.has(ps.pid) && !trackedPids.has(ps.pid)) {
			errors += '\n' + JSON.stringify({ error: `server error: MAF file processing terminated (expired process)` })
			killedPids.delete(pid)
		} else if (pid && code !== 0) {
			// may result from errors in spawned process code, or external signal (like `kill -9` in terminal)
			errors += '\n' + JSON.stringify({ error: `server error: MAF file processing terminated (code=${code})` })
		}
		emitJson(errors)
	}

	// on('end') will duplicate ps.on('close') event above
	// childStream.on('end', () => console.log(`childStream.on(end)`))

	// this may duplicate ps.on('error'), unless the error happened within the transform
	childStream.on('error', err => {
		console.log('stream_rust childStream.on(error)', err)
		try {
			childStream.destroy(err)
		} catch (e) {
			console.log(e)
		}
	})

	function endStream() {
		try {
			if (!childStream.writableEnded) {
				console.log('trigger childStream.destroy() in endStream()')
				childStream.destroy()
			}
		} catch (e) {
			console.log('error triggering childStream.destroy()', e)
		}
		try {
			if (!ps.killed) {
				console.log('trigger ps.kill() in endStream()')
				ps.kill()
			}
			if (trackedPids.has(ps.pid)) trackedPids.delete(ps.pid)
		} catch (e) {
			console.log('error triggering ps.kill()', e)
		}
	}

	return { rustStream: childStream, endStream }
}

const trackedPids = new Map() // will be used to monitor expired processes
const killedPids = new Set() // will be used to detect killed processes, to help with error detection
const PSKILL_INTERVAL_MS = 30000 // every 30 seconds
let psKillInterval

// default maxElapsed = 5 * 60 * 1000 millisecond = 300000 or 5 minutes, change to 0 to test
// may allow configuration of maxElapsed by dataset/argument
function trackByPid(pid, name, maxElapsed = 300000) {
	if (!pid) return
	// only track by value (integer, string), not reference object
	// NOTE: a reused/reassigned process.pid will be replaced by the most recent process
	trackedPids.set(pid, { name, expires: Date.now() + maxElapsed })
	if (!psKillInterval) psKillInterval = setInterval(killExpiredProcesses, PSKILL_INTERVAL_MS)
	// uncomment below to test
	// console.log([...trackedPids.entries()])
	// if (maxElapsed < 10000) setTimeout(killExpiredProcesses, 1000) // uncomment for testing only
}

//
// Use one setInterval() to monitor >= 1 process,
// instead of a separate setTimeout() for each process.
// This is more reliable as setTimeout would use spawned ps.kill(),
// which may not exist when the timeout callback is executed and
// thus would require clearTimeout(closured_variable). Tracking by
// pid does not rely on a usable 'ps' variable to kill itself.
//
function killExpiredProcesses() {
	//console.log(149, 'killExpiredProcesses()')
	killedPids.clear()
	const time = Date.now()
	for (const [pid, info] of trackedPids.entries()) {
		if (info.expires > time) continue
		try {
			// true if process exists
			process.kill(pid, 0)
		} catch (_) {
			// no need to kill, but remove from tracking
			trackedPids.delete(pid)
			// prevent misleading logs of 'unable to kill ...'
			continue
		}
		const label = `rust process ${info.name} (pid=${pid})`
		try {
			// detect if process exists before killing it
			process.kill(pid, 'SIGTERM')
			trackedPids.delete(pid)
			killedPids.add(pid)
			console.log(`killed ${label}`)
		} catch (err) {
			console.log(`unable to kill ${label}`, err)
		}
	}
}
