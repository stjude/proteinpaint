/*
	call from the proteinpaint project dir
	usage: node changeLogGenerator.cjs [-u]
	
	-u output only the unreleased change notes 
*/

const fs = require('fs')
const rp = require('./releaseParser')

const options = process.argv[2] || ''
const releaseTxtFile = './release.txt'
const releaseLogText = fs.readFileSync(releaseTxtFile).toString('utf-8')

const version = require('../package.json').version
const changeLogFile = './CHANGELOG.md'
const oldChangeLogText = fs.readFileSync(changeLogFile).toString('utf-8')
const start = oldChangeLogText.indexOf('Unreleased')
// ok to not have new release notes when merging a PR, but required for release
if (releaseLogText === '' && start == -1) process.exit()
const stop = oldChangeLogText.indexOf('\n##', start)
const unreleasedText = oldChangeLogText.slice(start, stop)

const unreleasedSections = rp.getSections(unreleasedText)
const currSections = rp.getSections(releaseLogText, unreleasedSections)

const notes = [
	'# Change Log',
	'',
	'All notable changes to this project will be documented in this file.',
	'',
	'## Unreleased',
	''
]

for (const title in currSections) {
	const lines = currSections[title]
	if (lines.length) notes.push(title, ...lines, '')
}

if (!options.includes('u')) notes.push(oldChangeLogText.slice(stop))

console.log(notes.join('\n'))
