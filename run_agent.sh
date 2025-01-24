rm -Rf vargasjr_dev_agent-*
yes | rm -rf ~/.cache/pypoetry/virtualenvs/*
VERSION=$(curl -s https://api.github.com/repos/dvargas92495/vargasjr-dev/releases/latest | grep '"tag_name":' | cut -d'"' -f4 | sed 's/^v//')
wget https://github.com/dvargas92495/vargasjr-dev/releases/download/v$VERSION/vargasjr_dev_agent-$VERSION.tar.gz
tar -xzf vargasjr_dev_agent-$VERSION.tar.gz
cd vargasjr_dev_agent-$VERSION
cp ../.env .
poetry install
screen -dmS agent-${VERSION//./-} bash -c 'poetry run agent 2> error.log'

# # Useful tools
# 
# ## Switch to a screen session
# screen -r agent
# 
# ## Kill a screen session
# screen -X -S agent quit
# 
# ## List screen sessions
# screen -ls
#
# ## View disk usage in a given directory
# du -h --max-depth=1 ~/.cache/pypoetry/
#
