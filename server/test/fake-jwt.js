#!/usr/bin/env node

const serverconfig = require('../src/serverconfig')
const jsonwebtoken = require('jsonwebtoken')

const time = Math.floor(Date.now() / 1000)
const dslabel = process.argv[2] || 'TermdbTest'
const secret = serverconfig.dsCredentials[dslabel].termdb.localhost.secret
//for testing only
console.log(
	//secret,
	jsonwebtoken.sign(
		{
			iat: time,
			exp: time + 3600,
			datasets: ['TermdbTest', 'SJLife', 'PNET', 'sjlife', 'ccss'],
			email: 'username@test.tld',
			ip: '127.0.0.1'
		},
		secret
	)
)
