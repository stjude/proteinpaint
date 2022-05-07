/*
compare fisher test using rust and r
won't check validity, simply compare speed
*/

const lines2R = require('../../server/src/lines2R')
const path = require('path')
const Readable = require('stream').Readable
const spawn = require('child_process').spawn

main()

async function main() {
	for (let i = 0; i < 10; i++) {
		const t2 = await testRust()
		const t1 = await testR()
		console.log('R/rust milliseconds:', t1, t2)
	}
}

async function testR() {
	const t = new Date()
	await lines2R('../../server/utils/fisher.R', makeData())
	return new Date() - t
}

async function testRust() {
	const t = new Date()
	await run_rust('stats', makeData())
	return new Date() - t
}

function makeData() {
	const data = []
	for (let i = 0; i < 1000; i++) {
		data.push(`${i}\t${int()}\t${int()}\t${int()}\t${int()}`)
	}
	return data
}

function int() {
	return Math.max(1, Math.ceil(Math.random() * 1000))
}

// importing ../../server/src/utils.js has following err
// /Users/xzhou1/proteinpaint/server/shared/common.js:12
// export const defaultcolor = '#8AB1D4'
// ^^^^^^
function run_rust(binfile, input_data) {
	return new Promise((resolve, reject) => {
		const binpath = path.join('../../server/utils/rust/target/release/', binfile)
		const ps = spawn(binpath)
		const stdout = []
		const stderr = []
		Readable.from(input_data).pipe(ps.stdin)
		ps.stdout.on('data', data => stdout.push(data))
		ps.stderr.on('data', data => stderr.push(data))
		ps.on('error', err => {
			console.log('stderr:', stderr)
			reject(err)
		})
		ps.on('close', code => {
			if (code !== 0) reject(`spawned '${binfile}' exited with a non-zero status and this stderr:\n${stderr.join('')}`)
			//console.log("stdout:",stdout)
			resolve(stdout.join('').toString())
		})
	})
}
