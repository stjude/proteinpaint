use std::process::Command;
use std::str;

pub fn realign_reads(
    sequences: &String, // Variable contains sequences separated by "-" character, the first two sequences contains the ref and alt sequences
    start_positions: &String, // Variable contains start position of reads separated by "-" character
    cigar_sequences: &String, // Variable contains cigar sequences separated by "-" character
    quality_scores: &String, // Variable contains quality scores of reads separated by "-" character
    clustalo_path: &String,  // Path to clustalo
    ref_sequence: &String,   // Complete original reference sequence
    alt_sequence: &String,   // Complete original alternate sequence
    variant_pos: i64,        // Original variant position
) {
    // Select appropriate reads for clustalo alignment
    let flanking_region_length = 10; // This constant describes the region flanking the variant region where each read will be checked for insertions/deletions
    let max_num_reads_alignment = 10; // The maximum number of reads used for clustalo alignment
    let mut num_reads_aligned = 0;
    let sequences_list: Vec<&str> = sequences.split("-").collect(); // Vector containing sequences of reads
    let start_positions_list: Vec<&str> = start_positions.split("-").collect(); // Vector containing start positions
    let cigar_sequences_list: Vec<&str> = cigar_sequences.split("-").collect(); // Vector containing cigar sequences
    let quality_scores_list: Vec<&str> = quality_scores.split("-").collect(); // Vector containing quality scores

    // Parsing through every read to select appropriate reads for alignments with clustalo
    let mut sequences_to_be_aligned = Vec::<String>::new(); // Vector containing sequences to be aligned using clustalo
    for i in 0..cigar_sequences_list.len() {
        if num_reads_aligned >= max_num_reads_alignment {
            break;
        }
        let cigar_seq = cigar_sequences_list[i].to_string();
        let (alphabets, numbers) = crate::cigar::parse_cigar(&cigar_seq); // Parsing out all the alphabets and numbers from the cigar sequence (using parse_cigar function)
        if alphabets.len() == 1 && &alphabets[0].to_string().as_str() == &"M" {
            // If the read is representing the reference allele, they are not interesting and can be discarded
            continue;
        } else if alphabets.len() > 1 {
            // Check if read has insertions or deletions near variant region
            let mut current_pos = start_positions_list[i].to_string().parse::<i64>().unwrap();
            let no_ins_del = 0;
            for j in 0..alphabets.len() {
                if &alphabets[j].to_string().as_str() == &"I"
                    || &alphabets[j].to_string().as_str() == &"D"
                {
                    let ins_del_end = current_pos + numbers[j].to_string().parse::<i64>().unwrap();
                    if (variant_pos < current_pos
                        && variant_pos + flanking_region_length >= current_pos)
                        || (variant_pos < current_pos + ins_del_end
                            && variant_pos + flanking_region_length >= current_pos + ins_del_end)
                    {
                        sequences_to_be_aligned.push(sequences_list[i + 2].to_owned());
                        // 2 added because first two sequences are reference and alternate sequence
                        num_reads_aligned += 1;
                    }
                    current_pos += numbers[j].to_string().parse::<i64>().unwrap();
                } else if &alphabets[0].to_string().as_str() == &"S" {
                    // When the first entry in the cigar sequence is a softclip the start position is generally starts from the next CIGAR entry
                    continue;
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
