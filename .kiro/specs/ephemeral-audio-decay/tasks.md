# Implementation Plan

- [x] 1. Set up project structure and dependencies
  - Create Flask project directory with `/audio` and `/metadata` folders
  - Create `requirements.txt` with Flask, NumPy, flask-cors
  - Create basic `app.py` with Flask app initialization
  - _Requirements: 1.4, 9.1_

- [x] 2. Implement WAV file handler for segment operations
  - Create `wav_handler.py` module
  - Write function to read WAV file metadata (sample rate, channels, duration)
  - Write function to read specific segment by index from WAV file
  - Write function to write audio data to specific segment position in WAV file
  - Calculate byte offsets for segment positioning in WAV files
  - _Requirements: 4.5, 9.4_

- [x] 3. Implement degradation engine with sample dropout
  - Create `degradation.py` module
  - Write function to calculate dropout rate from play count (play_count / 100)
  - Write function to apply sample dropout using NumPy random masking
  - Ensure dropout applies to both stereo channels identically
  - _Requirements: 4.2, 4.3, 4.4, 5.5_

- [x] 4. Implement metadata management system
  - Create `metadata.py` module
  - Write function to scan `/audio` directory and initialize metadata for new WAV files
  - Write function to load metadata JSON for a track
  - Write function to increment segment play count atomically
  - Write function to calculate overall degradation percentage
  - Store metadata as JSON files in `/metadata` directory
  - _Requirements: 1.3, 5.1, 7.1, 7.2_

- [x] 5. Implement segment lock manager for concurrent access
  - Create `lock_manager.py` module
  - Implement lock dictionary keyed by (filename, segment_index)
  - Create context manager for acquiring and releasing segment locks
  - Add timeout mechanism (5 seconds) to prevent deadlocks
  - _Requirements: 6.2, 6.3, 6.4, 9.1, 9.2, 9.3_


- [x] 6. Implement audio streaming service with real-time degradation
  - Create `streaming.py` module
  - Write function to calculate segment range from start time
  - Write generator function that yields audio chunks for HTTP streaming
  - Integrate segment locking, degradation, and metadata updates in streaming loop
  - Handle client disconnection gracefully and release locks
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.5, 6.1, 6.5, 10.2, 10.3_

- [x] 7. Create Flask API endpoints
  - Implement GET `/tracks` endpoint to list all WAV files with degradation stats
  - Implement GET `/stream/<filename>` endpoint with chunked transfer encoding
  - Add query parameter support for `start` position in stream endpoint
  - Implement GET `/stats/<filename>` endpoint for detailed degradation data
  - Enable CORS for all endpoints to allow embedding in Eleventy site
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.3, 7.1, 7.2, 7.3_

- [x] 8. Add startup initialization and error handling
  - Scan `/audio` directory on Flask app startup
  - Auto-create metadata for WAV files without existing metadata
  - Add error handling for corrupted WAV files (log and skip)
  - Add error handling for lock timeouts (skip degradation, continue streaming)
  - Add error handling for client disconnections (release locks)
  - _Requirements: 1.3, 9.1, 9.2, 9.3, 9.4, 10.1_

- [x] 9. Create deployment configuration
  - Write `requirements.txt` with all dependencies
  - Create example `.env` file with configuration variables
  - Write README with setup instructions and directory structure
  - Add example deployment config for Railway/Render
  - _Requirements: 1.4, 10.5_

- [x] 10. Create frontend integration example
  - Write example HTML file showing basic audio player integration
  - Add example using Howler.js for enhanced playback control
  - Include JavaScript to fetch and display track list
  - Add optional degradation stats display that updates during playback
  - _Requirements: 2.1, 2.2, 3.1, 7.4_
