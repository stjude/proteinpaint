#!/usr/bin/env node

const augent = require('./augents.js')
const fs = require('fs')
const path = require('path')

const cmd = process.argv[2]
if (!['typeCheckers', 'apiJson'].includes(cmd)) throw `cmd='${cmd}' not supported`

const dir = process.argv[3]
if (!dir) throw `missing dir argument`
if (!fs.existsSync(dir)) throw `Not found: dir='${dir}'`

const fromPath = process.argv[4]

const files = fs.readdirSync(dir)
;(async () => {
	const fileRoutes = files.map(file => ({ file, route: require(`${dir}/${file}`) }))
	if (cmd == 'typeCheckers') {
		if (!fromPath) throw `missing fromPath`
		const content = augent[cmd](fileRoutes, fromPath)
		console.log(content)
	}
	if (cmd == 'apiJson') {
		const content = augent[cmd](fileRoutes)
		console.log(content)
	}
})()
