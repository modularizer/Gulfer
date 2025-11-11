import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Dialog, Portal, Text, useTheme, Chip, Menu, Icon, IconButton, Button, Switch } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CornerConfig, UserFilter, AccumulationMode, RoundSelection, SinceDateOption, UntilDateOption } from '@/services/cornerStatistics';
import { getAllUsers, User } from '@/services/storage/userStorage';
import { getAllRounds } from '@/services/storage/roundStorage';
import { getAllCourses } from '@/services/storage/courseStorage';
import { Round, Player } from '@/types';
import { selectRoundsByCriteria, filterRoundsByUser } from '@/services/cornerStatistics';

// Helper functions for checking round completion (duplicated from cornerStatistics.ts for preview)
function getExpectedHoleCount(rounds: Round[]): number {
  if (rounds.length === 0) return 0;
  let maxHoles = 0;
  for (const round of rounds) {
    const uniqueHoles = new Set(round.scores?.map(s => s.holeNumber) || []);
    maxHoles = Math.max(maxHoles, uniqueHoles.size);
  }
  return maxHoles;
}

function isRoundComplete(round: Round, userId: string, expectedHoleCount: number): boolean {
  const userScores = round.scores?.filter(s => s.playerId === userId) || [];
  if (userScores.length === 0) return false;
  const completedHoles = new Set(
    userScores.filter(s => s.throws >= 1).map(s => s.holeNumber)
  );
  return completedHoles.size >= expectedHoleCount;
}

type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const CORNER_LABELS: Record<CornerPosition, string> = {
  topLeft: 'Top-Left',
  topRight: 'Top-Right',
  bottomLeft: 'Bottom-Left',
  bottomRight: 'Bottom-Right',
};

// Round selection labels
type RoundSelectionKey = Exclude<RoundSelection, { type: 'specific'; roundIds: string[] }>;
const ROUND_SELECTION_LABELS: Record<RoundSelectionKey, string> = {
  'all': 'all rounds',
  'latest': 'their latest round',
  'latest2': 'their latest 2 rounds',
  'latest3': 'their latest 3 rounds',
  'first': 'their first round',
  'bestRound': 'their best round',
  'bestRound2': 'their second best round',
  'bestRounds2': 'their best 2 rounds',
  'bestRounds3': 'their best 3 rounds',
  'worstRound': 'their worst round',
  'worstRound2': 'their second worst round',
  'worstRounds2': 'their worst 2 rounds',
  'worstRounds3': 'their worst 3 rounds',
};

// Round selection menu items configuration
interface RoundSelectionMenuItem {
  key: RoundSelectionKey;
  showOnlyForRelevant?: boolean;
  disableForSingleRound?: boolean;
}

const ROUND_SELECTION_MENU_ITEMS: RoundSelectionMenuItem[] = [
  { key: 'all' },
  { key: 'latest', disableForSingleRound: true },
  { key: 'latest2' },
  { key: 'latest3' },
  { key: 'first', disableForSingleRound: true },
  { key: 'bestRound', showOnlyForRelevant: true },
  { key: 'bestRound2', showOnlyForRelevant: true },
  { key: 'bestRounds2', showOnlyForRelevant: true },
  { key: 'bestRounds3', showOnlyForRelevant: true },
  { key: 'worstRound', showOnlyForRelevant: true },
  { key: 'worstRound2', showOnlyForRelevant: true },
  { key: 'worstRounds2', showOnlyForRelevant: true },
  { key: 'worstRounds3', showOnlyForRelevant: true },
];

// Accumulation mode menu items
const ACCUMULATION_MODE_ITEMS: Array<{ key: AccumulationMode; label: string }> = [
  { key: 'best', label: 'best' },
  { key: 'worst', label: 'worst' },
  { key: 'latest', label: 'latest' },
  { key: 'first', label: 'first' },
  { key: 'average', label: 'average' },
  { key: 'percentile', label: 'nth percentile' },
  { key: 'relevant', label: 'relevant' },
];

// Enums for preset values
enum UserFilterEnum {
  Everyone = 'everyone',
  EachUser = 'eachUser',
  TodaysPlayers = 'todaysPlayers',
}

// User filter display labels mapping
const USER_FILTER_LABELS: Record<UserFilterEnum, string> = {
  [UserFilterEnum.Everyone]: 'anyone',
  [UserFilterEnum.EachUser]: 'each respective player',
  [UserFilterEnum.TodaysPlayers]: "players of today's round",
};

enum AccumulationModeEnum {
  Best = 'best',
  Worst = 'worst',
  Latest = 'latest',
  First = 'first',
  Average = 'average',
  Percentile = 'percentile',
  Relevant = 'relevant',
}

enum ScopeEnum {
  Hole = 'hole',
  Round = 'round',
}

enum RoundSelectionEnum {
  All = 'all',
  Latest = 'latest',
  Latest2 = 'latest2',
  Latest3 = 'latest3',
  First = 'first',
  BestRound = 'bestRound',
  BestRound2 = 'bestRound2',
  BestRounds2 = 'bestRounds2',
  BestRounds3 = 'bestRounds3',
  WorstRound = 'worstRound',
  WorstRound2 = 'worstRound2',
  WorstRounds2 = 'worstRounds2',
  WorstRounds3 = 'worstRounds3',
}

enum UserFilterModeEnum {
  Or = 'or',
  And = 'and',
}

// Date option constants
const DATE_OPTION_BEGINNING = 'beginning';
const DATE_OPTION_YEAR_AGO = 'yearAgo';
const DATE_OPTION_MONTH_AGO = 'monthAgo';
const DATE_OPTION_TODAY = 'today';
const DATE_OPTION_YESTERDAY = 'yesterday';
const DATE_OPTION_CUSTOM = 'custom';

// Date option display labels
const DATE_OPTION_LABELS: Record<string, string> = {
  [DATE_OPTION_BEGINNING]: 'the beginning of time',
  [DATE_OPTION_YEAR_AGO]: 'a year ago',
  [DATE_OPTION_MONTH_AGO]: 'a month ago',
  [DATE_OPTION_TODAY]: 'today',
  [DATE_OPTION_YESTERDAY]: 'yesterday',
};

// Accumulation mode display labels
const ACCUMULATION_MODE_LABELS: Record<AccumulationModeEnum, string> = {
  [AccumulationModeEnum.Best]: 'best',
  [AccumulationModeEnum.Worst]: 'worst',
  [AccumulationModeEnum.Latest]: 'latest',
  [AccumulationModeEnum.First]: 'first',
  [AccumulationModeEnum.Average]: 'average',
  [AccumulationModeEnum.Percentile]: 'nth percentile',
  [AccumulationModeEnum.Relevant]: 'relevant',
};

// User filter mode display labels
const USER_FILTER_MODE_LABELS: Record<UserFilterModeEnum, string> = {
  [UserFilterModeEnum.Or]: '**',
  [UserFilterModeEnum.And]: 'when playing together',
};
const USER_FILTER_MODE_OPRIONS: Record<UserFilterModeEnum, string> = {
    [UserFilterModeEnum.Or]: '**together or independently',
    [UserFilterModeEnum.And]: 'when playing together',
};

// Round selection type constant
const ROUND_SELECTION_TYPE_SPECIFIC = 'specific';

// UI text constants
const PRESET_CUSTOM = 'Custom';
const TEXT_SELECTED_ROUNDS = 'the selected round(s)';
const TEXT_SCORE_FROM = 'score from';
const TEXT_PERCENTILE_LABEL = 'Percentile:';
const TEXT_PERCENT_SYMBOL = '%';
const TEXT_BEST_SCORE_DESC = 'best score (lowest throw count) from';
const TEXT_WORST_SCORE_DESC = 'worst score (highest throw count) from';
const TEXT_AVERAGE_SCORE_DESC = 'Average score from';
// For golf: Xth percentile means "better than worst X% of scores" = "X% of scores are HIGHER/worse than this"
// Lower percentiles = better scores (lower throw count), higher percentiles = worse scores (higher throw count)
const TEXT_PERCENTILE_BELOW_DESC = 'th percentile score (X% of scores are HIGHER/worse than this) from';
const TEXT_PERCENTILE_ABOVE_DESC = 'th percentile score (X% of scores are HIGHER/worse than this) from';
const TEXT_NO_ROUNDS_FOUND = 'No rounds found → corner will be left empty';
const TEXT_USING = 'Using';
const TEXT_SELECTED_ROUNDS_LABEL = 'Selected Round(s):';
const TEXT_SELECTED_USERS_LABEL = 'Selected User(s):';
const TEXT_RELEVANT_MODE_WARNING = 'For "relevant" mode, you must select a single round (latest, first, best, second best, worst, second worst, or specific round)';
const TEXT_RELEVANT_MODE_WARNING_SINGLE = 'For "relevant" mode, you must select exactly one round per player';
const TEXT_SELECTED_SCORE_USERS_LABEL = 'Selected Score User(s):';
const TEXT_SELECTED_ROUND_USERS_LABEL = 'Selected Round User(s):';
const TEXT_DONE = 'Done';
const TEXT_PLACEHOLDER_50 = '50';
const TEXT_FIND_THE = 'Find the ';
const TEXT_SCORE_ON_EACH_HOLE = ' score on each hole, ';
const TEXT_CONSIDERING_SCORES_FROM = 'considering scores from ';
const TEXT_PLAYED_BY = 'played by ';
const TEXT_WHEN_PLAYING_TOGETHER = ' when playing together';
const TEXT_SINCE = 'since ';
const TEXT_UNTIL = 'until ';
const TEXT_SELECT_SINCE_DATE = 'Select Since Date';
const TEXT_SELECT_UNTIL_DATE = 'Select Until Date';
const TEXT_SELECT_ROUNDS = 'Select Rounds';
const TEXT_USER_ROUNDS = 'User Rounds';
const TEXT_ROUNDS_SUFFIX = "'s Rounds";
const TEXT_NO_ROUNDS_FOUND_EMPTY = 'No rounds found';
const TEXT_NO_ROUNDS_FOUND_FILTER = 'No rounds found matching the current filter.';
const TEXT_PRESET_LABEL = 'Preset:';
const TEXT_CONFIGURE = 'Configure';
const TEXT_CORNER_STATISTIC = 'Corner Statistic';
const TEXT_CANCEL = 'Cancel';
const TEXT_CLEAR = 'Clear Corner';
const TEXT_SELECTED_DATE = 'selected date';
const TEXT_INITIAL_PERCENTILE = '50';

// Preset configurations
interface Preset {
  name: string;
  config: CornerConfig;
}

