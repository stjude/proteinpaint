import { handler as catHandler } from './tvs.categorical.js'

export const handler = Object.assign({}, catHandler, { type: 'dtsnvindel' })
