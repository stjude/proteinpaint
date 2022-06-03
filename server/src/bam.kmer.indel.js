const jStat = require('jstat').jStat
const path = require('path')
const features = require('./app').features
const utils = require('./utils')
const spawn = require('child_process').spawn
const Readable = require('stream').Readable
const readline = require('readline')
const bamcommon = require('./bam.common')
const fs = require('fs')
const serverconfig = require('./serverconfig')
const clustalo_read_alignment = serverconfig.clustalo

export async function match_complexvariant_rust(q, templates_info, region_widths) {
	//const segbplen = templates[0].segments[0].seq.length
	const segbplen = q.regions[0].lines[0].split('\t')[9].length // Check if this will work for multi-regions
	// need to verify if the retrieved sequence is showing 1bp offset or not
	let final_ref = ''
	let final_alt = ''

	if ((q.variant.ref.length == 0 || q.variant.ref == '-') && (q.variant.alt == '-' || q.variant.alt.length == 0)) {
		// Both ref and alt allele are missing
		throw 'Both Ref and Alt alleles are missing'
	} else if (q.variant.ref.length == 0 || q.variant.ref == '-') {
		final_ref = (await utils.get_fasta(q.genome, q.variant.chr + ':' + q.variant.pos + '-' + q.variant.pos))
			.split('\n')
			.slice(1)
			.join('')
			.toUpperCase()

		final_alt = final_ref + q.variant.alt // Adding flanking nucleotide before alternate allele
		q.variant.pos -= 1
	} else if (q.variant.alt == '-' || q.variant.alt.length == 0) {
		// Format is in 55589772.ACGA.- (standard notation 55589771.ACGA.A)
		const first_nucleotide = (await utils.get_fasta(
			q.genome,
			q.variant.chr + ':' + q.variant.pos + '-' + q.variant.pos
		))
			.split('\n')
			.slice(1)
			.join('')
			.toUpperCase()
		final_ref = first_nucleotide + q.variant.ref
		final_alt = first_nucleotide
		q.variant.pos -= 1
	} else {
		final_alt = q.variant.alt
		final_ref = q.variant.ref
	}

	const final_pos = q.variant.pos
	//console.log(q.variant.chr + '.' + final_pos + '.' + final_ref + '.' + final_alt)
	/*
	console.log(
		'final_pos:',
		final_pos,
		',segbplen:',
		segbplen,
		',variant:',
		q.variant.chr + '.' + final_pos + '.' + final_ref + '.' + final_alt
	)
	*/

	const refallele = final_ref.toUpperCase()
	const altallele = final_alt.toUpperCase()
	let leftflankseq, rightflankseq, refseq, altseq

	if (!q.alleleAlreadyUpdated) {
		leftflankseq = (await utils.get_fasta(q.genome, q.variant.chr + ':' + (final_pos - segbplen) + '-' + final_pos))

			.split('\n')
			.slice(1)
			.join('')
			.toUpperCase()
		rightflankseq = (await utils.get_fasta(
			q.genome,
			q.variant.chr + ':' + (final_pos + final_ref.length + 1) + '-' + (final_pos + segbplen + final_ref.length + 1)
		))
			.split('\n')
			.slice(1)
			.join('')
			.toUpperCase()
		refseq = (await utils.get_fasta(
			q.genome,
			q.variant.chr + ':' + (final_pos - segbplen) + '-' + (final_pos + segbplen + final_ref.length + 1)
		))
			.split('\n')
			.slice(1)
			.join('')
			.toUpperCase()
		altseq = leftflankseq + altallele + rightflankseq
	} else {
		leftflankseq = q.leftflankseq
		rightflankseq = q.rightflankseq
		refseq = q.refseq
		altseq = q.altseq
	}

	//console.log(q.variant.chr + '.' + final_pos + '.' + final_ref + '.' + final_alt)
	//console.log('refSeq', refseq)
	//console.log('mutSeq', leftflankseq + final_alt + rightflankseq)
	//console.log('leftflankseq:', leftflankseq)
	//console.log('rightflankseq:', rightflankseq)

	// console.log(refallele,altallele,refseq,altseq)

	//----------------------------------------------------------------------------
	// IMPORTANT PARAMETERS
	const fisher_test_threshold = 60 // Fisher exact-test strand analysis significance parameter. See details in this weblink https://gatk.broadinstitute.org/hc/en-us/articles/360035890471
	const is_realignment_reads = 0 // Realign reads to obtain correct indel sequence (If 1 realignment of reads will be attempted, if 0 no realignment of reads will be performed )
	//----------------------------------------------------------------------------

	// Checking to see if reference allele is correct or not
	let refalleleerror = false
	if (refseq.toUpperCase().localeCompare((leftflankseq + refallele + rightflankseq).toUpperCase()) != 0) {
		//console.log('Reference allele is not correct')
		refalleleerror = true
	}

	const sequence_reads = templates_info.map(i => i.sam_info.split('\t')[9]).join('-')
	const start_positions = templates_info.map(i => i.sam_info.split('\t')[3]).join('-')
	const cigar_sequences = templates_info.map(i => i.sam_info.split('\t')[5]).join('-')
	const sequence_flags = templates_info.map(i => i.sam_info.split('\t')[1]).join('-')

	let sequences = ''
	sequences += refseq + '-'
	sequences += altseq + '-'
	sequences += sequence_reads

	// This code has been added to parse input from example.bam.indel.html
	if (!Number.isFinite(Number(q.variant.strictness))) {
		q.variant.strictness = 1
	}

	let input_data =
		sequences +
		'_' +
		start_positions +
		'_' +
		cigar_sequences +
		'_' +
		sequence_flags +
		'_' +
		final_pos.toString() +
		'_' +
		refallele +
		'_' +
		altallele +
		'_' +
		q.variant.strictness +
		'_' +
		leftflankseq +
		'_' +
		rightflankseq

	if (is_realignment_reads == 1) {
		// When realignment of reads is neccessary, quality scores and path to clustalo is passed for determining correct indel sequence (not functional, currently in development)
		const quality_scores = templates_info.map(i => i.sam_info.split('\t')[10]).join('-')
		input_data += clustalo_read_alignment + '_' + quality_scores + '_' + is_realignment_reads
	}

	/* uncomment this line to help creating tests at server/utils/test/indel.spec.js
	console.log('indel test:',{
		leftFlank:leftflankseq, rightFlank:rightflankseq,
		seqRef:refseq, seqMut:altseq,
		variant: q.variant
	})
	*/

	//console.log('input_data:', input_data)
	//fs.writeFile('test.txt', input_data, function(err) {
	//	// For catching input to rust pipeline, in case of an error
	//	if (err) return console.log(err)
	//})
	const time1 = new Date()
	const rust_output = await utils.run_rust('indel', input_data)
	const time2 = new Date()
	console.log('Time taken to run rust indel pipeline:', time2 - time1, 'ms')
	const rust_output_list = rust_output.split('\n')
	let group_ids = []
	let categories = []
	let diff_scores = []
	let strand_probability = 0 // Contains p_value of strand bias i.e forward/reverse vs alternate/reference
	let alternate_forward_count, alternate_reverse_count, reference_forward_count, reference_reverse_count
	for (let item of rust_output_list) {
		if (item.includes('output_gID')) {
			group_ids = item
				.replace(/"/g, '')
				.replace(/,/g, '')
				.replace('output_gID:', '')
				.split(':')
				//.map(Number)
				.map(n => Number(n.replace(/\D/g, ''))) // Removing characters that are not digits
		} else if (item.includes('output_cat')) {
			categories = item
				.replace(/"/g, '')
				.replace(/,/g, '')
				.replace('output_cat:', '')
				.split(':')
				.map(n => n.replace(/[^a-zA-Z0-9]+/g, '')) // Removing characters that are not alphabets
		} else if (item.includes('output_diff_scores')) {
			diff_scores = item
				.replace(/"/g, '')
				.replace(/,/g, '')
				.replace('output_diff_scores:', '')
				.split(':')
				.map(Number)
			//.map(n => Number(n.replace(/\D/g, '')))
		} else if (item.includes('alternate_forward_count:')) {
			alternate_forward_count = Number(
				item
					.replace(/"/g, '')
					.replace(/,/g, '')
					.replace('alternate_forward_count:', '')
			)
		} else if (item.includes('alternate_reverse_count:')) {
			alternate_reverse_count = Number(
				item
					.replace(/"/g, '')
					.replace(/,/g, '')
					.replace('alternate_reverse_count:', '')
			)
		} else if (item.includes('reference_forward_count:')) {
			reference_forward_count = Number(
				item
					.replace(/"/g, '')
					.replace(/,/g, '')
					.replace('reference_forward_count:', '')
			)
		} else if (item.includes('reference_reverse_count:')) {
			reference_reverse_count = Number(
				item
					.replace(/"/g, '')
					.replace(/,/g, '')
					.replace('reference_reverse_count:', '')
			)
		} else if (item.includes('strand_probability')) {
			strand_probability = Number(
				item
					.replace(/"/g, '')
					.replace(/,/g, '')
					.replace('strand_probability:', '')
			)
		} else {
			console.log(item)
		}
	}

	let strand_significance = false
	if (strand_probability > fisher_test_threshold) {
		strand_significance = true
	}

	//console.log("group_ids:",group_ids)
	//console.log("categories:",categories.length)
	//console.log("diff_scores:",diff_scores.length)
	//console.log('strand_probability:', strand_probability)
	let index = 0
	const type2group = bamcommon.make_type2group(q)
	const read_alignment_diff_scores_input = []
	for (let i = 0; i < categories.length; i++) {
		if (categories[i] == 'ref') {
			if (type2group[bamcommon.type_supportref]) {
				index = group_ids[i]
				//console.log("index:",index)
				//console.log("diff_scores[i]:",diff_scores[i])

				templates_info[index].tempscore = diff_scores[i].toFixed(4).toString()
				type2group[bamcommon.type_supportref].templates.push(templates_info[index])
				const input_items = {
					value: diff_scores[i],
					groupID: 'ref'
				}
				read_alignment_diff_scores_input.push(input_items)
			}
		} else if (categories[i] == 'alt') {
			if (type2group[bamcommon.type_supportalt]) {
				index = group_ids[i]
				//console.log("index:",index)
				//console.log("diff_scores[i]:",diff_scores[i])
				templates_info[index].tempscore = diff_scores[i].toFixed(4).toString()
				type2group[bamcommon.type_supportalt].templates.push(templates_info[index])
				const input_items = {
					value: diff_scores[i],
					groupID: 'alt'
				}
				read_alignment_diff_scores_input.push(input_items)
			}
		} else if (categories[i] == 'amb') {
			if (type2group[bamcommon.type_supportamb]) {
				index = group_ids[i]
				//console.log("index:",index)
				//console.log("diff_scores[i]:",diff_scores[i])
				templates_info[index].tempscore = diff_scores[i].toFixed(4).toString()
				type2group[bamcommon.type_supportamb].templates.push(templates_info[index])
				const input_items = {
					value: diff_scores[i],
					groupID: 'amb'
				}
				read_alignment_diff_scores_input.push(input_items)
			}
		} else if (categories[i] == 'none') {
			if (type2group[bamcommon.type_supportno]) {
				index = group_ids[i]
				//console.log("index:",index)
				//console.log("diff_scores[i]:",diff_scores[i])
				templates_info[index].tempscore = diff_scores[i].toFixed(4).toString()
				type2group[bamcommon.type_supportno].templates.push(templates_info[index])
				const input_items = {
					value: diff_scores[i],
					groupID: 'none'
				}
				read_alignment_diff_scores_input.push(input_items)
			}
		} else {
			console.log('Unknown category:', categories[i])
		}
	}
	read_alignment_diff_scores_input.sort((a, b) => a.value - b.value)
	// console.log('Final array for plotting:', read_alignment_diff_scores_input)
	// Please use this array for plotting the scatter plot .values contain the numeric value, .groupID contains ref/alt/none status. You can use red for alt, green for ref and blue for none.
	const diff_list = read_alignment_diff_scores_input.map(i => i.value)
	const max_diff_score = Math.max(...diff_list)
	const min_diff_score = Math.min(...diff_list)
	const groups = []
	for (const k in type2group) {
		const g = type2group[k]
		if (g.templates.length == 0) continue // empty group, do not include
		if (k == bamcommon.type_supportamb) {
			if (g.templates.length == 1) {
				g.messages.push({
					isheader: true,
					t: g.templates.length + ' ambiguous read'
				})
			} else {
				g.messages.push({
					isheader: true,
					t: g.templates.length + ' ambiguous reads'
				})
			}
		} else {
			g.messages.push({
				isheader: true,
				t:
					g.templates.length +
					' reads supporting ' +
					(k == bamcommon.type_supportref
						? 'reference allele'
						: k == bamcommon.type_supportalt
						? 'alternate allele'
						: 'neither reference nor alternate alleles')
			})
		}
		g.widths = region_widths
		groups.push(g)
	}
	return {
		groups,
		refalleleerror,
		max_diff_score,
		min_diff_score,
		final_pos,
		final_ref,
		final_alt,
		strand_probability,
		strand_significance,
		refseq,
		altseq,
		leftflankseq,
		rightflankseq,
		alternate_forward_count,
		alternate_reverse_count,
		reference_forward_count,
		reference_reverse_count
	}
}
