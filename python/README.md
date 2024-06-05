To run python/src/dzi.py on mac, you need to install the following packages:

brew install python

Homebrew's python formula now points to Python 3 by default.
Verify that python3 is installed by running:

python3 --version

Install vips for managing large images:

brew install vips

Init a virtual environment and tun the script as follows:
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install pyvips
python3 src/dzi.py /path/to/file.svs /path/to/output_folder