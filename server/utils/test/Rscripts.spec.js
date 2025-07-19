/********************************************
The R script must be run from sjpp directory:

Run test script as follows (from 'server/'):

	cd ~/sjpp && npx tsx proteinpaint/server/utils/test/Rscripts.spec.js

*********************************************/

import tape from 'tape'
import serverconfig from '../../src/serverconfig.js'
import path from 'path'
import { run_R } from '@sjcrh/proteinpaint-r'
import fs from 'fs'
import { roundValueAuto } from '#shared/roundValue.js'

const p_value_cutoff = 0.0001 // If the difference between the actual and expected p-value is greater than this, the test will fail (used for testing edge.R)
const fold_change_cutoff = 0.001 // If the difference between the actual and expected p-value is greater than this, the test will fail (used for testing edge.R)

// Helpers
// Simple function to round numbers in our objects
/*function roundNumbers(obj, decimals = 10) {
	// Handle arrays
	if (Array.isArray(obj)) {
		return obj.map(item => roundNumbers(item, decimals))
	}

	// Handle objects
	if (obj && typeof obj === 'object') {
		const result = {}
		for (const key in obj) {
			result[key] = roundNumbers(obj[key], decimals)
		}
		return result
	}

	// Round numbers (both actual numbers and number strings)
	if (typeof obj === 'number') {
		return Number(obj.toFixed(decimals))
	}

	// Handle numeric strings but preserve 'NA' strings
	if (typeof obj === 'string' && obj !== 'NA' && !isNaN(parseFloat(obj))) {
		return String(Number(parseFloat(obj).toFixed(decimals)))
	}

	// Return everything else unchanged
	return obj
}*/

/** 
// fisher.2x3.R tests
tape('fisher.2x3.R', async function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	const invalidInput =
		'0\t506\t1451\t68\t206\t3\t11,1\t246\t1711\t24\t250\t1\t13,2\t102\t1855\t16\t258\t0\t14,3\t167\t1790\t22\t252\t2\t12,4\t174\t1783\t30\t244\t4\t10'
	try {
		const output = await run_R(path.join(__dirname, '../fisher.2x3.R'), invalidInput)
		test.fail('should emit an error on invalid input')
	} catch (error) {
		test.deepEqual(error, TypeError('lines.join is not a function'), 'should emit an error on invalid input')
	}
	const validInput = [
		'0\t506\t1451\t68\t206\t3\t11',
		'1\t246\t1711\t24\t250\t1\t13',
		'2\t102\t1855\t16\t258\t0\t14',
		'3\t167\t1790\t22\t252\t2\t12',
		'4\t174\t1783\t30\t244\t4\t10'
	]
	const output = await run_R(path.join(__dirname, '../fisher.2x3.R'), validInput)
	test.deepEqual(
		output,
		[
			'0\t506\t1451\t68\t206\t3\t11\t0.918925559316051',
			'1\t246\t1711\t24\t250\t1\t13\t0.181035956038115',
			'2\t102\t1855\t16\t258\t0\t14\t0.843096446394939',
			'3\t167\t1790\t22\t252\t2\t12\t0.568558123095687',
			'4\t174\t1783\t30\t244\t4\t10\t0.0301248106031606'
		],
		'should match expected output'
	)
	test.end()
})

// km.R tests
tape('km.R', async function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	const invalidInput = 'futime\tfustat\trx,410\t1\t0,443\t0\t0,2819\t0\t0,496\t1\t0,2803\t0\t0,2983\t0\t0'
	try {
		const output = await run_R(path.join(__dirname, '../km.R'), invalidInput)
		test.fail('should emit an error on invalid input')
	} catch (error) {
		test.deepEqual(error, TypeError('lines.join is not a function'), 'should emit an error on invalid input')
	}
	const validInput = [
		'futime\tfustat\trx',
		'410\t1\t0',
		'443\t0\t0',
		'2819\t0\t0',
		'496\t1\t0',
		'2803\t0\t0',
		'2983\t0\t0',
		'289\t1\t0',
		'293\t1\t0',
		'230\t1\t0',
		'194\t1\t0',
		'2605\t0\t0',
		'2133\t0\t0',
		'2824\t0\t0',
		'2738\t0\t0',
		'203\t1\t0',
		'342\t1\t0',
		'2946\t0\t0',
		'1985\t0\t0',
		'134\t1\t0',
		'1868\t1\t0',
		'3116\t0\t0',
		'3144\t0\t0',
		'1199\t0\t0',
		'541\t1\t0',
		'2829\t0\t0',
		'294\t1\t0',
		'715\t0\t0',
		'199\t1\t0',
		'1798\t0\t0',
		'422\t1\t0',
		'300\t1\t0',
		'517\t1\t0',
		'985\t1\t0',
		'488\t1\t0',
		'2687\t0\t0',
		'296\t1\t0',
		'95\t1\t0',
		'763\t1\t0',
		'102\t1\t0',
		'435\t1\t0',
		'364\t1\t1',
		'357\t1\t1',
		'127\t1\t1',
		'391\t1\t1',
		'425\t1\t1',
		'1728\t0\t1',
		'239\t1\t1',
		'2767\t0\t1',
		'395\t1\t1',
		'714\t1\t1',
		'286\t1\t1',
		'809\t1\t1',
		'314\t1\t1',
		'914\t0\t1',
		'348\t1\t1',
		'462\t1\t1',
		'366\t1\t1',
		'2457\t0\t1',
		'376\t1\t1',
		'728\t1\t1',
		'297\t1\t1',
		'3630\t0\t1',
		'221\t1\t1',
		'325\t1\t1',
		'383\t1\t1',
		'109\t1\t1',
		'409\t1\t1',
		'725\t1\t1',
		'252\t1\t1',
		'77\t1\t1',
		'287\t1\t1',
		'269\t1\t1',
		'257\t1\t1',
		'86\t1\t1',
		'237\t1\t1',
		'2760\t0\t1',
		'216\t1\t1',
		'690\t1\t1',
		'259\t1\t1',
		'633\t1\t1'
	]
	const output = await run_R(path.join(__dirname, '../km.R'), validInput)
	test.deepEqual(output.map(Number), [0.007], 'should match expected output')
	test.end()
})

*/

