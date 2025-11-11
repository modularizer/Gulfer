#!/bin/bash

# Script to generate a production keystore for Google Play Store
# This keystore is REQUIRED for publishing to Google Play Store
# Keep this keystore file safe - you'll need it for all future updates!

echo "=========================================="
echo "Production Keystore Generator"
echo "=========================================="
echo ""
echo "This script will generate a production keystore for your app."
echo "IMPORTANT: Keep this keystore file safe and backed up!"
echo "You'll need it for all future app updates on Google Play Store."
echo ""

# Default values (you can modify these)
KEYSTORE_NAME="gulfer-release-key.keystore"
KEY_ALIAS="gulfer-key-alias"
VALIDITY_YEARS=25

echo "Default settings:"
echo "  Keystore name: $KEYSTORE_NAME"
echo "  Key alias: $KEY_ALIAS"
echo "  Validity: $VALIDITY_YEARS years"
echo ""

read -p "Press Enter to use defaults, or Ctrl+C to cancel and edit this script: " confirm

echo ""
echo "You'll be prompted to enter:"
echo "  1. A password for the keystore (store password)"
echo "  2. The same password again to confirm"
echo "  3. Your name and organization details"
echo "  4. A password for the key (key password) - can be same as keystore password"
echo ""

KEYSTORE_PATH="app/$KEYSTORE_NAME"

keytool -genkeypair -v -storetype PKCS12 -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity $((VALIDITY_YEARS * 365))

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✓ Keystore generated successfully!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Add the following to android/gradle.properties:"
    echo ""
    echo "   MYAPP_RELEASE_STORE_FILE=$KEYSTORE_NAME"
    echo "   MYAPP_RELEASE_KEY_ALIAS=$KEY_ALIAS"
    echo "   MYAPP_RELEASE_STORE_PASSWORD=<your-keystore-password>"
    echo "   MYAPP_RELEASE_KEY_PASSWORD=<your-key-password>"
    echo ""
    echo "2. Keep your keystore file safe: $KEYSTORE_PATH"
    echo "3. Build your AAB with: cd android && ./gradlew bundleRelease"
    echo ""
else
    echo ""
    echo "✗ Keystore generation failed. Please try again."
    exit 1
fi

