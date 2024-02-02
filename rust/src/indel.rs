// Syntax: cd .. && cargo build --release

// Test case below:
//Debug syntax: cd .. && cargo build --release && time cat ~/sjpp/test.txt | ~/sjpp/proteinpaint/rust/target/release/indel

// Strictness:
//   0: No postprocessing, pure indel typing results
//   1: Postprocessing will be carried out (Checks if read is polyclonal, reads with insertion near indel but classified as reference by identity ratio algorithm is put into none category)

// Function cascade:
//
// Optimize ref/alt allele given by user
// preprocess_input() (Optimizing ref/alt allele entered by user to account for flanking repeat regions. This is accomplished by modifying variant_pos (optimized_variant_pos) and indel_length (optimized_indel_length) to account for repeats present on either or both sides of the predicted variant region. For e.g A-AT in the region CACA{T}TTTTGCGA will become ATTTT-ATTTTT)
//       check_if_repeat_inside_indel() (This functions helps to determine if the indel is part of a repeat such as a tandem repeat within the indel sequence)
//       check_flanking_sequence_for_repeats() (Checks if the monomer or indel is repeated on either or both sides of the predicted indel region)
//
// if number of reads > single_thread_limit (multithreading option is turned on)
//
// Analyze each read
//   for each read {
//      check_read_within_indel_region() (Checks if the read contains indel region)
//      check_polyclonal_with_read_alignment() (checking if read is polyclonal)
//      percentage identity w.r.t ref allele = align_single_reads(sequence, reference sequence)
//      percentage identity w.r.t alt allele = align_single_reads(sequence, alternate sequence)
//      diff_score = percentage identity w.r.t alt allele - percentage identity w.r.t ref allele
//      if diff_score > 0 classify read as alt; else classify read as ref ; else if diff_score = 0 classify read as ambiguous
//   }
//
// classify_to_four_categories() (classify into ref,alt,none and amb)
// Other post_processing:
//     if polyclonal, classify as none
//     if ref classified read, but contains inserted/deleted nucleotides in indel region, classify as none
//
// Strand analysis:
// strand_analysis() (Inputs alternate_forward, alternate_reverse, reference_forward, reference_reverse and outputs final phred scale p-value)
//       if number of reads < fisher_limit
//          choose fisher-test
//       else chi-square test
//       strand_analysis_one_iteration (Selects whether to use fisher or chi-sq test depending upon number of reads)
//              chi_square_test
//              fishers_exact_test

use json::object;
use json::JsonValue;
use serde::{Deserialize, Serialize};
//use serde_json::json as other_json;
//use serde_json::Value;
use std::cmp;
use std::cmp::Ordering;
//use std::env;
use std::sync::{Arc, Mutex}; // Multithreading library
use std::thread;
//use std::time::{SystemTime};
use std::io;

mod realign; // Imports functions from realign.rs
mod stats_functions; // Imports functions from stats_functions.rs

