// Syntax: cd .. && cargo build --release

// Test case below:
// echo AATAGCCTTTACATTATGTAATAGTGTAATACAAATAATAATTTATTATAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCGAAAACCCTAACCCTAAAACCCTAACATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCCTGACCCTAACCCTAATCCTTACCCTTATCCTACCCCTAACCCTTAACCC-AATAGCCTTTACATTATGTAATAGTGTAATACAAATAATAATTTATTATAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCCTAACCCCTAACCCTAACCCGAAAACCCTAACCCTAAAACCCTAACATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCCTGACCCTAACCCTAATCCTTACCCTTATCCTACCCCTAACCCTTAACCC-TAGTAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAAC-AGTAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCAAACCCTAACCCCTAACCCTAACCCAAAAACCCTAACCCTAAAACCC-TAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAAC-TAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACC-TAAAGTGAAATTATTGACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTATCCCCTAACCCTAATCCTAACCCTAACCCTAACCCTATCCCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAAC-TAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACC-CAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACCATAACCCTTACCCTTAC-CTGACCCTTAACCCTAACCCTAACCCCTAACCCTAACCCTTAACCCTTAAACCTTAACCCTCATCCTCACCCTCACCCTCACCCCTAACCCTAACCCCTAACCCAAACCCTCACCCTAAACCCTAACCCTAAACCCAACCCAAACCCTAAC-ACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAGCCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACCATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTT-CTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACCATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCC:16357-16358-16363-16363-16363-16363-16380-16388-16402-16418:108M1I42M-151M-102M1I48M-151M-101M1I49M-151M-132M1I18M-8S31M1I6M1I32M1I30M41S-110M1I40M-94M1I56M:147-99-65-81-83-83-177-163-147-113:16463:151:A:AC:6:0.1:10:1:AATAGCCTTTACATTATGTAATAGTGTAATACAAATAATAATTTATTATAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTA:CCCTAACCCCTAACCCTAACCCGAAAACCCTAACCCTAAAACCCTAACATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCCTGACCCTAACCCTAATCCTTACCCTTATCCTACCCCTAACCCTTAACCC | ../target/release/indel

//Debug syntax: cat ~/proteinpaint/test.txt | ~/proteinpaint/server/utils/rust/target/release/indel

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

use std::cmp;
use std::sync::{Arc, Mutex}; // Multithreading library
use std::thread;
//use std::env;
//use std::time::{SystemTime};
use std::io;

