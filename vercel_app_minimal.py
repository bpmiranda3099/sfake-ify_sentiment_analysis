from flask import Flask, request, jsonify
import requests
from flask_cors import CORS
import os
import json

# Initialize Flask app and CORS
app = Flask(__name__)
CORS(app)

@app.route('/analyze-sentiment', methods=['POST'])
def analyze_sentiment():
    """Analyze the sentiment of a review using a simple rule-based approach."""
    data = request.json
    if not data or 'review' not in data:
        return jsonify({'error': 'No review text provided'}), 400

    # Get the review text and rating
    review_text = data['review']
    rating = data.get('rating', 0)
    
    # Using a simple rule-based approach for sentiment analysis
    model_used = "rule_based"
    
    # Simple word lists
    positive_words = ['good', 'great', 'excellent', 'amazing', 'love', 'best', 'awesome']
    negative_words = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'poor']
    
    review_lower = review_text.lower()
    
    # Count positive and negative words
    positive_count = sum(1 for word in positive_words if word in review_lower)
    negative_count = sum(1 for word in negative_words if word in review_lower)
    
    # Determine sentiment
    sentiment = 1  # Default to neutral
    if positive_count > negative_count:
        sentiment = 2  # Positive
    elif negative_count > positive_count:
        sentiment = 0  # Negative
        
    # If rating is provided, factor it in
    if rating:
        if rating >= 4:  # 4-5 stars
            sentiment = max(1, sentiment)  # At least neutral
        elif rating <= 2:  # 1-2 stars
            sentiment = min(1, sentiment)  # At most neutral
    
    return jsonify({
        'sentiment': sentiment,
        'review': review_text,
        'rating': rating,
        'model_used': model_used
    })

@app.route('/music-search', methods=['GET'])
def music_search():
    """Search for music using the Music API."""
    query = request.args.get('query')
    
    if not query:
        return jsonify({'error': 'No search query provided'}), 400
    
    try:
        # Construct the API URL
        api_url = f"https://musicapi.x007.workers.dev/search?q={query}"
        
        # Make the request to the Music API
        response = requests.get(api_url)
        
        # Check if the request was successful
        if response.status_code == 200:
            search_results = response.json()
            return jsonify(search_results)
        else:
            return jsonify({'error': f'Music API returned status code {response.status_code}'}), response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/music-fetch', methods=['GET'])
def music_fetch():
    """Fetch music stream URL using the Music API."""
    song_id = request.args.get('id')
    
    if not song_id:
        return jsonify({'error': 'No song ID provided'}), 400
    
    try:
        # Construct the API URL
        api_url = f"https://musicapi.x007.workers.dev/fetch?id={song_id}"
        
        # Make the request to the Music API
        response = requests.get(api_url)
        if response.status_code == 200:
            fetch_result = response.json()
            return jsonify(fetch_result)
        else:
            return jsonify({'error': f'Music API returned status code {response.status_code}'}), response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/music-lyrics', methods=['GET'])
def music_lyrics():
    """Get lyrics for a song using the Music API."""
    song_id = request.args.get('id')
    
    if not song_id:
        return jsonify({'error': 'No song ID provided'}), 400
    
    try:
        # Construct the API URL
        api_url = f"https://musicapi.x007.workers.dev/lyrics?id={song_id}"
        
        # Make the request to the Music API
        response = requests.get(api_url)
        
        # Check if the request was successful
        if response.status_code == 200:
            lyrics_result = response.json()
            return jsonify(lyrics_result)
        else:
            return jsonify({'error': f'Music API returned status code {response.status_code}'}), response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/diagnostics', methods=['GET'])
def diagnostics():
    """Return information about the environment for debugging."""
    environment_info = {
        'python_version': os.sys.version,
        'environment': os.environ.get('VERCEL') == '1',
        'pip_version': os.popen('pip --version').read() if os.name != 'nt' else 'N/A',
        'current_directory': os.getcwd(),
        'directory_contents': os.listdir('.')
    }
    
    return jsonify(environment_info)
