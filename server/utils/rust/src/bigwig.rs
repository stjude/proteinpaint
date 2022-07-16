/*
 Syntax:
 bigWigSummary syntax:~/proteinpaint/server/utils/bigWigSummary ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw chr17 7568451 7591984 940

 local: cd .. && cargo build --release && time echo ~/proteinpaint/server/utils/bigWigSummary ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw,chr17,7568451,7591984,940 | target/release/bigwig

 local: cd .. && cargo build --release && time echo /Users/rpaul1/proteinpaint/hg19/TARGET/DNA/cov-wes/SJALL015634_D1.bw,chr1,47682689,47700849,10 | target/release/bigwig

 url: cd .. && cargo build --release && time echo http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig,chr17,7584491,7585468,100 | target/release/bigwig
 time ~/proteinpaint/server/utils/bigWigSummary http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig chr17 7584491 7585468 100

 url: cd .. && cargo build --release && time echo https://proteinpaint.stjude.org/ppdemo/hg19/bigwig/file.bw,chr17,7568451,7591984,100 | target/release/bigwig
*/

/*
Notes:
   The script accepts piped input in this format: {Bigwig_file_path/URL},{chr},{start_region},{stop_region}. See syntax above.

   In case path to file is not correct, the script gives a message "File not found". If the file is found, the aggregated data points are separated by tab character.

   When number of datapoints > view range (stop - start position). number of datapoints is set equal to (stop - start). This helps in case of nucleotide resolution.
*/

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

    //println!("datapoints:{}", datapoints);
    if datapoints > difference {
        // This helps to set the maximum resolution possible to 1bp.
        datapoints = difference;
    }

    let mut file_found = false; // Flag to check if the bigwig file was found. If not found, only "File not found" message is displayed.  false: not found, true: found
    let exact_offset_whole: u32 = round::ceil(difference as f64 / datapoints as f64, 0) as u32;
    //println!("exact_offset_whole:{}", exact_offset_whole);
    let mut datapoints_list = Vec::<u32>::new(); // Vector for storing datapoints
    let mut datapoints_sum = vec![0.0 as f32; datapoints as usize]; // Sum of all values within a region
    let mut datapoints_num = vec![0 as u32; datapoints as usize]; // Number of all values within a region

    let mut current_pos = start_pos; // Initializing current_pos to start position
    let mut prev_pos;
    for _i in 0..datapoints {
        datapoints_list.push(current_pos);
        prev_pos = current_pos;
        current_pos += exact_offset_whole;
        if current_pos >= stop_pos {
            current_pos = round::ceil(((prev_pos as f64 + stop_pos as f64) / 2.0) as f64, 0) as u32;
        }
    }
    datapoints_list.push(stop_pos);
    //println!("datapoints_list:{:?}", datapoints_list);
    //println!("datapoints_list_length:{}", datapoints_list.len());

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
                let bigwig_output = reader.get_interval(&chrom, start_pos, stop_pos).unwrap();
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
                                if (v.start >= start_region && end_region < v.end)
                                    || (v.start >= start_region && v.start < end_region)
                                    || (v.end >= start_region && v.end < end_region)
                                {
                                    // Calculate sum and number for this region
                                    let start_entry_within_region = cmp::max(v.start, start_region);
                                    let stop_entry_within_region = cmp::min(v.end, end_region);
                                    datapoints_num[i] +=
                                        stop_entry_within_region - start_entry_within_region;
                                    datapoints_sum[i] += (stop_entry_within_region
                                        - start_entry_within_region)
                                        as f32
                                        * v.value;
                                }
                                let mut iter = 1;
                                while end_region < v.end {
                                    //println!("iter:{}", iter);
                                    //println!("i:{}", i);
                                    //println!("v.start:{}", v.start);
                                    //println!("v.end:{}", v.end);
                                    //println!("start_region:{}", start_region);
                                    //println!("end_region:{}", end_region);
                                    if (v.start >= start_region && end_region < v.end)
                                        || (v.start >= start_region && v.start < end_region)
                                        || (v.end >= start_region && v.end < end_region)
                                        || iter > 1
                                    {
                                        // Calculate sum and number for this region
                                        let start_entry_within_region =
                                            cmp::max(v.start, start_region);
                                        let stop_entry_within_region = cmp::min(v.end, end_region);
                                        datapoints_num[i] +=
                                            stop_entry_within_region - start_entry_within_region;
                                        datapoints_sum[i] += (stop_entry_within_region
                                            - start_entry_within_region)
                                            as f32
                                            * v.value;
                                        //println!("datapoints_num[i]:{}", datapoints_num[i]);
                                        //println!("datapoints_sum[i]:{}", datapoints_sum[i]);
                                    }
                                    if end_region <= v.end {
                                        // Entry spans into next region, need to increment iterator
                                        if i + 2 < datapoints_list.len() {
                                            i += 1;
                                            start_region = datapoints_list[i];
                                            end_region = datapoints_list[i + 1];
                                        }
                                    }
                                    iter += 1;
                                }
                                if end_region == v.end && v.start < start_region {
                                    //println!("iter:{}", iter);
                                    //println!("i:{}", i);
                                    //println!("v.start:{}", v.start);
                                    //println!("v.end:{}", v.end);
                                    //println!("start_region:{}", start_region);
                                    //println!("end_region:{}", end_region);
                                    if (v.start >= start_region && end_region < v.end)
                                        || (v.start >= start_region && v.start < end_region)
                                        || (v.end >= start_region && v.end < end_region)
                                        || iter > 1
                                    {
                                        // Calculate sum and number for this region
                                        let start_entry_within_region =
                                            cmp::max(v.start, start_region);
                                        let stop_entry_within_region = cmp::min(v.end, end_region);
                                        datapoints_num[i] +=
                                            stop_entry_within_region - start_entry_within_region;
                                        datapoints_sum[i] += (stop_entry_within_region
                                            - start_entry_within_region)
                                            as f32
                                            * v.value;
                                        //println!("datapoints_num[i]:{}", datapoints_num[i]);
                                        //println!("datapoints_sum[i]:{}", datapoints_sum[i]);
                                    }
                                    if end_region <= v.end {
                                        // Entry spans into next region, need to increment iterator
                                        if i + 2 < datapoints_list.len() {
                                            i += 1;
                                            start_region = datapoints_list[i];
                                            end_region = datapoints_list[i + 1];
                                        }
                                    }
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
                let bigwig_output = reader.get_interval(&chrom, start_pos, stop_pos).unwrap();
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
                                if (v.start >= start_region && end_region < v.end)
                                    || (v.start >= start_region && v.start < end_region)
                                    || (v.end >= start_region && v.end < end_region)
                                {
                                    // Calculate sum and number for this region
                                    let start_entry_within_region = cmp::max(v.start, start_region);
                                    let stop_entry_within_region = cmp::min(v.end, end_region);
                                    datapoints_num[i] +=
                                        stop_entry_within_region - start_entry_within_region;
                                    datapoints_sum[i] += (stop_entry_within_region
                                        - start_entry_within_region)
                                        as f32
                                        * v.value;
                                }
                                //else {
                                //    println!("Unexpected case where v.start < start_region");
                                //    println!("i:{}", i);
                                //    println!("start_region:{}", start_region);
                                //    println!("end_region:{}", end_region);
                                //}
                                let mut iter = 1;
                                while end_region < v.end {
                                    //println!("iter:{}", iter);
                                    //println!("i:{}", i);
                                    //println!("v.start:{}", v.start);
                                    //println!("v.end:{}", v.end);
                                    //println!("start_region:{}", start_region);
                                    //println!("end_region:{}", end_region);
                                    if (v.start >= start_region && end_region < v.end)
                                        || (v.start >= start_region && v.start < end_region)
                                        || (v.end >= start_region && v.end < end_region)
                                        || iter > 1
                                    {
                                        // Calculate sum and number for this region
                                        let start_entry_within_region =
                                            cmp::max(v.start, start_region);
                                        let stop_entry_within_region = cmp::min(v.end, end_region);
                                        datapoints_num[i] +=
                                            stop_entry_within_region - start_entry_within_region;
                                        datapoints_sum[i] += (stop_entry_within_region
                                            - start_entry_within_region)
                                            as f32
                                            * v.value;
                                    }
                                    if end_region <= v.end {
                                        // Entry spans into next region, need to increment iterator
                                        if i + 2 < datapoints_list.len() {
                                            i += 1;
                                            start_region = datapoints_list[i];
                                            end_region = datapoints_list[i + 1];
                                        }
                                    }
                                    //if v.start < start_region {
                                    //    // Should not happen
                                    //    println!("Unexpected case where v.start < start_region inside while loop");
                                    //    println!("i:{}", i);
                                    //    println!("start_region:{}", start_region);
                                    //    println!("end_region:{}", end_region);
                                    //}
                                    iter += 1;
                                }
                                if end_region == v.end && v.start < start_region {
                                    //println!("iter:{}", iter);
                                    //println!("i:{}", i);
                                    //println!("v.start:{}", v.start);
                                    //println!("v.end:{}", v.end);
                                    //println!("start_region:{}", start_region);
                                    //println!("end_region:{}", end_region);
                                    if (v.start >= start_region && end_region < v.end)
                                        || (v.start >= start_region && v.start < end_region)
                                        || (v.end >= start_region && v.end < end_region)
                                        || iter > 1
                                    {
                                        // Calculate sum and number for this region
                                        let start_entry_within_region =
                                            cmp::max(v.start, start_region);
                                        let stop_entry_within_region = cmp::min(v.end, end_region);
                                        datapoints_num[i] +=
                                            stop_entry_within_region - start_entry_within_region;
                                        datapoints_sum[i] += (stop_entry_within_region
                                            - start_entry_within_region)
                                            as f32
                                            * v.value;
                                        //println!("datapoints_num[i]:{}", datapoints_num[i]);
                                        //println!("datapoints_sum[i]:{}", datapoints_sum[i]);
                                    }
                                    if end_region <= v.end {
                                        // Entry spans into next region, need to increment iterator
                                        if i + 2 < datapoints_list.len() {
                                            i += 1;
                                            start_region = datapoints_list[i];
                                            end_region = datapoints_list[i + 1];
                                        }
                                    }
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
            if datapoints_num[i] == 0 {
                mean = 0.0;
            } else {
                mean = datapoints_sum[i] / datapoints_num[i] as f32;
            }
            output_vec.push_str(&mean.to_string());
            output_vec.push_str(&"\t".to_string());
        }
        output_vec.pop();
        println!("{}", output_vec);
    }
}
