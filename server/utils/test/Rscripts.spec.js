/********************************************
Test script for R scripts in 'server/utils/'

Run test script as follows (from 'server/'):

	npx tape -r '@babel/register' utils/test/Rscripts.spec.js

*********************************************/

import tape from 'tape'
import serverconfig from '../../src/serverconfig.js'
import path from 'path'
// import * as utils from '../../src/utils.js'
import run_R from '../../src/run_R.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import fs from 'fs'

// Creating __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initial message to test tape and let use know we are starting the R scripts tests
tape('\n', function (test) {
	test.pass('-***- R specs -***-')
	test.end()
})

/**
 * Tests for the Hardy-Weinberg Equilibrium (HWE) R script
 * This test suite validates the behavior of hwe.R, which calculates
 * Hardy-Weinberg equilibrium p-values for genetic data.
 *
 * The script processes tab-separated genotype counts (AA, AB, BB format)
 * and returns p-values indicating whether the population is in
 * Hardy-Weinberg equilibrium.
 */

// hwe.R tests
tape('hwe.R', async function (test) {
	test.timeoutAfter(5000)
	// Plan for two distinct tests: invalid input handling and valid data processing
	test.plan(2)

	/**
	 * Test 1: Invalid Input Handling
	 *
	 * Tests how the R script handles malformed input data.
	 * We try some toy data which should trigger an error.
	 */
	const invalidInput = '68\t28\t4,5\t40\t3,56\t4\t43,83\t45\t13'
	try {
		await run_R(path.join(__dirname, '../hwe.R'), invalidInput)
		test.fail('should emit an error on invalid input')
	} catch (error) {
		test.ok(
			// We check for either 'non-numeric argument' (R error) or 'Error'
			error.includes('non-numeric argument') || error.includes('Error'),
			'should emit an error on invalid input'
		)
	}

	/**
	 * Test 2: Valid Input Processing
	 *
	 * Tests the R script with properly formatted genetic data.
	 * Each row contains three tab-separated numbers representing
	 * genotype counts in a population (AA, AB, BB format).
	 *
	 * The expected p-values indicate:
	 * - 0.515367: No significant deviation from HWE
	 * - 0.000006269428: Strong evidence against HWE
	 * - 1.385241e-24: Extreme deviation from HWE
	 * - 0.07429809: Weak evidence against HWE
	 */
	const validInput = ['68\t28\t4', '5\t40\t3', '56\t4\t43', '83\t45\t13']
	const inputString = validInput.join('\n')
	const output = await run_R(path.join(__dirname, '../hwe.R'), inputString)

	// Split the output string into an array of strings, then convert to numbers
	const outputArray = output.split('\n').map(Number)

	// Compare calculated p-values with expected results
	test.deepEqual(outputArray, [0.515367, 0.000006269428, 1.385241e-24, 0.07429809], 'should match expected output')
	test.end()
})

/** 
// fisher.R tests
tape('fisher.R', async function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	const invalidInput = 'gene1\t2\t10\t15\t3,gene2\t4\t74\t67\t9,gene3\t12\t17\t1000\t1012,gene4\t13\t25\t37\t19'
	try {
		const output = await run_R(path.join(__dirname, '../fisher.R'), invalidInput)
		test.fail('should emit an error on invalid input')
	} catch (error) {
		test.deepEqual(error, TypeError('lines.join is not a function'), 'should emit an error on invalid input')
	}
	const validInput = [
		'chr17.7666870.T.C\t1678\t2828\t25242\t39296',
		'chr17.7667504.G.C\t179\t4327\t2884\t61648',
		'chr17.7667559.G.A\t3548\t958\t51468\t13062',
		'chr17.7667610.C.T\t3551\t955\t51344\t12996',
		'chr17.7667611.A.G\t3556\t950\t51358\t12974'
	]
	const output = await run_R(path.join(__dirname, '../fisher.R'), validInput)
	test.deepEqual(
		output,
		[
			'chr17.7666870.T.C\t1678\t2828\t25242\t39296\t0.0131297255310248',
			'chr17.7667504.G.C\t179\t4327\t2884\t61648\t0.124872545118219',
			'chr17.7667559.G.A\t3548\t958\t51468\t13062\t0.103536187735717',
			'chr17.7667610.C.T\t3551\t955\t51344\t12996\t0.111591083215894',
			'chr17.7667611.A.G\t3556\t950\t51358\t12974\t0.139697522440845'
		],
		'should match expected output'
	)
	test.end()
})

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

// survival.R tests
tape('survival.R', async function (test) {
	test.timeoutAfter(5000)
	test.plan(1)
	const infile = path.join(serverconfig.binpath, 'test/testdata/R/survival_input.json')
	const expfile = path.join(serverconfig.binpath, 'test/testdata/R/survival_output.json')
	const Rout = await run_R(path.join(__dirname, '../survival.R'), [], [infile])
	const out = JSON.parse(Rout[0])
	const exp = JSON.parse(await utils.read_file(expfile))
	test.deepEqual(out, exp, 'survival should match expected output')
	test.end()
})

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
	test.pass('-***- R correlation specs -***-')
	test.end()
})

/**
 * Correlation Tests Suite
 *
 * This test suite validates three different correlation methods implemented in corr.R:
 * 1. Pearson correlation
 * 2. Spearman correlation
 * 3. Kendall correlation
 *
 * Each test reads input data and expected output from JSON files, runs the R script,
 * and compares the results with expected values.
 */

tape('corr.R pearson', async function (test) {
	test.timeoutAfter(10000)
	const inJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/pearson-input.json'), {
		encoding: 'utf8'
	})
	const expJson = fs.readFileSync(path.join(serverconfig.binpath, 'test/testdata/R/pearson-output.json'), {
		encoding: 'utf8'
	})
	const Rout = await run_R(path.join(__dirname, '../corr.R'), inJson)
	const out = JSON.parse(Rout)
	test.deepEqual(out, JSON.parse(expJson))
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
	const Rout = await run_R(path.join(__dirname, '../corr.R'), inJson)
	const out = JSON.parse(Rout)
	test.deepEqual(out, JSON.parse(expJson))
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
	const Rout = await run_R(path.join(__dirname, '../corr.R'), inJson)
	const out = JSON.parse(Rout)
	test.deepEqual(out, JSON.parse(expJson))
	test.end()
})
