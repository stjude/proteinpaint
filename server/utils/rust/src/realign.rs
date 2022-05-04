// Syntax: cd .. && cargo build --release

use std::process::Command;
use std::str;

#[allow(unused_mut)] // Remove this line when further building this function
#[allow(unused_variables)] // Remove this line when further building this function
#[allow(dead_code)]
fn check_base_pair_quality_scores(
    // Function that checks for base pair quality score to ensure all reads being aligned have high quality reads near the variant position
    quality_score_sequence: &String, // String containing read base pair sequence
    alphabets: &Vec<char>,           // Alphabets from CIGAR sequence
    numbers: &Vec<i64>,              // Numbers from CIGAR sequence
    mut start_position: i64,         // Start position of read
    variant_pos: i64,                // Start position of variant
    flanking_region_length: i64, // Flanking region uptil where base-pair quality of nucleotides need to be checked
    indel_length: i64,           // Indel length
    left_flanking_region_limit: i64, // Left hand region upto where base-pair quality check needs to be carried out
    right_flanking_region_limit: i64, // Right hand region upto where base-pair quality check needs to be carried out
) -> bool {
    let quality_check_pass_fail = true; // Flag to record whether base pair quality check passed or failed
    let high_quality_score_characters: [&str; 11] =
        ["?", "@", "A", "B", "C", "D", "E", "F", "G", "H", "I"]; // Array storing phred33 base pair quality scores >= 30
    if &alphabets[0].to_string().as_str() == &"S" {
        start_position -= numbers[0].to_string().parse::<i64>().unwrap();
    }

    // Parsing part of read base-pair quality sequence which covers the variant and flanking region
    let mut current_pos = start_position; // Nucleotide iterator w.r.t genomic coordinates
    let mut nclt_pos = 0; // Nucleotide iterator w.r.t read being analyzed
    for i in 0..alphabets.len() {
        if &alphabets[i].to_string().as_str() == &"H" {
            // Ignore hardclips
            continue;
        } else if &alphabets[i].to_string().as_str() == &"M"
            || &alphabets[i].to_string().as_str() == &"S"
        {
            // Checking to see if within variant region or flanking region
            let fragment_length = numbers[i].to_string().parse::<i64>().unwrap(); // Length of CIGAR fragment
            let mut current_nucl = current_pos; // Nucleotide iterator w.r.t genomic coordinates (used in for loop below)
            let mut current_nucl_read = nclt_pos; // Nucleotide iterator w.r.t read being analyzed (used in for loop below)
            for j in 0..fragment_length {
                if left_flanking_region_limit <= current_nucl
                    && current_nucl <= right_flanking_region_limit
                {}

                current_nucl += 1;
            }

            current_pos += fragment_length;
            nclt_pos += fragment_length;
        } else if &alphabets[i].to_string().as_str() == &"D"
            || &alphabets[i].to_string().as_str() == &"N"
        {
            current_pos += numbers[i].to_string().parse::<i64>().unwrap();
        } else if &alphabets[i].to_string().as_str() == &"I" {
            nclt_pos += numbers[i].to_string().parse::<i64>().unwrap();
        } else {
            // Should not happen
            println!("CIGAR character not accounted for in check_base_pair_quality_scores()");
            // Flanking region could start from within inserted nucleotides
        }
    }
    quality_check_pass_fail
}