mod realign; // Imports functions from realign.rs
mod stats_functions; // Imports functions from stats_functions.rs

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
    let args: Vec<&str> = input.split("_").collect(); // Various input from nodejs is separated by "_" character
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
    let rightflank_nucleotides: Vec<char> = rightflankseq.chars().collect(); // Vector containing right flanking nucleotides
    let ref_nucleotides: Vec<char> = refallele.chars().collect(); // Vector containing ref nucleotides
    let alt_nucleotides: Vec<char> = altallele.chars().collect(); // Vector containing alt nucleotides

    //println!("rightflank_nucleotides:{:?}", rightflank_nucleotides);
    let lines: Vec<&str> = sequences.split("-").collect(); // Vector containing list of sequences, the first two containing ref and alt.
    let start_positions_list: Vec<&str> = start_positions.split("-").collect(); // Vector containing start positions
    let cigar_sequences_list: Vec<&str> = cigar_sequences.split("-").collect(); // Vector containing cigar sequences
    let sequence_flags_list: Vec<&str> = sequence_flags.split("-").collect(); // Vector containing sam flag of read sequences
    let single_thread_limit: usize = 1000; // If total number of reads is lower than this value the reads will be parsed sequentially in a single thread, if greaterreads will be parsed in parallel
    let max_threads: usize = 5; // Max number of threads in case the parallel processing of reads is invoked
    let ref_length: i64 = refallele.len() as i64; // Determining length of ref allele
    let alt_length: i64 = altallele.len() as i64; // Determining length of alt allele
    let mut indel_length: i64 = alt_length; // Determining indel length, in case of an insertion it will be alt_length. In case of a deletion, it will be ref_length
    if ref_length > alt_length {
        indel_length = ref_length;
    }
    //println!("indel_length:{}", indel_length);
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

    drop(rightflank_nucleotides);
    let reference_sequence = lines[0].to_string();
    let alternate_sequence = lines[1].to_string();
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
                    alignment_side,
                    spliced_sequence,
                ) = realign::check_read_within_indel_region(
                    // Checks if the read contains the indel region (or a part of it)
                    start_positions_list[i as usize - 2].parse::<i64>().unwrap() - 1,
                    cigar_sequences_list[i as usize - 2].to_string(),
                    variant_pos,
                    indel_length as usize,
                    ref_length as usize,
                    alt_length as usize,
                    strictness,
                    read.to_string(),
                );
                //println!("correct_start_position:{}", correct_start_position);
                //println!("correct_end_position:{}", correct_end_position);
                //println!(
                //    "cigar_sequence:{}",
                //    &cigar_sequences_list[i as usize - 2].to_string()
                //);
                if within_indel == 1 {
                    // Checking if the read is in forward or reverse strand
                    let mut sequence_strand: String = "F".to_string(); // Initializing sequence strand to forward
                    if sequence_flags_list[i as usize - 2].parse::<i64>().unwrap() & 16 == 16 {
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

                    //println!("ref_polyclonal_read_status:{}", ref_polyclonal_read_status);
                    //println!("alt_polyclonal_read_status:{}", alt_polyclonal_read_status);
                    //println!("read_ambiguous:{}", read_ambiguous);
                    //println!("ref_insertion:{}", ref_insertion);

                    let (q_seq_ref, align_ref, _r_seq_ref, ref_comparison) =
                        realign::align_single_reads(&spliced_sequence, reference_sequence.clone());
                    let (q_seq_alt, align_alt, _r_seq_alt, alt_comparison) =
                        realign::align_single_reads(&spliced_sequence, alternate_sequence.clone());
                    //println!("ref_comparison:{}", ref_comparison);
                    //println!("alt_comparison:{}", alt_comparison);

                    let (ref_polyclonal_read_status, alt_polyclonal_read_status);
                    if strictness == 0 {
                        ref_polyclonal_read_status = 0;
                        alt_polyclonal_read_status = 0;
                    } else {
                        let (ref_polyclonal_read_status_temp, alt_polyclonal_read_status_temp) =
                            check_polyclonal_with_read_alignment(
                                &alignment_side,
                                &q_seq_alt,
                                &q_seq_ref,
                                &align_alt,
                                &align_ref,
                                correct_start_position,
                                correct_end_position,
                                variant_pos,
                                ref_length as usize,
                                alt_length as usize,
                                indel_length as usize,
                            );
                        ref_polyclonal_read_status = ref_polyclonal_read_status_temp;
                        alt_polyclonal_read_status = alt_polyclonal_read_status_temp;
                    }
                    let ref_insertion = 0;

                    let diff_score: f64 = alt_comparison - ref_comparison; // Is the read more similar to reference sequence or alternate sequence
                    let mut read_ambiguous = 0;
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
        let reference_sequence = Arc::new(reference_sequence);
        let alternate_sequence = Arc::new(alternate_sequence);
        let ref_scores_temp = Arc::new(Mutex::new(Vec::<read_diff_scores>::new())); // This variable will store read_diff_scores struct of reads classifed as ref, but can be written into by all threads. When Mutex is not define (as in the variables above) they are read-only.
        let alt_scores_temp = Arc::new(Mutex::new(Vec::<read_diff_scores>::new())); // This variable will store read_diff_scores struct of reads classifed as alt, but can be written into by all threads. When Mutex is not define (as in the variables above) they are read-only.
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
            let ref_scores_temp = Arc::clone(&ref_scores_temp);
            let alt_scores_temp = Arc::clone(&alt_scores_temp);

            let handle = thread::spawn(move || {
                // Thread is initiallized here
                //println!("thread:{}", thread_num);
                let lines: Vec<&str> = sequences.split("-").collect();
                let start_positions_list: Vec<&str> = start_positions.split("-").collect();
                let cigar_sequences_list: Vec<&str> = cigar_sequences.split("-").collect();
                let sequence_flags_list: Vec<&str> = sequence_flags.split("-").collect();
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
                            alignment_side,
                            spliced_sequence,
                        ) = realign::check_read_within_indel_region(
                            // Checks if the read contains the indel region (or a part of it)
                            start_positions_list[iter].parse::<i64>().unwrap() - 1,
                            cigar_sequences_list[iter].to_string(),
                            variant_pos,
                            indel_length as usize,
                            ref_length as usize,
                            alt_length as usize,
                            strictness,
                            lines[iter + 2].to_string(),
                        );
                        if within_indel == 1 {
                            // Checking if the read is in forward or reverse strand
                            let mut sequence_strand: String = "F".to_string(); // Initializing sequence strand to forward
                            if sequence_flags_list[iter].parse::<i64>().unwrap() & 16 == 16 {
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

                            let (q_seq_ref, align_ref, _r_seq_ref, ref_comparison) =
                                realign::align_single_reads(
                                    &spliced_sequence,
                                    reference_sequence.to_string(),
                                );
                            let (q_seq_alt, align_alt, _r_seq_alt, alt_comparison) =
                                realign::align_single_reads(
                                    &spliced_sequence,
                                    alternate_sequence.to_string(),
                                );

                            let (ref_polyclonal_read_status, alt_polyclonal_read_status);
                            if strictness == 0 {
                                ref_polyclonal_read_status = 0;
                                alt_polyclonal_read_status = 0;
                            } else {
                                let (
                                    ref_polyclonal_read_status_temp,
                                    alt_polyclonal_read_status_temp,
                                ) = check_polyclonal_with_read_alignment(
                                    &alignment_side,
                                    &q_seq_alt,
                                    &q_seq_ref,
                                    &align_alt,
                                    &align_ref,
                                    correct_start_position,
                                    correct_end_position,
                                    variant_pos,
                                    ref_length as usize,
                                    alt_length as usize,
                                    indel_length as usize,
                                );
                                ref_polyclonal_read_status = ref_polyclonal_read_status_temp;
                                alt_polyclonal_read_status = alt_polyclonal_read_status_temp;
                            }
                            let ref_insertion = 0;

                            let diff_score: f64 = alt_comparison - ref_comparison; // Is the read more similar to reference sequence or alternate sequence

                            let mut read_ambiguous = 0;
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
        } else if strictness >= 1 && item.ref_comparison == 1 {
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
        } else if strictness >= 1 && item.alt_comparison == 1 {
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

fn classify_to_four_categories(
    read_alignment_diff_scores: &mut Vec<read_diff_scores>, // Vector containing read diff_scores for all reads classified as ref/alt
    strictness: usize,                                      // Strictness of the pipeline
) -> Vec<read_category> {
    let mut indices = Vec::<read_category>::new(); // Vector of type struct read_category containing category classified, original group ID, diff_score and ref_insertion flag. This vecor will be finally returned to the main function
    let absolute_threshold_cutoff: f64 = 0.0; // Absolute threshold cutoff. If the absolute diff_score is less than this value, the read will automatically be classified as "none"
    for i in 0..read_alignment_diff_scores.len() {
        if read_alignment_diff_scores[i].polyclonal >= 2 as i64 {
            // If polyclonal is 2, it is automatically classified as 'none' since the allele neither matches ref allele or alt allele of interest
            let read_cat = read_category {
                category: String::from("none"),
                groupID: usize::from(read_alignment_diff_scores[i].groupID),
                alt_comparison: i64::from(read_alignment_diff_scores[i].alt_comparison),
                ref_comparison: i64::from(read_alignment_diff_scores[i].ref_comparison),
                diff_score: f64::from(read_alignment_diff_scores[i].value),
                ref_insertion: i64::from(read_alignment_diff_scores[i].ref_insertion),
                sequence_strand: String::from(
                    &read_alignment_diff_scores[i].sequence_strand.to_owned(),
                ),
            };
            indices.push(read_cat);
        } else if read_alignment_diff_scores[i].ambiguous == 2 as i64 {
            // If ambiguous is 1, it is automatically classified as 'amb' since the read start/ends in a region which has the same sequence as that in the flanking region
            let read_cat = read_category {
                category: String::from("amb"),
                groupID: usize::from(read_alignment_diff_scores[i].groupID),
                alt_comparison: i64::from(read_alignment_diff_scores[i].alt_comparison),
                ref_comparison: i64::from(read_alignment_diff_scores[i].ref_comparison),
                diff_score: f64::from(read_alignment_diff_scores[i].value),
                ref_insertion: i64::from(read_alignment_diff_scores[i].ref_insertion),
                sequence_strand: String::from(
                    &read_alignment_diff_scores[i].sequence_strand.to_owned(),
                ),
            };
            indices.push(read_cat);
        } else if read_alignment_diff_scores[i].abs_value <= absolute_threshold_cutoff
            && strictness >= 1
        {
            // If diff_score absolute value is less than absolute threshold cutoff, it is automatically classified as 'none'
            let read_cat = read_category {
                category: String::from("none"),
                groupID: usize::from(read_alignment_diff_scores[i].groupID),
                alt_comparison: i64::from(read_alignment_diff_scores[i].alt_comparison),
                ref_comparison: i64::from(read_alignment_diff_scores[i].ref_comparison),
                diff_score: f64::from(read_alignment_diff_scores[i].value),
                ref_insertion: i64::from(read_alignment_diff_scores[i].ref_insertion),
                sequence_strand: String::from(
                    &read_alignment_diff_scores[i].sequence_strand.to_owned(),
                ),
            };
            indices.push(read_cat);
        } else {
            let read_cat = read_category {
                category: String::from("refalt"),
                groupID: usize::from(read_alignment_diff_scores[i].groupID),
                alt_comparison: i64::from(read_alignment_diff_scores[i].alt_comparison),
                ref_comparison: i64::from(read_alignment_diff_scores[i].ref_comparison),
                diff_score: f64::from(read_alignment_diff_scores[i].value),
                ref_insertion: i64::from(read_alignment_diff_scores[i].ref_insertion),
                sequence_strand: String::from(
                    &read_alignment_diff_scores[i].sequence_strand.to_owned(),
                ),
            };
            indices.push(read_cat);
        }
    }
    indices // Indices vector being returned to main function
}

fn check_polyclonal_with_read_alignment(
    alignment_side: &String,
    q_seq_alt: &String,
    q_seq_ref: &String,
    align_alt: &String,
    align_ref: &String,
    correct_start_position: i64,
    correct_end_position: i64,
    variant_pos: i64,
    ref_length: usize,
    alt_length: usize,
    indel_length: usize,
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
    //println!("red_region_start_alt:{}", red_region_start_alt);
    //println!("red_region_start_ref:{}", red_region_start_ref);
    //println!("red_region_stop_alt:{}", red_region_stop_alt);
    //println!("red_region_stop_ref:{}", red_region_stop_ref);

    let align_alt_vec: Vec<_> = align_alt.chars().collect();
    let align_ref_vec: Vec<_> = align_ref.chars().collect();
    if red_region_start_alt > q_seq_alt.len() as i64 {
        // When read alignment is very bad, its possible that the calculated start of indel in read is greater than the length of the alignment. In such cases such reads are classified as polyclonal
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

    if red_region_start_ref > q_seq_ref.len() as i64 {
        // When read alignment is very bad, its possible that the calculated start of indel in read is greater than the length of the alignment. In such cases such reads are classified as polyclonal
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
                optimized_variant_pos -= repeating_sequence_left_temp.len() as i64; // Need to pass this to main and also change optimized ref and alt allele. Will need to do this later
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
                optimized_variant_pos -= repeating_sequence_left_temp.len() as i64; // Need to pass this to main and also change optimized ref and alt allele. Will need to do this later
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
