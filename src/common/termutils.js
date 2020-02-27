import { dofetch2 } from '../client'

/*
to retrieve the termjson object of one term, using its id
only works for a termdb-enabled dataset

if the function is attached to an instance with .state{ dslabel, genome }, then simply call:
	await instance.getterm( ? )

otherwise, do:
	await getterm( id, dslabel, genome )

*/

const cache = { serverData: {} }

exports.getterm = async function(termid, dslabel = null, genome = null) {
	if (!termid) throw 'getterm: termid missing'
	if (this && this.state) {
		if (this.state.dslabel) dslabel = this.state.dslabel
		if (this.state.genome) genome = this.state.genome
	}
	if (!dslabel) throw 'getterm: dslabel missing'
	if (!genome) throw 'getterm: genome missing'
	const data = await dofetch2(`termdb?dslabel=${dslabel}&genome=${genome}&gettermbyid=${termid}`, {}, cache)
	if (data.error) throw 'getterm: ' + data.error
	if (!data.term) throw 'no term found for ' + termid
	return data.term
}

const graphableTypes = new Set(['categorical', 'integer', 'float', 'condition'])

// shared in client, server, and tape test
exports.graphable = function(term) {
	if (!term) throw 'graphable: term is missing'
	// term.isgenotype??
	return graphableTypes.has(term.type)
}
