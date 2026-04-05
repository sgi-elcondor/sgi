import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { productosRouter } from './routes/productos.js'

const app = express()
const PORT = process.env.PORT || 3000
const __dirname = path.dirname(fileURLToPath(import.meta.url))
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../public'))) 
app.use('/api/productos', productosRouter)
app.use((err, req, res, next) => {
  const status  = err.status || 500
  const mensaje = err.mensaje || 'Error interno del servidor'
  console.error(`[ERROR] ${status} - ${mensaje}`)
  res.status(status).json({ error: true, mensaje })
})
app.listen(PORT, () => {
  console.log(`✓ Servidor en http://localhost:${PORT}`)
})