/**
 * Test for survival.R
 * This test runs the survival analysis R script and verifies its output
 * matches the expected results while handling floating-point precision differences.
 *
 * The test:
 * 1. Reads the input JSON containing survival data
 * 2. Runs the R script with this input data
 * 3. Compares the output with the expected results after normalizing precision
 */
tape('survival.R', async function (test) {
	test.timeoutAfter(5000)
	test.plan(1)

	// Read input JSON file
	const inJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/survival_input.json'), {
		encoding: 'utf8'
	})

	// Run the R script
	const Rout = await run_R('survival.R', inJson, [])

	// Get expected output
	const expJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/survival_output.json'), {
		encoding: 'utf8'
	})

	// Parse both outputs
	let out = JSON.parse(Rout)
	let exp = JSON.parse(expJson)

	// Round values to avoid precision issues
	out = roundEstimates(out)
	exp = roundEstimates(exp)

	// Test if they match
	test.deepEqual(out, exp, 'survival analysis results should match expected output')
	test.end()

	// Function to round estimate values to fixed number of digits
	function roundEstimates(data, digits = 10) {
		if (!data.estimates) throw 'estimates missing'
		const estimates = data.estimates.map(x => {
			x.surv = Number.isFinite(x.surv) ? Number(x.surv.toFixed(digits)) : x.surv
			x.upper = Number.isFinite(x.upper) ? Number(x.upper.toFixed(digits)) : x.upper
			x.lower = Number.isFinite(x.lower) ? Number(x.lower.toFixed(digits)) : x.lower
			return x
		})
		data.estimates = estimates
		return data
	}
})
/**
// cuminc.R tests
tape('cuminc.R', async function (test) {
	test.timeoutAfter(5000)
	test.plan(1)
	const infile = path.join(serverconfig.binpath, 'test/testdata/R/cuminc_input.json')
	const expfile = path.join(serverconfig.binpath, 'test/testdata/R/cuminc_output.json')
	const Rout = await run_R(path.join(__dirname, '../cuminc.R'), [], [infile])
	const out = JSON.parse(Rout[0])
	const exp = JSON.parse(await utils.read_file(expfile))
	test.deepEqual(out, exp, 'cuminc should match expected output')
	test.end()
})

// regression.R tests
tape('regression.R', async function (test) {
	test.timeoutAfter(10000)
	test.plan(1)
	// for (const type of ['linear', 'logistic', 'cox']) {
	   for (const type of ['linear']) {
		// const infile = path.join(serverconfig.binpath, 'test/testdata/R', `${type}_regression_input.json`)
		const injson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R', `${type}_regression_input.json`), { encoding: 'utf8' })
		const expjson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R', `${type}_regression_output.json`), { encoding: 'utf8' })
		// const expfile = path.join(serverconfig.binpath, 'test/testdata/R', `${type}_regression_output.json`)
		const Rout = await run_R(path.join(__dirname, '../regression.R'), injson)
		const out = JSON.parse(Rout)
		delete out.benchmark
		test.deepEqual(out, expjson, `${type} regression should match expected output`)
	}
	test.end()
})

// wilcoxon.R tests
tape('wilcoxon.R', async function (test) {
	test.timeoutAfter(5000)
	test.plan(1)
	// const infile = path.join(serverconfig.binpath, 'test/testdata/R/wilcoxon_input.json')
	const injson = fs.readFileSync(path.join(serverconfig.binpath,'test/testdata/R/wilcoxon_input.json'), { encoding: 'utf8' })
	const expjson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/wilcoxon_output.json'), { encoding: 'utf8' })
	// const expfile = path.join(serverconfig.binpath, 'test/testdata/R/wilcoxon_output.json')
	const Rout = await run_R(path.join(__dirname, '../wilcoxon.R'), [injson])
	const out = JSON.parse(Rout[0])
	const exp = JSON.parse(await utils.read_file(expjson))
	test.deepEqual(out, exp, 'wilcoxon should match expected output')
	test.end()
})
*/

