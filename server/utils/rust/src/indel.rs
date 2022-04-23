// Syntax: cd .. && cargo build --release

// Test case below:
// echo AATAGCCTTTACATTATGTAATAGTGTAATACAAATAATAATTTATTATAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCGAAAACCCTAACCCTAAAACCCTAACATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCCTGACCCTAACCCTAATCCTTACCCTTATCCTACCCCTAACCCTTAACCC-AATAGCCTTTACATTATGTAATAGTGTAATACAAATAATAATTTATTATAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCCTAACCCCTAACCCTAACCCGAAAACCCTAACCCTAAAACCCTAACATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCCTGACCCTAACCCTAATCCTTACCCTTATCCTACCCCTAACCCTTAACCC-TAGTAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAAC-AGTAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCAAACCCTAACCCCTAACCCTAACCCAAAAACCCTAACCCTAAAACCC-TAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAAC-TAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACC-TAAAGTGAAATTATTGACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTATCCCCTAACCCTAATCCTAACCCTAACCCTAACCCTATCCCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAAC-TAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACC-CAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACCATAACCCTTACCCTTAC-CTGACCCTTAACCCTAACCCTAACCCCTAACCCTAACCCTTAACCCTTAAACCTTAACCCTCATCCTCACCCTCACCCTCACCCCTAACCCTAACCCCTAACCCAAACCCTCACCCTAAACCCTAACCCTAAACCCAACCCAAACCCTAAC-ACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAGCCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACCATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTT-CTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACCATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCC:16357-16358-16363-16363-16363-16363-16380-16388-16402-16418:108M1I42M-151M-102M1I48M-151M-101M1I49M-151M-132M1I18M-8S31M1I6M1I32M1I30M41S-110M1I40M-94M1I56M:147-99-65-81-83-83-177-163-147-113:16463:151:A:AC:6:0.1:10:1:AATAGCCTTTACATTATGTAATAGTGTAATACAAATAATAATTTATTATAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTA:CCCTAACCCCTAACCCTAACCCGAAAACCCTAACCCTAAAACCCTAACATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCCTGACCCTAACCCTAATCCTTACCCTTATCCTACCCCTAACCCTTAACCC | ../target/release/indel

//Debug syntax: cat ~/proteinpaint/test.txt | ~/proteinpaint/server/utils/rust/target/release/indel

// Strictness:
//   0: No postprocessing, pure indel typing results
//   1: Postprocessing will be carried out (Checks if read is polyclonal, reads with insertion near indel but classified as reference by kmer algorithm is put into none category)
//   2: In addition to postprocessing in 1, insertions/deletions near indel region also get classified into none

// Function cascade:
//
// Optimize ref/alt allele given by user
// preprocess_input() (Optimizing ref/alt allele entered by user to account for flanking repeat regions. For e.g A-AT in the region CACA{T}TTTTGCGA will become ATTTT-ATTTTT)
//
// Select appropriate kmer length
//
// assign_kmer_weights {
//   while duplicate_kmers {
//      build_kmers_refalt() (for both ref and alt)
//      check for duplicate kmers
//   }
//
//   Determine final weight of kmers for reference and alternate sequence
//   build_kmers_refalt() (for both ref and alt using chosen kmer length)
// }
//
// if number of reads > single_thread_limit (multithreading option is turned on)
//
// Analyze each read
//   for each read {
//      check_read_within_indel_region() (Checks if the read contains indel region)
//      check_if_read_ambiguous() (Checks if a read starts/ends within repeat region (if present) or if start/end of variant is similar to flanking sequence such that read does not contain sufficient part of variant region to infer whether it supports ref or alt allele)
//      check_polyclonal() (checking if read is polyclonal)
//      build_kmers()
//      jaccard_similarity_weights() (w.r.t ref and alt)
//      diff_score = j.s[alt] - j.s[ref]
//      if diff_score > 0 classify read as alt; else classify read as ref
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

//use num_traits::Float;
use bio::alignment::pairwise::*;
use bio::alignment::AlignmentOperation;
use fishers_exact::fishers_exact;
use statrs::distribution::{ChiSquared, ContinuousCDF};
use std::cmp;
use std::panic;
use std::sync::{Arc, Mutex}; // Multithreading library
use std::thread;
//use std::env;
//use std::time::{SystemTime};
use std::io;

mod realign;

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug)]
pub struct read_diff_scores {
    // struct for storing read details, used throughout the code
    groupID: usize,          // Original read ID
    value: f64,              // Diff score value
    abs_value: f64,          // Absolute diff score value
    alt_comparison: i64,     // alt comparison (0 if true, 1 if false)
    ref_comparison: i64,     // ref comparison (0 if true, 1 if false)
    polyclonal: i64, // flag to check if the read harbors polyclonal variant (neither ref nor alt)
    ref_insertion: i64, // flag to check if there is any insertion/deletion nucleotides in reads that may get clasified as supporting ref allele
    ambiguous: i64,     // flag to indicate whether read is ambiguous or not (1 = true, 0 = false)
    sequence_strand: String, // "F" or "R" depending on the strand of the read
}

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug)]
struct read_category {
    // struct for storing in which category a read has been classified
    category: String,        // Category: Ref/Alt/None/Ambiguous
    groupID: usize,          // Original read ID
    ref_comparison: i64,     // ref comparison (0 if true, 1 if false)
    alt_comparison: i64,     // alt comparison (0 if true, 1 if false)
    diff_score: f64,         // Diff score value
    ref_insertion: i64, // flag to check if there is any insertion/deletion nucleotides in reads that may get clasified as supporting ref allele
    sequence_strand: String, // "F" or "R" depending on the strand of the read
}

fn read_diff_scores_owned(item: &mut read_diff_scores) -> read_diff_scores {
    // Function to convert struct read_diff_scores from borrowed to owned
    let val = item.value.to_owned();
    let abs_val = item.abs_value.to_owned();
    #[allow(non_snake_case)]
    let gID = item.groupID.to_owned();
    let ref_comparison = item.ref_comparison.to_owned();
    let alt_comparison = item.alt_comparison.to_owned();
    let poly = item.polyclonal.to_owned();
    let ref_ins = item.ref_insertion.to_owned();
    let seq_strand = item.sequence_strand.to_owned();
    let ambiguous = item.ambiguous.to_owned();

    let read_val = read_diff_scores {
        value: f64::from(val),
        abs_value: f64::from(abs_val),
        groupID: usize::from(gID),
        alt_comparison: i64::from(alt_comparison),
        ref_comparison: i64::from(ref_comparison),
        polyclonal: i64::from(poly),
        ambiguous: i64::from(ambiguous),
        ref_insertion: i64::from(ref_ins),
        sequence_strand: String::from(seq_strand),
    };
    read_val
}

mod cigar {
    pub fn parse_cigar(cigar_seq: &String) -> (Vec<char>, Vec<i64>) {
        // function to parse out all letters (e.g S, M, I) and their corresponding numbers given a CIGAR sequence
        let sequence_vector: Vec<_> = cigar_seq.chars().collect();
        let mut subseq = String::new();
        let mut alphabets = Vec::<char>::new();
        let mut numbers = Vec::<i64>::new();
        for i in 0..sequence_vector.len() {
            if sequence_vector[i].is_alphabetic() == true {
                alphabets.push(sequence_vector[i]);
                numbers.push(subseq.parse::<i64>().unwrap());
                subseq = "".to_string();
            } else {
                subseq += &sequence_vector[i].to_string();
            }
        }
        (alphabets, numbers)
    }
}

