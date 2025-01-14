rm -Rf vargasjr_dev_agent-*
VERSION=$(curl -s https://api.github.com/repos/dvargas92495/vargasjr-dev/releases/latest | grep '"tag_name":' | cut -d'"' -f4 | sed 's/^v//')
wget https://github.com/dvargas92495/vargasjr-dev/releases/download/v$VERSION/vargasjr_dev_agent-$VERSION.tar.gz
tar -xzf vargasjr_dev_agent-$VERSION.tar.gz
cd vargasjr_dev_agent-$VERSION
cp ../.env .
poetry install
screen -dmS agent bash -c 'poetry run agent 2> error.log'