tape('\n', function (test) {
	test.comment('-***- R correlation specs -***-')
	test.end()
})

// Function to round estimate values to fixed number of digits
function roundCorrEstimates(data, digits = 10) {
	if (!data) throw 'estimates missing'
	const estimates = data.map(x => {
		x.correlation = Number.isFinite(x.correlation) ? roundValueAuto(x.correlation) : x.correlation
		x.original_p_value = Number.isFinite(x.original_p_value) ? roundValueAuto(x.original_p_value) : x.original_p_value
		x.adjusted_p_value = Number.isFinite(x.adjusted_p_value) ? roundValueAuto(x.adjusted_p_value) : x.adjusted_p_value
		return x
	})
	data = estimates
	return data
}

tape('corr.R pearson', async function (test) {
	test.timeoutAfter(10000)
	const inJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/pearson-input.json'), {
		encoding: 'utf8'
	})
	const expJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/pearson-output.json'), {
		encoding: 'utf8'
	})
	const Rout = await run_R('corr.R', inJson)
	let out = JSON.parse(Rout)
	let exp = JSON.parse(expJson)
	// Round values to avoid precision issues
	out = roundCorrEstimates(out)
	exp = roundCorrEstimates(exp)
	test.deepEqual(out, exp, 'Test corr.R pearson should match expected output')
	test.end()
})

tape('corr.R spearman', async function (test) {
	test.timeoutAfter(10000)
	const inJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/spearman-input.json'), {
		encoding: 'utf8'
	})
	const expJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/spearman-output.json'), {
		encoding: 'utf8'
	})
	const Rout = await run_R('corr.R', inJson)
	let out = JSON.parse(Rout)
	let exp = JSON.parse(expJson)
	// Round values to avoid precision issues
	out = roundCorrEstimates(out)
	exp = roundCorrEstimates(exp)
	test.deepEqual(out, exp, 'Test corr.R spearman should match expected output')
	test.end()
})

tape('corr.R kendall', async function (test) {
	test.timeoutAfter(10000)
	const inJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/kendall-input.json'), {
		encoding: 'utf8'
	})
	const expJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/kendall-output.json'), {
		encoding: 'utf8'
	})
	const Rout = await run_R('corr.R', inJson)
	let out = JSON.parse(Rout)
	let exp = JSON.parse(expJson)
	// Round values to avoid precision issues
	out = roundCorrEstimates(out)
	exp = roundCorrEstimates(exp)
	test.deepEqual(out, exp, 'Test corr.R kendall should match expected output')
	test.end()
})

