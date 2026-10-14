import tape from 'tape'
import { niceScaleLength } from '../scaleBar'

/* Tests
    niceScaleLength: largest round µm length whose bar fits the 140px cap
*/

tape('\n', function (test) {
	test.comment('-***- plots/w2/scaleBar -***-')
	test.end()
})

tape('niceScaleLength picks the largest round length under the width cap', test => {
	// 1 screen px = 1 µm: a 100µm bar is 100px (fits), 200µm would be 200px (too wide)
	test.equal(niceScaleLength(1), 100, '100 µm is the largest NICE value <= 140px at 1 µm/px')
	// 1 screen px = 0.01 µm (zoomed way in): even 1µm is 100px, 2µm would be 200px
	test.equal(niceScaleLength(0.01), 1, 'falls back to the smallest nice value when even that is close to the cap')
	// 1 screen px = 1000 µm (zoomed way out): every nice value up to 100000 fits comfortably
	test.equal(niceScaleLength(1000), 100000, 'largest nice value chosen when zoomed far out')
	test.end()
})

tape('niceScaleLength is monotonic: zooming in never grows the chosen length', test => {
	// smaller µm-per-screen-px = more zoomed in (a screen px covers less of
	// the slide) = a fixed round length would render WIDER on screen, so the
	// chosen length must shrink (or hold) as the view zooms in, never grow
	const steps = [50, 10, 5, 1, 0.5, 0.1, 0.05, 0.01]
	let prev = Infinity
	for (const umPerPx of steps) {
		const len = niceScaleLength(umPerPx)
		test.ok(len <= prev, `${umPerPx} µm/px -> ${len} µm, not larger than the previous (less zoomed in) step`)
		prev = len
	}
	test.end()
})
