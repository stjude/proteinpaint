const fs = require('fs')

const changeLogFile = './CHANGELOG.md'
const oldChangeLogText = fs.readFileSync(changeLogFile).toString('utf-8')

const releaseTextFile = './release.txt'
const releaseLogText = fs.readFileSync(releaseTextFile).toString('utf-8')

if (releaseLogText === '') {
	throw Error(`Release text in ${releaseTextFile} is empty`)
}

const header = '# Change Log\n' + '\n' + 'All notable changes to this project will be documented in this file.'

const changeLogWithoutHeader = oldChangeLogText.replace(header, '')

const version = require('../package.json').version

const newChangeLog = `${header} 
## ${version}

${releaseLogText}
${changeLogWithoutHeader}`

fs.writeFileSync(changeLogFile, newChangeLog)
fs.writeFileSync(releaseTextFile, '')
