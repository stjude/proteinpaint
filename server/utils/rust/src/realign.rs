// Syntax: cd .. && cargo build --release
use bio::alignment::pairwise::*;
use bio::alignment::AlignmentOperation;
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
    ref_length: usize,  // Length of reference allele
    alt_length: usize,  // Length of alternate allele
    strictness: usize,  // Strictness of the indel pipeline
    read_sequence: String, // Original read sequence
) -> (usize, i64, i64, String, String) {
    let mut within_indel = 0; // 0 if read does not contain indel region and 1 if it contains indel region
    let mut correct_start_position: i64 = left_most_pos; // Many times reads starting with a softclip (e.g cigar sequence: 10S80M) will report the first matched nucleotide as the start position (i.e 11th nucleotide in this example). This problem is being corrected below
    let original_read_length = read_sequence.len(); // Original read length
    let mut correct_end_position = correct_start_position; // Correct end position of read
    let mut splice_freq: usize = 0; // Number of times the read has been spliced
    let mut splice_start_pos: i64 = 0; // Start position of the spliced part of the region containing indel site relative to the read
    let mut splice_stop_pos: i64 = 0; // Stop position of the spliced part of the region containing indel site relative to the read
    let mut splice_start_cigar: usize = 0; // First cigar entry in the spliced fragment containing the variant to see if its a softclip
    if &cigar_sequence == &"*" || &cigar_sequence == &"=" {
    } else {
        let indel_stop: i64 = indel_start + indel_length as i64;
        //println!("cigar_sequence:{}", cigar_sequence);
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
        //println!("correct_start_position:{}", correct_start_position);
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
            let mut nucleotide_position_without_splicing = 0; // This contains the position of nucleotide being analyzed w.r.t to read without splicing
            let mut nucleotide_position_wrt_genome = correct_start_position; // This contains the position of nucleotide being analyzed w.r.t to genome
            let mut new_frag = 1; // Flag indicating start of a new fragment after splicing
            for i in 0..alphabets.len() {
                if new_frag == 1 {
                    splice_start_cigar = 0;
                    if &alphabets[i].to_string().as_str() == &"S" {
                        splice_start_cigar = 1;
                    }
                    //splice_start_frag = nucleotide_position_wrt_genome;
                    splice_start_frag = nucleotide_position_wrt_genome;
                    splice_stop_frag = splice_start_frag;
                    splice_start_pos = nucleotide_position_without_splicing;
                    splice_stop_pos = nucleotide_position_without_splicing;
                    new_frag = 0
                }

                if &alphabets[i].to_string().as_str() != &"N" {
                    nucleotide_position_without_splicing +=
                        numbers[i].to_string().parse::<i64>().unwrap();
                }

                if &alphabets[i].to_string().as_str() == &"N" {
                    nucleotide_position_wrt_genome +=
                        numbers[i].to_string().parse::<i64>().unwrap();
                } else if &alphabets[i].to_string().as_str() == &"I" {
                    // In case of an insertion, the position w.r.t to read will change, but no change will occur w.r.t reference genome since the inserted nucleotides are not present in the reference genome
                    splice_stop_pos += numbers[i].to_string().parse::<i64>().unwrap();
                } else if &alphabets[i].to_string().as_str() == &"D" {
                    // In case of a deletion, the position w.r.t reference genome will change but no change will occur w.r.t reads since the deleted nucleotides are not present in the read
                    splice_stop_frag += numbers[i].to_string().parse::<i64>().unwrap();
                    nucleotide_position_wrt_genome +=
                        numbers[i].to_string().parse::<i64>().unwrap();
                } else if &alphabets[i].to_string().as_str() == &"M"
                    || &alphabets[i].to_string().as_str() == &"S"
                {
                    splice_stop_frag += numbers[i].to_string().parse::<i64>().unwrap();
                    splice_stop_pos += numbers[i].to_string().parse::<i64>().unwrap();
                    nucleotide_position_wrt_genome +=
                        numbers[i].to_string().parse::<i64>().unwrap();
                }

                //println!(
                //    "nucleotide_position_wrt_genome:{}",
                //    nucleotide_position_wrt_genome
                //);
                //println!("alphabet:{}", &alphabets[i].to_string().as_str());
                //println!("splice_start_frag:{}", splice_start_frag);
                //println!("splice_stop_frag:{}", splice_stop_frag);

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
                        //splice_start_pos = splice_start_frag;
                        //splice_stop_pos = nucleotide_position_without_splicing;
                        //println!("splice_stop_frag:{}", splice_stop_frag);
                        break;
                    } else {
                        //println!("Somehow fragment containing indel site was not found, please check (within_indel = 0)!");
                        within_indel = 0;
                        //println!("splice_start_frag:{}", splice_start_frag);
                        //println!("splice_stop_frag2:{}", splice_stop_frag);
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

    let mut alignment_side: String = "left".to_string(); // Flag to check whether read should be compared from the left or right-side in jaccard_similarity_weights() function
    if &cigar_sequence == &"*" || &cigar_sequence == &"=" {
    } else {
        let (alphabets, numbers) = parse_cigar(&cigar_sequence.to_string()); // Parsing out all the alphabets and numbers from the cigar sequence (using parse_cigar function)
        let mut right_most_pos;

        // When read starts with softclip, right_most_pos is initialized to left_most_pos and subsequently incremented using the CIGAR entries
        right_most_pos = correct_start_position;
        for i in 0..alphabets.len() {
            // Looping over each CIGAR item
            if &alphabets[i].to_string().as_str() != &"H" {
                // If the cigar item is a hard-clip, the right_most_pos will not be incremented
                right_most_pos += numbers[i].to_string().parse::<i64>().unwrap();
                // right_most_pos incremented when read starts with soft-clip
            }
        }

        //Determine if left or right_alignment

        let alignment_offset: i64 = 7; // Variable which sets the offset for reads that start only these many bases before the indel start. If the start position of the read lies between the offset and indel start, the read is right-aligned. This value is somewhat arbitary and may be changed in the future.

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
        } else if (indel_start - correct_start_position).abs()
            <= (indel_start - correct_end_position).abs()
        // When start position is closer to indel start, read is right aligned
        {
            alignment_side = "right".to_string();
        }
    }

    let mut final_sequence = read_sequence.to_owned(); // No splicing
    if splice_freq > 0 {
        final_sequence = String::new(); // Contains spliced sequences which overlaps with indel region. If read not spliced, contains entire sequence
        let sequence_vector: Vec<_> = read_sequence.chars().collect(); // Vector containing each sequence nucleotides as separate elements in the vector

        //println!("splice_start_pos:{}", splice_start_pos);
        //println!("splice_stop_pos:{}", splice_stop_pos);
        for k in splice_start_pos..splice_stop_pos {
            if (k as usize) < sequence_vector.len() {
                final_sequence += &sequence_vector[k as usize].to_string();
            }
        }
    }
    (
        within_indel,
        correct_start_position,
        correct_end_position,
        alignment_side,
        final_sequence,
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

fn check_first_last_nucleotide_correctly_aligned(
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
                if j < q_seq_chars.len() {
                    q_seq_correct.push(q_seq_chars[j]);
                    align_correct.push(align_chars[j]);
                    r_seq_correct.push(r_seq_chars[j]);
                }
            }
            for k in 0..first_partially_matched_nucleotides_right.len() {
                q_seq_correct.push(first_partially_matched_nucleotides_right_vector[k]);
                if correct_alignment_length + last_print_position + k < align_chars.len() {
                    align_correct
                        .push(align_chars[correct_alignment_length + last_print_position + k]);
                    r_seq_correct
                        .push(r_seq_chars[correct_alignment_length + last_print_position + k]);
                }
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
                if j < q_seq_chars.len() {
                    q_seq_correct.push(q_seq_chars[j]);
                    align_correct.push(align_chars[j]);
                    r_seq_correct.push(r_seq_chars[j]);
                }
            }

            for i in first_partially_matched_nucleotides_left.len()
                + first_unmatched_sequence_left_wrt_partially_matched_nucleotides_vector.len()
                ..r_seq_chars.len()
            {
                //println!(
                //    "i,q_seq_chars[i],align_chars[i],r_seq_chars[i]:{},{},{},{}",
                //    i, q_seq_chars[i], align_chars[i], r_seq_chars[i]
                //);
                if i < q_seq_chars.len() {
                    q_seq_correct.push(q_seq_chars[i]);
                    align_correct.push(align_chars[i]);
                    r_seq_correct.push(r_seq_chars[i]);
                }
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

pub fn align_single_reads(query_seq: &String, ref_seq: String) -> (String, String, String, f64) {
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

    let alignment = aligner.global(&query_seq.as_bytes(), ref_seq.as_bytes());
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
    //println!("q_seq:{}", q_seq);
    //println!("align:{}", align);
    //println!("r_seq:{}", r_seq);
    let (q_seq_final, align_final, r_seq_final) =
        check_first_last_nucleotide_correctly_aligned(&q_seq, &align, &r_seq);
    let num_matches = align_final.matches("|").count() as f64 / align_final.len() as f64;
    (q_seq_final, align_final, r_seq_final, num_matches)
}

pub fn determine_start_stop_indel_region_in_read(
    alignment_side: String,
    q_seq_alt: &String,
    q_seq_ref: &String,
    correct_start_position: i64,
    correct_end_position: i64,
    variant_pos: i64,
    ref_length: usize,
    alt_length: usize,
    indel_length: usize,
) -> (i64, i64, i64, i64) {
    // Determine start/stop position of nucleotides in read that need to be highlighted red to show variant region in UI
    let mut red_region_start_alt = 0;
    let mut red_region_start_ref = 0;
    let mut red_region_stop_ref = 0;
    let mut red_region_stop_alt = 0;
    let trust_match_cutoff = 10; // When there are gaps in alignment near the variant region, it can be due to reason. Either due to poor alignment near the end of the read or due to a genuine deletion near the variant region. If beyond this cutoff, start/stop position will not be incremented

    //println!("ref_length:{}", ref_length);
    //println!("alt_length:{}", alt_length);
    //println!("variant_pos:{}", variant_pos);
    //println!("q_seq_temp_alt.len():{}", q_seq_alt.len());
    //println!("q_seq_temp_ref.len():{}", q_seq_ref.len());
    //println!("correct_start_position:{}", correct_start_position);
    //println!("correct_end_position:{}", correct_end_position);
    let q_seq_alt_vec: Vec<_> = q_seq_alt.chars().collect();
    let q_seq_ref_vec: Vec<_> = q_seq_ref.chars().collect();
    let mut num_matches_alt = 0;
    let mut num_matches_ref = 0;
    if alignment_side == "left".to_string() {
        red_region_start_alt = (variant_pos - correct_start_position).abs();
        red_region_start_ref = (variant_pos - correct_start_position).abs();
        red_region_stop_ref = (variant_pos - correct_start_position).abs() + ref_length as i64;
        red_region_stop_alt = (variant_pos - correct_start_position).abs() + alt_length as i64;

        // Check if there are any gaps between start of variant and start of alignment
        for i in 0..(variant_pos - correct_start_position).abs() as usize {
            if i < q_seq_alt_vec.len() {
                if q_seq_alt_vec[i] != '-' {
                    num_matches_alt += 1;
                }
                //else if q_seq_alt_vec[i] == '-' && i < red_region_start_alt as usize - 1 {
                //    num_matches_alt = 0;
                //}
                else if q_seq_alt_vec[i] == '-' && num_matches_alt < trust_match_cutoff {
                    red_region_start_alt += 1;
                    red_region_stop_alt += 1;
                }
            }
            if i < q_seq_ref_vec.len() {
                if q_seq_ref_vec[i] != '-' {
                    num_matches_ref += 1;
                }
                //else if q_seq_ref_vec[i] == '-' && i < red_region_start_ref as usize - 1 {
                //    num_matches_ref = 0;
                //}
                else if q_seq_ref_vec[i] == '-' && num_matches_ref < trust_match_cutoff {
                    red_region_start_ref += 1;
                    red_region_stop_ref += 1;
                }
            }
        }
    } else if alignment_side == "right".to_string() {
        let mut correctly_aligned_nclt_in_right_alt =
            correct_end_position - variant_pos - ref_length as i64;
        let mut correctly_aligned_nclt_in_right_ref =
            correct_end_position - variant_pos - ref_length as i64;

        // Check if there are any gaps in the query sequence between end of alignment and end of variant sequence
        for i in
            (q_seq_alt.len() - correctly_aligned_nclt_in_right_alt as usize..q_seq_alt.len()).rev()
        {
            if i < q_seq_alt_vec.len() {
                if q_seq_alt_vec[i] != '-' {
                    num_matches_alt += 1;
                }
                //else if q_seq_alt_vec[i] == '-'
                //    && i > q_seq_alt.len() - correctly_aligned_nclt_in_right_alt as usize
                //{
                //    num_matches_alt = 0;
                //}
                else if q_seq_alt_vec[i] == '-' && num_matches_alt < trust_match_cutoff {
                    correctly_aligned_nclt_in_right_alt += 1;
                    //println!("Alt_space");
                }
            } else {
                break;
            }
        }
        for i in
            (q_seq_ref.len() - correctly_aligned_nclt_in_right_ref as usize..q_seq_ref.len()).rev()
        {
            if i < q_seq_ref_vec.len() {
                if q_seq_ref_vec[i] != '-' {
                    num_matches_ref += 1;
                }
                //else if q_seq_ref_vec[i] == '-'
                //    && i > q_seq_ref.len() - correctly_aligned_nclt_in_right_ref as usize
                //{
                //    num_matches_ref = 0;
                //}
                else if q_seq_ref_vec[i] == '-' && num_matches_ref < trust_match_cutoff {
                    correctly_aligned_nclt_in_right_ref += 1;
                    //println!("Ref_space");
                }
            } else {
                break;
            }
        }

        //println!(
        //    "correctly_aligned_nclt_in_right_alt:{}",
        //    correctly_aligned_nclt_in_right_alt
        //);
        //println!(
        //    "correctly_aligned_nclt_in_right_ref:{}",
        //    correctly_aligned_nclt_in_right_ref
        //);
        red_region_start_alt =
            q_seq_alt.len() as i64 - correctly_aligned_nclt_in_right_alt - alt_length as i64;
        red_region_start_ref =
            q_seq_ref.len() as i64 - correctly_aligned_nclt_in_right_ref - ref_length as i64;
        red_region_stop_alt = q_seq_alt.len() as i64 - correctly_aligned_nclt_in_right_alt;
        red_region_stop_ref = q_seq_ref.len() as i64 - correctly_aligned_nclt_in_right_ref;
    }
    //println!("num_matches_alt:{}", num_matches_alt);
    //println!("num_matches_ref:{}", num_matches_ref);

    if red_region_start_alt < 0 {
        //red_region_stop_alt = alt_length as i64;
        //println!("red_disp_region_start_alt:{}", red_region_start_alt);
        //if ref_length > alt_length {
        //} else {
        //    red_region_stop_alt = red_region_start_alt.abs() as i64 + 2;
        //}
        red_region_stop_alt = (red_region_start_alt.abs() - indel_length as i64).abs();
        red_region_start_alt = 0;
        //println!("red_disp_region_start_alt was less than zero");
    }

    if red_region_start_ref < 0 {
        //red_region_stop_ref = ref_length as i64;
        //println!("red_disp_region_start_ref:{}", red_region_start_ref);
        if ref_length > alt_length {
            red_region_stop_ref = (red_region_start_ref.abs() - indel_length as i64).abs();
        } else {
            red_region_stop_ref = red_region_start_ref.abs() as i64 + 2;
        }
        red_region_start_ref = 0;
        //println!("red_disp_region_start_ref was less than zero");
    }

    if red_region_stop_alt < 0 {
        red_region_stop_alt = 0;
        //println!("red_disp_region_stop_alt was less than zero");
    }

    if red_region_stop_ref < 0 {
        red_region_stop_ref = 0;
        //println!("red_disp_region_stop_ref was less than zero");
    }

    if alignment_side == "left".to_string()
        && (red_region_start_alt >= q_seq_alt.len() as i64
            || red_region_start_ref >= q_seq_ref.len() as i64)
    {
        // In case of reads with very poor alignment but left-aligned, the start site of read may be greater than the length of the alignment in such case, try right-aligning the reads
        let correctly_aligned_nclt_in_right =
            correct_end_position - variant_pos - ref_length as i64;
        //println!(
        //    "correctly_aligned_nclt_in_right:{}",
        //    correctly_aligned_nclt_in_right
        //);
        //println!("Was originally left-aligned but start position was higher than alignment length, so attempted to right-align");
        red_region_start_alt =
            q_seq_alt.len() as i64 - correctly_aligned_nclt_in_right - alt_length as i64;
        red_region_start_ref =
            q_seq_ref.len() as i64 - correctly_aligned_nclt_in_right - ref_length as i64;
        red_region_stop_alt = q_seq_alt.len() as i64 - correctly_aligned_nclt_in_right;
        red_region_stop_ref = q_seq_ref.len() as i64 - correctly_aligned_nclt_in_right;
    } else if alignment_side == "right".to_string()
        && (red_region_start_alt >= q_seq_alt.len() as i64
            || red_region_start_ref >= q_seq_ref.len() as i64)
    // In case of reads with very poor alignment but right-aligned, the start site of read may be greater than the length of the alignment in such case, try left-aligning the reads
    {
        //println!("Was originally right-aligned but start position was higher than alignment length, so attempted to left-align");
        red_region_start_alt = (variant_pos - correct_start_position).abs();
        red_region_start_ref = (variant_pos - correct_start_position).abs();
        red_region_stop_ref = (variant_pos - correct_start_position).abs() + ref_length as i64;
        red_region_stop_alt = (variant_pos - correct_start_position).abs() + alt_length as i64;
    }
    //println!("alignment_side:{}", alignment_side);
    (
        red_region_start_alt,
        red_region_stop_alt,
        red_region_start_ref,
        red_region_stop_ref,
    )
}