// For edgeR and limma we cannot compare objects because in the future parallel processing of genes may occur which may cause the order of genes to be random and non-deterministic. Therefore its just better to test some random individual genes than the entire set of genes.
tape('edge.R limma', async function (test) {
	test.timeoutAfter(10000)
	const inJson = {
		case: '2702,2800,2828,2982,3052,3234,3290,3346,3360,3388,3402,3444,3472',
		control:
			'2646,2674,2688,2744,2758,2786,2814,2842,2856,2884,2912,2926,2954,2968,2996,3010,3038,3080,3094,3122,3164,3220,3248,3416,3430,3458',
		data_type: 'do_DE',
		input_file: serverconfig.binpath + '/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.geneCounts.h5',
		cachedir: serverconfig.cachedir,
		min_count: 10,
		min_total_count: 15,
		storage_type: 'HDF5',
		DE_method: 'limma',
		mds_cutoff: 10000
	}
	const expJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/limma-output.json'), {
		encoding: 'utf8'
	})
	const Rout = await run_R('edge.R', JSON.stringify(inJson))
	const out = JSON.parse(Rout)

	// Gene1
	const gene1_id = 'ENSG00000169962'
	const gene1_out = out.gene_data.find(user => user.gene_id === gene1_id)
	const gene1_exp_out = JSON.parse(expJson).gene_data.find(user => user.gene_id === gene1_id)
	test.ok(
		gene1_out.original_p_value - gene1_exp_out.original_p_value < p_value_cutoff,
		`For ${gene1_id}, original pvalue=${gene1_out.original_p_value}, expected pvalue=${gene1_exp_out.original_p_value}`
	)
	test.ok(
		gene1_out.adjusted_p_value - gene1_exp_out.adjusted_p_value < p_value_cutoff,
		`For ${gene1_id}, original adj_pvalue=${gene1_out.adjusted_p_value}, expected adj_pvalue=${gene1_exp_out.adjusted_p_value}`
	)
	test.ok(
		gene1_out.fold_change - gene1_exp_out.fold_change < fold_change_cutoff,
		`For ${gene1_id}, original fold change=${gene1_out.fold_change}, expected fold change=${gene1_exp_out.fold_change}`
	)

	// Gene2
	const gene2_id = 'ENSG00000230368'
	const gene2_out = out.gene_data.find(user => user.gene_id === gene2_id)
	const gene2_exp_out = JSON.parse(expJson).gene_data.find(user => user.gene_id === gene2_id)
	test.ok(
		gene2_out.original_p_value - gene2_exp_out.original_p_value < p_value_cutoff,
		`For ${gene2_id}, original pvalue=${gene2_out.original_p_value}, expected pvalue=${gene2_exp_out.original_p_value}`
	)
	test.ok(
		gene2_out.adjusted_p_value - gene2_exp_out.adjusted_p_value < p_value_cutoff,
		`For ${gene2_id}, original adj_pvalue=${gene2_out.adjusted_p_value}, expected adj_pvalue=${gene2_exp_out.adjusted_p_value}`
	)
	test.ok(
		gene2_out.fold_change - gene2_exp_out.fold_change < fold_change_cutoff,
		`For ${gene2_id}, original fold change=${gene2_out.fold_change}, expected fold change=${gene2_exp_out.fold_change}`
	)

	// Gene3
	const gene3_id = 'ENSG00000067606'
	const gene3_out = out.gene_data.find(user => user.gene_id === gene3_id)
	const gene3_exp_out = JSON.parse(expJson).gene_data.find(user => user.gene_id === gene3_id)
	test.ok(
		gene3_out.original_p_value - gene3_exp_out.original_p_value < p_value_cutoff,
		`For ${gene3_id}, original pvalue=${gene3_out.original_p_value}, expected pvalue=${gene3_exp_out.original_p_value}`
	)
	test.ok(
		gene3_out.adjusted_p_value - gene3_exp_out.adjusted_p_value < p_value_cutoff,
		`For ${gene3_id}, original adj_pvalue=${gene3_out.adjusted_p_value}, expected adj_pvalue=${gene3_exp_out.adjusted_p_value}`
	)
	test.ok(
		gene3_out.fold_change - gene3_exp_out.fold_change < fold_change_cutoff,
		`For ${gene3_id}, original fold change=${gene3_out.fold_change}, expected fold change=${gene3_exp_out.fold_change}`
	)

	test.end()
})

