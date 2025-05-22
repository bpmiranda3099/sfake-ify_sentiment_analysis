from flask import Flask, request, jsonify
import requests
from flask_cors import CORS
import os
import json

# Download NLTK data during initialization to avoid runtime downloads
def download_nltk_data():
    import nltk
    try:
        print("Downloading NLTK data during app initialization...")
        nltk.download('punkt', quiet=True)
        nltk.download('stopwords', quiet=True)
        print("NLTK data downloaded successfully")
    except Exception as e:
        print(f"Error downloading NLTK data: {str(e)}")

# Download NLTK data at startup
try:
    download_nltk_data()
except Exception as e:
    print(f"Failed to download NLTK data: {str(e)}")

# Initialize Flask app and CORS
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global variables to hold our loaded models
sentiment_model = None
tfidf_vectorizer = None

# Try to load the models on startup
try:
    import joblib
    print("Loading sentiment model and vectorizer...")
    sentiment_model = joblib.load('best_sentiment_model_rf.pkl')
    tfidf_vectorizer = joblib.load('sentiment_tfidf_vectorizer.pkl')
    print("Models loaded successfully")
except Exception as e:
    print(f"Error loading models on startup: {str(e)}")
    print("Will use rule-based approach for sentiment analysis")

@app.route('/music-search', methods=['GET'])
def music_search():
    """Search for music using the Music API."""
    query = request.args.get('query')
    search_engine = request.args.get('searchEngine', 'gaama')  # Default to gaama if not specified
    
    if not query:
        return jsonify({'error': 'No search query provided'}), 400
    
    try:
        # Construct the API URL
        api_url = f"https://musicapi.x007.workers.dev/search?q={query}&searchEngine={search_engine}"
        
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
        
        # Check if the request was successful
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


@app.route('/analyze-sentiment', methods=['POST'])
def analyze_sentiment():
    """Analyze the sentiment of a review using the pre-trained model."""
    global sentiment_model, tfidf_vectorizer
    
    data = request.json
    if not data or 'review' not in data:
        return jsonify({'error': 'No review text provided'}), 400

    # Get the review text and rating
    review_text = data['review']
    rating = data.get('rating', 0)
    
    # Log request details for debugging purposes
    print(f"Sentiment analysis request received - Text length: {len(review_text)}, Rating: {rating}")
    
    # Check if we're running on Vercel
    is_vercel = os.environ.get('VERCEL') == '1'
    
    # First try using the ML model approach only if not on Vercel or models already loaded
    if (not is_vercel or (sentiment_model is not None and tfidf_vectorizer is not None)):
        try:
            # If models aren't loaded yet, try loading them
            if sentiment_model is None or tfidf_vectorizer is None:
                print("Models not loaded yet, attempting to load...")
                import joblib
                sentiment_model = joblib.load('best_sentiment_model_rf.pkl')
                tfidf_vectorizer = joblib.load('sentiment_tfidf_vectorizer.pkl')
                print("Models loaded successfully on first request")
            
            # Import necessary modules for text processing
            import nltk
            from nltk.corpus import stopwords
            from nltk.tokenize import word_tokenize
            
            # Preprocess the text (similar to what was done in training)
            stop_words = set(stopwords.words('english'))
            
            # Process text similar to training pipeline
            processed_text = ' '.join([word for word in word_tokenize(review_text.lower()) 
                                    if word.isalnum() and word not in stop_words])
            
            print(f"Text preprocessing complete. Processed text length: {len(processed_text)}")
            
            # Transform the text using the vectorizer
            text_transformed = tfidf_vectorizer.transform([processed_text])
            
            # Make prediction
            prediction = sentiment_model.predict(text_transformed)
            
            # Convert NumPy int64 to standard Python int to ensure JSON serialization
            sentiment = int(prediction[0])
            
            print(f"ML model prediction: {sentiment}")
            
            model_used = "machine_learning"
            
        except Exception as e:
            # Log detailed error for debugging
            print(f"Error using ML model: {str(e)}. Traceback: {e.__class__.__name__}")
            print("Falling back to rule-based approach...")
            
            # Use rule-based approach as fallback
            model_used, sentiment = use_rule_based_sentiment(review_text, rating)
    else:
        # Use rule-based approach directly for Vercel
        print("Using rule-based approach directly (running on Vercel or models not available)")
        model_used, sentiment = use_rule_based_sentiment(review_text, rating)
    
    return jsonify({
        'sentiment': sentiment,
        'review': review_text,
        'rating': rating,
        'model_used': model_used
    })

def use_rule_based_sentiment(review_text, rating=0):
    """Rule-based sentiment analysis for when ML models aren't available."""
    # Enhanced rule-based sentiment analysis
    model_used = "rule_based"
    
    # More comprehensive word lists
    positive_words = [
        'good', 'great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'fantastic',
        'wonderful', 'outstanding', 'brilliant', 'superb', 'enjoy', 'perfect', 'top',
        'favorite', 'happy', 'pleased', 'recommend', 'useful', 'helpful', 'impressive'
    ]
    
    negative_words = [
        'bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'poor', 'disappointing',
        'useless', 'annoying', 'frustrating', 'waste', 'problem', 'difficult', 'fail',
        'failure', 'broken', 'issue', 'problem', 'worthless', 'mediocre', 'misleading'
    ]
    
    review_lower = review_text.lower()
    review_words = review_lower.split()
    
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
            sentiment = max(1, sentiment)  # At least neutral, possibly positive
        elif rating <= 2:  # 1-2 stars
            sentiment = min(1, sentiment)  # At most neutral, possibly negative
    
    print(f"Rule-based prediction: {sentiment} (Pos: {positive_count}, Neg: {negative_count})")
    return model_used, sentiment

# Add a diagnostic endpoint to check environment
@app.route('/diagnostics', methods=['GET'])
def diagnostics():
    """Return information about the environment and models for debugging."""
    environment_info = {
        'python_version': os.sys.version,
        'environment_variables': {k: v for k, v in os.environ.items() if not k.startswith('AWS') and not k.startswith('SECRET')},
        'models_loaded': {
            'sentiment_model': sentiment_model is not None,
            'tfidf_vectorizer': tfidf_vectorizer is not None
        },
        'file_exists': {
            'model_file': os.path.exists('best_sentiment_model_rf.pkl'),
            'vectorizer_file': os.path.exists('sentiment_tfidf_vectorizer.pkl')
        },
        'pip_version': os.popen('pip --version').read(),
        'installed_packages': os.popen('pip freeze').read(),
        'is_vercel': os.environ.get('VERCEL') == '1',
        'current_directory': os.getcwd(),
        'directory_contents': os.listdir('.')
    }
    
    return jsonify(environment_info)