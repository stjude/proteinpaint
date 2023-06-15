import { Term } from './termdb'

/*
--------EXPORTED--------
VocabApi

*/

export interface VocabApi {
    getterm: (f: any) => Term
}