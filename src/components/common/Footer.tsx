import React, { useCallback } from 'react';
import { router, usePathname } from 'expo-router';
import { getAllUsers } from '../../services/storage/userStorage';
import { encodeNameForUrl } from '../../utils/urlEncoding';
import HillFooter from './Footer/HillFooter';

interface FooterProps {}

export default function Footer({}: FooterProps) {
  const pathname = usePathname();
  
  // Check if we're on a holes page (but not on /players page)
  const isHolesPage = (pathname?.includes('/holes') && !pathname?.includes('/players')) || false;

  const handleCenterPress = useCallback(() => {
    if (!pathname) {
      router.push('/round/new');
      return;
    }

    // Determine route based on current page
    if (pathname.includes('/round/') && pathname.includes('/overview')) {
      // On round overview page - navigate to holes
      const roundIdMatch = pathname.match(/\/round\/([^/]+)\/overview/);
      if (roundIdMatch) {
        router.push(`/round/${roundIdMatch[1]}/holes`);
        return;
      }
    } else if (pathname.includes('/course/') && pathname.includes('/overview')) {
      // On course overview page - navigate to holes
      const courseIdMatch = pathname.match(/\/course\/([^/]+)\/overview/);
      if (courseIdMatch) {
        router.push(`/course/${courseIdMatch[1]}/holes`);
        return;
      }
    }
    
    // Default: navigate to new round
    router.push('/round/new');
  }, [pathname]);

  const handleProfilePress = useCallback(async () => {
    try {
      const users = await getAllUsers();
      const currentUser = users.find(u => u.isCurrentUser);
      if (currentUser) {
        // Navigate to player page using encoded name
        router.push(`/player/${encodeNameForUrl(currentUser.name)}/overview`);
      } else {
        // No user set, navigate to /you page to set it
        router.push('/player/me');
      }
    } catch (error) {
      console.error('Error navigating to profile:', error);
      router.push('/you');
    }
  }, []);

  return (
    <HillFooter
      onHistoryPress={() => router.push('/round/list')}
      onNewRoundPress={handleCenterPress}
      onProfilePress={handleProfilePress}
      showCenterButton={!isHolesPage}
    />
  );
}
