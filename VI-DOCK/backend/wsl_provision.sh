#!/bin/bash
set -e

echo "Starting WSL Provisioning..."

# Check if miniconda is installed
if [ ! -d "$HOME/miniconda3" ]; then
    echo "Installing Miniconda..."
    wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O miniconda.sh
    bash miniconda.sh -b -p $HOME/miniconda3
    rm miniconda.sh
    echo "Miniconda installed."
else
    echo "Miniconda already installed."
fi

# Activate Conda
source $HOME/miniconda3/bin/activate

# Configure Channels (Avoid defaults to skip TOS)
# Remove defaults if present (and ignore error)
conda config --remove channels defaults || true
conda config --add channels bioconda
conda config --add channels conda-forge
conda config --set channel_priority strict

# Install Engines
echo "Installing rDock (Conda)..."
conda install -y --override-channels -c bioconda -c conda-forge rdock

echo "Installing Gnina (Binary)..."
wget https://github.com/gnina/gnina/releases/download/v1.0.3/gnina -O $HOME/miniconda3/bin/gnina
chmod +x $HOME/miniconda3/bin/gnina

echo "WSL Provisioning Complete!"
echo "rDock is installed at: $(which rbdock)"
echo "Gnina is installed at: $(which gnina)"
