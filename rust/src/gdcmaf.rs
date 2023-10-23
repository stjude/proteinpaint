use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use serde_json::Value;
use std::fs::File;
use std::path::Path;
use futures::StreamExt;
use std::io;
use std::io::{Read, BufWriter};
use std::sync::mpsc;
use std::collections::HashMap;
use polars::prelude::*;
use std::collections::HashSet;


fn gen_map(d:String) -> HashMap<String,Vec<String>> {
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    let mut header: Vec<String> = Vec::new();
    let lines = d.trim_end().split("\n");
    for line in lines {
        if line.starts_with("#") {
            continue
        } else if line.contains("Hugo_Symbol") {
            header = line.split("\t").map(|s| s.to_string()).collect();
            for k in &header {
                map.insert(k.to_string(),Vec::new());
            }
        } else {
            let maf_cont_lst: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            for (i,x) in maf_cont_lst.iter().enumerate() {
                map.get_mut(&header[i]).map(|val| val.push(x.to_string()));
            }
        }
    }
    map
}

fn map2df(d:&HashMap<String,Vec<String>>) -> DataFrame {
    let mut series_vec: Vec<Series> = Vec::new();

    for (col_name,values) in d.iter() {
        let padded_values: Vec<Option<&str>> = values.iter()
            .map(|s| Some(s as &str))
            .collect();
        let series = Series::new(&col_name.clone(),padded_values);
        series_vec.push(series)
    }
    let df = DataFrame::new(series_vec).unwrap();
    df
}

#[tokio::main]
async fn main() -> Result<(),Box<dyn std::error::Error>> {
    // Accepting the piped input json from jodejs and assign to the variable
    // host: GDC host
    // out_file: save maf to out_file under cachedir
    // url: urls to download single maf files
    let mut buffer = String::new();
    io::stdin().read_line(&mut buffer)?;
    let file_id_lst_js = serde_json::from_str::<Value>(&buffer).expect("Error reading input and serializing to JSON");
    let host = &file_id_lst_js["host"].as_str().unwrap();
    let out_file = &file_id_lst_js["outFile"].as_str().unwrap();
    let mut url: Vec<String> = Vec::new();
    for v in file_id_lst_js["fileIdLst"].as_array().unwrap() {
        url.push(Path::new(&host).join(&v.as_str().unwrap()).display().to_string());
    };

    //downloading maf files parallelly and merge them into single maf file
    let (tx, rx) = mpsc::channel();
    let fetches = futures::stream::iter(
        url.into_iter().map(|url|{
            let txt = tx.clone();
            async move {
                match reqwest::get(&url).await{
                    Ok(resp) => {
                        let content = resp.bytes().await.unwrap();
                        let mut decoder = GzDecoder::new(&content[..]);
                        let mut decompressed_content = Vec::new();
                        decoder.read_to_end(&mut decompressed_content).unwrap();
                        let text = String::from_utf8_lossy(&decompressed_content);
                        txt.send(text.to_string()).unwrap();
                        //println!("{:?}",text);
                    }
                    Err(_) => println!("ERROR downloading {}", url),
                }
            }
        })
    ).buffer_unordered(20).collect::<Vec<()>>();
    fetches.await;
    drop(tx);

    // write downloaded maf into variable received_values
    let mut received_values: Vec<String> = Vec::new();
    for value in rx {
        //println!("{:?}",&value);
        received_values.push(value);
    };

    // convert downloaded maf to polars dataframe and merge 
    let mut maf = HashMap::new();
    let mut df_maf = DataFrame::default();
    for maf_data in received_values {
        if maf.is_empty() {
            maf = gen_map(maf_data);
            df_maf = map2df(&maf);
        } else {
            let maf1 = gen_map(maf_data);
            let df_maf1 = map2df(&maf1);
            let col_name: HashSet<_> = df_maf.get_column_names().into_iter().collect();
            let col_name1: HashSet<_> = df_maf1.get_column_names().into_iter().collect();
            let col_com: Vec<_> = col_name.intersection(&col_name1).collect();
            let df_maf_col_name = df_maf.select(&col_com).unwrap();
            let df_maf1_col_name = df_maf1.select(&col_com).unwrap();
            df_maf = df_maf_col_name.vstack(&df_maf1_col_name).unwrap();
        }
    };
    df_maf = df_maf.sort(&["Chromosome","Start_Position"],vec![false,false],false).unwrap();

    //write dataframe to file in binary
    let file = File::create(out_file).expect("could not create file");
    let buf_writer = BufWriter::new(file);
    let encoder = GzEncoder::new(buf_writer, Default::default());
    CsvWriter::new(encoder)
        .has_header(true)
        .with_delimiter(b'\t')
        .finish(&mut df_maf)
        .expect("failed to write output");
    Ok(())
}

