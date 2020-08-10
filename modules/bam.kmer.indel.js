// const jStat = require('jStat').jStat
const features = require('../app').features
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

	const kmer_diff_scores = []
	const ref_scores = []
	const alt_scores = []
	let i = 0
	for (const template of templates) {
		const read_seq = template.segments[0].seq
		// let cigar_seq = template.segments[0].cigarstr
		const read_kmers = build_kmers(read_seq, kmer_length)
		const ref_comparison = jaccard_similarity(read_kmers, ref_kmers, ref_kmers_nodups)
		const alt_comparison = jaccard_similarity(read_kmers, alt_kmers, alt_kmers_nodups)
		// console.log("Iteration:",k,read_seq,cigar_seq,ref_comparison,alt_comparison,read_seq.length,refseq.length,altseq.length,read_kmers.length,ref_kmers.length,alt_kmers.length)
		const diff_score = alt_comparison - ref_comparison
		kmer_diff_scores.push(diff_score)
		const item = {
			value: Math.abs(diff_score),
			groupID: i
		}
		if (diff_score > 0) {
			alt_scores.push(item)
		} else if (diff_score <= 0) {
			ref_scores.push(item)
		}

		i++
	}

	const ref_indices = determine_maxima(ref_scores)
	const alt_indices = determine_maxima(alt_scores)

	let index = 0
	const type2group = bamcommon.make_type2group(q)
	let kmer_diff_scores_input = []
	for (const item of ref_indices) {
		if (item[1] == 'refalt') {
			if (type2group[bamcommon.type_supportref]) {
				index = item[0]
				templates[index].__tempscore = kmer_diff_scores[index].toFixed(4).toString()
				type2group[bamcommon.type_supportref].templates.push(templates[index])
				const input_items = {
					value: kmer_diff_scores[index],
					groupID: 'ref'
				}
				kmer_diff_scores_input.push(input_items)
			}
		} else if (item[1] == 'none') {
			if (type2group[bamcommon.type_supportno]) {
				index = item[0]
				templates[index].__tempscore = kmer_diff_scores[index].toFixed(4).toString()
				type2group[bamcommon.type_supportno].templates.push(templates[index])
				const input_items = {
					value: kmer_diff_scores[index],
					groupID: 'none'
				}
				kmer_diff_scores_input.push(input_items)
			}
		}
	}

	for (const item of alt_indices) {
		if (item[1] == 'refalt') {
			if (type2group[bamcommon.type_supportalt]) {
				index = item[0]
				templates[index].__tempscore = kmer_diff_scores[index].toFixed(4).toString()
				type2group[bamcommon.type_supportalt].templates.push(templates[index])
				const input_items = {
					value: kmer_diff_scores[index],
					groupID: 'alt'
				}
				kmer_diff_scores_input.push(input_items)
			}
		} else if (item[1] == 'none') {
			if (type2group[bamcommon.type_supportno]) {
				index = item[0]
				templates[index].__tempscore = kmer_diff_scores[index].toFixed(4).toString()
				type2group[bamcommon.type_supportno].templates.push(templates[index])
				const input_items = {
					value: kmer_diff_scores[index],
					groupID: 'none'
				}
				kmer_diff_scores_input.push(input_items)
			}
		}
	}
	kmer_diff_scores_input.sort((a, b) => a.value - b.value)
	console.log('Final array for plotting:', kmer_diff_scores_input)
	// Please use this array for plotting the scatter plot .values contain the numeric value, .groupID contains ref/alt/none status. You can use red for alt, green for ref and blue for none.

	q.kmer_diff_scores_asc = kmer_diff_scores.slice().sort((a, b) => a - b) // Sort array in ascending order
	if (features.bamScoreRplot) {
		const file = fs.createWriteStream(
			q.variant.chr + '.' + q.variant.pos + '.' + q.variant.ref + '.' + q.variant.alt + '.txt'
		)
		file.on('error', function(err) {
			/* error handling */
		})
		kmer_diff_scores_input.forEach(function(v) {
			file.write(v.value + ',' + v.groupID + '\n')
		})
		file.end()
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

function determine_maxima(kmer_diff_scores) {
	kmer_diff_scores.sort((a, b) => a.value - b.value)
	// console.log(kmer_diff_scores)

	let kmer_diff_scores_input = []
	for (let i = 0; i < kmer_diff_scores.length; i++) {
		kmer_diff_scores_input.push([i, kmer_diff_scores[i].value])
	}
	const min_value = [0, kmer_diff_scores[0].value]
	const max_value = [kmer_diff_scores.length - 1, kmer_diff_scores[kmer_diff_scores.length - 1].value]
	const slope_of_line = (max_value[1] - min_value[1]) / (max_value[0] - min_value[0])
	console.log(slope_of_line)
	const intercept_of_line = min_value[1] * slope_of_line

	let distances_from_line = []
	for (let i = 0; i < kmer_diff_scores.length; i++) {
		distances_from_line.push(
			Math.abs(slope_of_line * kmer_diff_scores_input[i][0] - kmer_diff_scores_input[i][1] + intercept_of_line) /
				Math.sqrt(1 + slope_of_line * slope_of_line)
		) // distance = abs(a*x+b*y+c)/sqrt(a^2+b^2)
	}
	const array_maximum = Math.max(...distances_from_line)
	// console.log("Array maximum:",array_maximum)
	const index_array_maximum = distances_from_line.indexOf(array_maximum)
	// console.log("Max index:",index_array_maximum,"Total length:",kmer_diff_scores.length)
	let indices = []
	for (let i = 0; i < kmer_diff_scores.length; i++) {
		if (i < index_array_maximum) {
			indices.push([kmer_diff_scores[i].groupID, 'none'])
		} else if (i >= index_array_maximum) {
			indices.push([kmer_diff_scores[i].groupID, 'refalt'])
		}
	}
	//console.log("indices:",indices)
	return indices
}
