import tape from 'tape'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import serverconfig from '../serverconfig.js'
import { handle_singlecell_closure } from '../singlecell.js'

/*
Tests for /singlecell parameter checks and file reading.

test sections:
- getpcd: valid request
- getpcd: invalid parameters
- getpcd: textfile is a directory
- getpcd: custom color that is not a string
- getgeneboxplot: cellfile is a directory
*/

// test files are written to a temporary dir under tpmasterdir, since file paths are relative to it
const reldir = 'tmp-singlecell-' + crypto.randomUUID()
const absdir = path.join(serverconfig.tpmasterdir, reldir)
fs.mkdirSync(absdir)
const textfile = path.join(reldir, 'cells.txt')
fs.writeFileSync(path.join(serverconfig.tpmasterdir, textfile), 'x\ty\tz\ttype\n1\t2\t3\tA\n-4\t5\t6\tB\n')

const genome = {
	name: 'hg38',
	chrlookup: { CHR1: { name: 'chr1', len: 248956422 } },
	datasets: {}
}
const handler = handle_singlecell_closure({ hg38: genome })

async function send(query) {
	const sent = []
	const req = { query, get: () => undefined }
	const res = { send: x => sent.push(x), status: () => res, header: () => {}, set: () => {} }
	await handler(req, res)
	return sent[0]
}

function getpcdQuery(overrides = {}) {
	return {
		genome: 'hg38',
		textfile,
		delimiter: '\t',
		getpcd: { coord: [0, 1, 2], category_index: 3, category_autocolor: true },
		...overrides
	}
}

tape('\n', test => {
	test.comment('-***- server/singlecell -***-')
	test.end()
})

tape('getpcd: valid request', async test => {
	const result = await send(getpcdQuery({ hidden_types: ['B'], background_color: 'black' }))
	test.notOk(result.error, 'should not return an error')
	const lines = result.pcddata.split('\n').filter(l => /^-?\d/.test(l))
	test.deepEqual(
		lines.map(l => l.split(' ').slice(0, 3)),
		[
			['1', '2', '3'],
			['-4', '5', '6']
		],
		'should return the coordinates of each cell'
	)
	test.equal(lines[1].split(' ')[3], '0', 'should use background_color for a hidden type')
	test.deepEqual(Object.keys(result.category2color), ['A', 'B'], 'should return the category colors')
	test.equal(result.data_sphere_r, 6, 'should return the radius of the point cloud')
	test.end()
})

tape('getpcd: invalid parameters', async test => {
	const cases = [
		[{ getpcd: { coord: 5, category_index: 3, category_autocolor: true } }, 'getpcd.coord'],
		[{ getpcd: { coord: [0], category_index: 3, category_autocolor: true } }, 'getpcd.coord'],
		[{ getpcd: { coord: [0, '__proto__'], category_index: 3, category_autocolor: true } }, 'getpcd.coord'],
		[{ getpcd: { coord: [0, 1, 2], category_index: '3', category_autocolor: true } }, 'getpcd.category_index'],
		[{ getpcd: { coord: [0, 1, 2], category_index: 3, category_customcolor: true, cat_values: {} } }, 'cat_values'],
		[{ getpcd: 'x' }, 'getpcd'],
		[{ delimiter: undefined }, 'delimiter'],
		[{ delimiter: ['\t'] }, 'delimiter'],
		[{ background_color: 'notacolor' }, 'background_color'],
		[{ background_color: {} }, 'background_color']
	]
	for (const [overrides, key] of cases) {
		const result = await send(getpcdQuery(overrides))
		test.ok(
			typeof result?.error == 'string' && result.error.includes(key),
			`should return an error about ${key} for ${JSON.stringify(overrides)}`
		)
	}
	test.end()
})

tape('getpcd: textfile is a directory', async test => {
	const result = await send(getpcdQuery({ textfile: reldir }))
	test.equal(result?.error, 'not a file: ' + reldir, 'should return an error for a directory')
	test.end()
})

tape('getpcd: custom color that is not a string', async test => {
	// a custom color that is not a string
	const getpcd = {
		coord: [0, 1, 2],
		category_index: 3,
		category_customcolor: true,
		cat_values: [{ value: 'A', color: 5 }]
	}
	const result = await send(getpcdQuery({ getpcd }))
	test.ok(result?.error, 'should return an error')
	test.end()
})

tape('getgeneboxplot: cellfile is a directory', async test => {
	const result = await send({
		genome: 'hg38',
		getgeneboxplot: {
			expfile: 'files/hg38/TermdbTest/TermdbTest_ITD.gz',
			chr: 'chr1',
			start: 1,
			stop: 2,
			genename: 'TP53',
			cellfile: reldir,
			delimiter: '\t',
			barcodecolumnidx: 0,
			categorycolumnidx: 1
		}
	})
	test.ok(result?.error, 'should return an error')
	test.end()
})

tape('cleanup', test => {
	fs.rmSync(absdir, { recursive: true, force: true })
	test.end()
})
