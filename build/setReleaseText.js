/*
	test by running a commit 

	usage: node setReleaseText.js [releaseTxtFileName="release.txt"] [commitFile]
*/

const fs = require('fs')
const spawnSync = require('child_process').spawnSync
const rp = require('./releaseParser')

let commitLines = []
const commitFile = process.argv[3]
if (commitFile) {
	const commitMsg = fs.readFileSync(commitFile).toString('utf-8').trim()
	commitLines = commitMsg
		.split('\n')
		.map(l => l.trim())
		.filter(l => l.startsWith('feat: ') || l.startsWith('fix: '))
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

// if commit lines with relevant keywords is empty,
// then this is being used to reconcile the release.txt contents from 2 branches,
// for example to avoid merge conflicts
for (const line of commitLines) {
	if (line.startsWith('feat: ')) currSections[rp.FeatTitle].push('- ' + line.slice(6).trim())
	if (line.startsWith('fix: ')) currSections[rp.FixTitle].push('- ' + line.slice(5).trim())
}

const notes = []
for (const title in currSections) {
	const lines = currSections[title]
	if (lines.length) notes.push(title, ...lines, '')
}

console.log(notes.join('\n'))
