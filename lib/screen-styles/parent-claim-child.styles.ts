/**
 * Styles for ParentClaimChildScreen
 * Extracted from parent-claim-child.tsx
 */
import { StyleSheet } from 'react-native';

export const claimChildStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  cardSubtitle: { fontSize: 14, marginBottom: 20 },
  searchContainer: { gap: 12 },
  searchInputContainer: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, padding: 14, fontSize: 16 },
  searchButton: { borderRadius: 12, padding: 16, alignItems: 'center' as const },
  searchButtonText: { color: '#0b1220', fontSize: 16, fontWeight: '600' },
  resultsContainer: { marginTop: 24 },
  resultsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  resultItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const, borderRadius: 12,
    padding: 16, marginBottom: 12, borderWidth: 1,
  },
  resultContent: { flex: 1 },
  childName: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  childDetails: { flexDirection: 'row' as const, gap: 16 },
  childDetail: { fontSize: 14 },
  helpCard: {
    flexDirection: 'row' as const, borderRadius: 12, padding: 16,
    borderWidth: 1, marginBottom: 16,
  },
  helpContent: { flex: 1, marginLeft: 12 },
  helpTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  helpText: { fontSize: 14, marginBottom: 12 },
  linkButton: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    padding: 12, borderRadius: 8, gap: 8,
  },
  linkButtonText: { fontSize: 14, fontWeight: '600' },
  confirmDetails: { gap: 16, marginBottom: 20 },
  detailRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 16, fontWeight: '600' },
  warningBox: {
    flexDirection: 'row' as const, borderWidth: 1, borderRadius: 8,
    padding: 12, gap: 10,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18 },
  relationshipGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12 },
  relationshipButton: {
    flex: 1, minWidth: '45%' as any, borderRadius: 12, padding: 16,
    alignItems: 'center' as const, borderWidth: 2,
  },
  relationshipText: { fontSize: 15 },
  actionButtons: { flexDirection: 'row' as const, gap: 12, marginTop: 8 },
  backButton: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, borderRadius: 12, padding: 16,
    gap: 8, borderWidth: 1,
  },
  backButtonText: { fontSize: 16, fontWeight: '600' },
  submitButton: {
    flex: 2, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, borderRadius: 12, padding: 16, gap: 8,
  },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#0b1220' },
});
