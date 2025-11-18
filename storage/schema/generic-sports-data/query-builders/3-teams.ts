/**
 * 3-Teams Query Builder
 * 
 * Handles recursive team queries with parent-child relationships.
 * Teams can have sub-teams, and leaf teams have members (players).
 * Depends on participants (2-participants.ts) since teams are participants with isTeam: true.
 * 
 * This file contains:
 * - Meta-types: Raw Drizzle join result types (camelCase)
 * - Result types: Grouped/denormalized structures with nested sub-teams
 * - Query builder: Type-safe, composable builder for recursive teams
 * 
 * Usage:
 * ```ts
 * const teams = await queryTeams(db)
 *   .forTeam(teamId)
 *   .withMembers()
 *   .execute();
 * ```
 */

import { eq, and, type SQL } from 'drizzle-orm';
import * as schema from '../tables';
import { type QueryBuilderState } from '../../../../xp-deeby/utils';
import type {
  Participant,
  TeamMember,
  ParticipantInsert,
  TeamMemberInsert,
} from '../tables';
import { deleteMissingChildren } from '../../../../xp-deeby/utils';
import { generateUUID } from '../../../../xp-deeby/utils';
import {Database} from "../../../../xp-deeby/adapters";

// ============================================================================
// Meta-Types: Raw Drizzle Join Result Types (camelCase)
// ============================================================================

/**
 * Base team join result
 */
export type TeamJoinBase = {
  participants: Participant;
};

/**
 * Team with members join
 */
export type TeamJoinWithMembers = TeamJoinBase & {
  teamMembers: TeamMember | null;
  memberParticipants: Participant | null;
};

/**
 * Full team join result
 */
export type TeamJoinFull = TeamJoinWithMembers;

// ============================================================================
// Result Types: Grouped/Denormalized Structures
// ============================================================================

/**
 * Team with all related storage and nested sub-teams
 * This is the recursive structure for teams
 */
export type TeamWithDetails = {
  // Team core storage
  team: Participant;
  
  // Recursive: sub-teams (teams that are members of this team)
  subTeams: TeamWithDetails[];
  
  // Leaf members (players, not teams)
  members: Participant[];
};

// ============================================================================
// Query Builder
// ============================================================================

type JoinFlags = {
  members: boolean;
};

type TeamJoinResult<F extends JoinFlags> = TeamJoinBase &
  (F['members'] extends true ? TeamJoinWithMembers : {});

type TeamBuilder<F extends JoinFlags = JoinFlags> = {
  forTeam(teamId: string): TeamBuilder<F>;
  withMembers(): TeamBuilder<F & { members: true }>;
  where(condition: SQL): TeamBuilder<F>;
  limit(n: number): TeamBuilder<F>;
  offset(n: number): TeamBuilder<F>;
  execute(): Promise<TeamWithDetails[]>;
  // Meta-type accessor
  $metaType: TeamJoinResult<F>;
};

/**
 * Build a tree structure from flat team results
 * Handles recursive parent-child relationships
 * 
 * Teams can have:
 * - Sub-teams (participants with isTeam: true in teamMembers)
 * - Members (participants with isTeam: false in teamMembers)
 */
