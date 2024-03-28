#!/usr/bin/env node

import serverconfig from '../src/serverconfig.js'
import jsonwebtoken from 'jsonwebtoken'

const time = Math.floor(Date.now() / 1000)
const dslabel = process.argv[2] || 'TermdbTest'
const dsCred = serverconfig.dsCredentials[dslabel]
const embedder = process.argv[3] || (dsCred.termdb['*'] ? '*' : 'localhost')
const cred = dsCred.termdb[embedder]
const data = {
	iat: time,
	exp: time + 3600,
	datasets: ['TermdbTest', 'SJLife', 'PNET', 'sjlife', 'ccss', 'ABC', 'XYZ', 'abc', 'xyz'],
	email: 'username@test.tld',
	ip: '127.0.0.1'
}

// for testing only
if (cred?.processor) {
	;(async () => {
		const _ = await import(cred.processor)
		const { generatePayload, test } = _.default
		const url = process.argv[4] ? `${serverconfig.URL}${process.argv[4]}` : ''
		if (url) {
			console.log(await test(cred, url, 'viz.stjude.cloud'))
		} else {
			const payload = generatePayload(data, cred)
			console.log(payload)
		}
	})()
} else {
	console.log(jsonwebtoken.sign(data, cred.secret))
}
