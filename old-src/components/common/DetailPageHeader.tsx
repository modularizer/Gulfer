/**
 * Shared Detail Page Header Component
 * Header with back button, optional title/content, and menu button
 */

import React, { ReactNode, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Menu, useTheme } from 'react-native-paper';

interface DetailPageHeaderProps {
  onBack: () => void;
  menuItems?: Array<{
    title: string;
    icon?: string;
    onPress: () => void;
  }>;
  action?: {
    icon: string;
    onPress: () => void;
    iconColor?: string;
    disabled?: boolean;
  };
  children?: ReactNode; // Optional content between back button and menu
}

export default function DetailPageHeader({
  onBack,
  menuItems,
  action,
  children,
}: DetailPageHeaderProps) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
      <IconButton
        icon="arrow-left"
        size={24}
        iconColor={theme.colors.onSurface}
        onPress={onBack}
        style={styles.backButton}
      />
      {children ? (
        <View style={styles.headerContent}>
          {children}
        </View>
      ) : (
        <View style={styles.headerSpacer} />
      )}
      {action ? (
        <View style={styles.actionContainer}>
          <IconButton
            icon={action.icon}
            size={24}
            iconColor={action.iconColor ?? theme.colors.onSurface}
            onPress={action.onPress}
            disabled={action.disabled}
          />
        </View>
      ) : menuItems && menuItems.length > 0 ? (
        <>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={24}
                iconColor={theme.colors.onSurface}
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            {menuItems.map((item, index) => (
              <Menu.Item
                key={index}
                onPress={() => {
                  setMenuVisible(false);
                  item.onPress();
                }}
                title={item.title}
                leadingIcon={item.icon}
              />
            ))}
          </Menu>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingLeft: 4,
    paddingRight: 16,
    paddingBottom: 8,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    margin: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
    gap: 12,
    minWidth: 0, // Allow flex shrinking
    alignSelf: 'stretch', // Ensure full height alignment
  },
  headerSpacer: {
    flex: 1,
  },
  actionContainer: {
    marginLeft: 8,
  },
});

