const fs = require('fs')
const path = require('path')
const sql = require('pg-sql').sql

async function migrateIfNeeded(db, migrations) {
  // 2 - check if the migrations table exists
  // 3 - get latest migration from table if exists
  // 4 - get latest migration from list of migrations
  migrations.sort((a, b) => {
    if (a.name < b.name) {
      return -1
    }
    if (a.name > b.name) {
      return 1
    }
    return 0
  })

  try {
    let versions = await db.query('SELECT version FROM migration')
    if (versions) {
      versions = versions.map(row => row.version)
      migrations = migrations.filter(m => !versions.includes(m.name))
    }

    for (const migration of migrations) {
      console.log(`RUNNING MIGRATION ${migration.name}`)
      await db.query(migration.contents)
      console.log('UPDATING MIGRATION VERSION')
      const insert = sql`
        INSERT INTO migration (
          version,
          migrated
        )
        VALUES (
          ${migration.name},
          ${new Date().toUTCString()}::timestamp with time zone
        )
        RETURNING version;`
      const result = await db.query(insert)
      console.log(`VERSION: ${result.rows[0].version}`)
    }
  } catch(err) {
    console.log(err)
  }

  return migrations
}

// Default implementation
// directory should be path.join(__dirname, 'migrations')
function getMigrations(directory) {
  let results = []
  fs.readdirSync(directory).forEach(file => {
    const f = path.join(directory, file)
    const stat = fs.statSync(f)

    if (stat && stat.isDirectory()) {
      results = results.concat(getMigrations(f))
    } else {
      results.push({
        name: path.basename(file, path.extname(file)),
        contents: fs.readFileSync(f, 'utf8')
      })
    }
  })
  return results
}

module.exports = db => {
  return {
    getMigrations: getMigrations,
    migrateIfNeeded: migrateIfNeeded.bind(null, db)
  }
}
