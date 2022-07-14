// Syntax: ~/proteinpaint/server/utils/bigWigSummary ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw chr17 7577333 7577780 1000

// Syntax local: cd .. && cargo build --release && time echo ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw,chr17,7577333,7577780,10 | target/release/bigwig

// Syntax local: cd .. && cargo build --release && time echo /Users/rpaul1/proteinpaint/hg19/TARGET/DNA/cov-wes/SJALL015634_D1.bw,chr1,47682689,47700849,10 | target/release/bigwig

// Syntax url: cd .. && cargo build --release && time echo http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig,chr17,7584491,7585468,100 | target/release/bigwig

// Syntax url: cd .. && cargo build --release && time echo https://proteinpaint.stjude.org/ppdemo/hg19/bigwig/file.bw,chr17,7568451,7591984,100 | target/release/bigwig

use bigtools::bigwigread::BigWigRead;
use bigtools::remote_file::RemoteFile;
use math::round;
use std::cmp;
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
    let mut datapoints: u32 = args[4].replace("\n", "").parse::<u32>().unwrap(); // Number of intervals
    println!("datapoints:{}", datapoints);
    if datapoints > difference {
        // This helps to set the maximum resolution possible to 1bp.
        datapoints = difference;
    }

    let exact_offset_whole: u32 = round::ceil(difference as f64 / datapoints as f64, 0) as u32;
    println!("exact_offset_whole:{}", exact_offset_whole);
    let mut datapoints_list = Vec::<u32>::new(); // Vector for storing datapoints
    let mut datapoints_sum = vec![0.0 as f32; datapoints as usize]; // Sum of all values within a region
    let mut datapoints_num = vec![0 as u32; datapoints as usize]; // Number of all values within a region

    let mut current_pos = start_pos; // Initializing current_pos to start position
    for _i in 0..datapoints {
        datapoints_list.push(current_pos);
        current_pos += exact_offset_whole;
    }
    datapoints_list.push(stop_pos);
    println!("datapoints_list length:{:?}", datapoints_list);

    if bigwig_file_url.starts_with("http://") == true
        || bigwig_file_url.starts_with("https://") == true
        || bigwig_file_url.starts_with("www.") == true
    {
        // Its a web URL
        let remote_file = RemoteFile::new(&bigwig_file_url);
        let remote_file2 = remote_file.clone();
        let reader = BigWigRead::from(remote_file);
        match reader {
            Ok(_) => {
                println!("File found");
                let mut reader = BigWigRead::from(remote_file2).unwrap();
                let bigwig_output = reader.get_interval(&chrom, start_pos, stop_pos).unwrap();
                let mut i = 0;
                let mut start_region = datapoints_list[i];
                let mut end_region = datapoints_list[i + 1];
                for entry in bigwig_output {
                    //println!("{:?}", entry);
                    match entry {
                        Ok(v) => {
                            println!("start,end,value:{},{},{}", v.start, v.end, v.value);
                            if v.start == v.end {
                                continue;
                            } else {
                                if v.start >= start_region {
                                    // Calculate sum and number for this region
                                    let stop_entry_within_region = cmp::min(v.end, end_region);
                                    datapoints_num[i] += stop_entry_within_region;
                                    datapoints_sum[i] += stop_entry_within_region as f32 * v.value;
                                } else {
                                    println!("Unexpected case where v.start < start_region");
                                    println!("i:{}", i);
                                    println!("start_region:{}", start_region);
                                    println!("end_region:{}", end_region);
                                }
                                let mut iter = 1;
                                while end_region < v.end {
                                    if v.start >= start_region && iter > 1 {
                                        // Calculate sum and number for this region
                                        let stop_entry_within_region = cmp::min(v.end, end_region);
                                        datapoints_num[i] += stop_entry_within_region;
                                        datapoints_sum[i] +=
                                            stop_entry_within_region as f32 * v.value;
                                    }
                                    if end_region < v.end {
                                        // Entry spans into next region, need to increment iterator
                                        i += 1;
                                        start_region = datapoints_list[i];
                                        end_region = datapoints_list[i + 1];
                                    }
                                    if v.start < start_region {
                                        // Should not happen
                                        println!("Unexpected case where v.start < start_region inside while loop");
                                        println!("i:{}", i);
                                        println!("start_region:{}", start_region);
                                        println!("end_region:{}", end_region);
                                    }
                                    iter += 1;
                                }
                                // Check number of regions that entry spans
                                //let mut selected_regions_vec = Vec::<u32>::new();
                                //for i in 0..datapoints_list {
                                //    if i + 1 < datapoints_list.len() {
                                //        if v.start >= datapoints_list[i]
                                //            || datapoints_list[i + 1] < v.end
                                //        {
                                //            selected_regions_vec.push(datapoints_list[i]);
                                //        }
                                //    } else if datapoints_list[i + 1] >= v.end {
                                //        break;
                                //    }
                                //}
                            }
                        }
                        Err(_) => {
                            println!("Possible error:{:?}", entry);
                        }
                    }
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

                let mut i = 0;
                let mut start_region = datapoints_list[i];
                let mut end_region = datapoints_list[i + 1];
                for entry in bigwig_output {
                    match entry {
                        Ok(v) => {
                            println!("start,end,value:{},{},{}", v.start, v.end, v.value);
                            if v.start == v.end {
                                continue;
                            } else {
                                if v.start >= start_region {
                                    // Calculate sum and number for this region
                                    let stop_entry_within_region = cmp::min(v.end, end_region);
                                    datapoints_num[i] += stop_entry_within_region;
                                    datapoints_sum[i] += stop_entry_within_region as f32 * v.value;
                                } else {
                                    println!("Unexpected case where v.start < start_region");
                                    println!("i:{}", i);
                                    println!("start_region:{}", start_region);
                                    println!("end_region:{}", end_region);
                                }
                                let mut iter = 1;
                                while end_region < v.end {
                                    if v.start >= start_region && iter > 1 {
                                        // Calculate sum and number for this region
                                        let stop_entry_within_region = cmp::min(v.end, end_region);
                                        datapoints_num[i] += stop_entry_within_region;
                                        datapoints_sum[i] +=
                                            stop_entry_within_region as f32 * v.value;
                                    }
                                    if end_region < v.end {
                                        // Entry spans into next region, need to increment iterator
                                        i += 1;
                                        start_region = datapoints_list[i];
                                        end_region = datapoints_list[i + 1];
                                    }
                                    if v.start < start_region {
                                        // Should not happen
                                        println!("Unexpected case where v.start < start_region inside while loop");
                                        println!("i:{}", i);
                                        println!("start_region:{}", start_region);
                                        println!("end_region:{}", end_region);
                                    }
                                    iter += 1;
                                }
                                // Check number of regions that entry spans
                                //let mut selected_regions_vec = Vec::<u32>::new();
                                //for i in 0..datapoints_list {
                                //    if i + 1 < datapoints_list.len() {
                                //        if v.start >= datapoints_list[i]
                                //            || datapoints_list[i + 1] < v.end
                                //        {
                                //            selected_regions_vec.push(datapoints_list[i]);
                                //        }
                                //    } else if datapoints_list[i + 1] >= v.end {
                                //        break;
                                //    }
                                //}
                            }
                        }
                        Err(_) => {
                            println!("Possible error:{:?}", entry);
                        }
                    }
                }
            }
            Err(_) => {
                println!("File not found");
            }
        }
    }
    println!("datapoints_sum:{:?}", datapoints_sum);
    println!("datapoints_num:{:?}", datapoints_num);
}

//fn calculate_datapoints(
//    bigwig_output: String,
//    chrom: String,
//    start_pos: u32,
//    stop_pos: u32,
//    data_points: u32,
//) {
//}
