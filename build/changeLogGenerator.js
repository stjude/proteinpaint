const fs = require('fs')
const execSync = require('child_process').execSync

const changeLogFile = './CHANGELOG.md'
const oldChangeLogText = fs.readFileSync(changeLogFile).toString('utf-8')

const releaseTextFile = './release.txt'
const releaseLogText = fs.readFileSync(releaseTextFile).toString('utf-8')

const header = '# Change Log\n' + '\n' + 'All notable changes to this project will be documented in this file.'

const changeLogWithoutHeader = oldChangeLogText.replace(header, '')

const version = require('../package.json').version

// commits since the last release
const commitLog = execSync(`git log "v${version}"..HEAD --oneline`, { encoding: 'utf8' })
const commitMessages = commitLog
	.split('\n')
	.filter(l => l && true)
	.map(getStringAfter1stSpace)

// keyword convention loosely follows https://www.conventionalcommits.org/en/v1.0.0/
// however, breaking changes is not processed here, that would require
// manual review, handling, coordination, and should not be automated?
//
// TODO: support (scope) syntax, like fix(matrix): or feat(disco):
//
const features = commitMessages.filter(m => m.toLowerCase().startsWith('feat: ')).map(getStringAfter1stSpace)
const fixes = commitMessages.filter(m => m.toLowerCase().startsWith('fix: ')).map(getStringAfter1stSpace)
const EnhancementsTitle = 'Enhancements\n'
const FixesTitle = 'Fixes\n'
const firstSubsectionTitle = releaseLogText.includes(EnhancementsTitle) ? EnhancementsTitle : FixesTitle
const [generalSection, subsections] = releaseLogText.split(firstSubsectionTitle)
// okay for these subsection titles to not exist
const featureSection = firstSubsectionTitle == EnhancementsTitle ? subsections.split(FixesTitle)[0] : ''
const fixSection = firstSubsectionTitle == FixesTitle ? subsections?.[0] : subsections.split(FixesTitle)[1]

let notes = ''
if (generalSection) {
	notes += '\n'
	const GeneralTitle = `General\n`
	if (!generalSection.includes('General')) notes += GeneralTitle
	notes += generalSection + '\n'
}
if (featureSection || features) {
	notes += '\n' + EnhancementsTitle
	if (featureSection) notes += featureSection + '\n'
	if (features) notes += features.map(getListItem) + '\n'
}
if (fixSection || fixes) {
	notes += '\n' + FixesTitle
	if (fixSection) notes += fixSection + '\n'
	if (fixes) notes += fixes.map(getListItem) + '\n'
}

if (!notes.length) {
	throw Error(`Empty notes: Release text in ${releaseTextFile} is empty AND no commits had a fix:/feat: keyword`)
}

const newChangeLog = `${header}
## ${version}
${notes}
${changeLogWithoutHeader}`

fs.writeFileSync(changeLogFile, newChangeLog)
fs.writeFileSync(releaseTextFile, '')

function getStringAfter1stSpace(str) {
	return str.slice(str.indexOf(' ') + 1)
}

function getListItem(str) {
	return '- ' + str
}
