/**
 * Layout Styles
 * 
 * Core container, background, and layout styles for Dash AI interface
 */

import { StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export const layoutStyles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundGlowA: {
    position: 'absolute',
    top: -140,
    right: -160,
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.18,
  },
  backgroundGlowB: {
    position: 'absolute',
    bottom: -180,
    left: -140,
    width: 450,
    height: 450,
    borderRadius: 225,
    opacity: 0.15,
  },
  contentLayer: {
    flex: 1,
    zIndex: 1,
  },
  topDeck: {
    paddingHorizontal: 14,
    paddingTop: 6,
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});
