import { supabase } from '../config/supabase.js'

export const obtenerProductos = async (req, res, next) => {
  try {
    const { buscar, categoria } = req.query
    let query = supabase.from('productos').select('*').order('creado_en', { ascending: false })
    if (buscar)    query = query.ilike('nombre', `%${buscar}%`)
    if (categoria) query = query.eq('categoria', categoria)
    const { data, error } = await query
    if (error) throw error
    res.json({ total: data.length, productos: data })
  } catch (err) { next(err) }
}

export const obtenerProducto = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('productos').select('*').eq('id', req.params.id).single()
    if (error) return next({ status: 404, mensaje: 'Producto no encontrado' })
    res.json(data)
  } catch (err) { next(err) }
}

export const crearProducto = async (req, res, next) => {
  try {
    const { nombre, descripcion, precio, stock, categoria } = req.body
    if (!nombre?.trim()) return next({ status: 400, mensaje: 'El nombre es requerido' })
    if (precio === undefined || precio < 0) return next({ status: 400, mensaje: 'Precio inválido' })
    const { data, error } = await supabase
      .from('productos').insert([{ nombre, descripcion, precio, stock: stock || 0, categoria }])
      .select().single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) { next(err) }
}

export const actualizarProducto = async (req, res, next) => {
  try {
    const { nombre, descripcion, precio, stock, categoria } = req.body
    const { data, error } = await supabase
      .from('productos').update({ nombre, descripcion, precio, stock, categoria })
      .eq('id', req.params.id).select().single()
    if (error) return next({ status: 404, mensaje: 'Producto no encontrado' })
    res.json(data)
  } catch (err) { next(err) }
}

export const eliminarProducto = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('productos').delete().eq('id', req.params.id)
    if (error) return next({ status: 404, mensaje: 'Producto no encontrado' })
    res.status(204).send()
  } catch (err) { next(err) }
}