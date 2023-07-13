import { Term, Q } from './termdb'
import { Filter } from './filter'
import { UseCase } from './termsetting'

/*
--------EXPORTED--------
VocabApi

*/

//type QLst = [Partial<{ nextReuseId?: string }>, ...Q[]]

export type VocabApi = {
	termdbConfig: any
	//Methods
	cacheTermQ: (term: Term, q: Q) => any
	findTerm: (f: string, activeCohort: number, usecase: UseCase, x: string) => { lst: Term[] }
	getCategories: (term: Term, filer: Filter, body?: any) => any
	getCustomTermQLst: (f: Term) => any
	getPercentile: (term_id: string | number, percentile_lst: number[], filter?: Filter) => any
	getterm: (f: any) => Term
	getTermdbConfig: () => any
	getViolinPlotData: (f: any) => void
	uncacheTermQ: (term: Term, q: Q) => any
}
