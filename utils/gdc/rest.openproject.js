/*
this script is hosted at https://proteinpaint.stjude.org/GDC/rest.openproject.js

get the list of open-access project_ids

run as:

node rest.openproject.js

corresponds to getOpenProjects() of termdb.gdc.js
*/

const got = require('got')

const fs = require('fs')

const headers = {
	'Content-Type': 'application/json',
	Accept: 'application/json'
}

const url = 'https://api.gdc.cancer.gov/files'

const data = {
	filters: {
		op: 'and',
		content: [
			{
				op: '=',
				content: {
					field: 'access',
					value: 'open'
				}
			},
			{
				op: '=',
				content: {
					field: 'data_type',
					value: 'Masked Somatic Mutation'
				}
			}
		]
	},
	facets: 'cases.project.project_id',
	size: 0
}

;(async () => {
	try {
		const tmp = await got(url, { method: 'POST', headers, body: JSON.stringify(data) })

		const re = JSON.parse(tmp.body)
		console.log(JSON.stringify(re, null, 2))
	} catch (error) {
		console.log(error)
	}
})()
