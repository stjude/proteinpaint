export function validate_termvaluesetting ( lst, from ) {
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
			continue
		}
		if(t.term.isinteger || t.term.isfloat) {
			if(!t.ranges) throw '.ranges[] missing from a numerical term of '+from
			for(const range of t.ranges) {
				if( range.value != undefined ) {
					// is a special category, not a value from numerical range
					if(!range.label) throw '.label missing for is_unannotated category'
				} else {
					validate_single_numericrange( range, from )
				}
			}
			continue
		}
		if(t.term.iscondition) {
			if( t.grade_and_child ) {
				if(!Array.isArray(t.grade_and_child)) throw 'grade_and_child[] is not array from '+from
				for(const i of t.grade_and_child) {
					if(!Number.isInteger(i.grade)) throw '.grade is not an integer from one of grade_and_child[] from '+from
					if(i.child_id==undefined) throw 'child_id is missing from one of grade_and_child[] from '+from
				}
				if(!t.value_by_max_grade && !t.value_by_most_recent && !t.value_by_computable_grade) throw 'unknown value_type for a bar_by_grade condition term from '+from
			} else {
				if(!t.values) throw '.values[] missing from a condition term of '+from
				if(!Array.isArray(t.values)) throw '.values[] is not an array from a '+from+' term'
				for(const i of t.values) {
					if(typeof i != 'object') throw 'an element is not object from values of '+t.term.id+' from '+from
					// i.key == 0 should be valid, check for presence of the object["key"] property instead 
					if(!('key' in i)) throw '.key missing from a value of '+t.term.id+' from '+from
					if(!i.label) i.label = i.key
				}
				if( t.bar_by_grade ) {
					if(!t.value_by_max_grade && !t.value_by_most_recent && !t.value_by_computable_grade) throw 'unknown value_type for a bar_by_grade condition term from '+from
				} else if(t.bar_by_children) {
				} else {
					throw 'neither bar_by_grade or bar_by_children is set for a condition term from '+from
				}
			}
			continue
		}
		throw 'unknown term type from a '+from+' term'
	}
}



export function validate_single_numericrange ( r, from ) {
	// a regular range
	if(r.startunbounded) {
		if(r.stopunbounded) throw 'both start & stop are unbounded from '+from
		if(!Number.isFinite(r.stop)) throw '.stop undefined when start is unbounded from '+from
	} else if(r.stopunbounded) {
		if(!Number.isFinite(r.start)) throw '.start undefined when stop is unbounded from '+from
	} else {
		if(!Number.isFinite(r.start)) throw '.start undefined when start is not unbounded from '+from
		if(!Number.isFinite(r.stop)) throw '.stop undefined when stop is not unbounded from '+from
		if(r.start >= r.stop ) throw '.start is not lower than stop from '+from
	}
}
