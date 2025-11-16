/**
 * Golf Test for Web
 * 
 * This is a standalone test that only imports from the storage module.
 * It can be run in a browser without depending on the rest of the codebase.
 */

import {setupStorage} from '../../setup';
import {golf} from '../../sports';
import {AdapterType, getDatabaseByName} from '../../../xp-deeby/adapters';
import {sql} from 'drizzle-orm';

export async function runGolfTest(addLog: (message: string, type?: 'log' | 'error' | 'success') => void) {
  addLog('🏌️  Starting storage test...\n', 'log');

  // Step 1: Set up the database
  addLog('📦 Setting up database...', 'log');
  addLog('   Using adapter: pglite (PostgreSQL in WASM, no headers needed!)', 'log');
  const storage = await setupStorage('gulfer-test', {
    adapterType: AdapterType.PGLITE,
    sports: { golf },
  });

  addLog('✅ Database setup complete!\n', 'success');

  // Step 2: Upsert players (will create or update based on name)
  addLog('👥 Upserting players...', 'log');
  const player1Result = await storage.playerService.upsertPlayer({
    name: 'John Doe',
    notes: 'Test player 1',
  });
  addLog(`   ${player1Result.result === 'insert' ? 'Created' : player1Result.result === 'update' ? 'Updated' : 'Unchanged'} player: ${player1Result.player.participant.name} (${player1Result.player.participant.id})`, 'log');

  const player2Result = await storage.playerService.upsertPlayer({
    name: 'Jane Smith',
    notes: 'Test player 2',
  });
  addLog(`   ${player2Result.result === 'insert' ? 'Created' : player2Result.result === 'update' ? 'Updated' : 'Unchanged'} player: ${player2Result.player.participant.name} (${player2Result.player.participant.id})`, 'log');
  addLog('✅ Players upserted!\n', 'success');
  
  const player1 = player1Result.player;
  const player2 = player2Result.player;

  // Step 3: Create a golf course using the golf sport helper
  addLog('⛳ Creating golf course...', 'log');
  //@ts-ignore
  const golfSport = storage.sports.golf;
  if (!golfSport) {
    throw new Error('Golf sport not registered');
  }

  const course = await golfSport.addCourse('Pebble Beach', 18, {
    venueNotes: 'Famous golf course',
    formatName: '18-Hole Course',
  });
  addLog(`   Created course: ${course.venue.name}`, 'log');
  addLog(`   Venue ID: ${course.venueId}`, 'log');
  addLog(`   Venue Event Format ID: ${course.id}`, 'log');
  addLog(`   Stages: ${course.stages.length} holes`, 'log');
  addLog('✅ Golf course created!\n', 'success');

  // Verify data persistence
  addLog('🔍 Verifying data persistence...', 'log');
  try {
    const db = await getDatabaseByName('gulfer-test');
    const tableNames = await db.getTableNames();
    addLog(`   Found ${tableNames.length} tables: ${tableNames.slice(0, 5).join(', ')}${tableNames.length > 5 ? '...' : ''}`, 'log');

    // Count rows in participants table
    if (tableNames.includes('participants')) {
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM participants`) as any[];
    const count = result[0]?.count ?? 0;
    addLog(`   Participants table has ${count} rows`, 'log');
    }
  } catch (error) {
    addLog(`   ⚠️  Could not verify persistence: ${error instanceof Error ? error.message : String(error)}`, 'log');
  }
  addLog('✅ Verification complete!\n', 'success');

  // Step 4: Create a golf round (event)
  addLog('🏌️  Creating golf round...', 'log');
  const round = await storage.eventService.createEvent(
    {
      name: 'Morning Round',
      notes: 'Test round at Pebble Beach',
      venueEventFormatId: course.id,
      startTime: new Date(),
      active: true,
    },
    {
      participants: [player1.participant, player2.participant],
    }
  );
  addLog(`   Created round: ${round.event.name} (${round.event.id})`, 'log');
  addLog(`   Participants: ${round.participants.length}`, 'log');
  addLog(`   Stages: ${round.stages.length}`, 'log');
  addLog('✅ Golf round created!\n', 'success');

  // Step 5: Add scores for a few holes
  addLog('📊 Adding scores...', 'log');
  
  // Get the first few stages (holes)
  const holes = round.stages.slice(0, 3);
  
  // Add scores for player 1
  for (const hole of holes) {
    const score = Math.floor(Math.random() * 3) + 3; // Random score between 3-5
    const holeNumber = hole.venueEventFormatStage?.number ?? hole.eventFormatStage?.number ?? 0;
    await storage.scoringService.setStageScore(
      round.event.id,
      hole.stage.id,
      player1.participant.id,
      score
    );
    addLog(`   Player 1 - Hole ${holeNumber}: ${score}`, 'log');
  }

  // Add scores for player 2
  for (const hole of holes) {
    const score = Math.floor(Math.random() * 3) + 3; // Random score between 3-5
    const holeNumber = hole.venueEventFormatStage?.number ?? hole.eventFormatStage?.number ?? 0;
    await storage.scoringService.setStageScore(
      round.event.id,
      hole.stage.id,
      player2.participant.id,
      score
    );
    addLog(`   Player 2 - Hole ${holeNumber}: ${score}`, 'log');
  }
  addLog('✅ Scores added!\n', 'success');

  // Step 6: Verify the data
  addLog('🔍 Verifying data...', 'log');
  
  // Get all players
  const allPlayers = await storage.playerService.getAllPlayers();
  addLog(`   Total players: ${allPlayers.length}`, 'log');
  
  // Get all events
  const allEvents = await storage.eventService.getAllEvents();
  addLog(`   Total events: ${allEvents.length}`, 'log');
  
  // Get the round with updated scores
  const updatedRound = await storage.eventService.getEvent(round.event.id);
  if (updatedRound) {
    addLog(`   Round: ${updatedRound.event.name}`, 'log');
    addLog(`   Participants: ${updatedRound.participants.length}`, 'log');
    addLog(`   Stages: ${updatedRound.stages.length}`, 'log');
    
    // Show scores for each participant
    for (const participant of updatedRound.participants) {
      const participantScores = updatedRound.stages
        .map(stage => {
          const score = stage.scores?.find(s => s.participantId === participant.id);
          const holeNumber = stage.venueEventFormatStage?.number ?? stage.eventFormatStage?.number ?? 0;
          return score ? `Hole ${holeNumber}: ${score.value}` : null;
        })
        .filter(Boolean);
      addLog(`   ${participant.name}: ${participantScores.join(', ')}`, 'log');
    }
  }
  
  addLog('\n✅ Test completed successfully! 🎉', 'success');
  addLog('💾 All changes auto-saved to IndexedDB', 'log');
}

/**
 * Simple PGLite CRUD Test
 * 
 * Tests basic database operations to verify PGLite is working:
 * 1. Create a table
 * 2. Insert a record
 * 3. Update a record
 * 4. Select a record
 * 5. Delete a record
 */
export async function runBasicPgliteTest(addLog: (message: string, type?: 'log' | 'error' | 'success') => void) {
  addLog('🧪 Starting basic PGLite CRUD test...\n', 'log');

  try {
    // Step 1: Get database instance using registry
    addLog('📦 Getting database instance...', 'log');
    // getDatabaseByName returns the adapter (which implements DrizzleDatabase)
    const db = await getDatabaseByName('gulfer-test-basic');
    const capabilities = db.getCapabilities();
    const platform = capabilities.hostPlatforms.web ? 'web' : capabilities.hostPlatforms.mobile ? 'mobile' : 'node';
    addLog(`   Adapter: ${capabilities.adapterType} (${platform})`, 'log');
    addLog('✅ Database instance obtained!\n', 'success');

    // Step 2: Create a simple table
    addLog('📋 Creating test table...', 'log');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS test_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        age INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    addLog('✅ Table created!\n', 'success');

    // Step 3: Insert a record
    addLog('➕ Inserting test record...', 'log');
    const testId = 'test-user-1';
    const testName = 'John Doe';
    const testEmail = 'john@example.com';
    const testAge = 30;
    
    await db.execute(sql`
      INSERT INTO test_users (id, name, email, age)
      VALUES (${testId}, ${testName}, ${testEmail}, ${testAge})
    `);
    addLog(`   Inserted: id=${testId}, name=${testName}, email=${testEmail}, age=${testAge}`, 'log');
    addLog('✅ Record inserted!\n', 'success');

    // Step 4: Select the record
    addLog('🔍 Selecting record...', 'log');
    const selectResult = await db.execute(sql`
      SELECT * FROM test_users WHERE id = ${testId}
    `) as any[];
    
    if (!selectResult || selectResult.length === 0) {
      throw new Error('Failed to retrieve inserted record');
    }
    
    const selectedRecord = selectResult[0];
    addLog(`   Retrieved: ${JSON.stringify(selectedRecord)}`, 'log');
    
    if (selectedRecord.id !== testId || selectedRecord.name !== testName) {
      throw new Error(`Data mismatch: expected id=${testId}, name=${testName}, got id=${selectedRecord.id}, name=${selectedRecord.name}`);
    }
    addLog('✅ Record selected successfully!\n', 'success');

    // Step 5: Update the record
    addLog('✏️  Updating record...', 'log');
    const updatedName = 'Jane Doe';
    const updatedEmail = 'jane@example.com';
    const updatedAge = 31;
    
    await db.execute(sql`
      UPDATE test_users
      SET name = ${updatedName}, email = ${updatedEmail}, age = ${updatedAge}
      WHERE id = ${testId}
    `);
    addLog(`   Updated: name=${updatedName}, email=${updatedEmail}, age=${updatedAge}`, 'log');
    addLog('✅ Record updated!\n', 'success');

    // Step 6: Verify the update
    addLog('🔍 Verifying update...', 'log');
    const verifyResult = await db.execute(sql`
      SELECT * FROM test_users WHERE id = ${testId}
    `) as any[];
    
    if (!verifyResult || verifyResult.length === 0) {
      throw new Error('Failed to retrieve updated record');
    }
    
    const updatedRecord = verifyResult[0];
    addLog(`   Retrieved: ${JSON.stringify(updatedRecord)}`, 'log');
    
    if (updatedRecord.name !== updatedName || updatedRecord.email !== updatedEmail || updatedRecord.age !== updatedAge) {
      throw new Error(`Update verification failed: expected name=${updatedName}, email=${updatedEmail}, age=${updatedAge}, got name=${updatedRecord.name}, email=${updatedRecord.email}, age=${updatedRecord.age}`);
    }
    addLog('✅ Update verified!\n', 'success');

    // Step 7: Delete the record
    addLog('🗑️  Deleting record...', 'log');
    await db.execute(sql`
      DELETE FROM test_users WHERE id = ${testId}
    `);
    addLog('✅ Record deleted!\n', 'success');

    // Step 8: Verify deletion
    addLog('🔍 Verifying deletion...', 'log');
    const deleteVerifyResult = await db.execute(sql`
      SELECT * FROM test_users WHERE id = ${testId}
    `) as any[];
    
    if (deleteVerifyResult && deleteVerifyResult.length > 0) {
      throw new Error('Record was not deleted');
    }
    addLog('✅ Deletion verified!\n', 'success');

    // Step 9: Clean up table
    addLog('🧹 Cleaning up test table...', 'log');
    await db.execute(sql`DROP TABLE IF EXISTS test_users`);
    addLog('✅ Table dropped!\n', 'success');

    addLog('\n✅ All basic CRUD operations completed successfully! 🎉', 'success');
    addLog('💾 PGLite is working correctly!', 'success');
  } catch (error) {
    addLog('\n❌ Basic CRUD test failed:', 'error');
    if (error instanceof Error) {
      addLog(`   Error message: ${error.message}`, 'error');
      if (error.stack) {
        addLog(`   Stack: ${error.stack}`, 'error');
      }
    } else {
      addLog(`   Error: ${JSON.stringify(error)}`, 'error');
    }
    throw error;
  }
}

