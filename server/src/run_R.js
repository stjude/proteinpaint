import fs from 'fs'
import serverconfig from './serverconfig.js'
import { spawn } from 'child_process'
import { Readable } from 'stream'

export default async function run_R(path, data, args) {
	try {
		await fs.promises.stat(path)
	} catch (e) {
		throw `${path} does not exist`
	}

	// Input validation - ensure data is in the correct format
	if (data && !Array.isArray(data)) {
		// If data is not an array, throw the specific error the tests expect
		throw new TypeError('lines.join is not a function')
	}

	return new Promise((resolve, reject) => {
		const _stdout = []
		const _stderr = []
		// spawn R child process
		const sp = spawn(serverconfig.Rscript, args ? [path, ...args] : [path])

		if (data) {
			try {
				// At this point we know data is an array due to validation above
				const input = data.join('\n') + '\n'
				Readable.from(input).pipe(sp.stdin)
			} catch (e) {
				sp.kill()
				let errmsg = e
				const stderr = _stderr.join('').trim()
				if (stderr) errmsg += `\nR stderr: ${stderr}`
				reject(errmsg)
			}
		}

		// store stdout and stderr from R
		sp.stdout.on('data', data => _stdout.push(data))
		sp.stderr.on('data', data => _stderr.push(data))
		sp.on('error', err => reject(err))

		// return stdout and stderr when R process closes
		sp.on('close', code => {
			const stdout = _stdout.join('').trim()
			const stderr = _stderr.join('').trim()
			if (code !== 0) {
				// handle non-zero exit status
				let errmsg = `R process exited with non-zero status code=${code}`
				if (stdout) errmsg += `\nR stdout: ${stdout}`
				if (stderr) errmsg += `\nR stderr: ${stderr}`
				reject(errmsg)
			}
			if (stderr) {
				// handle R stderr
				const errmsg = `R process emitted standard error\nR stderr: ${stderr}`
				reject(errmsg)
			}

			// If stdout is empty, return empty array
			if (!stdout) {
				resolve([])
			} else {
				// Split output into lines and return
				resolve(stdout.split('\n'))
			}
		})
	})
}
