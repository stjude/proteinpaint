// Syntax: ~/proteinpaint/server/utils/bigWigSummary ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw chr17 7577333 7577780 1000

// Syntax: cd .. && cargo build --release && echo ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw,chr17,7577333,7577780,100 | target/release/bigwig

// Syntax: cd .. && cargo build --release && echo http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig,chr17,7584491,7585468,100 | target/release/bigwig

use bigtools::bigwigread::BigWigRead;
use bigtools::remote_file::RemoteFile;
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
    let args: Vec<&str> = input.split(",").collect(); // Various input from nodejs is separated by "_" character

    //println!("args:{:?}", args);

    let bigwig_file_url: String = args[0].parse::<String>().unwrap(); // Bigwig file name
    let chrom: String = args[1].parse::<String>().unwrap(); // Chromosome name
    let start_pos: u32 = args[2].parse::<u32>().unwrap(); // Start position
    let stop_pos: u32 = args[3].parse::<u32>().unwrap(); // Stop position

    //let datapoints: u32 = args[4].replace("\n", "").parse::<u32>().unwrap(); // Number of intervals

    if bigwig_file_url.starts_with("http") == true {
        let remote_file = RemoteFile::new(&bigwig_file_url);

        let mut reader = BigWigRead::from(remote_file).unwrap();
        let bigwig_output = reader.get_interval(&chrom, start_pos, stop_pos).unwrap();
        for interval in bigwig_output {
            println!("{:?}", interval);
        }
    } else {
        let mut reader = BigWigRead::from_file_and_attach(&bigwig_file_url).unwrap();
        let bigwig_output = reader.get_interval(&chrom, start_pos, stop_pos).unwrap();
        for interval in bigwig_output {
            println!("{:?}", interval);
        }
    }
}
