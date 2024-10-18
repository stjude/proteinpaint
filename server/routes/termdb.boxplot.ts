import type { BoxPlotRequest, BoxPlotResponse } from '#types'
import { getData } from '../src/termdb.matrix.js'
// import { boxplot_getvalue } from '../src/utils'

export const api: any = {
	endpoint: 'termdb/boxplot',
	methods: {
		all: {
			init,
			request: {
				typeId: 'BoxplotRequest'
			},
			response: {
				typeId: 'BoxplotResponse'
			},
			examples: []
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any) => {
		const q = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid ds'

			const data = await getData(
				{
					filter: q.filter,
					filter0: q.filter0,
					terms: [q.tw]
				},
				ds,
				genome
			)
			if (data.error) throw data.error

			const sampleType = `All ${data.sampleType?.plural_name || 'samples'}`
			const key2values = new Map()
			const overlayTerm = q.divideTw
			for (const [key, val] of Object.entries(data.samples as Record<string, any>)) {
				//if there is no value for term then skip that.
				const value = val[q.tw.$id]
				if (!Number.isFinite(value?.value)) continue

				if (overlayTerm) {
					if (!val[overlayTerm?.$id]) continue
					const value2 = val[overlayTerm.$id]
					if (overlayTerm.term?.values?.[value2.key]?.uncomputable) {
						// const label = overlayTerm.term.values[value2?.key]?.label
					}

					if (!key2values.has(value2.key)) key2values.set(value2.key, [])
					key2values.get(value2.key).push(value.value)
				} else {
					if (!key2values.has(sampleType)) key2values.set(sampleType, [])
					key2values.get(sampleType).push(value.value)
				}
			}

			const plots: any = []
			for (const [key, values] of sortKey2values(data, key2values, overlayTerm)) {
				if (overlayTerm) {
					plots.push({
						label: overlayTerm?.term?.values?.[key]?.label || key,
						values,
						seriesId: key,
						color: overlayTerm?.term?.values?.[key]?.color || null
					})
				} else {
					const plot = {
						label: sampleType,
						values,
						plotValueCount: values.length
					}
					plots.push(plot)
				}
			}
			data.plots = plots
			res.send(data)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

function sortKey2values(data, key2values, overlayTerm) {
	const orderedLabels = data.refs.byTermId[overlayTerm?.$id]?.keyOrder

	key2values = new Map(
		[...key2values].sort(
			orderedLabels
				? (a, b) => orderedLabels.indexOf(a[0]) - orderedLabels.indexOf(b[0])
				: overlayTerm?.term?.type === 'categorical'
				? (a, b) => b[1].length - a[1].length
				: overlayTerm?.term?.type === 'condition'
				? (a, b) => a[0] - b[0]
				: (a, b) =>
						a
							.toString()
							.replace(/[^a-zA-Z0-9<]/g, '')
							.localeCompare(b.toString().replace(/[^a-zA-Z0-9<]/g, ''), undefined, { numeric: true })
		)
	)
	return key2values
}