function buildTeamTree(
  teams: {
    team: Participant;
    teamMembers: {
      teamMember: TeamMember;
      member: Participant;
    }[];
  }[]
): TeamWithDetails[] {
  // Create a map of all teams by their ID
  const teamMap = new Map<string, TeamWithDetails>();
  const rootTeams: TeamWithDetails[] = [];
  
  // First pass: create all team nodes
  for (const teamData of teams) {
    const teamId = teamData.team.id;
    
    if (teamMap.has(teamId)) {
      // Entry already exists, skip
      continue;
    }
    
    const team: TeamWithDetails = {
      team: teamData.team,
      subTeams: [],
      members: [],
    };
    
    teamMap.set(teamId, team);
  }
  
  // Second pass: organize members and sub-teams
  for (const teamData of teams) {
    const team = teamMap.get(teamData.team.id);
    if (!team) continue;
    
    for (const { teamMember, member } of teamData.teamMembers) {
      if (member.isTeam) {
        // This is a sub-team
        const subTeam = teamMap.get(member.id);
        if (subTeam) {
          team.subTeams.push(subTeam);
        }
      } else {
        // This is a leaf member (player)
        if (!team.members.find(m => m.id === member.id)) {
          team.members.push(member);
        }
      }
    }
  }
  
  // Third pass: identify root teams (teams that are not members of other teams in this set)
  const memberTeamIds = new Set<string>();
  for (const teamData of teams) {
    for (const { member } of teamData.teamMembers) {
      if (member.isTeam) {
        memberTeamIds.add(member.id);
      }
    }
  }
  
  for (const [teamId, team] of teamMap.entries()) {
    if (!memberTeamIds.has(teamId)) {
      rootTeams.push(team);
    }
  }
  
  // If no root teams found (all teams are sub-teams), return all teams
  return rootTeams.length > 0 ? rootTeams : Array.from(teamMap.values());
}

/**
 * Recursively fetch all sub-teams for a given team
 */
async function fetchAllSubTeams(
  db: Database,
  teamId: string,
  depth: number = 0
): Promise<{ team: Participant; teamMembers: { teamMember: TeamMember; member: Participant }[] }[]> {
  if (depth > 10) {
    console.warn('Maximum recursion depth reached for team hierarchy');
    return [];
  }
  
  // Fetch the team
  const teamResult = await db.select()
    .from(schema.participants)
    .where(and(
      eq(schema.participants.id, teamId),
      eq(schema.participants.isTeam, true)
    ))
    .limit(1);
  
  if (teamResult.length === 0) return [];
  
  const team = teamResult[0];
  
  // Fetch team members
  const teamMembersResult = await db.select()
    .from(schema.teamMembers)
    .leftJoin(schema.participants, eq(schema.teamMembers.participantId, schema.participants.id))
    .where(eq(schema.teamMembers.teamId, teamId));
  
  const teamMembers: { teamMember: TeamMember; member: Participant }[] = [];
  const subTeamIds: string[] = [];
  
  for (const row of teamMembersResult as any) {
    if (row.participants) {
      teamMembers.push({
        teamMember: row.team_members,
        member: row.participants,
      });
      
      // If this member is a team, we need to fetch it recursively
      if (row.participants.isTeam) {
        subTeamIds.push(row.participants.id);
      }
    }
  }
  

  
  const result: { team: Participant; teamMembers: { teamMember: TeamMember; member: Participant }[] }[] = [{
    team,
    teamMembers,
  }];
  
  // Recursively fetch all sub-teams
  for (const subTeamId of subTeamIds) {
    const subTeams = await fetchAllSubTeams(db, subTeamId, depth + 1);
    result.push(...subTeams);
  }
  
  return result;
}

/**
 * Start building a team query
 */
