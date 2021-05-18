const spawn = require('child_process').spawn
const Readable = require('stream').Readable
const existsSync = require('fs').existsSync

// Function to stream an array of lines into the standard input of an R script. Return value is an array, in which each element is a line of the standard output of the R script.
module.exports = function(lines, Rscript) {
	const table = lines.join('\n') + '\n'
	const stdout = []
	const stderr = []
	return new Promise((resolve, reject) => {
		if (!existsSync(Rscript)) reject('R script does not exist')
		const sp = spawn('Rscript', [Rscript])
		Readable.from(table).pipe(sp.stdin)
		sp.stdout.on('data', data => stdout.push(data))
		sp.stderr.on('data', data => stderr.push(data))
		sp.on('error', err => reject(err))
		sp.on('close', code => {
			if (code !== 0) reject('R process exited with non-zero status')
			const stderrStr = stderr.join('')
			if (stderrStr) reject(stderrStr)
			const stdoutStr = stdout.join('').trim()
			resolve(stdoutStr.split('\n'))
		})
	})
}
