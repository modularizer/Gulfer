/**
 * Shared Round Card Component
 * Reusable card for displaying round information
 */

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { getShadowStyle } from '@/utils';
import PlayerChip from './PlayerChip';
import HashedImage from './HashedImage';
import { router } from 'expo-router';
import { sharedCardStyles } from './sharedCardStyles';
import { CardMode } from './CardModeToggle';
import { getCourseNameFromId, getPlayersForRound, getAllScoresForRound } from '@/services/storage/roundStorage';
import type { Round, Player, Score } from '@/services/storage/db/types';
import { schema, getDatabase } from '@/services/storage/db';
import { eq } from 'drizzle-orm';

interface RoundCardProps {
    round: Round;
    onPress?: () => void;
    onLongPress?: () => void;
    showCourse?: boolean;
    courseHoleCount?: number;
    showPhotos?: boolean;
    isSelected?: boolean;
    mode?: CardMode;
    courseName?: string; // Optional: if not provided, will be fetched from courseId
}

export default function RoundCard({
                                      round,
                                      onPress,
                                      onLongPress,
                                      showCourse = true,
                                      courseHoleCount,
                                      showPhotos = false,
                                      isSelected = false,
                                      mode = 'medium',
                                      courseName: providedCourseName,
                                  }: RoundCardProps) {
    const theme = useTheme();
    const [courseName, setCourseName] = useState<string | undefined>(providedCourseName);
    const [players, setPlayers] = useState<Player[]>([]);
    const [scores, setScores] = useState<Score[]>([]);
    const [photos, setPhotos] = useState<string[]>([]);

    // Fetch courseName from courseId if not provided
    useEffect(() => {
        if (!providedCourseName && round.courseId) {
            getCourseNameFromId(round.courseId).then(name => {
                setCourseName(name);
            });
        } else {
            setCourseName(providedCourseName);
        }
    }, [providedCourseName, round.courseId]);

    // Fetch players from userrounds
    useEffect(() => {
        getPlayersForRound(round.id).then(loadedPlayers => {
            setPlayers(loadedPlayers);
        });
    }, [round.id]);

    // Fetch scores from scoreStorage
    useEffect(() => {
        const loadScores = async () => {
            const loadedScores = await getAllScoresForRound(round.id);
            setScores(loadedScores);
        };
        loadScores();
    }, [round.id]);

    // Fetch photos from database
    useEffect(() => {
        const loadPhotos = async () => {
            if (showPhotos) {
                const db = await getDatabase();
                const loadedPhotos = await db
                    .select()
                    .from(schema.photos)
                    .where(eq(schema.photos.refId, round.id));
                // Photos are stored with hash, but we need the data URI for display
                // For now, use hash if available, otherwise skip
                setPhotos(loadedPhotos.map(p => p.hash).filter(Boolean));
            }
        };
        loadPhotos();
    }, [round.id, showPhotos]);

    const date = new Date(round.date);
    const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
    });
    const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });

    const playerScores = players.map((player) => {
        const total = scores
            ? scores
                .filter((s) => s.playerId === player.id)
                .reduce((sum, s) => sum + s.score, 0)
            : 0;
        return { player, total };
    });

    const winnerScore = Math.min(...playerScores.map((ps) => ps.total));
    const winner = playerScores.find((ps) => ps.total === winnerScore);

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            router.push(`/round/${round.id}/overview`);
        }
    };

    // List mode: just name in single row
    if (mode === 'list') {
        return (
            <TouchableOpacity
                onPress={handlePress}
                onLongPress={onLongPress}
                delayLongPress={300}
                activeOpacity={0.7}
                {...(Platform.OS === 'web' && onLongPress ? {
                    onContextMenu: (e: any) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onLongPress();
                    }
                } : {})}
            >
                <View style={[
                    {
                        padding: 12,
                        backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.outlineVariant,
                    }
                ]}>
                    <Text style={[{ color: theme.colors.onSurface, fontSize: 16 }]}>
                        {dateStr} {timeStr}{showCourse && courseName ? ` @ ${courseName}` : ''}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    // Large mode: up to 4 photos in row, description below
    if (mode === 'large') {
        const displayPhotos = showPhotos && photos ? photos.slice(0, 4) : [];
        return (
            <TouchableOpacity
                onPress={handlePress}
                onLongPress={onLongPress}
                delayLongPress={300}
                activeOpacity={0.7}
                {...(Platform.OS === 'web' && onLongPress ? {
                    onContextMenu: (e: any) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onLongPress();
                    }
                } : {})}
            >
                <Card style={[
                    sharedCardStyles.card,
                    { backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface },
                    getShadowStyle(2)
                ]}>
                    <Card.Content>
                        <View style={sharedCardStyles.header}>
                            <Text style={[sharedCardStyles.date, { color: theme.colors.onSurface }]}>
                                <Text style={sharedCardStyles.boldText}>
                                    {dateStr} {timeStr}
                                </Text>
                                {showCourse && courseName && (
                                    <>
                                        {' '}
                                        <Text style={sharedCardStyles.normalText}>
                                            @ {courseName} {courseHoleCount && courseHoleCount > 0 && `(${courseHoleCount} ⛳)`}
                                        </Text>
                                    </>
                                )}
                            </Text>
                        </View>

                        {displayPhotos.length > 0 && (
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                                {displayPhotos.map((photo, idx) => (
                                    <HashedImage
                                        key={idx}
                                        hash={photo}
                                        style={{ width: '23%', aspectRatio: 1, borderRadius: 8 }}
                                        contentFit="cover"
                                    />
                                ))}
                            </View>
                        )}

                        {round.notes && (
                            <Text
                                style={[sharedCardStyles.notesText, { color: theme.colors.onSurfaceVariant, marginBottom: 8 }]}
                                numberOfLines={3}
                                ellipsizeMode="tail"
                            >
                                {round.notes}
                            </Text>
                        )}

                        {playerScores.length > 0 && (
                            <View style={sharedCardStyles.playersContainer}>
                                {playerScores.map(({ player, total }) => {
                                    const isWinner = winner && player.id === winner.player.id;
                                    return (
                                        <PlayerChip
                                            key={player.id}
                                            player={player}
                                            score={total}
                                            isWinner={isWinner}
                                            onPress={() => router.push(`/round/${round.id}/holes`)}
                                        />
                                    );
                                })}
                            </View>
                        )}
                    </Card.Content>
                </Card>
            </TouchableOpacity>
        );
    }

    // Small mode: name and chips, no photos/notes
    if (mode === 'small') {
        return (
            <TouchableOpacity
                onPress={handlePress}
                onLongPress={onLongPress}
                delayLongPress={300}
                activeOpacity={0.7}
                {...(Platform.OS === 'web' && onLongPress ? {
                    onContextMenu: (e: any) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onLongPress();
                    }
                } : {})}
            >
                <Card style={[
                    sharedCardStyles.card,
                    { backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface },
                    getShadowStyle(2)
                ]}>
                    <Card.Content>
                        <View style={sharedCardStyles.header}>
                            <Text style={[sharedCardStyles.date, { color: theme.colors.onSurface }]}>
                                <Text style={sharedCardStyles.boldText}>
                                    {dateStr} {timeStr}
                                </Text>
                                {showCourse && courseName && (
                                    <>
                                        {' '}
                                        <Text style={sharedCardStyles.normalText}>
                                            @ {courseName} {courseHoleCount && courseHoleCount > 0 && `(${courseHoleCount} ⛳)`}
                                        </Text>
                                    </>
                                )}
                            </Text>
                        </View>

                        {playerScores.length > 0 && (
                            <View style={sharedCardStyles.playersContainer}>
                                {playerScores.map(({ player, total }) => {
                                    const isWinner = winner && player.id === winner.player.id;
                                    return (
                                        <PlayerChip
                                            key={player.id}
                                            player={player}
                                            score={total}
                                            isWinner={isWinner}
                                            onPress={() => router.push(`/round/${round.id}/holes`)}
                                        />
                                    );
                                })}
                            </View>
                        )}
                    </Card.Content>
                </Card>
            </TouchableOpacity>
        );
    }

    // Medium mode: current default behavior
    return (
        <TouchableOpacity
            onPress={handlePress}
            onLongPress={onLongPress}
            delayLongPress={300}
            activeOpacity={0.7}
            {...(Platform.OS === 'web' && onLongPress ? {
                onContextMenu: (e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onLongPress();
                }
            } : {})}
        >
            <Card style={[
                sharedCardStyles.card,
                { backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface },
                getShadowStyle(2)
            ]}>
                <Card.Content>
                    <View style={sharedCardStyles.header}>
                        <Text style={[sharedCardStyles.date, { color: theme.colors.onSurface }]}>
                            <Text style={sharedCardStyles.boldText}>
                                {dateStr} {timeStr}
                            </Text>
                            {showCourse && courseName && (
                                <>
                                    {' '}
                                    <Text style={sharedCardStyles.normalText}>
                                        @ {courseName} {courseHoleCount && courseHoleCount > 0 && `(${courseHoleCount} ⛳)`}
                                    </Text>
                                </>
                            )}
                        </Text>
                    </View>

                    {(showPhotos && photos && photos.length > 0) || round.notes ? (
                        <View style={sharedCardStyles.photoNotesRow}>
                            {showPhotos && photos && photos.length > 0 && (
                                <HashedImage
                                    hash={photos[0]}
                                    style={sharedCardStyles.image}
                                    contentFit="cover"
                                />
                            )}
                            {round.notes && (
                                <Text
                                    style={[sharedCardStyles.notesText, { color: theme.colors.onSurfaceVariant }]}
                                    numberOfLines={3}
                                    ellipsizeMode="tail"
                                >
                                    {round.notes}
                                </Text>
                            )}
                        </View>
                    ) : null}

                    {playerScores.length > 0 && (
                        <View style={sharedCardStyles.playersContainer}>
                            {playerScores.map(({ player, total }) => {
                                const isWinner = winner && player.id === winner.player.id;
                                return (
                                    <PlayerChip
                                        key={player.id}
                                        player={player}
                                        score={total}
                                        isWinner={isWinner}
                                        onPress={() => router.push(`/round/${round.id}/holes`)}
                                    />
                                );
                            })}
                        </View>
                    )}
                </Card.Content>
            </Card>
        </TouchableOpacity>
    );
}