const PRESETS: Preset[] = [
  {
    name: 'Personal Best on Hole',
    config: {
      scoreUserFilter: UserFilterEnum.EachUser,
      roundUserFilter: UserFilterEnum.TodaysPlayers,
      accumulationMode: AccumulationModeEnum.Best,
      scope: ScopeEnum.Hole,
      roundSelection: RoundSelectionEnum.All,
      userFilterMode: UserFilterModeEnum.Or,
    },
  },
  {
    name: 'Personal Best Round',
    config: {
      scoreUserFilter: UserFilterEnum.EachUser,
      roundUserFilter: UserFilterEnum.TodaysPlayers,
      accumulationMode: AccumulationModeEnum.Relevant,
      scope: ScopeEnum.Round,
      roundSelection: RoundSelectionEnum.BestRound,
      userFilterMode: UserFilterModeEnum.Or,
    },
  },
  {
    name: 'Latest Round Together',
    config: {
      scoreUserFilter: UserFilterEnum.EachUser,
      roundUserFilter: UserFilterEnum.TodaysPlayers,
      accumulationMode: AccumulationModeEnum.Relevant,
      scope: ScopeEnum.Round,
      roundSelection: RoundSelectionEnum.Latest,
      userFilterMode: UserFilterModeEnum.And,
    },
  },
{
    name: 'Personal Best on Hole from Games Together',
    config: {
        scoreUserFilter: UserFilterEnum.EachUser,
        roundUserFilter: UserFilterEnum.TodaysPlayers,
        accumulationMode: AccumulationModeEnum.Best,
        scope: ScopeEnum.Hole,
        roundSelection: RoundSelectionEnum.All,
        userFilterMode: UserFilterModeEnum.And,
    },
},
    {
        name: 'Personal Best Round from Games Together',
        config: {
            scoreUserFilter: UserFilterEnum.EachUser,
            roundUserFilter: UserFilterEnum.TodaysPlayers,
            accumulationMode: AccumulationModeEnum.Best,
            scope: ScopeEnum.Round,
            roundSelection: RoundSelectionEnum.All,
            userFilterMode: UserFilterModeEnum.And,
        },
    },
  {
    name: 'Personal Average on Hole',
    config: {
      scoreUserFilter: UserFilterEnum.EachUser,
      roundUserFilter: UserFilterEnum.TodaysPlayers,
      accumulationMode: AccumulationModeEnum.Average,
      scope: ScopeEnum.Hole,
      roundSelection: RoundSelectionEnum.All,
      userFilterMode: UserFilterModeEnum.Or,
    },
  },
  {
    name: 'Personal Avg of Last 3 Rounds',
    config: {
      scoreUserFilter: UserFilterEnum.EachUser,
      roundUserFilter: UserFilterEnum.TodaysPlayers,
      accumulationMode: AccumulationModeEnum.Average,
      scope: ScopeEnum.Round,
      roundSelection: RoundSelectionEnum.Latest3,
      userFilterMode: UserFilterModeEnum.Or,
    },
  },
  {
    name: 'Personal Best on Hole of Last 3 Rounds',
    config: {
      scoreUserFilter: UserFilterEnum.EachUser,
      roundUserFilter: UserFilterEnum.TodaysPlayers,
      accumulationMode: AccumulationModeEnum.Best,
      scope: ScopeEnum.Hole,
      roundSelection: RoundSelectionEnum.Latest3,
      userFilterMode: UserFilterModeEnum.Or,
    },
  },
  {
    name: 'Personal Best of Last 3 Rounds',
    config: {
      scoreUserFilter: UserFilterEnum.EachUser,
      roundUserFilter: UserFilterEnum.TodaysPlayers,
      accumulationMode: AccumulationModeEnum.Best,
      scope: ScopeEnum.Round,
      roundSelection: RoundSelectionEnum.Latest3,
      userFilterMode: UserFilterModeEnum.Or,
    },
  },
  {
    name: 'All Time Avg of Everyone',
    config: {
      scoreUserFilter: UserFilterEnum.Everyone,
      roundUserFilter: UserFilterEnum.Everyone,
      accumulationMode: AccumulationModeEnum.Average,
      scope: ScopeEnum.Hole,
      roundSelection: RoundSelectionEnum.All,
      userFilterMode: UserFilterModeEnum.Or,
    },
  },
];

interface CornerStatisticConfigModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (config: CornerConfig | null) => void;
  initialConfig: CornerConfig | null;
  courseName?: string;
  cornerPosition?: CornerPosition;
  currentRoundPlayers?: Player[]; // Players in the current round for preview
  currentRoundDate?: number; // Timestamp of the current round being viewed (to exclude rounds that started at the same time or after)
}

