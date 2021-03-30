const jStat = require('jstat').jStat
const features = require('./app').features
const utils = require('./utils')
const bamcommon = require('./bam.common')
const rust_match_complexvariant_indel = require('./rust_indel/pkg/rust_indel_manual').match_complex_variant_rust
const fs = require('fs')

export async function match_complexvariant_rust(q, templates_info) {
	//const segbplen = templates[0].segments[0].seq.length
	const segbplen = q.regions[0].lines[0].split('\t')[9].length // Check if this will work for multi-regions
	// need to verify if the retrieved sequence is showing 1bp offset or not
	let final_ref = ''
	if (q.variant.ref != '-') {
		final_ref = q.variant.ref
	} else {
		final_ref = (await utils.get_fasta(q.genome, q.variant.chr + ':' + (q.variant.pos + 1) + '-' + (q.variant.pos + 2))) // Getting upstream and downstream region for the proposed indel site
			.split('\n')
			.slice(1)
			.join('')
			.toUpperCase()
	}
	let final_alt = ''
	if (q.variant.alt != '-') {
		final_alt = q.variant.alt
	} else {
		final_alt = ''
	}

	console.log(
		'q.variant.pos:',
		q.variant.pos,
		',segbplen:',
		segbplen,
		',variant:',
		q.variant.chr + '.' + q.variant.pos + '.' + final_ref + '.' + final_alt
	)
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
			(q.variant.pos + final_ref.length + 1) +
			'-' +
			(q.variant.pos + segbplen + final_ref.length + 1)
	))
		.split('\n')
		.slice(1)
		.join('')
		.toUpperCase()
	const refseq = (await utils.get_fasta(
		q.genome,
		q.variant.chr + ':' + (q.variant.pos - segbplen) + '-' + (q.variant.pos + segbplen + final_ref.length + 1)
	))
		.split('\n')
		.slice(1)
		.join('')
		.toUpperCase()

	console.log(q.variant.chr + '.' + q.variant.pos + '.' + final_ref + '.' + final_alt)
	console.log('refSeq', refseq)
	console.log('mutSeq', leftflankseq + final_alt + rightflankseq)

	const refallele = final_ref.toUpperCase()
	const altallele = final_alt.toUpperCase()

	//const refseq = leftflankseq + refallele + rightflankseq
	const altseq = leftflankseq + altallele + rightflankseq

	// console.log(refallele,altallele,refseq,altseq)

	//----------------------------------------------------------------------------
	// IMPORTANT PARAMETERS
	const kmer_length = 6 // length of kmer
	const weight_no_indel = 0.1 // Weight when base not inside the indel
	const weight_indel = 10 // Weight when base is inside the indel
	const threshold_slope = 0.1 // Maximum curvature allowed to recognize perfectly aligned alt/ref sequences
	//----------------------------------------------------------------------------

	// Checking to see if reference allele is correct or not
	let refalleleerror = false
	if (refseq.toUpperCase().localeCompare((leftflankseq + refallele + rightflankseq).toUpperCase()) != 0) {
		//console.log('Reference allele is not correct')
		refalleleerror = true
	}

	console.log('templates_info:', templates_info)
	const sequence_reads = templates_info.map(i => i.sam_info.split('\t')[9]).join('\n')
	const start_positions = templates_info.map(i => i.sam_info.split('\t')[3]).join('\n')
	let sequences = ''
	sequences += refseq + '\n'
	sequences += altseq + '\n'
	sequences += sequence_reads // Need to add support for start_positions
	//        const templates_info = []
	//        //for (const template of templates) {
	//        for (const line of q.regions[0].lines) { // q.regions[0] may need to be modified
	//
	//	        templates_info.push(line)
	//		sequences += sequence + '\n'
	//	}
	//console.log("sequences:",sequences)
	//console.log("segbplen:",segbplen)
	const rust_output = await rust_match_complexvariant_indel(
		sequences,
		start_positions,
		BigInt(q.variant.pos),
		BigInt(segbplen),
		refallele,
		altallele,
		BigInt(kmer_length),
		weight_no_indel,
		weight_indel,
		threshold_slope
	) // Invoking wasm function
	console.log('rust_output:', rust_output.groupID.length)
	let index = 0
	const type2group = bamcommon.make_type2group(q)
	const kmer_diff_scores_input = []
	for (let i = 0; i < rust_output.category.length; i++) {
		if (rust_output.category[i] == 'ref') {
			if (type2group[bamcommon.type_supportref]) {
				index = rust_output.groupID[i]
				templates_info[index].tempscore = rust_output.kmer_diff_scores[index].toFixed(4).toString()
				type2group[bamcommon.type_supportref].templates.push(templates_info[index])
				const input_items = {
					value: rust_output.kmer_diff_scores[i],
					groupID: 'ref'
				}
				kmer_diff_scores_input.push(input_items)
			}
		} else if (rust_output.category[i] == 'alt') {
			if (type2group[bamcommon.type_supportalt]) {
				index = rust_output.groupID[i]
				templates_info[index].tempscore = rust_output.kmer_diff_scores[index].toFixed(4).toString()
				type2group[bamcommon.type_supportalt].templates.push(templates_info[index])
				const input_items = {
					value: rust_output.kmer_diff_scores[i],
					groupID: 'alt'
				}
				kmer_diff_scores_input.push(input_items)
			}
		} else if (rust_output.category[i] == 'none') {
			if (type2group[bamcommon.type_supportno]) {
				index = rust_output.groupID[i]
				templates_info[index].tempscore = rust_output.kmer_diff_scores[index].toFixed(4).toString()
				type2group[bamcommon.type_supportno].templates.push(templates_info[index])
				const input_items = {
					value: rust_output.kmer_diff_scores[i],
					groupID: 'none'
				}
				kmer_diff_scores_input.push(input_items)
			}
		}
	}
	kmer_diff_scores_input.sort((a, b) => a.value - b.value)
	// console.log('Final array for plotting:', kmer_diff_scores_input)
	// Please use this array for plotting the scatter plot .values contain the numeric value, .groupID contains ref/alt/none status. You can use red for alt, green for ref and blue for none.

	q.kmer_diff_scores_asc = kmer_diff_scores_input

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
	return { groups, refalleleerror }
}

