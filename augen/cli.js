#!/usr/bin/env node
import * as augen from './src/augen.js'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const existsProm = promisify(fs.exists)
const execProm = promisify(exec)

const cmd = process.argv[2]
if (!['typeCheckers', 'apiJson', 'build'].includes(cmd)) throw `cmd='${cmd}' not supported`
const dir = process.argv[3] || process.cwd()
if (!fs.existsSync(dir)) throw `Not found: dir='${dir}'`
;(async () => {
	if (cmd == 'build') {
		try {
			const configFile = `${dir}/augen.config.json` //; console.log(19, dir, process.cwd(), configFile)
			const configExists = await existsProm(configFile)
			if (!configExists) throw `missing augen.config.json in dir='${dir}'`
			const config = await import(configFile, { assert: { type: 'json' } })
			const { routesDir, typesDir, checkersDir, docsDir } = config.default
			const cwd = process.cwd()
			// console.log(`${path.join(__dirname, 'build.sh')} ${routesDir} ${typesDir} ${checkersDir} ${docsDir}`)
			const out = await execProm(
				`${path.join(__dirname, 'build.sh')} ${routesDir} ${typesDir} ${checkersDir} ${docsDir}`,
				{
					encoding: 'utf-8',
					stdio: 'inherit'
				}
			)
			// if (out) {
			// 	if (out.stderr) throw out.stderr
			// 	if (out.error) throw out.error
			// 	console.log(out)
			// }
		} catch (e) {
			throw e
		}
	} else {
		const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.js')) //; console.log(36, dir, files)
		const fileRoutes = await Promise.all(
			files.map(async file => {
				const route = await import(path.join(`${dir}/${file}`))
				return { file, route }
			})
		)
		if (cmd == 'typeCheckers') {
			const fromPath = process.argv[4]
			if (!fromPath) throw `missing fromPath`
			const content = augen[cmd](fileRoutes, fromPath)
			console.log(content)
		}
		if (cmd == 'apiJson') {
			const content = augen[cmd](fileRoutes)
			console.log(content)
		}
	}
})()
