const jStat = require('jStat').jStat
const utils = require('./utils')
const bamcommon = require('./bam.common')

export async function match_complexvariant(templates, q) {
	// TODO
	// get flanking sequence, suppose that segments are of same length, use segment length
	const segbplen = templates[0].segments[0].seq.length
	// need to verify if the retrieved sequence is showing 1bp offset or not
	const leftflankseq = (await utils.get_fasta(
		q.genome,
		q.variant.chr + ':' + (q.variant.pos - segbplen) + '-' + q.variant.pos
	))
		.split('\n')
		.slice(1)
		.join('')
		.toUpperCase()
	const rightflankseq = (await utils.get_fasta(
		q.genome,
		q.variant.chr +
			':' +
			(q.variant.pos + q.variant.ref.length + 1) +
			'-' +
			(q.variant.pos + segbplen + q.variant.ref.length + 1)
	))
		.split('\n')
		.slice(1)
		.join('')
		.toUpperCase()
	console.log(q.variant.chr + '.' + q.variant.pos + '.' + q.variant.ref + '.' + q.variant.alt)
	console.log('refSeq', leftflankseq + q.variant.ref + rightflankseq)
	console.log('mutSeq', leftflankseq + q.variant.alt + rightflankseq)

	const refallele = q.variant.ref.toUpperCase()
	const altallele = q.variant.alt.toUpperCase()

	const refseq = leftflankseq + refallele + rightflankseq
	const altseq = leftflankseq + altallele + rightflankseq

	// console.log(refallele,altallele,refseq,altseq)
	const kmer_length = 10 // length of kmer
	const percentile_cutoff = 0.75 // Difference in jaccard similarity betwen reference and alternate allele
	const ref_kmers = build_kmers(refseq, kmer_length)
	const alt_kmers = build_kmers(altseq, kmer_length)

	//console.log(ref_kmers)
	//console.log(alt_kmers)

	const ref_comparisons = []
	const alt_comparisons = []
	const refaltstatus = []
	for (const template of templates) {
		const read_seq = template.segments[0].seq
		// let cigar_seq = template.segments[0].cigarstr
		const read_kmers = build_kmers(read_seq, kmer_length)
		const ref_comparison = jaccard_similarity(read_kmers, ref_kmers)
		const alt_comparison = jaccard_similarity(read_kmers, alt_kmers)
		// console.log("Iteration:",k,read_seq,cigar_seq,ref_comparison,alt_comparison,read_seq.length,refseq.length,altseq.length,read_kmers.length,ref_kmers.length,alt_kmers.length)
		const diff_score = alt_comparison - ref_comparison
		if (diff_score < 0) {
			ref_comparisons.push(diff_score)
			refaltstatus.push('ref')
		} else {
			if (diff_score >= 0) {
				alt_comparisons.push(diff_score)
				refaltstatus.push('alt')
			}
		}
	}
	const ref_cutoff = jStat.percentile(ref_comparisons, percentile_cutoff)
	const alt_cutoff = jStat.percentile(alt_comparisons, 1 - percentile_cutoff)
	// console.log(alt_comparisons)
	console.log('Reference cutoff:', ref_cutoff)
	console.log('Alternate cutoff:', alt_cutoff)

	let i = 0
	let j = 0
	let k = 0
	const type2group = bamcommon.make_type2group(q)
	for (const refalt of refaltstatus) {
		if (refalt == 'ref') {
			if (ref_comparisons[j] <= ref_cutoff) {
				// Label read as reference allele
				type2group[bamcommon.type_supportref].templates.push(templates[i])
			} else {
				// Label read as none
				type2group[bamcommon.type_supportno].templates.push(templates[i])
			}
			j++
		}

		if (refalt == 'alt') {
			if (alt_comparisons[k] >= alt_cutoff) {
				// Label read as alternate allele
				type2group[bamcommon.type_supportalt].templates.push(templates[i])
			} else {
				// Label read as none
				type2group[bamcommon.type_supportno].templates.push(templates[i])
			}
			k++
		}
		i++
	}

	const groups = []
	for (const k in type2group) {
		const g = type2group[k]
		if (g.templates.length == 0) continue // empty group, do not include
		g.messagerows.push({
			h: 15,
			t:
				g.templates.length +
				' reads supporting ' +
				(k == bamcommon.type_supportref
					? 'reference allele'
					: k == bamcommon.type_supportalt
					? 'mutant allele'
					: 'neither reference or mutant alleles')
		})
		groups.push(g)
	}
	return groups
}

function build_kmers(sequence, kmer_length) {
	const num_iterations = sequence.length - kmer_length + 1
	// console.log(sequence)

	let kmers = []
	for (let i = 0; i < num_iterations; i++) {
		let subseq = sequence.substr(i, kmer_length)
		// console.log(i,kmer)
		// console.log(subseq)
		kmers.push(subseq)
	}
	const kmers_nodups = new Set(kmers)
	return kmers_nodups
}

function jaccard_similarity(kmers1_nodups, kmers2_nodups) {
	const intersection = new Set([...kmers1_nodups].filter(i => kmers2_nodups.has(i)))
	const all_kmers = new Set([...kmers1_nodups, ...kmers2_nodups])
	return intersection.size / all_kmers.size
}
