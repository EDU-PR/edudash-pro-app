import React from 'react';
import { Platform, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface MermaidRendererProps {
  definition: string;
  height?: number;
}

function buildMermaidHtml(definition: string): string {
  const escaped = JSON.stringify(definition || 'graph TD; A[No diagram]');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; padding: 0; background: transparent; color: #e2e8f0; }
      #root { padding: 10px; }
      .error { color: #f87171; font-family: sans-serif; font-size: 13px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.4.0/dist/mermaid.min.js"></script>
    <script>
      const root = document.getElementById('root');
      const definition = ${escaped};
      mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'dark' });
      (async () => {
        try {
          const { svg } = await mermaid.render('dash-mermaid', definition);
          root.innerHTML = svg;
        } catch (error) {
          root.innerHTML = '<div class="error">Unable to render diagram.</div>';
        }
      })();
    </script>
  </body>
</html>`;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({ definition, height = 190 }) => {
  const cleaned = String(definition || '').trim();
  if (!cleaned) return null;
  const looksLikeMermaidSyntax = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/m.test(cleaned);
  if (!looksLikeMermaidSyntax) {
    return (
      <View
        style={{
          marginVertical: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.28)',
          padding: 10,
        }}
      >
        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>
          Diagram syntax was invalid. Dash will provide a simplified explanation instead.
        </Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          marginVertical: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.28)',
          padding: 10,
        }}
      >
        <Text style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: 12 }}>
          {cleaned}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        marginVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.28)',
        borderRadius: 12,
        overflow: 'hidden',
        minHeight: height,
      }}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html: buildMermaidHtml(cleaned) }}
        style={{ backgroundColor: 'transparent', minHeight: height }}
        scrollEnabled={false}
      />
    </View>
  );
};

export default MermaidRenderer;
