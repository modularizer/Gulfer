/**
 * Shared Detail Page Layout Component
 * Common layout wrapper for detail pages with header, scroll view, and error dialog
 */

import React, { ReactNode } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import DetailPageHeader from './DetailPageHeader';
import ErrorDialog from './ErrorDialog';
import LoadingState from './LoadingState';

interface DetailPageLayoutProps {
  loading?: boolean;
  onBack: () => void;
  headerMenuItems?: Array<{
    title: string;
    icon?: string;
    onPress: () => void;
  }>;
  headerAction?: {
    icon: string;
    onPress: () => void;
    iconColor?: string;
    disabled?: boolean;
  };
  headerContent?: ReactNode;
  errorDialog?: {
    visible: boolean;
    title: string;
    message: string;
    onDismiss: () => void;
  };
  children: ReactNode;
}

export default function DetailPageLayout({
  loading = false,
  onBack,
  headerMenuItems,
  headerAction,
  headerContent,
  errorDialog,
  children,
}: DetailPageLayoutProps) {
  const theme = useTheme();

  if (loading) {
    return <LoadingState />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <DetailPageHeader
        onBack={onBack}
        action={headerAction}
        menuItems={headerMenuItems}
      >
        {headerContent}
      </DetailPageHeader>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      {errorDialog && (
        <ErrorDialog
          visible={errorDialog.visible}
          title={errorDialog.title}
          message={errorDialog.message}
          onDismiss={errorDialog.onDismiss}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
});

