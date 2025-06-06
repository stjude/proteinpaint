import { niceNumLabels } from '../dom/niceNumLabels.ts'
import { convertUnits } from '#shared/helpers.js'
import { dtTerms } from '#shared/common.js'

/*
try to provide a meaningful name based on filter content; 
when filter is single-tvs, return a human-readable label.
when there's >=2 tvs, which is hard to summarize, return `Filter (n)` and give up

not specific to mds3, can move to client/filter/ or shared/
*/

export function getFilterName(f) {
	if (!Array.isArray(f?.lst)) return 'Invalid filter'
	// for a ds using subcohorts, a filter may contain cohort tvs and is not informative to display. thus derive new tvs array by skipping it
	const lst = f.lst.filter(i => i.tag != 'cohortFilter')
	if (lst.length == 0) return 'No filter' // this is possible when user has deleted the only tvs

	if (lst.length == 1 && lst[0].type == 'tvs') {
		// has only one tvs
		const tvs = lst[0].tvs
		if (!tvs) throw 'f.lst[0].tvs{} missing'

		switch (tvs?.term?.type) {
			case 'categorical':
				if (!Array.isArray(tvs.values)) throw 'f.lst[0].tvs.values not array'

				// only assess 1st category name; only use for display, not computing
				const catKey = tvs.values[0]?.key
				if (catKey == undefined) throw 'f.lst[0].tvs.values[0].key missing'
				const catValue = tvs.term.values?.[catKey]?.label || catKey

				if (tvs.values.length == 1) {
					// tvs uses only 1 category
					if ((tvs.term.name + catValue).length < 20) {
						// term name plus category value has short length, show both
						return tvs.term.name + (tvs.isnot ? '!=' : ': ') + catValue
					}
					// only show cat value
					return (tvs.isnot ? '!' : '') + (catValue.length < 15 ? catValue : catValue.substring(0, 13) + '...')
				}
				// tvs uses more than 1 category, set label as "catValue (3)"
				return `${tvs.isnot ? '!' : ''}${catValue.length < 12 ? catValue : catValue.substring(0, 10) + '...'} (${
					tvs.values.length
				})`
			case 'integer':
			case 'float':
			case 'geneExpression':
			case 'metaboliteIntensity':
				// tvs is numeric, show numeric range
				return getNumericRangeLabel(tvs)
			case 'samplelst':
				// XXX quick fix! only uses first key in tvs.term.values{}
				return Object.keys(tvs.term.values)[0]
			default:
				// after exhausting above term types, find a match from dtTerms[]; this avoids repeating them in many "case" statements
				for (const dtt of dtTerms) {
					if (dtt.type == tvs.term.type) {
						return (tvs.term.parentTerm?.name || '?') + ' ' + dtt.name
					}
				}
				throw 'unknown tvs term type'
		}
	}
	// more than 1 tvs, not able to generate a short name
	// TODO count total tvs from nested list
	return 'Filter (' + lst.length + ')'
}

/*
tvs={ranges:[], term:{type}}
only generate label with first range. if multiple, simply append '...' to indicate such
label is always show as A<x<B
where "x" represents the variable, no matter term type. using "AKT1 expresion" can be too long
if needed e.g. has enough space in another setting, can allow replacing "x" with entity name based on term type
*/
function getNumericRangeLabel(tvs) {
	if (!Array.isArray(tvs.ranges)) throw 'tvs.ranges not array'
	if (!tvs.ranges[0]) throw 'tvs.ranges[] blank array'

	const r = tvs.ranges[0]

	let startName, stopName // logic to compute print name and use if needed
	const vc = tvs.term.valueConversion
	if (vc) {
		if ('start' in r) startName = convertUnits(r.start, vc.fromUnit, vc.toUnit, vc.scaleFactor, true)
		if ('stop' in r) stopName = convertUnits(r.stop, vc.fromUnit, vc.toUnit, vc.scaleFactor, true)
	} else {
		// no conversion, show numeric values
		if (tvs.term.type == 'integer') {
			// integer term, round to integer
			if ('start' in r) startName = Math.round(r.start)
			if ('stop' in r) stopName = Math.round(r.stop)
		} else {
			// not integer, then must be float, including geneExpression etc.
			if ('start' in r) startName = r.start
			if ('stop' in r) stopName = r.stop

			if ('start' in r && 'stop' in r) {
				// range has both start/stop, can apply nice label
				;[startName, stopName] = niceNumLabels([startName, stopName])
			}
		}
	}

	let label
	if (tvs.isnot) {
		if (r.startunbounded) label = `x ${r.stopinclusive ? '>' : '>='} ${stopName}`
		else if (r.stopunbounded) label = `x ${r.startinclusive ? '<' : '<='} ${startName}`
		else label = `!(${startName} ${stopName})`
	} else {
		if (r.startunbounded) label = `x ${r.stopinclusive ? '<=' : '<'} ${stopName}`
		else if (r.stopunbounded) label = `x ${r.startinclusive ? '>=' : '>'} ${startName}`
		else label = `${startName}${r.startinclusive ? '<=' : '<'}x${r.stopinclusive ? '<=' : '<'}${stopName}`
	}
	if (tvs.ranges.length > 1) label += '...' // quick way to indicate there're more
	return label
}