export default function CornerStatisticConfigModal({
  visible,
  onDismiss,
  onSave,
  initialConfig,
  courseName,
  cornerPosition,
  currentRoundPlayers = [],
  currentRoundDate,
}: CornerStatisticConfigModalProps) {
  const theme = useTheme();
  const [config, setConfig] = useState<CornerConfig>(
    initialConfig || (() => {
      const personalBestPreset = PRESETS.find(p => p.name === 'Personal Best on Hole');
      return personalBestPreset 
        ? { ...personalBestPreset.config, presetName: 'Personal Best on Hole', autoColor: true }
        : {
            scoreUserFilter: 'eachUser',
            roundUserFilter: 'everyone',
            accumulationMode: 'best',
            scope: 'hole',
            roundSelection: 'all',
            userFilterMode: 'or',
            autoColor: true,
          };
    })()
  );
  const [sinceDateInput, setSinceDateInput] = useState<string>('');
  const [untilDateInput, setUntilDateInput] = useState<string>('');
  const [showSinceDatePicker, setShowSinceDatePicker] = useState(false);
  const [showUntilDatePicker, setShowUntilDatePicker] = useState(false);
  const [tempSinceDate, setTempSinceDate] = useState<Date>(new Date());
  const [tempUntilDate, setTempUntilDate] = useState<Date>(new Date());
  const [users, setUsers] = useState<User[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [menuStates, setMenuStates] = useState<Record<string, boolean>>({});
  const [percentileInput, setPercentileInput] = useState<string>(TEXT_INITIAL_PERCENTILE);
  const [roundPickerVisible, setRoundPickerVisible] = useState(false);
  const [tempSelectedRoundIds, setTempSelectedRoundIds] = useState<string[]>([]);
  const [userRoundsModalVisible, setUserRoundsModalVisible] = useState(false);
  const [selectedPlayerForUserRounds, setSelectedPlayerForUserRounds] = useState<Player | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>(
    initialConfig ? PRESET_CUSTOM : 'Personal Best on Hole'
  );
  const isInitialMount = useRef(true);
  const isInitialRoundPickerMount = useRef(true);

  // Check if config matches a preset (ignoring optional fields like sinceDate, untilDate, percentile if not set)
  const matchesPreset = (config: CornerConfig, preset: Preset): boolean => {
    const presetConfig = preset.config;
    
    // Compare scoreUserFilter (handle arrays)
    if (Array.isArray(config.scoreUserFilter) && Array.isArray(presetConfig.scoreUserFilter)) {
      const configIds = [...config.scoreUserFilter].sort();
      const presetIds = [...presetConfig.scoreUserFilter].sort();
      if (configIds.length !== presetIds.length || !configIds.every((id, idx) => id === presetIds[idx])) {
        return false;
      }
    } else if (config.scoreUserFilter !== presetConfig.scoreUserFilter) {
      return false;
    }
    
    // Compare roundUserFilter (handle arrays)
    if (Array.isArray(config.roundUserFilter) && Array.isArray(presetConfig.roundUserFilter)) {
      const configIds = [...config.roundUserFilter].sort();
      const presetIds = [...presetConfig.roundUserFilter].sort();
      if (configIds.length !== presetIds.length || !configIds.every((id, idx) => id === presetIds[idx])) {
        return false;
      }
    } else if (config.roundUserFilter !== presetConfig.roundUserFilter) {
      return false;
    }
    
    if (config.accumulationMode !== presetConfig.accumulationMode) return false;
    if (config.scope !== presetConfig.scope) return false;
    
    // Compare roundSelection (handle specific rounds)
    if (typeof config.roundSelection === 'object' && config.roundSelection.type === ROUND_SELECTION_TYPE_SPECIFIC &&
        typeof presetConfig.roundSelection === 'object' && presetConfig.roundSelection.type === ROUND_SELECTION_TYPE_SPECIFIC) {
      const configIds = [...config.roundSelection.roundIds].sort();
      const presetIds = [...presetConfig.roundSelection.roundIds].sort();
      if (configIds.length !== presetIds.length || !configIds.every((id, idx) => id === presetIds[idx])) {
        return false;
      }
    } else if (config.roundSelection !== presetConfig.roundSelection) {
      return false;
    }
    
    if (config.userFilterMode !== presetConfig.userFilterMode) return false;
    
    // If percentile is set in preset, it must match
    if (presetConfig.percentile !== undefined) {
      if (config.percentile !== presetConfig.percentile) return false;
    } else {
      // If preset doesn't have percentile, config shouldn't either (or it should be undefined)
      if (config.percentile !== undefined) return false;
    }
    
    // Ignore sinceDate and untilDate for matching (they're optional filters)
    
    return true;
  };

  // Find matching preset or return null
  const findMatchingPreset = (config: CornerConfig): string => {
    for (const preset of PRESETS) {
      if (matchesPreset(config, preset)) {
        return preset.name;
      }
    }
    return PRESET_CUSTOM;
  };

  useEffect(() => {
    if (visible) {
      loadUsers();
      loadRounds();
      if (initialConfig) {
        setConfig(initialConfig);
        if (initialConfig.percentile) {
          setPercentileInput(initialConfig.percentile.toString());
        }
        // Initialize preset based on initial config
        // If presetName is stored, use it; otherwise try to match
        if (initialConfig.presetName) {
          setSelectedPreset(initialConfig.presetName);
        } else {
          const matchingPreset = findMatchingPreset(initialConfig);
          setSelectedPreset(matchingPreset);
        }
        // Initialize date inputs from config
        if (initialConfig.sinceDate && typeof initialConfig.sinceDate === 'object' && initialConfig.sinceDate.type === DATE_OPTION_CUSTOM) {
          const date = new Date(initialConfig.sinceDate.timestamp);
          setSinceDateInput(date.toISOString().split('T')[0]); // YYYY-MM-DD format
        }
        if (initialConfig.untilDate && typeof initialConfig.untilDate === 'object' && initialConfig.untilDate.type === DATE_OPTION_CUSTOM) {
          const date = new Date(initialConfig.untilDate.timestamp);
          setUntilDateInput(date.toISOString().split('T')[0]); // YYYY-MM-DD format
        }
      } else {
        // No initial config - apply "Personal Best on Hole" preset with autoColor
        const personalBestPreset = PRESETS.find(p => p.name === 'Personal Best on Hole');
        if (personalBestPreset) {
          setConfig({ ...personalBestPreset.config, presetName: 'Personal Best on Hole', autoColor: true });
          setSelectedPreset('Personal Best on Hole');
        }
      }
      isInitialMount.current = true;
    }
  }, [visible, initialConfig]);

  // Auto-save config changes (excluding round selection from round picker)
  // Include presetName in the saved config
  useEffect(() => {
    if (visible && !isInitialMount.current && !roundPickerVisible) {
      const configToSave = selectedPreset !== PRESET_CUSTOM 
        ? { ...config, presetName: selectedPreset }
        : (() => {
            // Clear presetName if switching to custom
            const { presetName: _, ...rest } = config;
            return rest;
          })();
      onSave(configToSave);
    }
    if (visible) {
      isInitialMount.current = false;
    }
  }, [config, visible, roundPickerVisible, selectedPreset]);

  // Auto-save round selection changes from round picker
  useEffect(() => {
    if (roundPickerVisible && !isInitialRoundPickerMount.current) {
      const newRoundSelection: RoundSelection = tempSelectedRoundIds.length > 0
        ? { type: 'specific' as const, roundIds: tempSelectedRoundIds }
        : 'all';
      setConfig(prev => {
        const updatedConfig: CornerConfig = { 
          ...prev, 
          roundSelection: newRoundSelection,
          presetName: selectedPreset !== PRESET_CUSTOM ? selectedPreset : prev.presetName
        };
        onSave(updatedConfig);
        return updatedConfig;
      });
    }
    if (roundPickerVisible) {
      isInitialRoundPickerMount.current = false;
    }
  }, [tempSelectedRoundIds, roundPickerVisible, selectedPreset]);

  const loadUsers = async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadRounds = async () => {
    if (!courseName) return;
    try {
      const allRounds = await getAllRounds();
      const courseRounds = allRounds.filter(r => r.courseName === courseName);
      setRounds(courseRounds);
    } catch (error) {
      console.error('Failed to load rounds:', error);
    }
  };

  const setMenuVisible = (key: string, visible: boolean) => {
    setMenuStates(prev => ({ ...prev, [key]: visible }));
  };

  const isMenuVisible = (key: string) => menuStates[key] || false;

  const updateConfig = (updates: Partial<CornerConfig>) => {
    setConfig(prev => {
      // If updating config manually (not from preset), preserve presetName only if it still matches
      const updated = { ...prev, ...updates };
      // Don't clear presetName here - let the useEffect handle it
      return updated;
    });
  };

  // Update selected preset when config changes (but preserve presetName if it exists)
  useEffect(() => {
    if (config.presetName) {
      // If presetName is set, keep it and verify it still matches
      const matchingPreset = findMatchingPreset(config);
      if (matchingPreset === config.presetName) {
        // Still matches, keep it
        setSelectedPreset(config.presetName);
      } else {
        // No longer matches, clear presetName
        setConfig(prev => {
          const { presetName: _, ...rest } = prev;
          return rest;
        });
        setSelectedPreset(matchingPreset);
      }
    } else {
      // Otherwise try to match
      const matchingPreset = findMatchingPreset(config);
      setSelectedPreset(matchingPreset);
    }
  }, [config]);

  // Apply a preset
  const applyPreset = (presetName: string) => {
    if (presetName === PRESET_CUSTOM) {
      // Clear preset name when switching to custom
      setConfig(prev => {
        const { presetName: _, ...rest } = prev;
        return rest;
      });
      setSelectedPreset(PRESET_CUSTOM);
      return;
    }
    
    const preset = PRESETS.find(p => p.name === presetName);
    if (preset) {
      setConfig({ ...preset.config, presetName });
      setSelectedPreset(presetName);
    }
  };

  const formatUserFilter = (userFilter: UserFilter): string => {
    if (userFilter === UserFilterEnum.Everyone) return USER_FILTER_LABELS[UserFilterEnum.Everyone];
    if (userFilter === UserFilterEnum.EachUser) return USER_FILTER_LABELS[UserFilterEnum.EachUser];
    if (userFilter === UserFilterEnum.TodaysPlayers) return USER_FILTER_LABELS[UserFilterEnum.TodaysPlayers];
    if (Array.isArray(userFilter)) {
      if (userFilter.length === 0) return USER_FILTER_LABELS[UserFilterEnum.Everyone];
      
      // Check if this matches all players from today's round
      const currentRoundPlayerIds = currentRoundPlayers.map(p => p.id).sort();
      const filterIds = [...userFilter].sort();
      const isTodayRound = currentRoundPlayerIds.length === filterIds.length &&
        currentRoundPlayerIds.every((id, idx) => id === filterIds[idx]);
      
      if (isTodayRound && currentRoundPlayerIds.length > 0) {
        return USER_FILTER_LABELS[UserFilterEnum.TodaysPlayers];
      }
      
      if (userFilter.length === 1) {
        const user = users.find(u => u.id === userFilter[0]);
        return user?.name || 'user';
      }
      // Format as "James and Alex" or "James, Fred, and Alex"
      const userNames = userFilter.map(id => users.find(u => u.id === id)?.name || 'user').filter(Boolean);
      if (userNames.length === 2) {
        return `${userNames[0]} and ${userNames[1]}`;
      } else if (userNames.length > 2) {
        const last = userNames.pop();
        return `${userNames.join(', ')}, and ${last}`;
      }
      return `${userFilter.length} users`;
    }
    return USER_FILTER_LABELS[UserFilterEnum.Everyone];
  };

  const formatRoundSelection = (selection: RoundSelection | undefined): string => {
    if (!selection) return ROUND_SELECTION_LABELS[RoundSelectionEnum.All];
    if (typeof selection === 'object' && selection.type === ROUND_SELECTION_TYPE_SPECIFIC) return TEXT_SELECTED_ROUNDS;
    return ROUND_SELECTION_LABELS[selection as RoundSelectionKey] || ROUND_SELECTION_LABELS[RoundSelectionEnum.All];
  };

  const formatAccumulationMode = (mode: AccumulationMode, percentile?: number): string => {
    if (mode === AccumulationModeEnum.Percentile) {
      return `${percentile || 50}th percentile`; // Note: "th" is part of the format, not a constant
    }
    return ACCUMULATION_MODE_LABELS[mode] || ACCUMULATION_MODE_LABELS[AccumulationModeEnum.Best];
  };

  const formatAccumulationDescription = (
    mode: AccumulationMode,
    userRoundCount: number,
    percentile?: number
  ): string => {
    // If only 1 user+round, just show "score from"
    if (userRoundCount === 1) {
      return TEXT_SCORE_FROM;
    }

    switch (mode) {
      case AccumulationModeEnum.Best:
        return TEXT_BEST_SCORE_DESC;
      case AccumulationModeEnum.Worst:
        return TEXT_WORST_SCORE_DESC;
      case AccumulationModeEnum.Average:
        return TEXT_AVERAGE_SCORE_DESC;
      case AccumulationModeEnum.Percentile:
        const pct = percentile || 50;
        if (pct < 50) {
          return `${pct}${TEXT_PERCENTILE_BELOW_DESC}`;
        } else {
          return `${pct}${TEXT_PERCENTILE_ABOVE_DESC}`;
        }
      case AccumulationModeEnum.Latest:
      case AccumulationModeEnum.First:
      case AccumulationModeEnum.Relevant:
      default:
        return TEXT_SCORE_FROM;
    }
  };

  const handleScoreUserFilterToggle = (userId: string) => {
    const currentFilter = config.scoreUserFilter;
    if (currentFilter === UserFilterEnum.Everyone || currentFilter === UserFilterEnum.EachUser) {
      updateConfig({ scoreUserFilter: [userId] });
    } else if (Array.isArray(currentFilter)) {
      if (currentFilter.includes(userId)) {
        const newFilter = currentFilter.filter(id => id !== userId);
        updateConfig({ scoreUserFilter: newFilter.length > 0 ? newFilter : UserFilterEnum.EachUser });
      } else {
        updateConfig({ scoreUserFilter: [...currentFilter, userId] });
      }
    }
  };

  const handleRoundUserFilterToggle = (userId: string) => {
    const currentFilter = config.roundUserFilter;
    if (currentFilter === UserFilterEnum.Everyone || 
        currentFilter === UserFilterEnum.EachUser || 
        currentFilter === UserFilterEnum.TodaysPlayers) {
      updateConfig({ roundUserFilter: [userId] });
    } else if (Array.isArray(currentFilter)) {
      if (currentFilter.includes(userId)) {
        const newFilter = currentFilter.filter(id => id !== userId);
        updateConfig({ roundUserFilter: newFilter.length > 0 ? newFilter : UserFilterEnum.Everyone });
      } else {
        updateConfig({ roundUserFilter: [...currentFilter, userId] });
      }
    }
  };

  // Check if "relevant" mode results in single round per player
  const validateRelevantMode = (): { isValid: boolean; message?: string } => {
    if (config.accumulationMode !== AccumulationModeEnum.Relevant) {
      return { isValid: true };
    }

    // For "relevant" mode, we need exactly one round per player
    // This means:
    // - Round selection must be 'latest', 'first', 'bestRound', 'bestRound2', 'worstRound', 'worstRound2', or a specific single round
    // - 'bestRounds2', 'bestRounds3', 'worstRounds2', and 'worstRounds3' are not allowed (they select multiple rounds)
    // - User filter can be anything, but each player should have exactly one round
    
    if (config.roundSelection === RoundSelectionEnum.All || 
        config.roundSelection === RoundSelectionEnum.Latest2 || 
        config.roundSelection === RoundSelectionEnum.Latest3 ||
        config.roundSelection === RoundSelectionEnum.BestRounds2 ||
        config.roundSelection === RoundSelectionEnum.BestRounds3 ||
        config.roundSelection === RoundSelectionEnum.WorstRounds2 ||
        config.roundSelection === RoundSelectionEnum.WorstRounds3) {
      return { 
        isValid: false, 
        message: TEXT_RELEVANT_MODE_WARNING
      };
    }

    if (typeof config.roundSelection === 'object' && config.roundSelection.type === ROUND_SELECTION_TYPE_SPECIFIC) {
      if (config.roundSelection.roundIds.length > 1) {
        return { 
          isValid: false, 
          message: TEXT_RELEVANT_MODE_WARNING_SINGLE
        };
      }
    }

    return { isValid: true };
  };

  const validation = validateRelevantMode();
  
  // Check if single-round options should be disabled for best/worst mode
  const shouldDisableSingleRoundOptions = (): boolean => {
    if (config.accumulationMode !== AccumulationModeEnum.Best && config.accumulationMode !== AccumulationModeEnum.Worst) {
      return false;
    }
    
    // If "each respective player" is selected, each user needs multiple rounds
    if (config.roundUserFilter === UserFilterEnum.EachUser) {
      return true;
    }
    
    // If only one user is selected, we need multiple rounds
    if (Array.isArray(config.roundUserFilter) && config.roundUserFilter.length === 1) {
      return true;
    }
    
    // If there's only one known user total, we need multiple rounds
    if (users.length === 1) {
      return true;
    }
    
    return false;
  };

  const disableSingleRoundOptions = shouldDisableSingleRoundOptions();
  
  // Auto-set round selection for 'latest' and 'first' modes
  useEffect(() => {
    if (config.accumulationMode === AccumulationModeEnum.Latest && config.roundSelection !== RoundSelectionEnum.Latest) {
      setConfig(prev => ({ ...prev, roundSelection: RoundSelectionEnum.Latest }));
    } else if (config.accumulationMode === AccumulationModeEnum.First && config.roundSelection !== RoundSelectionEnum.First) {
      setConfig(prev => ({ ...prev, roundSelection: RoundSelectionEnum.First }));
    }
  }, [config.accumulationMode, config.roundSelection]);

  // Get selected rounds for display
  const getSelectedRounds = (): Round[] => {
    if (typeof config.roundSelection === 'object' && config.roundSelection.type === ROUND_SELECTION_TYPE_SPECIFIC) {
      return rounds.filter(r => config.roundSelection && 
        typeof config.roundSelection === 'object' && 
        config.roundSelection.type === ROUND_SELECTION_TYPE_SPECIFIC &&
        config.roundSelection.roundIds.includes(r.id));
    }
    return [];
  };

  const selectedRounds = getSelectedRounds();
  const hasSelectedRounds = selectedRounds.length > 0;
  const hasSelectedRoundUsers = Array.isArray(config.roundUserFilter) && config.roundUserFilter.length > 0;
  const hasSelectedScoreUsers = Array.isArray(config.scoreUserFilter) && config.scoreUserFilter.length > 0;

  // Filter rounds based on roundUserFilter (for round picker)
  const getFilteredRounds = (): Round[] => {
    if (!courseName) return [];
    
    let filtered = rounds.filter(r => r.courseName === courseName);
    
    // Apply date filters first
    // Note: round.date is a timestamp. We need to compare dates in local timezone.
    if (config.sinceDate) {
      let sinceTimestamp: number;
      if (config.sinceDate === DATE_OPTION_BEGINNING) {
        sinceTimestamp = 0;
      } else if (config.sinceDate === DATE_OPTION_YEAR_AGO) {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        yearAgo.setHours(0, 0, 0, 0); // Start of day in local timezone
        sinceTimestamp = yearAgo.getTime();
      } else if (config.sinceDate === DATE_OPTION_MONTH_AGO) {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        monthAgo.setHours(0, 0, 0, 0); // Start of day in local timezone
        sinceTimestamp = monthAgo.getTime();
      } else {
        // Custom date - timestamp should already be set to start of day (00:00:00.000) in local timezone
        sinceTimestamp = config.sinceDate.timestamp;
      }
      // Filter: round.date >= sinceTimestamp (inclusive from start of since date)
      filtered = filtered.filter(round => round.date >= sinceTimestamp);
    }
    if (config.untilDate) {
      let untilTimestamp: number;
      if (config.untilDate === DATE_OPTION_TODAY) {
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today in local timezone
        untilTimestamp = today.getTime();
      } else if (config.untilDate === DATE_OPTION_YESTERDAY) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999); // End of yesterday in local timezone
        untilTimestamp = yesterday.getTime();
      } else {
        // Custom date - timestamp should already be set to end of day (23:59:59.999) in local timezone
        untilTimestamp = config.untilDate.timestamp;
      }
      // Filter: round.date <= untilTimestamp (inclusive until end of until date)
      filtered = filtered.filter(round => round.date <= untilTimestamp);
    }
    
    if (config.roundUserFilter === UserFilterEnum.Everyone) {
      return filtered;
    } else if (config.roundUserFilter === UserFilterEnum.EachUser) {
      // For 'eachUser', we'll show all rounds (the computation will filter per user)
      return filtered;
    } else if (config.roundUserFilter === UserFilterEnum.TodaysPlayers) {
      // For 'todaysPlayers', apply AND/OR logic based on userFilterMode
      const todaysPlayerIds = currentRoundPlayers.map(p => p.id);
      if (todaysPlayerIds.length > 0) {
        if (todaysPlayerIds.length > 1 && config.userFilterMode === UserFilterModeEnum.And) {
          // AND mode: Only include rounds where ALL of today's players are present
          return filtered.filter(round => 
            todaysPlayerIds.every((userId: string) => 
              round.players.some(p => p.id === userId)
            )
          );
        } else {
          // OR mode (default): Include rounds where ANY of today's players is a player
          return filtered.filter(round => 
            round.players.some(p => todaysPlayerIds.includes(p.id))
          );
        }
      }
      return filtered;
    } else if (Array.isArray(config.roundUserFilter)) {
      if (config.roundUserFilter.length > 1 && config.userFilterMode === UserFilterModeEnum.And) {
        // AND: Only include rounds where ALL selected users are players
        const selectedUserIds = config.roundUserFilter; // Type guard
        return filtered.filter(round => 
          selectedUserIds.every((userId: string) => 
            round.players.some(p => p.id === userId)
          )
        );
      } else {
        // OR or single user: Filter to rounds where at least one of the selected users is a player
        return filtered.filter(round => 
          round.players.some(p => config.roundUserFilter && Array.isArray(config.roundUserFilter) && config.roundUserFilter.includes(p.id))
        );
      }
    }
    
    return filtered;
  };

  const filteredRounds = getFilteredRounds();

  const handleOpenRoundPicker = () => {
    // Initialize temp selection with currently selected rounds
    if (typeof config.roundSelection === 'object' && config.roundSelection.type === ROUND_SELECTION_TYPE_SPECIFIC) {
      setTempSelectedRoundIds([...config.roundSelection.roundIds]);
    } else {
      setTempSelectedRoundIds([]);
    }
    isInitialRoundPickerMount.current = true;
    setRoundPickerVisible(true);
    setMenuVisible('rounds', false);
  };

  const handleToggleRoundSelection = (roundId: string) => {
    setTempSelectedRoundIds(prev => {
      if (prev.includes(roundId)) {
        return prev.filter(id => id !== roundId);
      } else {
        return [...prev, roundId];
      }
    });
  };

  const handleCloseRoundPicker = () => {
    setRoundPickerVisible(false);
    isInitialRoundPickerMount.current = true;
  };

  const handlePercentileChange = (text: string) => {
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0 && num <= 99) {
      setPercentileInput(text);
      updateConfig({ percentile: num });
    } else if (text === '') {
      setPercentileInput('');
    }
  };

  // Handle date picker changes (for custom dates)
  const handleOpenSinceDatePicker = () => {
    if (config.sinceDate && typeof config.sinceDate === 'object' && config.sinceDate.type === DATE_OPTION_CUSTOM) {
      setTempSinceDate(new Date(config.sinceDate.timestamp));
    } else {
      // Default to today (in local timezone)
      const today = new Date();
      today.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      setTempSinceDate(today);
    }
    setShowSinceDatePicker(true);
  };

  const handleSinceDatePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowSinceDatePicker(false);
    }
    if (selectedDate) {
      // Create date in local timezone (not UTC)
      const date = new Date(selectedDate);
      // Set to start of day (00:00:00.000) in local timezone
      date.setHours(0, 0, 0, 0);
      setTempSinceDate(date);
      // Format for display (YYYY-MM-DD in local timezone)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setSinceDateInput(`${year}-${month}-${day}`);
      // Store timestamp (this is in local timezone, start of day)
      updateConfig({ sinceDate: { type: 'custom', timestamp: date.getTime() } });
      if (Platform.OS === 'ios') {
        // On iOS, we'll show a confirm button
      } else {
        setShowSinceDatePicker(false);
      }
    }
  };

  const handleOpenUntilDatePicker = () => {
    if (config.untilDate && typeof config.untilDate === 'object' && config.untilDate.type === DATE_OPTION_CUSTOM) {
      setTempUntilDate(new Date(config.untilDate.timestamp));
    } else {
      // Default to today (in local timezone)
      const today = new Date();
      today.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      setTempUntilDate(today);
    }
    setShowUntilDatePicker(true);
  };

  const handleUntilDatePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowUntilDatePicker(false);
    }
    if (selectedDate) {
      // Create date in local timezone (not UTC)
      const date = new Date(selectedDate);
      // Set to end of day (23:59:59.999) in local timezone
      date.setHours(23, 59, 59, 999);
      setTempUntilDate(date);
      // Format for display (YYYY-MM-DD in local timezone)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setUntilDateInput(`${year}-${month}-${day}`);
      // Store timestamp (this is in local timezone, end of day)
      updateConfig({ untilDate: { type: 'custom', timestamp: date.getTime() } });
      if (Platform.OS === 'ios') {
        // On iOS, we'll show a confirm button
      } else {
        setShowUntilDatePicker(false);
      }
    }
  };

  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatSinceDate = (sinceDate?: SinceDateOption): string => {
    if (!sinceDate) return DATE_OPTION_LABELS[DATE_OPTION_BEGINNING];
    if (sinceDate === DATE_OPTION_BEGINNING) return DATE_OPTION_LABELS[DATE_OPTION_BEGINNING];
    if (sinceDate === DATE_OPTION_YEAR_AGO) return DATE_OPTION_LABELS[DATE_OPTION_YEAR_AGO];
    if (sinceDate === DATE_OPTION_MONTH_AGO) return DATE_OPTION_LABELS[DATE_OPTION_MONTH_AGO];
    if (typeof sinceDate === 'object' && sinceDate.type === DATE_OPTION_CUSTOM) {
      return new Date(sinceDate.timestamp).toLocaleDateString();
    }
    return DATE_OPTION_LABELS[DATE_OPTION_BEGINNING];
  };

  const formatUntilDate = (untilDate?: UntilDateOption): string => {
    if (!untilDate) return DATE_OPTION_LABELS[DATE_OPTION_TODAY];
    if (untilDate === DATE_OPTION_TODAY) return DATE_OPTION_LABELS[DATE_OPTION_TODAY];
    if (untilDate === DATE_OPTION_YESTERDAY) return DATE_OPTION_LABELS[DATE_OPTION_YESTERDAY];
    if (typeof untilDate === 'object' && untilDate.type === DATE_OPTION_CUSTOM) {
      return new Date(untilDate.timestamp).toLocaleDateString();
    }
    return DATE_OPTION_LABELS[DATE_OPTION_TODAY];
  };

  // Compute preview for each player
  const [previewData, setPreviewData] = useState<Array<{
    player: Player;
    rounds: Round[];
    userRounds: Array<{ userId: string; userName: string; round: Round }>; // User+Round combinations
    sampleScores: number[];
    result?: number;
  }>>([]);

  useEffect(() => {
    const computePreview = async () => {
      if (!courseName || currentRoundPlayers.length === 0) {
        setPreviewData([]);
        return;
      }

      // Step 1: Filter by course AND all date constraints together (since, until, currentRoundDate)
      // This is the first and most important filter - get rounds in the correct time window on the correct course
      // First, get courseId from courseName if we have it
      let targetCourseId: string | undefined = undefined;
      if (courseName) {
        const courses = await getAllCourses();
        const course = courses.find(c => c.name === courseName);
        if (course) {
          targetCourseId = course.id;
        }
      }
      
      let courseRounds = rounds.filter(round => {
        // Must be the correct course - prefer courseId, fallback to courseName
        if (targetCourseId) {
          if (round.courseId !== targetCourseId) return false;
        } else {
          if (round.courseName !== courseName) return false;
        }
        
        // Apply sinceDate filter
        if (config.sinceDate) {
          let sinceTimestamp: number;
          if (config.sinceDate === DATE_OPTION_BEGINNING) {
            sinceTimestamp = 0; // Beginning of time
          } else if (config.sinceDate === DATE_OPTION_YEAR_AGO) {
            const yearAgo = new Date();
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            yearAgo.setHours(0, 0, 0, 0); // Start of day in local timezone
            sinceTimestamp = yearAgo.getTime();
          } else if (config.sinceDate === DATE_OPTION_MONTH_AGO) {
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            monthAgo.setHours(0, 0, 0, 0); // Start of day in local timezone
            sinceTimestamp = monthAgo.getTime();
          } else {
            // Custom date - timestamp should already be set to start of day (00:00:00.000) in local timezone
            sinceTimestamp = config.sinceDate.timestamp;
          }
          // Filter: round.date >= sinceTimestamp (inclusive from start of since date)
          if (round.date < sinceTimestamp) return false;
        }
        
        // Apply untilDate filter
        if (config.untilDate) {
          let untilTimestamp: number;
          if (config.untilDate === DATE_OPTION_TODAY) {
            const today = new Date();
            today.setHours(23, 59, 59, 999); // End of today in local timezone
            untilTimestamp = today.getTime();
          } else if (config.untilDate === DATE_OPTION_YESTERDAY) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(23, 59, 59, 999); // End of yesterday in local timezone
            untilTimestamp = yesterday.getTime();
          } else {
            // Custom date - timestamp should already be set to end of day (23:59:59.999) in local timezone
            untilTimestamp = config.untilDate.timestamp;
          }
          // Filter: round.date <= untilTimestamp (inclusive until end of until date)
          if (round.date > untilTimestamp) return false;
        }
        
        // CRITICAL: Always exclude rounds that started at the same time or after the current round
        // This ensures we only consider historical data, not future or concurrent rounds
        if (currentRoundDate !== undefined) {
          // Exclude rounds where round.date >= currentRoundDate
          // We want rounds.date < currentRoundDate (strictly before)
          if (round.date >= currentRoundDate) {
            return false;
          }
        }
        
        return true;
      });
      
      // Get expected hole count for completion checking (after we have the filtered rounds)
      const expectedHoleCount = getExpectedHoleCount(courseRounds);
      
      // Step 0.5: VERY IMPORTANT - Filter to only include completed rounds (every hole has nonzero score)
      // This must be done early, before any other filtering
      // Filter based on scoreUserFilter to determine which users' completion to check
      if (config.scoreUserFilter === UserFilterEnum.EachUser) {
        // For eachUser, we'll filter per-player later, but for now filter to rounds where at least one player completed it
        courseRounds = courseRounds.filter(round => {
          return round.players.some(player => 
            isRoundComplete(round, player.id, expectedHoleCount)
          );
        });
      } else if (config.scoreUserFilter === UserFilterEnum.Everyone) {
        // For everyone, only include rounds where at least one player has completed it
        courseRounds = courseRounds.filter(round => {
          return round.players.some(player => 
            isRoundComplete(round, player.id, expectedHoleCount)
          );
        });
      } else if (Array.isArray(config.scoreUserFilter)) {
        // Only include rounds where at least one of the selected users has completed it
        const selectedUserIds = config.scoreUserFilter; // Type guard
        courseRounds = courseRounds.filter(round => {
          return selectedUserIds.some((userId: string) => 
            isRoundComplete(round, userId, expectedHoleCount)
          );
        });
      }
      
      const preview: Array<{
        player: Player;
        rounds: Round[];
        userRounds: Array<{ userId: string; userName: string; round: Round }>;
        sampleScores: number[];
        result?: number;
      }> = [];

      for (const player of currentRoundPlayers) {
        // Step 1: Filter rounds based on roundUserFilter (who played in the rounds)
        // Also filter to only include completed rounds for the relevant user(s)
        let roundFilteredRounds: Round[];
        if (config.roundUserFilter === UserFilterEnum.EachUser) {
          // Filter to rounds where the current player is a player AND has completed the round
          roundFilteredRounds = courseRounds.filter(round => 
            round.players.some(p => p.id === player.id) &&
            isRoundComplete(round, player.id, expectedHoleCount)
          );
        } else if (Array.isArray(config.roundUserFilter) && config.roundUserFilter.length > 1) {
          // Multiple users selected - apply AND/OR logic
          const selectedUserIds = config.roundUserFilter; // Type guard: we know it's an array here
          if (config.userFilterMode === UserFilterModeEnum.And) {
            // AND: Only include rounds where ALL selected users are players AND have completed the round
            roundFilteredRounds = courseRounds.filter(round => 
              selectedUserIds.every((userId: string) => 
                round.players.some(p => p.id === userId) &&
                isRoundComplete(round, userId, expectedHoleCount)
              )
            );
          } else {
            // OR (default): Include rounds where ANY selected user is a player AND has completed the round
            roundFilteredRounds = courseRounds.filter(round => 
              selectedUserIds.some((userId: string) => 
                round.players.some(p => p.id === userId) &&
                isRoundComplete(round, userId, expectedHoleCount)
              )
            );
          }
        } else if (config.roundUserFilter === UserFilterEnum.TodaysPlayers) {
          // For 'todaysPlayers', apply AND/OR logic based on userFilterMode
          const todaysPlayerIds = currentRoundPlayers.map(p => p.id);
          if (todaysPlayerIds.length > 0) {
            if (todaysPlayerIds.length > 1 && config.userFilterMode === UserFilterModeEnum.And) {
              // AND mode: Only include rounds where ALL of today's players are present AND have completed the round
              roundFilteredRounds = courseRounds.filter(round => 
                todaysPlayerIds.every((userId: string) => 
                  round.players.some(p => p.id === userId) &&
                  isRoundComplete(round, userId, expectedHoleCount)
                )
              );
            } else {
              // OR mode (default): Include rounds where ANY of today's players is a player AND has completed the round
              roundFilteredRounds = courseRounds.filter(round => 
                todaysPlayerIds.some((userId: string) => 
                  round.players.some(p => p.id === userId) &&
                  isRoundComplete(round, userId, expectedHoleCount)
                )
              );
            }
          } else {
            roundFilteredRounds = [];
          }
        } else {
          roundFilteredRounds = filterRoundsByUser(courseRounds, config.roundUserFilter, undefined);
          // Also filter to only include rounds where at least one relevant user has completed it
          if (config.scoreUserFilter === UserFilterEnum.EachUser) {
            roundFilteredRounds = roundFilteredRounds.filter(round =>
              isRoundComplete(round, player.id, expectedHoleCount)
            );
          } else if (Array.isArray(config.scoreUserFilter)) {
            const selectedUserIds = config.scoreUserFilter; // Type guard
            roundFilteredRounds = roundFilteredRounds.filter(round =>
              selectedUserIds.some((userId: string) =>
                isRoundComplete(round, userId, expectedHoleCount)
              )
            );
          } else {
            // For 'everyone', we already filtered in Step 0.5
          }
        }
        
        // Step 2: Select rounds by criteria
        const selectedRounds = await selectRoundsByCriteria(
          roundFilteredRounds,
          config.roundSelection,
          config.accumulationMode,
          player.id
        );

        // Step 3: Build user+round combinations based on scoreUserFilter
        // This shows which users' scores we're considering from the filtered rounds
        const userRounds: Array<{ userId: string; userName: string; round: Round }> = [];
        
        // Sort rounds by date to ensure we get the correct latest/first
        const sortedSelectedRounds = [...selectedRounds].sort((a, b) => {
          if (config.accumulationMode === AccumulationModeEnum.Latest) {
            return b.date - a.date; // Latest = most recent first
          } else if (config.accumulationMode === AccumulationModeEnum.First) {
            return a.date - b.date; // First = earliest first
          }
          return 0;
        });
        
        // Track which users we've already added (for latest/first modes)
        const addedUsers = new Set<string>();
        
        for (const round of sortedSelectedRounds) {
          if (config.scoreUserFilter === UserFilterEnum.EachUser) {
            // For eachUser, use the current player
            // Only include if the player has completed the round
            if (!isRoundComplete(round, player.id, expectedHoleCount)) {
              continue;
            }
            // For latest/first, only add once per user
            if (config.accumulationMode === AccumulationModeEnum.Latest || config.accumulationMode === AccumulationModeEnum.First) {
              if (addedUsers.has(player.id)) {
                continue; // Already added this user's round
              }
              addedUsers.add(player.id);
            }
            const user = users.find(u => u.id === player.id);
            if (user && round.players.some(p => p.id === player.id)) {
              userRounds.push({ userId: player.id, userName: user.name, round });
            }
          } else if (config.scoreUserFilter === UserFilterEnum.Everyone) {
            // For everyone, include all users from the round who have completed it
            // For latest/first, only add once per user
            for (const roundPlayer of round.players) {
              // Only include if this user has completed the round
              if (!isRoundComplete(round, roundPlayer.id, expectedHoleCount)) {
                continue;
              }
              if (config.accumulationMode === AccumulationModeEnum.Latest || config.accumulationMode === AccumulationModeEnum.First) {
                if (addedUsers.has(roundPlayer.id)) {
                  continue; // Already added this user's round
                }
                addedUsers.add(roundPlayer.id);
              }
              const user = users.find(u => u.id === roundPlayer.id);
              if (user) {
                userRounds.push({ userId: roundPlayer.id, userName: user.name, round });
              }
            }
          } else if (Array.isArray(config.scoreUserFilter)) {
            // For specific users, include those users from this round who have completed it
            for (const userId of config.scoreUserFilter) {
              // Check if this user is in the round and has completed it
              if (!round.players.some(p => p.id === userId) ||
                  !isRoundComplete(round, userId, expectedHoleCount)) {
                continue; // User not in this round or hasn't completed it
              }
              
              // For latest/first, only add once per user
              if (config.accumulationMode === AccumulationModeEnum.Latest || config.accumulationMode === AccumulationModeEnum.First) {
                if (addedUsers.has(userId)) {
                  continue; // Already added this user's round
                }
                addedUsers.add(userId);
              }
              
              const user = users.find(u => u.id === userId);
              if (user) {
                userRounds.push({ userId, userName: user.name, round });
              }
            }
          }
        }

        // Get sample scores (for a sample hole, e.g., hole 1) based on scoreUserFilter
        // Only use scores from users who have completed the round
        const sampleScores: number[] = [];
        for (const round of selectedRounds) {
          if (config.scoreUserFilter === UserFilterEnum.EachUser) {
            // Only include if the player has completed the round
            if (!isRoundComplete(round, player.id, expectedHoleCount)) {
              continue;
            }
            const score = round.scores?.find(
              s => s.holeNumber === 1 && s.playerId === player.id
            );
            if (score && score.throws >= 1) {
              sampleScores.push(score.throws);
            }
          } else if (config.scoreUserFilter === UserFilterEnum.Everyone) {
            const roundScores = round.scores?.filter(
              s => s.holeNumber === 1 && s.throws >= 1 && isRoundComplete(round, s.playerId, expectedHoleCount)
            ) || [];
            roundScores.forEach(s => sampleScores.push(s.throws));
          } else if (Array.isArray(config.scoreUserFilter)) {
            for (const userId of config.scoreUserFilter) {
              // Only include if this user has completed the round
              if (!isRoundComplete(round, userId, expectedHoleCount)) {
                continue;
              }
              const score = round.scores?.find(
                s => s.holeNumber === 1 && s.playerId === userId
              );
              if (score && score.throws >= 1) {
                sampleScores.push(score.throws);
              }
            }
          }
        }

        // Compute result if we have scores
        let result: number | undefined;
        if (sampleScores.length > 0) {
          switch (config.accumulationMode) {
            case AccumulationModeEnum.Best:
              result = Math.min(...sampleScores);
              break;
            case AccumulationModeEnum.Worst:
              result = Math.max(...sampleScores);
              break;
            case AccumulationModeEnum.Average:
              result = Math.round((sampleScores.reduce((a, b) => a + b, 0) / sampleScores.length) * 10) / 10;
              break;
            case AccumulationModeEnum.Latest:
              result = sampleScores[sampleScores.length - 1];
              break;
            case AccumulationModeEnum.First:
              result = sampleScores[0];
              break;
            case AccumulationModeEnum.Percentile:
              if (config.percentile !== undefined) {
                // IMPORTANT: For golf, percentiles are inverted (see computePercentile in cornerStatistics.ts)
                // Xth percentile means X% of scores are HIGHER/worse, so we use (100-X)th traditional percentile
                const sorted = [...sampleScores].sort((a, b) => a - b);
                const traditionalPercentile = 100 - config.percentile;
                const index = Math.ceil((traditionalPercentile / 100) * sorted.length) - 1;
                result = sorted[Math.max(0, Math.min(index, sorted.length - 1))];
              }
              break;
            case AccumulationModeEnum.Relevant:
              result = sampleScores[0];
              break;
          }
        }

        preview.push({
          player,
          rounds: selectedRounds,
          userRounds,
          sampleScores,
          result,
        });
      }

      setPreviewData(preview);
    };

    computePreview();
  }, [config, rounds, courseName, currentRoundPlayers, currentRoundDate]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <View style={styles.dialogHeader}>
          <Text style={[styles.dialogTitle, { color: theme.colors.onSurface }]}>
            {cornerPosition 
              ? `${TEXT_CONFIGURE} ${CORNER_LABELS[cornerPosition]} ${TEXT_CORNER_STATISTIC}`
              : `${TEXT_CONFIGURE} ${TEXT_CORNER_STATISTIC}`}
          </Text>
          <IconButton
            icon="close"
            size={24}
            onPress={onDismiss}
            iconColor={theme.colors.onSurface}
          />
        </View>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <Dialog.Content style={styles.content}>
              {/* Preset selector */}
              <View style={styles.presetContainer}>
                <Text style={[styles.presetLabel, { color: theme.colors.onSurface }]}>{TEXT_PRESET_LABEL}</Text>
                <Menu
                  visible={isMenuVisible('preset')}
                  onDismiss={() => setMenuVisible('preset', false)}
                  anchor={
                    <TouchableOpacity 
                      onPress={() => setMenuVisible('preset', true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownContainer}>
                        <Text selectable style={[styles.inlineLink, { color: theme.colors.onSurface, fontWeight: '700' }]}>
                          {selectedPreset}
                        </Text>
                        <Icon source="chevron-down" size={14} color={theme.colors.onSurfaceVariant} />
                      </View>
                    </TouchableOpacity>
                  }
                >
                  <Menu.Item
                    onPress={() => {
                      applyPreset(PRESET_CUSTOM);
                      setMenuVisible('preset', false);
                    }}
                    title={PRESET_CUSTOM}
                  />
                  {PRESETS.map(preset => (
                    <Menu.Item
                      key={preset.name}
                      onPress={() => {
                        applyPreset(preset.name);
                        setMenuVisible('preset', false);
                      }}
                      title={preset.name}
                    />
                  ))}
                </Menu>
              </View>
              <View style={[styles.presetDivider, { borderBottomColor: theme.colors.outline }]} />

              {/* Interactive sentence with inline dropdowns */}
              <View style={styles.sentenceContainer}>
                <Text selectable style={[styles.sentenceText, { color: theme.colors.onSurface }]}>{TEXT_FIND_THE}</Text>
                
                {/* Accumulation Mode */}
                <Menu
                  visible={isMenuVisible('accum')}
                  onDismiss={() => setMenuVisible('accum', false)}
                  anchor={
                    <TouchableOpacity 
                      onPress={() => setMenuVisible('accum', true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownContainer}>
                        <Text selectable style={[styles.inlineLink, { color: theme.colors.onSurface }]}>
                          {formatAccumulationMode(config.accumulationMode, config.percentile)}
                        </Text>
                        <Icon source="chevron-down" size={14} color={theme.colors.onSurfaceVariant} />
                      </View>
                    </TouchableOpacity>
                  }
                >
                  {ACCUMULATION_MODE_ITEMS.map(item => (
                    <Menu.Item
                      key={item.key}
                      onPress={() => {
                        updateConfig({ accumulationMode: item.key });
                        setMenuVisible('accum', false);
                      }}
                      title={item.label}
                    />
                  ))}
                </Menu>

                <Text selectable style={[styles.sentenceText, { color: theme.colors.onSurface }]}>{TEXT_SCORE_ON_EACH_HOLE}</Text>
                <View style={{ width: '100%' }} />
                <Text selectable style={[styles.sentenceText, { color: theme.colors.onSurface }]}>{TEXT_CONSIDERING_SCORES_FROM}</Text>

                {/* Score User Filter - Which users' scores to consider */}
                <Menu
                  visible={isMenuVisible('scoreUser')}
                  onDismiss={() => setMenuVisible('scoreUser', false)}
                  anchor={
                    <TouchableOpacity 
                      onPress={() => setMenuVisible('scoreUser', true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownContainer}>
                        <Text selectable style={[styles.inlineLink, { color: theme.colors.onSurface }]}>
                          {formatUserFilter(config.scoreUserFilter)}
                        </Text>
                        <Icon source="chevron-down" size={14} color={theme.colors.onSurfaceVariant} />
                      </View>
                    </TouchableOpacity>
                  }
                >
                  <Menu.Item
                    onPress={() => {
                      updateConfig({ scoreUserFilter: UserFilterEnum.Everyone });
                      setMenuVisible('scoreUser', false);
                    }}
                    title={USER_FILTER_LABELS[UserFilterEnum.Everyone]}
                  />
                  <Menu.Item
                    onPress={() => {
                      updateConfig({ scoreUserFilter: UserFilterEnum.EachUser });
                      setMenuVisible('scoreUser', false);
                    }}
                    title={USER_FILTER_LABELS[UserFilterEnum.EachUser]}
                  />
                  {currentRoundPlayers.length > 0 && (
                    <Menu.Item
                      onPress={() => {
                        updateConfig({ scoreUserFilter: UserFilterEnum.TodaysPlayers });
                        setMenuVisible('scoreUser', false);
                      }}
                      title={USER_FILTER_LABELS[UserFilterEnum.TodaysPlayers]}
                    />
                  )}
                  {users.map(user => {
                    const isSelected = Array.isArray(config.scoreUserFilter) && config.scoreUserFilter.includes(user.id);
                    return (
                      <Menu.Item
                        key={user.id}
                        onPress={() => handleScoreUserFilterToggle(user.id)}
                        title={user.name}
                        leadingIcon={isSelected ? 'check' : undefined}
                      />
                    );
                  })}
                </Menu>

                {/* AND/OR filter mode (only shown when multiple users selected in scoreUserFilter) */}
                {Array.isArray(config.scoreUserFilter) && config.scoreUserFilter.length > 1 && (
                  <>
                    <Menu
                      visible={isMenuVisible('scoreFilterMode')}
                      onDismiss={() => setMenuVisible('scoreFilterMode', false)}
                      anchor={
                        <TouchableOpacity 
                          onPress={() => setMenuVisible('scoreFilterMode', true)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.dropdownContainer}>
                            <Text selectable style={[styles.inlineLink, { color: theme.colors.onSurface }]}>
                              {config.userFilterMode === UserFilterModeEnum.And ? USER_FILTER_MODE_OPRIONS[UserFilterModeEnum.And] : USER_FILTER_MODE_OPRIONS[UserFilterModeEnum.Or]}
                            </Text>
                            <Icon source="chevron-down" size={14} color={theme.colors.onSurfaceVariant} />
                          </View>
                        </TouchableOpacity>
                      }
                    >
                      <Menu.Item
                        onPress={() => {
                          updateConfig({ userFilterMode: UserFilterModeEnum.And });
                          setMenuVisible('scoreFilterMode', false);
                        }}
                        title={USER_FILTER_MODE_LABELS[UserFilterModeEnum.And]}
                      />
                      <Menu.Item
                        onPress={() => {
                          updateConfig({ userFilterMode: UserFilterModeEnum.Or });
                          setMenuVisible('scoreFilterMode', false);
                        }}
                        title={USER_FILTER_MODE_LABELS[UserFilterModeEnum.Or]}
                      />
                    </Menu>
                  </>
                )}

                  <View style={{ width: '100%' }} />
                <Text selectable style={[styles.sentenceText, { color: theme.colors.onSurface }]}>in </Text>
                
                {/* Round Selection */}
                <Menu
                  visible={isMenuVisible('rounds')}
                  onDismiss={() => setMenuVisible('rounds', false)}
                  anchor={
                    <TouchableOpacity 
                      onPress={() => setMenuVisible('rounds', true)}
                      activeOpacity={0.7}
                      disabled={config.accumulationMode === AccumulationModeEnum.Latest || config.accumulationMode === AccumulationModeEnum.First}
                    >
                      <View style={[
                        styles.dropdownContainer,
                        (config.accumulationMode === AccumulationModeEnum.Latest || config.accumulationMode === AccumulationModeEnum.First) && styles.dropdownDisabled
                      ]}>
                        <Text selectable style={[styles.inlineLink, { 
                          color: (config.accumulationMode === AccumulationModeEnum.Latest || config.accumulationMode === AccumulationModeEnum.First) 
                            ? theme.colors.onSurfaceDisabled 
                            : theme.colors.onSurface 
                        }]}>
                          {formatRoundSelection(config.roundSelection)}
                        </Text>
                        {(config.accumulationMode !== AccumulationModeEnum.Latest && config.accumulationMode !== AccumulationModeEnum.First) && (
                          <Icon source="chevron-down" size={14} color={theme.colors.onSurfaceVariant} />
                        )}
                      </View>
                    </TouchableOpacity>
                  }
                >
                  {ROUND_SELECTION_MENU_ITEMS.map(item => {
                    // Skip if this item should only show for relevant mode and we're not in relevant mode
                    if (item.showOnlyForRelevant && config.accumulationMode !== AccumulationModeEnum.Relevant) {
                      return null;
                    }
                    
                    return (
                      <Menu.Item
                        key={item.key}
                        onPress={() => {
                          updateConfig({ roundSelection: item.key });
                          setMenuVisible('rounds', false);
                        }}
                        title={ROUND_SELECTION_LABELS[item.key]}
                        disabled={item.disableForSingleRound && disableSingleRoundOptions}
                      />
                    );
                  })}
                  <Menu.Item onPress={handleOpenRoundPicker} title={TEXT_SELECTED_ROUNDS} />
                </Menu>

                  <Text selectable style={[styles.sentenceText, { color: theme.colors.onSurface }]}> </Text>
                <Text selectable style={[styles.sentenceText, { color: theme.colors.onSurface }]}>{TEXT_PLAYED_BY}</Text>

                {/* Round User Filter - Which rounds to include based on who played */}
                <Menu
                  visible={isMenuVisible('roundUser')}
                  onDismiss={() => setMenuVisible('roundUser', false)}
                  anchor={
                    <TouchableOpacity 
                      onPress={() => setMenuVisible('roundUser', true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownContainer}>
                        <Text selectable style={[styles.inlineLink, { color: theme.colors.onSurface }]}>
                          {formatUserFilter(config.roundUserFilter)}
                        </Text>
                        <Icon source="chevron-down" size={14} color={theme.colors.onSurfaceVariant} />
                      </View>
                    </TouchableOpacity>
                  }
                >
                  <Menu.Item
                    onPress={() => {
                      updateConfig({ roundUserFilter: UserFilterEnum.Everyone });
                      setMenuVisible('roundUser', false);
                    }}
                    title={USER_FILTER_LABELS[UserFilterEnum.Everyone]}
                  />
                  {currentRoundPlayers.length > 0 && (
                    <Menu.Item
                      onPress={() => {
                        updateConfig({ roundUserFilter: UserFilterEnum.TodaysPlayers });
                        setMenuVisible('roundUser', false);
                      }}
                      title={USER_FILTER_LABELS[UserFilterEnum.TodaysPlayers]}
                    />
                  )}
                  {users.map(user => {
                    const isSelected = Array.isArray(config.roundUserFilter) && config.roundUserFilter.includes(user.id);
                    return (
                      <Menu.Item
                        key={user.id}
                        onPress={() => handleRoundUserFilterToggle(user.id)}
                        title={user.name}
                        leadingIcon={isSelected ? 'check' : undefined}
                      />
                    );
                  })}
                </Menu>

                {/* AND/OR filter mode (shown when multiple users selected in roundUserFilter or when todaysPlayers is selected with multiple players) */}
                {(() => {
                  const shouldShowFilterMode = 
                    (Array.isArray(config.roundUserFilter) && config.roundUserFilter.length > 1) ||
                    (config.roundUserFilter === UserFilterEnum.TodaysPlayers && currentRoundPlayers.length > 1);
                  
                  return shouldShowFilterMode ? (
                    <>
                      <Menu
                        visible={isMenuVisible('filterMode')}
                        onDismiss={() => setMenuVisible('filterMode', false)}
                        anchor={
                          <TouchableOpacity 
                            onPress={() => setMenuVisible('filterMode', true)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.dropdownContainer}>
                              <Text selectable style={[styles.inlineLink, { color: theme.colors.onSurface }]}>
                                {config.userFilterMode === UserFilterModeEnum.And ? USER_FILTER_MODE_LABELS[UserFilterModeEnum.And] : USER_FILTER_MODE_LABELS[UserFilterModeEnum.Or]}
                              </Text>
                              <Icon source="chevron-down" size={14} color={theme.colors.onSurfaceVariant} />
                            </View>
                          </TouchableOpacity>
                        }
                      >
                        <Menu.Item
                          onPress={() => {
                            updateConfig({ userFilterMode: UserFilterModeEnum.And });
                            setMenuVisible('filterMode', false);
                          }}
                          title={USER_FILTER_MODE_LABELS[UserFilterModeEnum.And]}
                        />
                        <Menu.Item
                          onPress={() => {
                            updateConfig({ userFilterMode: UserFilterModeEnum.Or });
                            setMenuVisible('filterMode', false);
                          }}
                          title={USER_FILTER_MODE_LABELS[UserFilterModeEnum.Or]}
                        />
                      </Menu>
                      {config.userFilterMode === UserFilterModeEnum.And && (
                        <Text selectable style={[styles.sentenceText, { color: theme.colors.onSurface }]}> in the same round</Text>
                      )}
                    </>
                  ) : null;
                })()}

                <View style={{ width: '100%' }} />
                <Text selectable style={[styles.sentenceText, { color: theme.colors.onSurface }]}>{TEXT_SINCE}</Text>
                
                {/* Since Date Filter */}
                <Menu
                  visible={isMenuVisible('sinceDate')}
                  onDismiss={() => setMenuVisible('sinceDate', false)}
                  anchor={
                    <TouchableOpacity 
                      onPress={() => setMenuVisible('sinceDate', true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownContainer}>
                        <Text selectable style={[styles.inlineLink, { color: theme.colors.onSurface }]}>
                          {formatSinceDate(config.sinceDate)}
                        </Text>
                        <Icon source="chevron-down" size={14} color={theme.colors.onSurfaceVariant} />
                      </View>
                    </TouchableOpacity>
                  }
                >
                  <Menu.Item
                    onPress={() => {
                      updateConfig({ sinceDate: DATE_OPTION_BEGINNING });
                      setMenuVisible('sinceDate', false);
                    }}
                    title={DATE_OPTION_LABELS[DATE_OPTION_BEGINNING]}
                  />
                  <Menu.Item
                    onPress={() => {
                      updateConfig({ sinceDate: DATE_OPTION_YEAR_AGO });
                      setMenuVisible('sinceDate', false);
                    }}
                    title={DATE_OPTION_LABELS[DATE_OPTION_YEAR_AGO]}
                  />
                  <Menu.Item
                    onPress={() => {
                      updateConfig({ sinceDate: DATE_OPTION_MONTH_AGO });
                      setMenuVisible('sinceDate', false);
                    }}
                    title={DATE_OPTION_LABELS[DATE_OPTION_MONTH_AGO]}
                  />
                  <Menu.Item
                    onPress={() => {
                      // Set to custom date (today by default)
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      setSinceDateInput(today.toISOString().split('T')[0]);
                      updateConfig({ sinceDate: { type: DATE_OPTION_CUSTOM, timestamp: today.getTime() } });
                      setMenuVisible('sinceDate', false);
                    }}
                    title={TEXT_SELECTED_DATE}
                  />
                </Menu>

                <Text selectable style={[styles.sentenceText, { color: theme.colors.onSurface }]}> {TEXT_UNTIL}</Text>
                
                {/* Until Date Filter */}
                <Menu
                  visible={isMenuVisible('untilDate')}
                  onDismiss={() => setMenuVisible('untilDate', false)}
                  anchor={
                    <TouchableOpacity 
                      onPress={() => setMenuVisible('untilDate', true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownContainer}>
                        <Text selectable style={[styles.inlineLink, { color: theme.colors.onSurface }]}>
                          {formatUntilDate(config.untilDate)}
                        </Text>
                        <Icon source="chevron-down" size={14} color={theme.colors.onSurfaceVariant} />
                      </View>
                    </TouchableOpacity>
                  }
                >
                  <Menu.Item
                    onPress={() => {
                      updateConfig({ untilDate: DATE_OPTION_TODAY });
                      setMenuVisible('untilDate', false);
                    }}
                    title={DATE_OPTION_LABELS[DATE_OPTION_TODAY]}
                  />
                  <Menu.Item
                    onPress={() => {
                      updateConfig({ untilDate: DATE_OPTION_YESTERDAY });
                      setMenuVisible('untilDate', false);
                    }}
                    title={DATE_OPTION_LABELS[DATE_OPTION_YESTERDAY]}
                  />
                  <Menu.Item
                    onPress={() => {
                      // Set to custom date (today by default)
                      // Use explicit date constructor to avoid timezone issues
                      const now = new Date();
                      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                      // Set to end of day (23:59:59.999) in local timezone
                      today.setHours(23, 59, 59, 999);
                      // Format for display (YYYY-MM-DD in local timezone)
                      const year = today.getFullYear();
                      const month = String(today.getMonth() + 1).padStart(2, '0');
                      const day = String(today.getDate()).padStart(2, '0');
                      setUntilDateInput(`${year}-${month}-${day}`);
                      // Store timestamp (in local timezone, end of day)
                      updateConfig({ untilDate: { type: DATE_OPTION_CUSTOM, timestamp: today.getTime() } });
                      setMenuVisible('untilDate', false);
                    }}
                    title={TEXT_SELECTED_DATE}
                  />
                </Menu>

                <Text selectable style={[styles.sentenceText, { color: theme.colors.onSurface }]}>.</Text>
              </View>

              {/* Date picker fields (shown when custom dates are selected) */}
              {config.sinceDate && typeof config.sinceDate === 'object' && config.sinceDate.type === 'custom' && (
                <View style={styles.dateInputContainer}>
                  <Text style={[styles.dateLabel, { color: theme.colors.onSurface }]}>Since Date:</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={sinceDateInput}
                      onChange={(e) => {
                        if (e.target.value) {
                          const date = new Date(e.target.value);
                          date.setHours(0, 0, 0, 0);
                          setSinceDateInput(e.target.value);
                          updateConfig({ sinceDate: { type: DATE_OPTION_CUSTOM, timestamp: date.getTime() } });
                        }
                      }}
                      style={{
                        width: 'auto',
                        minWidth: '120px',
                        height: '32px',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: theme.colors.outline,
                        borderRadius: '4px',
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        fontSize: '14px',
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.onSurface,
                      } as React.CSSProperties}
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={handleOpenSinceDatePicker}
                      style={[styles.datePickerButton, { 
                        borderColor: theme.colors.outline,
                        backgroundColor: theme.colors.surface 
                      }]}
                    >
                      <Text style={[styles.datePickerText, { color: theme.colors.onSurface }]}>
                        {formatDateForDisplay(new Date(config.sinceDate.timestamp))}
                      </Text>
                      <Icon source="calendar" size={18} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      setSinceDateInput('');
                      updateConfig({ sinceDate: undefined });
                    }}
                    style={styles.dateClearButton}
                  >
                    <Icon source="close" size={16} color={theme.colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
              )}
              {config.untilDate && typeof config.untilDate === 'object' && config.untilDate.type === 'custom' && (
                <View style={styles.dateInputContainer}>
                  <Text style={[styles.dateLabel, { color: theme.colors.onSurface }]}>Until Date:</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={untilDateInput}
                      onChange={(e) => {
                        if (e.target.value) {
                          // Parse date string as local date (not UTC)
                          const [year, month, day] = e.target.value.split('-').map(Number);
                          const date = new Date(year, month - 1, day);
                          // Set to end of day (23:59:59.999) in local timezone
                          date.setHours(23, 59, 59, 999);
                          setUntilDateInput(e.target.value);
                          // Store timestamp (in local timezone, end of day)
                          updateConfig({ untilDate: { type: DATE_OPTION_CUSTOM, timestamp: date.getTime() } });
                        }
                      }}
                      style={{
                        width: 'auto',
                        minWidth: '120px',
                        height: '32px',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: theme.colors.outline,
                        borderRadius: '4px',
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        fontSize: '14px',
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.onSurface,
                      } as React.CSSProperties}
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={handleOpenUntilDatePicker}
                      style={[styles.datePickerButton, { 
                        borderColor: theme.colors.outline,
                        backgroundColor: theme.colors.surface 
                      }]}
                    >
                      <Text style={[styles.datePickerText, { color: theme.colors.onSurface }]}>
                        {formatDateForDisplay(new Date(config.untilDate.timestamp))}
                      </Text>
                      <Icon source="calendar" size={18} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      setUntilDateInput('');
                      updateConfig({ untilDate: undefined });
                    }}
                    style={styles.dateClearButton}
                  >
                    <Icon source="close" size={16} color={theme.colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Date picker modals */}
              {Platform.OS !== 'web' && showSinceDatePicker && (
                <Portal>
                  <Dialog visible={showSinceDatePicker} onDismiss={() => setShowSinceDatePicker(false)}>
                    <Dialog.Title>Select Since Date</Dialog.Title>
                    <Dialog.Content>
                      <DateTimePicker
                        value={tempSinceDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleSinceDatePickerChange}
                      />
                    </Dialog.Content>
                    {Platform.OS === 'ios' && (
                      <Dialog.Actions>
                        <Button onPress={() => setShowSinceDatePicker(false)}>{TEXT_CANCEL}</Button>
                        <Button onPress={() => {
                          const date = new Date(tempSinceDate);
                          date.setHours(0, 0, 0, 0);
                          setSinceDateInput(date.toISOString().split('T')[0]);
                          updateConfig({ sinceDate: { type: DATE_OPTION_CUSTOM, timestamp: date.getTime() } });
                          setShowSinceDatePicker(false);
                        }}>{TEXT_DONE}</Button>
                      </Dialog.Actions>
                    )}
                  </Dialog>
                </Portal>
              )}

              {Platform.OS !== 'web' && showUntilDatePicker && (
                <Portal>
                  <Dialog visible={showUntilDatePicker} onDismiss={() => setShowUntilDatePicker(false)}>
                    <Dialog.Title>{TEXT_SELECT_UNTIL_DATE}</Dialog.Title>
                    <Dialog.Content>
                      <DateTimePicker
                        value={tempUntilDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleUntilDatePickerChange}
                      />
                    </Dialog.Content>
                    {Platform.OS === 'ios' && (
                      <Dialog.Actions>
                        <Button onPress={() => setShowUntilDatePicker(false)}>{TEXT_CANCEL}</Button>
                        <Button onPress={() => {
                          const date = new Date(tempUntilDate);
                          // Set to end of day (23:59:59.999) in local timezone
                          date.setHours(23, 59, 59, 999);
                          // Format for display (YYYY-MM-DD in local timezone)
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          setUntilDateInput(`${year}-${month}-${day}`);
                          // Store timestamp (in local timezone, end of day)
                          updateConfig({ untilDate: { type: DATE_OPTION_CUSTOM, timestamp: date.getTime() } });
                          setShowUntilDatePicker(false);
                        }}>{TEXT_DONE}</Button>
                      </Dialog.Actions>
                    )}
                  </Dialog>
                </Portal>
              )}

              {/* Percentile input (if percentile mode, shown below sentence) */}
              {config.accumulationMode === AccumulationModeEnum.Percentile && (
                <View style={styles.percentileContainer}>
                  <Text style={[styles.percentileLabel, { color: theme.colors.onSurface }]}>
                    {TEXT_PERCENTILE_LABEL}
                  </Text>
                  <TextInput
                    style={[styles.percentileInput, { 
                      borderColor: theme.colors.outline,
                      color: theme.colors.onSurface 
                    }]}
                    value={percentileInput}
                    onChangeText={handlePercentileChange}
                    keyboardType="numeric"
                    placeholder={TEXT_PLACEHOLDER_50}
                    maxLength={2}
                  />
                  <Text style={[styles.percentileLabel, { color: theme.colors.onSurface }]}>{TEXT_PERCENT_SYMBOL}</Text>
                </View>
              )}

              {/* Color options: Auto-color or Custom color */}
              <View style={styles.colorOptionsContainer}>
                <Text style={[styles.colorOptionsLabel, { color: theme.colors.onSurface }]}>
                  Corner Color
                </Text>
                <View style={styles.colorOptionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.colorOptionButton,
                      config.autoColor === true && styles.colorOptionButtonActive,
                      { borderColor: theme.colors.outline }
                    ]}
                    onPress={() => updateConfig({ autoColor: true, customColor: undefined })}
                  >
                    <Text style={[
                      styles.colorOptionText,
                      { color: config.autoColor === true ? theme.colors.primary : theme.colors.onSurface }
                    ]}>
                      Auto
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.colorOptionButton,
                      (config.autoColor !== true && config.customColor) ? styles.colorOptionButtonActive : undefined,
                      { borderColor: theme.colors.outline }
                    ]}
                    onPress={() => {
                      if (config.autoColor === true || !config.customColor) {
                        updateConfig({ autoColor: false, customColor: '#666666' });
                      }
                    }}
                  >
                    <View style={styles.customColorRow}>
                      <View style={[
                        styles.colorPreview,
                        { backgroundColor: config.customColor || '#666666' }
                      ]} />
                      <Text style={[
                        styles.colorOptionText,
                        { color: config.autoColor !== true && config.customColor ? theme.colors.primary : theme.colors.onSurface }
                      ]}>
                        Custom
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
                
                {/* Custom color picker (shown when custom is selected) */}
                {config.autoColor !== true && (
                  <View style={styles.customColorPickerContainer}>
                    <Text style={[styles.customColorLabel, { color: theme.colors.onSurface }]}>
                      Color:
                    </Text>
                    <View style={styles.colorPalette}>
                      {['#d32f2f', '#f57c00', '#388e3c', '#1976d2', '#7b1fa2', '#c2185b', '#fbc02d', '#455a64', '#000000', '#666666'].map((color) => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: color },
                            config.customColor === color && styles.colorSwatchSelected
                          ]}
                          onPress={() => updateConfig({ customColor: color, autoColor: false })}
                        />
                      ))}
                    </View>
                    <View style={styles.colorInputContainer}>
                      <Text style={[styles.colorLabel, { color: theme.colors.onSurface }]}>Color:</Text>
                      <View style={[
                        styles.colorPreview,
                        { backgroundColor: config.customColor || '#666666' }
                      ]} />
                      <TextInput
                        style={[
                          styles.colorInput,
                          {
                            borderColor: theme.colors.outline,
                            color: theme.colors.onSurface,
                            backgroundColor: theme.colors.surface
                          }
                        ]}
                        value={config.customColor || ''}
                        onChangeText={(text) => {
                          // Accept any text (CSS will validate)
                          updateConfig({ customColor: text || undefined, autoColor: false });
                        }}
                        placeholder="e.g. #000000, red, rgb(255,0,0)"
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Validation warning for "relevant" mode */}
              {!validation.isValid && (
                <View style={[styles.warningContainer, { backgroundColor: theme.colors.errorContainer }]}>
                  <Icon source="alert-circle" size={20} color={theme.colors.error} />
                  <Text style={[styles.warningText, { color: theme.colors.onErrorContainer }]}>
                    {validation.message}
                  </Text>
                </View>
              )}

              {/* Selected rounds/users display */}
              {(hasSelectedRounds || hasSelectedRoundUsers || hasSelectedScoreUsers) && (
                <View style={styles.selectedInfoContainer}>
                  <Text style={[styles.selectedInfoTitle, { color: theme.colors.onSurface }]}>{TEXT_USING}</Text>
                  
                  {hasSelectedRounds && (
                    <View style={styles.selectedInfoSection}>
                      <Text style={[styles.selectedInfoLabel, { color: theme.colors.onSurface }]}>
                        {TEXT_SELECTED_ROUNDS_LABEL}
                      </Text>
                      {selectedRounds.map(round => (
                        <Text key={round.id} style={[styles.selectedInfoItem, { color: theme.colors.onSurfaceVariant }]}>
                          {round.title}
                        </Text>
                      ))}
                    </View>
                  )}

                  {hasSelectedRoundUsers && (
                    <View style={styles.selectedInfoSection}>
                      <Text style={[styles.selectedInfoLabel, { color: theme.colors.onSurface }]}>
                        {TEXT_SELECTED_ROUND_USERS_LABEL}
                      </Text>
                      {Array.isArray(config.roundUserFilter) && config.roundUserFilter.map((userId: string) => {
                        const user = users.find(u => u.id === userId);
                        return user ? (
                          <Text key={userId} style={[styles.selectedInfoItem, { color: theme.colors.onSurfaceVariant }]}>
                            {user.name}
                          </Text>
                        ) : null;
                      })}
                    </View>
                  )}
                  {hasSelectedScoreUsers && (
                    <View style={styles.selectedInfoSection}>
                      <Text style={[styles.selectedInfoLabel, { color: theme.colors.onSurface }]}>
                        {TEXT_SELECTED_SCORE_USERS_LABEL}
                      </Text>
                      {Array.isArray(config.scoreUserFilter) && config.scoreUserFilter.map((userId: string) => {
                        const user = users.find(u => u.id === userId);
                        return user ? (
                          <Text key={userId} style={[styles.selectedInfoItem, { color: theme.colors.onSurfaceVariant }]}>
                            {user.name}
                          </Text>
                        ) : null;
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Preview section */}
              {currentRoundPlayers.length > 0 && previewData.length > 0 && (
                <View style={styles.previewContainer}>
                  <Text style={[styles.previewTitle, { color: theme.colors.onSurface }]}>Preview</Text>
                  {previewData.map((preview) => (
                    <View key={preview.player.id} style={styles.previewItem}>
                      <Text style={[styles.previewPlayerName, { color: theme.colors.onSurface }]}>
                        {preview.player.name}:
                      </Text>
                      {preview.userRounds.length > 0 ? (
                        <View style={styles.userRoundsContainer}>
                          <Text style={[styles.previewAccumulationText, { color: theme.colors.onSurfaceVariant }]}>
                            {formatAccumulationDescription(
                              config.accumulationMode,
                              preview.userRounds.length,
                              config.percentile
                            )}{' '}
                          </Text>
                          {preview.userRounds.slice(0, 3).map((userRound, idx) => {
                            const date = new Date(userRound.round.date);
                            const dateStr = date.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            });
                            return (
                              <Chip
                                key={`${userRound.userId}-${userRound.round.id}-${idx}`}
                                style={[styles.userRoundChip, { backgroundColor: theme.colors.surfaceVariant }]}
                                textStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}
                              >
                                {userRound.userName} • {dateStr}
                              </Chip>
                            );
                          })}
                          {preview.userRounds.length > 3 && (
                            <TouchableOpacity
                              onPress={() => {
                                setSelectedPlayerForUserRounds(preview.player);
                                setUserRoundsModalVisible(true);
                              }}
                            >
                              <Chip
                                style={[styles.userRoundChip, { backgroundColor: theme.colors.surfaceVariant }]}
                                textStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}
                              >
                                ...
                              </Chip>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <Text style={[styles.previewText, { color: theme.colors.onSurfaceVariant }]}>
                          {TEXT_NO_ROUNDS_FOUND}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </Dialog.Content>
          </ScrollView>
        </Dialog.ScrollArea>
        {initialConfig && (
          <Dialog.Actions>
            <Button 
              onPress={() => {
                onSave(null);
                onDismiss();
              }}
              textColor={theme.colors.error}
            >
              {TEXT_CLEAR}
            </Button>
          </Dialog.Actions>
        )}
      </Dialog>

      {/* User Rounds Modal */}
      <Dialog 
        visible={userRoundsModalVisible} 
        onDismiss={() => {
          setUserRoundsModalVisible(false);
          setSelectedPlayerForUserRounds(null);
        }} 
        style={styles.dialog}
      >
        <View style={styles.dialogHeader}>
          <Text style={[styles.dialogTitle, { color: theme.colors.onSurface }]}>
            {selectedPlayerForUserRounds ? `${selectedPlayerForUserRounds.name}${TEXT_ROUNDS_SUFFIX}` : TEXT_USER_ROUNDS}
          </Text>
          <IconButton
            icon="close"
            size={24}
            onPress={() => {
              setUserRoundsModalVisible(false);
              setSelectedPlayerForUserRounds(null);
            }}
            iconColor={theme.colors.onSurface}
          />
        </View>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <Dialog.Content style={styles.content}>
              {selectedPlayerForUserRounds && previewData.find(p => p.player.id === selectedPlayerForUserRounds.id) ? (
                <View style={styles.userRoundsModalContainer}>
                  {previewData.find(p => p.player.id === selectedPlayerForUserRounds.id)?.userRounds.map((userRound, idx) => {
                    const date = new Date(userRound.round.date);
                    const dateStr = date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });
                    return (
                      <Chip
                        key={`${userRound.userId}-${userRound.round.id}-${idx}`}
                        style={[styles.userRoundChip, { backgroundColor: theme.colors.surfaceVariant, marginBottom: 8 }]}
                        textStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}
                      >
                        {userRound.userName} • {dateStr}
                      </Chip>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  {TEXT_NO_ROUNDS_FOUND_EMPTY}
                </Text>
              )}
            </Dialog.Content>
          </ScrollView>
        </Dialog.ScrollArea>
      </Dialog>

      {/* Round Picker Modal */}
      <Dialog visible={roundPickerVisible} onDismiss={handleCloseRoundPicker} style={styles.dialog}>
        <View style={styles.dialogHeader}>
          <Text style={[styles.dialogTitle, { color: theme.colors.onSurface }]}>{TEXT_SELECT_ROUNDS}</Text>
          <IconButton
            icon="close"
            size={24}
            onPress={handleCloseRoundPicker}
            iconColor={theme.colors.onSurface}
          />
        </View>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <Dialog.Content style={styles.content}>
              {filteredRounds.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  {TEXT_NO_ROUNDS_FOUND_FILTER}
                </Text>
              ) : (
                filteredRounds.map(round => {
                  const isSelected = tempSelectedRoundIds.includes(round.id);
                  
                  // Calculate total scores for each player in this round
                  const playerScores = round.players.map(player => {
                    const scores = round.scores?.filter(s => s.playerId === player.id && s.throws >= 1) || [];
                    const totalScore = scores.reduce((sum, score) => sum + score.throws, 0);
                    return { player, totalScore, scoreCount: scores.length };
                  });
                  
                  return (
                    <TouchableOpacity
                      key={round.id}
                      onPress={() => handleToggleRoundSelection(round.id)}
                      style={styles.roundPickerItem}
                    >
                      <View style={styles.roundPickerItemContent}>
                        <Icon 
                          source={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} 
                          size={24} 
                          color={isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant} 
                        />
                        <View style={styles.roundPickerItemText}>
                          <Text style={[styles.roundPickerItemTitle, { color: theme.colors.onSurface }]}>
                            {round.title}
                          </Text>
                          <Text style={[styles.roundPickerItemSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                            {playerScores.map(({ player, totalScore }) => 
                              `${player.name}: ${totalScore > 0 ? totalScore : '-'}`
                            ).join(', ')}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </Dialog.Content>
          </ScrollView>
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    marginHorizontal: 8,
    paddingHorizontal: -4,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: -32,
    paddingBottom: 4,
    marginBottom: -4,
    marginTop: 0
  },
  dialogTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 0,
    paddingVertical: 0,
  },
  scrollArea: {
    maxHeight: 500,
    paddingHorizontal: 12
  },
  content: {
    paddingHorizontal: 0,
    marginHorizontal: 0,
    paddingTop: 20,
  },
  presetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingLeft: 0,
    paddingRight: 16,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  presetDivider: {
    borderBottomWidth: 1,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  percentileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    gap: 8,
  },
  autoColorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 16,
    paddingVertical: 8,
  },
  autoColorLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  percentileLabel: {
    fontSize: 16,
  },
  percentileInput: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    width: 45,
    fontSize: 16,
    textAlign: 'center',
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 50,
  },
  dateInput: {
    width: 'auto',
    minWidth: 120,
    height: 32,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  datePickerButton: {
    width: 'auto',
    minWidth: 120,
    height: 32,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerText: {
    fontSize: 14,
  },
  dateClearButton: {
    padding: 4,
  },
  sentenceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  sentenceText: {
    fontSize: 14,
    lineHeight: 26,
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingTop: 0,
    paddingBottom: 0,
    marginHorizontal: 2,
    gap: 0,
    fontStyle: 'italic',
  },
  dropdownDisabled: {
    opacity: 0.6,
  },
  inlineLink: {
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    flex: 1,
  },
  selectedInfoContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  selectedInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectedInfoSection: {
    marginBottom: 12,
  },
  selectedInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  selectedInfoItem: {
    fontSize: 14,
    marginLeft: 16,
    marginBottom: 2,
  },
  previewContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  previewItem: {
    marginBottom: 12,
  },
  previewPlayerName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 8,
  },
  userRoundsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginLeft: 8,
  },
  previewAccumulationText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  userRoundChip: {
    margin: 0,
    height: 28,
  },
  userRoundsModalContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewResult: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    marginLeft: 8,
  },
  actionChip: {
    marginHorizontal: 4,
  },
  saveChip: {
    backgroundColor: '#4CAF50',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  roundPickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  roundPickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roundPickerItemText: {
    flex: 1,
  },
  roundPickerItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  roundPickerItemSubtitle: {
    fontSize: 14,
  },
  roundPickerScoresContainer: {
    marginTop: 6,
    gap: 2,
  },
  roundPickerScoreText: {
    fontSize: 11,
    lineHeight: 16,
  },
  colorOptionsContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  colorOptionsLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  colorOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  colorOptionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  colorOptionButtonActive: {
    borderWidth: 2,
  },
  colorOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  customColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  customColorPickerContainer: {
    marginTop: 8,
  },
  customColorLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#000000',
    borderWidth: 3,
  },
  colorInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorLabel: {
    fontSize: 14,
  },
  colorInput: {
    width: 150,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
  },
});
