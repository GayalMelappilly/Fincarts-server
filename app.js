import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import userRouter from './routes/user.route.js'

export const app = express()

app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
app.use(cors({
    origin: ['https://fin-cart-web-client.vercel.app/', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Access-Control-Allow-Credentials'
    ]
}))

app.use('/api/v1', userRouter)
