import tape from 'tape'
import { lowess } from '../model/lowess.ts'

/*
The expected values are from R 4.5.2, lowess(x, y, ...)$y, written with jsonlite::toJSON(digits = NA).
*/

// R's cars dataset, which has many ties in speed
const carsSpeed = [
	4, 4, 7, 7, 8, 9, 10, 10, 10, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 16, 16, 17, 17, 17,
	18, 18, 18, 18, 19, 19, 19, 20, 20, 20, 20, 20, 22, 23, 24, 24, 24, 24, 25
]
const carsDist = [
	2, 10, 4, 22, 16, 10, 18, 26, 34, 17, 28, 14, 20, 24, 28, 26, 34, 34, 46, 26, 36, 60, 80, 20, 26, 54, 32, 40, 32, 40,
	50, 42, 56, 76, 84, 36, 46, 68, 32, 48, 52, 56, 64, 66, 54, 70, 92, 93, 120, 85
]

function testFit(test, X: number[], Y: number[], opts: any, expected: number[], message: string) {
	const result = lowess(X, Y, opts)
	const sortedX = X.slice().sort((a, b) => a - b)
	test.deepEqual(
		result.map(p => p[0]),
		sortedX,
		message + ': Should return the x values sorted.'
	)
	const maxDiff = Math.max(...result.map((p, i) => Math.abs(p[1] - expected[i]) / Math.max(1, Math.abs(expected[i]))))
	test.ok(maxDiff < 1e-12, message + `: Should match R's fitted values (max relative difference ${maxDiff}).`)
}

tape('\n', function (test) {
	test.comment('-***- plots/scatter/model/lowess -***-')
	test.end()
})

tape('lowess matches R with the default options', function (test) {
	testFit(
		test,
		carsSpeed,
		carsDist,
		{},
		[
			4.96545927718688, 4.96545927718688, 13.1244950396664, 13.1244950396664, 15.8586333820983, 18.5796905142177,
			21.2803125785285, 21.2803125785285, 21.2803125785285, 24.1292771489265, 24.1292771489265, 27.1195485506035,
			27.1195485506035, 27.1195485506035, 27.1195485506035, 30.027276331154, 30.027276331154, 30.027276331154,
			30.027276331154, 32.9625061361576, 32.9625061361576, 32.9625061361576, 32.9625061361576, 36.7577283416497,
			36.7577283416497, 36.7577283416497, 40.4350745619887, 40.4350745619887, 43.4634917818176, 43.4634917818176,
			43.4634917818176, 46.885478946024, 46.885478946024, 46.885478946024, 46.885478946024, 50.7931517254206,
			50.7931517254206, 50.7931517254206, 56.4912240928771, 56.4912240928771, 56.4912240928771, 56.4912240928771,
			56.4912240928771, 67.5858242314313, 73.07969526937, 78.6431635544001, 78.6431635544001, 78.6431635544001,
			78.6431635544001, 84.3286980968343
		],
		'cars'
	)
	testFit(
		test,
		[3, 1, 2, 1, 5, 4, 3, 6],
		[2, 8, 1, 4, 9, 3, 5, 7],
		{},
		[6, 6, 1, 2.872113854036, 2.872113854036, 5.06832598067313, 6.66987488320851, 7.90960012962558],
		'unsorted x with ties'
	)
	testFit(
		test,
		[2, 2, 2, 2],
		[1, 2, 3, 7],
		{},
		[2.93025248247665, 2.93025248247665, 2.93025248247665, 2.93025248247665],
		'constant x'
	)
	test.end()
})

tape('lowess matches R with and without robustness iterations', function (test) {
	const X = Array.from({ length: 15 }, (_, i) => i + 1)
	const Y = [1, 3, 2, 4, 3, 5, 4, 6, 5, 30, 6, 8, 7, 9, 8]
	testFit(
		test,
		X,
		Y,
		{},
		[
			1.53031966680266, 2.08989630436738, 2.64829830886096, 3.2037963021191, 3.74865862514252, 4.22035095888674,
			4.66035345727271, 5.08230296648924, 5.58363742269862, 6.07254748910624, 6.58067292889717, 7.08171661384847,
			7.58191760768166, 8.08390894539121, 8.5850355080674
		],
		'outlier, iter=3'
	)
	testFit(
		test,
		X,
		Y,
		{ iter: 0 },
		[
			1.54715697158737, 2.10386306795604, 2.65976969482659, 3.21308636494308, 3.75565978783728, 4.70609400629492,
			6.6703529868578, 8.50254631523503, 9.63435829556928, 10.2176370042486, 10.6343582955693, 10.0203704693308,
			9.17630690288811, 8.19015996751906, 7.16797888587284
		],
		'outlier, iter=0'
	)
	testFit(
		test,
		[5, 1, 4, 2, 3, 9, 7, 8, 6, 10],
		[3, 1, 4, 1, 5, 9, 2, 6, 5, 3],
		{ f: 0.3, delta: 0 },
		[1, 1, 5, 4, 3, 5, 2, 6, 9, 3],
		'f=0.3, delta=0'
	)
	test.end()
})

tape('lowess handles small inputs and rejects invalid ones', function (test) {
	test.deepEqual(lowess([], []), [], 'Should return an empty curve for no points.')
	test.deepEqual(lowess([3], [2]), [[3, 2]], 'Should return the point itself for one point.')
	test.deepEqual(
		lowess([2, 1], [5, 3]),
		[
			[1, 3],
			[2, 5]
		],
		'Should return the sorted points for two points.'
	)
	test.throws(() => lowess([1, 2], [1]), /different lengths/, 'Should throw on mismatched lengths.')
	test.throws(() => lowess([1, NaN, 3], [1, 2, 3]), /finite/, 'Should throw on an x that is not finite.')
	test.throws(() => lowess([1, 2, 3], [1, 2, Infinity]), /finite/, 'Should throw on a y that is not finite.')
	test.throws(() => lowess([1, 2, 3], [1, 2, 3], { f: 0 }), /f must be/, 'Should throw on f <= 0.')
	test.end()
})
