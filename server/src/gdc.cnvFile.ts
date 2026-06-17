import * as common from '#shared/common.js'

/** A parsed GDC CNV segment (mlst entry). Loosely typed (`any`-compatible) to match the rest of the
 * mlst pipeline; `valueType` declares how `value` is quantified so downstream consumers (e.g. GRIN2
 * filterAndConvertCnv) classify it correctly even when a cohort mixes sources. */
export type GdcCnvEntry = {
	dt: number
	chr: string
	start: number
	stop: number
	value?: number
	valueType?: 'segmean' | 'copyNumber'
	segmean?: number
}

/**
 * Parse the text content of a GDC CNV file into mlst entries. GDC ships two header formats; we detect
 * by the header line:
 *  - Segment_Mean (genotyping array): `value` is a log2 ratio (diploid baseline 0) → valueType 'segmean'
 *  - Copy_Number/Major/Minor (WGS allele-specific): `value` is total integer copy number (baseline 2)
 *    → valueType 'copyNumber'; additionally emits a dtloh entry when minor==0 && major>0.
 *
 * Pure (no network) so it can be reused and unit-tested against fixture files. The network fetch lives
 * in mds3.gdc.js loadCnvFile(), which delegates here.
 */
export function parseGdcCnvFile(content: string): GdcCnvEntry[] {
	const lines = content.trim().split('\n')
	const mlst: GdcCnvEntry[] = []
	switch (lines[0]) {
		case 'GDC_Aliquot_ID\tChromosome\tStart\tEnd\tNum_Probes\tSegment_Mean':
		case 'GDC_Aliquot\tChromosome\tStart\tEnd\tNum_Probes\tSegment_Mean':
			for (let i = 1; i < lines.length; i++) {
				const l = lines[i].split('\t')
				if (l.length != 6) throw 'cnv file line not 6 columns: ' + l
				if (!l[1]) throw 'cnv file line missing chr: ' + l
				let chr = l[1]
				if (!l[1].startsWith('chr')) chr = 'chr' + l[1] // snp file chr doesn't start with "chr"
				const cnv: GdcCnvEntry = {
					dt: common.dtcnv,
					chr,
					start: Number(l[2]),
					stop: Number(l[3]),
					value: Number(l[5]),
					// Segment_Mean is a log2 ratio (diploid baseline 0); tag so downstream consumers
					// (e.g. GRIN2 filterAndConvertCnv) classify it correctly even in a mixed cohort
					valueType: 'segmean'
				}
				if (Number.isNaN(cnv.start) || Number.isNaN(cnv.stop) || Number.isNaN(cnv.value))
					throw 'start/stop/value not a number in cnv file: ' + l
				mlst.push(cnv)
			}
			break
		case 'GDC_Aliquot\tChromosome\tStart\tEnd\tCopy_Number\tMajor_Copy_Number\tMinor_Copy_Number':
			for (let i = 1; i < lines.length; i++) {
				const l = lines[i].split('\t')
				if (l.length != 7) continue
				const total = Number(l[4]),
					major = Number(l[5]),
					minor = Number(l[6])
				if (Number.isNaN(total) || Number.isNaN(major) || Number.isNaN(minor)) continue
				const cnv: GdcCnvEntry = {
					dt: common.dtcnv,
					chr: l[1],
					start: Number(l[2]),
					stop: Number(l[3]),
					value: total,
					// total is an absolute integer copy number (diploid baseline 2); tag so downstream
					// consumers classify it with copy-number semantics rather than log2-ratio
					valueType: 'copyNumber'
				}
				if (!cnv.chr || Number.isNaN(cnv.start) || Number.isNaN(cnv.stop)) continue
				mlst.push(cnv)

				if (total > 0) {
					// total copy number is >0, detect loh
					if (minor == 0 && major > 0) {
						// zhenyu 4/25/23 detect strict one allele loss
						mlst.push({
							dt: common.dtloh,
							chr: cnv.chr,
							start: cnv.start,
							stop: cnv.stop,
							// hardcode a value for plot to work.
							// may make "segmean" value optional; if missing, indicates quanlitative event and should plot without color shading
							// otherwise, the value quantifies allelic imbalance and is plotted with color shading
							// all loh events in a plot should be uniformlly quanlitative or quantitative
							segmean: 0.5
						})
					}
				}
			}
			break
		default:
			throw 'unknown CNV file header line: ' + lines[0]
	}
	return mlst
}
