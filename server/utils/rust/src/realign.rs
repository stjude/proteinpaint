use crate::cigar::parse_cigar;
use std::process::Command;
use std::str;

pub fn realign_reads(
    sequences: &String,
    start_positions: &String,
    cigar_sequences: &String,
    clustalo_path: &String,
) {
    //println!("Hello from realign_reads");

    let status = Command::new("sh") // Assuming this code is running on a Unix system
        .arg("-c")
        .arg("echo Hello world")
        .output()
        .expect("failed to execute process");

    println!("output:{}", str::from_utf8(&status.stdout).unwrap()); // Converts slice of bytes into a string slice
}
