use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use serde_json::Value;
use std::fs::File;
use std::path::Path;
use futures::StreamExt;
use std::io;
use std::io::{Read,Write};
use std::sync::mpsc;
use std::collections::HashMap;


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

fn get_sorted_indices(lst: &Vec<String>) -> Vec<usize>{
    let mut indices = (0..lst.len()).collect::<Vec<usize>>();
    indices.sort_by(|a,b| {
        lst[*a].split('\t').collect::<Vec<&str>>()[0].cmp(lst[*b].split('\t').collect::<Vec<&str>>()[0])
            .then(lst[*a].split('\t').collect::<Vec<&str>>()[1].cmp(lst[*b].split('\t').collect::<Vec<&str>>()[1]))
        });
    indices
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
        received_values.push(value);
    }

    // store downloaed mafs into one HashMap data sturcture based on the common column names
    let mut maf = HashMap::new();
    for maf_data in received_values {
        if maf.is_empty() {
            maf = gen_map(maf_data);
        } else {
            let maf1 = gen_map(maf_data);
            //println!("{:?}",maf1);
            let mut keys_to_remove_in_maf: Vec<String> = Vec::new();
            for key in maf.keys() {
                if !(maf1.contains_key(key)) {
                    //println!("{}",&key);
                    keys_to_remove_in_maf.push(key.to_string());
                }
            }
            for key in keys_to_remove_in_maf {
                maf.remove(&key);
            }
            let keys_in_maf1: Vec<String> = maf1.keys().cloned().collect();
            for key in keys_in_maf1 {
                if maf.contains_key(&key) {
                    //println!("{}",&key);
                    let key_value = maf1[&key].clone();
                    maf.get_mut(&key).map(|val| val.extend(key_value));
                }
            }
        }
    };


    // generate a Vec with "chrom\tpos" for sorting
    // generated indices after sorting 
    let mut lst_chrom_pos: Vec<String> = Vec::new();
    for (i,v) in maf["Chromosome"].iter().enumerate() {
         lst_chrom_pos.push(v.to_owned()+"\t"+&maf["Start_Position"][i]);
    };
    let idx_sorted = get_sorted_indices(&lst_chrom_pos);

    // write to file
    let file = File::create(out_file).expect("could not create file");
    let mut encoder = GzEncoder::new(file, Default::default());
    let maf_key: Vec<_> = maf.keys().cloned().collect();
    encoder.write_all(&maf_key.join("\t").as_bytes())?;
    encoder.write_all("\n".as_bytes())?;
    for i in idx_sorted.iter() {
        let mut val_lst: Vec<String> = Vec::new();
        for k in &maf_key {
            val_lst.push(maf[k][*i].to_owned());
        };
        let val_out = val_lst.join("\t")+"\n";
        encoder.write_all(val_out.as_bytes())?;
    };
    encoder.finish()?;
    Ok(())
}
