/*
Decides whether AppApi.dispatch() should skip aborting the requests that were signaled by
previously dispatched actions. See the RxApp.skipPrevActionAbort declaration in rx/src/AppApi.ts.

Returning true keeps the app-level AbortController intact, so that plots and control menus can
continue rendering while another plot is being created, edited or deleted. Returning false aborts
it, which is reserved for actions that are assumed to affect every component.

Shared by MassApp and PlotApp, which dispatch the same action types.
*/

/** state keys that, when replaced, affect every component the same way a filter or cohort change does */
const globalStateKeys = ['termfilter', 'activeCohort', 'plots']

const isGlobalActionType = (type: string) => type.startsWith('filter') || type.startsWith('cohort')

export function skipPrevActionAbort(action?: { type: string; [key: string]: any }): boolean {
	// a dispatch without an action re-renders everything
	if (!action) return false
	if (isGlobalActionType(action.type)) return false
	if (action.type == 'app_refresh') {
		if (action.subactions) return !action.subactions.find(a => isGlobalActionType(a.type))
		// an app_refresh without subactions may replace the app state wholesale, such as when
		// recovering a saved session or refreshing after a login. Like a filter or cohort change,
		// that affects every component, so pending requests must not be allowed to render.
		// A partial state patch, such as {groups}, does not.
		if (!action.state) return false
		return !globalStateKeys.find(key => key in action.state)
	}
	return true
}
