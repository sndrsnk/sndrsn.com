# Design Document

## Overview

The Ephemeral Audio Decay System is a minimal Python Flask server that streams WAV files from a directory while progressively degrading them through listener interaction. Files are manually placed in an `/audio` directory, and the system automatically serves and degrades them. Each audio file is logically divided into 0.5-second segments that track their own play counts and degrade independently using sample dropout algorithms.

### Technology Stack

- **Backend Framework**: Flask (Python 3.10+)
- **Audio Processing**: NumPy, wave (built-in)
- **File Locking**: threading.Lock (in-memory)
- **Storage**: Local filesystem (`/audio` directory)
- **Frontend**: Embedded audio player (Howler.js or Plyr.js recommended)
- **Deployment**: Railway, Render, or Fly.io

### Key Design Decisions

1. **Manual file management**: Artist drops WAV files into `/audio` directory, no upload interface
2. **WAV format only**: Uncompressed audio allows direct byte-level manipulation
3. **Segment-based tracking**: 0.5-second segments provide granular degradation
4. **In-place file modification**: Degradation is applied directly to source files
5. **Segment-level locking**: Allows concurrent listeners while preventing write conflicts
6. **Linear degradation curve**: 1% dropout per play, reaching 100% at 100 plays
7. **Automatic metadata**: System scans `/audio` directory on startup and creates metadata files

## Architecture

### System Components

```
┌─────────────────┐
│  Web Browser    │
│  (HTML5 Audio)  │
└────────┬────────┘
         │ HTTP Streaming
         ▼
┌─────────────────────────────────────┐
│         Flask Application           │
│  ┌──────────────────────────────┐  │
│  │   Routes & Controllers       │  │
│  ├──────────────────────────────┤  │
│  │   Audio Streaming Service    │  │
│  ├──────────────────────────────┤  │
│  │   Degradation Engine         │  │
│  ├──────────────────────────────┤  │
│  │   Segment Lock Manager       │  │
│  ├──────────────────────────────┤  │
│  │   Metadata Manager           │  │
│  └──────────────────────────────┘  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      Filesystem Storage             │
│  ┌──────────────┐  ┌─────────────┐ │
│  │  WAV Files   │  │  Metadata   │ │
│  │  /audio/     │  │  JSON files │ │
│  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────┘
```


### Request Flow

**Startup Flow:**

1. Flask app starts and scans `/audio` directory for WAV files
2. For each WAV file without metadata, create metadata JSON with all segment play counts at 0
3. Load existing metadata for files that already have it

**Playback Request Flow:**

1. Client requests audio stream via `/stream/<filename>?start=<seconds>`
2. Flask route handler validates file exists in `/audio` directory
3. Audio Streaming Service calculates segment range from start position
4. For each segment:
   - Acquire segment lock
   - Read segment audio data from WAV file
   - Stream data to client (chunked transfer)
   - Increment segment play count in metadata
   - Apply sample dropout based on play count
   - Write degraded data back to file
   - Release segment lock
5. Continue until stream ends or client disconnects

**Embedding in Your Site:**

1. Your Eleventy site includes audio player library (Howler.js or Plyr.js)
2. Audio player points to: `https://your-backend.com/stream/track-name.wav`
3. Player handles playback, seeking, and UI
4. Backend handles streaming and degradation transparently

## Components and Interfaces

### 1. Audio Streaming Service

**Responsibility**: Stream audio data to clients while coordinating degradation

**Key Methods**:
```python
def stream_audio(track_id: str, start_seconds: float) -> Generator[bytes]:
    """
    Stream audio from specified position, applying degradation in real-time
    Yields audio chunks for HTTP streaming
    """

def get_segment_range(start_seconds: float, duration: float) -> List[int]:
    """
    Calculate which segments to stream based on time range
    Returns list of segment indices
    """
```

**Interface with other components**:
- Calls Segment Lock Manager to acquire/release locks
- Calls Degradation Engine to process audio data
- Calls Metadata Manager to update play counts


