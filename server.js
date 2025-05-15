import http from 'http'
import https from 'https'
import fs from 'fs'
import { app } from './app.js'
import client from './config/db.js'

const keyPath = process.env.KEY_PATH
const certPath = process.env.CERT_PATH

if (!keyPath || !certPath) {
  throw new Error('KEY_PATH or CERT_PATH is not defined in environment');
}

const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

const server = process.env.NODE_ENV === 'production' ? https.createServer(options, app) : http.createServer(app)

server.listen(5000, async () => {
    await client.connect().then(() => {
        console.log('Database connected successfully')
    }).catch((err) => {
        console.log('Database connection error : ', err)
    })
    console.log(`Server running on port 5000`)
})