#[derive(Debug, Clone)]
struct ReadComparison {
    comparison: f64,
    index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReadClassification {
    read_number: usize,
    categories: Vec<String>,
}

//impl ReadClassification {
//    fn to_owned(item: &ReadClassification) -> ReadClassification {
//        let read_number = item.read_number.to_owned();
//        let categories = item.categories.to_vec();
//
//        ReadClassification {
//            read_number: read_number,
//            categories: categories,
//        }
//    }
//}

fn main() {
    let mut input = String::new();
    //env::set_var("RUST_BACKTRACE", "1");
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_bytes_read) => {
            //println!("{} bytes read", bytes_read);
            //println!("{}", input);
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    //println!("json_string:{:?}", json_string);
                    let alleles_list: &JsonValue = &json_string["alleles"];
                    let reads_list: &JsonValue = &json_string["reads"];
                    let strictness: usize = json_string["strictness"].as_usize().unwrap();

                    let mut sequences: String = "".to_string();
                    let mut cigar_sequences: String = "".to_string();
                    let mut start_positions: String = "".to_string();
                    let mut sequence_flags: String = "".to_string();
                    for i in 0..reads_list.len() {
                        let item = &reads_list[i];
                        sequences.push_str(
                            &(item["read_sequence"].as_str().unwrap().to_string()
                                + &"-".to_string())
                                .to_string(),
                        );
                        start_positions.push_str(
                            &(item["start_position"].as_usize().unwrap().to_string()
                                + &"-".to_string())
                                .to_string(),
                        );
                        cigar_sequences.push_str(
                            &(item["cigar"].as_str().unwrap().to_string() + &"-".to_string())
                                .to_string(),
                        );
                        sequence_flags.push_str(
                            &(item["flag"].as_usize().unwrap().to_string() + &"-".to_string())
                                .to_string(),
                        );
                    }
                    sequences.pop();
                    start_positions.pop();
                    cigar_sequences.pop();
                    sequence_flags.pop();
                    let sequences_list: Vec<&str> = sequences.split("-").collect(); // Vector containing list of sequences, the first two containing ref and alt.
                    let start_positions_list: Vec<&str> = start_positions.split("-").collect(); // Vector containing start positions
                    let cigar_sequences_list: Vec<&str> = cigar_sequences.split("-").collect(); // Vector containing cigar sequences
                    let sequence_flags_list: Vec<&str> = sequence_flags.split("-").collect(); // Vector containing sam flag of read sequences

                    //println!("sequences_list:{:?}", sequences_list);

                    let mut refalleles: String = "".to_string();
                    let mut altalleles: String = "".to_string();
                    let mut refseqs: String = "".to_string();
                    let mut altseqs: String = "".to_string();
                    let mut leftflankseqs: String = "".to_string();
                    let mut rightflankseqs: String = "".to_string();
                    let mut variant_positions: String = "".to_string();
                    for i in 0..alleles_list.len() {
                        let item = &alleles_list[i];
                        //println!("item:{:?}", item);
                        refalleles.push_str(
                            &(item["refallele"].as_str().unwrap().to_string() + &"-".to_string())
                                .to_string(),
                        );
                        altalleles.push_str(
                            &(item["altallele"].as_str().unwrap().to_string() + &"-".to_string())
                                .to_string(),
                        );
                        refseqs.push_str(
                            &(item["refseq"].as_str().unwrap().to_string() + &"-".to_string())
                                .to_string(),
                        );
                        altseqs.push_str(
                            &(item["altseq"].as_str().unwrap().to_string() + &"-".to_string())
                                .to_string(),
                        );
                        leftflankseqs.push_str(
                            &(item["leftflankseq"].as_str().unwrap().to_string()
                                + &"-".to_string())
                                .to_string(),
                        );
                        rightflankseqs.push_str(
                            &(item["rightflankseq"].as_str().unwrap().to_string()
                                + &"-".to_string())
                                .to_string(),
                        );
                        variant_positions.push_str(
                            &(item["ref_position"].as_usize().unwrap().to_string()
                                + &"-".to_string())
                                .to_string(),
                        );
                    }
                    refalleles.pop();
                    altalleles.pop();
                    refseqs.pop();
                    altseqs.pop();
                    leftflankseqs.pop();
                    rightflankseqs.pop();
                    variant_positions.pop();

                    let mut variant_positions_list = Vec::<i64>::new();
                    let variant_positions_str: Vec<&str> = variant_positions.split("-").collect();
                    for item in variant_positions_str {
                        variant_positions_list.push(item.parse::<i64>().unwrap());
                    }

                    let refalleles_list: Vec<&str> = refalleles.split("-").collect(); // Vector of ref alleles for each SNV/indel
                    let altalleles_list: Vec<&str> = altalleles.split("-").collect();
                    // Vector of alt alleles for each SNV/indel
                    let refseqs_list: Vec<&str> = refseqs.split("-").collect(); // Vector of refseqs for each SNV/indel
                    let altseqs_list: Vec<&str> = altseqs.split("-").collect(); // Vector of altseqs for each SNV/indel

                    let leftflankseqs_list: Vec<&str> = leftflankseqs.split("-").collect(); // Vector of leftflankseqs for each SNV/indel
                    let rightflankseqs_list: Vec<&str> = rightflankseqs.split("-").collect(); // Vector of rightflankseqs for each SNV/indel
                    let surrounding_region_length: i64 = 80; // Flanking region on both sides upto which it will search for duplicate kmers

                    let mut indel_lengths_list = Vec::<usize>::new();
                    let mut indel_lengths = "".to_string();
                    let mut left_most_pos_of_all_indels: i64 = variant_positions_list[0]; // The left most position among all indels being considered, initializing to start position of first variant
                    let mut right_most_pos_of_all_indels: i64 = variant_positions_list[0]
                        + cmp::max(refalleles_list[0].len(), altalleles_list[0].len()) as i64; // The right most position among all indels being considered, initializing to start position of first variant
                    let mut alt_allele_names_list = Vec::<String>::new();
                    let mut alt_allele_names = "".to_string();
                    for indel_idx in 0..variant_positions_list.len() {
                        alt_allele_names_list.push("alt".to_string() + &indel_idx.to_string());
                        alt_allele_names
                            .push_str(&("alt".to_string() + &indel_idx.to_string()).to_string());
                        alt_allele_names.push_str(&"-".to_string());
                        let variant_pos: i64 = variant_positions_list[indel_idx]; // Variant position
                        let refallele: String =
                            refalleles_list[indel_idx].parse::<String>().unwrap(); // Reference allele
                        let altallele: String =
                            altalleles_list[indel_idx].parse::<String>().unwrap(); // Alternate allele

                        // Checking the left-most and right-most position among all indels
                        if left_most_pos_of_all_indels > variant_pos {
                            left_most_pos_of_all_indels = variant_pos;
                        }

                        if right_most_pos_of_all_indels
                            < variant_pos
                                + cmp::max(
                                    refalleles_list[indel_idx].len(),
                                    altalleles_list[indel_idx].len(),
                                ) as i64
                        {
                            right_most_pos_of_all_indels = variant_pos
                                + cmp::max(
                                    refalleles_list[indel_idx].len(),
                                    altalleles_list[indel_idx].len(),
                                ) as i64;
                        }

                        let leftflankseq: String =
                            leftflankseqs_list[indel_idx].parse::<String>().unwrap(); //Left flanking sequence
                        let rightflankseq: String =
                            rightflankseqs_list[indel_idx].parse::<String>().unwrap(); //Right flanking sequence.

                        //let fisher_test_threshold: f64 = (10.0).powf((args[14].parse::<f64>().unwrap()) / (-10.0)); // Significance value for strand_analysis (NOT in phred scale)
                        //let rightflank_nucleotides: Vec<char> = rightflankseq.chars().collect(); // Vector containing right flanking nucleotides
                        let ref_nucleotides: Vec<char> = refallele.chars().collect(); // Vector containing ref nucleotides
                        let alt_nucleotides: Vec<char> = altallele.chars().collect(); // Vector containing alt nucleotides
                        let ref_length: i64 = refallele.len() as i64; // Determining length of ref allele
                        let alt_length: i64 = altallele.len() as i64; // Determining length of alt allele
                        let mut indel_length: i64 = alt_length; // Determining indel length, in case of an insertion it will be alt_length. In case of a deletion, it will be ref_length
                        if ref_length > alt_length {
                            indel_length = ref_length;
                        }

                        // Preprocessing of input
                        let (optimized_variant_pos, optimized_indel_length) = preprocess_input(
                            &ref_nucleotides,
                            &alt_nucleotides,
                            variant_pos,
                            indel_length,
                            leftflankseq,
                            rightflankseq,
                            surrounding_region_length,
                        );

                        if indel_length != optimized_indel_length {
                            indel_length = optimized_indel_length;
                        }

                        println!("optimized_variant_pos:{}", optimized_variant_pos);
                        println!("optimized_indel_length:{}", optimized_indel_length);
                        //println!("ref_allele:{}", &refallele);
                        //println!("alt_allele:{}", &altallele);
                        indel_lengths_list.push(indel_length as usize);
                        indel_lengths.push_str(&indel_length.to_string());
                        indel_lengths.push_str(&"-".to_string());
                        //drop(rightflank_nucleotides);
                    }
                    indel_lengths.pop(); // Removing the last "-" from string
                    alt_allele_names.pop(); // Removing the last "-" from string

                    //println!("rightflank_nucleotides:{:?}", rightflank_nucleotides);
                    let single_thread_limit: usize = 1000; // If total number of reads is lower than this value the reads will be parsed sequentially in a single thread, if greaterreads will be parsed in parallel
                    let max_threads: usize = 7; // Max number of threads in case the parallel processing of reads is invoked

                    //println!("indel_length:{}", indel_length);

                    //if args.len() > 14 {
                    //    // This is true when realigning reads to determine correct indel sequence. Currently in development (not functional)
                    //    let clustalo_path: String = args[14].parse::<String>().unwrap(); // Removing "\n" from the end of the string
                    //    let quality_scores: String = args[15].parse::<String>().unwrap(); // Variable contains quality scores of reads separated by "-" character
                    //    realign::realign_reads(
                    //        &sequences,
                    //        &start_positions,
                    //        &cigar_sequences,
                    //        &quality_scores,
                    //        &clustalo_path,
                    //        &lines[0].to_string(),
                    //        &lines[1].to_string(),
                    //        variant_pos,
                    //        indel_length,
                    //    );
                    //}

                    //let mut all_alleles = Vec::<ReadClassification>::new();
                    let mut alternate_forward_count: u32 = 0; // Alternate forward read counter
                    let mut alternate_reverse_count: u32 = 0; // Alternate reverse read counter
                    let mut reference_forward_count: u32 = 0; // Reference forward read counter
                    let mut reference_reverse_count: u32 = 0; // Reference reverse read counter
                    let mut output_string = "[".to_string();
                    if sequences_list.len() <= single_thread_limit {
                        // Start of sequential single-thread implementation for classifying reads
                        let mut i: i64 = 0;
                        //let num_of_reads: f64 = sequences_list.len() as f64;
                        for read in sequences_list {
                            // The first two sequences are reference and alternate allele and therefore skipped. Also checking there are no blank lines in the input file
                            let (
                                within_indel,
                                correct_start_positions,
                                correct_end_positions,
                                alignment_sides,
                                spliced_sequences,
                            ) = realign::check_read_within_indel_region(
                                // Checks if the read contains the indel region (or a part of it)
                                start_positions_list[i as usize].parse::<i64>().unwrap() - 1,
                                cigar_sequences_list[i as usize].to_string(),
                                &variant_positions_list,
                                &indel_lengths_list,
                                &refalleles_list,
                                &altalleles_list,
                                strictness,
                                read.to_string(),
                            );
                            //println!("correct_start_positions:{:?}", correct_start_positions);
                            //println!("correct_end_positions:{:?}", correct_end_positions);
                            //println!(
                            //    "cigar_sequence:{}",
                            //    &cigar_sequences_list[i as usize].to_string()
                            //);
                            //println!("within_indel:{}", within_indel);
                            if within_indel == 1 {
                                // Checking if the read is in forward or reverse strand
                                let mut sequence_strand: String = "F".to_string(); // Initializing sequence strand to forward
                                if sequence_flags_list[i as usize].parse::<i64>().unwrap() & 16
                                    == 16
                                {
                                    sequence_strand = "R".to_string();
                                }
                                //let mut read_ambiguous = check_if_read_ambiguous(
                                //    // Function that checks if the start/end of a read is in a region such that it cannot be distinguished as supporting ref or alt allele
                                //    correct_start_position,
                                //    correct_end_position,
                                //    left_offset,
                                //    right_offset,
                                //    variant_pos,
                                //    refallele.len(),
                                //    &ref_nucleotides,
                                //    &alt_nucleotides,
                                //    optimized_allele,
                                //);

                                //println!("read_ambiguous:{}", read_ambiguous);
                                //println!("ref_insertion:{}", ref_insertion);

                                let mut alt_comparisons = Vec::<ReadComparison>::new();
                                let mut ref_comparisons = Vec::<ReadComparison>::new();
                                let mut indel_nones = Vec::<bool>::new();
                                let mut ref_polyclonal_read_status_global: i64 = 0;
                                let mut alt_polyclonal_read_status_global: i64 = 1;
                                let mut ref_polyclonal_read_statuses = Vec::<i64>::new();
                                let mut alt_polyclonal_read_statuses = Vec::<i64>::new();
                                for indel_idx in 0..variant_positions_list.len() {
                                    let spliced_sequence = &spliced_sequences[indel_idx];
                                    let reference_sequence = refseqs_list[indel_idx];
                                    let alternate_sequence = altseqs_list[indel_idx];
                                    let (q_seq_ref, align_ref, r_seq_ref, ref_comparison) =
                                        realign::align_single_reads(
                                            &spliced_sequence,
                                            reference_sequence.to_string(),
                                        );

                                    let (q_seq_alt, align_alt, r_seq_alt, alt_comparison) =
                                        realign::align_single_reads(
                                            &spliced_sequence,
                                            alternate_sequence.to_string(),
                                        );
                                    alt_comparisons.push(ReadComparison {
                                        comparison: alt_comparison,
                                        index: indel_idx,
                                    });
                                    ref_comparisons.push(ReadComparison {
                                        comparison: ref_comparison,
                                        index: indel_idx,
                                    });

                                    //println!("indel_idx:{}", indel_idx);
                                    //println!("alt allele:{}", altalleles_list[indel_idx]);
                                    //println!("ref_comparison:{}", ref_comparison);
                                    //println!("alt_comparison:{}", alt_comparison);

                                    let (ref_polyclonal_read_status, alt_polyclonal_read_status);
                                    if strictness == 0 {
                                        ref_polyclonal_read_status = 0;
                                        alt_polyclonal_read_status = 0;
                                    } else {
                                        let (
                                            ref_polyclonal_read_status_temp,
                                            alt_polyclonal_read_status_temp,
                                        ) = check_polyclonal_with_read_alignment(
                                            &alignment_sides[indel_idx],
                                            &q_seq_alt,
                                            &q_seq_ref,
                                            &r_seq_alt,
                                            &r_seq_ref,
                                            &align_alt,
                                            &align_ref,
                                            correct_start_positions[indel_idx],
                                            correct_end_positions[indel_idx],
                                            variant_positions_list[indel_idx],
                                            refalleles_list[indel_idx].len(),
                                            altalleles_list[indel_idx].len(),
                                            indel_lengths_list[indel_idx],
                                            variant_positions_list.len(),
                                        );
                                        ref_polyclonal_read_status =
                                            ref_polyclonal_read_status_temp;
                                        alt_polyclonal_read_status =
                                            alt_polyclonal_read_status_temp;
                                    }
                                    if ref_polyclonal_read_status == 1 {
                                        ref_polyclonal_read_status_global = 1;
                                    }
                                    if alt_polyclonal_read_status == 0 {
                                        alt_polyclonal_read_status_global = 0;
                                    }
                                    let mut indel_none: bool = false;
                                    if ref_polyclonal_read_status == 1
                                        && alt_polyclonal_read_status == 1
                                    {
                                        indel_none = true;
                                    }
                                    //println!("indel_none:{}", indel_none);
                                    indel_nones.push(indel_none);
                                    //println!(
                                    //    "ref_polyclonal_read_status:{}",
                                    //    ref_polyclonal_read_status
                                    //);
                                    //println!(
                                    //    "alt_polyclonal_read_status:{}",
                                    //    alt_polyclonal_read_status
                                    //);
                                    ref_polyclonal_read_statuses.push(ref_polyclonal_read_status);
                                    alt_polyclonal_read_statuses.push(alt_polyclonal_read_status);
                                }

                                // Sorting in ascending order so as to check if the read is ambiguous or not
                                alt_comparisons.as_mut_slice().sort_by(|a, b| {
                                    (a.comparison)
                                        .partial_cmp(&b.comparison)
                                        .unwrap_or(Ordering::Equal)
                                });
                                ref_comparisons.as_mut_slice().sort_by(|a, b| {
                                    (a.comparison)
                                        .partial_cmp(&b.comparison)
                                        .unwrap_or(Ordering::Equal)
                                });

                                let mut max_index = 0;
                                let mut refalt = "ref".to_string();
                                let mut max_alignment_ref: f64 = 0.0;
                                let mut max_index_ref: usize = 0;
                                for alignment_idx in 0..ref_comparisons.len() {
                                    if ref_comparisons[alignment_idx].comparison > max_alignment_ref
                                    {
                                        max_alignment_ref =
                                            ref_comparisons[alignment_idx].comparison;
                                        max_index_ref = ref_comparisons[alignment_idx].index;
                                    }
                                }

                                let mut read_ambiguous = 0;
                                let mut equal_alignment_indices = Vec::<usize>::new();
                                let mut max_alignment_alt: f64 = 0.0;
                                let mut max_index_alt: usize = 0;
                                for alignment_idx in 0..alt_comparisons.len() {
                                    //println!("max_index_alt:{}", max_index_alt);
                                    //println!(
                                    //    "indel_nones[alignment_idx]:{}",
                                    //    indel_nones[alignment_idx]
                                    //);
                                    //println!("alignment_idx:{}", alignment_idx);
                                    //println!(
                                    //    "ref_polyclonal_read_status_global:{}",
                                    //    ref_polyclonal_read_status_global
                                    //);
                                    //println!(
                                    //    "alt_polyclonal_read_status_global:{}",
                                    //    alt_polyclonal_read_status_global
                                    //);
                                    if alt_comparisons[alignment_idx].comparison > max_alignment_alt
                                        && indel_nones[alt_comparisons[alignment_idx].index]
                                            == false
                                        && alt_polyclonal_read_statuses
                                            [alt_comparisons[alignment_idx].index]
                                            != 1
                                    {
                                        max_alignment_alt =
                                            alt_comparisons[alignment_idx].comparison;
                                        max_index_alt = alt_comparisons[alignment_idx].index;
                                    } else if ref_polyclonal_read_status_global != 1
                                        || alt_polyclonal_read_status_global != 1
                                    // If the read is going to be classified as none, no need to check if it is ambiguous
                                    {
                                        if alignment_idx == 0 {
                                        } else {
                                            //println!("alt_comparisons:{:?}", alt_comparisons);
                                            for sub_alignment_idx in 0..alignment_idx {
                                                let alt_comparison1 = alt_comparisons
                                                    .iter()
                                                    .find(|x| x.index == sub_alignment_idx);
                                                let alt_comparison2 = alt_comparisons
                                                    .iter()
                                                    .find(|x| x.index == alignment_idx);
                                                if alt_comparison1.unwrap().comparison
                                                    == alt_comparison2.unwrap().comparison
                                                {
                                                    equal_alignment_indices.push(sub_alignment_idx);
                                                    equal_alignment_indices.push(alignment_idx);
                                                    //println!(
                                                    //    "sub_alignment_idx:{}",
                                                    //    sub_alignment_idx
                                                    //);
                                                    //println!("alignment_idx:{}", alignment_idx);
                                                    read_ambiguous = 1;
                                                    max_alignment_alt =
                                                        alt_comparison1.unwrap().comparison;
                                                    max_index_alt =
                                                        alt_comparisons[alignment_idx].index;
                                                }
                                            }
                                        }
                                    } else if alt_polyclonal_read_statuses
                                        [alt_comparisons[alignment_idx].index]
                                        == 1
                                        && ref_polyclonal_read_statuses
                                            [ref_comparisons[alignment_idx].index]
                                            == 0
                                    // This logic is kind of side stepping the smith-watermann alignment and classifying on the basis of nucleotide-by-nucleotide comparison (not sure if this will work in all cases or any other possible side effects)
                                    {
                                        max_alignment_ref =
                                            ref_comparisons[alignment_idx].comparison;
                                        max_index_ref = ref_comparisons[alignment_idx].index;
                                    } else if alt_comparisons[alignment_idx].comparison
                                        > max_alignment_alt
                                    // Should this logic be placed at the top ?
                                    {
                                        max_alignment_alt =
                                            alt_comparisons[alignment_idx].comparison;
                                        max_index_alt = alt_comparisons[alignment_idx].index;
                                    }
                                }

                                //println!("max_alignment_alt:{}", max_alignment_alt);
                                //println!("max_alignment_ref:{}", max_alignment_ref);
                                let mut ref_is_ambiguous = false; // Flag which is true/false when ref allele is one of the reads that is ambiguous for a particular read
                                if max_alignment_alt > max_alignment_ref {
                                    //max_alignment = max_alignment_alt;
                                    max_index = max_index_alt;
                                    refalt = "alt".to_string();
                                } else if max_alignment_alt < max_alignment_ref {
                                    //max_alignment = max_alignment_ref;
                                    max_index = max_index_ref;
                                    refalt = "ref".to_string();
                                } else if max_alignment_alt == max_alignment_ref {
                                    //max_alignment = max_alignment_ref;
                                    //println!(
                                    //    "Ambiguous case between one of the alt alleles and the ref"
                                    //);
                                    read_ambiguous = 1;
                                    //if equal_alignment_indices.iter().any(|&i| i == max_index_alt) {
                                    //} else {
                                    //    equal_alignment_indices.push(max_index_alt);
                                    //    ref_is_ambiguous = true;
                                    //}
                                    equal_alignment_indices.push(max_index_alt);
                                    ref_is_ambiguous = true;
                                }
                                equal_alignment_indices.sort();
                                equal_alignment_indices.dedup();
                                //println!("equal_alignment_indices:{:?}", equal_alignment_indices);
                                // Check if the read does not support any of the reference or alternate alleles
                                if ((ref_polyclonal_read_status_global == 1
                                    && alt_polyclonal_read_status_global == 1)
                                    || (ref_polyclonal_read_status_global == 1
                                        && alt_polyclonal_read_status_global == 0
                                        && refalt == "ref".to_string())) // The 2nd condition is experimental and was observed in case of deletion in repeat region. Somehow alt_polyclonal_read_status_global was 0 so it got classifed into ref allele although it does not support ref allele. 
                                    && strictness == 1
                                {
                                    // Setting read to none
                                    //if !all_alleles.contains_key(&"none".to_string()) {
                                    //    all_alleles.insert("none".to_string(), Vec::new());
                                    //}
                                    //all_alleles
                                    //    .get_mut(&"none".to_string())
                                    //    .unwrap()
                                    //    .push(i as usize);
                                    //if all_alleles["none"] == other_json!(null) {
                                    //    all_alleles["none"] = other_json!(vec![i]);
                                    //} else {
                                    //    all_alleles["none"]
                                    //        .as_array_mut()
                                    //        .unwrap()
                                    //        .push(other_json!(i));
                                    //}

                                    let mut none_groups_for_each_read = Vec::<String>::new(); // When a read is assigned to none group, the first entry in the vector is "none", followed by the group with which it has maximum sequence similarity
                                    none_groups_for_each_read.push("none".to_string());

                                    if refalt == "ref".to_string() {
                                        none_groups_for_each_read.push("ref".to_string())
                                    } else if refalt == "alt".to_string() {
                                        let alt_allele_name =
                                            alt_allele_names_list[max_index].to_string();
                                        none_groups_for_each_read.push(alt_allele_name);
                                    }
                                    //all_alleles[i.to_string()] =
                                    //    other_json!(none_groups_for_each_read);
                                    //all_alleles.push(ReadClassification {
                                    //    read_number: i as usize,
                                    //    categories: none_groups_for_each_read,
                                    //});
                                    //output_string += &json::stringify(object! {
                                    //    read_number: i as usize,
                                    //    categories: none_groups_for_each_read,
                                    //});
                                    output_string += &serde_json::to_string(&ReadClassification {
                                        read_number: i as usize,
                                        categories: none_groups_for_each_read,
                                    })
                                    .unwrap();
                                    output_string += &",".to_string();
                                } else if read_ambiguous == 1 {
                                    // Setting read to ambiguous

                                    //if !all_alleles.contains_key(&"amb".to_string()) {
                                    //    all_alleles.insert("amb".to_string(), Vec::new());
                                    //}
                                    //all_alleles
                                    //    .get_mut(&"amb".to_string())
                                    //    .unwrap()
                                    //    .push(i as usize);

                                    //if all_alleles["amb"] == other_json!(null) {
                                    //    all_alleles["amb"] = other_json!(vec![i]);
                                    //} else {
                                    //    all_alleles["amb"]
                                    //        .as_array_mut()
                                    //        .unwrap()
                                    //        .push(other_json!(i));
                                    //}
                                    let mut ambiguous_groups_for_each_read = Vec::<String>::new(); // When a read is asigned to ambiguous group, the first entry in the vector is "amb". Subsequent entries are for each group with which the read has equal sequence similarity with
                                    ambiguous_groups_for_each_read.push("amb".to_string());
                                    for eq_alignment_idx in 0..equal_alignment_indices.len() {
                                        //println!(
                                        //    "eq_alignment_idx:{}",
                                        //    equal_alignment_indices[eq_alignment_idx]
                                        //);
                                        ambiguous_groups_for_each_read.push(
                                            alt_allele_names_list
                                                [equal_alignment_indices[eq_alignment_idx]]
                                                .to_string(),
                                        );
                                    }
                                    if ref_is_ambiguous == true {
                                        ambiguous_groups_for_each_read.push("ref".to_string());
                                    }
                                    //all_alleles.push(ReadClassification {
                                    //    read_number: i as usize,
                                    //    categories: ambiguous_groups_for_each_read,
                                    //});
                                    //output_string += &json::stringify(object! {
                                    //    read_number: i as usize,
                                    //    categories: ambiguous_groups_for_each_read,
                                    //});
                                    //println!(
                                    //    "ambiguous_groups_for_each_read:{:?}",
                                    //    ambiguous_groups_for_each_read
                                    //);
                                    output_string += &serde_json::to_string(&ReadClassification {
                                        read_number: i as usize,
                                        categories: ambiguous_groups_for_each_read,
                                    })
                                    .unwrap();
                                    output_string += &",".to_string();
                                } else if refalt == "ref".to_string() {
                                    //all_alleles.push(ReadClassification {
                                    //    read_number: i as usize,
                                    //    categories: vec!["ref".to_string()],
                                    //});
                                    //output_string += &json::stringify(object! {
                                    //    read_number: i as usize,
                                    //    categories: vec!["ref".to_string()],
                                    //});
                                    output_string += &serde_json::to_string(&ReadClassification {
                                        read_number: i as usize,
                                        categories: vec!["ref".to_string()],
                                    })
                                    .unwrap();
                                    output_string += &",".to_string();
                                    if variant_positions_list.len() == 1 // Forward/reverse for reference/alternate allele is only counted for single allele variants
                                && sequence_strand == "R".to_string()
                                    {
                                        reference_reverse_count += 1;
                                    } else if variant_positions_list.len() == 1 // Forward/reverse for reference/alternate allele is only counted for single allele variants
                                && sequence_strand == "F".to_string()
                                    {
                                        reference_forward_count += 1;
                                    }
                                } else if refalt == "alt".to_string() {
                                    // Setting read to alt
                                    // Determine which alt allele read needs to be classified into
                                    let alt_allele_name =
                                        alt_allele_names_list[max_index].to_string();
                                    //if !all_alleles.contains_key(alt_allele_name) {
                                    //    all_alleles.insert(alt_allele_name.to_string(), Vec::new());
                                    //}
                                    //all_alleles
                                    //    .get_mut(alt_allele_name)
                                    //    .unwrap()
                                    //    .push(i as usize);

                                    //if all_alleles[alt_allele_name] == other_json!(null) {
                                    //    all_alleles[alt_allele_name] = other_json!(vec![i]);
                                    //} else {
                                    //    all_alleles[alt_allele_name]
                                    //        .as_array_mut()
                                    //        .unwrap()
                                    //        .push(other_json!(i));
                                    //}

                                    //all_alleles[i.to_string()] =
                                    //    other_json!(vec![alt_allele_name.to_string()]);
                                    //all_alleles.push(ReadClassification {
                                    //    read_number: i as usize,
                                    //    categories: vec![alt_allele_name],
                                    //});
                                    output_string += &serde_json::to_string(&ReadClassification {
                                        read_number: i as usize,
                                        categories: vec![alt_allele_name],
                                    })
                                    .unwrap();
                                    //output_string += &json::stringify(object! {
                                    //    read_number: i as usize,
                                    //    categories: vec![alt_allele_name],
                                    //});
                                    output_string += &",".to_string();
                                    if variant_positions_list.len() == 1 // Forward/reverse for reference/alternate allele is only counted for single allele variants
                                && sequence_strand == "R".to_string()
                                    {
                                        alternate_reverse_count += 1;
                                    } else if variant_positions_list.len() == 1 // Forward/reverse for reference/alternate allele is only counted for single allele variants
                                && sequence_strand == "F".to_string()
                                    {
                                        alternate_forward_count += 1;
                                    }
                                } else {
                                    // Should not happen
                                    println!("Unaccounted scenario, please check!");
                                }
                            }
                            i += 1;
                        }
                    } else {
                        // Multithreaded implementation for parsing reads in parallel starts from here
                        // Generally in rust one variable only own a data at a time, but `Arc` keyword is special and allows for multiple threads to access the same data.

                        let sequences = Arc::new(sequences);
                        let start_positions = Arc::new(start_positions);
                        let cigar_sequences = Arc::new(cigar_sequences);
                        let variant_positions = Arc::new(variant_positions);
                        let indel_lengths = Arc::new(indel_lengths);
                        let refalleles = Arc::new(refalleles);
                        let altalleles = Arc::new(altalleles);
                        let refseqs = Arc::new(refseqs);
                        let altseqs = Arc::new(altseqs);
                        let indel_lengths = Arc::new(indel_lengths);
                        let alt_allele_names = Arc::new(alt_allele_names);
                        let sequence_flags = Arc::new(sequence_flags);
                        //let all_alleles_temp =
                        //    Arc::new(Mutex::new(Vec::<ReadClassification>::new()));
                        let output_string_temp = Arc::new(Mutex::new(String::new()));
                        let alternate_forward_count_temp = Arc::new(Mutex::<u32>::new(0));
                        let alternate_reverse_count_temp = Arc::new(Mutex::<u32>::new(0));
                        let reference_forward_count_temp = Arc::new(Mutex::<u32>::new(0));
                        let reference_reverse_count_temp = Arc::new(Mutex::<u32>::new(0));

                        let mut handles = vec![]; // Vector to store handle which is used to prevent one thread going ahead of another

                        for thread_num in 0..max_threads {
                            // Assigning thread number thread_num to each thread
                            // In the next few lines each variable gets cloned, so that each thread has its own copy of the variable
                            let sequences = Arc::clone(&sequences);
                            let start_positions = Arc::clone(&start_positions);
                            let cigar_sequences = Arc::clone(&cigar_sequences);
                            let sequence_flags = Arc::clone(&sequence_flags);
                            //let all_alleles_temp = Arc::clone(&all_alleles_temp);
                            let alt_allele_names = Arc::clone(&alt_allele_names);
                            let output_string_temp = Arc::clone(&output_string_temp);
                            let alternate_forward_count_temp =
                                Arc::clone(&alternate_forward_count_temp);
                            let alternate_reverse_count_temp =
                                Arc::clone(&alternate_reverse_count_temp);
                            let reference_forward_count_temp =
                                Arc::clone(&reference_forward_count_temp);
                            let reference_reverse_count_temp =
                                Arc::clone(&reference_reverse_count_temp);
                            let indel_lengths = Arc::clone(&indel_lengths);
                            let alt_allele_names = Arc::clone(&alt_allele_names);
                            let refalleles = Arc::clone(&refalleles);
                            let altalleles = Arc::clone(&altalleles);
                            let refseqs = Arc::clone(&refseqs);
                            let altseqs = Arc::clone(&altseqs);
                            let variant_positions = Arc::clone(&variant_positions);
                            let indel_lengths = Arc::clone(&indel_lengths);

                            let handle = thread::spawn(move || {
                                // Thread is initiallized here
                                //println!("thread:{}", thread_num);
                                let sequences_list: Vec<&str> = sequences.split("-").collect();
                                let start_positions_list: Vec<&str> =
                                    start_positions.split("-").collect();
                                let cigar_sequences_list: Vec<&str> =
                                    cigar_sequences.split("-").collect();
                                let sequence_flags_list: Vec<&str> =
                                    sequence_flags.split("-").collect();
                                //let mut all_alleles_thread = Vec::<ReadClassification>::new();
                                let mut alt_allele_names_list: Vec<String> = Vec::<String>::new();
                                let alt_allele_names_str: Vec<&str> =
                                    alt_allele_names.split("-").collect();
                                for item in alt_allele_names_str {
                                    alt_allele_names_list.push(item.to_string());
                                }
                                let mut output_string_thread = "".to_string();
                                let mut alternate_forward_count_thread: u32 = 0; // Alternate forward read counter (for each thread)
                                let mut alternate_reverse_count_thread: u32 = 0; // Alternate reverse read counter (for each thread)
                                let mut reference_forward_count_thread: u32 = 0; // Reference forward read counter (for each thread)
                                let mut reference_reverse_count_thread: u32 = 0; // Reference reverse read counter (for each thread)
                                for iter in 0..sequences_list.len() {
                                    let remainder: usize = iter % max_threads; // Calculate remainder of read number divided by max_threads to decide which thread parses this read
                                                                               //println!("iter:{}", iter);
                                    if remainder == thread_num {
                                        // Thread analyzing a particular read must have the same remainder as the thread_num, this avoids multiple reads from parsing the same read. Also checking if the read length > 0

                                        //println!(
                                        //    "start_positions_list:{}",
                                        //    start_positions_list[iter].parse::<i64>().unwrap() - 1
                                        //);
                                        //println!("cigar_sequences_list[iter]:{}", cigar_sequences_list[iter]);
                                        let refalleles_list: Vec<&str> =
                                            refalleles.split("-").collect();
                                        let altalleles_list: Vec<&str> =
                                            altalleles.split("-").collect();
                                        let refseqs_list: Vec<&str> = refseqs.split("-").collect();
                                        let altseqs_list: Vec<&str> = altseqs.split("-").collect();

                                        let mut variant_positions_list = Vec::<i64>::new();
                                        let variant_positions_str: Vec<&str> =
                                            variant_positions.split("-").collect();
                                        for item in variant_positions_str {
                                            variant_positions_list
                                                .push(item.parse::<i64>().unwrap());
                                        }
                                        let mut indel_lengths_list = Vec::<usize>::new();
                                        let indel_lengths_str: Vec<&str> =
                                            indel_lengths.split("-").collect();
                                        for item in indel_lengths_str {
                                            indel_lengths_list.push(item.parse::<usize>().unwrap());
                                        }
                                        let (
                                            within_indel,
                                            correct_start_positions,
                                            correct_end_positions,
                                            alignment_sides,
                                            spliced_sequences,
                                        ) = realign::check_read_within_indel_region(
                                            // Checks if the read contains the indel region (or a part of it)
                                            start_positions_list[iter].parse::<i64>().unwrap() - 1,
                                            cigar_sequences_list[iter].to_string(),
                                            &variant_positions_list,
                                            &indel_lengths_list,
                                            &refalleles_list,
                                            &altalleles_list,
                                            strictness,
                                            sequences_list[iter].to_string(),
                                        );
                                        if within_indel == 1 {
                                            // Checking if the read is in forward or reverse strand
                                            let mut sequence_strand: String = "F".to_string(); // Initializing sequence strand to forward
                                            if sequence_flags_list[iter].parse::<i64>().unwrap()
                                                & 16
                                                == 16
                                            {
                                                sequence_strand = "R".to_string();
                                            }

                                            let mut alt_comparisons = Vec::<ReadComparison>::new();
                                            let mut ref_comparisons = Vec::<ReadComparison>::new();
                                            let mut indel_nones = Vec::<bool>::new();
                                            let mut ref_polyclonal_read_status_global: i64 = 0;
                                            let mut alt_polyclonal_read_status_global: i64 = 1;
                                            let mut ref_polyclonal_read_statuses =
                                                Vec::<i64>::new();
                                            let mut alt_polyclonal_read_statuses =
                                                Vec::<i64>::new();
                                            for indel_idx in 0..variant_positions_list.len() {
                                                let spliced_sequence =
                                                    &spliced_sequences[indel_idx];
                                                let reference_sequence = refseqs_list[indel_idx];
                                                let alternate_sequence = altseqs_list[indel_idx];
                                                let (
                                                    q_seq_ref,
                                                    align_ref,
                                                    r_seq_ref,
                                                    ref_comparison,
                                                ) = realign::align_single_reads(
                                                    &spliced_sequence,
                                                    reference_sequence.to_string(),
                                                );
                                                let (
                                                    q_seq_alt,
                                                    align_alt,
                                                    r_seq_alt,
                                                    alt_comparison,
                                                ) = realign::align_single_reads(
                                                    &spliced_sequence,
                                                    alternate_sequence.to_string(),
                                                );
                                                alt_comparisons.push(ReadComparison {
                                                    comparison: alt_comparison,
                                                    index: indel_idx,
                                                });
                                                ref_comparisons.push(ReadComparison {
                                                    comparison: ref_comparison,
                                                    index: indel_idx,
                                                });

                                                let (
                                                    ref_polyclonal_read_status,
                                                    alt_polyclonal_read_status,
                                                );
                                                if strictness == 0 {
                                                    ref_polyclonal_read_status = 0;
                                                    alt_polyclonal_read_status = 0;
                                                } else {
                                                    let (
                                                        ref_polyclonal_read_status_temp,
                                                        alt_polyclonal_read_status_temp,
                                                    ) = check_polyclonal_with_read_alignment(
                                                        &alignment_sides[indel_idx],
                                                        &q_seq_alt,
                                                        &q_seq_ref,
                                                        &r_seq_alt,
                                                        &r_seq_ref,
                                                        &align_alt,
                                                        &align_ref,
                                                        correct_start_positions[indel_idx],
                                                        correct_end_positions[indel_idx],
                                                        variant_positions_list[indel_idx],
                                                        refalleles_list[indel_idx].len(),
                                                        altalleles_list[indel_idx].len(),
                                                        indel_lengths_list[indel_idx],
                                                        variant_positions_list.len(),
                                                    );
                                                    ref_polyclonal_read_status =
                                                        ref_polyclonal_read_status_temp;
                                                    alt_polyclonal_read_status =
                                                        alt_polyclonal_read_status_temp;
                                                }
                                                if ref_polyclonal_read_status == 1 {
                                                    ref_polyclonal_read_status_global = 1;
                                                }
                                                if alt_polyclonal_read_status == 0 {
                                                    alt_polyclonal_read_status_global = 0;
                                                }
                                                let mut indel_none: bool = false;
                                                if ref_polyclonal_read_status == 1
                                                    && alt_polyclonal_read_status == 1
                                                {
                                                    indel_none = true;
                                                }
                                                indel_nones.push(indel_none);
                                                ref_polyclonal_read_statuses
                                                    .push(ref_polyclonal_read_status);
                                                alt_polyclonal_read_statuses
                                                    .push(alt_polyclonal_read_status);
                                            }
                                            // Sorting in ascending order so as to check if the read is ambiguous or not
                                            alt_comparisons.as_mut_slice().sort_by(|a, b| {
                                                (a.comparison)
                                                    .partial_cmp(&b.comparison)
                                                    .unwrap_or(Ordering::Equal)
                                            });
                                            ref_comparisons.as_mut_slice().sort_by(|a, b| {
                                                (a.comparison)
                                                    .partial_cmp(&b.comparison)
                                                    .unwrap_or(Ordering::Equal)
                                            });

                                            let mut max_index = 0;
                                            let mut refalt = "ref".to_string();
                                            let mut max_alignment_ref: f64 = 0.0;
                                            let mut max_index_ref: usize = 0;
                                            for alignment_idx in 0..ref_comparisons.len() {
                                                if ref_comparisons[alignment_idx].comparison
                                                    > max_alignment_ref
                                                {
                                                    max_alignment_ref =
                                                        ref_comparisons[alignment_idx].comparison;
                                                    max_index_ref =
                                                        ref_comparisons[alignment_idx].index;
                                                }
                                            }

                                            let mut read_ambiguous = 0;
                                            let mut equal_alignment_indices = Vec::<usize>::new();
                                            let mut max_alignment_alt: f64 = 0.0;
                                            let mut max_index_alt: usize = 0;
                                            for alignment_idx in 0..alt_comparisons.len() {
                                                if alt_comparisons[alignment_idx].comparison
                                                    > max_alignment_alt
                                                    && indel_nones
                                                        [alt_comparisons[alignment_idx].index]
                                                        == false
                                                    && alt_polyclonal_read_statuses
                                                        [alt_comparisons[alignment_idx].index]
                                                        != 1
                                                {
                                                    max_alignment_alt =
                                                        alt_comparisons[alignment_idx].comparison;
                                                    max_index_alt =
                                                        alt_comparisons[alignment_idx].index;
                                                } else if ref_polyclonal_read_status_global != 1
                                                    || alt_polyclonal_read_status_global != 1
                                                // If the read is going to be classified as none, no need to check if it is ambiguous
                                                {
                                                    if alignment_idx == 0 {
                                                    } else {
                                                        //println!("alt_comparisons:{:?}", alt_comparisons);
                                                        for sub_alignment_idx in 0..alignment_idx {
                                                            let alt_comparison1 =
                                                                alt_comparisons.iter().find(|x| {
                                                                    x.index == sub_alignment_idx
                                                                });
                                                            let alt_comparison2 = alt_comparisons
                                                                .iter()
                                                                .find(|x| x.index == alignment_idx);
                                                            if alt_comparison1.unwrap().comparison
                                                                == alt_comparison2
                                                                    .unwrap()
                                                                    .comparison
                                                            {
                                                                equal_alignment_indices
                                                                    .push(sub_alignment_idx);
                                                                equal_alignment_indices
                                                                    .push(alignment_idx);
                                                                //println!(
                                                                //    "sub_alignment_idx:{}",
                                                                //    sub_alignment_idx
                                                                //);
                                                                //println!("alignment_idx:{}", alignment_idx);
                                                                read_ambiguous = 1;
                                                                max_alignment_alt = alt_comparison1
                                                                    .unwrap()
                                                                    .comparison;
                                                            }
                                                        }
                                                    }
                                                } else if alt_polyclonal_read_statuses
                                                    [alt_comparisons[alignment_idx].index]
                                                    == 1
                                                    && ref_polyclonal_read_statuses
                                                        [ref_comparisons[alignment_idx].index]
                                                        == 0
                                                // This logic is kind of side stepping the smith-watermann alignment and classifying on the basis of nucleotide-by-nucleotide comparison (not sure if this will work in all cases or any other possible side effects)
                                                {
                                                    max_alignment_ref =
                                                        ref_comparisons[alignment_idx].comparison;
                                                    max_index_ref =
                                                        ref_comparisons[alignment_idx].index;
                                                } else if alt_comparisons[alignment_idx].comparison
                                                    > max_alignment_alt
                                                // Should this logic be placed at the top ?
                                                {
                                                    max_alignment_alt =
                                                        alt_comparisons[alignment_idx].comparison;
                                                    max_index_alt =
                                                        alt_comparisons[alignment_idx].index;
                                                }
                                            }

                                            let mut ref_is_ambiguous = false; // Flag which is true/false when ref allele is one of the reads that is ambiguous for a particular read
                                            if max_alignment_alt > max_alignment_ref {
                                                //max_alignment = max_alignment_alt;
                                                max_index = max_index_alt;
                                                refalt = "alt".to_string();
                                            } else if max_alignment_alt < max_alignment_ref {
                                                //max_alignment = max_alignment_ref;
                                                max_index = max_index_ref;
                                                refalt = "ref".to_string();
                                            } else if max_alignment_alt == max_alignment_ref {
                                                //max_alignment = max_alignment_ref;
                                                //println!("Ambiguous case between one of the alt alleles and the ref");
                                                read_ambiguous = 1;
                                                //if equal_alignment_indices
                                                //    .iter()
                                                //    .any(|&i| i == max_index_alt)
                                                //{
                                                //} else {
                                                //    equal_alignment_indices.push(max_index_alt);
                                                //    ref_is_ambiguous = true;
                                                //}
                                                equal_alignment_indices.push(max_index_alt);
                                                ref_is_ambiguous = true;
                                            }
                                            equal_alignment_indices.sort();
                                            equal_alignment_indices.dedup();
                                            // Check if the read does not support any of the reference or alternate alleles
                                            if ((ref_polyclonal_read_status_global == 1
                                                && alt_polyclonal_read_status_global == 1)
                                                || (ref_polyclonal_read_status_global == 1
                                                    && alt_polyclonal_read_status_global == 0
                                                    && refalt == "ref".to_string()))
                                                && strictness == 1
                                            {
                                                // Setting read to none
                                                //if !all_alleles_thread
                                                //    .contains_key(&"none".to_string())
                                                //{
                                                //    all_alleles_thread
                                                //        .insert("none".to_string(), Vec::new());
                                                //}
                                                //all_alleles_thread
                                                //    .get_mut(&"none".to_string())
                                                //    .unwrap()
                                                //    .push(iter);

                                                let mut none_groups_for_each_read =
                                                    Vec::<String>::new(); // When a read is assigned to none group, the first entry in the vector is "none", followed by the group with which it has maximum sequence similarity
                                                none_groups_for_each_read.push("none".to_string());

                                                if refalt == "ref".to_string() {
                                                    none_groups_for_each_read
                                                        .push("ref".to_string())
                                                } else if refalt == "alt".to_string() {
                                                    let alt_allele_name = alt_allele_names_list
                                                        [max_index]
                                                        .to_string();
                                                    none_groups_for_each_read.push(alt_allele_name);
                                                }
                                                //all_alleles_thread.push(ReadClassification {
                                                //    read_number: iter,
                                                //    categories: none_groups_for_each_read,
                                                //});
                                                //all_alleles_thread[&iter.to_string()] =
                                                //    other_json!(none_groups_for_each_read);
                                                output_string_thread +=
                                                    &serde_json::to_string(&ReadClassification {
                                                        read_number: iter as usize,
                                                        categories: none_groups_for_each_read,
                                                    })
                                                    .unwrap();
                                                output_string_thread += &",".to_string();
                                            } else if read_ambiguous == 1 {
                                                // Setting read to ambiguous
                                                //if !all_alleles_thread
                                                //    .contains_key(&"amb".to_string())
                                                //{
                                                //    all_alleles_thread
                                                //        .insert("amb".to_string(), Vec::new());
                                                //} else {
                                                //    all_alleles_thread
                                                //        .get_mut(&"amb".to_string())
                                                //        .unwrap()
                                                //        .push(iter);
                                                //}

                                                let mut ambiguous_groups_for_each_read =
                                                    Vec::<String>::new(); // When a read is asigned to ambiguous group, the first entry in the vector is "amb". Subsequent entries are for each group with which the read has equal sequence similarity with
                                                ambiguous_groups_for_each_read
                                                    .push("amb".to_string());
                                                for eq_alignment_idx in
                                                    0..equal_alignment_indices.len()
                                                {
                                                    let item2 = alt_allele_names_list
                                                        [equal_alignment_indices[eq_alignment_idx]]
                                                        .clone()
                                                        .to_string();
                                                    ambiguous_groups_for_each_read.push(item2);
                                                }
                                                if ref_is_ambiguous == true {
                                                    ambiguous_groups_for_each_read
                                                        .push("ref".to_string());
                                                }
                                                //all_alleles_thread[&iter.to_string()] =
                                                //    other_json!(ambiguous_groups_for_each_read);
                                                //all_alleles_thread.push(ReadClassification {
                                                //    read_number: iter,
                                                //    categories: ambiguous_groups_for_each_read,
                                                //});
                                                output_string_thread +=
                                                    &serde_json::to_string(&ReadClassification {
                                                        read_number: iter as usize,
                                                        categories: ambiguous_groups_for_each_read,
                                                    })
                                                    .unwrap();
                                                output_string_thread += &",".to_string();
                                                //ambiguous_list_thread
                                                //    .insert(iter, ambiguous_groups_for_each_read);
                                            } else if refalt == "ref".to_string() {
                                                // Setting read to ref
                                                //if !all_alleles_thread
                                                //    .contains_key(&"ref".to_string())
                                                //{
                                                //    all_alleles_thread
                                                //        .insert("ref".to_string(), Vec::new());
                                                //}
                                                //all_alleles_thread
                                                //    .get_mut(&"ref".to_string())
                                                //    .unwrap()
                                                //    .push(iter);
                                                //all_alleles_thread[iter.to_string()] =
                                                //    other_json!(vec!["ref".to_string()]);
                                                //all_alleles_thread.push(ReadClassification {
                                                //    read_number: iter,
                                                //    categories: vec!["ref".to_string()],
                                                //});
                                                output_string_thread +=
                                                    &serde_json::to_string(&ReadClassification {
                                                        read_number: iter as usize,
                                                        categories: vec!["ref".to_string()],
                                                    })
                                                    .unwrap();
                                                output_string_thread += &",".to_string();
                                                if variant_positions_list.len() == 1 // Forward/reverse for reference/alternate allele is only counted for single allele variants
                                && sequence_strand == "R".to_string()
                                                {
                                                    reference_reverse_count_thread += 1;
                                                } else if variant_positions_list.len() == 1 // Forward/reverse for reference/alternate allele is only counted for single allele variants
                                && sequence_strand == "F".to_string()
                                                {
                                                    reference_forward_count_thread += 1;
                                                }
                                            } else if refalt == "alt".to_string() {
                                                // Setting read to alt
                                                // Determine which alt allele read needs to be classified into
                                                let alt_allele_name =
                                                    alt_allele_names_list[max_index].to_string();
                                                //if !all_alleles_thread
                                                //    .contains_key(&alt_allele_name.clone())
                                                //{
                                                //    all_alleles_thread.insert(
                                                //        alt_allele_name.clone(),
                                                //        Vec::new(),
                                                //    );
                                                //}
                                                //all_alleles_thread
                                                //    .get_mut(&alt_allele_name)
                                                //    .unwrap()
                                                //    .push(iter);

                                                //all_alleles_thread[iter.to_string()] =
                                                //    other_json!(vec![alt_allele_name.to_string()]);
                                                //all_alleles_thread.push(ReadClassification {
                                                //    read_number: iter,
                                                //    categories: vec![alt_allele_name],
                                                //});
                                                output_string_thread +=
                                                    &serde_json::to_string(&ReadClassification {
                                                        read_number: iter as usize,
                                                        categories: vec![alt_allele_name],
                                                    })
                                                    .unwrap();
                                                output_string_thread += &",".to_string();
                                                if variant_positions_list.len() == 1 // Forward/reverse for reference/alternate allele is only counted for single allele variants
                                && sequence_strand == "R".to_string()
                                                {
                                                    alternate_reverse_count_thread += 1;
                                                } else if variant_positions_list.len() == 1 // Forward/reverse for reference/alternate allele is only counted for single allele variants
                                && sequence_strand == "F".to_string()
                                                {
                                                    alternate_forward_count_thread += 1;
                                                }
                                            } else {
                                                // Should not happen
                                                println!("Unaccounted scenario, please check!");
                                            }
                                        }
                                    }
                                }
                                // Once all reads are analyzed by a thread it transfers all the read_diff_scores thread. I tried out an alternative implementation where all read_diff_scores struct was directly stored in alt_scores_thread and ref_scores_thread but that was slower because it was keeping other threads idle while one was writing into those variables
                                //for item in all_alleles_thread {
                                //    all_alleles_temp.lock().unwrap().push(item);
                                //}
                                //drop(all_alleles_temp); // This drops the vector so that other threads can now write into this variable while the current thread can do some other computation. This helps in better concurrency.

                                *output_string_temp.lock().unwrap() += &output_string_thread;

                                *alternate_forward_count_temp.lock().unwrap() +=
                                    alternate_forward_count_thread;
                                drop(alternate_forward_count_temp);
                                *alternate_reverse_count_temp.lock().unwrap() +=
                                    alternate_reverse_count_thread;
                                drop(alternate_reverse_count_temp);
                                *reference_forward_count_temp.lock().unwrap() +=
                                    reference_forward_count_thread;
                                drop(reference_forward_count_temp);
                                *reference_reverse_count_temp.lock().unwrap() +=
                                    reference_reverse_count_thread;
                                drop(reference_reverse_count_temp);
                            });
                            handles.push(handle); // The handle (which contains the thread) is stored in the handles vector
                        }
                        for handle in handles {
                            // Wait for all threads to finish before proceeding further
                            handle.join().unwrap();
                        }
                        // Combining data from all different threads
                        //for item in &mut *all_alleles_temp.lock().unwrap() {
                        //    all_alleles.push(ReadClassification::to_owned(item));
                        //}
                        output_string += &*output_string_temp.lock().unwrap();
                        alternate_forward_count += *alternate_forward_count_temp.lock().unwrap();
                        alternate_reverse_count += *alternate_reverse_count_temp.lock().unwrap();
                        reference_forward_count += *reference_forward_count_temp.lock().unwrap();
                        reference_reverse_count += *reference_reverse_count_temp.lock().unwrap();
                    }

                    if variant_positions_list.len() == 1 {
                        // Forward/reverse for reference/alternate allele is only counted for single allele variants
                        let p_value = strand_analysis(
                            alternate_forward_count,
                            alternate_reverse_count,
                            reference_forward_count,
                            reference_reverse_count,
                        );

                        let fisher_strand = json::stringify(object! {
                                    alternate_forward_count: alternate_forward_count,
                                    alternate_reverse_count: alternate_reverse_count,
                                    reference_forward_count: reference_forward_count,
                                    reference_reverse_count: reference_reverse_count,
                        p_value: format!("{:.2}", p_value),
                        });
                        //println!("strand_probability:{:.2}", p_value);
                        println!("fisher_strand:{}", fisher_strand);
                    }
                    //let mut output_string = "[".to_string();
                    //output_string += &all_alleles.to_string();
                    output_string.pop();
                    if output_string.len() == 0 {
                        // Pass empty JSON "[]" when no reads are passed back to nodejs
                        output_string = "[]".to_string();
                    } else {
                        output_string += &"]".to_string();
                    }
                    println!("Final_output:{:?}", output_string);
                }
                Err(error) => println!("Incorrect json: {}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
}

fn strand_analysis(
    alternate_forward_count: u32,
    alternate_reverse_count: u32,
    reference_forward_count: u32,
    reference_reverse_count: u32,
) -> f64 {
    let mut fisher_chisq_test: u64 = 1; // Initializing to fisher-test

    let fisher_limit = 300; // If number of alternate + reference reads greater than this number, chi-sq test will be invoked
    let individual_fisher_limit = 150; // Cutoff for each individual number (in addition to fisher_limit) that must be passed to invoke chisq test
    if alternate_forward_count
        + alternate_reverse_count
        + reference_forward_count
        + reference_reverse_count
        > fisher_limit
        && alternate_forward_count > individual_fisher_limit
        && alternate_reverse_count > individual_fisher_limit
        && reference_forward_count > individual_fisher_limit
        && reference_reverse_count > individual_fisher_limit
    {
        fisher_chisq_test = 2; // Setting test = chi-sq
    }
    let (p_value_original, fisher_chisq_test) = stats_functions::strand_analysis_one_iteration(
        alternate_forward_count,
        alternate_reverse_count,
        reference_forward_count,
        reference_reverse_count,
        fisher_chisq_test,
    );
    //println!("p_value original:{}", p_value_original);

    // Need to get all possible combination of forward/reverse reads for alternate and reference alleles. For details, please see this link https://gatk.broadinstitute.org/hc/en-us/articles/360035532152-Fisher-s-Exact-Test

    let mut p_sum: f64 = p_value_original;
    let mut alternate_forward_count_temp: i64 =
        (alternate_forward_count + alternate_reverse_count) as i64;
    let mut alternate_reverse_count_temp = 0;
    let mut reference_forward_count_temp = 0;
    let mut reference_reverse_count_temp: i64 =
        (reference_forward_count + reference_reverse_count) as i64;
    while alternate_forward_count_temp >= 0 && reference_reverse_count_temp >= 0 {
        if alternate_forward_count_temp == 0 {
            break;
        } else {
            alternate_forward_count_temp -= 1;
        }
        alternate_reverse_count_temp += 1;
        reference_forward_count_temp += 1;
        if reference_reverse_count_temp == 0 {
            break;
        } else {
            reference_reverse_count_temp -= 1;
        }
        #[allow(unused_variables)]
        let (p_temp, fisher_test_temp) = stats_functions::strand_analysis_one_iteration(
            alternate_forward_count_temp as u32,
            alternate_reverse_count_temp,
            reference_forward_count_temp,
            reference_reverse_count_temp as u32,
            fisher_chisq_test,
        );
        if p_temp <= p_value_original && p_sum + p_temp < 1.0 {
            // Add to p-value only if its lower or equal to p_value_original
            p_sum += p_temp;
        }
    }

    //println!("Total p_value:{}", p_sum);
    if p_sum == 0.0 {
        // When p-value is extremely small say p = 10^(-22) then p-value is returned as 0.0. But log of 0.0 is undefined. In such a case p-value is set to a very small value but not 0.0
        p_sum = 0.000000000000000001;
    }
    -10.0 * p_sum.log(10.0) // Reporting phred-scale p-values (-10*log(p-value))
}

fn check_polyclonal_with_read_alignment(
    alignment_side: &String,
    q_seq_alt: &String,
    q_seq_ref: &String,
    r_seq_alt: &String,
    r_seq_ref: &String,
    align_alt: &String,
    align_ref: &String,
    correct_start_position: i64,
    correct_end_position: i64,
    variant_pos: i64,
    ref_length: usize,
    alt_length: usize,
    indel_length: usize,
    num_variants: usize,
) -> (i64, i64) {
    let mut ref_polyclonal_read_status = 0;
    let mut alt_polyclonal_read_status = 0;

    let (
        red_region_start_alt_temp,
        red_region_stop_alt_temp,
        red_region_start_ref_temp,
        red_region_stop_ref_temp,
    ) = realign::determine_start_stop_indel_region_in_read(
        alignment_side.to_owned(),
        q_seq_alt,
        q_seq_ref,
        &r_seq_alt,
        &r_seq_ref,
        correct_start_position,
        correct_end_position,
        variant_pos,
        ref_length,
        alt_length,
        indel_length,
    );

    let mut red_region_start_alt = 0;
    let mut red_region_stop_alt = 0;
    let mut red_region_start_ref = 0;
    let mut red_region_stop_ref = 0;

    if alignment_side == &"left".to_string() {
        red_region_start_alt = red_region_start_alt_temp;
        red_region_stop_alt = red_region_start_alt + indel_length as i64;
        if red_region_stop_alt > q_seq_alt.len() as i64 {
            red_region_stop_alt = q_seq_alt.len() as i64;
        }

        red_region_start_ref = red_region_start_ref_temp;
        red_region_stop_ref = red_region_start_ref + indel_length as i64;
        if red_region_stop_ref > q_seq_ref.len() as i64 {
            red_region_stop_ref = q_seq_ref.len() as i64;
        }
    } else if alignment_side == &"right".to_string() {
        red_region_start_ref = red_region_stop_ref_temp - ref_length as i64;
        red_region_stop_ref = red_region_start_ref + indel_length as i64;
        if red_region_start_ref < 0 {
            red_region_start_ref = 0;
        }

        red_region_start_alt = red_region_stop_alt_temp - alt_length as i64;
        red_region_stop_alt = red_region_start_alt + indel_length as i64;
        if red_region_start_alt < 0 {
            red_region_start_alt = 0;
        }
    }

    //println!("alignment_side:{}", alignment_side);
    //println!("correct_start_position:{}", correct_start_position);
    //println!("correct_end_position:{}", correct_end_position);
    //println!("variant_pos:{}", variant_pos);
    //println!("q_seq_ref:{}", q_seq_ref);
    //println!("align_ref:{}", align_ref);
    //println!("q_seq_alt:{}", q_seq_alt);
    //println!("align_alt:{}", align_alt);
    //println!("q_seq_alt.len():{}", q_seq_alt.len());
    //println!("q_seq_ref.len():{}", q_seq_ref.len());
    //println!("red_region_start_alt:{}", red_region_start_alt);
    //println!("red_region_start_ref:{}", red_region_start_ref);
    //println!("red_region_stop_alt:{}", red_region_stop_alt);
    //println!("red_region_stop_ref:{}", red_region_stop_ref);

    let align_alt_vec: Vec<_> = align_alt.chars().collect();
    let align_ref_vec: Vec<_> = align_ref.chars().collect();
    if red_region_start_alt > q_seq_alt.len() as i64 && num_variants == 1 {
        // When read alignment is very bad, its possible that the calculated start of indel in read is greater than the length of the alignment. In such cases such reads are classified as polyclonal. However, this may not be true for multi allele variants as all the alternative alleles may not start from the same position.
        alt_polyclonal_read_status = 1;
    } else {
        for i in red_region_start_alt as usize..red_region_stop_alt as usize {
            if i < align_alt_vec.len() {
                if align_alt_vec[i] != '|' {
                    alt_polyclonal_read_status = 1;
                    break;
                }
            } else {
                break;
            }
        }
    }

    if red_region_start_ref > q_seq_ref.len() as i64 && num_variants == 1 {
        // When read alignment is very bad, its possible that the calculated start of indel in read is greater than the length of the alignment. In such cases such reads are classified as polyclonal. However, this may not be true for multi allele variants as all the alternative alleles may not start from the same position.
        println!("Hello");
        ref_polyclonal_read_status = 1;
    } else {
        for i in red_region_start_ref as usize..red_region_stop_ref as usize {
            if i < align_ref_vec.len() {
                if align_ref_vec[i] != '|' {
                    ref_polyclonal_read_status = 1;
                    break;
                }
            } else {
                break;
            }
        }
    }

    (ref_polyclonal_read_status, alt_polyclonal_read_status)
}

// This function preprocesses the flanking region, ref and alt allele to search if the indel is a tandem repeat (or a polymer consisting of small indels). It also looks if there is possibility of ambiguous reads if part of the flanking sequence is repeated inside the indel itself
fn preprocess_input(
    ref_nucleotides: &Vec<char>, // Vector containing reference nucleotides
    alt_nucleotides: &Vec<char>, // Vector containing alternate nucleotides
    variant_pos: i64,            // Start position of indel
    indel_length: i64,           // Length of indel
    leftflankseq: String,        // Left flanking sequence
    rightflankseq: String,       // Right flanking sequence
    mut surrounding_region_length: i64, // Maximum limit upto which repetition of sequence will be searched to on either side of the indel
) -> (i64, i64) {
    let mut right_subseq = String::new(); // String for storing sequence on right side of indel
    let right_sequence_vector: Vec<_> = rightflankseq.chars().collect(); // A vector which contains all the nucleotides of the right flanking sequence

    // Selecting minimum of surrounding region length and rightflankseq
    surrounding_region_length = cmp::min(surrounding_region_length, rightflankseq.len() as i64);
    // Selecting minimum of surrounding region length and leftflankseq
    surrounding_region_length = cmp::min(surrounding_region_length, leftflankseq.len() as i64);
    for k in 0..surrounding_region_length as usize {
        right_subseq += &right_sequence_vector[k].to_string();
    }
    let mut left_subseq = String::new(); // String for storing sequence on left hand side. In case of left_subseq the nucleotides are stored in reverse order i.e nucleotides closest to the indel are first
    let left_sequence_vector: Vec<_> = leftflankseq.chars().collect(); // A vector which contains all the nucleotides of the left flanking sequence
    for k in 0..surrounding_region_length as usize {
        let j = left_sequence_vector.len() - k - 1;
        left_subseq += &left_sequence_vector[j].to_string();
    }
    let left_flanking_nucleotides: Vec<char> = left_subseq.chars().collect(); // Vector containing left flanking  nucleotides
    let right_flanking_nucleotides: Vec<char> = right_subseq.chars().collect(); // Vector containing right flanking  nucleotides

    //println!("left_flanking_nucleotides:{:?}", left_flanking_nucleotides);
    //println!(
    //    "right_flanking_nucleotides:{:?}",
    //    right_flanking_nucleotides
    //);

    // Check if the alt allele starts with ref nucleotide
    let mut actual_indel = String::new();
    let mut ref_alt_same_base_start: usize = 0; // Flag to see if the original ref/alt nucleotide start with the same base i.e the ref start position of the indel is in the alt allele (e.g. ACGA/A representing 3bp deletion)
    if ref_nucleotides[0] == alt_nucleotides[0]
        && (ref_nucleotides.len() > 0 || alt_nucleotides.len() > 0)
    {
        ref_alt_same_base_start = 1;
        //original_indel_length = indel_length - 1; // If the insertion/deletion starts with same nucleotide, subtracting 1 from indel_length.
        if ref_nucleotides.len() > alt_nucleotides.len() {
            // In case of deletion
            for j in 1..ref_nucleotides.len() {
                actual_indel += &ref_nucleotides[j].to_string();
            }
        } else {
            // In case of insertion
            for j in 1..alt_nucleotides.len() {
                actual_indel += &alt_nucleotides[j].to_string();
            }
        }
    } else {
        if ref_nucleotides.len() > alt_nucleotides.len() {
            // In case of deletion
            for j in 0..ref_nucleotides.len() {
                actual_indel += &ref_nucleotides[j].to_string();
            }
        } else {
            // In case of insertion
            for j in 0..alt_nucleotides.len() {
                actual_indel += &alt_nucleotides[j].to_string();
            }
        }
    }
    //let no_repeats: usize = 1; // Flag to check if non-repeating region has been reached
    let left_nearby_seq;
    let mut left_nearby_seq_reverse = String::new();
    let mut right_nearby_seq = String::new();
    let mut optimized_variant_pos = variant_pos;

    //println!("left_flanking_nucleotides:{:?}", left_flanking_nucleotides);
    //println!(
    //    "right_flanking_nucleotides:{:?}",
    //    right_flanking_nucleotides
    //);

    //while iter < actual_indel.len() {
    //    for j in left_offset..left_offset + original_indel_length as usize {
    //        let k = left_offset + original_indel_length as usize - 1 - j;
    //        left_nearby_seq += &left_flanking_nucleotides[k].to_string();
    //        //println!("left_nearby_seq:{}", left_nearby_seq);
    //    }
    //    for j in right_offset..right_offset + original_indel_length as usize {
    //        right_nearby_seq += &right_flanking_nucleotides[j].to_string();
    //        //println!("right_nearby_seq:{}", right_nearby_seq);
    //    }
    //    iter += 1;
    //}

    for i in 0..surrounding_region_length as usize {
        let k = surrounding_region_length as usize - 1 - i;
        if k < left_flanking_nucleotides.len() {
            left_nearby_seq_reverse += &left_flanking_nucleotides[k].to_string();
        }
        if i < right_flanking_nucleotides.len() {
            right_nearby_seq += &right_flanking_nucleotides[i].to_string();
        }

        if k >= left_flanking_nucleotides.len() && i >= right_flanking_nucleotides.len() {
            // Prevent useless iterations when it has looped through all positions in left_flanking_nucleotides and right_flanking_nucleotides
            break;
        }
    }

    if ref_alt_same_base_start == 1 {
        // Adding the first reference nucleotide to left flanking sequence when first nucleotide in indel is the last nucleotide from reference sequence
        left_nearby_seq_reverse += &ref_nucleotides[0].to_string();
    }

    left_nearby_seq = realign::reverse_string(&left_nearby_seq_reverse);
    //println!("left_nearby_seq_reverse:{}", left_nearby_seq_reverse);
    //println!("left_nearby_seq:{}", left_nearby_seq);
    //println!("right_nearby_seq:{}", right_nearby_seq);
    //println!("right_subseq:{}", right_subseq);
    //println!("actual_indel:{}", actual_indel);
    //println!("ref_alt_same_base_start:{}", ref_alt_same_base_start);

    // Checking if there are repeats within the indel.
    let repeating_monomeric_unit = check_if_repeat_inside_indel(ref_nucleotides, alt_nucleotides);

    let repeating_sequence_left; // The string stores the repeat sequence in flanking regionon left-hand side of indel if present
    let repeating_sequence_right; // The string stores the repeat sequence in flanking regionon rightt-hand side of indel if present

    //let mut num_repeats_in_flanking_sequence_left; // This variable stores the number of nucleotides to the left that are included in optimized alleles
    //let mut num_repeats_in_flanking_sequence_right; // This variable stores the number of nucleotides to the right that are included in optimized alleles

    let mut optimized_indel_length = indel_length;
    match repeating_monomeric_unit {
        Some(ref repeat_monomer_unit) => {
            // When repeating_monomeric_unit is defined
            println!(
                "Repeating monomer found within indel sequence:{:?}",
                &repeat_monomer_unit
            );

            let (repeating_sequence_left_temp, _num_repeats_in_flanking_sequence_left_temp) =
                check_flanking_sequence_for_repeats(
                    repeat_monomer_unit,
                    &left_nearby_seq,
                    surrounding_region_length,
                    "L",
                );

            let (repeating_sequence_right_temp, _num_repeats_in_flanking_sequence_right_temp) =
                check_flanking_sequence_for_repeats(
                    repeat_monomer_unit,
                    &right_subseq,
                    surrounding_region_length,
                    "R",
                );

            repeating_sequence_left = repeating_sequence_left_temp.clone();
            repeating_sequence_right = repeating_sequence_right_temp.clone();
            //num_repeats_in_flanking_sequence_left = num_repeats_in_flanking_sequence_left_temp;
            //num_repeats_in_flanking_sequence_right = num_repeats_in_flanking_sequence_right_temp;
            if repeating_sequence_left.len() == 0 && repeating_sequence_right.len() == 0 {
                // No repeating region
                println!("Monomer not repeated in flanking regions");
                optimized_indel_length = indel_length;
            } else if repeating_sequence_left.len() > 0 && repeating_sequence_right.len() == 0 {
                // Left side contains the monomer
                println!("Left side is repeating with monomer inside indel region");
                optimized_variant_pos -= repeating_sequence_left.len() as i64;
                optimized_indel_length = repeating_sequence_left.len() as i64 + indel_length;
            // Optimized indel length = length of repeating sequencing on left + indel_length
            } else if repeating_sequence_left.len() == 0 && repeating_sequence_right.len() > 0 {
                // Right side contains the monomer
                println!("Right side is repeating with monomer inside indel region");
                optimized_indel_length = indel_length + repeating_sequence_right.len() as i64;
            } else if repeating_sequence_left.len() > 0 && repeating_sequence_right.len() > 0 {
                // Both sides contain the monomer
                println!("Both sides are repeating with monomer inside indel region");
                optimized_variant_pos -= repeating_sequence_left.len() as i64;
                optimized_indel_length = repeating_sequence_left.len() as i64
                    + indel_length
                    + repeating_sequence_right.len() as i64;
            }
        }

        None => {
            // When repeating_monomeric_unit is not defined
            let (repeating_sequence_left_temp, _num_repeats_in_flanking_sequence_left_orig) =
                check_flanking_sequence_for_repeats(
                    &actual_indel,
                    &left_nearby_seq,
                    surrounding_region_length,
                    "L",
                );
            //println!(
            //    "repeating_sequence_left_temp:{}",
            //    repeating_sequence_left_temp
            //);

            let (repeating_sequence_right_temp, _num_repeats_in_flanking_sequence_right_orig) =
                check_flanking_sequence_for_repeats(
                    &actual_indel,
                    &right_subseq,
                    surrounding_region_length,
                    "R",
                );
            //println!(
            //    "repeating_sequence_right_temp:{}",
            //    repeating_sequence_right_temp
            //);
            //println!(
            //    "num_repeats_in_flanking_sequence_left_orig:{}",
            //    num_repeats_in_flanking_sequence_left_orig
            //);
            //repeating_sequence_left = repeating_sequence_left_temp.clone();
            //repeating_sequence_right = repeating_sequence_right_temp.clone();
            //num_repeats_in_flanking_sequence_left = num_repeats_in_flanking_sequence_left_orig;
            //num_repeats_in_flanking_sequence_right = num_repeats_in_flanking_sequence_right_orig;
            if repeating_sequence_left_temp.len() == 0 && repeating_sequence_right_temp.len() == 0 {
                // Check if the left and right most nucleotides are repeated
                if ref_nucleotides.len() >= alt_nucleotides.len() {
                    // See if first reference nucleotide is getting repeated in left-flanking region
                    let (repeating_sequence_left_temp, _num_repeats_in_flanking_sequence_left_temp) =
                        check_flanking_sequence_for_repeats(
                            &ref_nucleotides[0].to_string(),
                            &left_nearby_seq,
                            surrounding_region_length,
                            "L",
                        );
                    // See if last reference nucleotide is getting repeated in right-flanking region
                    let (
                        repeating_sequence_right_temp,
                        _num_repeats_in_flanking_sequence_right_temp,
                    ) = check_flanking_sequence_for_repeats(
                        &ref_nucleotides[ref_nucleotides.len() - 1].to_string(),
                        &right_subseq,
                        surrounding_region_length,
                        "R",
                    );
                    repeating_sequence_left = repeating_sequence_left_temp.clone();
                    repeating_sequence_right = repeating_sequence_right_temp.clone();
                    //num_repeats_in_flanking_sequence_left =
                    //    num_repeats_in_flanking_sequence_left_temp;
                    //num_repeats_in_flanking_sequence_right =
                    //    num_repeats_in_flanking_sequence_right_temp;
                    if repeating_sequence_left.len() > 0 && ref_alt_same_base_start == 1 {
                        optimized_variant_pos -= repeating_sequence_left_temp.len() as i64; // Need to pass this to main and also change optimized ref and alt allele. Will need to do this later

                        //optimized_alt_allele = String::from(
                        //    left_nearby_seq_vec[repeating_sequence_left_temp.len()].clone(),
                        //) + &repeating_sequence_left_temp
                        //    + &optimized_alt_allele; // Adding repetitive part to left side of alt allele
                        //optimized_ref_allele = String::from(
                        //    left_nearby_seq_vec[repeating_sequence_left_temp.len()].clone(),
                        //) + &repeating_sequence_left_temp
                        //    + &optimized_ref_allele; // Adding repetitive part to left side of ref allele

                        //println!(
                        //    "repeating_sequence_left_temp1:{}",
                        //    repeating_sequence_left_temp
                        //);
                        optimized_indel_length =
                            repeating_sequence_left_temp.len() as i64 + indel_length;
                        println!("First nucleotide of indel is repeating on left-flanking region")
                    } else if repeating_sequence_left.len() > 0 && ref_alt_same_base_start == 0 {
                        optimized_variant_pos -= repeating_sequence_left_temp.len() as i64; // Need to pass this to main and also change optimized ref and alt allele. Will need to do this later
                        optimized_indel_length =
                            repeating_sequence_left_temp.len() as i64 + indel_length;
                        println!("First nucleotide of indel is repeating on left-flanking region")
                    }
                    if repeating_sequence_right.len() > 0 {
                        println!("Last nucleotide of indel is repeating on right-flanking region");
                        //optimized_indel_length += repeating_sequence_right.len() as i64;
                    }
                } else if alt_nucleotides.len() > ref_nucleotides.len() {
                    // See if first alternate nucleotide is getting repeated in left-flanking region
                    let (repeating_sequence_left_temp, _num_repeats_in_flanking_sequence_left_temp) =
                        check_flanking_sequence_for_repeats(
                            &alt_nucleotides[0].to_string(),
                            &left_nearby_seq,
                            surrounding_region_length,
                            "L",
                        );
                    // See if last alternate nucleotide is getting repeated in right-flanking region
                    let (
                        repeating_sequence_right_temp,
                        _num_repeats_in_flanking_sequence_right_temp,
                    ) = check_flanking_sequence_for_repeats(
                        &alt_nucleotides[alt_nucleotides.len() - 1].to_string(),
                        &right_subseq,
                        surrounding_region_length,
                        "R",
                    );
                    repeating_sequence_left = repeating_sequence_left_temp.clone();
                    repeating_sequence_right = repeating_sequence_right_temp.clone();
                    //num_repeats_in_flanking_sequence_left =
                    //    num_repeats_in_flanking_sequence_left_temp;
                    //num_repeats_in_flanking_sequence_right =
                    //    num_repeats_in_flanking_sequence_right_temp;
                    if repeating_sequence_left.len() > 0 && ref_alt_same_base_start == 1 {
                        optimized_variant_pos -= repeating_sequence_left_temp.len() as i64; // Need to pass this to main and also change optimized ref and alt allele. Will need to do this later
                        optimized_indel_length =
                            repeating_sequence_left_temp.len() as i64 + indel_length;
                        println!("First nucleotide of indel is repeating on left-flanking region");
                        //optimized_alt_allele = String::from(
                        //    left_nearby_seq_vec[repeating_sequence_left_temp.len()].clone(),
                        //) + &repeating_sequence_left_temp
                        //    + &optimized_alt_allele; // Adding repetitive part to left side of allele
                        //optimized_ref_allele = String::from(
                        //    left_nearby_seq_vec[repeating_sequence_left_temp.len()].clone(),
                        //) + &repeating_sequence_left_temp
                        //    + &optimized_ref_allele; // Adding repetitive part to left side of allele
                        // Adding repetitive part to left side of alt allele
                    } else if repeating_sequence_left.len() > 0 && ref_alt_same_base_start == 0 {
                        optimized_variant_pos -= repeating_sequence_left_temp.len() as i64; // Need to pass this to main and also change optimized ref and alt allele. Will need to do this later
                        optimized_indel_length =
                            repeating_sequence_left_temp.len() as i64 + indel_length;
                        println!("First nucleotide of indel is repeating on left-flanking region");
                    }
                    if repeating_sequence_right.len() > 0 {
                        println!("Last nucleotide of indel is repeating on right-flanking region");
                        optimized_indel_length =
                            repeating_sequence_right_temp.len() as i64 + indel_length;
                    }
                }
            } else if repeating_sequence_left_temp.len() > 0
                && repeating_sequence_right_temp.len() == 0
            {
                println!("Left side is repeating");
                optimized_variant_pos -= repeating_sequence_left_temp.len() as i64;
                optimized_indel_length = repeating_sequence_left_temp.len() as i64 + indel_length;
            } else if repeating_sequence_left_temp.len() == 0
                && repeating_sequence_right_temp.len() > 0
            {
                println!("Right side is repeating");
                println!(
                    "repeating_sequence_right_temp:{}",
                    repeating_sequence_right_temp
                );
                optimized_indel_length = repeating_sequence_right_temp.len() as i64 + indel_length;
            } else if repeating_sequence_left_temp.len() > 0
                && repeating_sequence_right_temp.len() > 0
            {
                println!("Both sides are repeating");
                optimized_variant_pos -= repeating_sequence_left_temp.len() as i64;
                optimized_indel_length = repeating_sequence_left_temp.len() as i64
                    + indel_length
                    + repeating_sequence_right_temp.len() as i64;
            }
        }
    }
    //println!("optimized_variant_pos:{}", optimized_variant_pos);
    //
    //println!(
    //    "repeating_sequence_left end of preprocess:{}",
    //    repeating_sequence_left
    //);
    //println!(
    //    "repeating_sequence_right end of preprocess:{}",
    //    repeating_sequence_right
    //);
    //println!(
    //    "num_repeats_in_flanking_sequence_left:{}",
    //    num_repeats_in_flanking_sequence_left
    //);
    //println!(
    //    "num_repeats_in_flanking_sequence_right:{}",
    //    num_repeats_in_flanking_sequence_right
    //);
    (optimized_variant_pos, optimized_indel_length)
}

// This functions helps to determine if the indel is part of a repeat such as a tandem repeat within the indel sequence
fn check_if_repeat_inside_indel(
    ref_nucleotides: &Vec<char>,
    alt_nucleotides: &Vec<char>,
) -> Option<String> {
    let mut is_indel_repeat: bool; // Flag passed back which indicates if the indel is part of a repeat
    let mut ref_alt_same_base_start = 0; // Flag to check if the ref and alt allele start with the last ref nucleotide (e.g A/ATCGT)
    let mut indel_sequence = Vec::<char>::new(); // Indel sequence minus first base (if it is the same as reference base)
    if ref_nucleotides[0] == alt_nucleotides[0] {
        ref_alt_same_base_start = 1;
    }

    if ref_nucleotides.len() > alt_nucleotides.len() {
        for i in 0..ref_nucleotides.len() {
            if ref_alt_same_base_start == 0 && i == 0 {
                indel_sequence.push(ref_nucleotides[i]);
            } else if i > 0 {
                indel_sequence.push(ref_nucleotides[i]);
            }
        }
    } else {
        for i in 0..alt_nucleotides.len() {
            if ref_alt_same_base_start == 0 && i == 0 {
                indel_sequence.push(alt_nucleotides[i]);
            } else if i > 0 {
                indel_sequence.push(alt_nucleotides[i]);
            }
        }
    }

    // Testing monomers of various sizes upto length of indel sequence to see if monomer is getting repeated
    let mut final_monomeric_sequence = Option::<String>::None; // This variable will be None if no repeating monomeric unit is found. If a repeating monomeric unit is found, it will return the monomer sequence
    for monomer_length in 1..indel_sequence.len() {
        is_indel_repeat = true;
        let mut monomer_seq = String::new();
        for j in 0..monomer_length {
            // Extracting the first monomer_length(th) nucleotides from the left as monomer to be tested
            monomer_seq += &indel_sequence[j].to_string();
        }
        // Determine number of monomeric units in indel sequence
        if indel_sequence.len() % monomer_length == 0 {
            // Check to see if length of monomer is fully divisible by indel sequence. If not, it automatically means that monomer length is not repeated in the indel sequence
            let num_repeating_units = indel_sequence.len() / monomer_length;
            for j in 1..num_repeating_units {
                let mut subseq = String::new();
                for k in 0..monomer_length {
                    subseq += &indel_sequence[j * monomer_length + k].to_string();
                }
                if monomer_seq != subseq {
                    is_indel_repeat = false;
                    break;
                }
            }
        } else {
            is_indel_repeat = false;
        }

        if is_indel_repeat == true {
            // If repeats are found for a given monomer length, no need to check for higher monomeric lengths
            final_monomeric_sequence = Some(monomer_seq);
            break;
        }
    }

    final_monomeric_sequence
}

// Function to check if the monomer is present in flanking region
fn check_flanking_sequence_for_repeats(
    monomer: &String,
    flanking_sequence: &String,
    surrounding_region_length: i64, // Checks for monomer in the flanking region but only upto surrounding_region_length
    side: &str,                     // "L" for left, "R" for right flanking sequence
) -> (String, usize) {
    let sequence_vector: Vec<_> = flanking_sequence.chars().collect(); // Vector containing all the nucleotides of the reads as individual elements
    let num_iterations: i64 = surrounding_region_length / (monomer.len() as i64); // Number of times the monomer will have to be checked for repeating units from the variant region. e.g if monomer length is 2 and surrounding_region_length is 9, it will be 4 times at distances of 2, 4, 6 and 8 from the indel region
    let mut repeat_flanking_sequence = String::new(); // String storing the repeat flanking sequence (if present)
    let mut num_repeats_in_flanking_sequence: usize = 0; // Number of times monomeric unit is repeated in flanking region

    //println!("sequence_vector:{:?}", sequence_vector);
    //println!("monomer:{}", monomer);
    //println!("side:{}", side);

    for i in 0..num_iterations {
        let mut subseq = String::new(); // String where putative repeat unit will be stored
        if &side == &"R" {
            for j in 0..monomer.len() {
                if (i as usize) * monomer.len() + j < sequence_vector.len() {
                    subseq += &sequence_vector[(i as usize) * monomer.len() + j].to_string();
                }
            }
        } else if &side == &"L" {
            for j in 0..monomer.len() {
                let k = monomer.len() - 1 - j;
                if (i as usize) * monomer.len() + k < sequence_vector.len() {
                    subseq += &sequence_vector[(i as usize) * monomer.len() + k].to_string();
                }
            }
        }
        if &subseq != monomer {
            break;
        }
        num_repeats_in_flanking_sequence += 1;
        repeat_flanking_sequence.push_str(&subseq);
    }
    (repeat_flanking_sequence, num_repeats_in_flanking_sequence)
}