### 2. Degradation Engine

**Responsibility**: Apply sample dropout algorithm to audio segments

**Key Methods**:
```python
def apply_dropout(audio_samples: np.ndarray, play_count: int) -> np.ndarray:
    """
    Apply sample dropout based on play count
    dropout_rate = play_count / 100
    Randomly zeros samples according to dropout_rate
    Returns modified audio array
    """

def calculate_dropout_rate(play_count: int) -> float:
    """
    Calculate dropout percentage based on play count
    Returns value between 0.0 and 1.0
    """
```

**Algorithm Details**:
- Uses NumPy for efficient array operations
- Generates random mask using `np.random.random()`
- Applies mask to zero out samples: `samples[mask < dropout_rate] = 0`
- Operates on stereo audio (2 channels) by processing both channels identically

### 3. Segment Lock Manager

**Responsibility**: Coordinate concurrent access to audio file segments

**Key Methods**:
```python
class SegmentLock:
    def acquire_lock(track_id: str, segment_index: int, timeout: float = 5.0) -> bool:
        """
        Acquire exclusive lock for a specific segment
        Blocks until lock is available or timeout
        Returns True if acquired, False on timeout
        """
    
    def release_lock(track_id: str, segment_index: int):
        """
        Release lock for a specific segment
        """
    
    def __enter__() / __exit__():
        """
        Context manager support for 'with' statements
        """
```

**Implementation Strategy**:
- Use threading.Lock dictionary keyed by `(track_id, segment_index)`
- Locks are created on-demand and persist in memory
- Timeout prevents deadlocks if process crashes mid-operation
- Context manager ensures locks are always released


### 4. Metadata Manager

**Responsibility**: Track segment play counts and track metadata

**Key Methods**:
```python
def get_track_metadata(track_id: str) -> dict:
    """
    Load metadata including segment play counts
    Returns dict with title, duration, segment_play_counts array
    """

def increment_segment_play_count(track_id: str, segment_index: int):
    """
    Atomically increment play count for a segment
    Thread-safe operation
    """

def get_overall_degradation(track_id: str) -> float:
    """
    Calculate average dropout rate across all segments
    Returns percentage (0-100)
    """

def initialize_track_metadata(track_id: str, duration: float, title: str):
    """
    Create metadata file for new track
    Initializes all segment play counts to 0
    """
```

**Storage Format** (JSON):
```json
{
  "track_id": "unique-id",
  "title": "Track Title",
  "duration": 180.5,
  "segment_duration": 0.5,
  "total_segments": 361,
  "segment_play_counts": [0, 0, 1, 3, 5, ...],
  "created_at": "2025-11-08T10:00:00Z",
  "total_streams": 12
}
```

### 5. WAV File Handler

**Responsibility**: Read and write audio data at specific byte offsets

**Key Methods**:
```python
def read_segment(file_path: str, segment_index: int, segment_duration: float) -> np.ndarray:
    """
    Read audio samples for a specific segment
    Returns NumPy array of audio samples
    """

def write_segment(file_path: str, segment_index: int, audio_data: np.ndarray):
    """
    Write audio samples to a specific segment position
    Seeks to correct byte offset and writes in-place
    """

def get_wav_info(file_path: str) -> dict:
    """
    Extract WAV file parameters (sample rate, channels, duration)
    """
```

**Implementation Notes**:
- Uses Python's `wave` module for header parsing
- Uses `numpy.fromfile()` and `tofile()` for efficient I/O
- Calculates byte offsets: `offset = 44 + (segment_index * samples_per_segment * channels * bytes_per_sample)`
- Assumes 16-bit PCM stereo at 44.1kHz (standard CD quality)


## Data Models

### Track Metadata Model

