To run python/src/dzi.py on mac, you need to install the following packages:

brew install python
brew install vips

Init a virtual environment and tun the script as follows:
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install pyvips
python3 src/dzi.py /path/to/file.svs /path/to/output_folder