/*
	test by running a commit 
*/

const fs = require('fs')
const spawnSync = require('child_process').spawnSync

const GenTitle = 'General:'
const FeatTitle = 'Features:'
const FixTitle = 'Fixes:'

const commitFile = process.argv[3]
const commitMsg = fs.readFileSync(commitFile).toString('utf-8').trim()
const commitLines = commitMsg
	.split('\n')
	.map(l => l.trim())
	.filter(l => l.startsWith('feat: ') || l.startsWith('fix: '))
if (!commitLines.length) process.exit()

// use the release.txt from origin/master to help minimize merge conflict
const ps = spawnSync('curl', ['-s', 'https://raw.githubusercontent.com/stjude/proteinpaint/master/release.txt'], {
	encoding: 'utf-8'
})
if (ps.stderr) throw remoteReleaseTxt.stderr
const remoteReleaseTxt = ps.stdout
const remoteSections = getSections(remoteReleaseTxt)

// reading from files instead of as string arguments to avoid escaping
const localReleaseTxtFile = process.argv[2]
const localReleaseTxt = fs.readFileSync(localReleaseTxtFile).toString('utf-8').trim()
const currSections = getSections(localReleaseTxt, remoteSections)

for (const line of commitLines) {
	if (line.startsWith('feat: ')) currSections[FeatTitle].push('- ' + line.slice(6).trim())
	if (line.startsWith('fix: ')) currSections[FixTitle].push('- ' + line.slice(5).trim())
}

const notes = []
for (const title in currSections) {
	const lines = currSections[title]
	if (lines.length) notes.push(title, ...lines, '')
}

const content = notes.join('\n')
fs.writeFileSync(localReleaseTxtFile, content)
console.log(notes.join('\n'))

function getSections(releaseTxt, _bySection = null) {
	const bySection = _bySection || {
		[GenTitle]: [],
		[FeatTitle]: [],
		[FixTitle]: []
	}
	const lines = releaseTxt.split('\n').map(l => l.trim())
	let currSection = bySection[GenTitle]
	for (const line of lines) {
		if (line in bySection) {
			currSection = bySection[line]
		} else if (line && !currSection.includes(line)) {
			currSection.push(line)
		}
	}
	return bySection
}