```python
@dataclass
class TrackMetadata:
    track_id: str
    title: str
    duration: float  # seconds
    segment_duration: float  # 0.5 seconds
    total_segments: int
    segment_play_counts: List[int]
    created_at: datetime
    total_streams: int
    
    def get_overall_degradation(self) -> float:
        """Calculate average degradation percentage"""
        if not self.segment_play_counts:
            return 0.0
        avg_plays = sum(self.segment_play_counts) / len(self.segment_play_counts)
        return min(avg_plays, 100.0)
    
    def get_segment_degradation(self, segment_index: int) -> float:
        """Get degradation percentage for specific segment"""
        play_count = self.segment_play_counts[segment_index]
        return min(play_count, 100.0)
```

### Audio Segment Model

```python
@dataclass
class AudioSegment:
    segment_index: int
    start_time: float  # seconds
    end_time: float  # seconds
    play_count: int
    audio_data: np.ndarray  # Shape: (samples, channels)
    
    @property
    def dropout_rate(self) -> float:
        """Calculate current dropout rate (0.0 to 1.0)"""
        return min(self.play_count / 100.0, 1.0)
```

## API Endpoints

### Public Endpoints

**GET /tracks**
- Returns JSON list of all WAV files in `/audio` directory
- Response includes filename, duration, overall_degradation percentage
- Example: `[{"filename": "track1.wav", "duration": 180.5, "degradation": 23.4}]`

**GET /stream/<filename>**
- Query params: `start` (seconds, default 0)
- Streams audio data with chunked transfer encoding
- Content-Type: audio/wav
- Applies degradation in real-time during streaming
- CORS enabled for embedding in your Eleventy site

**GET /stats/<filename>**
- Returns detailed degradation statistics for a specific track
- Includes per-segment play counts for visualization
- Example: `{"filename": "track1.wav", "segment_play_counts": [0, 1, 3, 5, ...], "overall_degradation": 23.4}`


## Error Handling

### File Access Errors

**Scenario**: WAV file is corrupted or inaccessible
- **Detection**: Exception during wave.open() or file read
- **Response**: Return HTTP 500 with error message, log details
- **Recovery**: Admin must re-upload track or remove corrupted file

**Scenario**: Segment lock timeout (deadlock prevention)
- **Detection**: Lock acquisition exceeds 5-second timeout
- **Response**: Skip degradation for that segment, continue streaming
- **Recovery**: Next play will attempt degradation again

### Concurrent Access Issues

**Scenario**: Multiple processes write to same segment simultaneously
- **Prevention**: Segment locks ensure mutual exclusion
- **Fallback**: If lock fails, stream without degrading (read-only mode)

**Scenario**: Metadata file corruption during concurrent updates
- **Prevention**: Use file locking for metadata writes
- **Recovery**: Rebuild metadata from WAV file analysis if corrupted

### Client Disconnection

**Scenario**: Client disconnects mid-stream
- **Detection**: BrokenPipeError or ConnectionResetError
- **Response**: Release all held locks, stop streaming
- **Data Integrity**: Already-degraded segments remain degraded (intended behavior)

### Invalid File Errors

**Scenario**: Non-WAV file in `/audio` directory
- **Detection**: Exception during wave.open() on startup
- **Response**: Log warning, skip file
- **Recovery**: Remove invalid file or convert to WAV manually

**Scenario**: Disk space exhausted
- **Detection**: OSError during file write
- **Response**: Log error, skip degradation for that segment
- **Recovery**: Free disk space or remove old tracks

## Testing Strategy

### Unit Tests

**Degradation Engine Tests**:
- Test dropout rate calculation (0%, 50%, 100% play counts)
- Verify sample dropout randomness and distribution
- Confirm stereo channel handling
- Test edge cases (empty arrays, single sample)

**Segment Lock Manager Tests**:
- Test lock acquisition and release
- Verify timeout behavior
- Test concurrent lock requests
- Confirm context manager cleanup

**Metadata Manager Tests**:
- Test metadata creation and loading
- Verify play count increments are atomic
- Test overall degradation calculation
- Confirm JSON serialization/deserialization

