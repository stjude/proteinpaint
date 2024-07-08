/*
hydrate filter by filling tvs term obj.
only works for dictionary terms e.g. term:{id:'xx'} with id but lacks type etc.
provides convenience for hand coding dictionary filter

TODO allow to work for non-dict terms
TODO unit test

args:
- filter: modifiable filter obj
- vocabApi
- proms[] optional array to hold promises to be resolved at once. if not provided, new array is created and returned
*/
export function rehydrateFilter(filter, vocabApi, proms = []) {
	if (Object.isFrozen(filter)) throw 'filter obj is frozen, unable to rehydrate and modify'

	if (filter.type == 'tvslst') {
		for (const f of filter.lst) rehydrateFilter(f, vocabApi, proms)
	} else if (filter.type == 'tvs') {
		if (typeof filter.tvs?.term != 'object') throw 'a tvs lacks structure of .tvs.term{}'
		if (filter.tvs.term.id && !filter.tvs.term.name) {
			// has term.id. allows term obj to be like {id:'xx'} and assumes it must be dict term
			proms.push(
				vocabApi.getterm(filter.tvs.term.id).then(term => {
					filter.tvs.term = term
				})
			)
		}
	} else {
		throw `cannot rehydrate filter.type='${filter.type}'`
	}
	return proms
}
