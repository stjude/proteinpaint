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
// preprocess_input() (Optimizing ref/alt allele entered by user to account for flanking repeat regions. For e.g A-AT in the region CACA{T}TTTTGCGA will become ATTTT-ATTTTT)
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

use std::sync::{Arc, Mutex}; // Multithreading library
use std::thread;
//use std::env;
//use std::time::{SystemTime};
use std::io;

mod realign;
mod stats_functions;

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
    let rightflankseq: String = args[9].parse::<String>().unwrap(); //Right flanking sequence.

    //let fisher_test_threshold: f64 = (10.0).powf((args[14].parse::<f64>().unwrap()) / (-10.0)); // Significance value for strand_analysis (NOT in phred scale)
    let rightflank_nucleotides: Vec<char> = rightflankseq.chars().collect(); // Vector containing right flanking nucleotides

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
        red_region_stop_ref = red_region_stop_ref_temp;
        red_region_start_ref = red_region_stop_ref - indel_length as i64;
        if red_region_start_ref < 0 {
            red_region_start_ref = 0;
        }

        red_region_stop_alt = red_region_stop_alt_temp;
        red_region_start_alt = red_region_stop_alt - indel_length as i64;
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
