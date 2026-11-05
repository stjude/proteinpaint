// Import necessary modules
import https from 'https'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { exec } from 'child_process'
import * as tar from 'tar'

// Setting up directory name
const __dirname = import.meta.dirname

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'))
const { version } = packageJson
const pp_release_tag = `v${version}`
const targetDirectory = './target/release'
// the wasm modules, which run_rust() runs instead of spawning their binaries, see index.js
const wasmDirectory = './target/wasm'

function downloadBinary(url, outputPath) {
	download(
		url,
		outputPath,
		() => {
			console.log('Pre-compiled binaries download completed.')
			extractAndClean(outputPath)
		},
		message => {
			console.error(`${message} Compiling from source...`)
			compileFromSource()
		}
	)
}

// The wasm modules do not depend on the platform, so they are downloaded on any architecture. Without them, such as
// for a release from before the rust-wasm asset, run_rust() spawns the binaries instead.
function downloadWasm(url, outputPath) {
	download(
		url,
		outputPath,
		() => {
			fs.mkdirSync(wasmDirectory, { recursive: true })
			tar
				.x({ file: outputPath, cwd: wasmDirectory })
				.then(() => console.log('Rust wasm modules download and extraction completed.'))
				.catch(err => console.error('Error during the wasm modules extraction:', err))
				.finally(() => fs.rm(outputPath, { force: true }, () => {}))
		},
		message => console.warn(`${message} The rust binaries are spawned instead of the wasm modules.`)
	)
}

// downloads a file, following redirects; calls onFail with a message when the download fails
function download(url, outputPath, onDone, onFail) {
	https
		.get(url, function (response) {
			if (response.statusCode >= 200 && response.statusCode <= 299) {
				const file = fs.createWriteStream(outputPath)
				response.pipe(file)
				file.on('finish', function () {
					file.close()
					onDone()
				})
			} else if (response.statusCode >= 300 && response.statusCode <= 399) {
				response.resume()
				if (response.headers.location) {
					download(response.headers.location, outputPath, onDone, onFail)
				} else {
					onFail(`Redirection without location header encountered for ${url}.`)
				}
			} else {
				response.resume()
				onFail(`Failed to download ${url}, status ${response.statusCode}.`)
			}
		})
		.on('error', function (err) {
			onFail(`Error downloading ${url}: ${err.message}.`)
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

downloadWasm(
	`https://github.com/stjude/proteinpaint/releases/download/${pp_release_tag}/rust-wasm-${version}.tar.gz`,
	path.join(__dirname, 'wasm.tar.gz')
)

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
