const spawn = require('child_process').spawn
const readline = require('readline')

export function get_lines_tabix(args, dir, callback) {
	return new Promise((resolve, reject) => {
		const ps = spawn('tabix', args, { cwd: dir })
		const rl = readline.createInterface({ input: ps.stdout })
		const em = []
		rl.on('line', line => callback(line))
		ps.stderr.on('data', d => em.push(d))
		ps.on('close', () => {
			const e = em.join('').trim()
			if (e) reject(e)
			resolve()
		})
	})
}
export async function get_header_tabix(file, dir) {
	// file is full path file or url
	const lines = []
	await get_lines_tabix([file, '-H'], dir, line => {
		lines.push(line)
	})
	return lines
}
