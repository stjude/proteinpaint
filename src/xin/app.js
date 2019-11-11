import * as rx from '../common/rx.core'
import { termsettingInit } from './termsetting'

export function init(opts) {
	let term
	termsettingInit(null, {
		holder: opts.holder,
		callbacks: {
			termChanged: term => {
				console.log('term is', term)
			}
		}
	})
}
