export function first_genetrack_tolist(genome, lst) {
	if (!genome.tracks) return
	for (const t of genome.tracks) {
		if (t.__isgene) {
			lst.push(t)
			return
		}
	}
}
