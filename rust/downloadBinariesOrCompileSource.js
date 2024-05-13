const https = require('https')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { exec } = require('child_process')
const tar = require('tar')

// Read package.json to get version and pp_release_tag
const packageJson = require(path.join(__dirname, 'package.json'))
const { version, pp_release_tag } = packageJson

const targetDirectory = './target/release'

function downloadBinary(url, outputPath) {
	const file = fs.createWriteStream(outputPath)
	https
		.get(url, function (response) {
			if (response.statusCode >= 200 && response.statusCode <= 299) {
				response.pipe(file)
				file.on('finish', function () {
					file.close()
					console.log('Pre-compiled binaries download completed.')
					extractAndClean(outputPath)
				})
			} else if (response.statusCode >= 300 && response.statusCode <= 399) {
				if (response.headers.location) {
					downloadBinary(response.headers.location, outputPath)
				} else {
					console.error('Redirection without location header encountered.')
					compileFromSource()
				}
			} else {
				console.error('Failed to download the binary. Compiling from source...')
				compileFromSource()
			}
		})
		.on('error', function (err) {
			console.error('Error downloading the file:', err.message)
			compileFromSource()
		})
}

function compileFromSource() {
	console.log('Starting compilation from source...')
	const compileProcess = exec('cargo build --release', { cwd: path.join(__dirname) })

	compileProcess.stdout.on('data', data => {
		console.log(data.toString()) // Print standard output from cargo to console
	})

	compileProcess.stderr.on('data', data => {
		console.error(data.toString()) // Print standard error from cargo to console as error
	})

	compileProcess.on('exit', code => {
		if (code === 0) {
			console.log('Compilation successful.')
		} else {
			console.error(`Compilation failed with exit code ${code}`)
		}
	})
}

function extractAndClean(tarPath) {
	// Ensure target directory exists
	fs.mkdirSync(targetDirectory, { recursive: true })

	// Extract tar.gz file to target/release directory
	tar
		.x({
			file: tarPath,
			cwd: targetDirectory // Change directory to target/release
		})
		.then(() => {
			console.log('Extraction complete.')
			makeBinariesExecutable()
			// Remove the tar file after successful extraction
			fs.unlink(tarPath, err => {
				if (err) {
					console.error('Error removing the tar file:', err)
				} else {
					console.log('Tar file removed.')
				}
			})
		})
		.catch(err => {
			console.error('Error during extraction:', err)
		})
}

function makeBinariesExecutable() {
	// Construct the full path to the directory
	const fullPath = path.join(__dirname, targetDirectory)
	const command = `chmod -R +x ${fullPath}`

	exec(command, (error, stdout, stderr) => {
		if (error) {
			console.error(`Error setting executable permissions: ${error.message}`)
			return
		}
		if (stderr) {
			console.error(`Error output from chmod: ${stderr}`)
			return
		}
		console.log(`Set executable permissions for all files in ${fullPath}`)
	})
}

const architecture = os.arch()
let binaryUrl = ''

if (architecture === 'x64') {
	binaryUrl = `https://github.com/stjude/proteinpaint/releases/download/${pp_release_tag}/rust-binaries-${version}-linux-x64.tar.gz`
	const outputPath = path.join(__dirname, 'binaries.tar.gz')
	downloadBinary(binaryUrl, outputPath)
} else {
	console.log('Unsupported architecture, attempting to compile from source...')
	compileFromSource()
}
