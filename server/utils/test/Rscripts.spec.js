const tape = require('tape')
const fs = require('fs')
const lines2R = require('../../src/utils').lines2R

/**************
 R scripts
***************/
const hweScript = 'hwe.R'
const fisherScript = 'fisher.R'
const fisher2x3script = 'fisher.2x3.R'
const kmScript = 'km.R'

/**************
 Test sections
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
		'chr17.7666870.T.C\t1678\t2828\t25242\t39296',
		'chr17.7667504.G.C\t179\t4327\t2884\t61648',
		'chr17.7667559.G.A\t3548\t958\t51468\t13062',
		'chr17.7667610.C.T\t3551\t955\t51344\t12996',
		'chr17.7667611.A.G\t3556\t950\t51358\t12974'
	]
	output = await lines2R(fisherScript, validInput)
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
	//Test valid input
	const validInput = [
		'0\t506\t1451\t68\t206\t3\t11',
		'1\t246\t1711\t24\t250\t1\t13',
		'2\t102\t1855\t16\t258\t0\t14',
		'3\t167\t1790\t22\t252\t2\t12',
		'4\t174\t1783\t30\t244\t4\t10'
	]
	output = await lines2R(fisher2x3script, validInput)
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
tape('km.R', async function(test) {
	//Test invalid input
	const invalidInput = 'futime\tfustat\trx,410\t1\t0,443\t0\t0,2819\t0\t0,496\t1\t0,2803\t0\t0,2983\t0\t0'
	try {
		output = await lines2R(kmScript, invalidInput)
		test.fail('should emit an error on invalid input')
	} catch (error) {
		test.deepEqual(error, TypeError('lines.join is not a function'), 'should emit an error on invalid input')
	}
	//Test valid input
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
	output = await lines2R(kmScript, validInput)
	test.deepEqual(output.map(Number), [0.007], 'should match expected output')
	test.end()
})

tape('survival.R', async function(test) {
	const validInput1 = [
		`cohort\ttime\tstatus`,
		`2\t185\t1`,
		`2\t191\t1`,
		`2\t368\t1`,
		`2\t586\t1`,
		`2\t1559\t1`,
		`2\t1630\t1`,
		`2\t3208\t1`,
		`2\t6156\t0`,

		`1\t23\t1`,
		`1\t30\t1`,
		`1\t69\t1`,
		`1\t101\t1`,
		`1\t128\t1`,
		`1\t136\t1`,
		`1\t182\t1`,
		`1\t189\t1`,
		`1\t221\t1`,
		`1\t228\t1`,
		`1\t262\t1`,
		`1\t265\t1`,
		`1\t274\t1`,
		`1\t316\t1`,
		`1\t325\t1`,
		`1\t329\t1`,
		`1\t378\t1`,
		`1\t403\t1`,
		`1\t418\t1`,
		`1\t425\t1`,
		`1\t458\t1`,
		`1\t549\t1`,
		`1\t553\t1`,
		`1\t587\t1`,
		`1\t624\t1`,
		`1\t624\t1`,
		`1\t842\t1`,
		`1\t1070\t1`,
		`1\t1692\t0`,
		`1\t1914\t0`,
		`1\t3033\t1`,
		`1\t3827\t1`,
		`1\t4149\t0`,
		`1\t4203\t0`,
		`1\t4203\t0`,
		`1\t4309\t0`,
		`1\t4392\t0`,
		`1\t4434\t1`,
		`1\t4453\t0`,
		`1\t4474\t1`,
		`1\t4664\t0`,
		`1\t5072\t1`
	]

	try {
		const output1 = await lines2R('survival.R', validInput1)
		const expected1 = [
			'cohort\ttime\tsurv\tncensor\tlower\tupper',
			'1\t23\t0.976190476190476\t0\t0.931155465908631\t1',
			'1\t30\t0.952380952380952\t0\t0.890105444476807\t1',
			'1\t69\t0.928571428571428\t0\t0.853861149033387\t1',
			'1\t101\t0.904761904761905\t0\t0.820202198408237\t0.998039393087499',
			'1\t128\t0.880952380952381\t0\t0.788260373656289\t0.984544096649045',
			'1\t136\t0.857142857142857\t0\t0.757587069035504\t0.969781438437659',
			'1\t182\t0.833333333333333\t0\t0.727914326476415\t0.954019476173814',
			'1\t189\t0.80952380952381\t0\t0.699066985451853\t0.937433481803406',
			'1\t221\t0.785714285714286\t0\t0.670923299994012\t0.920145326270558',
			'1\t228\t0.761904761904762\t0\t0.643394848499071\t0.902243571839836',
			'1\t262\t0.738095238095238\t0\t0.616415300764895\t0.883794707598685',
			'1\t265\t0.714285714285714\t0\t0.589933691214652\t0.864849879284163',
			'1\t274\t0.69047619047619\t0\t0.563910171064325\t0.845449140799641',
			'1\t316\t0.666666666666667\t0\t0.538313211381596\t0.825624255633193',
			'1\t325\t0.642857142857143\t0\t0.513117699625512\t0.805400605794854',
			'1\t329\t0.619047619047619\t0\t0.488303610677412\t0.784798527532684',
			'1\t378\t0.595238095238095\t0\t0.463855061609755\t0.76383426493847',
			'1\t403\t0.571428571428571\t0\t0.439759632003889\t0.74252066010918',
			'1\t418\t0.547619047619047\t0\t0.416007874564318\t0.72086765576075',
			'1\t425\t0.523809523809524\t0\t0.392592967259528\t0.698882659943779',
			'1\t458\t0.5\t0\t0.369510475257087\t0.676570805810207',
			'1\t549\t0.476190476190476\t0\t0.346758202424668\t0.653935128365923',
			'1\t553\t0.452380952380952\t0\t0.324336120437094\t0.630976672599096',
			'1\t587\t0.428571428571428\t0\t0.302246370007005\t0.607694541984071',
			'1\t624\t0.380952380952381\t0\t0.25908379153838\t0.560145872852834',
			'1\t842\t0.357142857142857\t0\t0.238027156193617\t0.535867513807585',
			'1\t1070\t0.333333333333333\t0\t0.217335835160975\t0.511241558617398',
			'1\t1692\t0.333333333333333\t1\t0.217335835160975\t0.511241558617398',
			'1\t1914\t0.333333333333333\t1\t0.217335835160975\t0.511241558617398',
			'1\t3033\t0.305555555555555\t0\t0.192802434779677\t0.484248021232485',
			'1\t3827\t0.277777777777778\t0\t0.168996814110034\t0.456579576564804',
			'1\t4149\t0.277777777777778\t1\t0.168996814110034\t0.456579576564804',
			'1\t4203\t0.277777777777778\t2\t0.168996814110034\t0.456579576564804',
			'1\t4309\t0.277777777777778\t1\t0.168996814110034\t0.456579576564804',
			'1\t4392\t0.277777777777778\t1\t0.168996814110034\t0.456579576564804',
			'1\t4434\t0.222222222222222\t0\t0.114558902375431\t0.431068341485553',
			'1\t4453\t0.222222222222222\t1\t0.114558902375431\t0.431068341485553',
			'1\t4474\t0.148148148148148\t0\t0.0524224541178201\t0.418673146251366',
			'1\t4664\t0.148148148148148\t1\t0.0524224541178201\t0.418673146251366',
			'1\t5072\t0\t0\tNA\tNA',
			'2\t185\t0.875\t0\t0.673381936505955\t1',
			'2\t191\t0.75\t0\t0.502701841294047\t1',
			'2\t368\t0.625\t0\t0.365400278682409\t1',
			'2\t586\t0.5\t0\t0.250048821862805\t0.999804750678524',
			'2\t1559\t0.375\t0\t0.153289601742952\t0.917381207864386',
			'2\t1630\t0.25\t0\t0.0752813929560883\t0.830218431750542',
			'2\t3208\t0.125\t0\t0.0199840670220076\t0.781872878168034',
			'2\t6156\t0.125\t1\t0.0199840670220076\t0.781872878168034'
		]

		test.deepEqual(output1, expected1, 'should match the expected output')
	} catch (e) {
		test.fail(e)
	}

	test.end()
})
