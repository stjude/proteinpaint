const got = require('got')

if (process.argv.length != 3) {
	console.log('token file missing')
	process.exit()
}

const fs = require('fs')
const token = fs.readFileSync(process.argv[2], { encoding: 'utf8' }).trim()

const headers = {
	'Content-Type': 'application/json',
	Accept: 'application/json',
	'X-Auth-Token': token
}

const url = 'https://portal.gdc.cancer.gov/auth/user'

;(async () => {
	try {
		const tmp = await got(url, { method: 'GET', headers })

		const re = JSON.parse(tmp.body)
		console.log(re)
	} catch (error) {
		console.log(error)
	}
})()
