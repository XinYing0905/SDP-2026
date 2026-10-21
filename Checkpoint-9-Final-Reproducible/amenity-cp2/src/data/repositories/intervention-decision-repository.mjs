import { createResponseRepository } from '../../cp6/repository.mjs';
import { DatabaseSync } from 'node:sqlite';
// Reuse approved transactional append-only SQLite document/event primitives in a separate CP7 DB.
// Never open or mutate the CP6 response database from this repository.
export function createInterventionDecisionRepository(filename){
 const repository=createResponseRepository(filename),sources=new DatabaseSync(filename);
 sources.exec(`PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS cp7_source_registry(id TEXT PRIMARY KEY,body TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS cp7_sources_no_update BEFORE UPDATE ON cp7_source_registry BEGIN SELECT RAISE(ABORT,'immutable source'); END;
 CREATE TRIGGER IF NOT EXISTS cp7_sources_no_delete BEFORE DELETE ON cp7_source_registry BEGIN SELECT RAISE(ABORT,'immutable source'); END;`);
 return {...repository,loadDemoSources(factory){sources.exec('BEGIN IMMEDIATE');try{let row=sources.prepare('SELECT body FROM cp7_source_registry WHERE id=?').get('synthetic-catalogue-1');if(!row){row={body:JSON.stringify(factory())};sources.prepare('INSERT INTO cp7_source_registry VALUES(?,?)').run('synthetic-catalogue-1',row.body);}sources.exec('COMMIT');return JSON.parse(row.body);}catch(e){sources.exec('ROLLBACK');throw e;}},close(){repository.close();sources.close();}};
}
