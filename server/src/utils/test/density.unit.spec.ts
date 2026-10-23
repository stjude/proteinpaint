import tape from 'tape'
import { kernelDensity, bwNrd0 } from '#src/utils/density.ts'

/*
test sections:

matches R's density(x, cut = 0): bandwidth and y at sampled points, for several shapes of data
output grid: 512 points from the min to the max value
flat line: 5 or fewer values, or all the same values
non-finite values throw
*/

/** Deterministic values, so the expected numbers below can be regenerated with R 4.4 or later:
 * pass JSON.stringify(cases) as stdin to
 *
 *   library(jsonlite); cases <- fromJSON(file("stdin"))
 *   out <- lapply(cases, function(v) { d <- density(v, cut = 0); list(bw = d$bw, y = d$y[c(seq(1, 512, by = 64), 512)]) })
 *   cat(toJSON(out, digits = I(17), auto_unbox = TRUE))
 */
let seed = 1
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) + 0.5) / 2147483648
const normal = () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand())
const cases = {
	six: [1.2, 2, 3, 4.5, 5, 6],
	// more than half of the values tie, so the IQR is 0 and the bandwidth falls back to the sd
	zeroIqr: [...Array(50).fill(0), 1, 2, 3],
	ties: Array.from({ length: 300 }, () => Math.round(rand() * 5)),
	bimodal: Array.from({ length: 2000 }, (_, i) => (i % 3 ? normal() : normal() * 0.3 + 6)),
	ageDays: Array.from({ length: 1000 }, () => Math.round(Math.abs(normal() * 8000 + 20000)))
}
const sampled = [...Array.from({ length: 8 }, (_, i) => i * 64), 511]
const expected = {
	six: {
		bw: 1.1668006494114553,
		y: [
			0.1207050064045008, 0.14501524299350926, 0.15377530765629621, 0.15393482774330386, 0.15603359280056664,
			0.16289294463684123, 0.16585441884655092, 0.15345473595568193, 0.12365196545170305
		]
	},
	zeroIqr: {
		bw: 0.20589702873207058,
		y: [
			1.8270296198767011, 0.34644993792295237, 0.019999478589113603, 0.030203000028679962, 0.0038415452180076397,
			0.030728057543658555, 0.017096702810910389, 0.0076284942529524172, 0.036540865772744666
		]
	},
	ties: {
		bw: 0.43609183071327573,
		y: [
			0.072059588991809823, 0.18528588593833786, 0.23436184545372984, 0.17245318434247894, 0.16259337899161844,
			0.19530003369095136, 0.20956523957656217, 0.17728844756745574, 0.12713675406043545
		]
	},
	bimodal: {
		bw: 0.57529392324267237,
		y: [
			0.0049521406576736775, 0.054934746348514606, 0.18745049586792387, 0.2077731151914049, 0.064293409918123628,
			0.0072088276239286606, 0.011319133408493762, 0.18080570683574124, 0.07393878492264816
		]
	},
	ageDays: {
		bw: 1894.5256549837397,
		y: [
			2.2923825968745237e-6, 1.5212359729601226e-5, 2.6586918810216708e-5, 4.2223740357508039e-5, 4.4720963500892296e-5,
			2.8698623843645747e-5, 1.3277953158089415e-5, 4.3758873091209863e-6, 4.3539239285512585e-7
		]
	}
}

/** R convolves by FFT and this directly, so the two differ by rounding error, relative to the peak density */
const tolerance = 1e-12

tape('\n', function (test) {
	test.comment('-***- #src/utils/density -***-')
	test.end()
})

tape("matches R's density(x, cut = 0)", function (test) {
	for (const [name, values] of Object.entries(cases)) {
		const { bw, y } = expected[name]
		test.ok(Math.abs(bwNrd0(values) - bw) <= bw * tolerance, `${name}: bandwidth matches bw.nrd0()`)
		const result = kernelDensity(values)
		const maxY = Math.max(...result.y)
		const maxDiff = Math.max(...sampled.map((i, j) => Math.abs(result.y[i] - y[j])))
		test.ok(maxDiff <= maxY * tolerance, `${name}: density matches at sampled points (max difference ${maxDiff})`)
	}
	test.end()
})

tape('output grid is 512 points from the min to the max value', function (test) {
	const values = cases.bimodal
	const result = kernelDensity(values)
	test.equal(result.x.length, 512, 'x has 512 points')
	test.equal(result.y.length, 512, 'y has 512 points')
	test.equal(result.x[0], Math.min(...values), 'x starts at the min value')
	test.equal(result.x[511], Math.max(...values), 'x ends at the max value')
	test.ok(
		result.x.every((x, i) => i == 0 || x > result.x[i - 1]),
		'x is increasing'
	)
	test.ok(
		result.y.every(y => y >= 0),
		'y is not negative'
	)
	test.end()
})

tape('flat line for 5 or fewer values, or all the same values', function (test) {
	test.deepEqual(kernelDensity([3, 1, 2, 5, 4]), { x: [3, 1, 2, 5, 4], y: [0, 0, 0, 0, 0] }, '5 values')
	test.deepEqual(kernelDensity([7]), { x: [7], y: [0] }, '1 value')
	test.deepEqual(kernelDensity([]), { x: [], y: [] }, 'no values')
	const same = Array(10).fill(2.5)
	test.deepEqual(kernelDensity(same), { x: same, y: Array(10).fill(0) }, '10 values that are all the same')
	test.end()
})

tape('non-finite values throw', function (test) {
	for (const v of [NaN, Infinity, -Infinity]) {
		test.throws(() => kernelDensity([1, 2, 3, 4, 5, 6, v]), /must be finite numbers/, `${v} throws`)
	}
	test.end()
})
