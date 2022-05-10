// Syntax: cd .. && cargo build --release && echo single:TGCAATTCAGGGTCAAGCTTCCTGAGGCATTTGTGCCAAAAGTGCCTGTCTTTAAAGATCAGGATTTCTNCCCTCA:CATCCACGCCTGAAGGAAGAGATGGCCAAAATGAAGAGATCAAATGCAATTCAGGTTCAAGCTTCCTGAGGGATTTGCGCCAAAAGTGCCTAAAATATATGTAAAAAGAAATGTAAATTGAAAAACAATCTTTCACCTTTAGAATATTTTCCTCA:CATCCACGCCTGAAGGAAGAGATGGCCAAAATGAAGAGATCAAATGCAATTCAGGTTCAAGCTTCCTGAGGGATTTGTGCCAAAAGTGCCTAAAATATATGTAAAAAGAAATGTAAATTGAAAAACAATCTTTCACCTTTAGAATATTTTCCTCA:45M864N31M:102839198:102839231:C:T | target/release/align
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

use std::io;

mod realign;

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
        let cigar_seq = args[4].parse::<String>().unwrap().replace("\n", ""); // Contains cigar characters
        let read_start = args[5].parse::<i64>().unwrap(); // Contains start position of read
        let variant_pos = args[6].parse::<i64>().unwrap(); // Contains variant position
        let variant_ref = args[7].parse::<String>().unwrap(); // Contains variant reference
        let variant_alt = args[8].parse::<String>().unwrap().replace("\n", ""); // Contains variant alternate

        let mut indel_length: i64 = variant_alt.len() as i64; // Determining indel length, in case of an insertion it will be alt_length. In case of a deletion, it will be ref_length
        if variant_ref.len() > variant_alt.len() {
            indel_length = variant_ref.len() as i64;
        }
        let (
            _within_indel,
            correct_start_position,
            correct_end_position,
            _splice_freq,
            _splice_start_pos,
            _splice_stop_pos,
            _splice_start_cigar,
            _splice_stop_cigar,
            alignment_side,
            final_sequence,
        ) = realign::check_read_within_indel_region(
            // Checks if the read contains the indel region (or a part of it)
            read_start,
            cigar_seq.to_owned(),
            variant_pos,
            indel_length as usize,
            variant_ref.len(),
            variant_alt.len(),
            1, // Using strictness = 1
            query_seq,
        );

        //println!("final_sequence:{}", final_sequence);

        let (q_seq_ref, align_ref, r_seq_ref, _matched_nucleotides_ratio) =
            realign::align_single_reads(&final_sequence, ref_seq); // Aligning against reference
        let (q_seq_alt, align_alt, r_seq_alt, _matched_nucleotides_ratio) =
            realign::align_single_reads(&final_sequence, alt_seq); // Aligning against alternate

        let (red_region_start_alt, red_region_stop_alt, red_region_start_ref, red_region_stop_ref) =
            realign::determine_start_stop_indel_region_in_read(
                alignment_side,
                &q_seq_alt,
                &q_seq_ref,
                correct_start_position,
                correct_end_position,
                variant_pos,
                variant_ref.len(),
                variant_alt.len(),
            );

        //println!("red_disp_region_start_alt:{}", red_region_start_alt);
        //println!("red_disp_region_start_ref:{}", red_region_start_ref);
        //println!("red_disp_region_stop_alt:{}", red_region_stop_alt);
        //println!("red_disp_region_stop_ref:{}", red_region_stop_ref);

        println!("q_seq_ref:{}", q_seq_ref);
        println!("align_ref:{}", align_ref);
        println!("r_seq_ref:{}", r_seq_ref);
        println!("q_seq_alt:{}", q_seq_alt);
        println!("align_alt:{}", align_alt);
        println!("r_seq_alt:{}", r_seq_alt);
        println!("red_region_start_alt:{}", red_region_start_alt);
        println!("red_region_start_ref:{}", red_region_start_ref);
        println!("red_region_stop_alt:{}", red_region_stop_alt);
        println!("red_region_stop_ref:{}", red_region_stop_ref);
    }
}