export async function match_complexvariant(q, templates_info) {
	// TODO
	// get flanking sequence, suppose that segments are of same length, use segment length
	//const segbplen = templates[0].segments[0].seq.length
	const segbplen = q.regions[0].lines[0].split('\t')[9].length // Check if this will work for multi-regions
	// need to verify if the retrieved sequence is showing 1bp offset or not
	let final_ref = ''
	if (q.variant.ref != '-') {
		final_ref = q.variant.ref
	} else {
		final_ref = (await utils.get_fasta(q.genome, q.variant.chr + ':' + (q.variant.pos + 1) + '-' + (q.variant.pos + 2))) // Getting upstream and downstream region for the proposed indel site
			.split('\n')
			.slice(1)
			.join('')
			.toUpperCase()
	}
	let final_alt = ''
	if (q.variant.alt != '-') {
		final_alt = q.variant.alt
	} else {
		final_alt = ''
	}

	console.log(
		'q.variant.pos:',
		q.variant.pos,
		',segbplen:',
		segbplen,
		',variant:',
		q.variant.chr + '.' + q.variant.pos + '.' + final_ref + '.' + final_alt
	)
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
			(q.variant.pos + final_ref.length + 1) +
			'-' +
			(q.variant.pos + segbplen + final_ref.length + 1)
	))
		.split('\n')
		.slice(1)
		.join('')
		.toUpperCase()
	const refseq = (await utils.get_fasta(
		q.genome,
		q.variant.chr + ':' + (q.variant.pos - segbplen) + '-' + (q.variant.pos + segbplen + final_ref.length + 1)
	))
		.split('\n')
		.slice(1)
		.join('')
		.toUpperCase()

	console.log(q.variant.chr + '.' + q.variant.pos + '.' + final_ref + '.' + final_alt)
	console.log('refSeq', refseq)
	console.log('mutSeq', leftflankseq + final_alt + rightflankseq)

	const refallele = final_ref.toUpperCase()
	const altallele = final_alt.toUpperCase()

	//const refseq = leftflankseq + refallele + rightflankseq
	const altseq = leftflankseq + altallele + rightflankseq

	// console.log(refallele,altallele,refseq,altseq)

	//const file = fs.createWriteStream(
	//	// Creating output for the rust implementation
	//	q.variant.chr + '.' + q.variant.pos + '.' + final_ref + '.' + final_alt + '.txt'
	//)
	//file.on('error', function(err) {
	//	/* error handling */
	//	console.log('Something not right with file creation')
	//})
	//
	//file.write(refseq + '\n')
	//file.write(altseq + '\n')
	//for (const sequence of sequence_reads) {
	//	file.write(sequence + '\n')
	//}
	//file.end()

	//----------------------------------------------------------------------------

	// IMPORTANT PARAMETERS
	const kmer_length = 6 // length of kmer
	const weight_no_indel = 0.1 // Weight when base not inside the indel
	const weight_indel = 10 // Weight when base is inside the indel
	const threshold_slope = 0.1 // Maximum curvature allowed to recognize perfectly aligned alt/ref sequences
	//----------------------------------------------------------------------------

	// Checking to see if reference allele is correct or not
	let refalleleerror = false
	if (refseq.toUpperCase().localeCompare((leftflankseq + refallele + rightflankseq).toUpperCase()) != 0) {
		//console.log('Reference allele is not correct')
		refalleleerror = true
	}

	//        let ref_weight=1
	//        let alt_weight=1
	//        if (refallele.length > altallele.length) {
	//          alt_weight=refallele.length/altallele.length
	//        }
	//
	//        else if (altallele.length > refallele.length) {
	//          ref_weight=altallele.length/refallele.length
	//        }

	console.log('Ref kmers:')
	const all_ref_kmers = build_kmers_refalt(
		refseq,
		kmer_length,
		q.variant.pos - segbplen,
		q.variant.pos,
		q.variant.pos + refallele.length,
		weight_indel,
		weight_no_indel
	)
	//console.log("all_ref_kmers:",all_ref_kmers)
	console.log('Alt kmers:')
	const all_alt_kmers = build_kmers_refalt(
		altseq,
		kmer_length,
		q.variant.pos - segbplen,
		q.variant.pos,
		q.variant.pos + altallele.length,
		weight_indel,
		weight_no_indel
	)

	const all_ref_kmers_nodups = new Set(all_ref_kmers)
	const all_ref_kmers_seq_values_nodups = new Set(all_ref_kmers.map(x => x.sequence))

	const all_ref_counts = new Map(
		[...all_ref_kmers_seq_values_nodups].map(x => [x, all_ref_kmers.filter(y => y.sequence === x).length])
	)
	//console.log("all_ref_counts:",all_ref_counts)
	//console.log("all_ref_kmers_seq_values_nodups:",all_ref_kmers_seq_values_nodups)
	let ref_kmers_weight = 0
	for (const item of [...all_ref_kmers_nodups]) {
		const kmer = item.sequence
		const kmer2_freq = all_ref_counts.get(kmer) // Getting frequency of kmer in ref sequence
		const score = item.value
		ref_kmers_weight += score * kmer2_freq
	}
	console.log('ref_kmers_weight:', ref_kmers_weight)

	const all_alt_kmers_nodups = new Set(all_alt_kmers)
	const all_alt_kmers_seq_values_nodups = new Set(all_alt_kmers.map(x => x.sequence))

	const all_alt_counts = new Map(
		[...all_alt_kmers_seq_values_nodups].map(x => [x, all_alt_kmers.filter(y => y.sequence === x).length])
	)
	//console.log("all_alt_counts:",all_alt_counts)
	//console.log("all_alt_kmers_seq_values_nodups:",all_alt_kmers_seq_values_nodups)
	let alt_kmers_weight = 0
	for (const item of [...all_alt_kmers_nodups]) {
		const kmer = item.sequence
		const kmer2_freq = all_alt_counts.get(kmer) // Getting frequency of kmer in alt sequence
		const score = item.value
		alt_kmers_weight += score * kmer2_freq
	}
	console.log('alt_kmers_weight:', alt_kmers_weight)

	const ref_kmers = build_kmers(refseq, kmer_length)
	const alt_kmers = build_kmers(altseq, kmer_length)

	const ref_kmers_nodups = new Set(ref_kmers)
	const alt_kmers_nodups = new Set(alt_kmers)
	//console.log(ref_kmers)
	//console.log(alt_kmers)

	const kmer_diff_scores = []
	const alt_comparisons = []
	const ref_comparisons = []
	const ref_scores = []
	const alt_scores = []
	let i = 0
	const sequence_list = templates_info.map(i => i.sam_info.split('\t')[9])
	for (const read_seq of sequence_list) {
		if (read_seq.length > 0) {
			// let cigar_seq = template.segments[0].cigarstr
			const read_kmers = build_kmers(read_seq, kmer_length)
			//const ref_comparison = jaccard_similarity(read_kmers, ref_kmers, ref_kmers_nodups)
			const ref_comparison = jaccard_similarity_weights(
				read_kmers,
				all_ref_kmers,
				all_ref_kmers_nodups,
				all_ref_kmers_seq_values_nodups,
				ref_kmers_weight,
				all_ref_counts
			)
			const alt_comparison = jaccard_similarity_weights(
				read_kmers,
				all_alt_kmers,
				all_alt_kmers_nodups,
				all_alt_kmers_seq_values_nodups,
				alt_kmers_weight,
				all_alt_counts
			)
			//console.log("ref comparison:",ref_comparison,"alt comparison:",alt_comparison)
			// console.log("Iteration:",k,read_seq,cigar_seq,ref_comparison,alt_comparison,read_seq.length,refseq.length,altseq.length,read_kmers.length,ref_kmers.length,alt_kmers.length)
			const diff_score = alt_comparison - ref_comparison // Is the read more similar to reference sequence or alternate sequence
			kmer_diff_scores.push(diff_score)
			ref_comparisons.push(ref_comparison)
			alt_comparisons.push(alt_comparison)
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
	}

	console.log('ref_scores length:', ref_scores.length, 'alt_scores length:', alt_scores.length)
	let ref_indices = []
	if (ref_scores.length > 0) {
		ref_indices = determine_maxima_alt(ref_scores, threshold_slope)
	}
	let alt_indices = []
	if (alt_scores.length > 0) {
		alt_indices = determine_maxima_alt(alt_scores, threshold_slope)
	}

	let index = 0
	const type2group = bamcommon.make_type2group(q)
	const kmer_diff_scores_input = []

	for (const item of ref_indices) {
		if (item[1] == 'refalt') {
			if (type2group[bamcommon.type_supportref]) {
				index = item[0]
				//console.log("templates_info[index]:",templates_info[index])
				templates_info[index].tempscore =
					alt_comparisons[index].toFixed(4).toString() + '-' + ref_comparisons[index].toFixed(4).toString()
				type2group[bamcommon.type_supportref].templates.push(templates_info[index])
				const input_items = {
					value: kmer_diff_scores[index],
					groupID: 'ref'
				}
				kmer_diff_scores_input.push(input_items)
			}
		} else if (item[1] == 'none') {
			if (type2group[bamcommon.type_supportno]) {
				index = item[0]
				//console.log("templates_info[index]:",templates_info[index])
				templates_info[index].tempscore =
					alt_comparisons[index].toFixed(4).toString() + '-' + ref_comparisons[index].toFixed(4).toString()
				type2group[bamcommon.type_supportno].templates.push(templates_info[index])
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
				//console.log("templates_info[index]:",templates_info[index])
				templates_info[index].tempscore =
					alt_comparisons[index].toFixed(4).toString() + '-' + ref_comparisons[index].toFixed(4).toString()
				type2group[bamcommon.type_supportalt].templates.push(templates_info[index])
				const input_items = {
					value: kmer_diff_scores[index],
					groupID: 'alt'
				}
				kmer_diff_scores_input.push(input_items)
			}
		} else if (item[1] == 'none') {
			if (type2group[bamcommon.type_supportno]) {
				index = item[0]
				//console.log("templates_info[index]:",templates_info[index])
				templates_info[index].tempscore =
					alt_comparisons[index].toFixed(4).toString() + '-' + ref_comparisons[index].toFixed(4).toString()
				// templates[index].__tempscore = kmer_diff_scores[index].toFixed(4).toString()
				type2group[bamcommon.type_supportno].templates.push(templates_info[index])
				const input_items = {
					value: kmer_diff_scores[index],
					groupID: 'none'
				}
				kmer_diff_scores_input.push(input_items)
			}
		}
	}
	kmer_diff_scores_input.sort((a, b) => a.value - b.value)
	// console.log('Final array for plotting:', kmer_diff_scores_input)
	// Please use this array for plotting the scatter plot .values contain the numeric value, .groupID contains ref/alt/none status. You can use red for alt, green for ref and blue for none.

	q.kmer_diff_scores_asc = kmer_diff_scores_input
	//	if (features.bamScoreRplot) {
	//		const file = fs.createWriteStream(
	//			q.variant.chr + '.' + q.variant.pos + '.' + final_ref + '.' + final_alt + '.txt'
	//		)
	//		file.on('error', function(err) {
	//			/* error handling */
	//		})
	//		kmer_diff_scores_input.forEach(function(v) {
	//			file.write(v.value + ',' + v.groupID + '\n')
	//		})
	//		file.end()
	//	}

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
	console.log('groups:', groups[0])
	return { groups, refalleleerror }
}

