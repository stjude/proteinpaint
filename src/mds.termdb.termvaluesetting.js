exports.validate_termvaluesetting = ( lst, from ) => {
/*
shared between client and server
for validating a list of term-value setting
TODO also work for termdb filter
*/
	if(!lst) throw '.terms[] list missing from '+from
	if(!Array.isArray(lst)) throw '.terms[] is not an array from '+from

	// allow the array to be blank!!!

	for(const t of lst) {
		if(!t.term) throw '.term{} missing from a '+from+' term'
		if(!t.term.id) throw '.term.term.id missing from a '+from+' term'
		if( t.term.iscategorical ) {
			if(!t.values) throw '.values[] missing from a '+from+' term'
			if(!Array.isArray(t.values)) throw '.values[] is not an array from a '+from+' term'
			for(const i of t.values) {
				if(typeof i != 'object') throw 'an element is not object from values of '+t.term.id+' from '+from
				if(!i.key) throw '.key missing from a value of '+t.term.id+' from '+from
				if(!i.label) i.label = i.key
			}
		} else if(t.term.isinteger || t.term.isfloat) {
			if(!t.range) throw '.range{} missing from a numerical term of '+from
			if(t.range.startunbounded && t.range.stopunbounded) throw 'both start & stop are unbounded from range of a term from '+from
			if(t.range.startunbounded) {
				if(!Number.isFinite(t.range.stop)) throw '.stop undefined when start is unbounded for a term from '+from
			} else if(t.range.stopunbounded) {
				if(!Number.isFinite(t.range.start)) throw '.start undefined when stop is unbounded for a term from '+from
			} else {
				if(!Number.isFinite(t.range.start)) throw '.start undefined when start is not unbounded for a term from '+from
				if(!Number.isFinite(t.range.stop)) throw '.stop undefined when stop is not unbounded for a term from '+from
				if(t.range.start >= t.range.stop ) throw '.start is not lower than stop for a term from '+from
			}
		} else if(t.term.iscondition) {
			if(!t.range) throw '.range{} missing from a condition term of '+from
			if(t.range.grade==undefined && t.range.child_id==undefined) throw 'either .grade or child_id is required for a condition term from '+from
			if(!t.range.value_by_max_grade && !t.range.value_by_most_recent) throw 'unknown value_type for a condition term from '+from
		} else {
			throw 'unknown term type from a '+from+' term'
		}
	}
}