**WAV File Handler Tests**:
- Test segment reading at various positions
- Verify byte offset calculations
- Test segment writing and verification
- Confirm WAV header parsing


### Integration Tests

**Streaming and Degradation Flow**:
- Place test WAV in `/audio`, verify metadata auto-creation
- Stream entire track, verify all segments degraded
- Stream again, verify cumulative degradation
- Check metadata reflects correct play counts

**Concurrent Access**:
- Simulate multiple simultaneous streams
- Verify no data corruption
- Confirm all play counts are recorded
- Test segment lock contention handling

**Seek Behavior**:
- Stream from middle of track
- Skip forward and backward
- Verify only played segments are degraded
- Confirm play counts match actual playback

### Performance Tests

**Streaming Latency**:
- Measure time from request to first byte
- Target: < 2 seconds for initial response
- Test with various track lengths

**Degradation Processing Time**:
- Measure per-segment degradation duration
- Target: < 100ms per 0.5-second segment
- Test with high play counts (heavy dropout)

**Concurrent Load**:
- Test 10+ simultaneous streams
- Monitor CPU and memory usage
- Verify no degradation in audio quality or latency

**Lock Contention**:
- Measure lock wait times under load
- Verify timeouts don't occur under normal conditions
- Test recovery from timeout scenarios

## Frontend Integration (Your Eleventy Site)

### Recommended Audio Player Libraries

**Option 1: Howler.js** (Recommended)
- Lightweight, simple API
- Good browser compatibility
- Easy seeking support

**Option 2: Plyr.js**
- Beautiful UI out of the box
- Customizable controls
- Accessibility features

### Example Integration

```html
<!-- In your Eleventy template -->
<div id="audio-player">
  <h3>Ephemeral Track</h3>
  <p>Degradation: <span id="degradation">0%</span></p>
  <audio id="player" controls>
    <source src="https://your-backend.com/stream/track1.wav" type="audio/wav">
  </audio>
</div>

<script src="https://cdn.jsdelivr.net/npm/howler@2.2.3/dist/howler.min.js"></script>
<script>
  // Fetch track list
  fetch('https://your-backend.com/tracks')
    .then(r => r.json())
    .then(tracks => {
      // Display tracks with degradation info
      tracks.forEach(track => {
        console.log(`${track.filename}: ${track.degradation}% degraded`);
      });
    });
  
  // Optional: Update degradation display during playback
  setInterval(() => {
    fetch('https://your-backend.com/stats/track1.wav')
      .then(r => r.json())
      .then(stats => {
        document.getElementById('degradation').textContent = 
          stats.overall_degradation.toFixed(1) + '%';
      });
  }, 5000);
</script>
```

### Simple Approach

Just use a standard HTML5 audio element pointing to the backend stream URL. The degradation happens transparently on the server side - no special client-side code needed.

## Deployment Considerations

### Directory Structure

```
/app
  /audio          # Drop WAV files here manually
    track1.wav
    track2.wav
  /metadata       # Auto-generated JSON files
    track1.json
    track2.json
  app.py          # Flask application
  requirements.txt
```

### Environment Variables

```
AUDIO_DIR=./audio
METADATA_DIR=./metadata
SEGMENT_DURATION=0.5
CORS_ORIGIN=https://your-eleventy-site.com
```

### File Storage

- Persistent volume required for audio files
- Estimated storage: 10MB per minute of audio (WAV)
- Manually add/remove WAV files from `/audio` directory
- Metadata files are small (< 1KB per track)

### Scaling Considerations

- Single-server deployment sufficient for < 100 concurrent users
- File locking works within single process/server
- Current design optimized for single-server artistic installation
- No database required - all state in filesystem

### Backup Strategy

- Optional: backup pristine WAV files before first deployment
- Degraded state is intentionally ephemeral (no backup needed)
- Metadata files can be deleted to reset play counts