#[allow(unused_variables)] // Remove this line when further building this function
#[allow(dead_code)]
pub fn realign_reads(
    sequences: &String, // Variable contains sequences separated by "-" character, the first two sequences contains the ref and alt sequences
    start_positions: &String, // Variable contains start position of reads separated by "-" character
    cigar_sequences: &String, // Variable contains cigar sequences separated by "-" character
    quality_scores: &String, // Variable contains quality scores of reads separated by "-" character
    clustalo_path: &String,  // Path to clustalo
    ref_sequence: &String,   // Complete original reference sequence
    alt_sequence: &String,   // Complete original alternate sequence
    variant_pos: i64,        // Original variant position
    indel_length: i64,       // Indel length
) {
    // NOTE: This function assumes there is only ONE alternate allele. In case of multi-allelelic variants in a region, may have to employ some machine-learning techniques like KMeans clustering to determine number of alternate alleles at a particular region.

    // Select appropriate reads for clustalo alignment
    let flanking_region_length = 10; // This constant describes the region flanking the variant region where each read will be checked for insertions/deletions
    let max_num_reads_alignment = 10; // The maximum number of reads used for clustalo alignment
    let mut num_reads_aligned = 0;
    let sequences_list: Vec<&str> = sequences.split("-").collect(); // Vector containing sequences of reads
    let start_positions_list: Vec<&str> = start_positions.split("-").collect(); // Vector containing start positions
    let cigar_sequences_list: Vec<&str> = cigar_sequences.split("-").collect(); // Vector containing cigar sequences
    let quality_scores_list: Vec<&str> = quality_scores.split("-").collect(); // Vector containing quality scores
    let left_flanking_region_limit: i64 = variant_pos - flanking_region_length; // Left hand region upto where base-pair quality check needs to be carried out
    let right_flanking_region_limit: i64 = variant_pos + indel_length + flanking_region_length; // Right hand region upto where base-pair quality check needs to be carried out

    // Parsing through every read to select appropriate reads for alignments with clustalo
    let mut sequences_to_be_aligned = Vec::<String>::new(); // Vector containing sequences to be aligned using clustalo
    for i in 0..cigar_sequences_list.len() {
        if num_reads_aligned >= max_num_reads_alignment {
            break;
        }
        let cigar_seq = cigar_sequences_list[i].to_string();
        let quality_score_seq = quality_scores_list[i].to_string();
        let (alphabets, numbers) = parse_cigar(&cigar_seq); // Parsing out all the alphabets and numbers from the cigar sequence (using parse_cigar function)
        if alphabets.len() == 1 && &alphabets[0].to_string().as_str() == &"M" {
            // If the read is representing the reference allele, they are not interesting and can be discarded
            continue;
        } else if alphabets.len() > 1 {
            // Check if read has insertions or deletions near variant region
            let mut current_pos = start_positions_list[i].to_string().parse::<i64>().unwrap();
            let no_ins_del = 0;
            for j in 0..alphabets.len() {
                if &alphabets[0].to_string().as_str() == &"S"
                    || &alphabets[0].to_string().as_str() == &"H"
                // Ignore hardclips at start of sequence
                {
                    // When the first entry in the cigar sequence is a softclip the start position is generally starts from the next CIGAR entry
                    continue;
                } else if j == alphabets.len() - 1 && &alphabets[j].to_string().as_str() == &"H" {
                    // Ignore hardclips at end of sequence
                    continue;
                } else if &alphabets[j].to_string().as_str() == &"N" {
                    let ins_del_end = current_pos + numbers[j].to_string().parse::<i64>().unwrap(); // Position of end-point of insertion/deletion
                    if (variant_pos - current_pos).abs() <= flanking_region_length
                        || (current_pos + ins_del_end - variant_pos).abs() <= flanking_region_length
                        || (variant_pos + indel_length - current_pos).abs()
                            <= flanking_region_length
                        || (current_pos + ins_del_end - variant_pos - indel_length).abs()
                            <= flanking_region_length
                    // Checking if there is a splice site near the variant region. If yes, that read is not considered for realignment
                    {
                        break;
                    }
                    current_pos += numbers[j].to_string().parse::<i64>().unwrap();
                } else if &alphabets[j].to_string().as_str() == &"I"
                    || &alphabets[j].to_string().as_str() == &"D"
                {
                    let ins_del_end = current_pos + numbers[j].to_string().parse::<i64>().unwrap(); // Position of end-point of insertion/deletion

                    //println!("current_pos:{}", current_pos);
                    //println!("ins_del_end:{}", ins_del_end);
                    //println!("variant_pos:{}", variant_pos);
                    //println!("variant_end:{}", variant_pos + indel_length);
                    if (variant_pos < current_pos && variant_pos + indel_length >= current_pos)
                        || (variant_pos < current_pos + ins_del_end
                            && variant_pos + indel_length >= current_pos + ins_del_end)
                        || (variant_pos >= current_pos + ins_del_end
                            && variant_pos - flanking_region_length <= current_pos + ins_del_end)
                        || (variant_pos + indel_length <= current_pos
                            && variant_pos + indel_length + flanking_region_length >= current_pos)
                    {
                        // Need to check if the bases near the variant region are of high quality
                        //println!("Success");
                        //println!("i:{}", i);
                        //println!("cigar_seq:{}", cigar_seq);
                        check_base_pair_quality_scores(
                            &quality_score_seq,
                            &alphabets,
                            &numbers,
                            start_positions_list[i].to_string().parse::<i64>().unwrap(),
                            variant_pos,
                            flanking_region_length,
                            indel_length,
                            left_flanking_region_limit,
                            right_flanking_region_limit,
                        );
                        sequences_to_be_aligned.push(sequences_list[i + 2].to_owned());
                        // 2 added because first two sequences are reference and alternate sequence
                        num_reads_aligned += 1;
                    }
                    current_pos += numbers[j].to_string().parse::<i64>().unwrap();
                } else {
                    current_pos += numbers[j].to_string().parse::<i64>().unwrap();
                }
            }
        }
    }

    let status = Command::new("sh") // Assuming this code is running on a Unix system
        .arg("-c")
        .arg("echo Hello world")
        .output()
        .expect("failed to execute process");

    println!("output:{}", str::from_utf8(&status.stdout).unwrap()); // Converts slice of bytes into a string slice
}

