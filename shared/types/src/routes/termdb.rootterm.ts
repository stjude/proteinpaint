export type RootTermRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	default_rootterm: number
	cohortValues: string
	treeFilter: string
}

interface Entries {
	name: string
	id: string
	isleaf: boolean
	included_types: string[]
	child_types: string[]
}

export type RootTermResponse = {
	lst: Entries[]
}

export const rootTermPayloadExamples = {
	request: {
		typeId: 'RootTermRequest'
	},
	response: {
		typeId: 'RootTermResponse'
	},
	examples: [
		{
			request: {
				body: {
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					embedder: 'localhost',
					default_rootterm: 1,
					cohortValues: 'ABC'
				} // satisfies RootTermRequest // TODO: enable type check
			},
			response: {
				header: { status: 200 }
			}
		}
	]
}
