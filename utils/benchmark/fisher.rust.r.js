/*
compare fisher test using rust and r
*/

const lines2R = require('../../server/src/lines2R')
const path = require('path')
const Readable = require('stream').Readable
const spawn = require('child_process').spawn
const fs = require('fs')
const fisher_limit = 300 // Cutoff for sum of four numbers. If higher, chisq test is used. Otherwise fishers exact test is used.
const individual_fisher_limit = 150 // In addition to the fisher_limit cutoff, each of the four numbers given must be higher than this cutoff to invoke chisq test

main()

async function main() {
	/*
	make random data of 1000 rows, run with both R and rust. 
	repeat the tests 10 times, output amount of time in each run

	observation on xin's desktop on 2022/5/8
	R/rust milliseconds: 1375 108
	R/rust milliseconds: 1375 65
	R/rust milliseconds: 1370 74
	R/rust milliseconds: 1370 55
	R/rust milliseconds: 1378 56
	R/rust milliseconds: 1385 56
	R/rust milliseconds: 1386 57
	R/rust milliseconds: 1333 56
	R/rust milliseconds: 1384 55
	R/rust milliseconds: 1364 55
	*/
	for (let i = 0; i < 10; i++) {
		const data = makeData()
		const t2 = await testRust(data)
		const t1 = await testR(data)
		console.log('R/rust milliseconds:', t1, t2)
	}

	/*
	collect pvalues from r and rust on the same set of data
	write to temp file "x"
	for making scatterplot
	*/
	await comparePvalues()
}

async function comparePvalues() {
	const data = makeData()
	// collect pvalues from r and rust, over the same set of input data
	const r_pv = [],
		rust_pv = []
	for (const line of await lines2R('../../server/utils/fisher.R', data)) {
		r_pv.push(-Math.log10(Number(line.split('\t')[5])))
	}

	for (const line of (await run_rust(
		'stats',
		'fisher_limits\t' + fisher_limit + '\t' + individual_fisher_limit + '-' + data.join('-')
	)).split('\n')) {
		rust_pv.push(-Math.log10(Number(line.split('\t')[5])))
	}

	const lst = []
	for (let i = 0; i < r_pv.length; i++) {
		const r = r_pv[i],
			u = rust_pv[i]
		if (r == Infinity || u == Infinity) continue
		lst.push(r_pv[i] + '\t' + rust_pv[i])
	}
	fs.writeFileSync('x', lst.join('\n') + '\n')
}

async function testR(data) {
	const t = new Date()
	await lines2R('../../server/utils/fisher.R', data)
	return new Date() - t
}

async function testRust(data) {
	const t = new Date()
	await run_rust('stats', 'fisher_limits\t' + fisher_limit + '\t' + individual_fisher_limit + '-' + data.join('-'))
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

// waiting for node to be upgraded from 12 to 14 or later
// so ESM import '../../server/src/utils.js' can work
// and can delete the run_rust() copy
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
			reject(err)
		})
		ps.on('close', code => {
			if (code !== 0) reject(`spawned '${binfile}' exited with a non-zero status and this stderr:\n${stderr.join('')}`)
			//console.log("stdout:",stdout)
			resolve(stdout.join('').toString())
		})
	})
}