function build_kmers(sequence, kmer_length) {
	const num_iterations = sequence.length - kmer_length + 1
	// console.log(sequence)

	const kmers = []
	for (let i = 0; i < num_iterations; i++) {
		const subseq = sequence.substr(i, kmer_length)
		// console.log(i,kmer)
		// console.log(subseq)
		kmers.push(subseq)
	}
	// const kmers_nodups = new Set(kmers)
	return kmers
}

function build_kmers_refalt(
	sequence,
	kmer_length,
	left_most_pos,
	indel_start,
	indel_stop,
	weight_indel,
	weight_no_indel
) {
	const num_iterations = sequence.length - kmer_length + 1
	// console.log(sequence)
	const kmers = []
	let kmer_start = left_most_pos
	let kmer_stop = kmer_start + kmer_length
	for (let i = 0; i < num_iterations; i++) {
		const subseq = sequence.substr(i, kmer_length) // Determining kmer sequence
		let kmer_score = 0
		for (let j = kmer_start; j < kmer_stop; j++) {
			// Calculating score for every nucleotide in the kmer
			if (indel_start <= j && j < indel_stop) {
				// Determining if nucleotide is within indel or not
				kmer_score += weight_indel
			} else {
				kmer_score += weight_no_indel
			}
		}
		const input_items = {
			value: kmer_score,
			sequence: subseq
		}
		kmer_start++
		kmer_stop++

		// console.log(i,kmer)
		// console.log(subseq)
		kmers.push(input_items)
	}

	// Getting unique kmers
	//console.log("kmers length:",kmers.length)
	const kmers_nodup = Array.from(new Set([...kmers.map(x => x.sequence)]))
	//console.log("kmers_nodup length:",kmers_nodup.length)

	const kmers2 = []
	for (const kmer of kmers_nodup) {
		// Calulating mean of scores for each kmer
		const kmer_values = kmers.filter(i => i.sequence == kmer).map(x => x.value)
		//console.log("kmer_values:",kmer, jStat.mean(kmer_values))
		const input_items = {
			value: jStat.mean(kmer_values),
			sequence: kmer
		}
		kmers2.push(input_items)
	}

	const kmers3 = []
	for (const kmer of kmers) {
		const kmer_values = kmers2.filter(i => i.sequence == kmer.sequence).map(x => x.value)
		const kmer_value = kmer_values[0]
		const input_items = {
			value: kmer_value,
			sequence: kmer.sequence
		}
		kmers3.push(input_items)
	}
	return kmers3
}

