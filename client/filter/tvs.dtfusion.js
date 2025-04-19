import { handler as dtHandler } from './tvs.dt.js'

/*
TVS handler for dtfusion term
*/

export const handler = Object.assign({}, dtHandler, { type: 'dtfusion' })
