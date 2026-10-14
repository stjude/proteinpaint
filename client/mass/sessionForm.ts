/* The form in which a saved session holds sample groups. A session is marked with it when it is
saved. A session without the mark that lists the samples of a group is not opened: its groups and
plots have to be made again. */
const sampleGroupsForm = 2
const key = 'sampleGroupsForm'

/** Marks a state that is about to be saved, and returns it. */
export function markSavedState(state: any) {
	state[key] = sampleGroupsForm
	return state
}

/** The reason why a saved state is not opened, or undefined when it is opened. */
export function getSavedStateRefusal(state: any): string | undefined {
	if (state?.[key] >= sampleGroupsForm || !listsSamples(state)) return
	return 'This session was saved by an earlier version, with sample groups in a form that is no longer opened. Please make its groups and plots again.'
}

// the values[] of a group, or the list[] of a category of a samplelst term, anywhere in a state
function listsSamples(o: any): boolean {
	if (!o || typeof o != 'object') return false
	if (Array.isArray(o)) return o.some(listsSamples)
	for (const [k, v] of Object.entries(o)) {
		if ((k == 'values' || k == 'list') && Array.isArray(v) && v.some(i => i && typeof i == 'object' && 'sampleId' in i))
			return true
		if (listsSamples(v)) return true
	}
	return false
}
