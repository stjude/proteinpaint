import type { TermWrapper } from '../terms/tw.ts'

export type gettermsbyidsRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	/** term id string */
	ids: string[]
}

export type gettermsbyidsResponse = {
	terms: { [id: string]: TermWrapper }
}
