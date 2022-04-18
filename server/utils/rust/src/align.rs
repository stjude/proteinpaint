// Syntax: cd .. && cargo build --release && echo single:CTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGTGTGGCAGCCAGATGATGTGACGGAATCTCT:TTCAATTTAGCCACCTGCTTCCGGGCTGATGGCCTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGGAAAGCGTAGGGGTCTTTGCTTGCAAGAACAAGTGGCAGCCAGATGATGTGACGGAATCTCTGCCGCCCAAGAAGATGAAGTGCGGCAAAGAGAAGGACAGTGAAGAGCAGCAGCTCCAGCCACAAGCCAAGG:TTCAATTTAGCCACCTGCTTCCGGGCTGATGGCCTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGTGTGGCAGCCAGATGATGTGACGGAATCTCTGCCGCCCAAGAAGATGAAGTGCGGCAAAGAGAAGGACAGTGAAGAGCAGCAGCTCCAGCCACAAGCCAAGG | ../target/release/align
// Syntax: cd .. && cargo build --release && echo multi:AGAGGAATCCGTAGGACATCTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTCAGCAATGCCGTGGCTCTGTTACGAACGGCTGAAATCAAAACCCCTCTGGCTTCTCCTATGCTTGT:ATCCGTAGGACATCTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTAGATCGGAAG:ATCTTCTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCA:CATCTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGC:TCTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAAGAT:CTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTG:CTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTG:CATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGTTTGGAAA:CATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAG:TGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAG:CCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTC:CAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGTTTGGAAACAGTATATGATGT:AACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTCAGCAATGCCATGGCTCTG:ACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTCAGCAATGCCATGGCTCTGT:ACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTCAGCAATGCCATGGCTCTGTTACGAACGGC:GTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTCAGCAATGCCATGGCTCTGTTACGAACGGCTGAAATCAAAACCCCTCTGGCTTCTCC | time ../target/release/align

// Function Cascade:
// Single-read alignment mode: When first word in input is "single", it triggers the single-read alignment mode. The first sequence is the query sequence, second is reference sequence and third is alternate sequence. Each read/ref/alt sequence is separated by ":" character.
//       align_single_reads(query_sequence, reference_sequence)
//       align_single_reads(query_sequence, alternate_sequence)
// Multi-read alignment mode: When first word in input is "multi", it triggers the multi-read alignment mode in which multiple reads are aligned against a single reference using pairwise alignment. Each read/ref sequence is separated by ":" character.
//       for read in reads
//          align_multi_reads(read, reference_sequence)
//
// NOTE: Currently the multi-read alignment mode is not in use because it will not be able to handle cases where a read opens a gap in the reference sequence outside the proposed variant region. This will require a more complex implementation. For now "clustalo" is being used.

use bio::alignment::pairwise::*;
use bio::alignment::AlignmentOperation;
//use bio::scores::blosum62;
use std::io;

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
    let args: Vec<&str> = input.split(":").collect(); // Various input from nodejs is separated by ":" character
    let align_case: String = args[0].parse::<String>().unwrap(); // Single-read alignment or multi-read alignment
    if align_case == "single".to_string() {
        let query_seq: String = args[1].parse::<String>().unwrap(); // Query sequence
        let ref_seq: String = args[2].parse::<String>().unwrap().replace("\n", ""); // Reference sequence. Removing "\n" from the end of string
        let alt_seq: String = args[3].parse::<String>().unwrap().replace("\n", ""); // Alternate sequence. Removing "\n" from the end of string
        let (q_seq_ref, align_ref, r_seq_ref) = align_single_reads(&query_seq, ref_seq); // Aligning against reference
        let (q_seq_alt, align_alt, r_seq_alt) = align_single_reads(&query_seq, alt_seq); // Aligning against alternate
        println!("q_seq_ref:{}", q_seq_ref);
        println!("align_ref:{}", align_ref);
        println!("r_seq_ref:{}", r_seq_ref);
        println!("q_seq_alt:{}", q_seq_alt);
        println!("align_alt:{}", align_alt);
        println!("r_seq_alt:{}", r_seq_alt);
    } else if align_case == "multi".to_string() {
        let ref_seq: String = args[1].parse::<String>().unwrap(); // First sequence is always reference sequence
        let mut main_seq: String = String::new();
        let mut subst_vector: String = String::new();
        for i in 2..args.len() {
            #[allow(unused_variables)]
            //println!("UnRead:{}", &args[i].parse::<String>().unwrap());
            let (q_seq, r_seq, subst) = align_multi_reads(
                &args[i].parse::<String>().unwrap().replace("\n", ""),
                &ref_seq,
            );
            subst_vector += &subst;
            println!("Read:{}", q_seq);
            main_seq = r_seq;
        }
        println!("Refs:{}", main_seq);
        println!("Subst_vector:{}", subst_vector);
    } else {
        println!("This option is not recognized");
    }
}