export function queryTeams(db: Database): TeamBuilder<{
  members: false;
}> {
  let selectQuery: any = null;
  let queryTeamId: string | null = null;
  
  const flags: JoinFlags = {
    members: false,
  };
  const state: QueryBuilderState = {};
  
  const createBuilder = <F extends JoinFlags>(): TeamBuilder<F> => ({
    forTeam(teamId: string) {
      queryTeamId = teamId;
      // Start with teams query (participants where isTeam = true)
      selectQuery = db.select()
        .from(schema.participants)
        .where(and(
          eq(schema.participants.id, teamId),
          eq(schema.participants.isTeam, true)
        ));
      return createBuilder<F>() as any;
    },
    
    withMembers() {
      // Members are handled in fetchAllSubTeams, so we just set the flag
      flags.members = true;
      return createBuilder<F & { members: true }>() as any;
    },
    
    where(condition: SQL) {
      state.whereCondition = condition;
      return createBuilder<F>();
    },
    
    limit(n: number) {
      state.limitValue = n;
      return createBuilder<F>();
    },
    
    offset(n: number) {
      state.offsetValue = n;
      return createBuilder<F>();
    },
    
    async execute(): Promise<TeamWithDetails[]> {
      if (!queryTeamId) {
        throw new Error('Must specify forTeam before executing');
      }
      
      // Fetch the main team and all its recursive sub-teams
      const allTeams = await fetchAllSubTeams(db, queryTeamId);
      
      // Build the recursive tree structure
      return buildTeamTree(allTeams);
    },
    
    $metaType: null as any as TeamJoinResult<F>,
  } as TeamBuilder<F>);
  
  return createBuilder();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Find all teams that a player belongs to (directly or through sub-teams)
 * 
 * @param db - Database instance
 * @param playerId - The player's participant ID
 * @returns Array of all teams the player belongs to, with full team details
 * 
 * Usage:
 * ```ts
 * const teams = await findTeamsForPlayer(db, playerId);
 * // Returns all teams (including parent teams) that contain this player
 * ```
 */
export async function findTeamsForPlayer(
  db: Database,
  playerId: string
): Promise<TeamWithDetails[]> {
  // First, find all teams that directly contain this player
  const directTeamMembers = await db.select()
    .from(schema.teamMembers)
    .leftJoin(schema.participants, eq(schema.teamMembers.teamId, schema.participants.id))
    .where(and(
      eq(schema.teamMembers.participantId, playerId),
      eq(schema.participants.isTeam, true)
    ));
  
  const directTeamIds = directTeamMembers
    .map((row: any) => row.participants?.id)
    .filter((id): id is string => !!id);
  
  if (directTeamIds.length === 0) {
    return [];
  }
  
  // Fetch all direct teams with their full details
  const allTeams: TeamWithDetails[] = [];
  
  for (const teamId of directTeamIds) {
    const teams = await queryTeams(db)
      .forTeam(teamId)
      .withMembers()
      .execute();
    
    if (teams.length > 0) {
      allTeams.push(teams[0]);
    }
  }
  
  // Now find all parent teams (teams that contain the teams we found)
  const parentTeamIds = new Set<string>();
  
  for (const teamId of directTeamIds) {
    const parentTeams = await findParentTeams(db, teamId);
    for (const parentTeamId of parentTeams) {
      parentTeamIds.add(parentTeamId);
    }
  }
  
  // Fetch parent teams
  for (const parentTeamId of parentTeamIds) {
    // Skip if we already have this team
    if (directTeamIds.includes(parentTeamId)) continue;
    
    const teams = await queryTeams(db)
      .forTeam(parentTeamId)
      .withMembers()
      .execute();
    
    if (teams.length > 0) {
      allTeams.push(teams[0]);
    }
  }
  
  return allTeams;
}

/**
 * Recursively find all parent teams for a given team
 * 
 * @param db - Database instance
 * @param teamId - The team's participant ID
 * @param visited - Set of visited team IDs to prevent infinite loops
 * @returns Array of parent team IDs
 */
async function findParentTeams(
  db: Database,
  teamId: string,
  visited: Set<string> = new Set()
): Promise<string[]> {
  if (visited.has(teamId)) {
    return []; // Prevent infinite loops
  }
  visited.add(teamId);
  
  // Find all teams that have this team as a member
  const parentTeamMembers = await db.select()
    .from(schema.teamMembers)
    .leftJoin(schema.participants, eq(schema.teamMembers.teamId, schema.participants.id))
    .where(and(
      eq(schema.teamMembers.participantId, teamId),
      eq(schema.participants.isTeam, true)
    ));
  
  const parentTeamIds = parentTeamMembers
    .map((row: any) => row.participants?.id)
    .filter((id): id is string => !!id);
  
  // Recursively find parents of parents
  const allParentIds = [...parentTeamIds];
  for (const parentId of parentTeamIds) {
    const grandParentIds = await findParentTeams(db, parentId, visited);
    allParentIds.push(...grandParentIds);
  }
  
  return allParentIds;
}

/**
 * Get a flat list of all team IDs a player belongs to
 * 
 * @param db - Database instance
 * @param playerId - The player's participant ID
 * @returns Array of team IDs (strings)
 * 
 * Usage:
 * ```ts
 * const teamIds = await getTeamIdsForPlayer(db, playerId);
 * ```
 */
export async function getTeamIdsForPlayer(
  db: Database,
  playerId: string
): Promise<string[]> {
  const teams = await findTeamsForPlayer(db, playerId);
  return teams.map(team => team.team.id);
}

/**
 * Flatten a team structure into a flat list of all players
 * Recursively traverses all sub-teams and collects only leaf members (players)
 * 
 * @param team - The team structure to flatten
 * @returns Flat array of all players in the team and all sub-teams
 * 
 * Usage:
 * ```ts
 * const team = await queryTeams(db).forTeam(teamId).withMembers().execute();
 * const allPlayers = flattenTeamToPlayers(team[0]);
 * ```
 */
export function flattenTeamToPlayers(team: TeamWithDetails): Participant[] {
  const players: Participant[] = [];
  
  // Add direct members (players) of this team
  players.push(...team.members);
  
  // Recursively add players from all sub-teams
  for (const subTeam of team.subTeams) {
    const subTeamPlayers = flattenTeamToPlayers(subTeam);
    players.push(...subTeamPlayers);
  }
  
  return players;
}

/**
 * Flatten multiple teams into a flat list of all players
 * 
 * @param teams - Array of team structures to flatten
 * @returns Flat array of all players from all teams and sub-teams
 */
export function flattenTeamsToPlayers(teams: TeamWithDetails[]): Participant[] {
  const allPlayers: Participant[] = [];
  
  for (const team of teams) {
    const players = flattenTeamToPlayers(team);
    allPlayers.push(...players);
  }
  
  return allPlayers;
}

/**
 * Get all unique players from a team (removes duplicates by ID)
 * 
 * @param team - The team structure
 * @returns Flat array of unique players
 */
export function getUniquePlayersFromTeam(team: TeamWithDetails): Participant[] {
  const players = flattenTeamToPlayers(team);
  const uniqueMap = new Map<string, Participant>();
  
  for (const player of players) {
    if (!uniqueMap.has(player.id)) {
      uniqueMap.set(player.id, player);
    }
  }
  
  return Array.from(uniqueMap.values());
}

// ============================================================================
// Upsert Functions
// ============================================================================

/**
 * Upsert teams with recursive sub-teams
 */
export async function upsertTeamWithDetails(
  db: Database,
  data: TeamWithDetails
): Promise<void> {
  // 1. Upsert the team
  await upsertEntity(db, schema.participants, {
    ...data.team,
    isTeam: true,
  } as Partial<ParticipantInsert>, { id: data.team.id });

  
  // 3. Collect all members (both sub-teams and leaf members)
  const allMemberIds: string[] = [];
  
  // Upsert sub-teams recursively
  for (const subTeam of data.subTeams) {
    await upsertTeamWithDetails(db, subTeam);
    allMemberIds.push(subTeam.team.id);
  }
  
  // Upsert leaf members
  for (const member of data.members) {
    await upsertEntity(db, schema.participants, {
      ...member,
      isTeam: false,
    } as Partial<ParticipantInsert>, { id: member.id });
    allMemberIds.push(member.id);
  }
  
  // 4. Upsert teamMembers links
  if (allMemberIds.length > 0) {
    const teamMembers = allMemberIds.map(memberId => ({
      id: generateUUID(),
      teamId: data.team.id,
      participantId: memberId,
    }));

    teamMembers.map((tm: any) => {
        db.upsertWhere(schema.teamMembers, tm, {id: tm.id})
    })
    
    // Delete teamMembers that are no longer in the list
    const keepTeamMemberIds = teamMembers.map(tm => tm.id).filter((id): id is string => !!id);
    await deleteMissingChildren(
      db,
      schema.teamMembers,
      schema.teamMembers.teamId,
      data.team.id,
      keepTeamMemberIds
    );
  } else {
    // Delete all team members if none provided
    await db.delete(schema.teamMembers)
      .where(eq(schema.teamMembers.teamId, data.team.id));
  }
}

