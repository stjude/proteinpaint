const https = require('https')
const path = require('path')
const zlib = require('zlib')
const tar = require('tar')
const fs = require('fs')
const execSync = require('child_process').execSync

let username
let password
let repoName
let repoUrl
let jFrogArtApiKey
let artifactoryUrl
// TODO Remove modulesToCopy logic when servers get updated to Red Hat 8 and canvas and better-sqlite3 are resolved
let modulesToCopy
let foldersToCopy
let filesToCopy
let symlinksToCreate

const activeFolder = '../active'

if (fs.existsSync('fetcherconfig.json')) {
	const rawdata = fs.readFileSync('fetcherconfig.json')
	const config = JSON.parse(rawdata)
	username = config.username
	password = config.password
	repoName = config.repo_name
	repoUrl = config.repo_url
	jFrogArtApiKey = config.jfrog_art_api_key
	artifactoryUrl = config.artifactory_url
	modulesToCopy = config.modules_to_copy
	foldersToCopy = config.folders_to_copy
	filesToCopy = config.files_to_copy
	symlinksToCreate = config.symlinks_to_create
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
		const request = https.request(`${repoUrl}/${repoName}`, options, async res => {
			if (res.statusCode !== 200) {
				console.error(`Did not get an OK from the server. Code: ${res.statusCode}`)
			}

			res.on('data', d => {
				const repo = JSON.parse(d.toString())
				const date = new Date(repo.lastModified)
				const repoTimestamp = date.getTime()

				console.log(`Repo version date-time: ${date}`)
				console.log(`Repo version timestamp: ${date.getTime()}`)

				const lastRepoPersistedTime = getLastRepoPersistedTime()

				console.log(`Active version timestamp: ${lastRepoPersistedTime}`)

				if (repoTimestamp > lastRepoPersistedTime) {
					downloadAndApplyUpdate(repoTimestamp)
					saveLastRepoPersistedTime(repoTimestamp)
				} else {
					console.log(`No new versions available`)
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

function getLastRepoPersistedTime() {
	let lastRepoPersistedTime = 0

	if (fs.existsSync('version.json')) {
		const rawdata = fs.readFileSync('version.json')
		const version = JSON.parse(rawdata)
		lastRepoPersistedTime = version.lastModified
	}

	return lastRepoPersistedTime
}

function downloadAndApplyUpdate(repoTimestamp) {
	const newActiveFolderName = 'pp-' + repoTimestamp
	const newActiveFolder = '../' + newActiveFolderName

	downloadAndSaveNewPackage(newActiveFolder)
	applyNewPackage(newActiveFolder)
}

function installAndRunNewVersion() {
	console.log('running npm install && pm2 reload')
	try {
		process.chdir(activeFolder)
		execSync(`npm install`, { stdio: 'inherit' })
		console.log(`Npm install finished`)

		process.chdir(activeFolder)
		execSync(`mkdir cache`, { stdio: 'inherit' })

		modulesToCopy.forEach(module => {
			process.chdir(activeFolder)
			execSync(`rm -rf node_modules/${module}`, { stdio: 'inherit' })
			console.log(`deleted module ${module} in active node_modules folder`)

			process.chdir(activeFolder)
			execSync(`cp -r ../src/modules_to_copy/${module} node_modules`, { stdio: 'inherit' })
			console.log(`copied module ${module} to active node_modules folder`)
		})

		process.chdir(activeFolder)
		execSync(`pm2 reload ecosystem.config.js`, { stdio: 'inherit' })
	} catch (e) {
		console.log(e)
		throw e
	}
}

function saveLastRepoPersistedTime(repoTimestamp) {
	const versionJson = {
		lastModified: repoTimestamp
	}

	const data = JSON.stringify(versionJson)
	console.log(`Saving last persisted time: ${repoTimestamp}`)
	fs.writeFileSync('version.json', data)
	console.log(`Last persisted time saved`)
}

function downloadAndSaveNewPackage(newActiveFolder) {
	console.log(`Downloading new version`)
	execSync(`curl  -H "X-JFrog-Art-Api:${jFrogArtApiKey}" ` + `-O -L "${artifactoryUrl}/${repoName}"`)
	console.log(`New archive downloaded`)

	console.log(`Creating archive folder: ${newActiveFolder}`)
	execSync('mkdir ' + newActiveFolder)

	console.log(`Coping ${repoName} to ${newActiveFolder}`)
	execSync(`cp ${repoName}  ${newActiveFolder}`)
}

function applyNewPackage(newActiveFolder) {
	if (fs.existsSync(activeFolder)) {
		console.log('removing active folder...')
		execSync(`rm -r ${activeFolder}`)
		console.log('active folder removed ')
	}

	execSync('mkdir ' + activeFolder)
	console.log(`Created active folder: ${activeFolder}`)

	filesToCopy.forEach(file => {
		execSync(`cp ${file.src} ${file.dest}`)
		console.log(`Copied ${file.src} ${file.dest}`)
	})

	foldersToCopy.forEach(folder => {
		execSync(`cp -r ${folder.src} ${folder.dest}`)
		console.log(`Copied ${folder.src} ${folder.dest}`)
	})

	symlinksToCreate.forEach(symlink => {
		execSync(`cp -r ${symlink.src} ${symlink.dest}`)
		console.log(`Copied ${symlink.src} ${symlink.dest}`)
	})

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
		console.log(`Unpacked repo to new active folder`)
		installAndRunNewVersion()
	})

	unzip.on('error', () => {
		console.log(`Error unpacking repo`)
	})
}
