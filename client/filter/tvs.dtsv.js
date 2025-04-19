import { handler as dtHandler } from './tvs.dt.js'

/*
TVS handler for dtsv term
*/

export const handler = Object.assign({}, dtHandler, { type: 'dtsv' })