function jaccard_similarity_weights(
	kmers1,
	kmers2,
	kmers2_nodups,
	kmer2_seq_values_nodups,
	kmers2_weight,
	kmer2_counts
) {
	const kmers1_nodups = new Set(kmers1)
	//const intersection = new Set([...kmers1_nodups].filter(i => [...kmers2_nodups].filter(y => y.sequence === i)))
	const intersection = new Set([...kmers1_nodups].filter(i => kmer2_seq_values_nodups.has(i)))
	//console.log("intersection:", intersection.size)
	let intersection_weight = 0
	const kmer1_counts = new Map([...kmers1_nodups].map(x => [x, kmers1.filter(y => y === x).length]))
	//console.log("kmer1_counts:",kmer1_counts)
	//console.log("kmer2_counts:",kmer2_counts)
	for (const kmer of intersection) {
		const kmer1_freq = kmer1_counts.get(kmer) // Getting frequency of kmer in read sequence
		const scores = [...kmers2_nodups].filter(i => i.sequence == kmer).map(x => x.value) // Determining score of kmer in ref/alt sequence
		let score = 0 // If kmer not found in ref/alt sequence, penalizing kmer to zero (may be due to incorrect base pair call or splicing)
		if (scores.length > 0) {
			// If kmer found in ref/alt sequence, using that score
			score = scores[0]
		}
		let kmer2_freq = 0
		if (score != 0) {
			kmer2_freq = kmer2_counts.get(kmer) // Getting frequency of kmer in ref/alt sequence
		}
		//console.log("score:",score,"kmer:",kmer,"kmer1 freq:",kmer1_freq,"kmer2_freq:",kmer2_freq)
		if (kmer1_freq >= kmer2_freq) {
			intersection_weight += kmer2_freq * score
		} else if (kmer1_freq < kmer2_freq) {
			intersection_weight += kmer1_freq * score
		}
	}
	//console.log("intersection_weight:",intersection_weight)

	let kmers1_weight = 0
	for (const kmer of kmers1_nodups) {
		const kmer1_freq = kmer1_counts.get(kmer) // Getting frequency of kmer in read sequence
		const scores = [...kmers2_nodups].filter(i => i.sequence == kmer).map(x => x.value) // Determining score of kmer in ref/alt sequence
		let score = 0 // If kmer not found in ref/alt sequence, penalizing kmer to zero (may be due to incorrect base pair call or splicing)
		if (scores.length > 0) {
			// If kmer found in ref/alt sequence, using that score
			score = scores[0]
		}
		kmers1_weight += score * kmer1_freq
	}
	//console.log("kmers1_weight:",kmers1_weight," kmers2_weight", kmers2_weight," intersection weight:",intersection_weight)
	return intersection_weight / (kmers1_weight + kmers2_weight - intersection_weight) // Outputting jaccard similarity
}

