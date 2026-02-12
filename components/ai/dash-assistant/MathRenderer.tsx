import React from 'react';
import { Platform, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface MathRendererProps {
  expression: string;
  displayMode?: boolean;
}

function buildMathHtml(expression: string, displayMode: boolean): string {
  const escapedExpression = JSON.stringify(expression || '');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css" />
    <style>
      body { margin: 0; padding: 0; background: transparent; color: #e2e8f0; }
      #math-root { padding: ${displayMode ? 8 : 4}px; font-size: 17px; }
      .katex-display { margin: 0; }
    </style>
  </head>
  <body>
    <div id="math-root"></div>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js"></script>
    <script>
      const expression = ${escapedExpression};
      const root = document.getElementById('math-root');
      try {
        katex.render(expression, root, { throwOnError: false, displayMode: ${displayMode ? 'true' : 'false'} });
      } catch (error) {
        root.textContent = expression;
      }
    </script>
  </body>
</html>`;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ expression, displayMode = true }) => {
  const cleaned = String(expression || '').trim();
  if (!cleaned) return null;

  if (Platform.OS === 'web') {
    try {
      const katex = require('react-katex');
      const BlockMath = katex.BlockMath as React.ComponentType<{ math: string }>;
      const InlineMath = katex.InlineMath as React.ComponentType<{ math: string }>;
      return (
        <View style={{ marginVertical: displayMode ? 8 : 2 }}>
          {displayMode ? <BlockMath math={cleaned} /> : <InlineMath math={cleaned} />}
        </View>
      );
    } catch {
      return (
        <Text style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
          {cleaned}
        </Text>
      );
    }
  }

  return (
    <View
      style={{
        marginVertical: displayMode ? 8 : 4,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.28)',
        borderRadius: 12,
        overflow: 'hidden',
        minHeight: displayMode ? 74 : 44,
      }}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html: buildMathHtml(cleaned, displayMode) }}
        style={{ backgroundColor: 'transparent' }}
        scrollEnabled={false}
      />
    </View>
  );
};

export default MathRenderer;
