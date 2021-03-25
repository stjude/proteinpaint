const got = require('got')

const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
const fields = [
	'consequence.transcript.is_canonical',
	'consequence.transcript.transcript_id',
	'consequence.transcript.aa_change',
	'consequence.transcript.consequence_type'
]

;(async () => {
	const response = await got(
		'https://api.gdc.cancer.gov/ssms/edd1ae2c-3ca9-52bd-a124-b09ed304fcc2?fields=' + fields.join(','),
		{ method: 'GET', headers }
	)
	const re = JSON.parse(response.body)
	console.log(JSON.stringify(re, null, 2))
})()
