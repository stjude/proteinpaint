// Hierarchical clustering of the rows and of the columns of a matrix.
// This gives the same results as dist() and hclust() of R: the distances are computed as in R, and the clustering is
// a port of the Fortran code of hclust() (F. Murtagh's nearest-neighbor list, then hcass2 for the merge and order),
// so that equal distances are merged in the same order. An R build that fuses multiply-adds, such as with gfortran on
// arm64, can break such ties differently, since its last bits differ.

// Usage: echo <in_json> | target/release/hclust > <out_json>

// Input JSON, read from stdin:
// {
//   matrix: [[number|null]], one array per row, null is a missing value
//   row_names: [string], one per row
//   col_names: [string], one per column
//   cluster_method: average | complete | single | ward.D | ward.D2 | mcquitty
//   distance_method: euclidean | maximum | manhattan | canberra
// }

// Output JSON, written to stdout:
// {
//   row: { merge: [{ n1, n2 }], height: [{ height }], order: [{ name }] },
//   col: { merge: [{ n1, n2 }], height: [{ height }], order: [{ name }] }
// }
// merge, height and order are as in the hclust() result: merge[i] is the pair that is merged at step i+1, where a
// negative number -k is the kth row (or column) of the input, and a positive number k is the cluster of step k.
// height[i] is the distance of that merge, and order is the leaf order of the dendrogram.

// Example:
// cd ~/proteinpaint/rust && cargo build --release && json='{"matrix":[[1,2,3],[2,2,4],[8,9,7]],"row_names":["a","b","c"],"col_names":["x","y","z"],"cluster_method":"average","distance_method":"euclidean"}' && echo "$json" | target/release/hclust

use serde::{Deserialize, Serialize};
use std::io::{self, Read};

#[derive(Deserialize)]
struct Input {
    matrix: Vec<Vec<Option<f64>>>,
    row_names: Vec<String>,
    col_names: Vec<String>,
    cluster_method: String,
    distance_method: String,
}

#[derive(Serialize)]
struct Merge {
    n1: i64,
    n2: i64,
}

#[derive(Serialize)]
struct Height {
    height: f64,
}

#[derive(Serialize)]
struct Name<'a> {
    name: &'a str,
}

#[derive(Serialize)]
struct Dendrogram<'a> {
    merge: Vec<Merge>,
    height: Vec<Height>,
    order: Vec<Name<'a>>,
}

#[derive(Serialize)]
struct Output<'a> {
    row: Dendrogram<'a>,
    col: Dendrogram<'a>,
}

#[derive(Clone, Copy)]
enum Distance {
    Euclidean,
    Maximum,
    Manhattan,
    Canberra,
}

// the iOpt codes of hclust.f, of the methods that are supported
#[derive(Clone, Copy, PartialEq)]
enum Method {
    WardD = 1,
    Single = 2,
    Complete = 3,
    Average = 4,
    Mcquitty = 5,
    WardD2 = 8,
}

fn main() {
    let mut input = String::new();
    if let Err(e) = io::stdin().read_to_string(&mut input) {
        eprintln!("cannot read input: {}", e);
        std::process::exit(1);
    }
    match run(&input) {
        Ok(output) => println!("{}", output),
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }
}

fn run(input: &str) -> Result<String, String> {
    let input: Input = serde_json::from_str(input).map_err(|e| format!("invalid input json: {}", e))?;
    let method = match input.cluster_method.as_str() {
        "average" => Method::Average,
        "complete" => Method::Complete,
        "single" => Method::Single,
        "ward.D" => Method::WardD,
        "ward.D2" => Method::WardD2,
        "mcquitty" => Method::Mcquitty,
        m => return Err(format!("invalid cluster_method: {}", m)),
    };
    let distance = match input.distance_method.as_str() {
        "euclidean" => Distance::Euclidean,
        "maximum" => Distance::Maximum,
        "manhattan" => Distance::Manhattan,
        "canberra" => Distance::Canberra,
        m => return Err(format!("invalid distance_method: {}", m)),
    };

    let ncol = input.col_names.len();
    if input.matrix.len() != input.row_names.len() {
        return Err(format!(
            "{} matrix rows but {} row_names",
            input.matrix.len(),
            input.row_names.len()
        ));
    }
    if input.matrix.iter().any(|r| r.len() != ncol) {
        return Err(format!("a matrix row does not have {} values, one per col_names", ncol));
    }
    // a missing value is NaN, as NA is in R
    let rows: Vec<Vec<f64>> = input
        .matrix
        .iter()
        .map(|r| r.iter().map(|v| v.unwrap_or(f64::NAN)).collect())
        .collect();
    let cols: Vec<Vec<f64>> = (0..ncol).map(|j| rows.iter().map(|r| r[j]).collect()).collect();

    let output = Output {
        row: cluster(&rows, &input.row_names, distance, method).map_err(|e| format!("rows: {}", e))?,
        col: cluster(&cols, &input.col_names, distance, method).map_err(|e| format!("columns: {}", e))?,
    };
    serde_json::to_string(&output).map_err(|e| format!("cannot write output: {}", e))
}

