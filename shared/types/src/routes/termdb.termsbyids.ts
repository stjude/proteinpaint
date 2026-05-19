import type { TermWrapper } from '../terms/tw.ts'

export type TermsByIdsRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	/** term id string */
	ids: string[]
}

export type TermsByIdsResponse = {
	terms: { [id: string]: TermWrapper }
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
