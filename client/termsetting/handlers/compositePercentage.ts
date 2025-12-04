export function fillTW(tw) {
	if (!tw.type) tw.type = 'compositePercentage'
	if (!tw.q) tw.q = { mode: 'continuous' }
	else tw.q.mode = 'continuous'
	return tw
}
