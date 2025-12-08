#!/bin/bash

# Azure Voice Capability Testing Script
# Tests TTS and STT availability for South African languages

set -e

echo "🔍 Azure Cognitive Services - SA Languages Test"
echo "================================================="
echo ""

# Check if required environment variables are set
if [ -z "$AZURE_SPEECH_KEY" ]; then
    echo "❌ Error: AZURE_SPEECH_KEY not set"
    echo "Please set it: export AZURE_SPEECH_KEY='your-key-here'"
    exit 1
fi

if [ -z "$AZURE_SPEECH_REGION" ]; then
    echo "⚠️  Warning: AZURE_SPEECH_REGION not set, using 'southafricanorth'"
    AZURE_SPEECH_REGION="southafricanorth"
fi

echo "✅ Using Azure region: $AZURE_SPEECH_REGION"
echo ""

# Test 1: List all available voices
echo "📋 Test 1: Fetching available voices..."
echo "---------------------------------------"

VOICES_RESPONSE=$(curl -s -X GET \
    "https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list" \
    -H "Ocp-Apim-Subscription-Key: ${AZURE_SPEECH_KEY}")

if [ $? -ne 0 ]; then
    echo "❌ Failed to fetch voices from Azure"
    exit 1
fi

echo "✅ Successfully fetched voice list"
echo ""

# Test 2: Filter for South African voices
echo "🇿🇦 Test 2: South African Voices Available"
echo "-------------------------------------------"

echo "Afrikaans (af-ZA) voices:"
echo "$VOICES_RESPONSE" | jq -r '.[] | select(.Locale | startswith("af-ZA")) | "  - \(.ShortName) (\(.Gender), \(.VoiceType))"' 2>/dev/null || echo "  (jq not installed - raw response saved)"

echo ""
echo "Zulu (zu-ZA) voices:"
echo "$VOICES_RESPONSE" | jq -r '.[] | select(.Locale | startswith("zu-ZA")) | "  - \(.ShortName) (\(.Gender), \(.VoiceType))"' 2>/dev/null

echo ""
echo "Xhosa (xh-ZA) voices:"
echo "$VOICES_RESPONSE" | jq -r '.[] | select(.Locale | startswith("xh-ZA")) | "  - \(.ShortName) (\(.Gender), \(.VoiceType))"' 2>/dev/null

echo ""
echo "Sepedi/Northern Sotho (nso-ZA) voices:"
echo "$VOICES_RESPONSE" | jq -r '.[] | select(.Locale | startswith("nso-ZA")) | "  - \(.ShortName) (\(.Gender), \(.VoiceType))"' 2>/dev/null

echo ""

# Save full response for inspection
mkdir -p /home/king/Desktop/edudashpro/tests/voice/
echo "$VOICES_RESPONSE" | jq '.' > /home/king/Desktop/edudashpro/tests/voice/azure-voices-full.json 2>/dev/null || echo "$VOICES_RESPONSE" > /home/king/Desktop/edudashpro/tests/voice/azure-voices-full.txt

echo "💾 Full voice list saved to: tests/voice/azure-voices-full.json"
echo ""

# Test 3: Test TTS for each language
echo "🎤 Test 3: Testing TTS Synthesis"
echo "---------------------------------"

mkdir -p /home/king/Desktop/edudashpro/tests/voice/samples

test_tts() {
    local LANG=$1
    local VOICE=$2
    local TEXT=$3
    local OUTPUT_FILE=$4

    echo "Testing $LANG ($VOICE)..."
    
    SSML="<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${LANG}'>
        <voice name='${VOICE}'>
            ${TEXT}
        </voice>
    </speak>"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1" \
        -H "Ocp-Apim-Subscription-Key: ${AZURE_SPEECH_KEY}" \
        -H "Content-Type: application/ssml+xml" \
        -H "X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3" \
        --data-binary "$SSML" \
        --output "$OUTPUT_FILE")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
        echo "  ✅ Success (${FILE_SIZE} bytes) - saved to $OUTPUT_FILE"
        return 0
    else
        echo "  ❌ Failed (HTTP $HTTP_CODE)"
        return 1
    fi
}

# Test each language
echo ""
test_tts "af-ZA" "af-ZA-AdriNeural" "Hallo, ek is Dash, jou AI-onderrigassistent." "tests/voice/samples/af-test.mp3"
test_tts "zu-ZA" "zu-ZA-ThandoNeural" "Sawubona, nginguDash, umsizi wakho we-AI." "tests/voice/samples/zu-test.mp3"
test_tts "xh-ZA" "xh-ZA-YaandeNeural" "Molo, ndinguDash, umncedisi wakho we-AI." "tests/voice/samples/xh-test.mp3"

# Sepedi might not be available - try fallback
if echo "$VOICES_RESPONSE" | jq -e '.[] | select(.Locale | startswith("nso-ZA"))' > /dev/null 2>&1; then
    NSO_VOICE=$(echo "$VOICES_RESPONSE" | jq -r '.[] | select(.Locale | startswith("nso-ZA")) | .ShortName' | head -n1)
    test_tts "nso-ZA" "$NSO_VOICE" "Dumela, ke Dash, mothusi wa gago wa AI." "tests/voice/samples/nso-test.mp3"
else
    echo "⚠️  Sepedi (nso-ZA) not available in Azure - will use Whisper as primary"
fi

echo ""

# Test 4: Check STT language support
echo "🎧 Test 4: Checking STT Language Support"
echo "-----------------------------------------"

check_stt_support() {
    local LANG=$1
    local LANG_NAME=$2
    
    # Create a silent test file (1 second of silence)
    TEST_FILE="/tmp/test-${LANG}.wav"
    sox -n -r 16000 -c 1 "$TEST_FILE" trim 0 1 2>/dev/null || {
        echo "  ⚠️  sox not installed - skipping STT test"
        return
    }
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${LANG}" \
        -H "Ocp-Apim-Subscription-Key: ${AZURE_SPEECH_KEY}" \
        -H "Content-Type: audio/wav" \
        --data-binary "@${TEST_FILE}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✅ $LANG_NAME STT supported"
    else
        echo "  ❌ $LANG_NAME STT not available (HTTP $HTTP_CODE)"
    fi
    
    rm -f "$TEST_FILE"
}

echo ""
check_stt_support "af-ZA" "Afrikaans"
check_stt_support "zu-ZA" "Zulu"
check_stt_support "xh-ZA" "Xhosa"
check_stt_support "nso-ZA" "Sepedi"

echo ""

# Summary
echo "📊 Summary"
echo "=========="
echo "✅ Voice list retrieved successfully"
echo "✅ TTS test samples generated (check tests/voice/samples/)"
echo "✅ Full voice details saved (tests/voice/azure-voices-full.json)"
echo ""
echo "🎯 Next Steps:"
echo "1. Listen to the generated samples to verify quality"
echo "2. Review azure-voices-full.json for all available voices"
echo "3. Choose your preferred voices for each language"
echo "4. Update the tts-proxy Edge Function with chosen voice IDs"
echo ""
echo "🔊 To play samples (if you have audio tools):"
echo "   mpg123 tests/voice/samples/af-test.mp3"
echo "   mpg123 tests/voice/samples/zu-test.mp3"
echo "   mpg123 tests/voice/samples/xh-test.mp3"
