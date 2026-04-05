import { Router } from 'express'
import {
  obtenerProductos, obtenerProducto,
  crearProducto, actualizarProducto, eliminarProducto
} from '../controllers/productos.js'

export const productosRouter = Router()
productosRouter
  .get('/',     obtenerProductos)
  .get('/:id',  obtenerProducto)
  .post('/',    crearProducto)
  .put('/:id',  actualizarProducto)
  .delete('/:id', eliminarProducto)