fn main() {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        #[allow(unused_variables)]
        Ok(n) => {
            //println!("{} bytes read", n);
            //println!("{}", input);
        }
        Err(error) => println!("Piping error: {}", error),
    }
    let args: Vec<&str> = input.split("_").collect(); // Various input from nodejs is separated by ":" character
    let sequences: String = args[0].parse::<String>().unwrap(); // Variable contains sequences separated by "-" character, the first two sequences contains the ref and alt sequences
    let start_positions: String = args[1].parse::<String>().unwrap(); // Variable contains start position of reads separated by "-" character
    let cigar_sequences: String = args[2].parse::<String>().unwrap(); // Variable contains cigar sequences separated by "-" character
    let sequence_flags: String = args[3].parse::<String>().unwrap(); // Variable contains sam flags of reads separated by "-" character
    let variant_pos: i64 = args[4].parse::<i64>().unwrap(); // Variant position
    let refallele: String = args[5].parse::<String>().unwrap(); // Reference allele
    let altallele: String = args[6].parse::<String>().unwrap(); // Alternate allele
    let strictness: usize = args[7].parse::<usize>().unwrap(); // strictness of the pipeline
    let leftflankseq: String = args[8].parse::<String>().unwrap(); //Left flanking sequence
    let rightflankseq: String = args[9].parse::<String>().unwrap(); //Right flanking sequence.

    //let fisher_test_threshold: f64 = (10.0).powf((args[14].parse::<f64>().unwrap()) / (-10.0)); // Significance value for strand_analysis (NOT in phred scale)
    let mut leftflank_nucleotides: Vec<char> = leftflankseq.chars().collect(); // Vector containing left flanking nucleotides
    let rightflank_nucleotides: Vec<char> = rightflankseq.chars().collect(); // Vector containing right flanking nucleotides

    //println!("rightflank_nucleotides:{:?}", rightflank_nucleotides);
    let ref_nucleotides: Vec<char> = refallele.chars().collect(); // Vector containing ref nucleotides
    let alt_nucleotides: Vec<char> = altallele.chars().collect(); // Vector containing alt nucleotides
    let mut ref_nucleotides_all = Vec::<char>::new(); // Vector containing ref nucleotides of length similar to indel_length (used in strictness >=1)
    let mut alt_nucleotides_all_right = Vec::<char>::new(); // Vector containing alt nucleotides of length similar to indel_length (used in strictness >=1). In case of deletion contains nucleotides on the right hand side of the deletion
    let mut alt_nucleotides_all_left = Vec::<char>::new(); // Vector containing alt nucleotides of length similar to indel_length (used in strictness >=1). In case of deletion contains nucleotides on the left hand side of the deletion
    let lines: Vec<&str> = sequences.split("-").collect(); // Vector containing list of sequences, the first two containing ref and alt.
    let start_positions_list: Vec<&str> = start_positions.split("-").collect(); // Vector containing start positions
    let cigar_sequences_list: Vec<&str> = cigar_sequences.split("-").collect(); // Vector containing cigar sequences
    let sequence_flags_list: Vec<&str> = sequence_flags.split("-").collect(); // Vector containing sam flag of read sequences
    let single_thread_limit: usize = 1000; // If total number of reads is lower than this value the reads will be parsed sequentially in a single thread, if greaterreads will be parsed in parallel
    let max_threads: usize = 3; // Max number of threads in case the parallel processing of reads is invoked
    let ref_length: i64 = refallele.len() as i64; // Determining length of ref allele
    let alt_length: i64 = altallele.len() as i64; // Determining length of alt allele
    let mut indel_length: i64 = alt_length; // Determining indel length, in case of an insertion it will be alt_length. In case of a deletion, it will be ref_length
    if ref_length > alt_length {
        indel_length = ref_length;
    }
    let surrounding_region_length: i64 = 80; // Flanking region on both sides upto which it will search for duplicate kmers

    if args.len() > 14 {
        // This is true when realigning reads to determine correct indel sequence. Currently in development (not functional)
        let clustalo_path: String = args[14].parse::<String>().unwrap(); // Removing "\n" from the end of the string
        let quality_scores: String = args[15].parse::<String>().unwrap(); // Variable contains quality scores of reads separated by "-" character
        realign::realign_reads(
            &sequences,
            &start_positions,
            &cigar_sequences,
            &quality_scores,
            &clustalo_path,
            &lines[0].to_string(),
            &lines[1].to_string(),
            variant_pos,
            indel_length,
        );
    }

    // Preprocessing of input
    let (
        optimized_ref_allele,
        optimized_alt_allele,
        left_offset,
        right_offset,
        ref_alt_same_base_start,
        optimized_allele,
    ) = preprocess_input(
        &ref_nucleotides,
        &alt_nucleotides,
        &refallele,
        &altallele,
        variant_pos,
        indel_length,
        leftflankseq,
        rightflankseq,
        surrounding_region_length,
    );
    println!("ref_allele:{}", &refallele);
    println!("alt_allele:{}", &altallele);
    println!("optimized_ref_allele:{}", optimized_ref_allele);
    println!("optimized_alt_allele:{}", optimized_alt_allele);
    println!("left_offset:{}", left_offset);
    println!("right_offset:{}", right_offset);
    println!("ref_alt_same_base_start:{}", ref_alt_same_base_start);

    let mut optimized_indel_length = optimized_alt_allele.len();
    if optimized_ref_allele.len() > optimized_alt_allele.len() {
        let optimized_ref_nucleotides: Vec<char> = optimized_ref_allele.chars().collect();
        //let optimized_alt_nucleotides: Vec<char> = optimized_alt_allele.chars().collect();
        optimized_indel_length = optimized_ref_allele.len();
        leftflank_nucleotides.reverse();
        //println!("leftflank_nucleotides:{:?}", leftflank_nucleotides);
        for i in 0..optimized_indel_length as usize {
            if i < optimized_alt_allele.len() {
                // Getting all nucleotides from optmized alt allele
                ref_nucleotides_all.push(optimized_ref_nucleotides[i]);
                //alt_nucleotides_all_right.push(optimized_alt_nucleotides[i]);
                //let j = optimized_alt_allele.len() - i - 1;
                //alt_nucleotides_all_left.push(optimized_alt_nucleotides[j]);
            } else {
                //alt_nucleotides_all_right.push(rightflank_nucleotides[i - altallele.len()]); // For alt nucleotide, after getting first nucleotide from alt allele getting subsequent nucleotides from right-flanking sequence

                //alt_nucleotides_all_left
                //    .push(leftflank_nucleotides[i - optimized_alt_allele.len()]); // For alt nucleotide, after getting first nucleotide from alt allele getting subsequent nucleotides from right-flanking sequence
                ref_nucleotides_all.push(optimized_ref_nucleotides[i]);
            }

            if i < alt_nucleotides.len() {
                alt_nucleotides_all_right.push(alt_nucleotides[i]);
                let j = alt_nucleotides.len() - i - 1;
                alt_nucleotides_all_left.push(alt_nucleotides[j]);
            } else {
                alt_nucleotides_all_left.push(leftflank_nucleotides[i - alt_nucleotides.len()]);
                alt_nucleotides_all_right.push(rightflank_nucleotides[i - alt_nucleotides.len()]);
            }
        }
    } else {
        for i in 0..optimized_indel_length as usize {
            let optimized_ref_nucleotides: Vec<char> = optimized_ref_allele.chars().collect();
            let optimized_alt_nucleotides: Vec<char> = optimized_alt_allele.chars().collect();
            if i < optimized_ref_allele.len() {
                // The ref length array probably only has length of size 1 so getting the first nucleotide from ref_nucleotides vector
                ref_nucleotides_all.push(optimized_ref_nucleotides[i]);
                alt_nucleotides_all_right.push(optimized_alt_nucleotides[i]);
            } else {
                ref_nucleotides_all.push(rightflank_nucleotides[i - refallele.len()]); // For ref nucleotide, after getting first nucleotide from ref allele getting subsequent nucleotides from right-flanking sequence
                alt_nucleotides_all_right.push(optimized_alt_nucleotides[i]);
            }
        }
    }
    //alt_nucleotides_all_left.reverse();
    //println!("ref_nucleotides_all:{:?}", ref_nucleotides_all);
    //println!("alt_nucleotides_all_right:{:?}", alt_nucleotides_all_right);
    //println!("alt_nucleotides_all_left:{:?}", alt_nucleotides_all_left);
    drop(rightflank_nucleotides);
    let reference_sequence = lines[0].to_string();
    let alternate_sequence = lines[1].to_string();

    //println!(
    //    "{}{}",
    //    "Number of original reads in input (from Rust):",
    //    (lines.len() - 2).to_string()
    //);
    //
    //for i in 0..ref_kmers_nodups.len() {
    //    if ref_kmers_data[i].kmer_weight > weight_no_indel * kmer_length_iter as f64 {
    //        println!(
    //            "Ref kmer:{},weight:{}",
    //            ref_kmers_nodups[i], ref_kmers_data[i].kmer_weight
    //        );
    //        println!(
    //            "Ref kmer:{},left position:{}",
    //            ref_kmers_nodups[i], ref_kmers_data[i].left_position
    //        );
    //        println!(
    //            "Ref kmer:{},right position:{}",
    //            ref_kmers_nodups[i], ref_kmers_data[i].right_position
    //        );
    //    }
    //}
    //for i in 0..alt_kmers_nodups.len() {
    //    if alt_kmers_data[i].kmer_weight > weight_no_indel * kmer_length_iter as f64 {
    //        println!(
    //            "Alt kmer:{},weight:{}",
    //            alt_kmers_nodups[i], alt_kmers_data[i].kmer_weight
    //        );
    //        println!(
    //            "Alt kmer:{},left position:{}",
    //            alt_kmers_nodups[i], alt_kmers_data[i].left_position
    //        );
    //        println!(
    //            "Alt kmer:{},right position:{}",
    //            alt_kmers_nodups[i], alt_kmers_data[i].right_position
    //        );
    //    }
    //}

    let mut ref_scores = Vec::<read_diff_scores>::new(); // Vector for storing structs of type read_diff_scores which contain diff_scores, ref_insertion status, polyclonal status, original group ID of reads classified as supporting ref allele
    let mut alt_scores = Vec::<read_diff_scores>::new(); // Vector for storing structs of type read_diff_scores which contain diff_scores, ref_insertion status, polyclonal status, original group ID of reads classified as supporting alt allele
    if lines.len() - 2 <= single_thread_limit {
        // Start of sequential single-thread implementation for classifying reads
        let mut i: i64 = 0;
        //let num_of_reads: f64 = (lines.len() - 2) as f64;
        for read in lines {
            if i >= 2 {
                // The first two sequences are reference and alternate allele and therefore skipped. Also checking there are no blank lines in the input file
                let (
                    within_indel,
                    correct_start_position,
                    correct_end_position,
                    splice_freq,
                    splice_start_pos,
                    splice_stop_pos,
                    splice_start_cigar,
                    splice_stop_cigar,
                ) = check_read_within_indel_region(
                    // Checks if the read contains the indel region (or a part of it)
                    start_positions_list[i as usize - 2].parse::<i64>().unwrap() - 1,
                    cigar_sequences_list[i as usize - 2].to_string(),
                    variant_pos,
                    indel_length as usize,
                    strictness,
                    read.len(),
                );
                println!("correct_start_position:{}", correct_start_position);
                println!("correct_end_position:{}", correct_end_position);
                println!(
                    "cigar_sequence:{}",
                    &cigar_sequences_list[i as usize - 2].to_string()
                );
                if within_indel == 1 {
                    // Checking if the read is in forward or reverse strand
                    let mut sequence_strand: String = "F".to_string(); // Initializing sequence strand to forward
                    if sequence_flags_list[i as usize - 2].parse::<i64>().unwrap() & 16 == 16 {
                        sequence_strand = "R".to_string();
                    }
                    let mut read_ambiguous = check_if_read_ambiguous(
                        // Function that checks if the start/end of a read is in a region such that it cannot be distinguished as supporting ref or alt allele
                        correct_start_position,
                        correct_end_position,
                        left_offset,
                        right_offset,
                        variant_pos,
                        refallele.len(),
                        &ref_nucleotides,
                        &alt_nucleotides,
                        optimized_allele,
                    );
                    let (
                        ref_polyclonal_read_status,
                        alt_polyclonal_read_status,
                        ref_insertion,
                        spliced_sequence, // This variable contains only the spliced part which contains the indel. If no splicing has occured, it will retain the entire original read sequence
                    ) = check_polyclonal(
                        // Function that checks if the read harbors polyclonal variant (neither ref not alt), flags if there is any insertion/deletion in indel region
                        read.to_string(),
                        correct_start_position,
                        correct_end_position,
                        cigar_sequences_list[i as usize - 2].to_string(),
                        variant_pos,
                        splice_start_pos,
                        splice_stop_pos,
                        &ref_nucleotides,
                        &alt_nucleotides,
                        &ref_nucleotides_all,
                        &alt_nucleotides_all_right,
                        &alt_nucleotides_all_left,
                        optimized_indel_length as usize,
                        ref_length as usize,
                        alt_length as usize,
                        indel_length as usize,
                        strictness,
                        0,
                        ref_alt_same_base_start,
                        splice_freq,
                        splice_start_cigar,
                        splice_stop_cigar,
                    );
                    //println!("alignment_side:{}", &alignment_side);
                    //println!("ref_polyclonal_read_status:{}", ref_polyclonal_read_status);
                    //println!("alt_polyclonal_read_status:{}", alt_polyclonal_read_status);
                    //println!("read_ambiguous:{}", read_ambiguous);
                    //println!("ref_insertion:{}", ref_insertion);

                    //let (kmers,ref_polyclonal_read_status,alt_polyclonal_read_status) = build_kmers_reads(read.to_string(), kmer_length, corrected_start_positions_list[i as usize -2] - 1, variant_pos, &ref_indel_kmers, &alt_indel_kmers, ref_length, alt_length);

                    //println!("spliced_sequence:{}", &spliced_sequence);
                    //println!("splice_start_pos:{}", splice_start_pos);
                    //println!("splice_stop_pos:{}", splice_stop_pos);
                    //let kmers = build_kmers_reads(spliced_sequence, kmer_length_iter); // Generates kmers for the given read
                    //                                                                   //println!("Reference:");
                    //let ref_comparison = jaccard_similarity_weights(
                    //    // Computes jaccard similarity w.r.t ref sequence
                    //    &kmers,
                    //    &ref_kmers_nodups,
                    //    &ref_kmers_data,
                    //    correct_start_position,
                    //    correct_end_position,
                    //    kmer_length_iter,
                    //    &alignment_side,
                    //);
                    ////println!("Alternate:");
                    //let alt_comparison = jaccard_similarity_weights(
                    //    // Computes jaccard similarity w.r.t alt sequence
                    //    &kmers,
                    //    &alt_kmers_nodups,
                    //    &alt_kmers_data,
                    //    correct_start_position,
                    //    correct_end_position,
                    //    kmer_length_iter,
                    //    &alignment_side,
                    //);
                    let ref_comparison =
                        align_single_reads(&spliced_sequence, reference_sequence.clone());
                    let alt_comparison =
                        align_single_reads(&spliced_sequence, alternate_sequence.clone());
                    println!("ref_comparison:{}", ref_comparison);
                    println!("alt_comparison:{}", alt_comparison);
                    let mut diff_score: f64 = 0.0;
                    if read_ambiguous < 2 {
                        diff_score = alt_comparison - ref_comparison; // Is the read more similar to reference sequence or alternate sequence
                    }

                    if (diff_score.abs() * 100000000.0).round() == 0.0 / 100000000.0 {
                        // Rounding off to 4 places of decimal
                        read_ambiguous = 2;
                    }
                    let item = read_diff_scores {
                        value: f64::from(diff_score),
                        abs_value: f64::from(diff_score.abs()), // Absolute value of diff_score
                        groupID: usize::from(i as usize - 2), // The -2 has been added since the first two sequences in the file are reference and alternate
                        alt_comparison: i64::from(alt_polyclonal_read_status),
                        ref_comparison: i64::from(ref_polyclonal_read_status),
                        polyclonal: i64::from(
                            ref_polyclonal_read_status + alt_polyclonal_read_status,
                        ),
                        ambiguous: read_ambiguous,
                        ref_insertion: i64::from(ref_insertion),
                        sequence_strand: String::from(sequence_strand),
                    };
                    if diff_score > 0.0 {
                        // If diff_score > 0 put in alt_scores vector otherwise in ref_scores
                        alt_scores.push(item);
                    } else if diff_score <= 0.0 {
                        ref_scores.push(item);
                    }
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
        let sequence_flags = Arc::new(sequence_flags);
        let refallele = Arc::new(refallele);
        let altallele = Arc::new(altallele);
        let reference_sequence = Arc::new(reference_sequence);
        let alternate_sequence = Arc::new(alternate_sequence);
        let ref_scores_temp = Arc::new(Mutex::new(Vec::<read_diff_scores>::new())); // This variable will store read_diff_scores struct of reads classifed as ref, but can be written into by all threads. When Mutex is not define (as in the variables above) they are read-only.
        let alt_scores_temp = Arc::new(Mutex::new(Vec::<read_diff_scores>::new())); // This variable will store read_diff_scores struct of reads classifed as alt, but can be written into by all threads. When Mutex is not define (as in the variables above) they are read-only.
        let ref_nucleotides_temp = Arc::new(ref_nucleotides_all); // Vector containing ref nucleotides of length similar to indel_length (used in strictness >=1)
        let alt_nucleotides_temp_right = Arc::new(alt_nucleotides_all_right); // Vector containing alt nucleotides of length similar to indel_length (used in strictness >=1). Contains nucleotides on the right hand side of the indel.
        let alt_nucleotides_temp_left = Arc::new(alt_nucleotides_all_left); // Vector containing alt nucleotides of length similar to indel_length (used in strictness >=1).  Contains nucleotides on the left hand side of the indel.
        let mut handles = vec![]; // Vector to store handle which is used to prevent one thread going ahead of another

        for thread_num in 0..max_threads {
            // Assigning thread number thread_num to each thread
            // In the next few lines each variable gets cloned, so that each thread has its own copy of the variable
            let sequences = Arc::clone(&sequences);
            let start_positions = Arc::clone(&start_positions);
            let cigar_sequences = Arc::clone(&cigar_sequences);
            let reference_sequence = Arc::clone(&reference_sequence);
            let alternate_sequence = Arc::clone(&alternate_sequence);
            let sequence_flags = Arc::clone(&sequence_flags);
            let refallele = Arc::clone(&refallele);
            let altallele = Arc::clone(&altallele);
            let ref_scores_temp = Arc::clone(&ref_scores_temp);
            let alt_scores_temp = Arc::clone(&alt_scores_temp);
            let ref_nucleotides_temp = Arc::clone(&ref_nucleotides_temp);
            let alt_nucleotides_temp_right = Arc::clone(&alt_nucleotides_temp_right);
            let alt_nucleotides_temp_left = Arc::clone(&alt_nucleotides_temp_left);

            let handle = thread::spawn(move || {
                // Thread is initiallized here
                //println!("thread:{}", thread_num);
                let lines: Vec<&str> = sequences.split("-").collect();
                let start_positions_list: Vec<&str> = start_positions.split("-").collect();
                let cigar_sequences_list: Vec<&str> = cigar_sequences.split("-").collect();
                let sequence_flags_list: Vec<&str> = sequence_flags.split("-").collect();
                let ref_nucleotides: Vec<char> = refallele.chars().collect();
                let alt_nucleotides: Vec<char> = altallele.chars().collect();
                let mut ref_scores_thread = Vec::<read_diff_scores>::new(); // This local variable stores all read_diff_scores (for ref classified reads) parsed by each thread. This variable is then concatenated from other threads later.
                let mut alt_scores_thread = Vec::<read_diff_scores>::new(); // This local variable stores all read_diff_scores (for alt classified reads) parsed by each thread. This variable is then concatenated from other threads later.
                for iter in 0..lines.len() - 2 {
                    let remainder: usize = iter % max_threads; // Calculate remainder of read number divided by max_threads to decide which thread parses this read
                    if remainder == thread_num {
                        // Thread analyzing a particular read must have the same remainder as the thread_num, this avoids multiple reads from parsing the same read. Also checking if the read length > 0

                        //println!(
                        //    "start_positions_list:{}",
                        //    start_positions_list[iter].parse::<i64>().unwrap() - 1
                        //);
                        //println!("cigar_sequences_list[iter]:{}", cigar_sequences_list[iter]);
                        let (
                            within_indel,
                            correct_start_position,
                            correct_end_position,
                            splice_freq,
                            splice_start_pos,
                            splice_stop_pos,
                            splice_start_cigar,
                            splice_stop_cigar,
                        ) = check_read_within_indel_region(
                            // Checks if the read contains the indel region (or a part of it)
                            start_positions_list[iter].parse::<i64>().unwrap() - 1,
                            cigar_sequences_list[iter].to_string(),
                            variant_pos,
                            indel_length as usize,
                            strictness,
                            lines[iter + 2].to_string().len(),
                        );
                        if within_indel == 1 {
                            // Checking if the read is in forward or reverse strand
                            let mut sequence_strand: String = "F".to_string(); // Initializing sequence strand to forward
                            if sequence_flags_list[iter].parse::<i64>().unwrap() & 16 == 16 {
                                sequence_strand = "R".to_string();
                            }
                            let mut read_ambiguous = check_if_read_ambiguous(
                                // Function that checks if the start/end of a read is in a region such that it cannot be distinguished as supporting ref or alt allele
                                correct_start_position,
                                correct_end_position,
                                left_offset,
                                right_offset,
                                variant_pos,
                                refallele.len(),
                                &ref_nucleotides,
                                &alt_nucleotides,
                                optimized_allele,
                            );

                            let (
                                ref_polyclonal_read_status,
                                alt_polyclonal_read_status,
                                ref_insertion,
                                spliced_sequence, // This variable contains only the spliced part which contains the indel. If no splicing has occured, it will retain the entire original read sequence
                            ) = check_polyclonal(
                                // Function that checks if the read harbors polyclonal variant (neither ref not alt), flags if there is any insertion/deletion in indel region
                                lines[iter + 2].to_string(),
                                correct_start_position,
                                correct_end_position,
                                cigar_sequences_list[iter].to_string(),
                                variant_pos,
                                splice_start_pos,
                                splice_stop_pos,
                                &ref_nucleotides,
                                &alt_nucleotides,
                                &ref_nucleotides_temp,
                                &alt_nucleotides_temp_right,
                                &alt_nucleotides_temp_left,
                                optimized_indel_length as usize,
                                ref_length as usize,
                                alt_length as usize,
                                indel_length as usize,
                                strictness,
                                0,
                                ref_alt_same_base_start,
                                splice_freq,
                                splice_start_cigar,
                                splice_stop_cigar,
                            );
                            //let kmers = build_kmers(lines[iter + 2].to_string(), kmer_length_iter); // Generate kmers for a given read sequence

                            //let kmers = build_kmers_reads(spliced_sequence, kmer_length_iter); // Generates kmers for the given read
                            //let ref_comparison = jaccard_similarity_weights(
                            //    // Computer jaccard similarity w.r.t ref
                            //    &kmers,
                            //    &ref_kmers_nodups,
                            //    &ref_kmers_data,
                            //    correct_start_position,
                            //    correct_end_position,
                            //    kmer_length_iter,
                            //    &alignment_side,
                            //);
                            //let alt_comparison = jaccard_similarity_weights(
                            //    // Computer jaccard similarity w.r.t alt
                            //    &kmers,
                            //    &alt_kmers_nodups,
                            //    &alt_kmers_data,
                            //    correct_start_position,
                            //    correct_end_position,
                            //    kmer_length_iter,
                            //    &alignment_side,
                            //);
                            let ref_comparison = align_single_reads(
                                &spliced_sequence,
                                reference_sequence.to_string(),
                            );
                            let alt_comparison = align_single_reads(
                                &spliced_sequence,
                                alternate_sequence.to_string(),
                            );
                            let mut diff_score: f64 = 0.0;
                            if read_ambiguous < 2 {
                                diff_score = alt_comparison - ref_comparison; // Is the read more similar to reference sequence or alternate sequence
                            }

                            if (diff_score.abs() * 100000000.0).round() == 0.0 / 100000000.0 {
                                // Rounding off to 4 places of decimal
                                read_ambiguous = 2;
                            }

                            let item = read_diff_scores {
                                value: f64::from(diff_score),
                                abs_value: f64::from(diff_score.abs()),
                                groupID: usize::from(iter),
                                alt_comparison: i64::from(alt_polyclonal_read_status),
                                ref_comparison: i64::from(ref_polyclonal_read_status),
                                polyclonal: i64::from(
                                    ref_polyclonal_read_status + alt_polyclonal_read_status,
                                ),
                                ambiguous: read_ambiguous,
                                ref_insertion: i64::from(ref_insertion),
                                sequence_strand: String::from(sequence_strand),
                            };
                            if diff_score > 0.0 {
                                // If diff_score > 0 put in alt_scores vector otherwise in ref_scores
                                alt_scores_thread.push(item);
                            } else if diff_score <= 0.0 {
                                ref_scores_thread.push(item);
                            }
                        }
                    }
                }
                // Once all reads are analyzed by a thread it transfers all the read_diff_scores thread. I tried out an alternative implementation where all read_diff_scores struct was directly stored in alt_scores_thread and ref_scores_thread but that was slower because it was keeping other threads idle while one was writing into those variables
                for item in alt_scores_thread {
                    alt_scores_temp.lock().unwrap().push(item);
                }
                drop(alt_scores_temp); // This drops the vector so that other threads can now write into this variable while the current thread can do some other computation. This helps in better concurrency.
                for item in ref_scores_thread {
                    ref_scores_temp.lock().unwrap().push(item);
                }
                drop(ref_scores_temp); // This drops the vector so that other threads can now write into this variable while the current thread can do some other computation. This helps in better concurrency.
            });
            handles.push(handle); // The handle (which contains the thread) is stored in the handles vector
        }
        for handle in handles {
            // Wait for all threads to finish before proceeding further
            handle.join().unwrap();
        }
        // Combining data from all different threads
        for item in &mut *ref_scores_temp.lock().unwrap() {
            let item2 = read_diff_scores_owned(item); // Converting from borrowed variable to owned (Read memory-safe nature of Rust in official documentation to better understand this)
            ref_scores.push(item2);
        }
        for item in &mut *alt_scores_temp.lock().unwrap() {
            let item2 = read_diff_scores_owned(item); // Converting from borrowed variable to owned (Read memory-safe nature of Rust in official documentation to better understand this)
            alt_scores.push(item2);
        }
    }

    let reads_analyzed_num: usize = ref_scores.len() + alt_scores.len();
    println!("Number of reads analyzed: {}", reads_analyzed_num);
    let mut ref_indices = Vec::<read_category>::new(); // Initializing a vector to store struct of type read_category for ref-classified reads. This importantly contains the read category ref or none as categorized by classify_to_four_categories function
    if ref_scores.len() > 0 {
        ref_indices = classify_to_four_categories(&mut ref_scores, strictness);
        // Function to classify reads as either ref or as none
    }

    let mut alt_indices = Vec::<read_category>::new(); // Initializing a vector to store struct of type read_category for alt-classified reads. This importantly contains the read category alt or none as categorized by classify_to_four_categories function
    if alt_scores.len() > 0 {
        alt_indices = classify_to_four_categories(&mut alt_scores, strictness);
        // Function to classify reads as either alt or as none
    }

    let mut output_cat: String = "".to_string(); // Initializing string variable which will store the read categories and will be printed for being passed onto nodejs
    #[allow(non_snake_case)]
    let mut output_gID: String = "".to_string(); // Initializing string variable which will store the original read ID and will be printed for being passed onto nodejs
    let mut output_diff_scores: String = "".to_string(); // Initializing string variable which will store the read diff_scores and will be printed for being passed onto nodejs
    let mut alternate_forward_count: u32 = 0; // Alternate forward read counter
    let mut alternate_reverse_count: u32 = 0; // Alternate reverse read counter
    let mut reference_forward_count: u32 = 0; // Reference forward read counter
    let mut reference_reverse_count: u32 = 0; // Reference reverse read counter
    for item in &ref_indices {
        if item.category == "amb" {
            output_cat.push_str("amb:"); // Appending amb (i.e ambiguous) to output_cat string
        } else if item.ref_insertion == 1 {
            // In case of ref-classified reads, if there is any insertion/deletion in the indel region it will get classified into the none category.
            output_cat.push_str("none:"); // Appending none to output_cat string
        } else if strictness >= 2 && item.ref_comparison == 1 {
            output_cat.push_str("none:"); // Appending none to output_cat string
        } else if item.category == "refalt".to_string() {
            output_cat.push_str("ref:"); // Appending ref to output_cat string
            if item.sequence_strand == "F".to_string() {
                reference_forward_count += 1;
            } else if item.sequence_strand == "R".to_string() {
                reference_reverse_count += 1;
            }
        } else {
            output_cat.push_str("none:"); // Appending none to output_cat string
        }
        output_gID.push_str(&item.groupID.to_string()); // Appending group ID to output_gID string
        output_gID.push_str(&":".to_string()); // Appending ":" to string
        output_diff_scores.push_str(&item.diff_score.to_string()); // Appending diff_score to output_diff_scores string
        output_diff_scores.push_str(&":".to_string()); // Appending ":" to string
    }

    for item in &alt_indices {
        if item.category == "amb" {
            output_cat.push_str("amb:"); // Appending amb (i.e ambiguous) to output_cat string
        } else if strictness >= 2 && item.alt_comparison == 1 {
            output_cat.push_str("none:"); // Appending none to output_cat string
        } else if item.category == "refalt".to_string() {
            output_cat.push_str("alt:"); // Appending alt to output_cat string
            if item.sequence_strand == "F".to_string() {
                alternate_forward_count += 1;
            } else if item.sequence_strand == "R".to_string() {
                alternate_reverse_count += 1;
            }
        } else {
            output_cat.push_str("none:"); // Appending none to output_cat string
        }

        output_gID.push_str(&item.groupID.to_string()); // Appending group ID to output_gID string
        output_gID.push_str(&":".to_string()); // Appending ":" to string
        output_diff_scores.push_str(&item.diff_score.to_string()); // Appending diff_score to output_diff_scores string
        output_diff_scores.push_str(&":".to_string()); // Appending ":" to string
    }
    println!("alternate_forward_count:{}", alternate_forward_count);
    println!("alternate_reverse_count:{}", alternate_reverse_count);
    println!("reference_forward_count:{}", reference_forward_count);
    println!("reference_reverse_count:{}", reference_reverse_count);

    let p_value = strand_analysis(
        alternate_forward_count,
        alternate_reverse_count,
        reference_forward_count,
        reference_reverse_count,
    );

    println!("strand_probability:{:.2}", p_value);

    output_cat.pop(); // Removing the last ":" character from string
    output_gID.pop(); // Removing the last ":" character from string
    output_diff_scores.pop(); // Removing the last ":" character from string
    println!("output_cat:{:?}", output_cat); // Final read categories assigned
    println!("output_gID:{:?}", output_gID); // Initial read group ID corresponding to read category in output_cat
    println!("output_diff_scores:{:?}", output_diff_scores); // Final diff_scores corresponding to reads in group ID
}

fn strand_analysis(
    alternate_forward_count: u32,
    alternate_reverse_count: u32,
    reference_forward_count: u32,
    reference_reverse_count: u32,
) -> f64 {
    let mut fisher_chisq_test: u64 = 1; // Initializing to fisher-test

    let fisher_limit = 300; // If number of alternate + reference reads greater than this number, chi-sq test will be invoked
    if alternate_forward_count
        + alternate_reverse_count
        + reference_forward_count
        + reference_reverse_count
        > fisher_limit
    {
        fisher_chisq_test = 2; // Setting test = chi-sq
    }
    let (p_value_original, fisher_chisq_test) = strand_analysis_one_iteration(
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
        let (p_temp, fisher_test_temp) = strand_analysis_one_iteration(
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

fn strand_analysis_one_iteration(
    alternate_forward_count: u32,
    alternate_reverse_count: u32,
    reference_forward_count: u32,
    reference_reverse_count: u32,
    fisher_chisq_test: u64, // This option is useful id this function has already been preiously run, we can ask to run the spcific test only rather than having to try out both tests each time. This decreases execution time. 0 = first time (both tests will be tried), 1 = fisher test, 2 = chi-sq test
) -> (f64, u64) {
    let mut p_value: f64 = 0.0;
    let mut fisher_chisq_test_final: u64 = 0;

    if fisher_chisq_test == 0 {
        let p_value_result = panic::catch_unwind(|| {
            let p_value = fishers_exact(&[
                alternate_forward_count,
                alternate_reverse_count,
                reference_forward_count,
                reference_reverse_count,
            ])
            .unwrap()
            .greater_pvalue;
            p_value
        });

        match p_value_result {
            Ok(res) => {
                //println!("Fisher test worked:{:?}", p_value_result);
                p_value = res;
                fisher_chisq_test_final = 1;
            }
            Err(_) => {
                //println!("Fisher test failed, using Chi-sq test instead");
                p_value = chi_square_test(
                    alternate_forward_count,
                    alternate_reverse_count,
                    reference_forward_count,
                    reference_reverse_count,
                );
                fisher_chisq_test_final = 2;
            }
        }
    } else if fisher_chisq_test == 1 {
        let p_value_result = panic::catch_unwind(|| {
            let p_value = fishers_exact(&[
                alternate_forward_count,
                alternate_reverse_count,
                reference_forward_count,
                reference_reverse_count,
            ])
            .unwrap()
            .greater_pvalue;
            p_value
        });

        match p_value_result {
            Ok(res) => {
                //println!("Fisher test worked:{:?}", p_value_result);
                p_value = res;
            }
            Err(_) => {
                //println!("Fisher test failed, using Chi-sq test instead");
                p_value = chi_square_test(
                    alternate_forward_count,
                    alternate_reverse_count,
                    reference_forward_count,
                    reference_reverse_count,
                );
            }
        }
        fisher_chisq_test_final = 1;
    } else if fisher_chisq_test == 2 {
        p_value = chi_square_test(
            alternate_forward_count,
            alternate_reverse_count,
            reference_forward_count,
            reference_reverse_count,
        );
        fisher_chisq_test_final = 2;
    }

    (p_value, fisher_chisq_test_final)
}

fn chi_square_test(
    alternate_forward_count: u32,
    alternate_reverse_count: u32,
    reference_forward_count: u32,
    reference_reverse_count: u32,
) -> f64 {
    if (alternate_reverse_count == 0 && reference_reverse_count == 0)
        || (alternate_forward_count == 0 && reference_forward_count == 0)
    {
        0.05 // Arbitarily put a very high number when there are only forward or reverse reads for alternate/reference
    } else {
        let total: f64 = (alternate_forward_count
            + alternate_reverse_count
            + reference_forward_count
            + reference_reverse_count) as f64;
        let expected_alternate_forward_count: f64 = (alternate_forward_count
            + alternate_reverse_count) as f64
            * (alternate_forward_count + reference_forward_count) as f64
            / total;
        let expected_alternate_reverse_count: f64 = (alternate_forward_count
            + alternate_reverse_count) as f64
            * (alternate_reverse_count + reference_reverse_count) as f64
            / total;
        let expected_reference_forward_count: f64 = (alternate_forward_count
            + reference_forward_count) as f64
            * (reference_forward_count + reference_reverse_count) as f64
            / total;
        let expected_reference_reverse_count: f64 = (reference_forward_count
            + reference_reverse_count) as f64
            * (alternate_reverse_count + reference_reverse_count) as f64
            / total;

        let chi_sq: f64 = ((alternate_forward_count as f64 - expected_alternate_forward_count)
            * (alternate_forward_count as f64 - expected_alternate_forward_count))
            / expected_alternate_forward_count
            + ((reference_forward_count as f64 - expected_reference_forward_count)
                * (reference_forward_count as f64 - expected_reference_forward_count))
                / expected_reference_forward_count
            + ((alternate_reverse_count as f64 - expected_alternate_reverse_count)
                * (alternate_reverse_count as f64 - expected_alternate_reverse_count))
                / expected_alternate_reverse_count
            + ((reference_reverse_count as f64 - expected_reference_reverse_count)
                * (reference_reverse_count as f64 - expected_reference_reverse_count))
                / expected_reference_reverse_count;

        //println!("chi_sq:{}", chi_sq);
        let chi_sq_dist = ChiSquared::new(1.0).unwrap(); // Using degrees of freedom = 1
        let p_value: f64 = 1.0 - chi_sq_dist.cdf(chi_sq);
        //println!("p-value:{}", p_value);
        p_value
    }
}

fn check_if_read_ambiguous(
    correct_start_position: i64,
    correct_end_position: i64,
    left_offset: usize,
    right_offset: usize,
    ref_start: i64,
    ref_length: usize,
    ref_nucleotides: &Vec<char>,
    alt_nucleotides: &Vec<char>,
    optimized_allele: usize,
) -> i64 {
    let mut read_ambiguous: i64 = 0;
    let mut ref_stop = ref_start + ref_length as i64;
    if ref_nucleotides[0] == alt_nucleotides[0] {
        // Generally the alt position contains the nucleotide preceding the indel. In that case one is subtracted from ref_stop
        ref_stop -= 1;
    }

    //println!("ref_start (before offset):{}", ref_start);
    //println!("ref_stop (before offset):{}", ref_stop);
    let repeat_start = ref_start - left_offset as i64;
    let repeat_stop = ref_stop + right_offset as i64;
    //println!("correct_start_position:{}", correct_start_position);
    //println!("correct_end_position:{}", correct_end_position);
    //println!("repeat_start:{}", repeat_start);
    //println!("repeat_stop:{}", repeat_stop);

    //if repeat_start <= correct_start_position && correct_start_position <= ref_start {
    //    read_ambiguous = 2;
    //    println!("Case1");
    //} else if ref_stop <= correct_end_position && correct_end_position <= repeat_stop {
    //    read_ambiguous = 2;
    //    println!("Case2");
    //}

    if correct_start_position < repeat_start
        && repeat_start < correct_end_position
        && correct_end_position <= ref_start
    {
        read_ambiguous = 2;
        //println!("Case1 read ambiguous");
    } else if ref_stop < correct_start_position
        && correct_start_position < repeat_stop
        && correct_end_position > repeat_stop
    {
        read_ambiguous = 2;
        //println!("Case2 read ambiguous");
    }
    if repeat_start <= correct_start_position
        && correct_start_position < ref_start
        && correct_end_position > repeat_stop
        && optimized_allele == 1
    {
        read_ambiguous = 2;
        //println!("Case3 read ambiguous");
    } else if ref_stop <= correct_end_position
        && correct_end_position < repeat_stop
        && correct_start_position < repeat_start
        && optimized_allele == 1
    {
        read_ambiguous = 2;
        //println!("Case4 read ambiguous");
    } else if repeat_start <= correct_end_position && correct_end_position < ref_stop {
        if (correct_end_position - ref_start).abs() <= right_offset as i64 {
            read_ambiguous = 2;
            //println!("Case5 read ambiguous");
        }
    } else if ref_nucleotides.len() > alt_nucleotides.len()
        && ref_nucleotides[0] == ref_nucleotides[ref_nucleotides.len() - 1]
        && correct_start_position == ref_stop
    // When deletion starts and ends with the same nucleotide, a read containing only last nucleotide only should be considered ambiguous
    {
        read_ambiguous = 2;
        //println!("Case6 read ambiguous");
    } else if alt_nucleotides.len() > ref_nucleotides.len()
        && alt_nucleotides[0] == alt_nucleotides[alt_nucleotides.len() - 1]
        && correct_start_position == ref_stop
    // When insertion starts and ends with the same nucleotide, a read containing only last nucleotide only should be considered ambiguous
    {
        read_ambiguous = 2;
        //println!("Case7 read ambiguous");
    } else if ref_nucleotides.len() > alt_nucleotides.len()
        && ref_nucleotides[0] == ref_nucleotides[ref_nucleotides.len() - 1]
        && correct_end_position == ref_start
    // When deletion starts and ends with the same nucleotide, a read containing only first nucleotide only should be considered ambiguous
    {
        read_ambiguous = 2;
        //println!("Case8 read ambiguous");
    } else if alt_nucleotides.len() > ref_nucleotides.len()
        && alt_nucleotides[0] == alt_nucleotides[alt_nucleotides.len() - 1]
        && correct_end_position == ref_start
    // When insertion starts and ends with the same nucleotide, a read containing only first nucleotide only should be considered ambiguous
    {
        read_ambiguous = 2;
        //println!("Case9 read ambiguous");
    }

    // This part of the code is not tested, so its commented out for now.

    //else if ref_start <= correct_start_position && correct_start_position <= repeat_stop {
    //    if (correct_start_position - ref_stop).abs() <= left_offset as i64 {
    //        read_ambiguous = 2;
    //    }
    //}

    //if splice_freq > 0 {
    //    // When read is spliced
    //    println!("correct_start_position:{}", correct_start_position);
    //    println!("correct_end_position:{}", correct_end_position);
    //    println!("ref_start:{}", ref_start);
    //    println!("indel_length:{}", indel_length);
    //    if correct_start_position <= ref_start && ref_start + indel_length <= correct_end_position {
    //    } else {
    //        read_ambiguous = 2;
    //        println!("Case10 read ambiguous");
    //    }
    //}

    read_ambiguous
}

// This function preprocesses the flanking region, ref and alt allele to search if the indel is a tandem repeat (or a polymer consisting of small indels). It also looks if there is possibility of ambiguous reads if part of the flanking sequence is repeated inside the indel itself
fn preprocess_input(
    ref_nucleotides: &Vec<char>, // Vector containing reference nucleotides
    alt_nucleotides: &Vec<char>, // Vector containing alternate nucleotides
    ref_allele: &String,         // Sequence of reference allele
    alt_allele: &String,         // Sequence of alternate allele
    variant_pos: i64,            // Start position of indel
    indel_length: i64,           // Length of indel
    leftflankseq: String,        // Left flanking sequence
    rightflankseq: String,       // Right flanking sequence
    mut surrounding_region_length: i64, // Maximum limit upto which repetition of sequence will be searched to on either side of the indel
) -> (String, String, usize, usize, usize, usize) {
    let mut optimized_ref_allele = ref_allele.clone();
    let mut optimized_alt_allele = alt_allele.clone();
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

    // In the future, will need to check if there are repeats within the indel.

    // Check if the alt allele starts with ref nucleotide
    println!("indel_length:{}", indel_length);
    let mut original_indel_length = indel_length;
    let mut actual_indel = String::new();
    let mut ref_alt_same_base_start: usize = 0; // Flag to see if the original ref/alt nucleotide start with the same base i.e the ref start position of the indel is in the alt allele (e.g. ACGA/A representing 3bp deletion)
    if ref_nucleotides[0] == alt_nucleotides[0] {
        ref_alt_same_base_start = 1;
        original_indel_length = indel_length - 1; // If the insertion/deletion starts with same nucleotide, subtracting 1 from indel_length.
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
    println!("original_indel_length:{}", original_indel_length);
    let actual_indel_nucleotides: Vec<char> = actual_indel.chars().collect(); // Vector containing left flanking  nucleotides
                                                                              //let no_repeats: usize = 1; // Flag to check if non-repeating region has been reached
    let mut left_offset: usize = 0; // Position in left-flanking sequence from where nearby nucleotides will be parsed
    let mut right_offset: usize = 0; // Position in right-flanking sequence from where nearby nucleotides will be parsed
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

    for i in 0..original_indel_length as usize {
        let k = original_indel_length as usize - 1 - i;
        left_nearby_seq_reverse += &left_flanking_nucleotides[k].to_string();
        right_nearby_seq += &right_flanking_nucleotides[i].to_string();
    }

    left_nearby_seq = reverse_string(&left_nearby_seq_reverse);
    //println!("left_nearby_seq:{}", left_nearby_seq);
    //println!("right_nearby_seq:{}", right_nearby_seq);
    //println!("right_subseq:{}", right_subseq);
    println!("actual_indel:{}", actual_indel);

    let mut no_repeat_region = 0;
    if left_nearby_seq != actual_indel && right_nearby_seq != actual_indel {
        no_repeat_region = 1;
        println!("No repeating region");
    } else if left_nearby_seq == actual_indel && right_nearby_seq != actual_indel {
        println!("Left side is repeating");
        let repeating_sequence_left = check_flanking_sequence_for_repeats(
            &left_nearby_seq,
            &left_subseq,
            surrounding_region_length,
            "L",
        );
        optimized_variant_pos -= repeating_sequence_left.len() as i64; // Need to pass this to main and also change optimized ref and alt allele. Will need to do this later
    } else if left_nearby_seq != actual_indel && right_nearby_seq == actual_indel {
        println!("Right side is repeating");
        let repeating_sequence_right = check_flanking_sequence_for_repeats(
            &right_nearby_seq,
            &right_subseq,
            surrounding_region_length,
            "R",
        );
        println!("repeating_sequence_right:{}", repeating_sequence_right);
        optimized_alt_allele = optimized_alt_allele + &repeating_sequence_right;
        optimized_ref_allele = optimized_ref_allele + &repeating_sequence_right;
        right_offset += repeating_sequence_right.len();
    } else if left_nearby_seq == actual_indel && right_nearby_seq == actual_indel {
        println!("Both sides are repeating");
    }

    println!("optimized_variant_pos:{}", optimized_variant_pos);

    // Testing if the original indel starts with similar sequence as right flanking sequence or vice-versa (i.e original indel finishes with similar sequence as left-flanking sequence finishes with)
    let mut left_offset_part: usize = 0; // Position in left-flanking sequence from where nearby nucleotides will be parsed
    let mut right_offset_part: usize = 0; // Position in right-flanking sequence from where nearby nucleotides will be parsed
    let mut no_repeats_part: usize = 1; // Flag to check if non-repeating region has been reached
    let mut iter = 0;
    if ref_alt_same_base_start == 1 {
        // If ref/alt nucleotide start with the same base (e.g ACGA/A representing 3bp deletion),increment right_offset_part by 1
        right_offset_part += 1;
    }
    //println!(
    //    "right_flanking_nucleotides:{:?}",
    //    right_flanking_nucleotides
    //);
    //println!("left_flanking_nucleotides:{:?}", left_flanking_nucleotides);
    //println!("actual_indel_nucleotides:{:?}", actual_indel_nucleotides);

    while iter < original_indel_length as usize && no_repeats_part == 1 {
        if actual_indel_nucleotides[iter] != right_flanking_nucleotides[iter] {
            no_repeats_part = 0;
        } else {
            right_offset_part += 1;
            iter += 1;
        }
    }
    no_repeats_part = 1;
    iter = 0;
    while iter < original_indel_length as usize && no_repeats_part == 1 {
        let j = original_indel_length as usize - 1 - iter;
        if iter == 0
            && ref_alt_same_base_start == 1
            && ref_nucleotides[iter] != actual_indel_nucleotides[j]
        // In first iteration, check if the last nucleotide of the indel is same as the last common ref nucleotide between ref & alt (when ref_alt_same_base_start == 1)
        {
            no_repeats_part = 0;
        } else if actual_indel_nucleotides[j] != left_flanking_nucleotides[iter] {
            no_repeats_part = 0;
            //println!(
            //    "actual_indel_nucleotides[j]:{}",
            //    actual_indel_nucleotides[j]
            //);
            //println!(
            //    "left_flanking_nucleotides[iter]:{}",
            //    left_flanking_nucleotides[iter]
            //);
        } else {
            left_offset_part += 1;
            iter += 1;
        }
    }

    let mut optimized_allele: usize = 0; // Flag to check if alleles have been optimized
    if optimized_ref_allele.len() != ref_allele.len()
        || optimized_alt_allele.len() != alt_allele.len()
    {
        optimized_allele = 1;
        right_offset_part +=
            (optimized_alt_allele.len() as i64 - alt_allele.len() as i64).abs() as usize;
        // When the alt allele has been optimized, the right offset part needs to be increased
    }

    if right_offset_part > right_offset && no_repeat_region == 1 {
        right_offset = right_offset_part;
    }

    if left_offset_part > left_offset && no_repeat_region == 1 {
        left_offset = left_offset_part;
    }

    (
        optimized_ref_allele,
        optimized_alt_allele,
        left_offset,
        right_offset,
        ref_alt_same_base_start,
        optimized_allele,
    )
}

// Reversing a string
fn reverse_string(input: &str) -> String {
    let mut result = String::new();
    for c in input.chars().rev() {
        result.push(c)
    }
    result
}

// Function to check if the monomer is present in flanking region
fn check_flanking_sequence_for_repeats(
    monomer: &String,
    flanking_sequence: &String,
    surrounding_region_length: i64, // Checks for monomer in the flanking region but only upto surrounding_region_length
    side: &str,                     // "L" for left, "R" for right flanking sequence
) -> String {
    let sequence_vector: Vec<_> = flanking_sequence.chars().collect(); // Vector containing all the nucleotides of the reads as individual elements
    let num_iterations: i64 = surrounding_region_length / (monomer.len() as i64); // Number of times the monomer will have to be checked for repeating units from the variant region. e.g if monomer length is 2 and surrounding_region_length is 9, it will be 4 times at distances of 2, 4, 6 and 8 from the indel region
    let mut repeat_flanking_sequence = String::new();
    for i in 0..num_iterations {
        let mut subseq = String::new(); // String where putative repeat unit will be stored
        if &side == &"R" {
            for j in 0..monomer.len() {
                subseq += &sequence_vector[(i as usize) * monomer.len() + j].to_string();
                //
            }
        } else if &side == &"L" {
            for j in 0..monomer.len() {
                let k = monomer.len() - 1 - j;
                subseq += &sequence_vector[(i as usize) * monomer.len() + k].to_string();
                //
            }
        }
        if &subseq != monomer {
            break;
        }
        repeat_flanking_sequence.push_str(&subseq);
    }
    //println!("repeat_flanking_sequence:{}", repeat_flanking_sequence);
    repeat_flanking_sequence
}

fn check_read_within_indel_region(
    left_most_pos: i64, // Left most pos, contains start_positions_list input for that particular read i.e the nucleotide position from where that particular read starts from
    cigar_sequence: String, // Cigar sequence of that read
    indel_start: i64,   // Indel start position
    indel_length: usize, // Length of indel
    strictness: usize,  // Strictness of the indel pipeline
    original_read_length: usize, // Original read length
) -> (usize, i64, i64, usize, i64, i64, usize, usize) {
    let mut within_indel = 0; // 0 if read does not contain indel region and 1 if it contains indel region
    let mut correct_start_position: i64 = left_most_pos; // Many times reads starting with a softclip (e.g cigar sequence: 10S80M) will report the first matched nucleotide as the start position (i.e 11th nucleotide in this example). This problem is being corrected below
    let mut correct_end_position = correct_start_position; // Correct end position of read
    let mut splice_freq: usize = 0; // Number of times the read has been spliced
    let mut splice_start_pos: i64 = 0; // Start position of the spliced part of the region containing indel site relative to the read
    let mut splice_stop_pos: i64 = 0; // Stop position of the spliced part of the region containing indel site relative to the read
    let mut splice_start_cigar: usize = 0; // First cigar entry in the spliced fragment containing the variant to see if its a softclip
    let mut splice_stop_cigar: usize = 0; // Last cigar entry in the spliced fragment containing the variant to see if its a softclip

    if &cigar_sequence == &"*" || &cigar_sequence == &"=" {
    } else {
        let indel_stop: i64 = indel_start + indel_length as i64;
        let (alphabets, numbers) = cigar::parse_cigar(&cigar_sequence.to_string()); // Parsing out all the alphabets and numbers from the cigar sequence (using parse_cigar function)
        let cigar_length: usize = alphabets.len();
        // Check to see if the first item in cigar is a soft clip
        if &alphabets[0].to_string().as_str() == &"S" || &alphabets[0].to_string().as_str() == &"I"
        {
            correct_start_position =
                correct_start_position - numbers[0].to_string().parse::<i64>().unwrap();
            // Correcting for incorrect left position (when read starts with a softclip) by subtracting length of softclip from original left most position of read
        }
        let mut correct_start_position_without_splicing = correct_start_position; // Correct start position without splicing (if read is spliced);
        correct_end_position = correct_start_position;
        for i in 0..cigar_length {
            //if &alphabets[i].to_string().as_str() == &"D" {
            //    // In case of deleted nucleotides, the end position will be pushed to the left
            //    correct_end_position += numbers[i].to_string().parse::<i64>().unwrap();
            //} else
            if &alphabets[i].to_string().as_str() == &"H" { // In case of a hard-clip, the read in the bam file will not contain indel region
            } else if &alphabets[i].to_string().as_str() == &"N" {
                splice_freq += 1;
                correct_end_position += numbers[i].to_string().parse::<i64>().unwrap();
                correct_start_position_without_splicing +=
                    numbers[i].to_string().parse::<i64>().unwrap();
            } else if &alphabets[i].to_string().as_str() == &"I" {
            } else {
                correct_end_position += numbers[i].to_string().parse::<i64>().unwrap();
            }
        }
        let correct_end_position_without_splicing = correct_end_position;
        //println!(
        //    "correct_start_position_without_splicing(orig):{}",
        //    correct_start_position_without_splicing
        //);
        //println!(
        //    "&cigar_sequence.to_string():{}",
        //    &cigar_sequence.to_string()
        //);
        //println!("correct_start_position:{}", correct_start_position);
        //println!("correct_end_position:{}", correct_end_position);
        //println!("indel_start:{}", indel_start);
        //println!("indel_stop:{}", indel_stop);

        #[allow(unused_comparisons)] // In the future, may remove this "if strictness" condition
        if strictness >= 0 {
            let percentage_indel_length: f64 = 0.2; // Minimum fraction of length of indel needed to decide the max distance a read can be from the start of an indel so as to decide if the read harbors variant region
            let indel_cutoff: i64 = (indel_length as f64 * percentage_indel_length).ceil() as i64; // Max distance from start of an indel a read can start so as to consider if read contains variant region
                                                                                                   //println!("indel_cutoff:{}", indel_cutoff);
            if (indel_start + indel_cutoff <= correct_start_position
                && correct_end_position <= indel_stop - indel_cutoff)
                || (correct_start_position <= indel_start && indel_stop <= correct_end_position)
            // When the indel region is completely inside the read or the read is completely inside the indel region
            {
                //println!("case1 within_indel");
                within_indel = 1;
            } else if (indel_start + indel_cutoff <= correct_start_position
                && correct_start_position <= indel_stop - indel_cutoff)
                || (indel_start + indel_cutoff <= correct_end_position
                    && correct_end_position <= indel_stop - indel_cutoff)
            // When read contains only part of a read
            {
                //println!("case2 within_indel");
                within_indel = 1;
            }
        } else if (indel_start <= correct_start_position && correct_end_position <= indel_stop)
            || (correct_start_position <= indel_start && indel_stop <= correct_end_position)
        // When the indel region is completely inside the read or the read is completely inside the indel region
        {
            //println!("case3 within_indel");
            within_indel = 1;
        } else if (indel_start <= correct_start_position && correct_start_position <= indel_stop)
            || (indel_start <= correct_end_position && correct_end_position <= indel_stop)
        // When read contains only part of a read
        {
            //println!("case4 within_indel");
            within_indel = 1;
        } else {
            //println!("Case not addressed in within indel region. Please look!!");
            //println!("correct_start_position:{}", correct_start_position);
            //println!("correct_end_position:{}", correct_end_position);
            //println!("indel_start:{}", indel_start);
            //println!("indel_stop:{}", indel_stop);
        }

        // Checking if read is missing indel site due to splicing such as exon-skipping

        let mut splice_start_frag = correct_start_position; // Start of spliced part of read which contains indel region in ref genome coordinates
        let mut splice_stop_frag = correct_start_position; // Stop of spliced part of read which contains indel region in ref genome coordinates
        if splice_freq > 0 && within_indel == 1 {
            let mut nucleotide_position = 0; // This contains the position of nucleotide being analyzed w.r.t to read
            let mut nucleotide_position_without_splicing = 0; // This contains the position of nucleotide being analyzed w.r.t to read without splicing
            let mut new_frag = 1; // Flag indicating start of a new fragment after splicing
            for i in 0..alphabets.len() {
                if new_frag == 1 {
                    splice_start_cigar = 0;
                    splice_stop_cigar = 0;
                    if &alphabets[i].to_string().as_str() == &"S" {
                        splice_start_cigar = 1;
                    }
                    splice_start_frag += nucleotide_position;
                    splice_stop_frag = splice_start_frag;
                    splice_start_pos = nucleotide_position_without_splicing;
                    splice_stop_pos = nucleotide_position_without_splicing;
                    new_frag = 0
                }

                nucleotide_position += numbers[i].to_string().parse::<i64>().unwrap();
                if &alphabets[i].to_string().as_str() != &"N" {
                    nucleotide_position_without_splicing +=
                        numbers[i].to_string().parse::<i64>().unwrap();
                }
                if &alphabets[i].to_string().as_str() == &"I" {
                    // In case of an insertion, the position w.r.t to read will change, but no change will occur w.r.t reference genome since the inserted nucleotides are not present in the reference genome
                    splice_stop_pos += numbers[i].to_string().parse::<i64>().unwrap();
                }

                if &alphabets[i].to_string().as_str() == &"D" {
                    // In case of a deletion, the position w.r.t reference genome will change but no change will occur w.r.t reads since the deleted nucleotides are not present in the read
                    splice_stop_frag += numbers[i].to_string().parse::<i64>().unwrap();
                }

                if &alphabets[i].to_string().as_str() == &"M"
                    || &alphabets[i].to_string().as_str() == &"S"
                {
                    splice_stop_frag += numbers[i].to_string().parse::<i64>().unwrap();
                    splice_stop_pos += numbers[i].to_string().parse::<i64>().unwrap();
                }

                //println!("alphabet:{}", &alphabets[i].to_string().as_str());
                //println!("splice_start_frag:{}", splice_start_frag);
                //println!("splice_stop_frag2:{}", splice_stop_frag);

                if &alphabets[i].to_string().as_str() == &"N" {
                    new_frag = 1;
                    //splice_stop_frag += numbers[i].to_string().parse::<i64>().unwrap();
                    // Check if this fragment of read contains indel region or not
                    if (splice_start_frag <= indel_start && indel_start <= splice_stop_frag)
                        || (splice_start_frag <= indel_start + indel_length as i64
                            && indel_start + indel_length as i64 <= splice_stop_frag)
                    {
                        correct_start_position = splice_start_frag;
                        correct_end_position = splice_stop_frag;
                        if &alphabets[i].to_string().as_str() == &"S" {
                            splice_stop_cigar = 1;
                        }
                        //splice_start_pos = splice_start_frag;
                        //splice_stop_pos = nucleotide_position_without_splicing;
                        break;
                    }
                    //splice_stop_frag -= numbers[i].to_string().parse::<i64>().unwrap();
                } else if i == alphabets.len() - 1 {
                    // Last entry in CIGAR
                    // Check if this fragment of read contains indel region or not
                    if (splice_start_frag <= indel_start && indel_start <= splice_stop_frag)
                        || (splice_start_frag <= indel_start + indel_length as i64
                            && indel_start + indel_length as i64 <= splice_stop_frag)
                    {
                        correct_start_position = splice_start_frag;
                        correct_end_position = splice_stop_frag;
                        if &alphabets[i].to_string().as_str() == &"S" {
                            splice_stop_cigar = 1;
                        }
                        //splice_start_pos = splice_start_frag;
                        //splice_stop_pos = nucleotide_position_without_splicing;
                        break;
                    } else {
                        //println!("Somehow fragment containing indel site was not found, please check (within_indel = 0)!");
                        within_indel = 0;
                        //println!("splice_start_frag:{}", splice_start_frag);
                        //println!("splice_stop_frag:{}", splice_stop_frag);
                        //println!("indel_start:{}", indel_start);
                        //println!("indel_stop:{}", indel_start + indel_length as i64);
                    }
                }
            }

            // Check if the insertion (if variant is an insertion) is too close to the splice-site or not. In that case the start/end position of the read will have to be updated so that read containing the complete indel region is parsed
            if indel_start - (indel_length as i64) < correct_start_position
                && correct_start_position_without_splicing < indel_start - (indel_length as i64)
                && splice_start_pos - indel_length as i64 > 0
            // The second condition has been added to make sure that there is actually a spliced part of the sequence (adjoining to current one) where part of the sequence may have got wrongly spliced otherwise its possible that read only spans part of the variant region
            {
                //println!("Indel too close to splice site");
                correct_start_position = indel_start - (indel_length as i64);
                splice_start_pos = splice_start_pos - indel_length as i64;
            } else if indel_start + (indel_length as i64) > correct_end_position
                && correct_end_position_without_splicing > indel_start + (indel_length as i64)
                && splice_stop_pos as usize + indel_length < original_read_length
            // The second condition has been added to make sure that there is actually a spliced part of the sequence (adjoining to current one) where part of the sequence may have got wrongly spliced otherwise its possible that read only spans part of the variant region
            {
                //println!("Indel too close to splice site");
                correct_end_position = indel_start + (indel_length as i64);
                splice_stop_pos = splice_stop_pos + indel_length as i64;
            }
        }
    }

    (
        within_indel,
        correct_start_position,
        correct_end_position,
        splice_freq,
        splice_start_pos,
        splice_stop_pos,
        splice_start_cigar,
        splice_stop_cigar,
    )
}

#[allow(unused_variables)] // This is added to silence warnings because ref_alt_same_base_start and splice_stop_cigar variable is currently not being used. Maybe deprecated in the future

fn check_polyclonal(
    mut sequence: String,                  // Read sequence
    correct_start_position: i64,           // Left most pos
    correct_end_position: i64,             // Right most pos
    cigar_sequence: String,                // Cigar sequence of that read
    indel_start: i64,                      // Indel start position
    left_most_spliced: i64, // Left most position of fragment in read containing indel region (Used when read is spliced)
    right_most_spliced: i64, // Right most position of fragment in read containing indel region (Used when read is spliced)
    ref_nucleotides: &Vec<char>, // Vector containing ref allele nucleotides
    alt_nucleotides: &Vec<char>, // Vector containing alt allele nucleotides
    ref_nucleotides_all: &Vec<char>, // Vector containing ref allele nucleotides of size indel_length (Used when strictness >= 1)
    alt_nucleotides_all_right: &Vec<char>, // Vector containing alt allele nucleotides of size indel_length (Used when strictness >= 1).In case of deletion, contains nucleotides on the right hand side of the deletion
    alt_nucleotides_all_left: &Vec<char>, // Vector containing alt allele nucleotides of size indel_length (Used when strictness >= 1).In case of deletion, contains nucleotides on the left hand side of the deletion
    optimized_indel_length: usize,        // Optimized indel length
    ref_length: usize, // Ref allele length (This is passed and not calculated inside function since that would be repeating the same calculation (as this function is called inside for loop) increasing execution time)
    alt_length: usize, // Alt allele length
    indel_length: usize, // Length of indel
    strictness: usize, // Strictness of the pipeline
    found_duplicate_kmers: usize, // Flag to tell if there are duplicated kmers (Currently hardcoded to 0 in main function, but maybe used in the future)
    ref_alt_same_base_start: usize, // Flag to check if the ref and alt allele start with the last ref nucleotide (e.g A/ATCGT)
    splice_freq: usize,             // Number of splice junctions in read
    splice_start_cigar: usize, // First cigar entry in the spliced fragment containing the variant to see if its a softclip
    splice_stop_cigar: usize, // Last cigar entry in the spliced fragment containing the variant to see if its a softclip
) -> (i64, i64, i64, String) {
    let mut sequence_vector: Vec<_> = sequence.chars().collect(); // Vector containing each sequence nucleotides as separate elements in the vector
    let mut ref_polyclonal_status: i64 = 0; // Flag to check if the read sequence inside indel region matches ref allele (Will be used later to determine if the read harbors a polyclonal variant)
    let mut alt_polyclonal_status: i64 = 0; // Flag to check if the read sequence inside indel region matches alt allele (Will be used later to determine if the read harbors a polyclonal variant)
    let mut ref_insertion: i64 = 0; // Keep tab whether there is an insertion within the ref allele (This variable will be used later to parse out ref-classified reads that have insertions/deletions in indel region and evebtually classified as 'none')
    let mut alignment_side: String = "left".to_string(); // Flag to check whether kmers should be compared from the left or right-side in jaccard_similarity_weights() function
    let mut right_most_pos: i64;

    if &cigar_sequence == &"*" || &cigar_sequence == &"=" {
    } else {
        if splice_freq > 0 {
            // When read is spliced
            let mut spliced_seq = String::new(); // Contains spliced sequences which overlaps with indel region. If read not spliced, contains entire sequence

            //println!("Length of sequence:{}", sequence_vector.len());
            //println!("left_most_spliced:{}", left_most_spliced);
            //println!("right_most_spliced:{}", right_most_spliced);
            for k in left_most_spliced..right_most_spliced {
                if (k as usize) < sequence_vector.len() {
                    spliced_seq += &sequence_vector[k as usize].to_string();
                }
            }
            sequence = spliced_seq.clone();
            sequence_vector = sequence.chars().collect();
            //println!("spliced_seq:{}", spliced_seq);
        }
        let (alphabets, numbers) = cigar::parse_cigar(&cigar_sequence.to_string()); // Parsing out all the alphabets and numbers from the cigar sequence (using parse_cigar function)

        // Looking for insertions and deletions in cigar sequence
        let mut read_offset: usize = 0; // When read starts after the start of an indel insertion, this variable instructs the iterator (looking for wrong base calls instead of zero) to start from the position of ref/alt overlapping with the read insertion site
        let mut read_indel_start: usize = (indel_start - correct_start_position) as usize;

        // Position of cigar sequence starts in reference genome coordinates (i.e if cigar sequence is 47M3S, this will initialize to the reference genome coordinate of the start of the first matched nucleotide)
        //println!("indel start:{}", indel_start);
        //println!(
        //    "correct_start_position_without_splicing:{}",
        //    correct_start_position_without_splicing
        //);
        //println!("read_indel_start1:{}", read_indel_start);

        //if splice_freq > 0 {
        //    // When read is spliced
        //    let mut temp_position = correct_start_position;
        //    for i in 0..alphabets.len() {
        //        if &alphabets[i].to_string().as_str() == &"N" {
        //            read_indel_start = (indel_start - temp_position) as usize;
        //            break;
        //        } else {
        //            temp_position += numbers[i].to_string().parse::<i64>().unwrap();
        //        }
        //    }
        //}

        let mut parse_position: usize = 0; // This contains the current cigar position being analyzed
        let mut old_parse_position: usize = 0; // This contains the previous cigar position being analyzed
        let mut indel_insertion_starts = Vec::<usize>::new(); // Vector storing insertion starts if inside indel region
        let mut indel_insertion_stops = Vec::<usize>::new(); // Vector storing insertion stops if inside indel region

        // When read starts with softclip, right_most_pos is initialized to left_most_pos and subsequently incremented using the CIGAR entries
        right_most_pos = correct_start_position;
        let mut numbers_position = Vec::<usize>::new();
        let mut position: usize = 0;
        for i in 0..alphabets.len() {
            // Looping over each CIGAR item
            if &alphabets[i].to_string().as_str() != &"H" {
                // If the cigar item is a hard-clip, the right_most_pos will not be incremented
                right_most_pos += numbers[i].to_string().parse::<i64>().unwrap();
                // right_most_pos incremented when read starts with soft-clip
            }
            if &alphabets[i].to_string().as_str() == &"N"
                || &alphabets[i].to_string().as_str() == &"H"
            {
            } else {
                position += numbers[i].to_string().parse::<usize>().unwrap();
            }
            numbers_position.push(position);
        }

        //Determine if left or right_alignment

        //if &alphabets[0].to_string().as_str() == &"S"
        //    && &alphabets[alphabets.len() - 1].to_string().as_str() == &"S"
        //{ // If both sides are soft-clipped, then continue with left alignment. May need to think of a better logic later to handle this case.
        //} else

        let alignment_offset: i64 = 7; // Variable which sets the offset for reads that start only these many bases before the indel start. If the start position of the read lies between the offset and indel start, the read is right-aligned. This value is somewhat arbitary and may be changed in the future.

        //println!("correct_start_position:{}", correct_start_position);
        //println!(
        //    "correct_start_position + alignment_offset:{}",
        //    correct_start_position + alignment_offset
        //);
        //println!("right_most_pos:{}", right_most_pos);
        //println!("indel_start:{}", indel_start);
        //println!(
        //    "indel_start + indel_length:{}",
        //    indel_start + indel_length as i64
        //);

        if (&alphabets[0].to_string().as_str() == &"S"
            && &alphabets[alphabets.len() - 1].to_string().as_str() == &"S")
            && splice_freq == 0
        // When read starts and ends with a softclip
        {
            if (indel_start - correct_start_position).abs()
                <= (indel_start - correct_end_position).abs()
            // When start position is closer to indel start, read is right aligned
            {
                alignment_side = "right".to_string();
            }
        } else if &alphabets[0].to_string().as_str() == &"S"
            && splice_freq == 0
            && right_most_pos > indel_start + ref_length as i64 - alt_length as i64
        {
            alignment_side = "right".to_string();
            //read_indel_start = indel_start as usize - correct_end_position as usize + sequence.len();
            //read_indel_start = correct_end_position as usize - sequence.len();
        } else if splice_freq > 0
            && splice_start_cigar == 1
            && right_most_pos > indel_start + ref_length as i64 - alt_length as i64
        {
            alignment_side = "right".to_string();
            //read_indel_start = indel_start as usize - correct_end_position as usize + sequence.len();
            //read_indel_start = correct_end_position as usize - sequence.len();
        } else if correct_start_position > indel_start
            && correct_start_position < indel_start + indel_length as i64
            && right_most_pos > indel_start + indel_length as i64
        {
            alignment_side = "right".to_string();
            //read_indel_start = indel_start as usize - correct_end_position as usize + sequence.len();
            //read_indel_start = correct_end_position as usize - sequence.len();
        } else if correct_start_position + alignment_offset > indel_start
            && right_most_pos > indel_start + indel_length as i64
        {
            alignment_side = "right".to_string();
            //read_indel_start = indel_start as usize - correct_end_position as usize + sequence.len();
            //read_indel_start = correct_end_position as usize - sequence.len();
        }

        // Determining read_indel_start based on whether read is left or right-aligned
        if correct_start_position > indel_start && alt_length >= ref_length {
            // If read starts after the indel insertion, read_indel_start is set to 0.
            read_indel_start = 0;
            read_offset = (correct_start_position - indel_start) as usize;
            //println!("case1");
            for i in 0..numbers_position.len() {
                if numbers_position[i] < indel_start as usize - correct_start_position as usize
                    && &alphabets[i].to_string().as_str() == &"I"
                {
                    read_indel_start += numbers[i] as usize;
                } else if i == 0 { // Avoid panic error in the next else if statement when i==0
                } else if numbers_position[i]
                    < indel_start as usize - correct_start_position as usize
                    && &alphabets[i].to_string().as_str() == &"D"
                    && numbers_position[i - 1] != read_indel_start
                    && (numbers_position[i - 1] as i64 - read_indel_start as i64).abs()
                        >= indel_length as i64
                // Avoid identical deletions where first and last nucleotide might be same leading to equivalent deletions. for e.g ACGA/A
                {
                    //println!("numbers_position[i]:{}", numbers_position[i]);
                    //println!("numbers[i]:{}", numbers[i]);
                    read_indel_start -= numbers[i] as usize;
                }
            }
        }
        //else if indel_start < correct_start_position_without_splicing
        //    && correct_start_position_without_splicing < indel_start + (indel_length as i64) // In case of deletion and read starts after indel start site, the first nucleotides will contain nucleotides from the left-hand side of the indel
        //    && indel_start + (indel_length as i64) < correct_end_position
        //    && ref_length > alt_length
        //{
        //    read_indel_start = (indel_start + (indel_length as i64)
        //        - correct_start_position_without_splicing) as usize;
        //    println!("case2");
        //}
        //else if alignment_side == "right"
        //    && correct_start_position_without_splicing <= indel_start
        //{
        //    read_indel_start = (indel_start + (indel_length as i64)
        //        - correct_start_position_without_splicing) as usize;
        //    println!("case3");
        //}
        else if alignment_side == "right" && ref_length >= alt_length {
            read_indel_start = sequence.len() - correct_end_position as usize
                + indel_start as usize
                + indel_length;
            //println!("case2");
            // Check if there any deletions or insertions between indel end-point and end-position of read
            for i in 0..numbers_position.len() {
                if numbers_position[i]
                    > sequence.len() - correct_end_position as usize
                        + indel_start as usize
                        + indel_length
                    && &alphabets[i].to_string().as_str() == &"I"
                {
                    read_indel_start -= numbers[i] as usize;
                } else if i == 0 { // Avoid panic error in the next else if statement when i==0
                } else if numbers_position[i]
                    > sequence.len() - correct_end_position as usize
                        + indel_start as usize
                        + indel_length
                    && &alphabets[i].to_string().as_str() == &"D"
                    && numbers_position[i - 1] != read_indel_start
                    && (numbers_position[i - 1] as i64 - read_indel_start as i64).abs()
                        >= indel_length as i64
                // Avoid identical deletions where first and last nucleotide might be same leading to equivalent deletions. for e.g ACGA/A
                {
                    //println!("numbers_position[i]:{}", numbers_position[i]);
                    //println!("numbers[i]:{}", numbers[i]);
                    read_indel_start += numbers[i] as usize;
                }
            }
        } else if alignment_side == "right" && alt_length > ref_length {
            read_indel_start =
                sequence.len() - correct_end_position as usize + indel_start as usize + ref_length;
            //println!("read_indel_start case3:{}", read_indel_start);
            //println!("sequence.len():{}", sequence.len());
            //println!("correct_end_position:{}", correct_end_position);
            //println!("indel_start:{}", indel_start);
            //println!("ref_length:{}", ref_length);
            //println!(
            //    "correct_end_position as usize - indel_start as usize - ref_length:{}",
            //    correct_end_position as usize - indel_start as usize - ref_length
            //);
            //println!("case3");

            // Check if there any deletions or insertions between indel end-point and end-position of read
            for i in 0..numbers_position.len() {
                if numbers_position[i]
                    > sequence.len() - correct_end_position as usize
                        + indel_start as usize
                        + indel_length
                    && &alphabets[i].to_string().as_str() == &"I"
                {
                    //println!("numbers_position[i]:{}", numbers_position[i]);
                    //println!(
                    //    "sequence.len() - correct_end_position as usize
                    //    + indel_start as usize
                    //    + indel_length:{}",
                    //    sequence.len() - correct_end_position as usize
                    //        + indel_start as usize
                    //        + indel_length
                    //);
                    read_indel_start -= numbers[i] as usize;
                    //println!("Insertion found between indel end-point and end-position")
                } else if i == 0 { // Avoid panic error in the next else if statement when i==0
                } else if numbers_position[i]
                    > sequence.len() - correct_end_position as usize
                        + indel_start as usize
                        + indel_length
                    && &alphabets[i].to_string().as_str() == &"D"
                    && numbers_position[i - 1] != read_indel_start
                    && (numbers_position[i - 1] as i64 - read_indel_start as i64).abs()
                        >= indel_length as i64
                // Avoid identical deletions where first and last nucleotide might be same leading to equivalent deletions. for e.g ACGA/A
                {
                    //println!("numbers_position[i]:{}", numbers_position[i]);
                    //println!("numbers[i]:{}", numbers[i]);
                    read_indel_start += numbers[i] as usize;
                }
            }
        } else if alignment_side == "left" {
            //println!("case4");
            for i in 0..numbers_position.len() {
                if numbers_position[i] < indel_start as usize - correct_start_position as usize
                    && &alphabets[i].to_string().as_str() == &"I"
                {
                    read_indel_start += numbers[i] as usize;
                } else if i == 0 { // Avoid panic error in the next else if statement when i==0
                } else if numbers_position[i]
                    < indel_start as usize - correct_start_position as usize
                    && &alphabets[i].to_string().as_str() == &"D"
                    && numbers_position[i - 1] != read_indel_start
                    && (numbers_position[i - 1] as i64 - read_indel_start as i64).abs()
                        >= indel_length as i64
                // Avoid identical deletions where first and last nucleotide might be same leading to equivalent deletions. for e.g ACGA/A
                {
                    //println!("numbers_position[i]:{}", numbers_position[i]);
                    //println!("numbers[i]:{}", numbers[i]);
                    read_indel_start -= numbers[i] as usize;
                }
            }
        } else {
            println!("case5");
        }

        //println!("read_indel_start2:{}", read_indel_start);
        //println!("sequence length:{}", sequence.len());
        //println!("correct_end_position:{}", correct_end_position);

        for i in 0..alphabets.len() {
            if parse_position < read_indel_start {
                parse_position += numbers[i].to_string().parse::<usize>().unwrap();
                if (&alphabets[i].to_string().as_str() == &"I")
                    //|| &alphabets[i].to_string().as_str() == &"S")
                    && strictness >= 1
                {
                    //read_indel_start += numbers[i].to_string().parse::<usize>().unwrap(); // Incrementing read_indel_start by the number of nucleotides described by CIGAR sequence

                    if read_indel_start <= old_parse_position
                        && parse_position <= read_indel_start + indel_length
                    {
                        // (Insertion inside indel region)
                        indel_insertion_starts.push(old_parse_position); // Adding indel start to vector
                        indel_insertion_stops.push(parse_position); // Adding indel stop to vector
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                           //println!("Case 1 ref");
                    } else if old_parse_position <= read_indel_start
                        && read_indel_start + indel_length <= parse_position
                    {
                        // (Indel region inside insertion)
                        indel_insertion_starts.push(old_parse_position);
                        indel_insertion_stops.push(parse_position);
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                           //println!("Case 2 ref");
                    } else if old_parse_position <= read_indel_start
                        && read_indel_start <= parse_position
                        && parse_position <= read_indel_start + indel_length
                        && found_duplicate_kmers == 0
                    // Only part of the insertion inside indel, found_duplicate_kmers is currently hardcoded to 0 in the main function. May be used in the future
                    {
                        // Making sure part of the insertion is within the indel region
                        //indel_insertion_starts.push(old_parse_position);
                        //indel_insertion_stops.push(parse_position);
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                           //println!("Case 3 ref");
                    } else if read_indel_start <= old_parse_position
                        && old_parse_position <= read_indel_start + indel_length
                        && read_indel_start + indel_length <= parse_position
                        && found_duplicate_kmers == 0
                    // Only part of the insertion inside indel, found_duplicate_kmers is currently hardcoded to 0 in the main function. May be used in the future
                    {
                        // Making sure part of the insertion is within the indel region
                        //indel_insertion_starts.push(old_parse_position);
                        //indel_insertion_stops.push(parse_position);
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                           //println!("Case 4 ref");
                    }
                } else if &alphabets[i].to_string().as_str() == &"I" && strictness >= 1 {
                    //read_indel_start += numbers[i].to_string().parse::<usize>().unwrap(); // Incrementing read_indel_start by the number of nucleotides described by CIGAR sequence

                    if read_indel_start <= old_parse_position
                        && parse_position <= read_indel_start + indel_length
                    {
                        // (Insertion inside indel region)
                        indel_insertion_starts.push(old_parse_position); // Adding indel start to vector
                        indel_insertion_stops.push(parse_position); // Adding indel stop to vector
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                           //println!("Case 5 ref");
                    } else if old_parse_position <= read_indel_start
                        && read_indel_start + indel_length <= parse_position
                    {
                        // (Indel region inside insertion)
                        indel_insertion_starts.push(old_parse_position);
                        indel_insertion_stops.push(parse_position);
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                           //println!("Case 6 ref");
                    } else if old_parse_position <= read_indel_start
                        && parse_position >= read_indel_start
                        && parse_position <= read_indel_start + indel_length
                        && found_duplicate_kmers == 0
                    // Only part of the insertion inside indel, found_duplicate_kmers is currently hardcoded to 0 in the main function. May be used in the future
                    {
                        // Making sure part of the insertion is within the indel region
                        //indel_insertion_starts.push(old_parse_position);
                        //indel_insertion_stops.push(parse_position);
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                           //println!("Case 7 ref");
                    } else if read_indel_start <= old_parse_position
                        && read_indel_start + indel_length > old_parse_position
                        && read_indel_start + indel_length <= parse_position
                        && found_duplicate_kmers == 0
                    // Only part of the insertion inside indel, found_duplicate_kmers is currently hardcoded to 0 in the main function. May be used in the future
                    {
                        // Making sure part of the insertion is within the indel region
                        //indel_insertion_starts.push(old_parse_position);
                        //indel_insertion_stops.push(parse_position);
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                           //println!("Case 8 ref");
                    }
                } else if &alphabets[i].to_string().as_str() == &"D" && strictness >= 1 {
                    //read_indel_start -= numbers[i].to_string().parse::<usize>().unwrap(); // In case of a deletion, position is pushed back to account for it

                    //println!("read_indel_start:{}", read_indel_start);
                    //println!("old_parse_position:{}", old_parse_position);
                    //println!("parse_position:{}", parse_position);
                    //println!(
                    //    "read_indel_start + indel_length:{}",
                    //    read_indel_start + indel_length
                    //);

                    if read_indel_start <= old_parse_position
                        && parse_position <= read_indel_start + indel_length
                    // Deletion inside indel region
                    {
                        // Making sure the insertion is within the indel region
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                    } else if old_parse_position <= read_indel_start
                        && read_indel_start + indel_length <= parse_position
                    // Indel region inside deletion
                    {
                        // Making sure the insertion is within the indel region
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                           //println!("Case 9 ref");
                    } else if old_parse_position <= read_indel_start
                        && parse_position >= read_indel_start
                        && parse_position <= read_indel_start + indel_length
                        && found_duplicate_kmers == 0
                    // Part of deletion inside indel region
                    {
                        // Making sure part of the insertion is within the indel region
                        ref_insertion = 1;
                        //println!("Case 10 ref");
                    } else if read_indel_start <= old_parse_position
                        && read_indel_start + indel_length > old_parse_position
                        && read_indel_start + indel_length <= parse_position
                        && found_duplicate_kmers == 0
                    // Part of deletion inside indel region
                    {
                        // Making sure part of the insertion is within the indel region
                        ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                           //println!("Case 11 ref");
                    }
                }
                old_parse_position = parse_position;
            } else if parse_position >= read_indel_start
                && strictness >= 1
                && (&alphabets[i].to_string().as_str() == &"I"
                    || &alphabets[i].to_string().as_str() == &"D")
            {
                parse_position += numbers[i].to_string().parse::<usize>().unwrap();
                if read_indel_start <= old_parse_position
                    && parse_position <= read_indel_start + indel_length
                // Insertion inside indel region
                {
                    // Making sure the insertion is within the indel region
                    //indel_insertion_starts.push(old_parse_position);
                    //indel_insertion_stops.push(parse_position);
                    ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                       //println!("Case 12 ref");
                } else if old_parse_position <= read_indel_start
                    && read_indel_start + indel_length <= parse_position
                {
                    // Making sure the insertion is within the indel region
                    //indel_insertion_starts.push(old_parse_position);
                    //indel_insertion_stops.push(parse_position);
                    ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                } else if old_parse_position <= read_indel_start
                    && read_indel_start <= parse_position
                    && parse_position <= read_indel_start + indel_length
                    && found_duplicate_kmers == 0
                    && strictness >= 1
                {
                    // Making sure part of the insertion is within the indel region
                    //indel_insertion_starts.push(old_parse_position);
                    //indel_insertion_stops.push(parse_position);
                    ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                       //println!("Case 13 ref");
                } else if read_indel_start <= old_parse_position
                    && old_parse_position <= read_indel_start + indel_length
                    && read_indel_start + indel_length <= parse_position
                    && found_duplicate_kmers == 0
                    && strictness >= 1
                {
                    // Making sure part of the insertion is within the indel region
                    //indel_insertion_starts.push(old_parse_position);
                    //indel_insertion_stops.push(parse_position);
                    ref_insertion = 1; // Setting ref_insertion to flag, so if reads gets initially classifed ar "Ref", it finally gets classified as "None"
                                       //println!("Case 14 ref");
                                       //println!("read_indel_start:{}", read_indel_start);
                                       //println!("old_parse_position:{}", old_parse_position);
                                       //println!("parse_position:{}", parse_position);
                                       //println!(
                                       //    "read_indel_start + indel_length:{}",
                                       //    read_indel_start + indel_length
                                       //);
                }
                //}
                old_parse_position = parse_position;
            } else {
                break;
            }
        }

        // Checking to see if nucleotides are same between read and ref/alt allele

        //println!("cigar:{}",cigar_sequence);

        //if strictness >= 2 {
        //    for i in 0..indel_length as usize {
        //        if read_indel_start + i < sequence.len() {
        //            if ref_length >= alt_length {
        //                if &ref_nucleotides[i] != &sequence_vector[read_indel_start + i] {
        //                    ref_polyclonal_status = 2; // If ref nucleotides don't match, the flag ref_polyclonal_status is set to 1. Later this will flag will be used to determine if the read harbors a polyclonal variant
        //                    break;
        //                }
        //            } else if alt_length > ref_length {
        //                if &alt_nucleotides[i] != &sequence_vector[read_indel_start + i] {
        //                    alt_polyclonal_status = 2; // If alt nucleotides don't match, the flag alt_polyclonal_status is set to 1. Later this will flag will be used to determine if the read harbors a polyclonal variant
        //                    break;
        //                }
        //            }
        //        } else {
        //            break;
        //        }
        //    }
        //} else

        //println!("ref_nucleotides_all:{:?}", ref_nucleotides_all);
        //println!("read_indel_start:{}", read_indel_start);
        //println!("sequence_vector:{:?}", sequence_vector);
        if strictness >= 1 {
            //if &alphabets[0].to_string().as_str() != &"S" {
            // When a read starts with a softclip, then the indel will be on the left-side. Then this logic below will not work. Will have to compare each nucleotide from the end of the indel rather than from the beginning
            for i in 0..optimized_indel_length as usize {
                //println!("correct_start_position:{}", correct_start_position);
                //println!("read_indel_start + i:{}", read_indel_start + i);
                //println!("sequence.len():{}", sequence.len());
                if alignment_side == "right" {
                    if ref_nucleotides.len() as i64 - 1 - i as i64 >= 0
                        && read_indel_start - i - 1 < sequence_vector.len()
                        && 0 <= read_indel_start as i64 - i as i64 - 1
                    {
                        if &ref_nucleotides[ref_nucleotides.len() - 1 - i]
                            != &sequence_vector[read_indel_start - i - 1]
                        {
                            //println!("Ref not same");
                            ref_polyclonal_status = 1; // If ref nucleotides don't match, the flag ref_polyclonal_status is set to 1. Later this will flag will be used to determine if the read harbors a polyclonal variant
                            break;
                        }
                    } else {
                        break;
                    }
                } else if read_indel_start + i < sequence.len()
                    && i + read_offset < ref_nucleotides_all.len()
                {
                    //if i == 0 && ref_alt_same_base_start == 1 {
                    //    if &ref_nucleotides_all[i] != &sequence_vector[read_indel_start + i] {
                    //        // Check to see its starting from the correct bp position (e.g if insertion is A/ATCG will check if its starting from A)
                    //        break;
                    //    }
                    //}

                    //println!(
                    //    "sequence_vector[read_indel_start + i]:{},{}",
                    //    &sequence_vector[read_indel_start + i],
                    //    read_indel_start + i
                    //);
                    //println!(
                    //    "ref_nucleotides_all[i + read_offset]:{},{}",
                    //    ref_nucleotides_all[i + read_offset],
                    //    i + read_offset
                    //);
                    //println!("sequence.len():{}", sequence.len());
                    //println!("ref_nucleotides_all.len():{}", ref_nucleotides_all.len());
                    if &ref_nucleotides_all[i + read_offset]
                        != &sequence_vector[read_indel_start + i]
                    {
                        //println!("Ref not same");
                        ref_polyclonal_status = 1; // If ref nucleotides don't match, the flag ref_polyclonal_status is set to 1. Later this will flag will be used to determine if the read harbors a polyclonal variant
                        break;
                    }
                } else {
                    break;
                }
            }

            for i in 0..optimized_indel_length as usize {
                if ref_length > alt_length && alignment_side == "right"
                // Example case: Deletion: ACT{ATCGATAC/A}GCAT . If read is ATACGCAT.
                {
                    #[allow(unused_comparisons)]
                    if read_indel_start - i - 1 < sequence.len()
                        && i < alt_nucleotides_all_left.len()
                        && read_indel_start as i64 - i as i64 - 1 >= 0
                    {
                        //if i == 0 && ref_alt_same_base_start == 1 {
                        //    if &alt_nucleotides_all[i] != &sequence_vector[read_indel_start + i] {
                        //        // Check to see its starting from the correct bp position (e.g if insertion is A/ATCG will check if its starting from A)
                        //        break;
                        //    }
                        //}

                        //println!("i:{}", i);
                        //println!("read_indel_start - i - 1 :{}", read_indel_start - i - 1);
                        //println!(
                        //    "sequence_vector[read_indel_start - i]:{}",
                        //    &sequence_vector[read_indel_start - i - 1]
                        //);
                        //println!(
                        //    "alt_nucleotides_all_left[i]:{}",
                        //    alt_nucleotides_all_left[i]
                        //);
                        if &alt_nucleotides_all_left[i]
                            != &sequence_vector[read_indel_start - i - 1]
                        {
                            //println!("Alt not same");
                            alt_polyclonal_status = 1; // If alt nucleotides don't match, the flag alt_polyclonal_status is set to 1. Later this will flag will be used to determine if the read harbors a polyclonal variant
                            break;
                        }
                    } else {
                        break;
                    }
                } else if alignment_side == "right" && alt_length >= ref_length {
                    if alt_nucleotides.len() as i64 - 1 - i as i64 >= 0
                        && read_indel_start - i - 1 < sequence_vector.len()
                        && 0 <= read_indel_start as i64 - i as i64 - 1
                    {
                        //println!("i:{}", i);
                        //println!("read_indel_start - i - 1 :{}", read_indel_start - i - 1);
                        //println!(
                        //    "sequence_vector[read_indel_start - i - 1]:{}",
                        //    &sequence_vector[read_indel_start - i - 1]
                        //);
                        //println!(
                        //    "alt_nucleotides[alt_nucleotides.len() - 1 - i]:{}",
                        //    alt_nucleotides[alt_nucleotides.len() - 1 - i]
                        //);

                        if &alt_nucleotides[alt_nucleotides.len() - 1 - i]
                            != &sequence_vector[read_indel_start - i - 1]
                        {
                            //println!("Alt not same");
                            alt_polyclonal_status = 1; // If alt nucleotides don't match, the flag alt_polyclonal_status is set to 1. Later this will flag will be used to determine if the read harbors a polyclonal variant
                            break;
                        }
                    } else {
                        break;
                    }
                } else {
                    if read_indel_start + i < sequence.len()
                        && i + read_offset < alt_nucleotides_all_right.len()
                    {
                        //if i == 0 && ref_alt_same_base_start == 1 {
                        //    if &alt_nucleotides_all[i] != &sequence_vector[read_indel_start + i] {
                        //        // Check to see its starting from the correct bp position (e.g if insertion is A/ATCG will check if its starting from A)
                        //        break;
                        //    }
                        //}

                        //println!("read_offset:{}", read_offset);
                        //println!(
                        //    "sequence_vector[read_indel_start + i]:{}",
                        //    &sequence_vector[read_indel_start + i]
                        //);
                        //println!(
                        //    "alt_nucleotides_all_right[i + read_offset]:{}",
                        //    alt_nucleotides_all_right[i + read_offset]
                        //);
                        if &alt_nucleotides_all_right[i + read_offset]
                            != &sequence_vector[read_indel_start + i]
                        {
                            //println!("Alt not same");
                            alt_polyclonal_status = 1; // If alt nucleotides don't match, the flag alt_polyclonal_status is set to 1. Later this will flag will be used to determine if the read harbors a polyclonal variant
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }

            //} else {
            //  println!("optimized_indel_length:{}", optimized_indel_length);
            //  for i in 0..optimized_indel_length as usize {
            //      let j = optimized_indel_length - i;
            //      println!("read_indel_start:{}", read_indel_start);
            //      println!("j:{}", j);
            //      if read_indel_start as i64 - j as i64 > 0
            //          && read_indel_start - j < sequence.len()
            //          && j + read_offset < ref_nucleotides_all.len()
            //      {
            //          println!(
            //              "ref_nucleotides_all[j + read_offset]:{}",
            //              &ref_nucleotides_all[j + read_offset]
            //          );
            //          println!(
            //              "sequence_vector[read_indel_start - j]:{}",
            //              &sequence_vector[read_indel_start - j]
            //          );
            //          if &ref_nucleotides_all[j + read_offset]
            //              != &sequence_vector[read_indel_start - j]
            //          {
            //              ref_polyclonal_status = 1; // If ref nucleotides don't match, the flag ref_polyclonal_status is set to 1. Later this will flag will be used to determine if the read harbors a polyclonal variant
            //              break;
            //          }
            //      } else {
            //          break;
            //      }
            //  }
            //
            //  for i in 0..optimized_indel_length as usize {
            //      let j = optimized_indel_length - i;
            //      println!("read_indel_start:{}", read_indel_start);
            //      println!("j:{}", j);
            //      if read_indel_start as i64 - j as i64 > 0
            //          && read_indel_start - j < sequence.len()
            //          && j + read_offset < alt_nucleotides_all_right.len()
            //      {
            //          println!(
            //              "alt_nucleotides_all_right[j + read_offset]:{}",
            //              &alt_nucleotides_all_right[j + read_offset]
            //          );
            //          println!(
            //              "sequence_vector[read_indel_start - j]:{}",
            //              &sequence_vector[read_indel_start - j]
            //          );
            //          if &alt_nucleotides_all_right[j + read_offset]
            //              != &sequence_vector[read_indel_start - j]
            //          {
            //              alt_polyclonal_status = 1; // If alt nucleotides don't match, the flag alt_polyclonal_status is set to 1. Later this will flag will be used to determine if the read harbors a polyclonal variant
            //              break;
            //          }
            //      } else {
            //          break;
            //      }
            //  }
            // }
        }

        //println!("ref_polyclonal_status:{}", ref_polyclonal_status);
        //println!("alt_polyclonal_status:{}", alt_polyclonal_status);

        // In case of an indel insertion, see if the inserted nucleotides in the read matches that of the indel of interest. If not, its marked as a polyclonal variant
        if indel_insertion_starts.len() > 0 {
            for i in 0..indel_insertion_starts.len() {
                let insertion_start: usize = indel_insertion_starts[i];
                let insertion_stop: usize = indel_insertion_stops[i];
                for j in (insertion_start - 1)..insertion_stop {
                    let k: usize = j - insertion_start + 1;
                    if k < indel_length && k < alt_nucleotides.len() && j < sequence_vector.len() {
                        if (&alt_nucleotides[k] != &sequence_vector[j])
                            && ((read_indel_start as usize) <= j)
                            && (j <= (read_indel_start as usize) + indel_length)
                        {
                            alt_polyclonal_status = 2; // alt_polyclonal_status = 2 is set to 2 which will automatically classify as a polyclonal variant
                            ref_polyclonal_status = 0;
                            break;
                        }
                    }
                }
            }
        }
    }

    //println!("cigar_sequence:{}", cigar_sequence);
    (
        ref_polyclonal_status,
        alt_polyclonal_status,
        ref_insertion,
        sequence, // This variable is being passed back because in case of splicing only the part which contains the indel will be retained
    )
}

fn classify_to_four_categories(
    kmer_diff_scores: &mut Vec<read_diff_scores>, // Vector containing read diff_scores for all reads classified as ref/alt
    strictness: usize,                            // Strictness of the pipeline
) -> Vec<read_category> {
    let mut indices = Vec::<read_category>::new(); // Vector of type struct read_category containing category classified, original group ID, diff_score and ref_insertion flag. This vecor will be finally returned to the main function
    let absolute_threshold_cutoff: f64 = 0.0; // Absolute threshold cutoff. If the absolute diff_score is less than this value, the read will automatically be classified as "none"
    for i in 0..kmer_diff_scores.len() {
        if kmer_diff_scores[i].polyclonal >= 2 as i64 {
            // If polyclonal is 2, it is automatically classified as 'none' since the allele neither matches ref allele or alt allele of interest
            let read_cat = read_category {
                category: String::from("none"),
                groupID: usize::from(kmer_diff_scores[i].groupID),
                alt_comparison: i64::from(kmer_diff_scores[i].alt_comparison),
                ref_comparison: i64::from(kmer_diff_scores[i].ref_comparison),
                diff_score: f64::from(kmer_diff_scores[i].value),
                ref_insertion: i64::from(kmer_diff_scores[i].ref_insertion),
                sequence_strand: String::from(&kmer_diff_scores[i].sequence_strand.to_owned()),
            };
            indices.push(read_cat);
        } else if kmer_diff_scores[i].ambiguous == 2 as i64 {
            // If ambiguous is 1, it is automatically classified as 'amb' since the read start/ends in a region which has the same sequence as that in the flanking region
            let read_cat = read_category {
                category: String::from("amb"),
                groupID: usize::from(kmer_diff_scores[i].groupID),
                alt_comparison: i64::from(kmer_diff_scores[i].alt_comparison),
                ref_comparison: i64::from(kmer_diff_scores[i].ref_comparison),
                diff_score: f64::from(kmer_diff_scores[i].value),
                ref_insertion: i64::from(kmer_diff_scores[i].ref_insertion),
                sequence_strand: String::from(&kmer_diff_scores[i].sequence_strand.to_owned()),
            };
            indices.push(read_cat);
        } else if kmer_diff_scores[i].abs_value <= absolute_threshold_cutoff && strictness >= 1 {
            // If diff_score absolute value is less than absolute threshold cutoff, it is automatically classified as 'none'
            let read_cat = read_category {
                category: String::from("none"),
                groupID: usize::from(kmer_diff_scores[i].groupID),
                alt_comparison: i64::from(kmer_diff_scores[i].alt_comparison),
                ref_comparison: i64::from(kmer_diff_scores[i].ref_comparison),
                diff_score: f64::from(kmer_diff_scores[i].value),
                ref_insertion: i64::from(kmer_diff_scores[i].ref_insertion),
                sequence_strand: String::from(&kmer_diff_scores[i].sequence_strand.to_owned()),
            };
            indices.push(read_cat);
        } else {
            let read_cat = read_category {
                category: String::from("refalt"),
                groupID: usize::from(kmer_diff_scores[i].groupID),
                alt_comparison: i64::from(kmer_diff_scores[i].alt_comparison),
                ref_comparison: i64::from(kmer_diff_scores[i].ref_comparison),
                diff_score: f64::from(kmer_diff_scores[i].value),
                ref_insertion: i64::from(kmer_diff_scores[i].ref_insertion),
                sequence_strand: String::from(&kmer_diff_scores[i].sequence_strand.to_owned()),
            };
            indices.push(read_cat);
        }
    }
    indices // Indices vector being returned to main function
}

fn align_single_reads(query_seq: &String, ref_seq: String) -> f64 {
    let query_vector: Vec<_> = query_seq.chars().collect();
    let ref_vector: Vec<_> = ref_seq.chars().collect();

    let score = |a: u8, b: u8| if a == b { 1i32 } else { -1i32 };
    // gap open score: -5, gap extension score: -1

    let mut aligner = Aligner::with_capacity(
        query_seq.as_bytes().len(),
        ref_seq.as_bytes().len(),
        -5, // gap open penalty
        -1, // gap extension penalty
        &score,
    );

    let alignment = aligner.global(query_seq.as_bytes(), ref_seq.as_bytes());
    //let alignment = aligner.semiglobal(query_seq.as_bytes(), ref_seq.as_bytes());
    //let alignment = aligner.local(query_seq.as_bytes(), ref_seq.as_bytes());

    //let scoring = Scoring::from_scores(-5, -1, 1, -1) // Gap open, extend, match, mismatch score
    //    .xclip(MIN_SCORE) // Clipping penalty for x set to 'negative infinity', hence global in x
    //    .yclip(MIN_SCORE); // Clipping penalty for y set to 'negative infinity', hence global in y
    //
    //let mut aligner = Aligner::with_scoring(scoring);
    //let alignment = aligner.custom(query_seq.as_bytes(), ref_seq.as_bytes());

    let alignment_seq = alignment.operations;
    let mut q_seq: String = String::new();
    let mut align: String = String::new();
    let mut r_seq: String = String::new();
    let mut j: usize = 0;
    let mut k: usize = 0;
    let num_matches;
    for i in 0..alignment_seq.len() {
        if AlignmentOperation::Match == alignment_seq[i] {
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            if k < ref_vector.len() {
                r_seq += &ref_vector[k].to_string();
                k += 1;
            }
            align += &"|".to_string(); // Add "|" when there is a match
        } else if AlignmentOperation::Subst == alignment_seq[i] {
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            if k < ref_vector.len() {
                r_seq += &ref_vector[k].to_string();
                k += 1;
            }
            align += &"*".to_string(); // Add "*" when there is a substitution
        } else if AlignmentOperation::Del == alignment_seq[i] {
            if j > 0 && j < query_vector.len() {
                // This condition is added so as to suppress part of the reference sequence that do not lie within the read region
                q_seq += &"-".to_string();
            }
            if k < ref_vector.len() {
                if j > 0 && j < query_vector.len() {
                    // This condition is added so as to suppress part of the reference sequence that do not lie within the read region
                    r_seq += &ref_vector[k].to_string();
                }
                k += 1;
            }
            if j > 0 && j < query_vector.len() {
                // This condition is added so as to suppress part of the reference sequence that do not lie within the read region
                align += &" ".to_string(); // Add empty space when there is a deletion
            }
        } else if AlignmentOperation::Ins == alignment_seq[i] {
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            r_seq += &"-".to_string();
            align += &" ".to_string(); // Add empty space when there is an insertion
        } else {
            // Should not happen, added to help debug if it ever happens
            println!("Alignment operation not found:{}{:?}", i, alignment_seq[i]);
        }
    }

    // Need to check if the first and last nucleotide has been incorrectly aligned or not
    let (_q_seq_correct, align_correct, _r_seq_correct) =
        check_first_last_nucleotide_correctly_aligned(&q_seq, &align, &r_seq);
    num_matches = align_correct.matches("|").count() as f64;
    num_matches / align_correct.len() as f64
}

fn check_first_last_nucleotide_correctly_aligned(
    q_seq: &String,
    align: &String,
    r_seq: &String,
) -> (String, String, String) {
    println!("q_seq:{}", q_seq);
    println!("align:{}", align);
    println!("r_seq:{}", r_seq);

    // Check if last nucleotide(s) is correctly aligned and if substituted remove the unnecessary gap

    // First parsing out the last set of matched nucleotides and first set of unmatched sequence
    let mut q_seq_chars: Vec<_> = q_seq.chars().collect();
    let mut align_chars: Vec<_> = align.chars().collect();
    let mut r_seq_chars: Vec<_> = r_seq.chars().collect();
    //println!("r_seq_chars:{:?}", r_seq_chars);
    let mut first_matched_nucleotides = String::new();
    let mut first_substituted_nucleotides = String::new();
    let mut first_unmatched_sequence = String::new();
    let mut first = 0;
    let mut wrong_substitution = true; // Flag to check if last nucleotide has a substitution that should have been placed earlier
    for i in 0..align_chars.len() {
        let j = align_chars.len() - i - 1;
        if &align_chars[j].to_string() == &"|" && first == 0 {
            first_matched_nucleotides.push(r_seq_chars[j]);
            wrong_substitution = false;
        } else if &align_chars[j].to_string() == &"*" && first == 0 {
            first_substituted_nucleotides.push(q_seq_chars[j]);
        } else if first == 1 && &align_chars[j].to_string() != &"|" {
            // Addition of nucleotides to first unmatched sequence
            first_unmatched_sequence.push(r_seq_chars[j]);
        } else if first == 0 && &align_chars[j].to_string() != &"|" {
            // End of first matched nucleotide and start of first unmatched sequence
            first += 1;
            first_unmatched_sequence.push(r_seq_chars[j]);
        } else {
            break;
        }
    }

    // Check for partially aligned sequences on right side
    first = 0;
    let mut first_partially_matched_nucleotides_right = String::new(); // First partially matched sequence on the right hand side
    let mut first_unmatched_sequence_right_wrt_partially_matched_nucleotides = String::new(); // First unmatched sequence to the right w.r.t first_partially_matched_nucleotides_right
    for i in 0..align_chars.len() {
        let j = align_chars.len() - i - 1;
        if (&align_chars[j].to_string() == &"|" || &align_chars[j].to_string() == &"*")
            && first == 0
        {
            first_partially_matched_nucleotides_right.push(q_seq_chars[j]);
        } else if first == 0 && &align_chars[j].to_string() == &" " {
            first += 1;
            first_unmatched_sequence_right_wrt_partially_matched_nucleotides.push(r_seq_chars[j]);
        } else if first == 1 && &align_chars[j].to_string() == &" " {
            first_unmatched_sequence_right_wrt_partially_matched_nucleotides.push(r_seq_chars[j]);
        } else {
            break;
        }
    }

    // Check for partially aligned sequences on left side
    first = 0;
    let mut first_partially_matched_nucleotides_left = String::new(); // First partially matched sequence on the left hand side
    let mut first_unmatched_sequence_left_wrt_partially_matched_nucleotides = String::new(); // First unmatched sequence to the right w.r.t first_partially_matched_nucleotides_left
    for i in 0..align_chars.len() {
        if (&align_chars[i].to_string() == &"|" || &align_chars[i].to_string() == &"*")
            && first == 0
        {
            first_partially_matched_nucleotides_left.push(q_seq_chars[i]);
            //println!("i:{}", i);
            //println!("q_seq_chars[i]:{}", q_seq_chars[i]);
        } else if first == 0 && &align_chars[i].to_string() == &" " {
            first += 1;
            first_unmatched_sequence_left_wrt_partially_matched_nucleotides.push(r_seq_chars[i]);
            //println!("i:{}", i);
            //println!("r_seq_chars[i]:{}", r_seq_chars[i]);
        } else if first == 1 && &align_chars[i].to_string() == &" " {
            first_unmatched_sequence_left_wrt_partially_matched_nucleotides.push(r_seq_chars[i]);
            //println!("i:{}", i);
            //println!("r_seq_chars[i]:{}", r_seq_chars[i]);
        } else {
            break;
        }
    }
    println!(
        "first_partially_matched_nucleotides_left:{}",
        first_partially_matched_nucleotides_left
    );
    println!(
        "first_unmatched_sequence_left_wrt_partially_matched_nucleotides:{}",
        first_unmatched_sequence_left_wrt_partially_matched_nucleotides,
    );

    first_unmatched_sequence = reverse_string(&first_unmatched_sequence);
    first_matched_nucleotides = reverse_string(&first_matched_nucleotides);
    first_substituted_nucleotides = reverse_string(&first_substituted_nucleotides);
    first_partially_matched_nucleotides_right =
        reverse_string(&first_partially_matched_nucleotides_right);
    first_unmatched_sequence_right_wrt_partially_matched_nucleotides =
        reverse_string(&first_unmatched_sequence_right_wrt_partially_matched_nucleotides);
    println!("first_matched_nucleotides:{}", first_matched_nucleotides);
    println!(
        "first_substituted_nucleotides:{}",
        first_substituted_nucleotides
    );
    println!("first_unmatched_sequence:{}", first_unmatched_sequence);

    let first_matched_nucleotides_vector: Vec<_> = first_matched_nucleotides.chars().collect();
    let first_unmatched_sequence_vector: Vec<_> = first_unmatched_sequence.chars().collect();
    let first_partially_matched_nucleotides_right_vector: Vec<_> =
        first_partially_matched_nucleotides_right.chars().collect();
    let first_unmatched_sequence_right_wrt_partially_matched_nucleotides_vector: Vec<_> =
        first_unmatched_sequence_right_wrt_partially_matched_nucleotides
            .chars()
            .collect();

    let first_partially_matched_nucleotides_left_vector: Vec<_> =
        first_partially_matched_nucleotides_left.chars().collect();
    let first_unmatched_sequence_left_wrt_partially_matched_nucleotides_vector: Vec<_> =
        first_unmatched_sequence_left_wrt_partially_matched_nucleotides
            .chars()
            .collect();

    // Check if the first nucleotide(s) between first matched nucleotides is the same as the first nucleotides in the first set of unmatched sequences

    let mut alignment_wrong = true; // Flag to store if the last matched nucleotide is correctly aligned or not
    if first_matched_nucleotides.len() == 0 {
        alignment_wrong = false;
    } else if first_matched_nucleotides.len() <= first_unmatched_sequence.len() {
        for i in 0..first_matched_nucleotides.len() {
            if first_matched_nucleotides_vector[i] != first_unmatched_sequence_vector[i] {
                // Checking if all nucleotides between the first set of matched nucleotides and the nucleotides from unmatched sequence is same or not
                alignment_wrong = false;
                break;
            }
        }
    } else {
        alignment_wrong = false;
    }
    println!("alignment_wrong:{}", alignment_wrong);
    println!("wrong_substitution:{}", wrong_substitution);

    let q_seq_original = q_seq.clone();
    let align_original = align.clone();
    let r_seq_original = r_seq.clone();

    let mut q_seq_correct = String::new(); // Corrected query sequence
    let mut r_seq_correct = String::new(); // Corrected reference sequence
    let mut align_correct = String::new(); // Corrected aligned sequence
    let mut alignment_changed = false; // Flag to check if the alignment has been modified or not
    if alignment_wrong == true {
        // This will work only if the nucleotide at the end of the sequence is wrong (not beginning)
        let correct_alignment_length =
            r_seq.len() - first_unmatched_sequence.len() - first_matched_nucleotides.len();
        for i in 0..correct_alignment_length {
            //Adding those nucleotides that are correctly aligned
            q_seq_correct.push(q_seq_chars[i]);
            align_correct.push(align_chars[i]);
            r_seq_correct.push(r_seq_chars[i]);
        }

        // Check if there are any substitutions or insertions in first_unmatched_sequence
        let mut last_print_position = 0; // Variable that stores the last position where here was a substituted/inserted sequence in first_unmatched_sequence
        for i in 0..first_unmatched_sequence.len() {
            if align_chars[correct_alignment_length + i] == '*' {
                // Check if there are any substitutions in first unmatched sequence
                for j in
                    last_print_position + correct_alignment_length..correct_alignment_length + i + 1
                {
                    // Printing all nucleotides upto the substitution
                    q_seq_correct.push(q_seq_chars[j]);
                    align_correct.push(align_chars[j]);
                    r_seq_correct.push(r_seq_chars[j]);
                }
                last_print_position = i;
            } else if q_seq_chars[correct_alignment_length + i] == 'A'
                || q_seq_chars[correct_alignment_length + i] == 'T'
                || q_seq_chars[correct_alignment_length + i] == 'C'
                || q_seq_chars[correct_alignment_length + i] == 'G'
            // Check if there are any insertions in first unmatched sequence
            {
                for j in
                    last_print_position + correct_alignment_length..correct_alignment_length + i + 1
                {
                    // Printing all nucleotides upto the insertion
                    q_seq_correct.push(q_seq_chars[j]);
                    align_correct.push(align_chars[j]);
                    r_seq_correct.push(r_seq_chars[j]);
                }
                last_print_position = i;
            }
        }

        for i in 0..first_matched_nucleotides.len() {
            // Adding nucleotide(s) that were incorrectly aligned
            q_seq_correct.push(first_matched_nucleotides_vector[i]);
            r_seq_correct.push(first_matched_nucleotides_vector[i]);
            align_correct.push('|');
        }
        alignment_changed = true;
    } else if wrong_substitution == true {
        let correct_alignment_length =
            r_seq.len() - first_unmatched_sequence.len() - first_substituted_nucleotides.len();
        let first_substituted_nucleotides_vector: Vec<_> =
            first_substituted_nucleotides.chars().collect();
        for i in 0..correct_alignment_length {
            //Adding those nucleotides that are correctly aligned
            q_seq_correct.push(q_seq_chars[i]);
            align_correct.push(align_chars[i]);
            r_seq_correct.push(r_seq_chars[i]);
        }

        // Check if there are any substitutions or insertions in first_unmatched_sequence
        let mut last_print_position = 0; // Variable that stores the last position where here was a substituted/inserted sequence in first_unmatched_sequence
        for i in 0..first_unmatched_sequence.len() {
            if align_chars[correct_alignment_length + i] == '*' {
                // Check if there are any substitutions in first unmatched sequence
                for j in
                    last_print_position + correct_alignment_length..correct_alignment_length + i + 1
                {
                    // Printing all nucleotides upto the substitution
                    q_seq_correct.push(q_seq_chars[j]);
                    align_correct.push(align_chars[j]);
                    r_seq_correct.push(r_seq_chars[j]);
                }
                last_print_position = i;
            } else if q_seq_chars[correct_alignment_length + i] == 'A'
                || q_seq_chars[correct_alignment_length + i] == 'T'
                || q_seq_chars[correct_alignment_length + i] == 'C'
                || q_seq_chars[correct_alignment_length + i] == 'G'
            // Check if there are any insertions in first unmatched sequence
            {
                for j in
                    last_print_position + correct_alignment_length..correct_alignment_length + i + 1
                {
                    // Printing all nucleotides upto the insertion
                    q_seq_correct.push(q_seq_chars[j]);
                    align_correct.push(align_chars[j]);
                    r_seq_correct.push(r_seq_chars[j]);
                }
                last_print_position = i;
            }
        }

        // Adding unmatched nucleotide(s) to first nucleotide after last_print_position
        for i in 0..first_substituted_nucleotides.len() {
            if first_substituted_nucleotides_vector[i]
                == r_seq_chars[last_print_position + correct_alignment_length + i]
            {
                align_correct.push('|');
            } else {
                align_correct.push('*');
            }
            q_seq_correct.push(first_substituted_nucleotides_vector[i]);
            r_seq_correct.push(r_seq_chars[last_print_position + correct_alignment_length + i])
        }
    } else if first_matched_nucleotides.len() > 0
        && first_unmatched_sequence.len() > 0
        && first_unmatched_sequence.len() > first_matched_nucleotides.len()
    {
        // Check if there is better alignment for last matched sequence
        println!("Fully matched right-sequence");
        let correct_alignment_length =
            r_seq.len() - first_unmatched_sequence.len() - first_matched_nucleotides.len();
        for i in 0..correct_alignment_length {
            //Adding those nucleotides that are correctly aligned
            q_seq_correct.push(q_seq_chars[i]);
            align_correct.push(align_chars[i]);
            r_seq_correct.push(r_seq_chars[i]);
        }

        let mut all_matched_nucleotides = true;
        let mut last_print_position = 0;
        for i in 0..first_unmatched_sequence.len() {
            all_matched_nucleotides = true;
            let mut num_iterations = 0; // Need to check if the entire length of first_unmatched_sequence has been parsed or not
            for j in 0..first_matched_nucleotides.len() {
                // Check if all nucleotides are matching or not
                if i + j < first_unmatched_sequence.len() {
                    // Prevent iterator to go beyond length of first_unmatched_sequence_vector
                    //println!("i:{}", i);
                    //println!("i+j:{}", i + j);
                    //println!(
                    //    "first_matched_nucleotides_vector[j]:{}",
                    //    first_matched_nucleotides_vector[j]
                    //);
                    //println!(
                    //    "first_unmatched_sequence_vector[i + j]:{}",
                    //    first_unmatched_sequence_vector[i + j]
                    //);
                    if first_matched_nucleotides_vector[j] != first_unmatched_sequence_vector[i + j]
                    {
                        all_matched_nucleotides = false;
                        break;
                    }
                    last_print_position = i;
                    num_iterations += 1;
                }
            }
            //if all_matched_nucleotides == true {
            //    println!("num_iterations:{}", num_iterations);
            //    println!(
            //        "first_matched_nucleotides.len():{}",
            //        first_matched_nucleotides.len()
            //    );
            //}
            if num_iterations != first_matched_nucleotides.len() && all_matched_nucleotides == true
            {
                // If all the nucleotides in first_matched_nucleotides have not been parsed set all_matched_nucleotides = false
                all_matched_nucleotides = false;
            }
            if all_matched_nucleotides == true {
                break;
            }
        }

        println!("last_print_position:{}", last_print_position);
        println!("all_matched_nucleotides:{}", all_matched_nucleotides);
        println!("correct_alignment_length:{}", correct_alignment_length);

        if all_matched_nucleotides == true {
            for j in correct_alignment_length..correct_alignment_length + last_print_position {
                q_seq_correct.push(q_seq_chars[j]);
                align_correct.push(align_chars[j]);
                r_seq_correct.push(r_seq_chars[j]);
            }
            for k in 0..first_matched_nucleotides.len() {
                q_seq_correct.push(first_matched_nucleotides_vector[k]);
                align_correct.push(align_chars[correct_alignment_length + last_print_position + k]);
                r_seq_correct.push(r_seq_chars[correct_alignment_length + last_print_position + k]);
            }
            alignment_changed = true;
        } else {
            q_seq_correct = q_seq_original.to_owned();
            r_seq_correct = r_seq_original.to_owned();
            align_correct = align_original.to_owned();
        }
    } else if first_partially_matched_nucleotides_right.len() > 0
        && first_unmatched_sequence_right_wrt_partially_matched_nucleotides.len() > 0
        && first_unmatched_sequence_right_wrt_partially_matched_nucleotides.len()
            > first_partially_matched_nucleotides_right.len()
    // Check if partially aligned sequences to the right have better alignment in the first unmatched sequence in the right
    {
        // Check if there is better alignment for last matched sequence
        println!("Partially matched right-sequence");
        let correct_alignment_length = r_seq.len()
            - first_unmatched_sequence_right_wrt_partially_matched_nucleotides.len()
            - first_partially_matched_nucleotides_right.len();
        for i in 0..correct_alignment_length {
            //Adding those nucleotides that are correctly aligned
            q_seq_correct.push(q_seq_chars[i]);
            align_correct.push(align_chars[i]);
            r_seq_correct.push(r_seq_chars[i]);
        }

        let mut all_matched_nucleotides = true;
        let mut last_print_position = 0;
        for i in 0..first_unmatched_sequence_right_wrt_partially_matched_nucleotides.len() {
            all_matched_nucleotides = true;
            let mut num_iterations = 0; // Need to check if the entire length of first_unmatched_sequence_right_wrt_partially_matched_nucleotides has been parsed or not
            for j in 0..first_partially_matched_nucleotides_right.len() {
                // Check if all nucleotides are matching or not
                if i + j < first_unmatched_sequence_right_wrt_partially_matched_nucleotides.len() {
                    // Prevent iterator to go beyond length of first_unmatched_sequence_right_wrt_partially_matched_nucleotides_vector
                    //println!("i:{}", i);
                    //println!("i+j:{}", i + j);
                    //println!(
                    //    "first_partially_matched_nucleotides_right_vector[j]:{}",
                    //    first_partially_matched_nucleotides_right_vector[j]
                    //);
                    //println!(
                    //    "first_unmatched_sequence_right_wrt_partially_matched_nucleotides_vector[i + j]:{}",
                    //    first_unmatched_sequence_right_wrt_partially_matched_nucleotides_vector[i + j]
                    //);
                    if first_partially_matched_nucleotides_right_vector[j]
                        != first_unmatched_sequence_right_wrt_partially_matched_nucleotides_vector
                            [i + j]
                    {
                        all_matched_nucleotides = false;
                        break;
                    }
                    last_print_position = i;
                    num_iterations += 1;
                }
            }
            //if all_matched_nucleotides == true {
            //    println!("num_iterations:{}", num_iterations);
            //    println!(
            //        "first_partially_matched_nucleotides_right.len():{}",
            //        first_partially_matched_nucleotides_right.len()
            //    );
            //}
            if num_iterations != first_partially_matched_nucleotides_right.len()
                && all_matched_nucleotides == true
            {
                // If all the nucleotides in first_partially_matched_nucleotides_right have not been parsed set all_matched_nucleotides = false
                all_matched_nucleotides = false;
            }
            if all_matched_nucleotides == true {
                break;
            }
        }

        println!("last_print_position:{}", last_print_position);
        println!("all_matched_nucleotides:{}", all_matched_nucleotides);
        println!("correct_alignment_length:{}", correct_alignment_length);

        if all_matched_nucleotides == true {
            for j in correct_alignment_length..correct_alignment_length + last_print_position {
                q_seq_correct.push(q_seq_chars[j]);
                align_correct.push(align_chars[j]);
                r_seq_correct.push(r_seq_chars[j]);
            }
            for k in 0..first_partially_matched_nucleotides_right.len() {
                q_seq_correct.push(first_partially_matched_nucleotides_right_vector[k]);
                align_correct.push(align_chars[correct_alignment_length + last_print_position + k]);
                r_seq_correct.push(r_seq_chars[correct_alignment_length + last_print_position + k]);
            }
            alignment_changed = true;
        } else {
            q_seq_correct = q_seq_original.to_owned();
            r_seq_correct = r_seq_original.to_owned();
            align_correct = align_original.to_owned();
        }
    }
    if first_partially_matched_nucleotides_left.len() > 0
        && first_unmatched_sequence_left_wrt_partially_matched_nucleotides.len() > 0
        && first_unmatched_sequence_left_wrt_partially_matched_nucleotides.len()
            > first_partially_matched_nucleotides_left.len()
    // Check if partially aligned sequences to the left have better alignment in the first unmatched sequence in the left
    {
        // Check if there is better alignment for last matched sequence
        println!("Partially matched left-sequence");
        q_seq_chars = q_seq_correct.chars().collect();
        align_chars = align_correct.chars().collect();
        r_seq_chars = r_seq_correct.chars().collect();

        q_seq_correct = String::new();
        align_correct = String::new();
        r_seq_correct = String::new();

        //let correct_alignment_length = r_seq.len()
        //    - first_unmatched_sequence_left_wrt_partially_matched_nucleotides.len()
        //    - first_partially_matched_nucleotides_left.len();
        //for i in 0..correct_alignment_length {
        //    //Adding those nucleotides that are correctly aligned
        //    q_seq_correct.push(q_seq_chars[i]);
        //    align_correct.push(align_chars[i]);
        //    r_seq_correct.push(r_seq_chars[i]);
        //}

        let mut last_print_position = 0;
        let mut final_print_position = 0;
        let mut hit = false; // When the first optimized alignment is first, ensure that all_matched_nucleotides does not turn false again
        let mut all_matched_nucleotides = true;
        for i in 0..first_unmatched_sequence_left_wrt_partially_matched_nucleotides.len() {
            all_matched_nucleotides = true;
            let mut num_iterations = 0; // Need to check if the entire length of first_unmatched_sequence_left_wrt_partially_matched_nucleotides has been parsed or not
            for j in 0..first_partially_matched_nucleotides_left.len() {
                // Check if all nucleotides are matching or not
                if i + j < first_unmatched_sequence_left_wrt_partially_matched_nucleotides.len() {
                    // Prevent iterator to go beyond length of first_unmatched_sequence_left_wrt_partially_matched_nucleotides_vector
                    //println!("i:{}", i);
                    //println!("i+j:{}", i + j);
                    //println!(
                    //    "first_partially_matched_nucleotides_left_vector[j]:{}",
                    //    first_partially_matched_nucleotides_left_vector[j]
                    //);
                    //println!(
                    //    "first_unmatched_sequence_left_wrt_partially_matched_nucleotides_vector[i + j]:{}",
                    //    first_unmatched_sequence_left_wrt_partially_matched_nucleotides_vector[i + j]
                    //);
                    if first_partially_matched_nucleotides_left_vector[j]
                        != first_unmatched_sequence_left_wrt_partially_matched_nucleotides_vector
                            [i + j]
                    {
                        if hit == false {
                            // Ensure that all_matched_nucleotides = true once first optimized alignment is found
                            all_matched_nucleotides = false;
                        }
                        break;
                    }
                    final_print_position = i;
                    num_iterations += 1;
                }
            }
            if num_iterations != first_partially_matched_nucleotides_left.len()
                && all_matched_nucleotides == true
            {
                if hit == false {
                    // If all the nucleotides in first_partially_matched_nucleotides_left have not been parsed set all_matched_nucleotides = false
                    all_matched_nucleotides = false;
                } else {
                    final_print_position = last_print_position;
                }
            } else if num_iterations == first_partially_matched_nucleotides_left.len() {
                last_print_position = final_print_position;
            }

            if all_matched_nucleotides == true {
                hit = true;
                //println!("num_iterations:{}", num_iterations);
                //println!(
                //    "first_partially_matched_nucleotides_left.len():{}",
                //    first_partially_matched_nucleotides_left.len()
                //);
            }
        }

        println!("final_print_position:{}", final_print_position);
        println!("all_matched_nucleotides:{}", all_matched_nucleotides);

        if all_matched_nucleotides == true {
            for k in 0..first_partially_matched_nucleotides_left.len() {
                q_seq_correct.push(first_partially_matched_nucleotides_left_vector[k]);
                align_correct.push('|');
                r_seq_correct.push(first_partially_matched_nucleotides_left_vector[k]);
            }
            for j in final_print_position + 2 * first_partially_matched_nucleotides_left.len()
                ..first_unmatched_sequence_left_wrt_partially_matched_nucleotides_vector.len()
                    + first_partially_matched_nucleotides_left.len()
            {
                //println!(
                //    "j,q_seq_chars[j],align_chars[j],r_seq_chars[j]:{},{},{},{}",
                //    j, q_seq_chars[j], align_chars[j], r_seq_chars[j]
                //);
                q_seq_correct.push(q_seq_chars[j]);
                align_correct.push(align_chars[j]);
                r_seq_correct.push(r_seq_chars[j]);
            }

            for i in first_partially_matched_nucleotides_left.len()
                + first_unmatched_sequence_left_wrt_partially_matched_nucleotides_vector.len()
                ..r_seq_chars.len()
            {
                //println!(
                //    "i,q_seq_chars[i],align_chars[i],r_seq_chars[i]:{},{},{},{}",
                //    i, q_seq_chars[i], align_chars[i], r_seq_chars[i]
                //);
                q_seq_correct.push(q_seq_chars[i]);
                align_correct.push(align_chars[i]);
                r_seq_correct.push(r_seq_chars[i]);
            }
            alignment_changed = true;
        }
    }
    if alignment_changed == false {
        // In case no better alignment is found, output original alignment
        q_seq_correct = q_seq_original.to_owned();
        r_seq_correct = r_seq_original.to_owned();
        align_correct = align_original.to_owned();
    }
    println!("alignment_changed:{}", alignment_changed);
    println!("q_seq_correct:{}", q_seq_correct);
    println!("align_correct:{}", align_correct);
    println!("r_seq_correct:{}", r_seq_correct);
    (q_seq_correct, align_correct, r_seq_correct)
}
