import { termjson } from '../../test/testdata/termjson.js'

/*
 * Shared mock data for violinBox route tests.
 *
 * Term IDs --------------------------------------------------------------- */

export const mockTerm1$id = 'term1-id'
export const mockTerm2$id = 'term2-id'
export const mockTerm3$id = 'term3-id'
export const mockTermCollectionId = 'tc-id'

export const mockSampleType = 'All samples'

/* Term wrappers ---------------------------------------------------------- */

export const mockTw = { term: termjson.agedx, $id: mockTerm1$id }
export const mockOverlayTw = { term: termjson.sex, $id: mockTerm2$id }

/* Sample sets ------------------------------------------------------------ */

/** Standard 4-sample set with numeric + categorical overlay values. */
export const mockSamples = {
	1: {
		sample: '80',
		[mockTerm1$id]: { key: 5, value: 5 },
		[mockTerm2$id]: { key: 'Male', value: 'M' }
	},
	2: {
		sample: '81',
		[mockTerm1$id]: { key: 10, value: 10 },
		[mockTerm2$id]: { key: 'Female', value: 'F' }
	},
	3: {
		sample: '82',
		[mockTerm1$id]: { key: -3, value: -3 },
		[mockTerm2$id]: { key: 'Female', value: 'F' }
	},
	4: {
		sample: '83',
		[mockTerm1$id]: { key: 0, value: 0 },
		[mockTerm2$id]: { key: 'Male', value: 'M' }
	}
}

/* Data builders ---------------------------------------------------------- */

/** Wrap a samples object in the ValidGetDataResponse-like shape expected by
 *  parseValues, extractNumericValues, etc. */
export function getMockData(samples: Record<string, any>) {
	return {
		refs: { bySampleId: {}, byTermId: {} },
		samples
	} as any
}

/* Numeric termCollection fixtures --------------------------------------- */

export function getMockTermCollectionQ() {
	return {
		tw: {
			$id: mockTermCollectionId,
			term: {
				type: 'termCollection',
				name: 'Drug Sensitivity',
				memberType: 'numeric',
				termlst: [
					{ id: 'drugA', name: 'Drug A' },
					{ id: 'drugB', name: 'Drug B' },
					{ id: 'drugC', name: 'Drug C' }
				],
				propsByTermId: {
					drugA: { color: '#ff0000' },
					drugB: { color: '#00ff00' },
					drugC: { color: '#0000ff' }
				}
			},
			q: { mode: 'continuous' }
		}
	} as any
}

export function getMockTermCollectionData() {
	return getMockData({
		s1: {
			sample: 's1',
			[mockTermCollectionId]: { key: 's1', value: { drugA: 1.5, drugB: 2.5, drugC: 3.5 } }
		},
		s2: {
			sample: 's2',
			[mockTermCollectionId]: { key: 's2', value: { drugA: 4.0, drugB: 5.0, drugC: 6.0 } }
		}
	})
}
