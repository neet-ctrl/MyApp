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

# SMART MOLVIEW FILE COPYING WITH PROPER EXISTENCE VALIDATION
RUN echo "=== INTELLIGENT MOLVIEW DEPLOYMENT ===" && \
    echo "🔍 Scanning for MolView sources..." && \
    \
    # Create all required target directories first
    mkdir -p /app/FinalCropper/public/molview/build && \
    mkdir -p /app/FinalCropper/build/molview/build && \
    mkdir -p /app/molview/build && \
    mkdir -p /app/public/molview/build && \
    \
    # Define possible source directories (absolute paths)
    MOLVIEW_SOURCES="/app/public/FinalCropper/public/molview /app/FinalCropper/build/molview /app/FinalCropper/public/molview" && \
    MOLVIEW_TARGETS="/app/FinalCropper/public/molview /app/FinalCropper/build/molview /app/molview /app/public/molview" && \
    \
    # Smart source detection and copying
    COPY_SUCCESS=0 && \
    for src in $MOLVIEW_SOURCES; do \
        if [ -d "$src" ] && [ "$(find "$src" -name "*.min.js" -type f | head -1)" ]; then \
            echo "✅ Valid MolView source detected: $src" && \
            echo "   📋 Contents: $(ls -1 "$src/build/" 2>/dev/null | grep -E '\.(js|css)$' | wc -l) files" && \
            \
            # Copy to all target locations
            for target in $MOLVIEW_TARGETS; do \
                if [ "$src" != "$target" ]; then \
                    echo "   📁 $src → $target" && \
                    if [ -d "$src/build" ]; then \
                        cp -r "$src/build"/* "$target/build/" 2>/dev/null && echo "     ✓ Build files copied"; \
                    fi && \
                    if [ -d "$src/img" ]; then \
                        cp -r "$src/img" "$target/" 2>/dev/null && echo "     ✓ Images copied"; \
                    fi && \
                    if [ -d "$src/php" ]; then \
                        cp -r "$src/php" "$target/" 2>/dev/null && echo "     ✓ PHP files copied"; \
                    fi && \
                    if [ -d "$src/src" ]; then \
                        cp -r "$src/src" "$target/" 2>/dev/null && echo "     ✓ Source files copied"; \
                    fi && \
                    if [ -f "$src/index.html" ]; then \
                        cp "$src/index.html" "$target/" 2>/dev/null && echo "     ✓ Index copied"; \
                    fi; \
                fi; \
            done && \
            COPY_SUCCESS=1; \
        else \
            echo "❌ Invalid/empty source: $src"; \
        fi; \
    done && \
    \
    # Final verification of critical MolView files
    echo "🔍 Verifying MolView deployment..." && \
    CRITICAL_FILES="molview-base.min.js molview-core.min.js molview-app.min.js molview-embed.min.js" && \
    WORKING_LOCATIONS=0 && \
    for target in $MOLVIEW_TARGETS; do \
        if [ -d "$target/build" ]; then \
            FILES_FOUND=0 && \
            for file in $CRITICAL_FILES; do \
                if [ -f "$target/build/$file" ] && [ -s "$target/build/$file" ]; then \
                    FILES_FOUND=$((FILES_FOUND + 1)); \
                fi; \
            done && \
            if [ $FILES_FOUND -eq 4 ]; then \
                echo "✅ $target: Complete (4/4 files)" && \
                WORKING_LOCATIONS=$((WORKING_LOCATIONS + 1)); \
            else \
                echo "⚠️ $target: Incomplete ($FILES_FOUND/4 files)"; \
            fi; \
        fi; \
    done && \
    \
    # Final deployment status
    if [ $WORKING_LOCATIONS -gt 0 ]; then \
        echo "🎉 SUCCESS: MolView deployed to $WORKING_LOCATIONS location(s)"; \
    else \
        echo "⚠️ WARNING: MolView files not properly deployed - creating minimal fallback"; \
        echo "/* Fallback MolView */" > /app/public/molview/build/molview-base.min.js; \
    fi

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