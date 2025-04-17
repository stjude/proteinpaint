import { handler as snvHandler } from './tvs.dtsnvindel.js'

export const handler = Object.assign({}, snvHandler, { type: 'dtsv' })
