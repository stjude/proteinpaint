/*
The MSigDB release that a GSEA or ORA plot runs on, chosen from the genome's gene set dbs (genome.termdbs
entries with a .release, see server/genome/hg38.base.ts). The server uses termdbs.msigdb, the current
release, when a request names none.

A plot records its release in its settings (msigdbRelease), so that a saved session reopens on the release
it was made with. Plots saved before releases were recorded have none; they ran on LEGACY_MSIGDB_RELEASE.
*/

/** the release that GSEA and ORA ran on before plots recorded one */
export const LEGACY_MSIGDB_RELEASE = '2023.2.Hs'

type Genome = { termdbs?: { [key: string]: { release?: string } } }

/** releases the genome offers, the current one first, as options for a dropdown */
export function msigdbReleaseOptions(genome?: Genome): { label: string; value: string }[] {
	const current = currentMsigdbRelease(genome)
	const releases = Object.values(genome?.termdbs || {})
		.map(t => t.release)
		.filter((r): r is string => !!r)
		.sort((a, b) => (a == current ? -1 : b == current ? 1 : b.localeCompare(a)))
	return releases.map(r => ({ label: r == current ? `${r} (current)` : r, value: r }))
}

export function currentMsigdbRelease(genome?: Genome): string | undefined {
	return genome?.termdbs?.msigdb?.release
}

/**
 * The release for a GSEA or ORA plot config.
 * saved: the plot's settings when getPlotConfig() restores a saved session, undefined for a new plot.
 * A new plot gets the current release. A restored plot keeps the release it recorded; one saved before
 * plots recorded a release gets LEGACY_MSIGDB_RELEASE, or the current release if the genome lacks it.
 */
export function plotMsigdbRelease(genome: Genome | undefined, saved?: { msigdbRelease?: string }): string | undefined {
	if (saved?.msigdbRelease) return saved.msigdbRelease
	const current = currentMsigdbRelease(genome)
	if (!saved) return current
	return msigdbReleaseOptions(genome).some(o => o.value == LEGACY_MSIGDB_RELEASE) ? LEGACY_MSIGDB_RELEASE : current
}
