/********* driver knowledge base ********

The rules by which the server tags the driver events of a sample (server/src/driverRank/), from the kb files
in server/genome/driverKb/ (see the README there), as changed by a dataset's ds.driverKb.

--------EXPORTED--------
DriverRuleKind
DriverTag
GenomeDriverKb
DriverKbMatch
DriverKbOverlay
DriverRankInfo
DriverKbSource

*/

/** the alteration that a kb rule matches; enhancer: a gain of a noncoding locus that activates the gene */
export type DriverRuleKind =
	| 'snv'
	| 'fs'
	| 'inframe'
	| 'exon'
	| 'gene'
	| 'fusion'
	| 'sv'
	| 'itd'
	| 'amp'
	| 'del'
	| 'deepDel'
	| 'enhancer'

/** genome.driverKb: the kb of a genome */
export type GenomeDriverKb = {
	/** path of the index.json of the kb, relative to the server dir unless absolute */
	file: string
	/** the genome build, e.g. hg38, whose coordinates of enhancer rules (their region column) the genome uses */
	build: string
}

/** the driver tag of an event of a sample, as event.driver */
export type DriverTag = {
	/** 1: a known driver alteration; 2: a likely driver */
	tier: 1 | 2
	/** the kind of the best rule that matched */
	reason: DriverRuleKind
	/** the genes of the matched rules, e.g. FLT3 for an itd event that names no gene */
	genes: string[]
	/** the ids of the matched rules, best first, e.g. 'hotspots:KRAS:G12' */
	ruleIds: string[]
	/** the ids of the kb sources of the matched rules */
	sources: string[]
	/** the locus of an enhancer rule, when that is the best rule, e.g. N-Me of a MYC enhancer gain */
	locus?: string
}

/** the matching parameters of a kb, from its index.json */
export type DriverKbMatch = {
	fusion: {
		/** whether geneA of a fusion event is the 5' gene, which a wildcard rule such as KMT2A::* needs */
		geneAIs5prime: boolean
	}
	sv: {
		/** the tier of a wildcard fusion rule that matches an event of unknown orientation, such as an sv */
		wildcardTier: 1 | 2
	}
	cnv: {
		/** the longest cnv segment, in bp, that a cnv rule matches */
		focalMaxLength: number
		/** the cnv value thresholds of each value type (ds.queries.cnv.type, or the valueType of an event):
		amp, and gain below amp, at or above; del and deepDel at or below; a 'category' event is called by its
		class. Only enhancer rules use gain; without it, they match an amp only */
		calls: { [valueType: string]: { amp: number; gain?: number; del: number; deepDel: number } }
	}
	hypermutated: {
		/** above this number of snvindel events in a sample, its tier 2 snvindel rules do not count */
		minSnvindel: number
	}
}

/** the changes of a dataset to the kb of its genome */
export type DriverKbOverlay = {
	/** a file under tpmasterdir, in the format of the kb files, whose rule ids start with 'ds:' */
	file?: string
	/** rule ids (e.g. 'civic:12') or source ids (e.g. 'civic') to leave out */
	disable?: string[]
	/** changes to the matching parameters of the genome kb */
	match?: {
		fusion?: Partial<DriverKbMatch['fusion']>
		sv?: Partial<DriverKbMatch['sv']>
		cnv?: {
			focalMaxLength?: number
			calls?: { [valueType: string]: Partial<DriverKbMatch['cnv']['calls'][string]> }
		}
		hypermutated?: Partial<DriverKbMatch['hypermutated']>
	}
}

/** a source of kb rules, for the attribution that a view of driver events shows */
export type DriverKbSource = {
	id: string
	label: string
	license: string
	licenseUrl?: string
	url?: string
	attribution?: string
}

/** what a response with driver tags says about the ranking */
export type DriverRankInfo = {
	/** a hash of the kb files and dataset changes */
	kbVersion: string
	/** the sources of the rules that matched the events of the response */
	sources: DriverKbSource[]
	/** present when the sample has more snvindel events than the kb's hypermutated.minSnvindel */
	hypermutated?: { snvindelCount: number; threshold: number }
}
