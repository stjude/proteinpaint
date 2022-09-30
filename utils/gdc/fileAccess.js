/*
this script is hosted at https://proteinpaint.stjude.org/GDC/fileAccess.js

examples:

node fileAccess.js <your token>

corresponds to gdcCheckPermission() in bam.js

*/

const got = require('got')
const token = process.argv[2]

const uuid = '54456595-4ada-4691-84fd-95932b3c7ef8' // TCGA-06-0211-02A-02R-2005-01

const apihost = 'https://api.gdc.cancer.gov'

main()

async function main() {
	// suggested by Phil on 4/19/2022
	// use the download endpoint and specify a zero byte range
	const headers = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		Range: 'bytes=0-0'
	}
	headers['X-Auth-Token'] = token
	const url = apihost + '/data/' + uuid
	try {
		const response = await got(url, { method: 'GET', headers })
		if (response.statusCode >= 200 && response.statusCode < 400) {
			// permission okay
			console.log('Access allowed')
		} else {
			console.log('Invalid status code: ' + response.statusCode)
		}
	} catch (e) {
		// TODO refer to e.code
		throw 'Permission denied'
	}
}
