import https from 'https'
import fs from 'fs'
import { app } from './app.js'
import client from './config/db.js'

const keyPath = process.env.KEY_PATH
const certPath = process.env.CERT_PATH

console.log("KEY PATH : ",keyPath, "CERT PATH : ",certPath)

if (!keyPath || !certPath) {
  throw new Error('KEY_PATH or CERT_PATH is not defined in environment');
}


const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

const server = https.createServer(options, app)

server.listen(5000, async () => {
    await client.connect().then(() => {
        console.log('Database connected successfully')
    }).catch((err) => {
        console.log('Database connection error : ', err)
    })
    console.log(`HTTPS Server running on port 5000`)
})