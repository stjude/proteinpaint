export type TermChildrenRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder?: string
	/** parent term id; when missing, the dataset's root terms are returned */
	tid?: string
	cohortValues?: string
	treeFilter?: string
}

interface Entries {
	name: string
	id: string
	isleaf: boolean
	included_types: string[]
	child_types: string[]
}

export type TermChildrenResponse = {
	lst: Entries[]
}

export const termChildrenPayloadExamples = {
	request: {
		typeId: 'TermChildrenRequest'
	},
	response: {
		typeId: 'TermChildrenResponse'
	},
	examples: [
		{
			request: {
				body: {
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					embedder: 'localhost',
					cohortValues: 'ABC',
					tid: 'GO:0000001'
				} satisfies TermChildrenRequest
			},
			response: {
				header: { status: 200 }
			}
		},
		{
			// root terms
			request: {
				body: {
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					embedder: 'localhost',
					cohortValues: 'ABC'
				} satisfies TermChildrenRequest
			},
			response: {
				header: { status: 200 }
			}
		}
	]
}
