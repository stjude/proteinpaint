import { IN_frame, OUT_frame } from '#shared/common.js'

export default function (events) {
	// from a list of exon skip/alt events (resulted from the same junction), find the best one
	let evt2showidx = 0
	for (let i = 1; i < events.length; i++) {
		const e = events[i]
		const e2show = events[evt2showidx]
		// order of precedence for determining which event to feature
		if (e.isskipexon && e2show.isaltexon) {
			evt2showidx = i
			continue
		}
		if (e.frame == OUT_frame && e2show.framenocheck) {
			evt2showidx = i
			continue
		}
		if (e.frame == IN_frame && e2show.frame != IN_frame) {
			evt2showidx = i
			continue
		}
	}
	return evt2showidx
}
