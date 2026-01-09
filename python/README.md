# Installation

## Docker

This is already included in the deps image and other images that use it as a base image.

## Mac

1. To setup python on macOS using Homebrew, first install Homebrew if you haven't already. Then, install Python by running:

```sh
brew install python
```

2. Homebrew's python formula now points to Python 3 by default. Verify that python3 is installed by running:

```sh
python3 --version
```

3. Check if you have a python virtual env
   by running `python3 -V`, if not you can create one by running

```sh
python3 -m venv ~/pppython
source ~/pppython/bin/activate

# check the installed path
which python3
# Gives the absolute path to the python installattion in the virtual environment
```

4. Now you should by able to install all the relevant python modules by installing all modules in the requirement.txt file

```sh
pip3 install -r requirements.txt


5. In order for the `nodejs` server code to use python virtual environment
   that has been set up, you can do one of the following:

- a. set a `serverconfig.python` option that equals the absolute path to your `.venv/bin/python3` installation
- b. call `source path/to/.venv/bin/activate` in the same shell or terminal tab/window before running a package script
  like `npm run dev` , `npm run test:integration`, etc.

6. Once Python development and testing are finished, execute the following command from the proteinpaint/python directory to deactivate the currently active virtual environment:

```sh
source .venv/bin/deactivate
```

This is important to keep the GitHub hook working.
