import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ResponseError, requireThat } from './contract.mjs';

// Temporary hackathon backend: single local Node process + on-disk SQLite.
// Collection state is a revisioned document; audit and revision history are append-only.
export function createResponseRepository(filename) {
  if(filename!==':memory:') mkdirSync(path.dirname(path.resolve(filename)),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS collections(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS history(collection_id TEXT, revision INTEGER, body TEXT NOT NULL, PRIMARY KEY(collection_id,revision));
    CREATE TABLE IF NOT EXISTS events(sequence INTEGER PRIMARY KEY AUTOINCREMENT, collection_id TEXT NOT NULL, kind TEXT NOT NULL, recipient TEXT, at TEXT NOT NULL, body TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS one_final_response ON events(collection_id,recipient) WHERE kind='RESPONSE_ACCEPTED';
    CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'immutable event'); END;
    CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'immutable event'); END;
    CREATE TRIGGER IF NOT EXISTS history_no_update BEFORE UPDATE ON history BEGIN SELECT RAISE(ABORT,'immutable revision'); END;
    CREATE TRIGGER IF NOT EXISTS history_no_delete BEFORE DELETE ON history BEGIN SELECT RAISE(ABORT,'immutable revision'); END;`);
  const get=id=>{const row=db.prepare('SELECT body FROM collections WHERE id=?').get(id);if(!row)throw new ResponseError('NOT_FOUND','Collection not found',404);return JSON.parse(row.body);};
  function commit(state, events) {
    const body=JSON.stringify(state);
    db.prepare('INSERT INTO history VALUES(?,?,?)').run(state.id,state.revision,body);
    db.prepare('INSERT INTO collections VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, body=excluded.body').run(state.id,state.revision,body);
    for(const e of events) db.prepare('INSERT INTO events(collection_id,kind,recipient,at,body) VALUES(?,?,?,?,?)').run(state.id,e.kind,e.recipientRef??null,e.at,JSON.stringify(e));
  }
  return { get,
    list:()=>db.prepare('SELECT body FROM collections ORDER BY rowid DESC').all().map(r=>JSON.parse(r.body)),
    create(state,event){db.exec('BEGIN IMMEDIATE');try{requireThat(!db.prepare('SELECT id FROM collections WHERE id=?').get(state.id),'ALREADY_EXISTS');commit(state,[event]);db.exec('COMMIT');return get(state.id);}catch(e){db.exec('ROLLBACK');throw e;}},
    transact(id,expectedRevision,fn){db.exec('BEGIN IMMEDIATE');try{const state=get(id);if(expectedRevision!=null)requireThat(state.revision===expectedRevision,'VERSION_CONFLICT');const result=fn(state);if(result.noWrite){db.exec('COMMIT');return result.value;}state.revision++;commit(state,result.events??[]);db.exec('COMMIT');return result.value??get(id);}catch(e){db.exec('ROLLBACK');throw e;}},
    events:id=>db.prepare('SELECT body FROM events WHERE collection_id=? ORDER BY sequence').all(id).map(r=>JSON.parse(r.body)),
    history:id=>db.prepare('SELECT body FROM history WHERE collection_id=? ORDER BY revision').all(id).map(r=>JSON.parse(r.body)),
    close:()=>db.close()
  };
}
