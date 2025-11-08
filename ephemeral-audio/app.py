"""
Ephemeral Audio Decay System
A Flask server that streams WAV files while progressively degrading them through listener interaction.
"""

import os
from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from metadata import MetadataManager
from lock_manager import SegmentLockManager
from streaming import AudioStreamingService

# Initialize Flask application
app = Flask(__name__)

# Enable CORS for embedding in Eleventy site
cors_origin = os.environ.get('CORS_ORIGIN', '*')
CORS(app, origins=cors_origin)

# Configuration
app.config['AUDIO_DIR'] = os.environ.get('AUDIO_DIR', './audio')
app.config['METADATA_DIR'] = os.environ.get('METADATA_DIR', './metadata')
app.config['SEGMENT_DURATION'] = float(os.environ.get('SEGMENT_DURATION', '0.5'))
app.config['DEGRADATION_RATE'] = float(os.environ.get('DEGRADATION_RATE', '1.0'))

# Ensure directories exist
os.makedirs(app.config['AUDIO_DIR'], exist_ok=True)
os.makedirs(app.config['METADATA_DIR'], exist_ok=True)

# Initialize services
metadata_manager = MetadataManager(
    app.config['AUDIO_DIR'],
    app.config['METADATA_DIR'],
    app.config['SEGMENT_DURATION']
)

lock_manager = SegmentLockManager(timeout=5.0)

streaming_service = AudioStreamingService(
    app.config['AUDIO_DIR'],
    metadata_manager,
    lock_manager,
    app.config['SEGMENT_DURATION'],
    app.config['DEGRADATION_RATE']
)


def initialize_audio_system():
    """
    Initialize the audio system on startup.
    Scans audio directory and creates metadata for new files.
    """
    print("Initializing Ephemeral Audio Decay System...")
    print(f"Audio directory: {app.config['AUDIO_DIR']}")
    print(f"Metadata directory: {app.config['METADATA_DIR']}")
    
    try:
        # Scan audio directory and initialize metadata
        initialized = metadata_manager.scan_and_initialize()
        
        if initialized:
            print(f"Initialized metadata for {len(initialized)} new track(s):")
            for filename in initialized:
                print(f"  - {filename}")
        else:
            print("No new tracks to initialize")
        
        # Get all tracks
        tracks = metadata_manager.get_all_tracks()
        print(f"\nTotal tracks available: {len(tracks)}")
        
        for track in tracks:
            degradation = track.get('overall_degradation', 0)
            print(f"  - {track['filename']} ({degradation:.1f}% degraded)")
    
    except Exception as e:
        print(f"Error during initialization: {e}")
        print("System will continue, but some tracks may not be available")


# Run initialization when app starts
with app.app_context():
    initialize_audio_system()


@app.route('/')
def index():
    """Health check endpoint"""
    return {
        'status': 'running',
        'service': 'Ephemeral Audio Decay System',
        'audio_dir': app.config['AUDIO_DIR'],
        'metadata_dir': app.config['METADATA_DIR'],
        'degradation_rate': app.config['DEGRADATION_RATE']
    }


@app.route('/tracks')
def get_tracks():
    """
    Get list of all available tracks with degradation stats.
    
    Returns:
        JSON array of track metadata
    """
    try:
        tracks = metadata_manager.get_all_tracks()
        
        # Format response
        response = []
        for track in tracks:
            # Calculate degradation with current rate
            degradation = metadata_manager.get_overall_degradation(
                track['filename'],
                app.config['DEGRADATION_RATE']
            )
            response.append({
                'filename': track['filename'],
                'title': track['title'],
                'duration': track['duration'],
                'overall_degradation': degradation,
                'total_streams': track.get('total_streams', 0)
            })
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/stream/<filename>')
def stream_audio(filename):
    """
    Stream audio file with real-time degradation.
    
    Args:
        filename: Name of WAV file to stream
        
    Query Parameters:
        start: Starting position in seconds (default: 0)
        
    Returns:
        Audio stream with chunked transfer encoding
    """
    try:
        # Get start position from query params
        start_seconds = float(request.args.get('start', 0))
        
        # Create streaming generator
        audio_generator = streaming_service.stream_audio(filename, start_seconds)
        
        # Return streaming response
        return Response(
            audio_generator,
            mimetype='audio/wav',
            headers={
                'Content-Disposition': f'inline; filename="{filename}"',
                'Accept-Ranges': 'none',  # Seeking not fully supported
                'Cache-Control': 'no-cache'
            }
        )
    
    except FileNotFoundError:
        return jsonify({'error': 'Audio file not found'}), 404
    
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    
    except Exception as e:
        return jsonify({'error': f'Streaming error: {str(e)}'}), 500


@app.route('/stats/<filename>')
def get_stats(filename):
    """
    Get detailed degradation statistics for a track.
    
    Args:
        filename: Name of WAV file
        
    Returns:
        JSON with detailed segment play counts and degradation data
    """
    try:
        metadata = metadata_manager.get_track_metadata(filename)
        
        if metadata is None:
            return jsonify({'error': 'Track not found'}), 404
        
        # Calculate overall degradation with current rate
        overall_degradation = metadata_manager.get_overall_degradation(
            filename,
            app.config['DEGRADATION_RATE']
        )
        
        # Return detailed stats
        return jsonify({
            'filename': metadata['filename'],
            'title': metadata['title'],
            'duration': metadata['duration'],
            'total_segments': metadata['total_segments'],
            'segment_duration': metadata['segment_duration'],
            'segment_play_counts': metadata['segment_play_counts'],
            'overall_degradation': overall_degradation,
            'total_streams': metadata.get('total_streams', 0),
            'created_at': metadata.get('created_at')
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
