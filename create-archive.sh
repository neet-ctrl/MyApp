
#!/bin/bash

# Create a temporary directory for the archive
TEMP_DIR="temp_archive_$(date +%s)"
ARCHIVE_NAME="project-archive-$(date +%Y%m%d-%H%M%S).zip"

echo "📦 Creating project archive..."
echo "🗂️  Temporary directory: $TEMP_DIR"
echo "📄 Archive name: $ARCHIVE_NAME"

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Copy all files except the specified exclusions
rsync -av \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='temp-telegram-live-sender/' \
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
echo "   • temp-telegram-live-sender/"
echo "   • attached_assets/"
echo "   • Media files (.gif, .jpg, .png, .mp4)"
echo ""
echo "✅ Included everything else:"
echo "   • All source code (client/, server/, shared/)"
echo "   • Session files (.session, .session-journal)"
echo "   • Configuration files"
echo "   • bot_source/ directory"
echo "   • logs/, tmp/, downloads/ directories"
echo "   • .config/ directory"
echo "   • Lock files and all other project files"
echo ""
echo "✨ Archive ready for download or sharing!"
