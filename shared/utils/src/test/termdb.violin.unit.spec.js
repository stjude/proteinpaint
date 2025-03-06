import tape from 'tape'
import { getBinsDensity } from '../violin.bins'

const v = { values: [0, 1, 2, 2, 2, 3, 4, 5, 0, 4, 5, 6, 6, 7, 8, 9, 10] }

/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- termdb.violinBins specs -***-')
	test.end()
})

tape('compute bins given an array', function (test) {
	const bins = [
		{
			x0: 0,
			density: 0.03593472885328554
		},
		{
			x0: 0.5050505050505051,
			density: 0.05740368257260453
		},
		{
			x0: 1.0101010101010102,
			density: 0.06894600028758677
		},
		{
			x0: 1.5151515151515151,
			density: 0.07284135457595572
		},
		{
			x0: 1.9191919191919191,
			density: 0.07308724615377082
		},
		{
			x0: 2.4242424242424243,
			density: 0.07285492394726545
		},
		{
			x0: 2.8282828282828283,
			density: 0.07033546534058403
		},
		{
			x0: 3.2323232323232327,
			density: 0.06481909643809781
		},
		{
			x0: 3.7373737373737375,
			density: 0.062226158848639704
		},
		{
			x0: 4.141414141414142,
			density: 0.06722778193867707
		},
		{
			x0: 4.545454545454545,
			density: 0.07337431577380124
		},
		{
			x0: 4.94949494949495,
			density: 0.07610386029749643
		},
		{
			x0: 5.454545454545454,
			density: 0.07337431577380125
		},
		{
			x0: 5.858585858585858,
			density: 0.06722778193867707
		},
		{
			x0: 6.262626262626263,
			density: 0.061336018347888314
		},
		{
			x0: 6.767676767676768,
			density: 0.05050948785125261
		},
		{
			x0: 7.272727272727273,
			density: 0.04422008961552424
		},
		{
			x0: 7.777777777777778,
			density: 0.037395536784456555
		},
		{
			x0: 8.282828282828284,
			density: 0.03766413187349341
		},
		{
			x0: 8.787878787878787,
			density: 0.03745677206010133
		},
		{
			x0: 9.393939393939394,
			density: 0.03593472885328554
		},
		{
			x0: 10,
			density: 0.03593472885328554
		},
		{
			x0: 10,
			density: 0.03593472885328554
		}
	]

	const result = getBinsDensity(v, true, 20)
	console.log(result)
	test.deepEqual(result.bins, bins, 'should match expected output')
	test.end()
})
