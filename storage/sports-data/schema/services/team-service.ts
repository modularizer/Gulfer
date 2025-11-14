/**
 * Team Service
 * 
 * Object-oriented service for managing teams (participants with isTeam: true).
 * Provides high-level methods for team operations, including recursive team hierarchies.
 */

import { BaseService } from './base';
import type { Database } from '../../../adapters';
import {
  queryTeams,
  upsertTeamWithDetails,
  findTeamsForPlayer,
  getTeamIdsForPlayer,
  flattenTeamToPlayers,
  flattenTeamsToPlayers,
  getUniquePlayersFromTeam,
  type TeamWithDetails,
} from '../query-builders';
import { eq, and, like } from 'drizzle-orm';
import * as schema from '../tables';
import type { Participant, Account } from '../tables';
import { generateUUID } from '@utils/uuid';

export class TeamService extends BaseService {
  /**
   * Get a team by ID with all related storage (including sub-teams and members)
   */
  async getTeam(teamId: string): Promise<TeamWithDetails | null> {
    const teams = await queryTeams(this.db)
      .forTeam(teamId)
      .withMembers()
      .withAccount()
      .execute();
    
    return teams.length > 0 ? teams[0] : null;
  }

  /**
   * Get multiple teams by IDs
   */
  async getTeams(teamIds: string[]): Promise<TeamWithDetails[]> {
    const results: TeamWithDetails[] = [];
    
    for (const teamId of teamIds) {
      const team = await this.getTeam(teamId);
      if (team) {
        results.push(team);
      }
    }
    
    return results;
  }

  /**
   * Get all teams
   */
  async getAllTeams(): Promise<TeamWithDetails[]> {
    const allParticipants = await this.db
      .select()
      .from(schema.participants)
      .where(eq(schema.participants.isTeam, true));
    
    const teamIds = allParticipants.map(p => p.id);
    return await this.getTeams(teamIds);
  }

  /**
   * Get teams by name (case-insensitive search)
   */
  async getTeamsByName(name: string): Promise<TeamWithDetails[]> {
    const teams = await this.db
      .select()
      .from(schema.participants)
      .where(
        and(
          eq(schema.participants.isTeam, true),
          like(schema.participants.name, `%${name}%`)
        )
      );
    
    const teamIds = teams.map(t => t.id);
    return await this.getTeams(teamIds);
  }

  /**
   * Create or update a team
   */
  async saveTeam(team: TeamWithDetails): Promise<void> {
    // Ensure isTeam is true for the team and false for members
    const teamData = {
      ...team,
      team: {
        ...team.team,
        isTeam: true,
      },
      members: team.members.map(m => ({
        ...m,
        isTeam: false,
      })),
    };
    
    await upsertTeamWithDetails(this.db, teamData);
  }

  /**
   * Create a new team
   */
  async createTeam(
    participant: Partial<Participant>,
    options: {
      account?: Partial<Account> | null;
      subTeams?: TeamWithDetails[];
      members?: Participant[];
    } = {}
  ): Promise<TeamWithDetails> {
    const teamData: TeamWithDetails = {
      team: {
        id: participant.id || generateUUID(),
        name: participant.name || null,
        notes: participant.notes || null,
        lat: participant.lat ?? 0,
        lng: participant.lng ?? 0,
        metadata: participant.metadata || null,
        isTeam: true,
      } as Participant,
      account: options.account ? {
        id: options.account.id || generateUUID(),
        participantId: participant.id || '',
        ...options.account,
      } as Account : null,
      subTeams: options.subTeams || [],
      members: (options.members || []).map(m => ({
        ...m,
        isTeam: false,
      })),
    };
    
    await this.saveTeam(teamData);
    
    const saved = await this.getTeam(teamData.team.id);
    if (!saved) {
      throw new Error('Failed to create team');
    }
    
    return saved;
  }

  /**
   * Update a team
   */
  async updateTeam(
    teamId: string,
    updates: Partial<Participant>,
    options: {
      accountUpdates?: Partial<Account> | null;
      subTeams?: TeamWithDetails[];
      members?: Participant[];
    } = {}
  ): Promise<TeamWithDetails> {
    const existing = await this.getTeam(teamId);
    if (!existing) {
      throw new Error(`Team not found: ${teamId}`);
    }
    
    const updated: TeamWithDetails = {
      ...existing,
      team: {
        ...existing.team,
        ...updates,
        isTeam: true, // Ensure it stays true
      },
      account: options.accountUpdates ? {
        ...existing.account,
        ...options.accountUpdates,
      } as Account : existing.account,
      subTeams: options.subTeams !== undefined ? options.subTeams : existing.subTeams,
      members: options.members !== undefined ? options.members : existing.members,
    };
    
    await this.saveTeam(updated);
    
    const saved = await this.getTeam(teamId);
    if (!saved) {
      throw new Error('Failed to update team');
    }
    
    return saved;
  }

  /**
   * Delete a team
   */
  async deleteTeam(teamId: string): Promise<void> {
    await this.deleteById(schema.participants, teamId);
  }

  /**
   * Add a member to a team (player or sub-team)
   */
  async addMember(teamId: string, memberId: string): Promise<void> {
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }
    
    const member = await this.db
      .select()
      .from(schema.participants)
      .where(eq(schema.participants.id, memberId))
      .limit(1);
    
    if (member.length === 0) {
      throw new Error(`Member not found: ${memberId}`);
    }
    
    const memberData = member[0];
    
    if (memberData.isTeam) {
      // Add as sub-team
      const subTeam = await this.getTeam(memberId);
      if (subTeam) {
        const updatedSubTeams = [...team.subTeams, subTeam];
        await this.updateTeam(teamId, {}, { subTeams: updatedSubTeams });
      }
    } else {
      // Add as member
      const updatedMembers = [...team.members, memberData as Participant];
      await this.updateTeam(teamId, {}, { members: updatedMembers });
    }
  }

  /**
   * Remove a member from a team
   */
  async removeMember(teamId: string, memberId: string): Promise<void> {
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }
    
    // Remove from sub-teams
    const updatedSubTeams = team.subTeams.filter(st => st.team.id !== memberId);
    
    // Remove from members
    const updatedMembers = team.members.filter(m => m.id !== memberId);
    
    await this.updateTeam(teamId, {}, {
      subTeams: updatedSubTeams,
      members: updatedMembers,
    });
  }

  /**
   * Get all teams a player belongs to
   */
  async getTeamsForPlayer(playerId: string): Promise<TeamWithDetails[]> {
    return await findTeamsForPlayer(this.db, playerId);
  }

  /**
   * Get all team IDs a player belongs to
   */
  async getTeamIdsForPlayer(playerId: string): Promise<string[]> {
    return await getTeamIdsForPlayer(this.db, playerId);
  }

  /**
   * Flatten a team into a flat list of all players
   */
  flattenToPlayers(team: TeamWithDetails): Participant[] {
    return flattenTeamToPlayers(team);
  }

  /**
   * Flatten multiple teams into a flat list of all players
   */
  flattenTeamsToPlayers(teams: TeamWithDetails[]): Participant[] {
    return flattenTeamsToPlayers(teams);
  }

  /**
   * Get all unique players from a team (removes duplicates)
   */
  getUniquePlayers(team: TeamWithDetails): Participant[] {
    return getUniquePlayersFromTeam(team);
  }
}