pub fn check_read_within_indel_region(
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
        let (alphabets, numbers) = parse_cigar(&cigar_sequence.to_string()); // Parsing out all the alphabets and numbers from the cigar sequence (using parse_cigar function)
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

pub fn check_first_last_nucleotide_correctly_aligned(
    q_seq: &String,
    align: &String,
    r_seq: &String,
) -> (String, String, String) {
    //println!("q_seq:{}", q_seq);
    //println!("align:{}", align);
    //println!("r_seq:{}", r_seq);

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
        if &align_chars[j].to_string() == &"|"
            && first == 0
            && first_substituted_nucleotides.len() == 0
        {
            first_matched_nucleotides.push(r_seq_chars[j]);
            wrong_substitution = false;
        } else if &align_chars[j].to_string() == &"|"
            && first == 0
            && first_substituted_nucleotides.len() > 0
        {
            wrong_substitution = false;
        } else if &align_chars[j].to_string() == &"*"
            && first == 0
            && first_matched_nucleotides.len() == 0
        {
            first_substituted_nucleotides.push(q_seq_chars[j]);
        } else if first == 1 && &align_chars[j].to_string() != &"|" {
            // Addition of nucleotides to first unmatched sequence
            first_unmatched_sequence.push(r_seq_chars[j]);
        } else if first == 0
            && &align_chars[j].to_string() != &"|"
            && &align_chars[j].to_string() != &"*"
        {
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
    //println!(
    //    "first_partially_matched_nucleotides_left:{}",
    //    first_partially_matched_nucleotides_left
    //);
    //println!(
    //    "first_unmatched_sequence_left_wrt_partially_matched_nucleotides:{}",
    //    first_unmatched_sequence_left_wrt_partially_matched_nucleotides,
    //);

    first_unmatched_sequence = reverse_string(&first_unmatched_sequence);
    first_matched_nucleotides = reverse_string(&first_matched_nucleotides);
    first_substituted_nucleotides = reverse_string(&first_substituted_nucleotides);
    first_partially_matched_nucleotides_right =
        reverse_string(&first_partially_matched_nucleotides_right);
    first_unmatched_sequence_right_wrt_partially_matched_nucleotides =
        reverse_string(&first_unmatched_sequence_right_wrt_partially_matched_nucleotides);
    //println!(
    //    "first_partially_matched_nucleotides_right:{}",
    //    first_partially_matched_nucleotides_right
    //);
    //println!(
    //    "first_unmatched_sequence_right_wrt_partially_matched_nucleotides:{}",
    //    first_unmatched_sequence_right_wrt_partially_matched_nucleotides,
    //);
    //println!("first_matched_nucleotides:{}", first_matched_nucleotides);
    //println!(
    //    "first_substituted_nucleotides:{}",
    //    first_substituted_nucleotides
    //);
    //println!("first_unmatched_sequence:{}", first_unmatched_sequence);

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
    if first_matched_nucleotides.len() == 0 || first_substituted_nucleotides.len() > 0 {
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
    //println!("alignment_wrong:{}", alignment_wrong);
    //println!("wrong_substitution:{}", wrong_substitution);

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

        let mut all_matched_nucleotides;
        let mut best_alignment_position = 0;
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
                    best_alignment_position = i;
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

        for i in correct_alignment_length + last_print_position
            ..correct_alignment_length + last_print_position + best_alignment_position
        {
            //println!(
            //    "i,q_seq_chars[i],align_chars[i],r_seq_chars[i]:{}{}{}{}",
            //    i, q_seq_chars[i], align_chars[i], r_seq_chars[i]
            //);
            q_seq_correct.push(q_seq_chars[i]);
            align_correct.push(align_chars[i]);
            r_seq_correct.push(r_seq_chars[i]);
        }

        //println!("last_print_position:{}", last_print_position);
        //println!("best_alignment_position:{}", best_alignment_position);
        // Adding unmatched nucleotide(s) to first nucleotide after last_print_position
        for i in 0..first_matched_nucleotides.len() {
            if first_matched_nucleotides_vector[i]
                == r_seq_chars
                    [last_print_position + best_alignment_position + correct_alignment_length + i]
            {
                align_correct.push('|');
            } else {
                println!("Possibly wrong alignment");
                align_correct.push('*'); // Should not happen but just in case
            }
            q_seq_correct.push(first_matched_nucleotides_vector[i]);
            r_seq_correct.push(
                r_seq_chars
                    [last_print_position + best_alignment_position + correct_alignment_length + i],
            )
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

        let mut all_substituted_nucleotides;
        let mut best_alignment_position = 0;
        for i in 0..first_unmatched_sequence.len() {
            all_substituted_nucleotides = true;
            let mut num_iterations = 0; // Need to check if the entire length of first_unmatched_sequence has been parsed or not
            for j in 0..first_substituted_nucleotides.len() {
                // Check if all nucleotides are matching or not
                if i + j < first_unmatched_sequence.len() {
                    // Prevent iterator to go beyond length of first_unmatched_sequence_vector
                    //println!("i:{}", i);
                    //println!("i+j:{}", i + j);
                    //println!(
                    //    "first_substituted_nucleotides_vector[j]:{}",
                    //    first_substituted_nucleotides_vector[j]
                    //);
                    //println!(
                    //    "first_unmatched_sequence_vector[i + j]:{}",
                    //    first_unmatched_sequence_vector[i + j]
                    //);
                    if first_substituted_nucleotides_vector[j]
                        != first_unmatched_sequence_vector[i + j]
                    {
                        all_substituted_nucleotides = false;
                        break;
                    }
                    best_alignment_position = i;
                    num_iterations += 1;
                }
            }
            //if all_substituted_nucleotides == true {
            //    println!("num_iterations:{}", num_iterations);
            //    println!(
            //        "first_substituted_nucleotides.len():{}",
            //        first_substituted_nucleotides.len()
            //    );
            //}
            if num_iterations != first_substituted_nucleotides.len()
                && all_substituted_nucleotides == true
            {
                // If all the nucleotides in first_matched_nucleotides have not been parsed set all_matched_nucleotides = false
                all_substituted_nucleotides = false;
            }
            if all_substituted_nucleotides == true {
                break;
            }
        }

        for i in correct_alignment_length + last_print_position
            ..correct_alignment_length + last_print_position + best_alignment_position
        {
            //println!(
            //    "i,q_seq_chars[i],align_chars[i],r_seq_chars[i]:{}{}{}{}",
            //    i, q_seq_chars[i], align_chars[i], r_seq_chars[i]
            //);
            q_seq_correct.push(q_seq_chars[i]);
            align_correct.push(align_chars[i]);
            r_seq_correct.push(r_seq_chars[i]);
        }

        //println!("last_print_position:{}", last_print_position);
        //println!("best_alignment_position:{}", best_alignment_position);
        // Adding unmatched nucleotide(s) to first nucleotide after last_print_position
        for i in 0..first_substituted_nucleotides.len() {
            if first_substituted_nucleotides_vector[i]
                == r_seq_chars
                    [last_print_position + best_alignment_position + correct_alignment_length + i]
            {
                align_correct.push('|');
            } else {
                align_correct.push('*');
            }
            q_seq_correct.push(first_substituted_nucleotides_vector[i]);
            r_seq_correct.push(
                r_seq_chars
                    [last_print_position + best_alignment_position + correct_alignment_length + i],
            )
        }
        alignment_changed = true;
    } else if first_matched_nucleotides.len() > 0
        && first_unmatched_sequence.len() > 0
        && first_unmatched_sequence.len() > first_matched_nucleotides.len()
    {
        // Check if there is better alignment for last matched sequence
        //println!("Fully matched right-sequence");
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

        //println!("last_print_position:{}", last_print_position);
        //println!("all_matched_nucleotides:{}", all_matched_nucleotides);
        //println!("correct_alignment_length:{}", correct_alignment_length);

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
        //println!("Partially matched right-sequence");
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

        //println!("last_print_position:{}", last_print_position);
        //println!("all_matched_nucleotides:{}", all_matched_nucleotides);
        //println!("correct_alignment_length:{}", correct_alignment_length);

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
        //println!("Partially matched left-sequence");
        if q_seq_correct.len() > 0 {
            // If there are any changes in alignment in previous steps work on the updated alignment, otherwise use original alignment
            q_seq_chars = q_seq_correct.chars().collect();
            align_chars = align_correct.chars().collect();
            r_seq_chars = r_seq_correct.chars().collect();
        } else {
            q_seq_chars = q_seq.chars().collect();
            align_chars = align.chars().collect();
            r_seq_chars = r_seq.chars().collect();
        }

        //println!("q_seq_correct:{}", q_seq_correct);
        //println!("align_correct:{}", align_correct);
        //println!("r_seq_correct:{}", r_seq_correct);

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

        //println!("final_print_position:{}", final_print_position);
        //println!("all_matched_nucleotides:{}", all_matched_nucleotides);

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
    //println!("alignment_changed:{}", alignment_changed);
    //println!("q_seq_correct:{}", q_seq_correct);
    //println!("align_correct:{}", align_correct);
    //println!("r_seq_correct:{}", r_seq_correct);
    (q_seq_correct, align_correct, r_seq_correct)
}

pub fn reverse_string(input: &str) -> String {
    // Reversing a string
    let mut result = String::new();
    for c in input.chars().rev() {
        result.push(c)
    }
    result
}
