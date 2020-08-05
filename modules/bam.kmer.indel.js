// const jStat = require('jStat').jStat
const utils = require('./utils')
const bamcommon = require('./bam.common')
const fs = require('fs')

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

	const ref_kmers = build_kmers(refseq, kmer_length)
	const alt_kmers = build_kmers(altseq, kmer_length)

	const ref_kmers_nodups = new Set(ref_kmers)
	const alt_kmers_nodups = new Set(alt_kmers)
	//console.log(ref_kmers)
	//console.log(alt_kmers)

	let kmer_diff_scores = []
	for (const template of templates) {
		const read_seq = template.segments[0].seq
		// let cigar_seq = template.segments[0].cigarstr
		const read_kmers = build_kmers(read_seq, kmer_length)
		const ref_comparison = jaccard_similarity(read_kmers, ref_kmers, ref_kmers_nodups)
		const alt_comparison = jaccard_similarity(read_kmers, alt_kmers, alt_kmers_nodups)
		// console.log("Iteration:",k,read_seq,cigar_seq,ref_comparison,alt_comparison,read_seq.length,refseq.length,altseq.length,read_kmers.length,ref_kmers.length,alt_kmers.length)
		const diff_score = alt_comparison - ref_comparison
		kmer_diff_scores.push(diff_score)
	}
	//console.log("Original array:",kmer_diff_scores)
	let kmer_diff_scores_asc = [...kmer_diff_scores]

	kmer_diff_scores_asc.sort((a, b) => a - b) // Sort array in ascending order

	var file = fs.createWriteStream(
		q.variant.chr + '.' + q.variant.pos + '.' + q.variant.ref + '.' + q.variant.alt + '.txt'
	)
	file.on('error', function(err) {
		/* error handling */
	})
	kmer_diff_scores_asc.forEach(function(v) {
		file.write(v + '\n')
	})
	file.end()

	let j = 0
	const type2group = bamcommon.make_type2group(q)
	for (const diff_score of kmer_diff_scores) {
		if (diff_score >= 0) {
			templates[j].__tempscore = diff_score.toFixed(4).toString()
			type2group[bamcommon.type_supportalt].templates.push(templates[j])
		} else if (diff_score <= 0) {
			templates[j].__tempscore = diff_score.toFixed(4).toString()
			type2group[bamcommon.type_supportref].templates.push(templates[j])
		}

		//            else if (diff_score > ref_cutoff && diff_score < alt_cutoff){
		//                templates[j].__tempscore = diff_score.toFixed(4).toString()
		//                type2group[bamcommon.type_supportno].templates.push(templates[j])
		//	    }
		j++
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
	// const kmers_nodups = new Set(kmers)
	return kmers
}

function jaccard_similarity(kmers1, kmers2, kmers2_nodups) {
	const kmers1_nodups = new Set(kmers1)
	const intersection = new Set([...kmers1_nodups].filter(i => kmers2_nodups.has(i)))
	const all_kmers = new Set([...kmers1_nodups, ...kmers2_nodups])
	let intersection_length = 0
	const kmer1_counts = new Map([...kmers1_nodups].map(x => [x, kmers1.filter(y => y === x).length]))
	const kmer2_counts = new Map([...kmers2_nodups].map(x => [x, kmers2.filter(y => y === x).length]))
	for (const kmer of intersection) {
		const kmer1_freq = kmer1_counts.get(kmer)
		const kmer2_freq = kmer2_counts.get(kmer)
		if (kmer1_freq >= kmer2_freq) {
			intersection_length += kmer2_freq
		} else if (kmer1_freq < kmer2_freq) {
			intersection_length += kmer1_freq
		}
	}
	return intersection_length / (kmers1.length + kmers2.length - intersection_length)
}
