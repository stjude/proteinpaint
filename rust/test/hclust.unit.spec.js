/********************************************
Test script for 'rust/src/hclust.rs'

Run test script as follows (from 'proteinpaint/'):

    npx tape rust/test/hclust.unit.spec.js

The expected values are from dist() and hclust() of R. hclust_*_output.json are the output of the former
R/src/hclust.R for hclust_*_input.json.
*********************************************/

import tape from 'tape'
import fs from 'fs'
import path from 'path'
import { run_rust } from '@sjcrh/proteinpaint-rust'

const __dirname = import.meta.dirname

// R gives 15 significant digits
const round = v => Number(v.toPrecision(12))

async function cluster(matrix, cluster_method, distance_method) {
	const input = {
		matrix,
		row_names: matrix.map((_, i) => 'r' + (i + 1)),
		col_names: matrix[0].map((_, i) => 'c' + (i + 1)),
		cluster_method,
		distance_method
	}
	return JSON.parse(await run_rust('hclust', JSON.stringify(input)))
}

// a dendrogram in the shape of the hclust() result: merge pairs, heights, and the 1-based input index of each leaf
function simplify(d) {
	return {
		merge: d.merge.map(m => [m.n1, m.n2]),
		height: d.height.map(h => round(h.height)),
		order: d.order.map(o => Number(o.name.slice(1)))
	}
}

for (const name of ['average_euclidean', 'complete_maximum']) {
	tape(`R/src/hclust.R output for ${name}`, async function (test) {
		const input = fs.readFileSync(path.join(__dirname, `hclust_${name}_input.json`), 'utf8')
		const expected = JSON.parse(fs.readFileSync(path.join(__dirname, `hclust_${name}_output.json`), 'utf8'))
		const output = JSON.parse(await run_rust('hclust', input))
		for (const [axis, R] of [
			['row', 'Row'],
			['col', 'Column']
		]) {
			test.deepEqual(output[axis].merge, expected[R + 'Merge'], `${axis} merge should match R`)
			test.deepEqual(
				output[axis].height.map(h => round(h.height)),
				expected[R + 'Height'].map(h => round(h.height)),
				`${axis} height should match R`
			)
		}
		test.deepEqual(output.row.order, expected.RowOrder, 'row order should match R')
		test.deepEqual(output.col.order, expected.ColOrder, 'col order should match R')
		test.end()
	})
}

tape('equal distances are merged in the order of R', async function (test) {
	const matrix = [
		[1, 0, 0, 1, 0],
		[0, 1, 0, 1, 0],
		[1, 1, 0, 0, 0],
		[0, 0, 1, 1, 1]
	]
	const complete = await cluster(matrix, 'complete', 'manhattan')
	test.deepEqual(
		simplify(complete.row),
		{
			merge: [
				[-1, -2],
				[-3, 1],
				[-4, 2]
			],
			height: [2, 2, 5],
			order: [4, 3, 1, 2]
		},
		'complete manhattan rows should match R'
	)
	test.deepEqual(
		simplify(complete.col),
		{
			merge: [
				[-3, -5],
				[-1, -2],
				[-4, 1],
				[2, 3]
			],
			height: [0, 2, 2, 3],
			order: [1, 2, 4, 3, 5]
		},
		'complete manhattan columns should match R'
	)
	const single = await cluster(matrix, 'single', 'maximum')
	test.deepEqual(
		simplify(single.col),
		{
			merge: [
				[-3, -5],
				[-1, -2],
				[1, 2],
				[-4, 3]
			],
			height: [0, 1, 1, 1],
			order: [4, 3, 5, 1, 2]
		},
		'single maximum columns should match R'
	)
	test.end()
})

tape('ward.D and ward.D2', async function (test) {
	const matrix = [
		[1.5, 2, 3.2],
		[2.1, 1.8, 4],
		[8, 9.5, 7],
		[7.7, 9, 6.1],
		[4, 5, 5]
	]
	const merge = [
		[-1, -2],
		[-3, -4],
		[-5, 1],
		[2, 3]
	]
	const order = [3, 4, 5, 1, 2]
	const wardD = await cluster(matrix, 'ward.D', 'euclidean')
	test.deepEqual(
		simplify(wardD.row),
		{ merge, height: [1.01980390271856, 1.07238052947636, 5.09577854816017, 17.64415014057347].map(round), order },
		'ward.D rows should match R'
	)
	const wardD2 = await cluster(matrix, 'ward.D2', 'euclidean')
	test.deepEqual(
		simplify(wardD2.row),
		{ merge, height: [1.01980390271856, 1.07238052947636, 4.6776062254106, 13.3567211545349].map(round), order },
		'ward.D2 rows should match R'
	)
	test.deepEqual(
		simplify(wardD2.col).height,
		[2.29782505861521, 4.42417600614322].map(round),
		'ward.D2 column heights should match R'
	)
	test.end()
})

tape('missing values', async function (test) {
	// a pair with a missing value is skipped, and the distance is scaled up by the number of skipped pairs
	const matrix = [
		[1, null, 3, 4],
		[2, 2, null, 5],
		[9, 8, 7, null],
		[1, 1, 2, 2]
	]
	const euclidean = await cluster(matrix, 'average', 'euclidean')
	test.deepEqual(
		simplify(euclidean.row),
		{
			merge: [
				[-1, -2],
				[-4, 1],
				[-3, 2]
			],
			height: [2, 3.20584866424848, 13.08405847244312].map(round),
			order: [3, 4, 1, 2]
		},
		'average euclidean rows should match R'
	)
	test.deepEqual(
		simplify(euclidean.col).height,
		[1.15470053837925, 1.4142135623731, 3.74236513174612].map(round),
		'average euclidean column heights should match R'
	)
	const canberra = await cluster(matrix, 'average', 'canberra')
	test.deepEqual(
		simplify(canberra.row),
		{
			merge: [
				[-1, -4],
				[-2, 1],
				[-3, 2]
			],
			height: [0.711111111111111, 1.174603174603174, 2.572390572390573].map(round),
			order: [3, 2, 1, 4]
		},
		'average canberra rows should match R'
	)
	test.deepEqual(
		simplify(canberra.col).height,
		[0.0784313725490196, 0.2857142857142857, 1.3543650793650792].map(round),
		'average canberra column heights should match R'
	)
	test.end()
})

tape('errors', async function (test) {
	const message = async (matrix, cluster_method = 'average', distance_method = 'euclidean') => {
		try {
			await cluster(matrix, cluster_method, distance_method)
			return 'no error'
		} catch (e) {
			return String(e)
		}
	}
	const matrix = [
		[1, 2],
		[3, 4]
	]
	test.match(await message([[1, 2]]), /rows: must have n >= 2 objects to cluster/, 'should reject one row')
	test.match(await message(matrix, 'centroid'), /invalid cluster_method: centroid/, 'should reject a cluster method')
	test.match(await message(matrix, 'average', 'binary'), /invalid distance_method: binary/, 'should reject a distance')
	test.match(
		await message([
			[1, null],
			[null, 2],
			[3, 3]
		]),
		/rows: a distance is not finite/,
		'should reject a pair of rows with no values to compare, as R does'
	)
	test.match(await message([[1, 2], [3]]), /a matrix row does not have 2 values/, 'should reject a short row')
	test.end()
})
