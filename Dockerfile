# Use Node.js 20 LTS with full OS for better compatibility
FROM node:20-bullseye

# Install system dependencies for Python, Node.js, GramJS, and Telegram bots
RUN apt-get update && apt-get install -y \
    # Python and build tools
    python3 \
    python3-pip \
    python3-dev \
    python3-venv \
    build-essential \
    pkg-config \
    # Media processing
    ffmpeg \
    # Archive extraction tools  
    unrar-free \
    p7zip-full \
    unzip \
    # Network tools
    wget \
    curl \
    # Git for version control
    git \
    # Other utilities
    ca-certificates \
    gnupg \
    lsb-release \
    # Clean up
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /app

# Copy and install Node.js dependencies first (for better caching)
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY drizzle.config.ts ./
COPY components.json ./

# Install Node.js dependencies
RUN npm ci --only=production=false && npm cache clean --force

# Update browserslist to fix warnings
RUN npx update-browserslist-db@latest --force || echo "Browserslist update failed, continuing..."

# Install Python dependencies - unified approach to avoid conflicts
COPY requirements.txt ./
COPY bot_source/requirements.txt ./bot_source_requirements.txt
COPY bot_source/live-cloning/requirements.txt ./live_cloning_requirements.txt
COPY bot_source/python-copier/requirements.txt ./python_copier_requirements.txt

# Create unified requirements file to avoid version conflicts
RUN cat requirements.txt > unified_requirements.txt && \
    echo "" >> unified_requirements.txt && \
    cat bot_source_requirements.txt >> unified_requirements.txt && \
    echo "" >> unified_requirements.txt && \
    echo "python-dotenv" >> unified_requirements.txt && \
    echo "configparser" >> unified_requirements.txt && \
    echo "aiohttp" >> unified_requirements.txt && \
    echo "cryptg" >> unified_requirements.txt && \
    # Remove duplicates and install latest compatible versions
    sort unified_requirements.txt | uniq > final_requirements.txt && \
    pip3 install --no-cache-dir -r final_requirements.txt

# Copy the entire application code
COPY . .

# Create essential directory structure for Railway volumes (cleaned up)
RUN mkdir -p /app/data/downloads/completed \
             /app/data/sessions \
             /app/data/logs \
             /app/data/tmp/config \
             /app/tmp \
             /app/logs \
             /app/sessions \
    && chmod -R 777 /app/data \
    && chmod -R 755 /app/tmp \
    && chmod -R 755 /app/logs \
    && chmod -R 755 /app/sessions

# Create template directories for seeding (DO NOT copy secrets at build time)
RUN mkdir -p /app/templates/sessions /app/templates/config
RUN echo "# Templates for seeding persistent volume - secrets loaded at runtime" > /app/templates/README

# Set up environment variables for Railway
ENV NODE_ENV=production
ENV PORT=5000
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONIOENCODING=utf-8

# Create comprehensive startup script with volume seeding and Python bot support
RUN cat > /app/start.sh << 'EOF'
#!/bin/bash

# Seed persistent volume with runtime data if empty
seed_volume() {
    echo "🌱 Seeding persistent volume..."
    
    # Create essential directories only
    mkdir -p /app/data/downloads/completed \
             /app/data/sessions \
             /app/data/logs \
             /app/data/tmp/config
    
    # Copy session files from repo to persistent volume (only if they don't exist)
    if [ -f "/app/bottorrent.session" ] && [ ! -f "/app/data/sessions/bottorrent.session" ]; then
        echo "📋 Seeding session files..."
        cp -n /app/*.session* /app/data/sessions/ 2>/dev/null || true
        cp -n /app/bot_source/*.session* /app/data/sessions/ 2>/dev/null || true
        cp -n /app/bot_source/live-cloning/*.session* /app/data/sessions/ 2>/dev/null || true
    fi
    
    # Copy config files (only if they don't exist)
    if [ -d "/app/config" ] && [ ! -f "/app/data/tmp/config/config.ini" ]; then
        echo "⚙️ Seeding config files..."
        cp -rn /app/config/* /app/data/tmp/config/ 2>/dev/null || true
        cp -rn /app/tmp/* /app/data/tmp/ 2>/dev/null || true
    fi
    
    # Set proper permissions
    chmod -R 777 /app/data
    
    echo "✅ Volume seeding complete"
}

# Start services function
start_services() {
    echo "🚀 Starting Telegram Manager with full Node.js + Python + GramJS support..."
    
    # Seed volume first
    seed_volume
    
    echo "📁 Directory structure ready"
    echo "🔧 Node.js version: $(node --version)"
    echo "🐍 Python version: $(python3 --version)"
    echo "📦 NPM version: $(npm --version)"
    
    # Build the app if not already built
    if [ ! -d "/app/dist" ]; then
        echo "🔨 Building application..."
        npm run build || echo "Build failed, continuing with dev mode..."
    fi
    
    # Start the main Node.js application
    if [ "$NODE_ENV" = "production" ] && [ -d "/app/dist" ]; then
        echo "🚀 Starting in production mode..."
        exec npm start
    else
        echo "🛠️ Starting in development mode..."
        exec npm run dev
    fi
}

# Handle signals gracefully
trap 'echo "🛑 Shutting down gracefully..."; kill -TERM $PID; wait $PID; exit 0' SIGTERM SIGINT

# Start services
start_services &
PID=$!
wait $PID
EOF

RUN chmod +x /app/start.sh

# Expose the port
EXPOSE 5000

# Health check to ensure the application is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/api/downloads || exit 1

# Use the startup script
CMD ["/app/start.s  that download h"]