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
- getpcd: custom colors
- unknown request
- gene expression requests are no longer supported
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
		[{ getpcd: null }, 'getpcd'],
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

tape('getpcd: custom colors', async test => {
	const getpcd = color => ({
		coord: [0, 1, 2],
		category_index: 3,
		category_customcolor: true,
		cat_values: [{ value: 'A', color }]
	})
	const result = await send(getpcdQuery({ getpcd: getpcd('red') }))
	test.notOk(result.error, 'should accept a named color')
	test.equal(result.category2color.A, '#ff0000', 'should return a custom color as hex')
	const line = result.pcddata.split('\n').find(l => l.startsWith('1 '))
	test.equal(line.split(' ')[3], String(0xff0000), 'should use the custom color for the cell')

	for (const color of [5, 'notacolor', {}]) {
		const r = await send(getpcdQuery({ getpcd: getpcd(color) }))
		test.equal(r?.error, 'invalid getpcd.cat_values color', `should return an error for color=${JSON.stringify(color)}`)
	}
	const r = await send(getpcdQuery({ getpcd: { ...getpcd('red'), cat_values: [null] } }))
	test.equal(
		r?.error,
		'getpcd.cat_values must be an array of objects',
		'should return an error for a null cat_values entry'
	)
	test.end()
})

tape('unknown request', async test => {
	const result = await send({ genome: 'hg38', getpcd: undefined })
	test.equal(result?.error, 'unknown request', 'should return an error when no request type is given')
	test.end()
})

tape('gene expression requests are no longer supported', async test => {
	const box = await send({ genome: 'hg38', getgeneboxplot: {} })
	test.equal(box?.error, 'unknown request', 'should reject getgeneboxplot')
	const heat = await send({ genome: 'hg38', getheatmap: {} })
	test.equal(heat?.error, 'unknown request', 'should reject getheatmap')
	test.end()
})

tape('cleanup', test => {
	fs.rmSync(absdir, { recursive: true, force: true })
	test.end()
})
