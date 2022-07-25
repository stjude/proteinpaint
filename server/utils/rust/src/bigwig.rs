/*
 Syntax:
 bigWigSummary syntax:~/proteinpaint/server/utils/bigWigSummary ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw chr17 7568451 7591984 940

 local: cd .. && cargo build --release && time echo ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw,chr17,7568451,7591984,940 | target/release/bigwig

 bigWigSummary syntax:~/proteinpaint/server/utils/bigWigSummary ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw chr17 7575510 7578450 2000

~/proteinpaint/server/utils/bigWigInfo -zooms ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw
 local: cd .. && cargo build --release && time echo ~/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw,chr17,7575510,7578450,2000 | target/release/bigwig

 local: cd .. && cargo build --release && time echo /Users/rpaul1/proteinpaint/hg19/TARGET/DNA/cov-wes/SJALL015634_D1.bw,chr1,47682689,47700849,10 | target/release/bigwig

 url: cd .. && cargo build --release && time echo http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig,chr17,7584491,7585468,100 | target/release/bigwig
 time ~/proteinpaint/server/utils/bigWigSummary http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig chr17 7584491 7585468 100

 url: cd .. && cargo build --release && time echo https://proteinpaint.stjude.org/ppdemo/hg19/bigwig/file.bw,chr17,7568451,7591984,100 | target/release/bigwig
 cd .. && cargo build --release && time echo /Users/rpaul1/proteinpaint/proteinpaint_demo/hg19/bigwig/file.bw,chr17,7579863,7579920,1140 | target/release/bigwig
 cd .. && cargo build --release && time echo /Users/rpaul1/proteinpaint/hg19/PCGP/DNA/cov-wgs/SJOS016_D.bw,chr17,0,81195210,1140 | target/release/bigwig
 ~/proteinpaint/server/utils/bigWigSummary /Users/rpaul1/proteinpaint/hg19/PCGP/DNA/cov-wgs/SJOS016_D.bw chr17 0 81195210 1140

 cd .. && cargo build --release && time echo http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig,chr17,6074169,9086266,1140 | target/release/bigwig (not working)
 ~/proteinpaint/server/utils/bigWigSummary http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeMapability/wgEncodeCrgMapabilityAlign100mer.bigWig chr17 6074169 9086266 1140

*/

/*
Notes:
   The script accepts piped input in this format: {Bigwig_file_path/URL},{chr},{start_region},{stop_region}. See syntax above.

   In case path to file is not correct, the script gives a message "File not found". If the file is found, the aggregated data points are separated by tab character.

   Function cascade:

   main() - Checks if the web url/local file path is correct. If not, it will display "File not found" message and exit. if true, it will collect zoom headers.
     calculate_datapoints() - Calculates range for each region for the number of points required by the user.
         calculate_appropriate_zoom_level() - Calculates approporiate zoom level (or query raw data) depending upon the range being viewed.

         if web_url {
            Some(zoom_level) => use get_zoom_interval()
            None => use get_interval()
         } else local file {
            Some(zoom_level) => use get_zoom_interval()
            None => use get_interval()
         }
*/

