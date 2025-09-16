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

# Copy everything from workspace (including FinalCropper/build)
COPY . .

# CRITICAL FIX: Ensure FinalCropper build directory exists with proper structure
RUN echo "=== FINALCROPPER BUILD VERIFICATION & FIX ===" && \
    echo "Checking FinalCropper structure..." && \
    ls -la /app/FinalCropper/ 2>/dev/null || echo "FinalCropper missing" && \
    ls -la /app/FinalCropper/build/ 2>/dev/null || echo "FinalCropper/build missing" && \
    if [ ! -d "/app/FinalCropper/build" ]; then \
        echo "Creating missing FinalCropper/build directory..." && \
        mkdir -p /app/FinalCropper/build && \
        if [ -d "/app/public/FinalCropper/public" ]; then \
            echo "Copying from public source as fallback..." && \
            cp -r /app/public/FinalCropper/public/* /app/FinalCropper/build/ 2>/dev/null || echo "Source copy failed"; \
        fi; \
    fi && \
    echo "Final structure check:" && \
    ls -la /app/FinalCropper/build/ 2>/dev/null && \
    echo "MolView files check:" && \
    ls -la /app/FinalCropper/build/molview/ 2>/dev/null || echo "No molview directory"

# Verify critical files (debug step)
RUN echo "=== VERIFYING ALL FILES COPIED ===" && \
    ls -la /app/tmp/ 2>/dev/null || echo "tmp missing" && \
    echo "=== Settings file ===" && \
    ls -la /app/config/live_cloning_persistent_settings.json 2>/dev/null || echo "settings missing" && \
    echo "=== Config files ===" && \
    ls -la /app/config/ 2>/dev/null || echo "config missing" && \
    ls -la /app/bot_source/ 2>/dev/null || echo "bot_source missing" && \
    echo "=== FinalCropper BUILD VERIFICATION ===" && \
    ls -la /app/FinalCropper/build/ && \
    cat /app/FinalCropper/build/index.html | head -20 && \
    echo "=== FinalCropper DIRECTORY CHECK ===" && \
    ls -la /app/FinalCropper/ 2>/dev/null || echo "FinalCropper missing" && \
    echo "=== END VERIFICATION ==="

# Set production environment (secrets provided via Railway environment variables)
ENV NODE_ENV=production
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

# Install Python dependencies for bot_source components (if they exist)
RUN if [ -f /app/bot_source/live-cloning/requirements.txt ]; then pip3 install -r /app/bot_source/live-cloning/requirements.txt; fi
RUN if [ -f /app/bot_source/python-copier/requirements.txt ]; then pip3 install -r /app/bot_source/python-copier/requirements.txt; fi

# CRITICAL FIX: Force upgrade Telethon to latest version to support 64-bit user IDs
RUN pip3 install "telethon>=1.41.0" --upgrade --no-cache-dir

# Expose the app port
EXPOSE 5000

# Start the app
CMD ["npm", "run", "dev"]