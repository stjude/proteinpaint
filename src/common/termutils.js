import { dofetch3 } from '../client'

/*
to retrieve the termjson object of one term, using its id
only works for a termdb-enabled dataset

if the function is attached to an instance with .state{ dslabel, genome }, then simply call:
	await instance.getterm( ? )

otherwise, do:
	await getterm( id, dslabel, genome )

*/

const cache = { serverData: {} }

export async function getterm(termid, dslabel = null, genome = null) {
	if (!termid) throw 'getterm: termid missing'
	if (this && this.state && this.state.vocab) {
		if (this.state.vocab.dslabel) dslabel = this.state.vocab.dslabel
		if (this.state.vocab.genome) genome = this.state.vocab.genome
	}
	if (!dslabel) throw 'getterm: dslabel missing'
	if (!genome) throw 'getterm: genome missing'
	const data = await dofetch3(`termdb?dslabel=${dslabel}&genome=${genome}&gettermbyid=${termid}`)
	if (data.error) throw 'getterm: ' + data.error
	if (!data.term) throw 'no term found for ' + termid
	return data.term
}

const graphableTypes = new Set(['categorical', 'integer', 'float', 'condition'])

// shared in client, server, and tape test
export function graphable(term) {
	if (!term) throw 'graphable: term is missing'
	// term.isgenotype??
	return graphableTypes.has(term.type)
}
