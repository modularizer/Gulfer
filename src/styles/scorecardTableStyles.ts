import { StyleSheet } from 'react-native';

/**
 * Shared styles for scorecard table components (Scorecard and HolesTable)
 * These styles ensure consistent appearance across round and course views
 */
export const scorecardTableStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  fixedHeaderRow: {
    backgroundColor: '#4CAF50',
    borderBottomWidth: 2,
    borderBottomColor: '#388e3c',
    zIndex: 10,
    position: 'relative',
  },
  headerScrollView: {
    flex: 1,
  },
  headerRowContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  settingsButtonAbsolute: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: '100%',
    zIndex: 11,
    justifyContent: 'center',
  },
  scrollableContent: {
    flex: 1,
  },
  table: {
    padding: 8,
    paddingBottom: 0,
  },
  fixedTotalRow: {
    backgroundColor: '#e8f5e9',
    borderTopWidth: 2,
    borderTopColor: '#4CAF50',
    paddingTop: 4,
    paddingBottom: 0,
    zIndex: 10,
  },
  totalRowContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 31,
  },
  cell: {
    width: 77,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  headerCell: {
    backgroundColor: '#4CAF50',
    minHeight: 31,
  },
  headerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  holeCell: {
    backgroundColor: '#f5f5f5',
    width: 35,
    minWidth: 35,
  },
  holeHeaderCell: {
    width: 35,
    minWidth: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIconButton: {
    margin: 0,
    padding: 0,
    width: 40,
    height: 40,
  },
  settingsHeaderCell: {
    width: 40,
    minWidth: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIconButton: {
    margin: 0,
    padding: 0,
    width: 40,
    height: 40,
  },
  distanceHeaderCell: {
    width: 60,
    minWidth: 60,
  },
  parHeaderCell: {
    width: 60,
    minWidth: 60,
  },
  gStatsHeaderCell: {
    width: 80,
    minWidth: 80,
  },
  distanceCell: {
    backgroundColor: '#f5f5f5',
    width: 60,
    minWidth: 60,
  },
  distanceText: {
    fontWeight: '500',
    fontSize: 12,
    color: '#666',
  },
  parCell: {
    backgroundColor: '#f5f5f5',
    width: 60,
    minWidth: 60,
  },
  parText: {
    fontWeight: '500',
    fontSize: 12,
    color: '#666',
  },
  gStatsCell: {
    backgroundColor: '#e0e0e0',
    width: 80,
    minWidth: 80,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
    marginBottom: -1,
  },
  gStatHeaderText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  holeText: {
    fontWeight: '600',
    fontSize: 14,
  },
  totalRowCell: {
    backgroundColor: '#e8f5e9',
  },
  totalRowText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scoreTextContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerUnderline: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    right: 0,
    height: 1,
    borderRadius: 1,
  },
  scoreCellContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cornerTextTopLeft: {
    position: 'absolute',
    top: -1,
    left: 3,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  cornerTextTopRight: {
    position: 'absolute',
    top: -1,
    right: 3,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  cornerTextBottomLeft: {
    position: 'absolute',
    bottom: -1,
    left: 3,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  cornerTextBottomRight: {
    position: 'absolute',
    bottom: -1,
    right: 3,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  cornerTextTopLeftTotal: {
    position: 'absolute',
    top: 0,
    left: 5,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  cornerTextTopRightTotal: {
    position: 'absolute',
    top: 0,
    right: 5,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  cornerTextBottomLeftTotal: {
    position: 'absolute',
    bottom: 0,
    left: 5,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  cornerTextBottomRightTotal: {
    position: 'absolute',
    bottom: 0,
    right: 5,
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  totalCell: {
    backgroundColor: '#e8f5e9',
    paddingTop: 0,
    paddingBottom: 0,
  },
  totalText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  addCell: {
    padding: 12,
  },
});

