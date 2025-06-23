#!/bin/bash

source ~/.profile
rm -Rf vargasjr_dev_agent-*
yes | rm -rf ~/.cache/pypoetry/virtualenvs/*

if [ "$AGENT_ENVIRONMENT" = "preview" ] && [ -n "$PR_NUMBER" ]; then
        echo "Detected preview environment for PR $PR_NUMBER"
        
        if [ -z "$GITHUB_TOKEN" ]; then
            echo "Error: GITHUB_TOKEN not set for preview environment"
            exit 1
        fi
        
        ARTIFACT_NAME="dist-pr-$PR_NUMBER"
        REPO="dvargas92495/vargasjr-dev"
        
        ARTIFACT_DATA=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            "https://api.github.com/repos/$REPO/actions/artifacts?name=$ARTIFACT_NAME")
        
        ARTIFACT_ID=$(echo "$ARTIFACT_DATA" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        
        if [ -z "$ARTIFACT_ID" ]; then
            echo "Error: No artifacts found for PR $PR_NUMBER"
            exit 1
        fi
        
        echo "Downloading artifact ID: $ARTIFACT_ID"
        
        DOWNLOAD_URL=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            "https://api.github.com/repos/$REPO/actions/artifacts/$ARTIFACT_ID/zip" \
            -w "%{redirect_url}" -o /dev/null)
        
        if [ -z "$DOWNLOAD_URL" ]; then
            echo "Error: Failed to get download URL for artifact"
            exit 1
        fi
        
        curl -L -o "vargasjr_dev_agent-pr-$PR_NUMBER.zip" "$DOWNLOAD_URL"
        unzip -q "vargasjr_dev_agent-pr-$PR_NUMBER.zip"
        
        TAR_FILE=$(find . -name "vargasjr_dev_agent-*.tar.gz" | head -1)
        if [ -z "$TAR_FILE" ]; then
            echo "Error: No tar.gz file found in artifact"
            exit 1
        fi
        
        tar -xzf "$TAR_FILE"
        AGENT_DIR=$(find . -maxdepth 1 -type d -name "vargasjr_dev_agent-*" | head -1)
        
        if [ -z "$AGENT_DIR" ]; then
            echo "Error: No agent directory found"
            exit 1
        fi
        
        cd "$AGENT_DIR"
        cp ../.env .
        poetry install
        
        if [ -d "browser" ]; then
            echo "Setting up browser service..."
            cd browser
            npm install
            npm run build
            echo "Starting browser service..."
            screen -dmS browser-service bash -c 'npm run start 2> browser-error.log'
            cd ..
        fi
        
        screen -dmS agent-preview bash -c 'poetry run agent 2> error.log'
        
else
    echo "Detected production environment"
    VERSION=$(curl -s https://api.github.com/repos/dvargas92495/vargasjr-dev/releases/latest | grep '"tag_name":' | cut -d'"' -f4 | sed 's/^v//')
    wget https://github.com/dvargas92495/vargasjr-dev/releases/download/v$VERSION/vargasjr_dev_agent-$VERSION.tar.gz
    tar -xzf vargasjr_dev_agent-$VERSION.tar.gz
    cd vargasjr_dev_agent-$VERSION
    cp ../.env .
    poetry install
    
    if [ -d "browser" ]; then
        echo "Setting up browser service..."
        cd browser
        npm install
        npm run build
        echo "Starting browser service..."
        screen -dmS browser-service bash -c 'npm run start 2> browser-error.log'
        cd ..
    fi
    
    screen -dmS agent-${VERSION//./-} bash -c 'poetry run agent 2> error.log'
fi

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
