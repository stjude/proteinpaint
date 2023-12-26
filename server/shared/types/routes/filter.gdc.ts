/* the gdc cohort filter object
is invisible on pp ui
always used as "filter0" property in pp client code and in request to pp back
pp does not compute on it, on pp backend, it's passed to gdc api queries

FIXME type is not properly defined yet
*/
export type GdcFilter0 = {
	op: string
	// TODO: this should allow an array of objects, and/or nesting ???
	content: {
		field: string
		value: string
	}
}