fn align_single_reads(query_seq: &String, ref_seq: String) -> (String, String, String) {
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
    check_first_last_nucleotide_correctly_aligned(&q_seq, &align, &r_seq)
}

fn align_multi_reads(query_seq: &String, ref_seq: &String) -> (String, String, String) {
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
    //println!("alignment_seq:{:?}", alignment_seq);
    let mut q_seq: String = String::new();
    let mut r_seq: String = String::new();
    let mut j: usize = 0;
    let mut k: usize = 0;
    let mut subst: String = String::new();
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
        } else if AlignmentOperation::Subst == alignment_seq[i] {
            //println!("query:{}", &query_vector[j].to_string());
            subst += &(i.to_string() + ";");
            //println!("pos:{}", i);
            //println!("ref:{}", &ref_vector[k].to_string());
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            if k < ref_vector.len() {
                r_seq += &ref_vector[k].to_string();
                k += 1;
            }
        } else if AlignmentOperation::Del == alignment_seq[i] {
            if j == 0 || j >= query_vector.len() {
                // Add blank before start and after end of read
                q_seq += &" ".to_string();
            } else {
                q_seq += &"-".to_string();
            }
            if k < ref_vector.len() {
                r_seq += &ref_vector[k].to_string();
                k += 1;
            }
        } else if AlignmentOperation::Ins == alignment_seq[i] {
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            r_seq += &"-".to_string();
        } else {
            // Should not happen, added to help debug if it ever happens
            println!("Alignment operation not found:{}{:?}", i, alignment_seq[i]);
        }
    }
    subst += ":";
    //println!("subst:{}", subst);
    (q_seq, r_seq, subst)
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
    let q_seq_chars: Vec<_> = q_seq.chars().collect();
    let align_chars: Vec<_> = align.chars().collect();
    let r_seq_chars: Vec<_> = r_seq.chars().collect();
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
    first_unmatched_sequence = reverse_string(&first_unmatched_sequence);
    first_matched_nucleotides = reverse_string(&first_matched_nucleotides);
    first_substituted_nucleotides = reverse_string(&first_substituted_nucleotides);
    println!("first_matched_nucleotides:{}", first_matched_nucleotides);
    println!(
        "first_substituted_nucleotides:{}",
        first_substituted_nucleotides
    );
    println!("first_unmatched_sequence:{}", first_unmatched_sequence);

    let first_matched_nucleotides_vector: Vec<_> = first_matched_nucleotides.chars().collect();
    let first_unmatched_sequence_vector: Vec<_> = first_unmatched_sequence.chars().collect();
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

    let mut q_seq_correct = String::new();
    let mut r_seq_correct = String::new();
    let mut align_correct = String::new();
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
            let mut num_iterations = 1; // Need to check if the entire length of first_unmatched_sequence has been parsed or not
            for j in 0..first_matched_nucleotides.len() {
                // Check if all nucleotides are matching or not
                if i + j < first_unmatched_sequence.len() {
                    // Prevent iterator to go beyond length of first_unmatched_sequence_vector
                    if first_matched_nucleotides_vector[j] != first_unmatched_sequence_vector[i + j]
                    {
                        all_matched_nucleotides = false;
                        break;
                    }
                    last_print_position = i;
                }
                num_iterations += 1;
            }
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

        if all_matched_nucleotides == false {
            q_seq_correct = q_seq.to_owned();
            r_seq_correct = r_seq.to_owned();
            align_correct = align.to_owned();
        } else {
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
        }
    } else {
        q_seq_correct = q_seq.to_owned();
        r_seq_correct = r_seq.to_owned();
        align_correct = align.to_owned();
    }
    println!("q_seq_correct:{}", q_seq_correct);
    println!("align_correct:{}", align_correct);
    println!("r_seq_correct:{}", r_seq_correct);
    (q_seq_correct, align_correct, r_seq_correct)
}

// Reversing a string
fn reverse_string(input: &str) -> String {
    let mut result = String::new();
    for c in input.chars().rev() {
        result.push(c)
    }
    result
}