tape('edge.R edgeR', async function (test) {
	test.timeoutAfter(10000)
	const inJson = {
		case: '2702,2800,2828,2982,3052,3234,3290,3346,3360,3388,3402,3444,3472',
		control:
			'2646,2674,2688,2744,2758,2786,2814,2842,2856,2884,2912,2926,2954,2968,2996,3010,3038,3080,3094,3122,3164,3220,3248,3416,3430,3458',
		data_type: 'do_DE',
		input_file: serverconfig.binpath + '/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.geneCounts.h5',
		cachedir: serverconfig.cachedir,
		min_count: 10,
		min_total_count: 15,
		storage_type: 'HDF5',
		DE_method: 'edgeR',
		mds_cutoff: 10000
	}
	const expJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/edgeR-output.json'), {
		encoding: 'utf8'
	})
	const Rout = await run_R('edge.R', JSON.stringify(inJson))
	const out = JSON.parse(Rout)

	// Gene1
	const gene1_id = 'ENSG00000169962'
	const gene1_out = out.gene_data.find(user => user.gene_id === gene1_id)
	const gene1_exp_out = JSON.parse(expJson).gene_data.find(user => user.gene_id === gene1_id)
	test.ok(
		gene1_out.original_p_value - gene1_exp_out.original_p_value < p_value_cutoff,
		`For ${gene1_id}, original pvalue=${gene1_out.original_p_value}, expected pvalue=${gene1_exp_out.original_p_value}`
	)
	test.ok(
		gene1_out.adjusted_p_value - gene1_exp_out.adjusted_p_value < p_value_cutoff,
		`For ${gene1_id}, original adj_pvalue=${gene1_out.adjusted_p_value}, expected adj_pvalue=${gene1_exp_out.adjusted_p_value}`
	)
	test.ok(
		gene1_out.fold_change - gene1_exp_out.fold_change < fold_change_cutoff,
		`For ${gene1_id}, original fold change=${gene1_out.fold_change}, expected fold change=${gene1_exp_out.fold_change}`
	)

	// Gene2
	const gene2_id = 'ENSG00000230368'
	const gene2_out = out.gene_data.find(user => user.gene_id === gene2_id)
	const gene2_exp_out = JSON.parse(expJson).gene_data.find(user => user.gene_id === gene2_id)
	test.ok(
		gene2_out.original_p_value - gene2_exp_out.original_p_value < p_value_cutoff,
		`For ${gene2_id}, original pvalue=${gene2_out.original_p_value}, expected pvalue=${gene2_exp_out.original_p_value}`
	)
	test.ok(
		gene2_out.adjusted_p_value - gene2_exp_out.adjusted_p_value < p_value_cutoff,
		`For ${gene2_id}, original adj_pvalue=${gene2_out.adjusted_p_value}, expected adj_pvalue=${gene2_exp_out.adjusted_p_value}`
	)
	test.ok(
		gene2_out.fold_change - gene2_exp_out.fold_change < fold_change_cutoff,
		`For ${gene2_id}, original fold change=${gene2_out.fold_change}, expected fold change=${gene2_exp_out.fold_change}`
	)

	// Gene3
	const gene3_id = 'ENSG00000067606'
	const gene3_out = out.gene_data.find(user => user.gene_id === gene3_id)
	const gene3_exp_out = JSON.parse(expJson).gene_data.find(user => user.gene_id === gene3_id)
	test.ok(
		gene3_out.original_p_value - gene3_exp_out.original_p_value < p_value_cutoff,
		`For ${gene3_id}, original pvalue=${gene3_out.original_p_value}, expected pvalue=${gene3_exp_out.original_p_value}`
	)
	test.ok(
		gene3_out.adjusted_p_value - gene3_exp_out.adjusted_p_value < p_value_cutoff,
		`For ${gene3_id}, original adj_pvalue=${gene3_out.adjusted_p_value}, expected adj_pvalue=${gene3_exp_out.adjusted_p_value}`
	)
	test.ok(
		gene3_out.fold_change - gene3_exp_out.fold_change < fold_change_cutoff,
		`For ${gene3_id}, original fold change=${gene3_out.fold_change}, expected fold change=${gene3_exp_out.fold_change}`
	)
	test.end()
})

tape('hclust.R Clustering:Average-Distance:Euclidean', async function (test) {
	test.timeoutAfter(10000)
	const inJson = fs.readFileSync(
		path.join(serverconfig.binpath, 'test/testdata/R/cluster_test_average_euclidean_data.json'),
		{
			encoding: 'utf8'
		}
	)
	const expJson = fs.readFileSync(
		path.join(serverconfig.binpath, 'test/testdata/R/hclust_average_euclidean_output.json'),
		{
			encoding: 'utf8'
		}
	)
	const Rout = await run_R('hclust.R', inJson)
	const out = JSON.parse(Rout)
	test.deepEqual(out, JSON.parse(expJson), 'Test Clustering:Average-Distance:Euclidean should match expected output')
	test.end()
})

tape('hclust.R Clustering:Complete-Distance:Maximum', async function (test) {
	test.timeoutAfter(10000)
	const inJson = fs.readFileSync(
		path.join(serverconfig.binpath, 'test/testdata/R/cluster_test_complete_maximum_data.json'),
		{
			encoding: 'utf8'
		}
	)
	const expJson = fs.readFileSync(
		path.join(serverconfig.binpath, 'test/testdata/R/hclust_complete_maximum_output.json'),
		{
			encoding: 'utf8'
		}
	)
	const Rout = await run_R('hclust.R', inJson)
	const out = JSON.parse(Rout)
	test.deepEqual(out, JSON.parse(expJson), 'Test Clustering:Complete-Distance:Maximum should match expected output')
	test.end()
})
