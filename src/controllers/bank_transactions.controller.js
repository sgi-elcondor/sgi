const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

exports.getAll = async (req, res) => {
  const { bank, date_from, date_to, amount_min, amount_max, search } = req.query;
  let query = supabase.schema(SCHEMA).from('bank_transaction').select('*').order('transaction_date', { ascending: false });
  if (bank)       query = query.eq('bank', bank);
  if (date_from)  query = query.gte('transaction_date', date_from);
  if (date_to)    query = query.lte('transaction_date', date_to);
  if (amount_min) query = query.gte('amount', parseFloat(amount_min));
  if (amount_max) query = query.lte('amount', parseFloat(amount_max));
  if (search)     query = query.or(`description.ilike.%${search}%,reference.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
};

exports.createBatch = async (req, res) => {
  const { bank, transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0)
    return res.status(400).json({ error: 'transactions must be a non-empty array' });
  const rows = transactions.map(t => ({
    bank:             bank || t.bank || 'bancolombia',
    transaction_date: t.transaction_date,
    description:      t.description,
    reference:        t.reference || null,
    amount:           t.amount !== undefined ? t.amount : null,
  }));
  const { data, error } = await supabase.schema(SCHEMA).from('bank_transaction').insert(rows).select();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { transaction_date, description, reference, amount } = req.body;
  const { data, error } = await supabase.schema(SCHEMA)
    .from('bank_transaction')
    .update({ transaction_date, description, reference: reference || null, amount: amount !== undefined ? amount : null, updated_at: new Date().toISOString() })
    .eq('id_transaction', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  const { data: linked } = await supabase.schema(SCHEMA).from('bank_transaction').select('id_pago').eq('id_transaction', id).single();
  if (linked && linked.id_pago)
    return res.status(400).json({ error: 'No se puede eliminar una transaccion ya vinculada a un pago' });
  const { error } = await supabase.schema(SCHEMA).from('bank_transaction').delete().eq('id_transaction', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
};