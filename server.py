from flask import Flask, request, jsonify
import subprocess
from flask_cors import CORS
from flask_caching import Cache
from loguru import logger
import sys
import joblib

# Initialize Flask app and CORS
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure loguru logger with colors
logger.add(
    sys.stderr, 
    format="<green>{time}</green> <level>{message}</level>", 
    level="DEBUG"
)

# Initialize cache
cache = Cache(app, config={'CACHE_TYPE': 'SimpleCache'})

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


@app.route('/yt-dlp-direct', methods=['GET'])
def get_direct_video_url():
    youtube_url = request.args.get('url')
    if not youtube_url:
        logger.error("No URL provided in the request.")
        return jsonify({'error': 'No URL provided'}), 400

    try:
        # Use the full path to yt-dlp
        yt_dlp_path = r"C:\nginx\modules\yt-dlp"

        # Use yt-dlp to extract the direct video URL
        logger.debug(f"Extracting direct video URL for: {youtube_url}")
        result = subprocess.run(
            [yt_dlp_path, '-g', youtube_url],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode != 0:
            logger.error(f"yt-dlp error: {result.stderr.strip()}")
            return jsonify({'error': result.stderr.strip()}), 500

        direct_video_url = result.stdout.strip()
        logger.debug(f"Extracted direct video URL: {direct_video_url}")
        return jsonify({'directVideoURL': direct_video_url})
    except Exception as e:
        logger.exception("An unexpected error occurred while extracting the direct video URL:")
        return jsonify({'error': str(e)}), 500


@app.route('/yt-dlp', methods=['GET'])
def get_video_url():
    youtube_url = request.args.get('url')
    if not youtube_url:
        logger.error("No URL provided in the request.")
        return jsonify({'error': 'No URL provided'}), 400

    try:
        # Use the full path to yt-dlp
        yt_dlp_path = r"C:\nginx\modules\yt-dlp"

        # Use yt-dlp to extract the video URL
        logger.debug(f"Running yt-dlp for URL: {youtube_url}")
        result = subprocess.run(
            [yt_dlp_path, '-g', youtube_url],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode != 0:
            logger.error(f"yt-dlp error: {result.stderr.strip()}")
            return jsonify({'error': result.stderr.strip()}), 500

        video_url = result.stdout.strip()
        logger.debug(f"Extracted video URL: {video_url}")
        return jsonify({'directVideoURL': video_url})
    except Exception as e:
        logger.exception("An unexpected error occurred:")
        return jsonify({'error': str(e)}), 500


@app.route('/yt-dlp-search', methods=['GET'])
def search_video():
    query = request.args.get('query')
    if not query:
        logger.error("No search query provided in the request.")
        return jsonify({'error': 'No search query provided'}), 400

    try:
        yt_dlp_path = r"C:\nginx\modules\yt-dlp"

        # Fetch top 6 search results - added channel info to the output
        result = subprocess.run(
            [yt_dlp_path, f"ytsearch6:{query} song", "--print", "id,title,thumbnail,duration,view_count,channel"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode != 0:
            logger.error(f"yt-dlp search error: {result.stderr.strip()}")
            return jsonify({'error': result.stderr.strip()}), 500

        lines = result.stdout.strip().splitlines()
        search_results = []
        for i in range(0, len(lines), 6):  # Updated to account for 6 fields per result
            if i + 5 < len(lines):  # Ensure we have all fields
                search_results.append({
                    'videoId': lines[i],
                    'title': lines[i + 1],
                    'thumbnail': lines[i + 2],
                    'duration': lines[i + 3],
                    'viewCount': lines[i + 4],
                    'channel': lines[i + 5]  # Added channel name
                })

        logger.debug(f"Final search results: {search_results}")
        return jsonify({'results': search_results})
    except Exception as e:
        logger.exception("An unexpected error occurred during search:")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)