
<old_str>#!/bin/bash

# Create a temporary directory for the archive
TEMP_DIR="temp_archive_$(date +%s)"
ARCHIVE_NAME="project-archive-$(date +%Y%m%d-%H%M%S).zip"

echo "📦 Creating project archive..."
echo "🗂️  Temporary directory: $TEMP_DIR"
echo "📄 Archive name: $ARCHIVE_NAME"

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Copy all files except those in .gitignore and additional exclusions
rsync -av \
  --exclude-from=.gitignore \
  --exclude='*.log' \
  --exclude='attached_assets/' \
  --exclude='logs/' \
  --exclude='tmp/' \
  --exclude='downloads/' \
  --exclude='sessions/' \
  --exclude='bot_source/' \
  --exclude='temp-telegram-live-sender/' \
  --exclude='*.tar.gz' \
  --exclude='*.zip' \
  --exclude='uv.lock' \
  --exclude='package-lock.json' \
  --exclude='.config/' \
  --exclude='*.gif' \
  --exclude='*.jpg' \
  --exclude='*.png' \
  --exclude='*.mp4' \
  --exclude='*.avi' \
  --exclude='*.mov' \
  ./ "$TEMP_DIR/"

# Create the zip archive from the temporary directory
echo "🗄️  Zipping the archive..."
zip -r "$ARCHIVE_NAME" "$TEMP_DIR"

# Clean up the temporary directory
echo "🧹 Cleaning up temporary directory..."
rm -rf "$TEMP_DIR"

echo "✅ Project archive created successfully: $ARCHIVE_NAME"

echo "🚫 Excluded items:"
echo "   • node_modules/"
echo "   • dist/"
echo "   • attached_assets/"
echo "   • downloads/"
echo "   • logs/"
echo "   • tmp/"
echo "   • sessions/"
echo "   • bot_source/"
echo "   • temp-telegram-live-sender/"
echo "   • All image/video files"
echo "   • Lock files (uv.lock, package-lock.json)"
echo "   • Configuration cache (.config/)"
echo ""
echo "✅ Included important items:"
echo "   • .session and .session-journal files (Telegram session data)"
echo "   • All source code and configurations"</old_str>
<new_str>#!/bin/bash

# Create a temporary directory for the archive
TEMP_DIR="temp_archive_$(date +%s)"
ARCHIVE_NAME="project-archive-$(date +%Y%m%d-%H%M%S).zip"

echo "📦 Creating project archive..."
echo "🗂️  Temporary directory: $TEMP_DIR"
echo "📄 Archive name: $ARCHIVE_NAME"

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Copy all files except the specified exclusions (ignore .gitignore)
rsync -av \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='attached_assets/' \
  --exclude='*.gif' \
  --exclude='*.jpg' \
  --exclude='*.png' \
  --exclude='*.mp4' \
  ./ "$TEMP_DIR/"

# Create the zip archive
echo "🔄 Creating ZIP archive..."
cd "$TEMP_DIR"
zip -r "../$ARCHIVE_NAME" . -x "*.DS_Store"
cd ..

# Clean up temporary directory
rm -rf "$TEMP_DIR"

echo "✅ Archive created successfully: $ARCHIVE_NAME"
echo "📊 Archive size: $(du -h "$ARCHIVE_NAME" | cut -f1)"

# Show what was excluded
echo ""
echo "🚫 Excluded items:"
echo "   • node_modules/"
echo "   • dist/"
echo "   • attached_assets/"
echo "   • Media files (.gif, .jpg, .png, .mp4)"
echo ""
echo "✅ Included everything else:"
echo "   • All source code (client/, server/, shared/)"
echo "   • Session files (.session, .session-journal)"
echo "   • Configuration files"
echo "   • bot_source/ directory"
echo "   • temp-telegram-live-sender/ directory"
echo "   • logs/, tmp/, downloads/ directories"
echo "   • .config/ directory"
echo "   • Lock files and all other project files"
echo ""
echo "✨ Archive ready for download or sharing!"</new_str>
