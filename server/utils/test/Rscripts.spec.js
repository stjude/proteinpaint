const tape = require('tape')
const fs = require('fs')
const lines2R = require('../../src/utils').lines2R

/**************
 R scripts
***************/
const hweScript = 'hwe.R'
const fisherScript = 'fisher.R'
const fisher2x3script = 'fisher.2x3.R'

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- R scripts specs -***-')
	test.end()
})

let output

// hwe.R tests
tape('hwe.R', async function(test) {
	//Test invalid input
	const invalidInput = '68\t28\t4,5\t40\t3,56\t4\t43,83\t45\t13'
	try {
		output = await lines2R(hweScript, invalidInput)
		test.fail('should emit an error on invalid input')
	} catch (error) {
		test.deepEqual(error, TypeError('lines.join is not a function'), 'should emit an error on invalid input')
	}
	//Test valid input
	const validInput = ['68\t28\t4', '5\t40\t3', '56\t4\t43', '83\t45\t13']
	output = await lines2R(hweScript, validInput)
	test.deepEqual(
		output.map(Number),
		[0.515367, 0.000006269428, 1.385241e-24, 0.07429809],
		'should match expected output'
	)
	test.end()
})

// fisher.R tests
tape('fisher.R', async function(test) {
	//Test invalid input
	const invalidInput = 'gene1\t2\t10\t15\t3,gene2\t4\t74\t67\t9,gene3\t12\t17\t1000\t1012,gene4\t13\t25\t37\t19'
	try {
		output = await lines2R(fisherScript, invalidInput)
		test.fail('should emit an error on invalid input')
	} catch (error) {
		test.deepEqual(error, TypeError('lines.join is not a function'), 'should emit an error on invalid input')
	}
	//Test valid input
	const validInput = [
		'gene1\t2\t10\t15\t3',
		'gene2\t4\t74\t67\t9',
		'gene3\t12\t17\t1000\t1012',
		'gene4\t13\t25\t37\t19'
	]
	output = await lines2R(fisherScript, validInput)
	test.deepEqual(
		output,
		[
			'gene1\t2\t10\t15\t3\t0.000536724119143436',
			'gene2\t4\t74\t67\t9\t3.18902205880894e-28',
			'gene3\t12\t17\t1000\t1012\t0.455473443046045',
			'gene4\t13\t25\t37\t19\t0.00319105222682778'
		],
		'should match expected output'
	)
	//Test valid mds2 input
	const validMdsInput = [
		'chr17.7666870.T.C\t1678\t2828\t25242\t39296',
		'chr17.7667504.G.C\t179\t4327\t2884\t61648',
		'chr17.7667559.G.A\t3548\t958\t51468\t13062',
		'chr17.7667610.C.T\t3551\t955\t51344\t12996',
		'chr17.7667611.A.G\t3556\t950\t51358\t12974'
	]
	output = await lines2R(fisherScript, validMdsInput)
	test.deepEqual(
		output,
		[
			'chr17.7666870.T.C\t1678\t2828\t25242\t39296\t0.0131297255310248',
			'chr17.7667504.G.C\t179\t4327\t2884\t61648\t0.124872545118219',
			'chr17.7667559.G.A\t3548\t958\t51468\t13062\t0.103536187735717',
			'chr17.7667610.C.T\t3551\t955\t51344\t12996\t0.111591083215894',
			'chr17.7667611.A.G\t3556\t950\t51358\t12974\t0.139697522440845'
		],
		'should match expected mds2 output'
	)
	test.end()
})

// fisher.2x3.R tests
tape('fisher.2x3.R', async function(test) {
	//Test invalid input
	const invalidInput =
		'0\t506\t1451\t68\t206\t3\t11,1\t246\t1711\t24\t250\t1\t13,2\t102\t1855\t16\t258\t0\t14,3\t167\t1790\t22\t252\t2\t12,4\t174\t1783\t30\t244\t4\t10'
	try {
		output = await lines2R(fisher2x3script, invalidInput)
		test.fail('should emit an error on invalid input')
	} catch (error) {
		test.deepEqual(error, TypeError('lines.join is not a function'), 'should emit an error on invalid input')
	}
	//Test valid mds input
	const validMdsInput = [
		'0\t506\t1451\t68\t206\t3\t11',
		'1\t246\t1711\t24\t250\t1\t13',
		'2\t102\t1855\t16\t258\t0\t14',
		'3\t167\t1790\t22\t252\t2\t12',
		'4\t174\t1783\t30\t244\t4\t10'
	]
	output = await lines2R(fisher2x3script, validMdsInput)
	test.deepEqual(
		output,
		[
			'0\t506\t1451\t68\t206\t3\t11\t0.918925559316051',
			'1\t246\t1711\t24\t250\t1\t13\t0.181035956038115',
			'2\t102\t1855\t16\t258\t0\t14\t0.843096446394939',
			'3\t167\t1790\t22\t252\t2\t12\t0.568558123095687',
			'4\t174\t1783\t30\t244\t4\t10\t0.0301248106031606'
		],
		'should match expected mds2 output'
	)
	test.end()
})
