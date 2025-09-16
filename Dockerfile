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

# COMPREHENSIVE MOLVIEW BUILD VERIFICATION & REPAIR
RUN echo "=== COMPREHENSIVE MOLVIEW FILE VERIFICATION & FIX ===" && \
    echo "🔍 Checking all MolView locations..." && \
    echo "📁 Primary source check:" && \
    ls -la /app/public/FinalCropper/public/molview/build/ 2>/dev/null || echo "❌ Primary source missing" && \
    echo "📁 Build target check:" && \
    ls -la /app/FinalCropper/build/molview/build/ 2>/dev/null || echo "❌ Build target missing" && \
    echo "📁 Public target check:" && \
    ls -la /app/FinalCropper/public/molview/build/ 2>/dev/null || echo "❌ Public target missing" && \
    echo "🔧 Creating all required directories..." && \
    mkdir -p /app/FinalCropper/build/molview/build && \
    mkdir -p /app/FinalCropper/public/molview/build && \
    mkdir -p /app/molview/build && \
    mkdir -p /app/public/molview/build && \
    echo "🔄 Copying MolView files to ALL possible locations..." && \
    if [ -d "/app/public/FinalCropper/public/molview" ]; then \
        echo "✅ Copying to FinalCropper/build/molview..." && \
        cp -r /app/public/FinalCropper/public/molview/* /app/FinalCropper/build/molview/ 2>/dev/null && \
        echo "✅ Copying to FinalCropper/public/molview..." && \
        cp -r /app/public/FinalCropper/public/molview/* /app/FinalCropper/public/molview/ 2>/dev/null && \
        echo "✅ Copying to root molview..." && \
        cp -r /app/public/FinalCropper/public/molview/* /app/molview/ 2>/dev/null && \
        echo "✅ Copying to public/molview..." && \
        cp -r /app/public/FinalCropper/public/molview/* /app/public/molview/ 2>/dev/null; \
    fi && \
    echo "🔍 Final verification - checking critical MolView files:" && \
    for location in "/app/public/FinalCropper/public/molview" "/app/FinalCropper/build/molview" "/app/FinalCropper/public/molview" "/app/molview" "/app/public/molview"; do \
        echo "📂 Checking $location:"; \
        ls -la "$location/build/" 2>/dev/null | head -10 || echo "❌ No build directory"; \
        if [ -f "$location/build/molview-app.min.js" ]; then echo "✅ molview-app.min.js found"; else echo "❌ molview-app.min.js missing"; fi; \
        if [ -f "$location/build/molview-app.min.css" ]; then echo "✅ molview-app.min.css found"; else echo "❌ molview-app.min.css missing"; fi; \
        if [ -f "$location/build/molview-base.min.js" ]; then echo "✅ molview-base.min.js found"; else echo "❌ molview-base.min.js missing"; fi; \
        if [ -f "$location/build/molview-datasets.min.js" ]; then echo "✅ molview-datasets.min.js found"; else echo "❌ molview-datasets.min.js missing"; fi; \
    done && \
    echo "🔍 Verifying file sizes (should not be 0 bytes):" && \
    for location in "/app/public/FinalCropper/public/molview" "/app/FinalCropper/build/molview" "/app/FinalCropper/public/molview"; do \
        if [ -d "$location/build" ]; then \
            echo "📏 Checking file sizes in $location/build/"; \
            ls -lah "$location/build/"*.min.* 2>/dev/null || echo "No min files found"; \
        fi; \
    done

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