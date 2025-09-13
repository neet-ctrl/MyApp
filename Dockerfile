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

# Copy the entire workspace exactly as it is
COPY . .

# Set production environment with all hardcoded values from workspace
ENV NODE_ENV=production
ENV TG_API_ID=28403662
ENV TG_API_HASH=079509d4ac7f209a1a58facd00d6ff5a
ENV TG_BOT_TOKEN=8154976061:AAGrNr6OcdMhFNhV5bCkpGfQAh0FYeJO1gE
ENV TG_AUTHORIZED_USER_ID=6956029558
ENV API_ID=28403662
ENV API_HASH=079509d4ac7f209a1a58facd00d6ff5a
ENV BOT_TOKEN=8154976061:AAGrNr6OcdMhFNhV5bCkpGfQAh0FYeJO1gE
ENV SESSION=/app/bottorrent
ENV TG_SESSION=/app/bottorrent
ENV BOT_SESSION=/app/bottorrent
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

# Create exact folder structure as workspace - NO volumes needed
RUN mkdir -p /app/downloads/completed \
             /app/downloads/youtube/audio \
             /app/downloads/youtube/videos \
             /app/sessions \
             /app/logs \
             /app/tmp/config \
             /app/tmp/downloads/tmp \
             /app/config \
             /app/bot_source/live-cloning \
             /app/bot_source/python-copier \
    && chmod -R 777 /app/downloads \
    && chmod -R 777 /app/sessions \
    && chmod -R 777 /app/logs \
    && chmod -R 777 /app/tmp \
    && chmod -R 777 /app/config \
    && chmod -R 777 /app/bot_source

# Expose the app port
EXPOSE 5000

# Start the app exactly like workspace
CMD ["npm", "run", "dev"]