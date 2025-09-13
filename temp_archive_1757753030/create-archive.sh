
#!/bin/bash

# Create a temporary directory for the archive
TEMP_DIR="temp_archive_$(date +%s)"
ARCHIVE_NAME="project-archive-$(date +%Y%m%d-%H%M%S).zip"

echo "📦 Creating project archive..."
echo "🗂️  Temporary directory: $TEMP_DIR"
echo "📄 Archive name: $ARCHIVE_NAME"

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Copy all files except the specified exclusions using cp
echo "🔄 Copying files..."
cp -r . "$TEMP_DIR/" 2>/dev/null

# Remove excluded directories and files from the temporary copy
echo "🚫 Removing excluded items..."
rm -rf "$TEMP_DIR/node_modules" 2>/dev/null
rm -rf "$TEMP_DIR/dist" 2>/dev/null
rm -rf "$TEMP_DIR/attached_assets" 2>/dev/null
rm -rf "$TEMP_DIR/.git" 2>/dev/null
rm -rf "$TEMP_DIR/.config" 2>/dev/null
rm -rf "$TEMP_DIR/temp-telegram-live-sender" 2>/dev/null
rm -rf "$TEMP_DIR/$TEMP_DIR" 2>/dev/null  # Remove the temp dir copy of itself

# Remove media files
find "$TEMP_DIR" -type f \( -name "*.gif" -o -name "*.jpg" -o -name "*.png" -o -name "*.mp4" \) -delete 2>/dev/null

# Create the ZIP archive using Node.js
echo "🔄 Creating ZIP archive using Node.js..."
node -e "
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream('$ARCHIVE_NAME');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log('✅ ZIP created: ' + archive.pointer() + ' total bytes');
});

archive.on('error', function(err) {
  console.error('❌ ZIP creation failed:', err);
  process.exit(1);
});

archive.pipe(output);
archive.directory('$TEMP_DIR', false);
archive.finalize();
" 2>/dev/null

# Clean up temporary directory
echo "🧹 Cleaning up temporary directory..."
rm -rf "$TEMP_DIR"

if [ -f "$ARCHIVE_NAME" ]; then
    echo "✅ Archive created successfully: $ARCHIVE_NAME"
    echo "📊 Archive size: $(du -h "$ARCHIVE_NAME" | cut -f1)"
else
    echo "❌ Failed to create archive"
    exit 1
fi

# Show what was excluded
echo ""
echo "🚫 Excluded items:"
echo "   • node_modules/"
echo "   • dist/"
echo "   • attached_assets/"
echo "   • .git/"
echo "   • .config/"
echo "   • temp-telegram-live-sender/"
echo "   • Media files (.gif, .jpg, .png, .mp4)"
echo ""
echo "✅ Included everything else:"
echo "   • All source code (client/, server/, shared/)"
echo "   • Session files (.session, .session-journal)"
echo "   • Configuration files"
echo "   • bot_source/ directory"
echo "   • logs/, tmp/, downloads/ directories"
echo "   • Lock files and all other project files"
echo ""
echo "✨ ZIP archive ready for download or sharing!"
