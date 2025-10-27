import fs from 'fs'
import path from 'path'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'
import { spawn } from 'child_process'
import { Readable } from 'stream'
import readline from 'readline'
import * as bamcommon from './bam.common.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'

const features = serverconfig.features
const clustalo_read_alignment = serverconfig.clustalo

export async function match_complexvariant_rust(q, templates_info, region_widths) {
	//const segbplen = templates[0].segments[0].seq.length
	const segbplen = q.regions[0].lines[0].split('\t')[9].length // Check if this will work for multi-regions
	// need to verify if the retrieved sequence is showing 1bp offset or not

	let refalleleerror = false // Checking to see if reference allele is correct or not
	let variant_idx = 0
	let leftflankseqs = []
	let rightflankseqs = []
	let refalleles = []
	let altalleles = []
	let ref_positions = []
	let refseqs = []
	let altseqs = []
	if (!q.alleleAlreadyUpdated) {
		let variant_start_global // Its possible that the two different alleles start/end at different genomic positions, then their left/rightflankseq will be different for each allele. In such cases, select the left/rightflankseq which is longer. This involves selectng the start position of the left most variant.
		let variant_stop_global // Its possible that the two different alleles start/end at different genomic positions, then their left/rightflankseq will be different for each allele. In such cases, select the left/rightflankseq which is longer. This involves selectng the stop position of the right most variant.
		let variant_idx = 0
		for (const variant of q.variant) {
			let final_ref = ''
			let final_alt = ''
			if ((variant.ref.length == 0 || variant.ref == '-') && (variant.alt == '-' || variant.alt.length == 0)) {
				// Both ref and alt allele are missing
				throw 'Both Ref and Alt alleles are missing'
			} else if (variant.ref.length == 0 || variant.ref == '-') {
				final_ref = (await utils.get_fasta(q.genome, variant.chr + ':' + variant.pos + '-' + variant.pos))
					.split('\n')
					.slice(1)
					.join('')
					.toUpperCase()

				final_alt = final_ref + variant.alt // Adding flanking nucleotide before alternate allele
				variant.pos -= 1
			} else if (variant.alt == '-' || variant.alt.length == 0) {
				// Format is in 55589772.ACGA.- (standard notation 55589771.ACGA.A)
				const first_nucleotide = (await utils.get_fasta(q.genome, variant.chr + ':' + variant.pos + '-' + variant.pos))
					.split('\n')
					.slice(1)
					.join('')
					.toUpperCase()
				final_ref = first_nucleotide + variant.ref
				final_alt = first_nucleotide
				variant.pos -= 1
			} else {
				final_alt = variant.alt
				final_ref = variant.ref
			}

			const final_pos = variant.pos
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
			if (variant_idx == 0) {
				variant_start_global = final_pos - segbplen
				variant_stop_global = final_pos + final_ref.length + 1 + segbplen
			} else {
				if (final_pos - segbplen < variant_start_global) {
					variant_start_global = final_pos - segbplen
				}
				if (final_pos + final_ref.length + 1 + segbplen > variant_stop_global) {
					variant_stop_global = final_pos + final_ref.length + 1 + segbplen
				}
			}
			refalleles.push(refallele)
			altalleles.push(altallele)
			ref_positions.push(final_pos)
			variant_idx += 1
		}
		variant_idx = 0
		for (const variant of q.variant) {
			const leftflankseq = (
				await utils.get_fasta(q.genome, variant.chr + ':' + variant_start_global + '-' + ref_positions[variant_idx])
			)

				.split('\n')
				.slice(1)
				.join('')
				.toUpperCase()
			const rightflankseq = (
				await utils.get_fasta(
					q.genome,
					variant.chr +
						':' +
						(ref_positions[variant_idx] + refalleles[variant_idx].length + 1) +
						'-' +
						variant_stop_global
				)
			)
				.split('\n')
				.slice(1)
				.join('')
				.toUpperCase()

			//refseq = (
			//	await utils.get_fasta(
			//		q.genome,
			//		variant.chr + ':' + (final_pos - segbplen) + '-' + (final_pos + segbplen + final_ref.length + 1)
			//	)
			//)
			//	.split('\n')
			//	.slice(1)
			//	.join('')
			//	.toUpperCase()

			const refseq = leftflankseq + refalleles[variant_idx] + rightflankseq
			const altseq = leftflankseq + altalleles[variant_idx] + rightflankseq

			console.log(
				variant.chr + '.' + ref_positions[variant_idx] + '.' + refalleles[variant_idx] + '.' + altalleles[variant_idx]
			)
			//console.log('refseq', refseq)
			//console.log('altseq', altseq)
			//console.log('leftflankseq:', leftflankseq)
			//console.log('rightflankseq:', rightflankseq)
			// console.log(refallele,altallele,refseq,altseq)
			variant_idx += 1
			leftflankseqs.push(leftflankseq)
			rightflankseqs.push(rightflankseq)
			refseqs.push(refseq)
			altseqs.push(altseq)
		}
	} else {
		{
			leftflankseqs = q.leftflankseqs
			rightflankseqs = q.rightflankseqs
			refseqs = q.refseqs
			altseqs = q.altseqs
			refalleles = q.refalleles
			altalleles = q.altalleles
			ref_positions = q.ref_positions
		}

		if (
			refseqs[variant_idx]
				.toUpperCase()
				.localeCompare(
					(leftflankseqs[variant_idx] + refalleles[variant_idx] + rightflankseqs[variant_idx]).toUpperCase()
				) != 0
		) {
			console.log('Reference allele is not correct for variant ' + variant_idx)
			refalleleerror = true
		}
	}

	//----------------------------------------------------------------------------
	// IMPORTANT PARAMETERS
	const fisher_test_threshold = 60 // Fisher exact-test strand analysis significance parameter. See details in this weblink https://gatk.broadinstitute.org/hc/en-us/articles/360035890471
	const is_realignment_reads = 0 // Realign reads to obtain correct indel sequence (If 1 realignment of reads will be attempted, if 0 no realignment of reads will be performed )
	//----------------------------------------------------------------------------

	//const sequence_reads = templates_info.map(i => i.sam_info.split('\t')[9]).join('-')
	//const start_positions = templates_info.map(i => i.sam_info.split('\t')[3]).join('-')
	//const cigar_sequences = templates_info.map(i => i.sam_info.split('\t')[5]).join('-')
	//const sequence_flags = templates_info.map(i => i.sam_info.split('\t')[1]).join('-')
	//const refalleles_str = refalleles.map(i => i).join('-')
	//const altalleles_str = altalleles.map(i => i).join('-')
	//const ref_positions_str = ref_positions.map(i => i).join('-')
	//const refseqs_str = refseqs.map(i => i).join('-')
	//const altseqs_str = altseqs.map(i => i).join('-')
	//const leftflankseqs_str = leftflankseqs.map(i => i).join('-')
	//const rightflankseqs_str = rightflankseqs.map(i => i).join('-')

	const reads = []
	for (let i = 0; i < templates_info.length; i++) {
		const item = templates_info[i].sam_info.split('\t')
		reads.push({ read_sequence: item[9], start_position: Number(item[3]), cigar: item[5], flag: Number(item[1]) })
	}

	const alleles = []
	for (let i = 0; i < refalleles.length; i++) {
		alleles.push({
			ref_position: Number(ref_positions[i]),
			refallele: refalleles[i],
			altallele: altalleles[i],
			refseq: refseqs[i],
			altseq: altseqs[i],
			leftflankseq: leftflankseqs[i],
			rightflankseq: rightflankseqs[i]
		})
	}

	// This code has been added to parse input from example.bam.indel.html
	if (!Number.isFinite(Number(q.strictness))) {
		q.strictness = 1
	}

	const input_data = { reads: reads, alleles: alleles, strictness: Number(q.strictness) }

	//if (is_realignment_reads == 1) {
	//	// When realignment of reads is neccessary, quality scores and path to clustalo is passed for determining correct indel sequence (not functional, currently in development)
	//	const quality_scores = templates_info.map((i) => i.sam_info.split('\t')[10]).join('-')
	//	input_data += clustalo_read_alignment + '_' + quality_scores + '_' + is_realignment_reads
	//}

	/* uncomment this line to help creating tests at server/utils/test/indel.spec.js
	console.log('indel test:',{
		leftFlank:leftflankseq, rightFlank:rightflankseq,
		seqRef:refseq, seqMut:altseq,
		variant: q.variant
	})
	*/

	//console.log('input_data:', input_data)
	//fs.writeFile('test.txt', JSON.stringify(input_data), function (err) {
	//	// For catching input to rust pipeline, in case of an error
	//	if (err) return console.log(err)
	//})

	const time1 = new Date()
	const rust_output = await run_rust('indel', JSON.stringify(input_data))
	const time2 = new Date()
	console.log('Time taken to run rust indel pipeline:', time2 - time1, 'ms')
	const rust_output_list = rust_output.split('\n')
	let final_output
	let fisher_strand_output
	let group_ids = []
	let categories = []
	let diff_scores = []
	let strand_probability = 0 // Contains p_value of strand bias i.e forward/reverse vs alternate/reference
	let alternate_forward_count, alternate_reverse_count, reference_forward_count, reference_reverse_count
	for (let item of rust_output_list) {
		if (item.includes('Final_output:')) {
			final_output = JSON.parse(JSON.parse(item.replace('Final_output:', '')))
		} else if (refalleles.length == 1 && item.includes('fisher_strand:')) {
			fisher_strand_output = JSON.parse(item.replace('fisher_strand:', ''))
			alternate_forward_count = fisher_strand_output.alternate_forward_count
			alternate_reverse_count = fisher_strand_output.alternate_reverse_count
			reference_forward_count = fisher_strand_output.reference_forward_count
			reference_reverse_count = fisher_strand_output.reference_reverse_count
			strand_probability = fisher_strand_output.p_value
		} else {
			console.log(item)
		}
	}

	if (final_output.length == 0) throw 'No reads available for variant typing'

	let strand_significance = false
	if (q.variant.length == 1 && strand_probability > fisher_test_threshold) {
		// Check for strand significance only if one allele is defined by user
		strand_significance = true
	}

	//console.log("group_ids:",group_ids)
	//console.log("categories:",categories.length)
	//console.log("diff_scores:",diff_scores.length)
	//console.log('strand_probability:', strand_probability)
	//let index = 0
	const type2group = bamcommon.make_type2group(q)
	const possible_num_of_groups = q.variant.length + 3 // Number of alternate groups + ref group + none group + amb group

	let max_diff_score = 1
	for (let i = 0; i < final_output.length; i++) {
		const item = final_output[i]
		const index = item.read_number
		const categories = item.categories
		const category = item.categories[0] // Only the first item in this array, contains the actual classification. For ref/alts(s) this will be a single element array, for amb the additional elements will contain the alleles with which it has equal similarity and none will contain the allele with which it has maximum similarity
		const additional_fields = []
		if (categories.length > 1) {
			for (let i = 1; i < categories.length; i++) {
				// Starting from 1 because the first element contains the actual classification
				additional_fields.push(categories[i])
			}
			if (categories.length - 1 > max_diff_score) {
				max_diff_score = categories.length - 1
			}
		}
		if (category.includes('alt')) {
			// Checking with various alternate allele(s)
			for (let var_idx = 0; var_idx < q.variant.length; var_idx++) {
				if (category == 'alt' + var_idx.toString()) {
					if (type2group[bamcommon.type_supportalt + var_idx.toString()]) {
						templates_info[index].tempscore = ['alt' + var_idx.toString()]
						type2group[bamcommon.type_supportalt + var_idx.toString()].templates.push(templates_info[index])
					}
				}
			}
		} else if (category == 'ref') {
			if (type2group[bamcommon.type_supportref]) {
				templates_info[index].tempscore = ['ref']
				type2group[bamcommon.type_supportref].templates.push(templates_info[index])
			}
		} else if (category == 'none') {
			if (type2group[bamcommon.type_supportno]) {
				templates_info[index].tempscore = additional_fields
				type2group[bamcommon.type_supportno].templates.push(templates_info[index])
			}
		} else if (category == 'amb') {
			if (type2group[bamcommon.type_supportamb]) {
				templates_info[index].tempscore = additional_fields
				type2group[bamcommon.type_supportamb].templates.push(templates_info[index])
			}
		} else {
			// Should not happen
			console.log('Unaccounted group, please check')
		}
	}

	const groups_unsorted = []
	for (const k in type2group) {
		const g = type2group[k]
		if (g.templates.length == 0) continue // empty group, do not include
		if (k.includes(bamcommon.type_supportalt)) {
			for (let var_idx = 0; var_idx < q.variant.length; var_idx++) {
				if (k == bamcommon.type_supportalt + var_idx.toString()) {
					if (q.variant.length == 1) {
						// If there is only one allele present no need to print alternative allele as it is obvious
						if (g.templates.length == 1) {
							g.messages.push({
								isheader: true,
								t: g.templates.length + ' read supporting the alternative allele'
							})
						} else {
							g.messages.push({
								isheader: true,
								t: g.templates.length + ' reads supporting the alternative allele'
							})
						}
					} else {
						if (g.templates.length == 1) {
							g.messages.push({
								isheader: true,
								t: g.templates.length + ' read support the alternative allele with ' + altalleles[var_idx] + ' sequence'
							})
						} else {
							g.messages.push({
								isheader: true,
								t:
									g.templates.length + ' reads support the alternative allele with ' + altalleles[var_idx] + ' sequence'
							})
						}
					}
				}
			}
		} else if (k == bamcommon.type_supportamb) {
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
		} else if (k == bamcommon.type_supportref) {
			if (g.templates.length == 1) {
				g.messages.push({
					isheader: true,
					t: g.templates.length + ' read supporting the reference allele'
				})
			} else {
				g.messages.push({
					isheader: true,
					t: g.templates.length + ' reads supporting the reference allele'
				})
			}
		} else if (k == bamcommon.type_supportno) {
			if (g.templates.length == 1) {
				g.messages.push({
					isheader: true,
					t: g.templates.length + ' read supporting neither reference nor alternative alleles'
				})
			} else {
				g.messages.push({
					isheader: true,
					t: g.templates.length + ' reads supporting neither reference nor alternative alleles'
				})
			}
		} else {
			// Should not happen
			console.log('Unaccounted group, please check')
		}
		g.widths = region_widths
		groups_unsorted.push(g)
	}
	// Sorting groups in the order alternate allele(s), reference allele, none and ambiguous
	const min_diff_score = 0
	const groups = []
	for (let idx = 0; idx < groups_unsorted.length; idx++) {
		if (groups_unsorted[idx].type.includes('support_alt')) {
			groups.push(groups_unsorted[idx])
		}
	}
	for (let idx = 0; idx < groups_unsorted.length; idx++) {
		if (groups_unsorted[idx].type == 'support_ref') {
			groups.push(groups_unsorted[idx])
		}
	}
	for (let idx = 0; idx < groups_unsorted.length; idx++) {
		if (groups_unsorted[idx].type == 'support_no') {
			groups.push(groups_unsorted[idx])
		}
	}
	for (let idx = 0; idx < groups_unsorted.length; idx++) {
		if (groups_unsorted[idx].type == 'support_amb') {
			groups.push(groups_unsorted[idx])
		}
	}

	return {
		groups,
		refalleleerror,
		ref_positions,
		refalleles,
		altalleles,
		max_diff_score,
		min_diff_score,
		strand_probability,
		strand_significance,
		refseqs,
		altseqs,
		leftflankseqs,
		rightflankseqs,
		alternate_forward_count,
		alternate_reverse_count,
		reference_forward_count,
		reference_reverse_count
	}
}
