const fs = require('fs')
const readline = require('readline')

main()

async function main() {
	await output('matrix', 'SJLIFE')
	await output('matrix.ccss', 'CCSS')
}

function output(file, subcohort) {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(file) })
		let first = true
		rl.on('line', line => {
			if (first) return (first = false)
			console.log(line.split('\t')[0] + '\tsubcohort\t' + subcohort)
		})
		rl.on('close', () => {
			resolve()
		})
	})
}
