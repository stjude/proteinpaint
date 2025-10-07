/*
	can test by running a commit,

	or from the command line:
	usage: node setReleaseText.cjs [releaseTxtFileName="release.txt"] [commitFile]

	if releaseTextFileName == "--empty", a starter template with empty sections will be outputted
*/

const fs = require('fs')
const spawnSync = require('child_process').spawnSync
const rp = require('./releaseParser.cjs')

if (process.argv[2] == '--empty') {
	console.log(rp.titles.map(t => `${t}\n- \n`).join('\n'))
	process.exit()
}

let commitLines = []
const commitFile = process.argv[3]

// note that a `: ` (colon + space) is expected after the keyword
const keywords = Object.keys(rp.keywordsToTitle).map(kw => `${kw}: `)
if (commitFile) {
	const commitMsg = fs.readFileSync(commitFile).toString('utf-8').trim()
	commitLines = commitMsg
		.split('\n')
		.map(l => l.trim())
		.filter(l => keywords.find(kw => l.startsWith(kw)))
	// exit early if a commit file option is provided but
	// there are not detected release notes from the commit message
	if (!commitLines.length) process.exit()
}

const releaseTxtFileName = process.argv[2] || 'release.txt'
// use the release.txt from origin/master to help minimize merge conflict
const ps = spawnSync(
	'curl',
	['-s', `https://raw.githubusercontent.com/stjude/proteinpaint/master/${releaseTxtFileName}`],
	{
		encoding: 'utf-8'
	}
)
if (ps.stderr) throw remoteReleaseTxt.stderr
const remoteReleaseTxt = ps.stdout
const remoteSections = rp.getSections(remoteReleaseTxt)

// reading from files instead of as string arguments to avoid escaping
const localReleaseTxtFile = releaseTxtFileName
const localReleaseTxt = fs.readFileSync(localReleaseTxtFile).toString('utf-8').trim()
const currSections = rp.getSections(localReleaseTxt, remoteSections)

for (const line of commitLines) {
	for (const kw of keywords) {
		if (line.toLowerCase().startsWith(kw)) {
			// need to remove `: ` from the keyword for mapping to title
			const title = rp.keywordsToTitle[kw.slice(0, -2)]
			const entry = '- ' + line.slice(kw.length).trim()
			if (!currSections[title].includes(entry)) currSections[title].push(entry)
		}
	}
}

const notes = []
for (const title in currSections) {
	const lines = currSections[title]
	if (lines.length) notes.push(title, ...lines, '')
}

console.log(notes.join('\n'))
