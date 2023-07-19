const fs = require('fs')

// reading from files instead of as string arguments to avoid escaping
const releaseTextFile = process.argv[2]
const currentLines = fs.readFileSync(releaseTextFile).toString('utf-8').trim().split('\n')
const currentNotes = currentLines.filter(d => d && true).map(d => d.trim())
const commitFile = process.argv[3]
const commitMsg = fs.readFileSync(commitFile).toString('utf-8').trim()

// keyword convention loosely follows https://www.conventionalcommits.org/en/v1.0.0/
// however, breaking changes is not processed here, that would require
// manual review, handling, coordination, and should not be automated?
//
// TODO: support (scope) syntax, like fix(matrix): or feat(disco):
//
const features = [commitMsg]
	.filter(m => m.toLowerCase().startsWith('feat: '))
	.map(getStringAfter1stSpace)
	.filter(filterListItem)
	.map(getListItem)

const fixes = [commitMsg]
	.filter(m => m.toLowerCase().startsWith('fix: '))
	.map(getStringAfter1stSpace)
	.filter(filterListItem)
	.map(getListItem)

const FeatTitle = 'Enhancements'
const FixTitle = 'Fixes'
const firstSubsectionTitle = currentNotes.includes(FeatTitle) ? FeatTitle : FixTitle
const i = currentNotes.indexOf(firstSubsectionTitle) //; console.log(firstSubsectionTitle)
const generalSection = currentNotes.slice(0, i)
const subsections = currentNotes.slice(i)
// okay for these subsection titles to not exist
const j = currentNotes.indexOf(FixTitle)
const featureSection = firstSubsectionTitle == FeatTitle ? subsections.slice(0, i) : ''
const fixSection = firstSubsectionTitle == FixTitle ? subsections : subsections.split(FixTitle)[1]

let notes = [] //; console.log({generalSection, featureSection, features, fixSection, fixes})
if (generalSection.length) {
	const GeneralTitle = `General`
	if (!currentNotes.includes(GeneralTitle) && generalSection.length) notes.push(GeneralTitle)
	notes.push(...generalSection)
	if (notes.length) notes.push('')
}
if (featureSection || features.length) {
	if (featureSection[0] != FeatTitle) notes.push(FeatTitle)
	if (featureSection) notes.push(...featureSection)
	if (features.length) notes.push(...features)
	if (notes.length) notes.push('')
}
if (fixSection || fixes.length) {
	if (fixSection[0] != FixTitle) notes.push(FixTitle)
	if (fixSection) notes.push(...fixSection)
	if (fixes.length) notes.push(...fixes)
	if (notes.length) notes.push('')
}

fs.writeFileSync(releaseTextFile, notes.join('\n'))
console.log(notes.join('\n'))

function getStringAfter1stSpace(str) {
	return str.slice(str.indexOf(' ') + 1)
}

function getListItem(str) {
	return '- ' + str
}

function filterListItem(str) {
	//console.log(63, str, currentNotes)
	return !currentNotes.includes(str)
}
