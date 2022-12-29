const https = require('https')
const path = require('path')
const zlib = require('zlib')
const tar = require('tar')
const fs = require('fs')
const exec = require('child_process').exec
const execSync = require('child_process').execSync

if (!fs.existsSync('./fetcherconfig.json')) {
	throw Error('Missing fetcherconfig.json')
}

const json = fs.readFileSync('fetcherconfig.json')
const config = JSON.parse(json)
const wait = config.wait || 5
const activeFolder = config.activeFolder || '../server'

const username = config.username
const password = config.password
const repoName = config.repo_name
const repoUrl = config.repo_url
const jFrogArtApiKey = config.jfrog_art_api_key
const artifactoryUrl = config.artifactory_url

const options = {
	method: 'GET',
	headers: {
		Authorization: 'Basic ' + Buffer.from(username + ':' + password).toString('base64')
	}
}

pollForNewVersion()

async function pollForNewVersion() {
	while (true) {
		console.log(`Check new version on: ${repoUrl}/${repoName}`)
		const request = https.request(`${repoUrl}/${repoName}`, options, async res => {
			if (res.statusCode !== 200) {
				console.error(`Did not get an OK from the server. Code: ${res.statusCode}`)
			}

			res.on('data', d => {
				const repo = JSON.parse(d.toString())
				const date = new Date(repo.lastModified)

				console.log(`Repo version date-time: ${date}`)
				console.log(`Repo version timestamp: ${date.getTime()}`)

				const lastRepoPersistedTime = getLastRepoPersistedTime()

				console.log(`Active version timestamp: ${lastRepoPersistedTime}`)

				if (date.getTime() > lastRepoPersistedTime) {
					downloadAndApplyUpdate(lastRepoPersistedTime, fs)
					saveLastRepoPersistedTime(date, fs)
				} else {
					console.log(`No new versions available`)
				}
			})
		})

		request.on('error', err => {
			console.error(`Encountered an error trying to make a request: ${err.message}`)
		})

		request.end()
		// wait before the next fetch
		await sleep(wait * 1000 * 60)
	}
}

function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
}

function getLastRepoPersistedTime() {
	if (!fs.existsSync('version.json')) return 0
	const rawdata = fs.readFileSync('version.json')
	const version = JSON.parse(rawdata)
	return version.lastModified
}

function downloadAndApplyUpdate(lastRepoPersistedTime) {
	console.log(`Downloading new version`)
	execSync(`curl  -H "X-JFrog-Art-Api:${jFrogArtApiKey}" ` + `-O -L "${artifactoryUrl}/${repoName}"`)
	console.log(`New archive downloaded`)

	const newActiveFolderName = 'pp-' + lastRepoPersistedTime
	const newActiveFolder = '../' + newActiveFolderName
	console.log(`Creating archive folder: ${newActiveFolder}`)
	execSync('mkdir ' + newActiveFolder)

	execSync(`ln -sfn ${newActiveFolderName}  ${activeFolder}`)

	execSync('cp serverconfig.json ' + newActiveFolder)

	console.log(`Copied serverconfig.json to active folder`)

	const unzip = fs
		.createReadStream(path.resolve('./' + repoName))
		.on('error', console.log)
		.pipe(zlib.Unzip())
		.pipe(
			tar.x({
				C: newActiveFolder,
				strip: 1
			})
		)

	unzip.on('end', () => {
		console.log(`Unpacked repo to new active folder`)
		installAndRunNewVesion()
	})

	unzip.on('error', () => {
		console.log(`Error unpacking repo`)
	})
}

function installAndRunNewVesion() {
	console.log('running npm install && pm2 reload')
	try {
		process.chdir(activeFolder)
		execSync(`npm install`, { stdio: 'inherit' })
		execSync(`mkdir cache`, { stdio: 'inherit' })
		execSync(`pm2 reload ecosystem.config.js`, { stdio: 'inherit' })
	} catch (e) {
		console.log(e)
		throw e
	}
}

function saveLastRepoPersistedTime(date) {
	const versionJson = {
		lastModified: date.getTime()
	}

	const data = JSON.stringify(versionJson)
	console.log(`Saving last persisted time: ${date.getTime()}`)
	fs.writeFileSync('version.json', data)
	console.log(`Last persisted time saved`)
}
