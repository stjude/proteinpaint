import { handler as _handler } from './tvs.dt.js'

/*
TVS handler for dtcnv term (categorical cnv data)
*/

export const handler = Object.assign({}, _handler, { type: 'dtcnv' })
