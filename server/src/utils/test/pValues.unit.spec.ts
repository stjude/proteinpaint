import tape from 'tape'
import { chiSquareLogSf, logBH } from '../pValues.ts'

/*
test sections:

chiSquareLogSf: matches R's pchisq(log.p = TRUE), integer and non-integer df, far tails
logBH: Benjamini-Hochberg on log p
*/

const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))

tape('\n', t => {
	t.comment('-***- pValues specs -***-')
	t.end()
})

// the expected numbers are from R's pchisq(x, df, lower.tail = FALSE, log.p = TRUE)
tape('chiSquareLogSf matches pchisq', t => {
	for (const [x, df, want] of [
		[3.841458820694124, 1, -2.9957322735539913],
		[18.307038053275146, 10, -2.9957322735539891],
		[3, 2.5, -1.1846617048495762],
		[0.5, 7.3, -0.00036343373727807017],
		[700, 4, -344.13921377653412],
		[2500, 3.6, -1244.2235573697974],
		[40, 40.5, -0.70797696987572123]
	])
		t.ok(close(chiSquareLogSf(x, df), want), `chi-square(${df}) tail at ${x}: ${chiSquareLogSf(x, df)} vs ${want}`)
	t.equal(chiSquareLogSf(0, 4), 0, 'should be ln 1 at 0')
	t.end()
})

tape('logBH', t => {
	const q = logBH([0.01, 0.04, 0.03, 0.5].map(Math.log)).map(Math.exp)
	// R: p.adjust(c(0.01, 0.04, 0.03, 0.5), 'BH')
	const want = [0.04, 0.16 / 3, 0.16 / 3, 0.5]
	t.ok(
		q.every((v, i) => close(v, want[i])),
		`q ${q.join(' ')}`
	)
	t.end()
})
