# Base image with Node.js
FROM node:20-bullseye-slim

# Install Python3, pip, and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
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

# Copy the rest of the app code
COPY . .

# Set production environment
ENV NODE_ENV=production

# -------------------------------
# Use a single folder for persistent storage
# All logs, downloads, sessions, tmp files go here
# Mount Railway volume to /app/data
# -------------------------------
RUN mkdir -p /app/data/downloads/completed \
             /app/data/sessions \
             /app/data/logs \
             /app/data/tmp/config \
             /app/tmp \
             /app/logs \
             /app/sessions \
    && chmod -R 777 /app/data

# Create template directories for seeding (DO NOT copy secrets at build time)
RUN mkdir -p /app/templates/sessions /app/templates/config
RUN echo "# Templates for seeding persistent volume - secrets loaded at runtime" > /app/templates/README

# Expose the app port
EXPOSE 5000

# Start the app
CMD ["npm", "run", "dev"]