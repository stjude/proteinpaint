// Syntax: ~/proteinpaint/server/utils/bigWigSummary ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw chr17 7577333 7577780 1000

// Syntax local: cd .. && cargo build --release && time echo ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw,chr17,7577333,7577780,10 | target/release/bigwig

// Syntax local: cd .. && cargo build --release && time echo /Users/rpaul1/proteinpaint/hg19/TARGET/DNA/cov-wes/SJALL015634_D1.bw,chr1,47682689,47700849,10 | target/release/bigwig

// Syntax url: cd .. && cargo build --release && time echo http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig,chr17,7584491,7585468,100 | target/release/bigwig

// Syntax url: cd .. && cargo build --release && time echo https://proteinpaint.stjude.org/ppdemo/hg19/bigwig/file.bw,chr17,7568451,7591984,100 | target/release/bigwig

use bigtools::bigwigread::BigWigRead;
use bigtools::remote_file::RemoteFile;
use math::round;
use std::env;
use std::io;

fn main() {
    let mut input = String::new();
    env::set_var("RUST_BACKTRACE", "full");
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        #[allow(unused_variables)]
        Ok(n) => {
            //println!("{} bytes read", n);
            //println!("{}", input);
        }
        Err(error) => println!("Piping error: {}", error),
    }
    let args: Vec<&str> = input.split(",").collect(); // Various input from nodejs is separated by "_" character

    //println!("args:{:?}", args);

    let bigwig_file_url: String = args[0].parse::<String>().unwrap(); // Bigwig file name
    let chrom: String = args[1].parse::<String>().unwrap(); // Chromosome name
    let start_pos: u32 = args[2].parse::<u32>().unwrap(); // Start position
    let stop_pos: u32 = args[3].parse::<u32>().unwrap(); // Stop position
    let difference = stop_pos - start_pos;
    let datapoints: u32 = args[4].replace("\n", "").parse::<u32>().unwrap(); // Number of intervals
    let exact_offset: f64 = difference as f64 / datapoints as f64;
    let exact_offset_whole: i64 = round::ceil(exact_offset, 0) as i64;
    println!("exact_offset:{}", exact_offset);
    println!("exact_offset_whole:{}", exact_offset_whole);

    if bigwig_file_url.starts_with("http") == true {
        // Its a web URL
        let remote_file = RemoteFile::new(&bigwig_file_url);
        let remote_file2 = remote_file.clone();
        let reader = BigWigRead::from(remote_file);
        match reader {
            Ok(_) => {
                println!("File found");
                let mut reader = BigWigRead::from(remote_file2).unwrap();
                let bigwig_output = reader.get_interval(&chrom, start_pos, stop_pos).unwrap();
                for interval in bigwig_output {
                    println!("{:?}", interval);
                }
            }
            Err(_) => {
                println!("File not found");
            }
        }
    } else {
        // Its a local file
        let reader = BigWigRead::from_file_and_attach(&bigwig_file_url);
        match reader {
            Ok(_) => {
                let mut reader = BigWigRead::from_file_and_attach(&bigwig_file_url).unwrap();
                let bigwig_output = reader.get_interval(&chrom, start_pos, stop_pos).unwrap();
                //calculate_datapoints(bigwig_output, chrom, start_pos, stop_pos, data_points);
                for interval in bigwig_output {
                    println!("{:?}", interval);
                }
            }
            Err(_) => {
                println!("File not found");
            }
        }
    }
}

fn calculate_datapoints(
    bigwig_output: String,
    chrom: String,
    start_pos: u32,
    stop_pos: u32,
    data_points: u32,
) {
}
