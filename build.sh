#!/bin/bash
echo "Starting Vercel build process..."

# Set pip flags for more compatibility
export PIP_DEFAULT_TIMEOUT=100
export PIP_DISABLE_PIP_VERSION_CHECK=1
export PIP_NO_CACHE_DIR=1

# Upgrade pip first
pip install -U pip

# Install dependencies - try simpler versions without version constraints first
pip install flask flask-cors requests

# Install ML dependencies with specific compatible versions
pip install joblib==1.1.0
pip install scikit-learn==1.0.2
pip install nltk==3.7

# Only install numpy if needed (scikit-learn might bring its own compatible version)
pip install --no-deps numpy==1.22.4

# Download NLTK data
python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')"

echo "Installation completed"
