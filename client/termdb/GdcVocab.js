import { TermdbVocab } from './TermdbVocab'
import { dofetch3, isInSession } from '../common/dofetch'
import { nonDictionaryTermTypes } from '#shared/termdb.usecase'
import { getNormalRoot } from '#filter'
import { isUsableTerm, graphableTypes } from '#shared/termdb.usecase'

export class GdcVocab extends TermdbVocab {
	async getAnnotatedSampleData(opts, _refs = {}) {
		const filter = getNormalRoot(opts.filter)
		const samples = {}
		const refs = { byTermId: _refs.byTermId || {}, bySampleId: _refs.bySampleId || {} }
		const promises = []
		const samplesToShow = new Set()

		// !!! for testing only !!!
		const alias = {
			ENST00000269305: 'TP53',
			ENST00000297405: 'CSMD3',
			NM_001401501: 'MUC16'
		}

		try {
			const res = await fetch('https:/api.gdc.cancer.gov/ssms', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					accept: 'application/json'
				},
				body: JSON.stringify({
					size: 100000,
					fields:
						'ssm_id,chromosome,start_position,reference_allele,tumor_allele,consequence.transcript.transcript_id,consequence.transcript.consequence_type,consequence.transcript.aa_change,consequence.transcript.gene.symbol,consequence.transcript.is_canonical',
					filters: {
						op: 'and',
						content: [
							{
								op: 'in',
								content: {
									field: 'consequence.transcript.transcript_id',
									value: ['ENST00000269305', 'ENST00000297405', 'NM_001401501']
								}
							}
						]
					}
				})
			}).then(r => r.json())

			console.log(44, res)
			for (const h of res.data.hits) {
				if (!samples[h.id]) samples[h.id] = {}
				for (const c of h.consequence) {
					const gene = c.transcript.gene?.symbol
					if (!gene) continue
					const tw = opts.terms.find(tw => tw.term.name === gene)
					if (!samples[h.id][tw.$id]) samples[h.id][tw.$id] = { key: gene, values: [] }
					samples[h.id][tw.$id].values.push(c.transcript)
				}
			}

			console.log(64, samples, Object.keys(samples).length)

			//const sampleFilter = new RegExp(opts.sampleNameFilter || '.*')
			const data = {
				lst: Object.values(samples),
				refs
			}
			data.samples = data.lst.reduce((obj, row) => {
				obj[row.sample] = row
				return obj
			}, {})

			for (const tw of opts.terms) {
				//mayFillInCategory2samplecount4term(tw, data.lst, this.termdbConfig)
			}
			return data
		} catch (e) {
			throw e
		}
	}
}
