import { getData } from './termdb.matrix.js'
import serverconfig from './serverconfig.js'
import { authApi } from './auth.js'
import { Readable, pipeline } from 'stream'
import zlib from 'zlib'

// based on a 64-bit hard constraint in V8 for string processing
const maxStrLength = 5.12e8 - 1e5 // subtract 100KB for error message, etc

// if '$' exists as a data object property, it indicates stripped properties
// that should be rehydrated on the client side
const $codes = Object.freeze({
	// Below are data object properties that have the same strict value as another object property.
	// The server will strip these object properties, and the client will rehydrate by copying from
	// another property based such as `dataObj.key`.
	copyAs: Object.freeze({
		1: 'value',
		2: 'label'
	}),
	// Below are object properties that need to be merged/applied back to a dehydrated data object.
	// All the keys from a corresponding code object below will be deleted by the server.
	objAssign: Object.freeze({
		// will freeze these when generating $objAssign helper object below
		1: { class: 'Blank', label: 'Not tested' },
		2: { class: 'Blank', label: 'Not tested', origin: 'germline' },
		3: { class: 'Blank', label: 'Not tested', origin: 'somatic' },
		4: { class: 'WT', label: 'Wildtype' },
		5: { class: 'WT', label: 'Wildtype', origin: 'germline' },
		6: { class: 'WT', label: 'Wildtype', origin: 'somatic' }
	})
})

// below creates an easy way to easily detect copyable data properties
// should look like [[1, 'value'], [2, 'label']]
const $copyAs = Object.freeze(Object.entries($codes.copyAs).map(c => Object.freeze([parseInt(c[0]), c[1]])))

// below is a helper object to quickly find a matching $code for geneVariant data values
// should look like {
//   Blank: {
//     '': 1,
//     germline: 2,
//     somatic: 3
//   },
//   WT: {
//     '': 4,
//     germline: 5,
//     somatic: 6
//   }
// }
// not hardcoding, but basing off refs.$codes.objAssign entry to guarantee correct mapping
const $objAssign = {}
for (const [code, m] of Object.entries($codes.objAssign)) {
	Object.freeze(m)
	if (!$objAssign[m.class]) $objAssign[m.class] = {}
	$objAssign[m.class][m.origin || ''] = parseInt(code)
}
Object.freeze($objAssign)

export async function get_matrix(q, req, res, ds, genome) {
	if (q.getPlotDataByName) {
		// send back the config for premade matrix plot
		if (!ds.cohort?.matrixplots?.plots) throw 'ds.cohort.matrixplots.plots missing for the dataset'
		const plot = ds.cohort.matrixplots.plots.find(p => p.name === q.getPlotDataByName)
		if (!plot) throw 'invalid name of premade matrix plot' // invalid name could be attack string, avoid returning it so it won't be printed in html
		res.send(plot.matrixConfig)
		return
	}
	const data = await getData(q, ds, true) // FIXME hardcoded to true
	if (data.error) {
		console.trace(data)
		res.send({ error: data.error })
		return
	}
	data.refs.$codes = $codes
	if (!data.refs.byTermId) data.refs.byTermId = {}

	const payload = {
		samples: [],
		refs: {
			byTermId: [],
			bySampleId: []
		}
	}

	const sampleEntries = Object.entries(data.samples || {})
	const unsentSampleIds = new Set()

	const lastSampleId = sampleEntries.slice(-1)[0][0]
	debugLog('lastSampleId=', lastSampleId)

	let hasStarted = false
	const jsonStream = new Readable({
		read() {
			debugLog('unsentSampleIds.size=', unsentSampleIds.size)
			if (!hasStarted) {
				hasStarted = true
				this.push(`{"samples":{`)
			}
			for (const id of unsentSampleIds) {
				const endChar = id === lastSampleId ? '}' : ','
				const str = JSON.stringify(id) + ':' + JSON.stringify(data.samples[id]) + endChar
				this.push(str)
				if (endChar == '}') {
					this.push(`,"refs":` + JSON.stringify(data.refs) + '}')
					unsentSampleIds.clear()
					this.push(null)
					return
				}
			}
			unsentSampleIds.clear()
		}
	})

	res.setHeader('Content-Type', 'application/json')
	res.setHeader('Content-Encoding', 'gzip')
	res.status(200)

	let jsonStrlen = 0,
		currShortId = 1,
		sampleIndex = 1

	if (authApi.canDisplaySampleIds(req, ds) && sampleEntries.length) {
		const { byTermId, bySampleId } = data.refs

		for (const [sampleId, sample] of sampleEntries) {
			if (!bySampleId[sampleId]) bySampleId[sampleId] = {}
			const s = bySampleId[sampleId]
			if (!s.sample) s.sample = sample.sample
			if (!s.sampleName) s.sampleName = sample.sampleName
			delete sample.sample
			delete sample.sampleName

			for (const [termId, d] of Object.entries(sample)) {
				if (!byTermId[termId]?.shortId) {
					if (!byTermId[termId]) byTermId[termId] = {}
					byTermId[termId].shortId = currShortId++
					const gene = d.values?.[0]?.gene
					if (gene) byTermId[termId].gene = gene
				}

				delete d._SAMPLEID_ // not needed in client code
				if (d.key) {
					for (const c of $copyAs) {
						if (d.key !== d[c[1]]) continue
						delete d[c[1]] // can be copied as data[refs.$codes.copyAs[d.$]] = d.key
						d.$ = c[0]
					}
				}

				const { shortId, gene } = byTermId[termId]
				// termId can be very long and repeated across all samples,
				// use the shortId to lessen memory use
				sample[shortId] = sample[termId]
				delete sample[termId]

				if (gene && d.values) {
					for (const v of d.values) {
						delete v._SAMPLEID_
						const code = v.dt && $objAssign[v.class]?.[v.origin || '']
						if (!code) continue
						v.$ = code
						// this can be rehydrated from refs.byTermId[tw.$id].gene
						delete v.gene
						// these props can be rehydrated from refs.$codes.objAssign[code]
						delete v.class
						delete v.label
						delete v.origin
					}
				}
			}

			//if (exceedsMaxLen(sampleId, sample, payload.samples)) break
			sampleIndex++
			if (Object.keys(sample).length) unsentSampleIds.add(sampleId)
		}
	}

	try {
		debugLog('get_matrix() jsonStrlen=', jsonStrlen)
		pipeline(jsonStream, zlib.createGzip(), res, err => {
			if (err) {
				console.error('Pipeline failed.', err)
				// If headers haven't been sent, we can send a 500 error
				if (!res.headersSent) {
					res.status(500).send(err)
				}
			} else {
				console.log('Pipeline succeeded.')
				res.end()
			}
		})
	} catch (e) {
		console.log(e)
		if (e instanceof RangeError && e.message.includes('Invalid string length')) {
			// create a more informative error message for end user
			payload.error = {
				code: 'RangeError: Invalid string length',
				message: getRangeErrorMessage(sampleEntries.length, sampleIndex),
				jsonStrlen
			}
			payload.samples = {}
			res.send(payload)
		} else {
			res.send({ error: e })
		}
	}
}

function getRangeErrorMessage(totalSamples, sampleIndex) {
	let message = `Response data too large - please narrow the cohort or limit the number of variables and/or genes.`
	message += `(Unable to encode data for ${totalSamples - sampleIndex} of ${totalSamples} cases/samples.)`
	return message
}

function debugLog() {
	if (serverconfig.debugmode) console.log(...arguments)
}
