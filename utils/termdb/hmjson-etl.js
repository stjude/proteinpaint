export async function hmjsonETL(study) {
	const { heatmapJSON, annotations } = study
	if (annotations) {
		if (annotations.inputFormat !== 'metadataTsv') {
			const message = `annotations.inputFormat: '${annotations.inputFormat}' is not supported`
			alert(message)
			throw message
		}

		const data = []
		for (const key in annotations.files) {
			const a = await fetch(annotations.files[key]).then(r => r.text())
			heatmapJSON.metadata = addMetadataFromTsv(heatmapJSON, a)
		}
	}
	const terms = getTerms(heatmapJSON.metadata)
	return { terms }
}

export function getTerms(metadata) {
	const terms = []
	for (const t of metadata) {
		const term = {
			id: t.key,
			name: t.label
		}

		if (t.hasOnlyNumericVals) {
			term.type = 'float'
		} else {
			term.type = 'categorical'
		}

		if (t.values) {
			term.values = {}
			for (const key in t.values) {
				term.values[key] = { key }
				if (t.values[key]) term.values[key].color = t.values[key]
			}
		}

		terms.push(term)
	}
	return terms
}

function addMetadataFromTsv(hm, data) {
	const sampleannotation = {}
	const metadata = {}
	const metaOrder = []
	const groups = {}
	const colorFxn = () => '#ccc' //scaleOrdinal(schemeCategory20)
	let header

	const metakeys = {}
	if (hm.metadata)
		hm.metadata.forEach(grp => {
			metakeys[grp.name] = grp.key
		})
	const rows = typeof data == 'string' ? annoFromTsv(data) : data
	rows.forEach(a => {
		if (!a) return
		if (a.group) {
			a.genegrpname = a.group
			if (!metakeys[a.group]) metakeys[a.group] = a.group
		}
		const key = metakeys[a.term] ? metakeys[a.term] : a.term
		a.gene = a.term
		a.anno = a.term

		const m = Array.isArray(hm.metadata) && hm.metadata.find(m => m.key == a.term)
		if (!metadata[a.term]) {
			metaOrder.push(a.term)
			metadata[a.term] = {
				name: a.term,
				setkey: a.group ? metakeys[a.group] : null,
				label: a.term,
				key: key,
				values: {},
				renderAs: a.renderAs,
				colorRange: a.colorRange ? a.colorRange.split(',') : null,
				barh: a.barh,
				sortorder: 'sortorder' in a && !isNaN(a.sortorder) ? +a.sortorder : 0
			}
		}

		if (!groups[a.group]) {
			groups[a.group] = {}
		}
		if (metadata[a.term].renderAs || !metadata[a.term].values[a.value]) {
			if (a.color) {
				metadata[a.term].values[a.value] = a.color
				groups[a.group][a.value] = a.color
			} else if (groups[a.group][a.value]) {
				metadata[a.term].values[a.value] = groups[a.group][a.value]
			} else if (metadata[a.term]) {
				metadata[a.term].values[a.value] = ''
				groups[a.group][a.value] = ''
			}

			if (a.legendorder) {
				if (!metadata[a.term].legendorder) metadata[a.term].legendorder = {}
				metadata[a.term].legendorder[a.value] = +a.legendorder
			}
		}
		a.fill = metadata[a.term].values[a.value] ? metadata[a.term].values[a.value] : ''

		if (!sampleannotation[a.sample]) sampleannotation[a.sample] = {}
		sampleannotation[a.sample][a.term] = a.value
	})

	hm.sampleannotation = sampleannotation

	return Object.values(metadata).sort((a, b) => {
		return (a.sortorder || b.sortorder) && a.sortorder != b.sortorder
			? a.sortorder - b.sortorder
			: metaOrder.indexOf(a.key) - metaOrder.indexOf(b.key)
	})
}

function annoFromTsv(text) {
	return text.split('\n').reduce((data, line) => {
		if (!line) return data
		if (!data.header) data.header = line.split('\t')
		else {
			const vals = line.split('\t')
			const a = {}
			data.header.map((k, j) => {
				if (vals[j] /*|| k!='color'*/) a[k] = vals[j]
				if (k == 'sortorder' && !isNaN(a[k])) {
					// isNaN() will coerce string values to numeric where applicable
					// see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NaN
					a[k] = +a[k]
				}
			})
			data.push(a)
		}
		return data
	}, [])
}
