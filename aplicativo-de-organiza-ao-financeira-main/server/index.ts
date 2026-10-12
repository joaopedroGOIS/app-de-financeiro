import { openDatabase } from './db'
import { createApp } from './app'

const db = openDatabase()
const port = Number(process.env.API_PORT || 3001)
createApp(db).listen(port, '0.0.0.0', () => console.log(`Granaê API running on port ${port}`))
