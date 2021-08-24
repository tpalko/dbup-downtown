const { db } = require('./Database');
const fs = require('fs');

const MIGRATIONS_FOLDER = process.env.MIGRATIONS_FOLDER || './migrations';

class Migration {
  name: string;
  up: string;
  down: string;
  executed: boolean;
}

var getMigration = (file) => {
  const migrationExtension = file.split('.')[1];
  if (migrationExtension != "json") {
    return;
  }
  
  return new Promise( (resolve, reject) => {
    const migrationName = file.split('.')[0];
    console.log(`Found migration ${file}`);
    db.get('SELECT name FROM migrations WHERE name = $name', { $name: migrationName }, (err, row) => {
      if (err) {
        console.error(err);
      } else {
        const inTable = row !== undefined;
        const migrationFile = `${MIGRATIONS_FOLDER}/${file}`;
        fs.readFile(migrationFile, (readErr, data) => {
          const migration = JSON.parse(data);
          resolve({ name: migrationName, up: migration.up, down: migration.down, executed: inTable });
        });          
      }
    });       
  });  
}

function applyAndLogMigration(migration: Migration, direction: string) {
  const notDirection = direction === 'up' ? 'down' : 'up';
  return new Promise((resolve, reject) => {
    console.log(` --> ${migration[direction]}`)
    db.exec(migration[direction], (dbRunErr) => {
      if (dbRunErr){
        console.error(`An error occurred running ${migration.name} ${direction}`);
        console.error(dbRunErr);
        reject(dbRunErr);
      } else {
        console.log(`Migration ${migration.name} applied!`);
        const logSql = direction === 'up' ? 'INSERT INTO migrations (name) values($name)' : 'DELETE FROM migrations where name = $name';
        console.log(` --> ${logSql} (${migration.name})`);
        db.run(logSql, { $name: migration.name }, (dbLogErr) => {
          if (dbLogErr) {
            console.error(`An error occurred logging ${migration.name}`);
            console.error(dbLogErr);
            db.exec(migration[notDirection], (dbRollbackErr) => {
              if (dbRollbackErr) {
                console.error(`An error occurred running ${migration.name} ${notDirection}`);
                console.error(dbRollbackErr);
              } else {
                console.log(`Migration ${migration.name} rolled back!`);
              }
              reject(dbRollbackErr || dbLogErr);
            });
          } else {
            console.log(`Migration ${migration.name} accounted`);
            resolve(migration);
          }
        });
      }
    })  
  })
}

function applyAndLogMigrations(migrations, direction, count) {
  if (count > 0 && migrations.length > 0) {
    applyAndLogMigration(migrations[0], direction)
      .then((migration) => {
        applyAndLogMigrations(migrations.slice(1), direction, --count);
      })
      .catch((err) => {
        console.error(err);
      });
  } else {
    console.log('The end of migrations')
  }
}

function sortMigrations(migrations, direction){
  const migrationQueue = {};
  migrations.forEach((migration: Migration) => {
    migrationQueue[migration.name] = { ...migration };
  });
  const migrationQueueKeys = Object.keys(migrationQueue);
  if (direction === 'up') {
    migrationQueueKeys.sort();
  } else {
    migrationQueueKeys.reverse();
  }
  return migrationQueueKeys.map(migrationName => { return migrationQueue[migrationName]; });
}

function migrate(direction, count) {
  fs.readdir(MIGRATIONS_FOLDER, (err, files) => {  
    if (err) {
      throw err;
    }        
    console.log(`Reading ${MIGRATIONS_FOLDER}, found ${files.length} files`);
    Promise.all(files.map(getMigration))
      .then((migrations) => {
        console.log(`Have ${migrations.length} migrations`);
        const filteredMigrations = migrations.filter((migration: Migration) => migration && ((direction === 'up' && ! migration.executed) || (direction === 'down' && migration.executed)));
        console.log(`Found ${filteredMigrations.length} applicable migrations`);
        return filteredMigrations;
      })
      .then((filteredMigrations) => {
        return sortMigrations(filteredMigrations, direction);
      })
      .then((sortedMigrations) => {
        applyAndLogMigrations(sortedMigrations, direction, count);
      })
      .catch((something) => {
        console.error(something);
      });  
  });
}

function run(direction, count) {
  
  console.log(`Migrating ${count} ${direction}`);
  db.get('SELECT 1 from migrations', (err, row) => {
    let tableCheck;
    if (err) {
      console.error(err);
      tableCheck = new Promise(resolve => {
        console.log('Creating migrations table');
        db.run('CREATE TABLE migrations (name TEXT, executed_at DATE)', (err) => {
          resolve(true);
        });        
      });
    } else {
      tableCheck = new Promise(resolve => resolve(true));
    }  
    tableCheck.then(() => {      
      migrate(direction, count);        
    })    
  });
}

if (process.argv.length > 1) {
  const op = process.argv[2];

  switch(op) {
    case 'help':
      console.log("Help is on the way (not really)");
      break;
    case 'test':
      console.log('Do you smell smoke?')
      break;
    case 'migrate':
      let count = 1;
      let direction = 'up';    
      if (process.argv.length > 3) {
        const migrateVector = process.argv[3];
        const parsedVector = parseInt(migrateVector);
        count = parsedVector || 1;
        direction = parsedVector ? (parsedVector > 0 ? 'up' : 'down') : migrateVector;
      }
      if (process.argv.length > 4) {
        count = parseInt(process.argv[4]);
      }
      run(direction, count);
      break;
  }  
}
