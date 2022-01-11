// Syntax: cd .. && cargo build --release

use std::process::Command;
use std::str;

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

    if &alphabets[0].to_string().as_str() == &"S" {
        start_position -= numbers[0].to_string().parse::<i64>().unwrap();
    }

    // Parsing part of read base-pair quality sequence which covers the variant and flanking region
    let mut current_pos = start_position;
    let mut nclt_pos = 0;
    for i in 0..alphabets.len() {
        if &alphabets[i].to_string().as_str() == &"H" {
            // Ignore hardclips
            continue;
        } else if &alphabets[i].to_string().as_str() == &"M"
            || &alphabets[i].to_string().as_str() == &"S"
        {
            // Checking to see if within variant region or flanking region
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
        let (alphabets, numbers) = crate::cigar::parse_cigar(&cigar_seq); // Parsing out all the alphabets and numbers from the cigar sequence (using parse_cigar function)
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
                        println!("Success");
                        println!("i:{}", i);
                        println!("cigar_seq:{}", cigar_seq);
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
