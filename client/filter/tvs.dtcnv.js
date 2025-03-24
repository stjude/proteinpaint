import { handler as catHandler } from './tvs.categorical.js'

/*
TODO: add support for continuous CNV data
*/

export const handler = Object.assign({}, catHandler, { type: 'dtcnv' })
