import { execSync } from 'child_process'
import path from 'path'
import * as glob from 'glob'
import { minimatch } from 'minimatch'

const branch = execSync(`git rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' })
// TODO: may need to detect release branch instead of master
const modifiedFiles = execSync(`git diff --name-status master..pr-coverage`, { encoding: 'utf8' })
// only added and modified code files should be tested
const committedFiles = modifiedFiles
	.split('\n')
	.filter(l => l[0] === 'A' || l[0] === 'M')
	.map(l => l.split('\t').pop()) //; console.log(10, committedFiles)
// detect staged files for local testing, should not have any in github CI
const stagedFiles =
	// ['tvs.js', 'tvs.categorical.js', 'tvs.numeric.js'/*, 'something.js'*/].map(f => `client/filter/${f}`) || // uncomment to test
	execSync(`git diff --cached --name-only | sed 's| |\\ |g'`, { encoding: 'utf8' }) // comment to test
const changedFiles = new Set([...committedFiles, ...stagedFiles]) //; console.log(12, changedFiles)

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
// key: dir path
// value: array of spec files under the dir path
const dirSpecs = new Map()
// key: spec dir,name pattern
// value: array of filenames that the pattern applies for test coverage
const patterns = new Map()

for (const f of changedFiles) {
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
	if (!dirSpecs.get(dirname)) {
		const specs = glob.sync(`./test/*.spec.*s`, { cwd: dirname, ignore })
		dirSpecs.set(dirname, specs)
	}
	const specs = dirSpecs.get(dirname)
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

// convert the pattern entries into valid URL parameter strings
const params = []
for (const [k, v] of patterns.entries()) {
	// use a hash to separate the dir+name pattern
	// from the list of files on which the patterm applies;
	// this hash should not be misinterpreted as being used
	// for browser navigation or to trigger a feature
	params.push(`${k}#${v.join(',')}`)
}

//console.log(patterns)
console.log(params.join(' '))
