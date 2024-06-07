#To run python/src/dzi.py on mac, you need to install the following packages:

brew install python

#Homebrew's python formula now points to Python 3 by default. Verify that python3 is installed by running:

python3 --version

#Install vips for managing large images:
brew install vips

#Now in order to install pyvips check if you have a python virtual env
by running python3 -V, if not you can create one by running
python3 -m venv ./.venv
source .venv/bin/activate

#Now you should by able to install pyvips
pip install pyvips

#To test it you can run
python3 src/dzi.py /path/to/file.svs /path/to/images