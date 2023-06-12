import { Tvs } from './filter'

interface TermObj {
    id: string | number, 
    type?: string,
    min?: number,
    max?: number
    tvs: Tvs
}

export interface Term {
    term: TermObj
    q: any
}