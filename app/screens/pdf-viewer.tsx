/**
 * PDF Viewer Screen
 * 
 * Displays PDF documents using react-native-pdf with offline caching support.
 * Includes page navigation, zoom controls, and reading progress tracking.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

// Conditional import for react-native-pdf (requires native module)
let Pdf: any = null;
try {
  Pdf = require('react-native-pdf').default;
} catch (error) {
  console.warn('[PDFViewer] react-native-pdf not available:', error);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PDFViewerParams {
  url: string;
  title: string;
  bookId?: string;
}

export default function PDFViewerScreen() {
  const params = useLocalSearchParams<PDFViewerParams>();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const pdfRef = useRef<any>(null);

  const { url, title, bookId } = params;

  // Check if PDF is available locally
  const checkLocalCache = useCallback(async () => {
    if (!url) return null;
    
    try {
      const filename = url.split('/').pop() || 'book.pdf';
      const localPath = `${FileSystem.cacheDirectory}ebooks/${filename}`;
      
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) {
        console.log('[PDFViewer] Using cached PDF:', localPath);
        return localPath;
      }
    } catch (error) {
      console.warn('[PDFViewer] Cache check error:', error);
    }
    
    return null;
  }, [url]);

  // Download and cache PDF
  const downloadPdf = useCallback(async () => {
    if (!url) {
      setError('No PDF URL provided');
      setLoading(false);
      return;
    }

    try {
      // First check cache
      const cached = await checkLocalCache();
      if (cached) {
        setLocalUri(cached);
        setLoading(false);
        return;
      }

      // Create cache directory
      const cacheDir = `${FileSystem.cacheDirectory}ebooks`;
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

      // Download with progress
      const filename = url.split('/').pop() || 'book.pdf';
      const localPath = `${cacheDir}/${filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localPath,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(Math.round(progress * 100));
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result?.uri) {
        setLocalUri(result.uri);
        console.log('[PDFViewer] Downloaded PDF to:', result.uri);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('[PDFViewer] Download error:', error);
      // Fallback to remote URL if download fails
      setLocalUri(url);
    } finally {
      setLoading(false);
    }
  }, [url, checkLocalCache]);

  useEffect(() => {
    downloadPdf();
  }, [downloadPdf]);

  // Save reading progress
  const saveProgress = useCallback(async () => {
    if (!bookId || currentPage <= 1) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('reading_progress').upsert({
        user_id: user.id,
        textbook_id: bookId,
        last_page: currentPage,
        total_pages: totalPages,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,textbook_id',
      });
    } catch (error) {
      console.warn('[PDFViewer] Failed to save progress:', error);
    }
  }, [bookId, currentPage, totalPages]);

  // Save progress when leaving
  useEffect(() => {
    return () => {
      saveProgress();
    };
  }, [saveProgress]);

  // Zoom controls
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setScale(1.0);

  // Page navigation
  const goToPage = (page: number) => {
    if (pdfRef.current && page >= 1 && page <= totalPages) {
      pdfRef.current.setPage(page);
    }
  };

  // If react-native-pdf is not available, show fallback
  if (!Pdf) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: title || 'PDF Viewer' }} />
        <View style={styles.fallbackContainer}>
          <Ionicons name="document-text-outline" size={64} color={theme.muted} />
          <Text style={[styles.fallbackTitle, { color: theme.text }]}>
            PDF Viewer Unavailable
          </Text>
          <Text style={[styles.fallbackText, { color: theme.muted }]}>
            PDF viewing requires a development build.{'\n'}
            Please rebuild the app with native modules.
          </Text>
          <TouchableOpacity
            style={[styles.fallbackButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.fallbackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: title || 'PDF Viewer',
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={zoomOut} style={styles.headerButton}>
                <Ionicons name="remove" size={24} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={resetZoom} style={styles.headerButton}>
                <Text style={[styles.zoomText, { color: theme.primary }]}>
                  {Math.round(scale * 100)}%
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={zoomIn} style={styles.headerButton}>
                <Ionicons name="add" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.muted }]}>
            {downloadProgress > 0 && downloadProgress < 100
              ? `Downloading... ${downloadProgress}%`
              : 'Loading PDF...'}
          </Text>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={downloadPdf}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PDF View */}
      {!loading && !error && localUri && (
        <Pdf
          ref={pdfRef}
          source={{ uri: localUri }}
          style={styles.pdf}
          scale={scale}
          minScale={0.5}
          maxScale={3.0}
          spacing={8}
          fitPolicy={0}
          enablePaging={true}
          horizontal={false}
          onLoadComplete={(numberOfPages: number) => {
            setTotalPages(numberOfPages);
            console.log('[PDFViewer] Loaded', numberOfPages, 'pages');
          }}
          onPageChanged={(page: number) => {
            setCurrentPage(page);
          }}
          onError={(error: any) => {
            console.error('[PDFViewer] Error:', error);
            setError('Failed to load PDF');
          }}
          trustAllCerts={false}
        />
      )}

      {/* Page Indicator */}
      {!loading && totalPages > 0 && (
        <View style={[styles.pageIndicator, { backgroundColor: theme.surface }]}>
          <TouchableOpacity
            onPress={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            style={styles.pageButton}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentPage <= 1 ? theme.muted : theme.primary}
            />
          </TouchableOpacity>

          <Text style={[styles.pageText, { color: theme.text }]}>
            {currentPage} / {totalPages}
          </Text>

          <TouchableOpacity
            onPress={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={styles.pageButton}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={currentPage >= totalPages ? theme.muted : theme.primary}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
  },
  zoomText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  pdf: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  pageIndicator: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  pageButton: {
    padding: 8,
  },
  pageText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  fallbackText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  fallbackButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  fallbackButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
