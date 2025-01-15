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
	email: 'username@test.tld',
	ip: '127.0.0.1', //client ip address
	//parameters added by us, not standard jwt
	datasets: ['TermdbTest', 'SJLife', 'PNET', 'sjlife', 'ccss', 'ABC', 'XYZ', 'abc', 'xyz', 'profile'],
	clientAuthResult: { full: { role: 'admin', site: 'A' }, abbrev: { role: 'user', site: 'B' } }
}

const route = !process.argv[4] ? '' : process.argv[4][0] != '/' ? process.argv[4] : process.argv[4].slice(1)

// for testing only
if (cred?.processor) {
	;(async () => {
		const _ = await import(cred.processor)
		const { generatePayload, test } = _.default
		const url = process.argv[4] ? `${serverconfig.URL}/${route}` : ''
		if (url) {
			console.log(await test(cred, url, 'localhost'))
		} else {
			const payload = generatePayload(data, cred)
			console.log(payload)
		}
	})()
} else {
	console.log(jsonwebtoken.sign(data, cred.secret))
}
