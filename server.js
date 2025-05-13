import https from 'https'
import fs from 'fs'
import { app } from './app.js'
import client from './config/db.js'

const keyPath = process.env.NODE_ENV === 'production' ? `/home/ec2-user/ssl/server.key` : './ssl/server.key'
const certPath = process.env.NODE_ENV === 'production' ? `/home/ec2-user/ssl/server.cert` : './ssl/server.cert'

// HTTPS configuration
const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

// Create HTTPS server instead of HTTP
const server = https.createServer(options, app)

server.listen(5000, async () => {
    await client.connect().then(() => {
        console.log('Database connected successfully')
    }).catch((err) => {
        console.log('Database connection error : ', err)
    })
    console.log(`HTTPS Server running on port 5000`)
})