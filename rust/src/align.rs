// Debug syntax: cd .. && cargo build --release && time cat ~/proteinpaint/test.txt | ~/proteinpaint/rust/target/release/align
use json;
use json::JsonValue;
use serde::{Deserialize, Serialize};
use std::io;

mod realign; // Importing functions from realign.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReadAlignmentInfo {
    q_seq_ref: String,
    align_ref: String,
    r_seq_ref: String,
    q_seq_alt: String,
    align_alt: String,
    r_seq_alt: String,
    red_region_start_alt: i64,
    red_region_start_ref: i64,
    red_region_stop_alt: i64,
    red_region_stop_ref: i64,
}

fn main() {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_bytes_read) => {
            //println!("{} bytes read", bytes_read);
            //println!("{}", input);
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    // Variable contains sequences separated by "-" character, the first two sequences contains the ref and alt sequences
                    let query_seq: String = json_string["query_seq"].as_str().unwrap().to_string(); // Query sequence
                    let refseqs_list: &JsonValue = &json_string["refseqs"]; // Vector of refseqs for each SNV/indel
                    let altseqs_list: &JsonValue = &json_string["altseqs"]; // Vector of altseqs for each SNV/indel
                    let cigar_seq = json_string["cigar_seq"].as_str().unwrap().to_string(); // Contains cigar characters
                    let refalleles_list: &JsonValue = &json_string["refalleles"]; // Vector of refalleles for each SNV/indel
                    let altalleles_list: &JsonValue = &json_string["altalleles"]; // Vector of altalleles for each SNV/indel
                    let variant_positions_list = &json_string["ref_positions"];
                    let mut refalleles_vec = Vec::<&str>::new();
                    let mut altalleles_vec = Vec::<&str>::new();
                    let mut variant_positions_vec = Vec::<i64>::new();
                    for var_idx in 0..refalleles_list.len() {
                        refalleles_vec.push(refalleles_list[var_idx].as_str().unwrap());
                        altalleles_vec.push(altalleles_list[var_idx].as_str().unwrap());
                        variant_positions_vec
                            .push(variant_positions_list[var_idx].as_i64().unwrap());
                    }

                    let read_start = json_string["start_position"].as_i64().unwrap(); // Contains start position of read

                    let mut indel_lengths_list = Vec::<usize>::new();
                    for indel_idx in 0..variant_positions_vec.len() {
                        let mut indel_length: usize = altalleles_vec[indel_idx].len(); // Determining indel length, in case of an insertion it will be alt_length. In case of a deletion, it will be ref_length
                        if refalleles_vec[indel_idx].len() > altalleles_vec[indel_idx].len() {
                            indel_length = refalleles_vec[indel_idx].len();
                        }
                        indel_lengths_list.push(indel_length);
                    }
                    let (
                        _within_indel,
                        correct_start_positions,
                        correct_end_positions,
                        alignment_sides,
                        final_sequences,
                    ) = realign::check_read_within_indel_region(
                        // Checks if the read contains the indel region (or a part of it)
                        read_start,
                        cigar_seq.to_owned(),
                        &variant_positions_vec,
                        &indel_lengths_list,
                        &refalleles_vec,
                        &altalleles_vec,
                        1, // Using strictness = 1
                        query_seq,
                    );

                    let mut output_string = "[".to_string();
                    for indel_idx in 0..variant_positions_vec.len() {
                        //println!("final_sequence:{}", final_sequence);

                        let final_sequence = &final_sequences[indel_idx].to_owned();
                        let ref_seq = &refseqs_list[indel_idx];
                        let alt_seq = &altseqs_list[indel_idx];
                        let correct_start_position = correct_start_positions[indel_idx];
                        let correct_end_position = correct_end_positions[indel_idx];
                        let indel_length = indel_lengths_list[indel_idx];
                        let variant_pos = variant_positions_vec[indel_idx];
                        let variant_ref = &refalleles_vec[indel_idx];
                        let variant_alt = &altalleles_vec[indel_idx];
                        let alignment_side = &alignment_sides[indel_idx].to_owned();
                        let (q_seq_ref, align_ref, r_seq_ref, _matched_nucleotides_ratio) =
                            realign::align_single_reads(&final_sequence, ref_seq.to_string()); // Aligning against reference
                        let (q_seq_alt, align_alt, r_seq_alt, _matched_nucleotides_ratio) =
                            realign::align_single_reads(&final_sequence, alt_seq.to_string()); // Aligning against alternate

                        let (
                            red_region_start_alt,
                            red_region_stop_alt,
                            red_region_start_ref,
                            red_region_stop_ref,
                        ) = realign::determine_start_stop_indel_region_in_read(
                            alignment_side.to_string(),
                            &q_seq_alt,
                            &q_seq_ref,
                            &r_seq_alt,
                            &r_seq_ref,
                            correct_start_position,
                            correct_end_position,
                            variant_pos,
                            variant_ref.len(),
                            variant_alt.len(),
                            indel_length,
                        );

                        //println!("variant_disp_pos:{}", variant_pos);
                        //println!("q_seq_ref:{}", q_seq_ref);
                        //println!("align_ref:{}", align_ref);
                        //println!("r_seq_ref:{}", r_seq_ref);
                        //println!("q_seq_alt:{}", q_seq_alt);
                        //println!("align_alt:{}", align_alt);
                        //println!("r_seq_alt:{}", r_seq_alt);
                        //println!("red_region_start_alt:{}", red_region_start_alt);
                        //println!("red_region_start_ref:{}", red_region_start_ref);
                        //println!("red_region_stop_alt:{}", red_region_stop_alt);
                        //println!("red_region_stop_ref:{}", red_region_stop_ref);
                        output_string += &serde_json::to_string(&ReadAlignmentInfo {
                            q_seq_ref: q_seq_ref,
                            align_ref: align_ref,
                            r_seq_ref: r_seq_ref,
                            q_seq_alt: q_seq_alt,
                            align_alt: align_alt,
                            r_seq_alt: r_seq_alt,
                            red_region_start_alt: red_region_start_alt,
                            red_region_start_ref: red_region_start_ref,
                            red_region_stop_alt: red_region_stop_alt,
                            red_region_stop_ref: red_region_stop_ref,
                        })
                        .unwrap();
                        output_string += &",".to_string();
                    }
                    output_string.pop();
                    output_string += &"]".to_string();
                    println!("Final_output:{}", output_string);
                }
                Err(error) => println!("Incorrect json: {}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
}
