if (process.argv.length != 4) {
	console.log('<annotation.matrix> <termdb> output unknown term ids in annotation file')
	process.exit()
}

const fs = require('fs'),
	readline = require('readline')

const annotationFile = process.argv[2],
	termsFile = process.argv[3]

main()

async function main() {
	const termset = await readTermSet()
	const unknownSet = await readAnnotations(termset)
	console.log('Unknown terms from annotations.matrix:', unknownSet)
}

async function readTermSet() {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(termsFile) })
		const set = new Set()
		rl.on('line', line => {
			set.add(line.split('\t')[0])
		})
		rl.on('close', () => {
			resolve(set)
		})
	})
}

async function readAnnotations(termset) {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(annotationFile) })
		const unknownSet = new Set()
		rl.on('line', line => {
			const tid = line.split('\t')[1]
			if (!termset.has(tid)) unknownSet.add(tid)
		})
		rl.on('close', () => {
			resolve(unknownSet)
		})
	})
}
