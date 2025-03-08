# MediaAlign

MediaAlign is a cross-platform desktop application designed to help Plex users fix incorrectly named TV series episodes. It uses audio extraction and analysis to match episodes with their correct metadata from IMDB.

## Features

- Select a directory containing TV series episodes
- Fetch episode metadata from IMDB using series ID
- Extract audio from media files
- Use speech-to-text to analyze audio content
- Match audio content with episode descriptions
- Identify and fix incorrectly named episodes
- Track which episodes were fixed
- Cross-platform GUI built with Electron

## Technologies Used

- **Frontend**: Electron, HTML, CSS, JavaScript
- **Backend**: Node.js
- **Database**: SQLite
- **Audio Processing**: FFmpeg
- **Speech-to-Text**: OpenAI Whisper
- **Text Matching**: Open-source LLM

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- FFmpeg (will be installed via npm dependencies)

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/medialign.git
   cd medialign
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the application:
   ```
   npm start
   ```

## Development

To run the application in development mode with DevTools enabled:

```
npm run dev
```

## Building for Production

To build the application for your current platform:

```
npm run build
```

## License

ISC

## Future Improvements

- Add support for movies
- Implement batch processing
- Add more metadata sources beyond IMDB
- Improve matching algorithm accuracy
- Add support for subtitles analysis 