function determine_maxima_alt(kmer_diff_scores, threshold_slope) {
	kmer_diff_scores.sort((a, b) => a.value - b.value)
	// console.log(kmer_diff_scores)

	let start_point = kmer_diff_scores.length - 1
	const indices = []
	let slope = 0
	let is_a_line = 1
	if (kmer_diff_scores.length > 1) {
		for (let i = kmer_diff_scores.length - 1; i > 0; i--) {
			slope = Math.abs(kmer_diff_scores[i - 1].value - kmer_diff_scores[i].value)
			//console.log('Slope:', slope, kmer_diff_scores.length - 1 - i,kmer_diff_scores[i - 1].value,kmer_diff_scores[i].value)
			if (slope > threshold_slope) {
				start_point = i
				is_a_line = 0
				break
			}
		}
	} else {
		console.log('Number of reads too low to determine curvature of slope')
		indices.push([kmer_diff_scores[0].groupID, 'none'])
		return indices
	}
	if (is_a_line == 1) {
		// The points are in a line
		for (let i = 0; i < kmer_diff_scores.length; i++) {
			indices.push([kmer_diff_scores[i].groupID, 'refalt'])
		}
	} else {
		// The points are in the shape of a curve
		console.log('start point:', start_point)
		const kmer_diff_scores_input = []
		for (let i = 0; i <= start_point; i++) {
			kmer_diff_scores_input.push([i, kmer_diff_scores[i].value])
		}

		const min_value = [0, kmer_diff_scores[0].value]
		const max_value = [start_point, kmer_diff_scores[start_point].value]
		console.log('max_value:', max_value)

		const slope_of_line = (max_value[1] - min_value[1]) / (max_value[0] - min_value[0]) // m=(y2-y1)/(x2-x1)
		console.log('Slope of line:', slope_of_line)
		const intercept_of_line = min_value[1] - min_value[0] * slope_of_line // c=y-m*x

		const distances_from_line = []
		for (let i = 0; i < kmer_diff_scores_input.length; i++) {
			distances_from_line.push(
				Math.abs(slope_of_line * kmer_diff_scores_input[i][0] - kmer_diff_scores_input[i][1] + intercept_of_line) /
					Math.sqrt(1 + slope_of_line * slope_of_line)
			) // distance of a point from line = abs(a*x+b*y+c)/sqrt(a^2+b^2)
		}
		const array_maximum = Math.max(...distances_from_line)
		// console.log("Array maximum:",array_maximum)
		const index_array_maximum = distances_from_line.indexOf(array_maximum)
		// console.log("Max index:",index_array_maximum,"Total length:",kmer_diff_scores.length)
		const score_cutoff = kmer_diff_scores[index_array_maximum].value
		console.log('score cutoff:', score_cutoff)
		for (let i = 0; i < kmer_diff_scores.length; i++) {
			if (score_cutoff >= kmer_diff_scores[i].value) {
				indices.push([kmer_diff_scores[i].groupID, 'none'])
			} else if (score_cutoff < kmer_diff_scores[i].value) {
				indices.push([kmer_diff_scores[i].groupID, 'refalt'])
			}
		}
	}
	//console.log("indices:",indices)
	return indices
}
