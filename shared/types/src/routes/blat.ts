export type BlatRequest = {
	/** if set, reports the status of the blat server of each genome, and other parameters are ignored */
	serverstat?: string | number
	/** name of a genome that has a blat server */
	genome?: string
	/** dna sequence to align against the genome */
	seq?: string
	/** comma-separated soft-clip start positions of a read, sent by the bam track but not used */
	soft_starts?: string
	/** comma-separated soft-clip stop positions of a read, sent by the bam track but not used */
	soft_stops?: string
}

export type BlatHit = {
	query_match: string
	query_startpos: string
	query_stoppos: string
	query_strand: string
	query_totallen: string
	query_alignlen: string
	ref_chr: string
	ref_startpos: string
	ref_stoppos: string
	ref_alignlen: string
	/** length of the chromosome */
	ref_totallen: string
}

export type BlatResponse = {
	/** for a serverstat request, the status of the blat server of each genome */
	lst?: string[]
	/** alignments sorted by descending query_match */
	hits?: BlatHit[]
	/** set when the sequence has no alignment */
	nohit?: number
	error?: string
}
