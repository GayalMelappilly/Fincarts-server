import http from 'http'
import { app } from './app.js'
// import client from './config/database'

const server = http.createServer(app)

// server.listen(5000, async () => {
//     await client.connect().then(() => {
//         console.log('Database connected successfully')
//     }).catch((err) => {
//         console.log('Database connection error : ', err)
//     })
//     console.log('Server running on port 5000')
// })

server.listen(5000, async() => {
    console.log('Server running on 5000')
})