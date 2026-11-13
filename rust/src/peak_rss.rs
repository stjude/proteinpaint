// Peak resident memory of this process, for the memory reports of the binaries that include this module

/// Peak resident set size so far, in MB, from getrusage
pub fn peak_rss_mb() -> f64 {
    unsafe {
        let mut usage: libc::rusage = std::mem::zeroed();
        libc::getrusage(libc::RUSAGE_SELF, &mut usage);
        // ru_maxrss is bytes on macOS, kilobytes on Linux
        if cfg!(target_os = "macos") {
            usage.ru_maxrss as f64 / 1_048_576.0
        } else {
            usage.ru_maxrss as f64 / 1024.0
        }
    }
}
