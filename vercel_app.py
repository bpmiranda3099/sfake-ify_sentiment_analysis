from flask import Flask, request, jsonify
import joblib
from flask_cors import CORS
from loguru import logger
import sys
import requests

# Initialize Flask app and CORS
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure loguru logger with colors
logger.add(
    sys.stderr, 
    format="<green>{time}</green> <level>{message}</level>", 
    level="DEBUG"
)

# Load the sentiment analysis model and vectorizer
try:
    sentiment_model = joblib.load('best_sentiment_model_rf.pkl')
    tfidf_vectorizer = joblib.load('sentiment_tfidf_vectorizer.pkl')
    logger.info("Successfully loaded sentiment analysis model and vectorizer")
except Exception as e:
    logger.error(f"Error loading sentiment model or vectorizer: {e}")
    sentiment_model = None
    tfidf_vectorizer = None


@app.route('/analyze-sentiment', methods=['POST'])
def analyze_sentiment():
    """Analyze the sentiment of a review using the pre-trained model."""
    data = request.json
    if not data or 'review' not in data:
        return jsonify({'error': 'No review text provided'}), 400

    review_text = data['review']
    rating = data.get('rating', 0)
    
    try:
        # Check if model and vectorizer are loaded
        if sentiment_model is None or tfidf_vectorizer is None:
            return jsonify({'error': 'Sentiment analysis model not available'}), 500

        # Transform the text using the vectorizer
        text_transformed = tfidf_vectorizer.transform([review_text])
        
        # Make prediction
        prediction = sentiment_model.predict(text_transformed)
        
        # Convert prediction to sentiment label using the first prediction
        # Convert NumPy int64 to standard Python int to ensure JSON serialization
        sentiment = int(prediction[0])
        logger.info(f"Sentiment analysis result for review: {sentiment}")
        return jsonify({
            'sentiment': sentiment,
            'review': review_text,
            'rating': rating
        })
    except Exception as e:
        logger.exception(f"Error analyzing sentiment: {e}")
        return jsonify({'error': str(e)}), 500


# Music API integration - Serverless friendly alternative to yt-dlp
@app.route('/music-search', methods=['GET'])
def music_search():
    """Search for music using the Music API."""
    query = request.args.get('query')
    search_engine = request.args.get('searchEngine', 'gaama')  # Default to gaama if not specified
    
    if not query:
        logger.error("No search query provided in the request.")
        return jsonify({'error': 'No search query provided'}), 400
    
    try:
        # Construct the API URL
        api_url = f"https://musicapi.x007.workers.dev/search?q={query}&searchEngine={search_engine}"
        
        # Make the request to the Music API
        logger.debug(f"Searching for music: {query} using {search_engine}")
        response = requests.get(api_url)
        
        # Check if the request was successful
        if response.status_code == 200:
            search_results = response.json()
            logger.debug(f"Found {len(search_results.get('response', []))} music results")
            return jsonify(search_results)
        else:
            logger.error(f"Music API search error: {response.text}")
            return jsonify({'error': f'Music API returned status code {response.status_code}'}), response.status_code
    except Exception as e:
        logger.exception("An unexpected error occurred during music search:")
        return jsonify({'error': str(e)}), 500


@app.route('/music-fetch', methods=['GET'])
def music_fetch():
    """Fetch music stream URL using the Music API."""
    song_id = request.args.get('id')
    
    if not song_id:
        logger.error("No song ID provided in the request.")
        return jsonify({'error': 'No song ID provided'}), 400
    
    try:
        # Construct the API URL
        api_url = f"https://musicapi.x007.workers.dev/fetch?id={song_id}"
        
        # Make the request to the Music API
        logger.debug(f"Fetching music with ID: {song_id}")
        response = requests.get(api_url)
        
        # Check if the request was successful
        if response.status_code == 200:
            fetch_result = response.json()
            logger.debug(f"Successfully fetched music stream URL")
            return jsonify(fetch_result)
        else:
            logger.error(f"Music API fetch error: {response.text}")
            return jsonify({'error': f'Music API returned status code {response.status_code}'}), response.status_code
    except Exception as e:
        logger.exception("An unexpected error occurred while fetching music:")
        return jsonify({'error': str(e)}), 500


@app.route('/music-lyrics', methods=['GET'])
def music_lyrics():
    """Get lyrics for a song using the Music API."""
    song_id = request.args.get('id')
    
    if not song_id:
        logger.error("No song ID provided in the request.")
        return jsonify({'error': 'No song ID provided'}), 400
    
    try:
        # Construct the API URL
        api_url = f"https://musicapi.x007.workers.dev/lyrics?id={song_id}"
        
        # Make the request to the Music API
        logger.debug(f"Fetching lyrics for song ID: {song_id}")
        response = requests.get(api_url)
        
        # Check if the request was successful
        if response.status_code == 200:
            lyrics_result = response.json()
            logger.debug("Successfully fetched lyrics")
            return jsonify(lyrics_result)
        else:
            logger.error(f"Music API lyrics error: {response.text}")
            return jsonify({'error': f'Music API returned status code {response.status_code}'}), response.status_code
    except Exception as e:
        logger.exception("An unexpected error occurred while fetching lyrics:")
        return jsonify({'error': str(e)}), 500


# For Vercel, we need to export the Flask app as "app"
app = app