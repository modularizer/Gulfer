import React, { useCallback } from 'react';
import { router, usePathname, useSegments } from 'expo-router';
import { getAllUsers } from '../../services/storage/userStorage';
import { encodeNameForUrl } from '../../utils/urlEncoding';
import HillFooter from './Footer/HillFooter';

interface FooterProps {}

export default function Footer({}: FooterProps) {
  const pathname = usePathname();
  const segments = useSegments();
  
  // Check if we're on a holes page (but not on /players page)
  const isHolesPage = (pathname?.includes('/holes') && !pathname?.includes('/players')) || false;

  const handleCenterPress = useCallback(() => {
    console.log('[CenterButton] Pressed - pathname:', pathname, 'segments:', segments);
    
    // Use segments for more reliable route parsing
    // Segments format: ['round', 'id', 'overview'] or ['course', 'name', 'overview']
    const pathSegments = segments?.filter(s => s && s !== 'index' && s !== '') || [];
    console.log('[CenterButton] Filtered pathSegments:', pathSegments);
    
    // Check if we're on a round overview page using segments
    if (pathSegments.length >= 3 && pathSegments[0] === 'round' && pathSegments[2] === 'overview') {
      const roundId = pathSegments[1];
      if (roundId && roundId !== '[id]') {
        const targetPath = `/round/${roundId}/holes`;
        console.log('[CenterButton] Navigating to (segments match):', targetPath);
        router.push(targetPath);
        return;
      }
    }
    
    // Fallback: try pathname regex matching for round
    if (pathname) {
      if (pathname.includes('/round/') && pathname.includes('/overview')) {
        // More robust regex that handles various pathname formats
        const roundIdMatch = pathname.match(/\/round\/([^/?#]+)\/overview/);
        if (roundIdMatch && roundIdMatch[1] && roundIdMatch[1] !== '[id]') {
          const targetPath = `/round/${roundIdMatch[1]}/holes`;
          console.log('[CenterButton] Navigating to (pathname regex match):', targetPath);
          router.push(targetPath);
          return;
        }
      }
      
      // Check if we're on a course overview page using pathname
      if (pathname.includes('/course/') && pathname.includes('/overview')) {
        const courseIdMatch = pathname.match(/\/course\/([^/?#]+)\/overview/);
        if (courseIdMatch && courseIdMatch[1]) {
          const targetPath = `/course/${courseIdMatch[1]}/holes`;
          console.log('[CenterButton] Navigating to (course pathname match):', targetPath);
          router.push(targetPath);
          return;
        }
      }
    }
    
    // Check if we're on a course overview page using segments
    if (pathSegments.length >= 3 && pathSegments[0] === 'course' && pathSegments[2] === 'overview') {
      const courseName = pathSegments[1];
      if (courseName) {
        const targetPath = `/course/${courseName}/holes`;
        console.log('[CenterButton] Navigating to (course segments match):', targetPath);
        router.push(targetPath);
        return;
      }
    }
    
    // Default: navigate to new round
    console.log('[CenterButton] Navigating to (default): /round/new');
    router.push('/round/new');
  }, [pathname, segments]);

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