fn cluster<'a>(
    vectors: &[Vec<f64>],
    names: &'a [String],
    distance: Distance,
    method: Method,
) -> Result<Dendrogram<'a>, String> {
    let n = vectors.len();
    if n < 2 {
        return Err("must have n >= 2 objects to cluster".to_string());
    }
    let diss = dist(vectors, distance);
    // as R, which does not cluster an NA, NaN or Inf distance
    if diss.iter().any(|d| !d.is_finite()) {
        return Err("a distance is not finite, such as from a pair of vectors with no values to compare".to_string());
    }
    let (ia, ib, crit) = hclust(diss, n, method);
    let (merge, order) = hcass2(n, &ia, &ib);
    Ok(Dendrogram {
        merge: merge.into_iter().map(|(n1, n2)| Merge { n1, n2 }).collect(),
        height: crit.into_iter().map(|height| Height { height }).collect(),
        order: order.into_iter().map(|i| Name { name: &names[i] }).collect(),
    })
}

// the lower triangle of the distance matrix, by column, as from dist() of R: the distance of i and j, where i < j, is
// at j + i * n - (i + 1) * (i + 2) / 2
fn dist(vectors: &[Vec<f64>], distance: Distance) -> Vec<f64> {
    let n = vectors.len();
    let distances_from = |i: usize| -> Vec<f64> {
        (i + 1..n)
            .map(|j| vector_distance(&vectors[i], &vectors[j], distance))
            .collect()
    };
    // a wasm module has no threads
    #[cfg(not(target_family = "wasm"))]
    let lists: Vec<Vec<f64>> = {
        use rayon::prelude::*;
        (0..n).into_par_iter().map(distances_from).collect()
    };
    #[cfg(target_family = "wasm")]
    let lists: Vec<Vec<f64>> = (0..n).map(distances_from).collect();
    lists.concat()
}

// as in src/library/stats/src/distance.c of R: a pair with a missing value is skipped, and the sum of the euclidean,
// manhattan and canberra distances is scaled up by the number of skipped pairs; NaN when no pair is compared
fn vector_distance(x: &[f64], y: &[f64], distance: Distance) -> f64 {
    let nc = x.len();
    let mut count = 0;
    let mut dist = match distance {
        Distance::Maximum => -f64::MAX,
        _ => 0.0,
    };
    for (a, b) in x.iter().zip(y) {
        if a.is_nan() || b.is_nan() {
            continue;
        }
        match distance {
            Distance::Euclidean => {
                let dev = a - b;
                if !dev.is_nan() {
                    dist += dev * dev;
                    count += 1;
                }
            }
            Distance::Maximum => {
                let dev = (a - b).abs();
                if !dev.is_nan() {
                    if dev > dist {
                        dist = dev;
                    }
                    count += 1;
                }
            }
            Distance::Manhattan => {
                let dev = (a - b).abs();
                if !dev.is_nan() {
                    dist += dev;
                    count += 1;
                }
            }
            Distance::Canberra => {
                // a 0/0 term is skipped, as a missing value
                let sum = a.abs() + b.abs();
                let diff = (a - b).abs();
                if sum > f64::MIN_POSITIVE || diff > f64::MIN_POSITIVE {
                    let mut dev = diff / sum;
                    if dev.is_nan() && !diff.is_finite() && diff == sum {
                        dev = 1.0;
                    }
                    if !dev.is_nan() {
                        dist += dev;
                        count += 1;
                    }
                }
            }
        }
    }
    if count == 0 {
        return f64::NAN;
    }
    match distance {
        Distance::Euclidean => {
            if count != nc {
                dist /= count as f64 / nc as f64;
            }
            dist.sqrt()
        }
        Distance::Maximum => dist,
        Distance::Manhattan | Distance::Canberra => {
            if count != nc {
                dist /= count as f64 / nc as f64;
            }
            dist
        }
    }
}

