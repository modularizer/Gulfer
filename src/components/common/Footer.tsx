import React, { useCallback, useState, useEffect } from 'react';
import { router, usePathname, useSegments, useFocusEffect } from 'expo-router';
import { Linking, Platform } from 'react-native';
import { getAllUsers } from '../../services/storage/userStorage';
import { encodeNameForUrl } from '../../utils/urlEncoding';
import { getRoundById } from '../../services/storage/roundStorage';
import { getAllCourses } from '../../services/storage/courseStorage';
import { Round } from '../../types';
import HillFooter from './Footer/HillFooter';

interface FooterProps {}

export default function Footer({}: FooterProps) {
  const pathname = usePathname();
  const segments = useSegments();
  const [round, setRound] = useState<Round | null>(null);
  
  // Check if we're on a holes page (but not on /players page)
  const isHolesPage = (pathname?.includes('/holes') && !pathname?.includes('/players')) || false;
  
  // Get round ID from pathname/segments if on round overview page
  const getRoundId = useCallback(() => {
    const pathSegments = segments?.filter(s => s && s !== 'index' && s !== '') || [];
    
    // Check segments first
    if (pathSegments.length >= 3 && pathSegments[0] === 'round' && pathSegments[2] === 'overview') {
      const roundId = pathSegments[1];
      if (roundId && roundId !== '[id]') {
        return roundId;
      }
    }
    
    // Fallback to pathname
    if (pathname) {
      const roundIdMatch = pathname.match(/\/round\/([^/?#]+)\/overview/);
      if (roundIdMatch && roundIdMatch[1] && roundIdMatch[1] !== '[id]') {
        return roundIdMatch[1];
      }
    }
    
    return null;
  }, [pathname, segments]);
  
  // Load round data when on round overview page
  const roundId = getRoundId();
  useEffect(() => {
    if (roundId) {
      const loadRound = async () => {
        try {
          const loadedRound = await getRoundById(roundId);
          setRound(loadedRound);
        } catch (error) {
          console.error('Error loading round in Footer:', error);
          setRound(null);
        }
      };
      loadRound();
    } else {
      setRound(null);
    }
  }, [roundId]);
  
  // Reload round when page comes into focus
  useFocusEffect(
    useCallback(() => {
      if (roundId) {
        const loadRound = async () => {
          try {
            const loadedRound = await getRoundById(roundId);
            setRound(loadedRound);
          } catch (error) {
            console.error('Error loading round in Footer:', error);
            setRound(null);
          }
        };
        loadRound();
      } else {
        setRound(null);
      }
    }, [roundId])
  );

  const handleCenterPress = useCallback(() => {
    console.log('[CenterButton] Pressed - pathname:', pathname, 'segments:', segments);
    
    // Check if we're on the about page - open GitHub
    if (pathname === '/about' || pathname?.includes('/about')) {
      const githubUrl = 'https://github.com/modularizer/Gulfer/';
      if (Platform.OS === 'web') {
        // Use window.open for web to open in new tab
        if (typeof window !== 'undefined') {
          window.open(githubUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        Linking.openURL(githubUrl).catch((err) => {
          console.error('Error opening GitHub:', err);
        });
      }
      return;
    }
    
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

  // Helper function to determine round label based on scores
  const getRoundLabel = useCallback(async (round: Round): Promise<string> => {
    const scores = round.scores || [];
    
    // Get all holes for this round
    let allHoles: number[] = [];
    
    // Try to get holes from course
    if (round.courseName) {
      try {
        const courses = await getAllCourses();
        const course = courses.find(c => c.name === round.courseName);
        if (course) {
          const holeCount = Array.isArray(course.holes) 
            ? course.holes.length 
            : (course.holes as unknown as number || 0);
          allHoles = Array.from({ length: holeCount }, (_, i) => i + 1);
        }
      } catch (error) {
        console.error('Error loading courses for label:', error);
      }
    }
    
    // If no course holes, get holes from scores
    if (allHoles.length === 0 && scores.length > 0) {
      const holeNumbers = [...new Set(scores.map(s => s.holeNumber))].sort((a, b) => a - b);
      allHoles = holeNumbers;
    }
    
    // If still no holes, default to empty (new round)
    if (allHoles.length === 0) {
      return 'Begin Round';
    }
    
    // Check scores for each hole
    // A hole is considered "scored" if any player has a non-zero score for it
    const holesWithScores = new Set<number>();
    
    scores.forEach(score => {
      if (score.throws > 0) {
        holesWithScores.add(score.holeNumber);
      }
    });
    
    const scoredCount = holesWithScores.size;
    const totalHoles = allHoles.length;
    
    if (scoredCount === 0) {
      // All holes have empty/0 scores
      return 'Begin Round';
    } else if (scoredCount < totalHoles) {
      // Some but not all holes have scores
      return 'Continue Round';
    } else {
      // All holes have non-zero scores
      return 'View Round';
    }
  }, []);

  // Determine the button label based on current route and round state
  const getButtonLabel = useCallback(async () => {
    // Check if we're on the about page
    if (pathname === '/about' || pathname?.includes('/about')) {
      return 'View on GitHub';
    }
    
    const pathSegments = segments?.filter(s => s && s !== 'index' && s !== '') || [];
    
    // Check if we're on a round overview page
    const isRoundOverview = (pathSegments.length >= 3 && pathSegments[0] === 'round' && pathSegments[2] === 'overview') ||
      (pathname?.includes('/round/') && pathname?.includes('/overview'));
    
    if (isRoundOverview) {
      if (round) {
        return await getRoundLabel(round);
      }
      // If round not loaded yet, default to View Holes
      return 'View Holes';
    }
    
    // Check if we're on a course overview page
    if (pathSegments.length >= 3 && pathSegments[0] === 'course' && pathSegments[2] === 'overview') {
      return 'View Holes';
    }
    
    // Fallback: check pathname for course
    if (pathname?.includes('/course/') && pathname?.includes('/overview')) {
      return 'View Holes';
    }
    
    // Default: Start Round
    return 'Start Round';
  }, [pathname, segments, round, getRoundLabel]);
  
  // Get label synchronously (will use cached result)
  const [buttonLabel, setButtonLabel] = useState('Start Round');
  
  useEffect(() => {
    getButtonLabel().then(setButtonLabel).catch(() => setButtonLabel('Start Round'));
  }, [getButtonLabel]);

  return (
    <HillFooter
      onHistoryPress={() => router.push('/round/list')}
      onNewRoundPress={handleCenterPress}
      onProfilePress={handleProfilePress}
      showCenterButton={!isHolesPage}
      centerButtonLabel={buttonLabel}
    />
  );
}
