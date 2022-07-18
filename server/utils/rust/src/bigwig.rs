/*
 Syntax:
 bigWigSummary syntax:~/proteinpaint/server/utils/bigWigSummary ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw chr17 7568451 7591984 940

 local: cd .. && cargo build --release && time echo ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw,chr17,7568451,7591984,940 | target/release/bigwig

 bigWigSummary syntax:~/proteinpaint/server/utils/bigWigSummary ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw chr17 7575510 7578450 2000
 local: cd .. && cargo build --release && time echo ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw,chr17,7575510,7578450,2000 | target/release/bigwig

 local: cd .. && cargo build --release && time echo /Users/rpaul1/proteinpaint/hg19/TARGET/DNA/cov-wes/SJALL015634_D1.bw,chr1,47682689,47700849,10 | target/release/bigwig

 url: cd .. && cargo build --release && time echo http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig,chr17,7584491,7585468,100 | target/release/bigwig
 time ~/proteinpaint/server/utils/bigWigSummary http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig chr17 7584491 7585468 100

 url: cd .. && cargo build --release && time echo https://proteinpaint.stjude.org/ppdemo/hg19/bigwig/file.bw,chr17,7568451,7591984,100 | target/release/bigwig
*/

/*
Notes:
   The script accepts piped input in this format: {Bigwig_file_path/URL},{chr},{start_region},{stop_region}. See syntax above.

   In case path to file is not correct, the script gives a message "File not found". If the file is found, the aggregated data points are separated by tab character.
*/

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
    let start_pos: f64 = args[2].parse::<f64>().unwrap(); // Start position
    let stop_pos: f64 = args[3].parse::<f64>().unwrap(); // Stop position

    let difference = stop_pos - start_pos;
    let datapoints: u32 = args[4].replace("\n", "").parse::<u32>().unwrap(); // Number of intervals

    //println!("start_pos:{}", start_pos);
    //println!("stop_pos:{}", stop_pos);
    //println!("difference:{}", difference);
    //println!("datapoints:{}", datapoints);

    let mut file_found = false; // Flag to check if the bigwig file was found. If not found, only "File not found" message is displayed.  false: not found, true: found
    let exact_offset_whole: f64 = difference as f64 / datapoints as f64;
    //println!("exact_offset_whole:{}", exact_offset_whole);
    let mut datapoints_list = Vec::<f64>::new(); // Vector for storing datapoints
    let mut datapoints_sum = vec![0.0 as f64; datapoints as usize]; // Sum of all values within a region
    let mut datapoints_num = vec![0 as f64; datapoints as usize]; // Number of all values within a region

    let mut current_pos: f64 = start_pos as f64; // Initializing current_pos to start position
    for _i in 0..datapoints {
        datapoints_list.push(current_pos);
        current_pos = current_pos as f64 + exact_offset_whole as f64;
    }
    datapoints_list.push(stop_pos as f64);
    //println!("datapoints_list length:{:?}", datapoints_list);

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
                //println!("File found");
                file_found = true;
                let mut reader = BigWigRead::from(remote_file2).unwrap();
                let bigwig_output = reader
                    .get_interval(&chrom, start_pos as u32, stop_pos as u32)
                    .unwrap();
                let mut i = 0;
                let mut start_region = datapoints_list[i];
                let mut end_region = datapoints_list[i + 1];
                for entry in bigwig_output {
                    //println!("{:?}", entry);
                    match entry {
                        Ok(v) => {
                            //println!("start,end,value:{},{},{}", v.start, v.end, v.value);
                            if v.start == v.end {
                                continue;
                            } else {
                                if (v.start as f64 <= start_region && end_region < v.end as f64)
                                    || (v.start as f64 >= start_region
                                        && (v.start as f64) < end_region)
                                    || (v.end as f64 >= start_region && (v.end as f64) < end_region)
                                    || (start_region >= v.start as f64
                                        && (v.end as f64) < end_region)
                                {
                                    // Calculate sum and number for this region
                                    //println!("i:{}", i);
                                    //println!("v.start:{}", v.start);
                                    //println!("v.end:{}", v.end);
                                    //println!("start_region:{}", start_region);
                                    //println!("end_region:{}", end_region);
                                    let start_entry_within_region =
                                        determine_max(v.start as f64, start_region);
                                    let stop_entry_within_region =
                                        determine_min(v.end as f64, end_region);
                                    datapoints_num[i] += (stop_entry_within_region
                                        - start_entry_within_region)
                                        as f64;
                                    datapoints_sum[i] += (stop_entry_within_region
                                        - start_entry_within_region)
                                        as f64
                                        * v.value as f64;
                                }
                                let mut iter = 1;
                                while end_region < v.end as f64 {
                                    //println!("iter:{}", iter);
                                    //println!("i:{}", i);
                                    //println!("v.start:{}", v.start);
                                    //println!("v.end:{}", v.end);
                                    //println!("start_region:{}", start_region);
                                    //println!("end_region:{}", end_region);
                                    if ((v.start as f64 <= start_region
                                        && end_region < v.end as f64)
                                        || (v.start as f64 >= start_region
                                            && (v.start as f64) < end_region)
                                        || (v.end as f64 >= start_region
                                            && (v.end as f64) < end_region)
                                        || (start_region >= v.start as f64
                                            && (v.end as f64) < end_region))
                                        && iter > 1
                                    {
                                        // Calculate sum and number for this region
                                        let start_entry_within_region =
                                            determine_max(v.start as f64, start_region);
                                        let stop_entry_within_region =
                                            determine_min(v.end as f64, end_region);
                                        datapoints_num[i] += (stop_entry_within_region
                                            - start_entry_within_region)
                                            as f64;
                                        datapoints_sum[i] += (stop_entry_within_region
                                            - start_entry_within_region)
                                            as f64
                                            * v.value as f64;
                                    }
                                    if end_region <= v.end as f64 {
                                        // Entry spans into next region, need to increment iterator and start and end region
                                        i += 1;
                                        start_region = datapoints_list[i];
                                        end_region = datapoints_list[i + 1];
                                    }
                                    iter += 1;
                                }
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
                file_found = true;
                let mut reader = BigWigRead::from_file_and_attach(&bigwig_file_url).unwrap();
                let bigwig_output = reader
                    .get_interval(&chrom, start_pos as u32, stop_pos as u32)
                    .unwrap();
                //calculate_datapoints(bigwig_output, chrom, start_pos, stop_pos, data_points);

                let mut i = 0;
                let mut start_region = datapoints_list[i];
                let mut end_region = datapoints_list[i + 1];
                for entry in bigwig_output {
                    match entry {
                        Ok(v) => {
                            //println!("start,end,value:{},{},{}", v.start, v.end, v.value);
                            if v.start == v.end {
                                continue;
                            } else {
                                if (v.start as f64 <= start_region && end_region < v.end as f64)
                                    || (v.start as f64 >= start_region
                                        && (v.start as f64) < end_region)
                                    || (v.end as f64 >= start_region && (v.end as f64) < end_region)
                                    || (start_region >= v.start as f64
                                        && (v.end as f64) < end_region)
                                {
                                    // Calculate sum and number for this region
                                    //println!("i:{}", i);
                                    //println!("v.start:{}", v.start);
                                    //println!("v.end:{}", v.end);
                                    //println!("start_region:{}", start_region);
                                    //println!("end_region:{}", end_region);
                                    let start_entry_within_region =
                                        determine_max(v.start as f64, start_region);
                                    let stop_entry_within_region =
                                        determine_min(v.end as f64, end_region);
                                    datapoints_num[i] += (stop_entry_within_region
                                        - start_entry_within_region)
                                        as f64;
                                    datapoints_sum[i] += (stop_entry_within_region
                                        - start_entry_within_region)
                                        as f64
                                        * v.value as f64;
                                    //println!(
                                    //    "start_entry_within_region:{}",
                                    //    start_entry_within_region
                                    //);
                                    //println!(
                                    //    "stop_entry_within_region:{}",
                                    //    stop_entry_within_region
                                    //);
                                    //println!("datapoints_num[i]:{}", datapoints_num[i]);
                                    //println!("datapoints_sum[i]:{}", datapoints_sum[i]);
                                }
                                let mut iter = 1;
                                while end_region < v.end as f64 {
                                    //println!("iter:{}", iter);
                                    //println!("i:{}", i);
                                    //println!("v.start:{}", v.start);
                                    //println!("v.end:{}", v.end);
                                    //println!("start_region:{}", start_region);
                                    //println!("end_region:{}", end_region);
                                    if ((v.start as f64 <= start_region
                                        && end_region < v.end as f64)
                                        || (v.start as f64 >= start_region
                                            && (v.start as f64) < end_region)
                                        || (v.end as f64 >= start_region
                                            && (v.end as f64) < end_region)
                                        || (start_region >= v.start as f64
                                            && (v.end as f64) < end_region))
                                        && iter > 1
                                    {
                                        // Calculate sum and number for this region
                                        //println!("Hello");
                                        let start_entry_within_region =
                                            determine_max(v.start as f64, start_region);
                                        let stop_entry_within_region =
                                            determine_min(v.end as f64, end_region);
                                        datapoints_num[i] += (stop_entry_within_region
                                            - start_entry_within_region)
                                            as f64;
                                        datapoints_sum[i] += (stop_entry_within_region
                                            - start_entry_within_region)
                                            as f64
                                            * v.value as f64;
                                        //println!(
                                        //    "start_entry_within_region inside:{}",
                                        //    start_entry_within_region
                                        //);
                                        //println!(
                                        //    "stop_entry_within_region inside:{}",
                                        //    stop_entry_within_region
                                        //);
                                        //println!("datapoints_num inside[i]:{}", datapoints_num[i]);
                                        //println!("datapoints_sum inside[i]:{}", datapoints_sum[i]);
                                    }
                                    if end_region <= v.end as f64 {
                                        // Entry spans into next region, need to increment iterator
                                        i += 1;
                                        start_region = datapoints_list[i];
                                        end_region = datapoints_list[i + 1];
                                    }
                                    iter += 1;
                                }
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

    if file_found == true {
        //println!("datapoints_sum:{:?}", datapoints_sum);
        //println!("datapoints_num:{:?}", datapoints_num);
        let mut output_vec: String = "".to_string();
        for i in 0..datapoints_num.len() {
            let mean;
            if datapoints_num[i] == 0.0 {
                mean = 0.0;
            } else {
                mean = datapoints_sum[i] / datapoints_num[i] as f64;
            }
            output_vec.push_str(&mean.to_string());
            output_vec.push_str(&"\t".to_string());
        }
        output_vec.pop();
        println!("{}", output_vec);
    }
}

fn determine_max(n1: f64, n2: f64) -> f64 {
    if n1 >= n2 {
        n1
    } else {
        n2
    }
}

fn determine_min(n1: f64, n2: f64) -> f64 {
    if n1 < n2 {
        n1
    } else {
        n2
    }
}