use bigtools::bigwig::ZoomHeader;
use bigtools::bigwigread::BigWigRead;
use bigtools::utils::file::remote_file::RemoteFile;
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
    let start_pos: f64 = args[2].parse::<f64>().unwrap(); // Start position
    let stop_pos: f64 = args[3].parse::<f64>().unwrap(); // Stop position

    let difference = stop_pos - start_pos;
    let datapoints: u32 = args[4].replace("\n", "").parse::<u32>().unwrap(); // Number of intervals

    //println!("start_pos:{}", start_pos);
    //println!("stop_pos:{}", stop_pos);
    //println!("difference:{}", difference);
    //println!("datapoints:{}", datapoints);

    let mut file_found = false; // Flag to check if the bigwig file was found. If not found, only "File not found" message is displayed.  false: not found, true: found

    //println!("datapoints_list length:{:?}", datapoints_list);

    let mut is_weburl: bool = false;
    let mut zoom_headers = Vec::<ZoomHeader>::new();
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
                file_found = true;
                is_weburl = true;
                let reader = BigWigRead::from(remote_file2).unwrap();
                zoom_headers = reader.info.zoom_headers;
            }
            Err(_) => {
                println!("File not found");
            }
        }
    } else {
        // Its a local file
        let reader = BigWigRead::from_file_and_attach(&bigwig_file_url);
        //let a = &reader.info.zoom_headers;
        match reader {
            Ok(_) => {
                file_found = true;
                let reader = BigWigRead::from_file_and_attach(&bigwig_file_url).unwrap();
                zoom_headers = reader.info.zoom_headers;
            }
            Err(_) => {
                println!("File not found");
            }
        }
    }
    //println!("zoom_headers:{:?}", zoom_headers);

    if file_found == true {
        //println!("datapoints_sum:{:?}", datapoints_sum);
        //println!("datapoints_num:{:?}", datapoints_num);

        calculate_datapoints(
            zoom_headers,
            &bigwig_file_url,
            is_weburl,
            datapoints,
            difference,
            chrom,
            start_pos as f64,
            stop_pos as f64,
        );
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

#[allow(dead_code)]
fn calculate_appropriate_zoom_level(zoom_headers: Vec<ZoomHeader>, difference: f64) -> Option<u32> {
    let mut reduction_levels = Vec::<u32>::new();
    let mut closest_level = Option::<u32>::None; // Zoom level will be none at base-pair resolution
    let mut unity_added = false;
    let max_entries_parsed_limit = 100000; // Maximum number of entries that should be parsed from bigwig file. A very high number will lead to better accuracy as this will lead to selection of a lower zoom level. In contrast, a lower value will decrease run time at the cost of accuracy.
                                           // Parsing out various zoom levels from bigwig file
    for reduction_level in zoom_headers
        .into_iter()
        .map(|entry| (entry.reduction_level))
        .rev()
    {
        reduction_levels.push(reduction_level as u32);
    }
    if reduction_levels.contains(&1) == false {
        reduction_levels.push(1); // 1 represents single base-pair level
        unity_added = true;
    }
    reduction_levels.reverse();
    //println!("reduction_levels:{:?}", reduction_levels);
    for level in reduction_levels {
        closest_level = Some(level);
        if round::floor(difference as f64 / level as f64, 0) < max_entries_parsed_limit as f64 {
            break;
        }
    }
    if closest_level == Some(1) && unity_added == true {
        closest_level = None;
    }
    //println!("closest_level:{:?}", closest_level);
    closest_level
}

fn calculate_appropriate_zoom_level_ucsc(
    zoom_headers: Vec<ZoomHeader>,
    exact_offset: f64,
) -> Option<u32> {
    let mut reduction_levels = Vec::<u32>::new();
    let mut closest_level = Option::<u32>::None; // Zoom level will be none at base-pair resolution
    let desired_reduction: u32 = round::floor((exact_offset as f64) / 2.0, 0) as u32;
    let mut unity_added = false;
    if desired_reduction > 1 {
        // Parsing out various zoom levels from bigwig file
        for reduction_level in zoom_headers
            .into_iter()
            .map(|entry| (entry.reduction_level))
            .rev()
        {
            reduction_levels.push(reduction_level as u32);
        }
        if reduction_levels.contains(&1) == false {
            reduction_levels.push(1); // 1 represents single base-pair level
            unity_added = true;
        }
        reduction_levels.reverse();
        println!("reduction_levels:{:?}", reduction_levels);
        let mut closest_diff: u64 = 18446744073709551615; // Highest number allowed by u64 type
        for level in reduction_levels {
            let diff: u64 = (desired_reduction as i64 - level as i64).abs() as u64;
            //println!("level:{}", level);
            //println!("diff:{}", diff);
            if diff > 0 && diff < closest_diff {
                closest_diff = diff;
                closest_level = Some(level);
                //println!("closest_diff:{}", closest_diff);
            }
        }
    }
    if closest_level == Some(1) && unity_added == true {
        closest_level = None;
    }
    println!("closest_level:{:?}", closest_level);
    closest_level
}

fn calculate_datapoints(
    zoom_headers: Vec<ZoomHeader>,
    bigwig_file_url: &String,
    is_weburl: bool,
    datapoints: u32,
    difference: f64,
    chrom: String,
    start_pos: f64,
    stop_pos: f64,
) {
    let exact_offset: f64 = difference as f64 / datapoints as f64;
    //println!("exact_offset:{}", exact_offset);
    let mut datapoints_list = Vec::<f64>::new(); // Vector for storing datapoints
    let mut datapoints_sum = vec![0.0 as f64; datapoints as usize]; // Sum of all values within a region
    let mut datapoints_num = vec![0 as f64; datapoints as usize]; // Number of all values within a region

    //let zoom_level = calculate_appropriate_zoom_level(zoom_headers, difference);
    let zoom_level = calculate_appropriate_zoom_level_ucsc(zoom_headers, exact_offset);

    let mut current_pos: f64 = start_pos as f64; // Initializing current_pos to start position
    for _i in 0..datapoints {
        datapoints_list.push(current_pos);
        current_pos = current_pos as f64 + exact_offset as f64;
    }
    datapoints_list.push(stop_pos as f64);
    //println!("datapoints_list:{:?}", datapoints_list);

    if is_weburl == true {
        // Read from a web URL
        let remote_file = RemoteFile::new(&bigwig_file_url);
        let mut reader = BigWigRead::from(remote_file).unwrap();
        match zoom_level {
            Some(level) => {
                // Using some zoom level
                let bigwig_output = reader
                    .get_zoom_interval(&chrom, start_pos as u32, stop_pos as u32, level)
                    .unwrap();
                let mut i = 0;
                let mut start_region = datapoints_list[i];
                let mut end_region = datapoints_list[i + 1];
                for entry in bigwig_output {
                    match entry {
                        Ok(v) => {
                            //println!(
                            //    "start,end,sum,bases_covered:{},{},{},{}",
                            //    v.start, v.end, v.summary.sum, v.summary.bases_covered
                            //);

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
                                        * ((v.summary.sum as f64) / v.summary.bases_covered as f64);
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
                                while end_region < v.end as f64 && end_region != stop_pos {
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
                                            * ((v.summary.sum as f64)
                                                / v.summary.bases_covered as f64);
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
                                        if i + 2 < datapoints_list.len() {
                                            i += 1;
                                            start_region = datapoints_list[i];
                                            end_region = datapoints_list[i + 1];
                                        }
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
            None => {
                // To be used in nucleotide resolution
                let bigwig_output = reader
                    .get_interval(&chrom, start_pos as u32, stop_pos as u32)
                    .unwrap();
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
                                while end_region < v.end as f64 && end_region != stop_pos {
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
                                        if i + 2 < datapoints_list.len() {
                                            i += 1;
                                            start_region = datapoints_list[i];
                                            end_region = datapoints_list[i + 1];
                                        } else {
                                            break;
                                        }
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
        }
    } else {
        // Read from a file
        let mut reader = BigWigRead::from_file_and_attach(&bigwig_file_url).unwrap();
        match zoom_level {
            Some(level) => {
                // Using some zoom level
                let bigwig_output = reader
                    .get_zoom_interval(&chrom, start_pos as u32, stop_pos as u32, level)
                    .unwrap();
                let mut i = 0;
                let mut start_region = datapoints_list[i];
                let mut end_region = datapoints_list[i + 1];
                for entry in bigwig_output {
                    match entry {
                        Ok(v) => {
                            //println!(
                            //    "start,end,sum,bases_covered:{},{},{},{}",
                            //    v.start, v.end, v.summary.sum, v.summary.bases_covered
                            //);

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
                                        * ((v.summary.sum as f64) / v.summary.bases_covered as f64);
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
                                while end_region < v.end as f64 && end_region != stop_pos {
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
                                            * ((v.summary.sum as f64)
                                                / v.summary.bases_covered as f64);
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
                                        if i + 2 < datapoints_list.len() {
                                            i += 1;
                                            start_region = datapoints_list[i];
                                            end_region = datapoints_list[i + 1];
                                        } else {
                                            break;
                                        }
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
            None => {
                // To be used in nucleotide resolution
                let bigwig_output = reader
                    .get_interval(&chrom, start_pos as u32, stop_pos as u32)
                    .unwrap();
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
                                while end_region < v.end as f64 && end_region != stop_pos {
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
                                        if i + 2 < datapoints_list.len() {
                                            i += 1;
                                            start_region = datapoints_list[i];
                                            end_region = datapoints_list[i + 1];
                                        } else {
                                            break;
                                        }
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
        }
    }

    //calculate_datapoints(bigwig_output, chrom, start_pos, stop_pos, data_points);

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