// HCLUST of src/library/stats/src/hclust.f of R, with 0-based indexes: returns the pair of each merge, as the lowest
// index of each of the two clusters, and its distance
fn hclust(mut diss: Vec<f64>, n: usize, method: Method) -> (Vec<usize>, Vec<usize>, Vec<f64>) {
    let ioffst = |i: usize, j: usize| j + i * n - (i + 1) * (i + 2) / 2;
    let inf = 1e300;
    // ward.D2 is the Ward update of the squared distances
    if method == Method::WardD2 {
        diss.iter_mut().for_each(|d| *d *= *d);
    }
    let mut flag = vec![true; n];
    let mut membr = vec![1.0f64; n];
    let mut nn = vec![0usize; n];
    let mut disnn = vec![0.0f64; n];
    let mut ia = Vec::with_capacity(n - 1);
    let mut ib = Vec::with_capacity(n - 1);
    let mut crit = Vec::with_capacity(n - 1);

    // the nearest neighbor of each object, among the objects after it
    let mut jm = 0;
    for i in 0..n - 1 {
        let mut dmin = inf;
        for j in i + 1..n {
            let d = diss[ioffst(i, j)];
            if dmin > d {
                dmin = d;
                jm = j;
            }
        }
        nn[i] = jm;
        disnn[i] = dmin;
    }

    let (mut im, mut jj) = (0, 0);
    for _ in 0..n - 1 {
        // the least distance of the nearest neighbors
        let mut dmin = inf;
        for i in 0..n - 1 {
            if flag[i] && disnn[i] < dmin {
                dmin = disnn[i];
                im = i;
                jm = nn[i];
            }
        }
        let i2 = im.min(jm);
        let j2 = im.max(jm);
        ia.push(i2);
        ib.push(j2);
        crit.push(if method == Method::WardD2 { dmin.sqrt() } else { dmin });
        flag[j2] = false;

        // the distances to the merged cluster, which is i2, by the Lance-Williams update
        let mut dmin = inf;
        let d12 = diss[ioffst(i2, j2)];
        for k in 0..n {
            if !flag[k] || k == i2 {
                continue;
            }
            let ind1 = if i2 < k { ioffst(i2, k) } else { ioffst(k, i2) };
            let ind2 = if j2 < k { ioffst(j2, k) } else { ioffst(k, j2) };
            let (d1, d2) = (diss[ind1], diss[ind2]);
            let (mi, mj, mk) = (membr[i2], membr[j2], membr[k]);
            diss[ind1] = match method {
                Method::WardD | Method::WardD2 => ((mi + mk) * d1 + (mj + mk) * d2 - mk * d12) / (mi + mj + mk),
                Method::Single => d1.min(d2),
                Method::Complete => d1.max(d2),
                Method::Average => (mi * d1 + mj * d2) / (mi + mj),
                Method::Mcquitty => (d1 + d2) / 2.0,
            };
            if i2 < k {
                if diss[ind1] < dmin {
                    dmin = diss[ind1];
                    jj = k;
                }
            } else if diss[ind1] < disnn[k] {
                disnn[k] = diss[ind1];
                nn[k] = i2;
            }
        }
        membr[i2] += membr[j2];
        disnn[i2] = dmin;
        nn[i2] = jj;

        // a new nearest neighbor of each object that had i2 or j2
        for i in 0..n - 1 {
            if flag[i] && (nn[i] == i2 || nn[i] == j2) {
                let mut dmin = inf;
                for j in i + 1..n {
                    if flag[j] {
                        let d = diss[ioffst(i, j)];
                        if d < dmin {
                            dmin = d;
                            jj = j;
                        }
                    }
                }
                nn[i] = jj;
                disnn[i] = dmin;
            }
        }
    }
    (ia, ib, crit)
}

// HCASS2 of hclust.f: the merge pairs in the convention of hclust(), with -k for the kth object and k for the cluster
// of step k, an object before a cluster and the lower of two clusters first, and the leaf order of the dendrogram
fn hcass2(n: usize, ia: &[usize], ib: &[usize]) -> (Vec<(i64, i64)>, Vec<usize>) {
    let mut iia: Vec<i64> = ia.iter().map(|&i| i as i64 + 1).collect();
    let mut iib: Vec<i64> = ib.iter().map(|&i| i as i64 + 1).collect();
    // a cluster is named by the lowest index of its objects, which a later step uses; that index is replaced by the
    // last step before it that merged a cluster with that lowest index
    for i in 0..n.saturating_sub(2) {
        let k = ia[i].min(ib[i]) as i64 + 1;
        for j in i + 1..n - 1 {
            if ia[j] as i64 + 1 == k {
                iia[j] = -(i as i64 + 1);
            }
            if ib[j] as i64 + 1 == k {
                iib[j] = -(i as i64 + 1);
            }
        }
    }
    let merge: Vec<(i64, i64)> = (0..n - 1)
        .map(|i| {
            let (a, b) = (-iia[i], -iib[i]);
            if a > 0 && b < 0 {
                (b, a)
            } else if a > 0 && b > 0 {
                (a.min(b), a.max(b))
            } else {
                (a, b)
            }
        })
        .collect();
    // the leaves from left to right, by expanding each cluster into its pair, from the last merge
    let mut order = Vec::with_capacity(n);
    let mut stack = vec![(n - 1) as i64];
    while let Some(c) = stack.pop() {
        if c < 0 {
            order.push((-c - 1) as usize);
        } else {
            let (a, b) = merge[(c - 1) as usize];
            stack.push(b);
            stack.push(a);
        }
    }
    (merge, order)
}
