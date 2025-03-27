import { execSync } from 'child_process'
import path from 'path'
import * as glob from 'glob'
import { minimatch } from 'minimatch'

const stagedFiles = execSync(`git diff --cached --name-only | sed 's| |\\ |g'`, { encoding: 'utf8' })
//const stagedFiles = ['tvs.js', 'tvs.categorical.js', 'tvs.numeric.js', 'something.js'].map(f => `client/filter/${f}`)

const relevantClientDirs = [
	'common',
	'dom',
	'filter',
	'gdc',
	'mass',
	'plots',
	'rx',
	'src', // TODO: move all relevant dirs under src/
	'termdb',
	'termsetting',
	'tracks',
	'tw'
]

const clientParentDir = path.join(import.meta.dirname, '../..')
const ignore = ['dist/**', 'node_modules/**']
const dirList = new Map()
const patterns = new Map()

for (const f of stagedFiles) {
	if (!f.startsWith('client/')) continue
	let matched = false
	for (const dir of relevantClientDirs) {
		if (f.startsWith(`client/${dir}`)) {
			matched = true
			break
		}
	}
	if (!matched) continue
	const dirname = path.join(clientParentDir, path.dirname(f))
	if (!dirList.get(dirname)) {
		const specs = glob.sync(`./test/*.spec.*s`, { cwd: dirname, ignore })
		dirList.set(dirname, specs)
	}
	const specs = dirList.get(dirname)
	const fileName = f.split('/').pop()
	const fileNameSegments = fileName.split('.')
	const filedir = dirname.split('/').pop()
	while (fileNameSegments.length) {
		fileNameSegments.pop()
		const truncatedFilename = fileNameSegments.length ? fileNameSegments.join('.') : filedir
		// console.log(50, {truncatedFilename}, `${truncatedFilename}.unit.spec`)
		const matched = specs.filter(
			f => f.includes(`${truncatedFilename}.unit.spec.`) || f.includes(`/${truncatedFilename}.integration.spec.`)
		)
		// console.log(51, matched)
		if (matched.length) {
			const pattern = `dir=${filedir}&name=${truncatedFilename}*`
			if (!patterns.get(pattern)) patterns.set(pattern, [])
			patterns.get(pattern).push(fileName)
			break
		}
	}
}

const params = []
for (const [k, v] of patterns.entries()) {
	params.push(`${k}&staged=${v.join(',')}`)
}

//console.log(patterns)
console.log(params.join(' '))
