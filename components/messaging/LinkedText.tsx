/**
 * LinkedText — renders message text with tappable URLs & phone numbers.
 *
 * Detects http(s) links, phone numbers (SA & international), and email addresses.
 * Tapping a link opens the default browser; tapping a phone opens the dialer.
 */
import React, { useMemo } from 'react';
import { Text, Linking, type TextStyle, type StyleProp } from 'react-native';

// Matches URLs, emails, and phone numbers (including SA +27 / 0XX)
const LINK_REGEX =
  /(https?:\/\/[^\s<>'"]+)|(\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b)|(\+?\d[\d\s\-().]{6,}\d)/g;

interface LinkedTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  linkColor?: string;
}

interface Segment {
  text: string;
  type: 'text' | 'url' | 'email' | 'phone';
}

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(LINK_REGEX)) {
    const start = match.index!;
    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start), type: 'text' });
    }

    if (match[1]) {
      segments.push({ text: match[0], type: 'url' });
    } else if (match[2]) {
      segments.push({ text: match[0], type: 'email' });
    } else if (match[3]) {
      // Only accept phone-like strings with 7+ digits
      const digits = match[0].replace(/\D/g, '');
      if (digits.length >= 7) {
        segments.push({ text: match[0], type: 'phone' });
      } else {
        segments.push({ text: match[0], type: 'text' });
      }
    }
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), type: 'text' });
  }

  return segments;
}

function handlePress(segment: Segment) {
  switch (segment.type) {
    case 'url':
      Linking.openURL(segment.text).catch(() => {});
      break;
    case 'email':
      Linking.openURL(`mailto:${segment.text}`).catch(() => {});
      break;
    case 'phone': {
      const digits = segment.text.replace(/\D/g, '');
      Linking.openURL(`tel:${digits}`).catch(() => {});
      break;
    }
  }
}

export const LinkedText: React.FC<LinkedTextProps> = ({
  text,
  style,
  linkColor = '#93c5fd',
}) => {
  const segments = useMemo(() => parseSegments(text), [text]);

  if (segments.length === 1 && segments[0].type === 'text') {
    return <Text style={style}>{text}</Text>;
  }

  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return seg.text;
        return (
          <Text
            key={i}
            style={{ color: linkColor, textDecorationLine: 'underline' }}
            onPress={() => handlePress(seg)}
          >
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
};

export default LinkedText;
