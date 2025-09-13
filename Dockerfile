# Base image with Node.js
FROM node:20-bullseye-slim

# Install Python3, pip, FFmpeg, and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Node.js dependencies and install
COPY package*.json ./
RUN npm install

# Fix Browserslist outdated warning
RUN npx update-browserslist-db@latest --force

# Copy Python dependencies and install
COPY requirements.txt ./
RUN pip3 install -r requirements.txt

# Copy EVERYTHING from workspace (primary copy first)
COPY . .

# Explicitly copy required subfolders/files to ensure paths match env
COPY tmp/ /app/tmp/
COPY config/ /app/config/
COPY bot_source/ /app/bot_source/
COPY sessions/ /app/sessions/
COPY downloads/ /app/downloads/
COPY logs/ /app/logs/
COPY bottorrent.session /app/bottorrent.session
COPY tmp/live_cloning_persistent_settings.json /app/tmp/live_cloning_persistent_settings.json

# Verify critical files (debug step)
RUN echo "=== VERIFYING ALL FILES COPIED ===" && \
    ls -la /app/tmp/ && \
    echo "=== Settings file ===" && \
    ls -la /app/tmp/live_cloning_persistent_settings.json && \
    echo "=== Config files ===" && \
    ls -la /app/config/ 2>/dev/null || echo "config missing" && \
    ls -la /app/bot_source/ 2>/dev/null || echo "bot_source missing" && \
    echo "=== END VERIFICATION ==="

# Set production environment with all hardcoded values from workspace
ENV NODE_ENV=production
ENV TG_API_ID=28403662
ENV TG_API_HASH=079509d4ac7f209a1a58facd00d6ff5a
ENV TG_BOT_TOKEN=8154976061:AAGrNr6OcdMhFNhV5bCkpGfQAh0FYeJO1gE
ENV TG_AUTHORIZED_USER_ID=6956029558
ENV API_ID=28403662
ENV API_HASH=079509d4ac7f209a1a58facd00d6ff5a
ENV BOT_TOKEN=8154976061:AAGrNr6OcdMhFNhV5bCkpGfQAh0FYeJO1gE
ENV SESSION=/app/bottorrent.session
ENV TG_SESSION=/app/bottorrent.session
ENV BOT_SESSION=/app/bottorrent.session
ENV TG_DOWNLOAD_PATH=/app/downloads
ENV PATH_CONFIG=/app/config/config.ini
ENV PATH_PENDING_MESSAGES=/app/config/pending_messages.json
ENV PATH_DOWNLOAD_FILES=/app/config/download_files.json
ENV YOUTUBE_AUDIO_FOLDER=/app/downloads/youtube/audio
ENV YOUTUBE_VIDEO_FOLDER=/app/downloads/youtube/videos
ENV ENABLED_UNZIP=true
ENV ENABLED_UNRAR=true
ENV ENABLED_7Z=true
ENV ENABLED_YOUTUBE=true
ENV TG_PROGRESS_DOWNLOAD=true
ENV TG_MAX_PARALLEL=4
ENV TG_DL_TIMEOUT=3600
ENV APP_LANGUAGE=en_EN
ENV FALLBACK_PORT=5000

# Create exact folder structure as workspace
RUN mkdir -p /app/downloads/completed \
             /app/downloads/youtube/audio \
             /app/downloads/youtube/videos \
             /app/downloads/tmp \
             /app/downloads/links \
             /app/sessions \
             /app/logs \
             /app/tmp/config \
             /app/tmp/downloads/tmp \
             /app/config \
             /app/config/locale \
             /app/bot_source/live-cloning \
             /app/bot_source/live-cloning/plugins \
             /app/bot_source/live-cloning/plugins/jsons \
             /app/bot_source/python-copier \
             /app/Zip \
    && chmod -R 777 /app/downloads \
    && chmod -R 777 /app/sessions \
    && chmod -R 777 /app/logs \
    && chmod -R 777 /app/tmp \
    && chmod -R 777 /app/config \
    && chmod -R 777 /app/bot_source \
    && chmod -R 777 /app/Zip

# Install Python dependencies for bot_source components
RUN if [ -f /app/bot_source/live-cloning/requirements.txt ]; then pip3 install -r /app/bot_source/live-cloning/requirements.txt; fi
RUN if [ -f /app/bot_source/python-copier/requirements.txt ]; then pip3 install -r /app/bot_source/python-copier/requirements.txt; fi

# Expose the app port
EXPOSE 5000

# Start the app exactly like workspace
CMD ["npm", "run", "dev"]