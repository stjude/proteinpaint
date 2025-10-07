const fs = require('fs')
const path = require('path')

const changelogPath = path.join('CHANGELOG.md')

function extractLatestReleaseChanges() {
	fs.readFile(changelogPath, 'utf8', (err, data) => {
		if (err) {
			console.error('Error reading file:', err)
			process.exit(1) // Exit with error code
		}

		// Regular expression to capture the text between the first two version headers
		const regex = /## \d+\.\d+\.\d+\s+([\s\S]+?)(?=## \d+\.\d+\.\d+)/
		const matches = regex.exec(data)

		if (matches && matches[1]) {
			console.log(matches[1].trim()) // Output to console
		} else {
			console.log('No latest version section found in the changelog')
		}
	})
}

// Calling the function directly if the script is run as a main module
if (require.main === module) {
	extractLatestReleaseChanges()
}
