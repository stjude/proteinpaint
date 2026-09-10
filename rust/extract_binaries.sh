#!/bin/bash

# Assign command line arguments to variables
toml_path="./Cargo.toml"
source_dir="./target/release/"
dest_dir="./extracted_binaries"

# Ensure the destination directory exists
mkdir -p "$dest_dir"

# Read and process the Cargo.toml file to get binary names using awk
keep_files=($(awk '/\[\[bin\]\]/ { getline; if ($0 ~ /name[[:space:]]*=/) { gsub(/.*name[[:space:]]*=[[:space:]]*"|"/, ""); print } }' "$toml_path"))

# Convert array to a space-separated string for easier matching
keep_files=" ${keep_files[*]} "

# Change to the source directory where files are stored
cd "$source_dir" || exit

# Loop over all files and directories in the current directory, including hidden ones
for item in * .*; do
    # Skip special directories . and ..
    if [ "$item" = "." ] || [ "$item" = ".." ]; then
        continue
    fi

    # Check if the item (file or directory) is in the keep_files list
    if [[ $keep_files =~ " $item " ]]; then
        echo "Copying: $item to $dest_dir"
        # Copy the file or directory to the destination directory
        cp -r "$item" "./../../$dest_dir"
    fi
done

# back to the workspace root, so $dest_dir resolves again
cd ../.. || exit 1

: '
Refuse to publish a binary that cannot resolve its shared libraries.

Nothing downstream catches this: pack.sh copies the binaries and chmod +x makes them look runnable,
rust/index.js only checks that target/release is non-empty, and the loader failure then surfaces as
a dead child process on a live request. That is how DEanalysis and dmrcate shipped linked against
libhdf5_serial.so.310 while the runtime image had a different HDF5 soname -- broken for months,
because no gate between here and production ever tried to load them.

Only meaningful while this runs in an image with the same base as the runtime (see the note in
container/rust/Dockerfile). ldd prints "not a dynamic executable" for a static binary, which does
not match and is correctly ignored.
'
unresolved=0
for bin in "$dest_dir"/*; do
    [ -f "$bin" ] && [ -x "$bin" ] || continue
    if ldd "$bin" 2>/dev/null | grep -q "not found"; then
        echo "ERROR: $bin cannot resolve:" >&2
        ldd "$bin" 2>/dev/null | grep "not found" >&2
        unresolved=1
    fi
done

if [ "$unresolved" -ne 0 ]; then
    echo "refusing to publish binaries that cannot load; the build base and the runtime base have drifted" >&2
    exit 1
fi

echo "all extracted binaries resolve their shared libraries"
