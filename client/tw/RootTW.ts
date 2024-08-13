import { TermWrapper } from '#types'

export type PartialTW = {
	term: {
		type: 'categorical'
		id: string
		name?: string
		[key: string]: any
	}
	q?: {
		type?: string
		mode?: string
		[key: string]: any
	}
	[key: string]: any
}

export class RootTW {
	static async fill(tw: any /*PartialTW*/): Promise<TermWrapper> {
		if (!tw.q) tw.q = {}
		tw.q.isAtomic = true

		switch (tw.term.type) {
			case 'categorical': {
				const { CategoricalBase } = await import('./CategoricalTW.ts')
				//const twObj = new
				if (!tw.term.id) throw 'missing tw.term.id'
				return await CategoricalBase.fill(tw)
			}
			// case 'integer':
			// case 'float':
			// 	return

			// case 'condition':
			// 	return

			// case 'survival':
			// 	return

			// case 'geneVariant':
			// 	return

			// case 'geneExpression':
			// 	return

			default:
				throw `unrecognized tw.term?.type='${tw.term?.type}'`
		}
	}
}
