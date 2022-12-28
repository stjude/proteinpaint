const https = require('https')
const path = require('path')
const zlib = require('zlib')
const tar = require('tar')
const fs = require('fs')
const exec = require('child_process')
const execSync = require('child_process').execSync

let username
let password
let repoName
let repoUrl
let jFrogArtApiKey
let artifactoryUrl

const activeFolder = '../active'

if (fs.existsSync('fetcherconfig.json')) {
	let rawdata = fs.readFileSync('fetcherconfig.json')
	let config = JSON.parse(rawdata)
	username = config.username
	password = config.password
	repoName = config.repo_name
	repoUrl = config.repo_url
	jFrogArtApiKey = config.jfrog_art_api_key
	artifactoryUrl = config.artifactory_url
} else {
	throw Error('Missing fetcherconfig.json')
}

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
		let request = https.request(`${repoUrl}/${repoName}`, options, async res => {
			if (res.statusCode !== 200) {
				console.error(`Did not get an OK from the server. Code: ${res.statusCode}`)
			}

			res.on('data', d => {
				const repo = JSON.parse(d.toString())
				const date = new Date(repo.lastModified)

				console.log(`Current date-time: ${date}`)
				console.log(`Current timestamp: ${date.getTime()}`)

				const lastRepoPersistedTime = getLastRepoPersistedTime(fs)

				console.log(`Latest timestamp: ${lastRepoPersistedTime}`)

				if (date.getTime() > lastRepoPersistedTime) {
					downloadAndApplyUpdate(lastRepoPersistedTime, fs)
					saveLastRepoPersistedTime(date, fs)
				}
			})
		})

		request.on('error', err => {
			console.error(`Encountered an error trying to make a request: ${err.message}`)
		})

		request.end()
		// wait for 5 minutes
		await sleep(5 * 60 * 1000)
	}
}

function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
}

function getLastRepoPersistedTime(fs) {
	let lastRepoPersistedTime = 0
	if (fs.existsSync('version.json')) {
		let rawdata = fs.readFileSync('version.json')
		let version = JSON.parse(rawdata)
		lastRepoPersistedTime = version.lastModified
	}

	return lastRepoPersistedTime
}

function downloadAndApplyUpdate(lastRepoPersistedTime, fs) {
	console.log(`Downloading new version`)
	execSync(`curl  -H "X-JFrog-Art-Api:${jFrogArtApiKey}" ` + `-O -L "${artifactoryUrl}/${repoName}"`)
	console.log(`New archive downloaded`)

	let archiveFolder = '../pp_server' + lastRepoPersistedTime
	console.log(`Creating archive folder: ${archiveFolder}`)
	execSync('mkdir ' + archiveFolder)
	execSync(`cp ${repoName}  ${archiveFolder}`)
	console.log(`Coping repo to archive folder: ${archiveFolder}`)

	let removeOldActive = `rm -r ${activeFolder}`
	let createNewActive = `mkdir ${activeFolder}`

	execSync(`${removeOldActive}; ${createNewActive}`)

	execSync('cp serverconfig.json ' + activeFolder)
	console.log(`Copied serverconfig.json to active folder`)

	const unzip = fs
		.createReadStream(path.resolve('./' + repoName))
		.on('error', console.log)
		.pipe(zlib.Unzip())
		.pipe(
			tar.x({
				C: activeFolder,
				strip: 1
			})
		)

	unzip.on('end', () => {
		console.log(`Unpacked repo to active folder`)
		installAndRunNewVesion()
	})

	unzip.on('error', () => {
		console.log(`Error unpacking repo`)
	})
}

function installAndRunNewVesion() {
	console.log('running npm install && pm2 reload')

	let goToFolder = 'cd ' + activeFolder
	let npmInstall = 'npm install'
	let createCacheFolder = 'mkdir cache'
	let pm2Reload = 'pm2 reload ecosystem.config.js'

	exec(`${goToFolder} && ${npmInstall} && ${createCacheFolder} && ${pm2Reload}`, (error, stdout, stderr) => {
		if (error) {
			console.log(`error: ${error.message}`)
		}

		if (stderr) {
			console.log(`stderr: ${stderr}`)
		}

		console.log(`Output: ${stdout}`)

		fs.unlinkSync(repoName)
	})
}

function saveLastRepoPersistedTime(date, fs) {
	let versionJson = {
		lastModified: date.getTime()
	}

	let data = JSON.stringify(versionJson)
	console.log(`Saving last persisted time: ${date.getTime()}`)
	fs.writeFileSync('version.json', data)
	console.log(`Last persisted time saved`)
}
