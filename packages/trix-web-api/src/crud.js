import crypto from 'crypto';
import { pool } from './db.js';
import { badRequest, forbidden, notFound } from './errors.js';
import { JSON_COLUMNS, READ_ONLY_TABLES, UPSERT_CONFLICTS, assertTable, identifier } from './tables.js';

function normalizeValue(value) {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 19).replace('T', ' ');
  }
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return value;
}

function normalizeRow(row) {
  if (!row) return row;
  const normalized = { ...row };
  for (const key of Object.keys(normalized)) {
    if (JSON_COLUMNS.has(key) && typeof normalized[key] === 'string') {
      try {
        normalized[key] = JSON.parse(normalized[key]);
      } catch {
        // Keep original string when MySQL returns non-JSON content.
      }
    }
  }
  return normalized;
}

function buildFilter(filter, values) {
  const column = identifier(filter.column);
  switch (filter.op) {
    case 'eq':
      values.push(filter.value);
      return `${column} = ?`;
    case 'neq':
      values.push(filter.value);
      return `${column} <> ?`;
    case 'gt':
      values.push(filter.value);
      return `${column} > ?`;
    case 'gte':
      values.push(filter.value);
      return `${column} >= ?`;
    case 'lt':
      values.push(filter.value);
      return `${column} < ?`;
    case 'lte':
      values.push(filter.value);
      return `${column} <= ?`;
    case 'like':
    case 'ilike':
      values.push(String(filter.value));
      return `${column} LIKE ?`;
    case 'in': {
      const list = Array.isArray(filter.value) ? filter.value : [];
      if (list.length === 0) return '1 = 0';
      values.push(...list);
      return `${column} IN (${list.map(() => '?').join(', ')})`;
    }
    case 'is':
      if (filter.value === null) return `${column} IS NULL`;
      values.push(filter.value);
      return `${column} <=> ?`;
    case 'not_is':
      if (filter.value === null) return `${column} IS NOT NULL`;
      values.push(filter.value);
      return `NOT (${column} <=> ?)`;
    default:
      throw badRequest(`Unsupported filter operator: ${filter.op}`);
  }
}

function buildOrFilter(raw, values) {
  if (!raw || typeof raw !== 'string') return null;

  const searchMatch = raw.match(/^name\.ilike\.%(.+)%,description\.ilike\.%(.+)%$/);
  if (searchMatch) {
    values.push(`%${searchMatch[1]}%`, `%${searchMatch[2]}%`);
    return '(`name` LIKE ? OR `description` LIKE ?)';
  }

  const pairMatch = raw.match(
    /^and\(user_id\.eq\.([^,]+),friend_id\.eq\.([^)]+)\),and\(user_id\.eq\.([^,]+),friend_id\.eq\.([^)]+)\)$/,
  );
  if (pairMatch) {
    values.push(pairMatch[1], pairMatch[2], pairMatch[3], pairMatch[4]);
    return '((`user_id` = ? AND `friend_id` = ?) OR (`user_id` = ? AND `friend_id` = ?))';
  }

  return null;
}

function whereClause(query, values) {
  const clauses = [];
  for (const filter of query.filters ?? []) {
    clauses.push(buildFilter(filter, values));
  }
  for (const raw of query.orFilters ?? []) {
    const clause = buildOrFilter(raw, values);
    if (clause) clauses.push(clause);
  }
  return clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
}

async function embedFriendProfiles(rows, select) {
  if (!select || !String(select).includes('profiles!friends_friend_id_fkey')) {
    return rows;
  }
  const ids = [...new Set(rows.map((row) => row.friend_id).filter(Boolean))];
  if (ids.length === 0) return rows;

  const [profiles] = await pool.query(
    `SELECT id, username, avatar_url, status, is_studying, bio FROM profiles WHERE id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  );
  const byId = new Map(profiles.map((profile) => [profile.id, normalizeRow(profile)]));
  return rows.map((row) => ({
    ...row,
    profiles: byId.get(row.friend_id) ?? null,
  }));
}

async function embedMallItems(rows, select) {
  if (!select || !String(select).includes('mall_items')) {
    return rows;
  }
  const ids = [...new Set(rows.map((row) => row.item_id).filter(Boolean))];
  if (ids.length === 0) return rows;

  const [items] = await pool.query(
    `SELECT id, name, description, image_url, price, category FROM mall_items WHERE id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  );
  const byId = new Map(items.map((item) => [item.id, normalizeRow(item)]));
  return rows.map((row) => ({
    ...row,
    mall_items: byId.get(row.item_id) ?? null,
  }));
}

export async function selectRows(table, query = {}) {
  assertTable(table);

  const values = [];
  const countOnly = query.selectOptions?.head === true;
  const selectSql = countOnly ? 'COUNT(*) AS total' : '*';
  let sql = `SELECT ${selectSql} FROM ${identifier(table)}`;
  sql += whereClause(query, values);

  if (!countOnly && Array.isArray(query.orders)) {
    const orders = query.orders
      .map((order) => `${identifier(order.column)} ${order.ascending === false ? 'DESC' : 'ASC'}`)
      .join(', ');
    if (orders) sql += ` ORDER BY ${orders}`;
  }

  if (!countOnly && query.range) {
    const from = Number(query.range.from) || 0;
    const to = Number(query.range.to) || from;
    values.push(Math.max(0, to - from + 1), Math.max(0, from));
    sql += ' LIMIT ? OFFSET ?';
  } else if (!countOnly && query.limit) {
    values.push(Number(query.limit));
    sql += ' LIMIT ?';
  }

  const [rows] = await pool.execute(sql, values);
  if (countOnly) {
    return { data: null, count: Number(rows[0]?.total ?? 0) };
  }

  let data = rows.map(normalizeRow);
  data = await embedFriendProfiles(data, query.select);
  data = await embedMallItems(data, query.select);
  return { data, count: query.selectOptions?.count === 'exact' ? data.length : null };
}

export async function insertRows(table, payload, mode = 'insert') {
  assertTable(table);
  if (READ_ONLY_TABLES.has(table)) throw forbidden(`${table} is read-only`);

  const inputRows = Array.isArray(payload.values) ? payload.values : [payload.values];
  if (inputRows.length === 0) return { data: [] };

  const rows = inputRows.map((row) => ({
    id: row.id ?? crypto.randomUUID(),
    ...row,
  }));
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const values = [];
  const placeholders = rows
    .map((row) => {
      values.push(...columns.map((column) => normalizeValue(row[column])));
      return `(${columns.map(() => '?').join(', ')})`;
    })
    .join(', ');

  const conflictColumns = payload.options?.onConflict
    ? String(payload.options.onConflict).split(',').map((column) => column.trim())
    : UPSERT_CONFLICTS[table];
  let updateSql = '';
  if (mode === 'upsert') {
    const updateColumns = columns.filter((column) => !conflictColumns?.includes(column));
    const assignments = updateColumns.length > 0
      ? updateColumns.map((column) => `${identifier(column)} = VALUES(${identifier(column)})`)
      : [`${identifier(columns[0])} = ${identifier(columns[0])}`];
    updateSql = ` ON DUPLICATE KEY UPDATE ${assignments.join(', ')}`;
  }

  const sql = `INSERT INTO ${identifier(table)} (${columns.map(identifier).join(', ')}) VALUES ${placeholders}${updateSql}`;
  await pool.execute(sql, values);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return { data: [] };
  const [inserted] = await pool.query(
    `SELECT * FROM ${identifier(table)} WHERE id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  );
  return { data: inserted.map(normalizeRow) };
}

export async function updateRows(table, payload) {
  assertTable(table);
  if (READ_ONLY_TABLES.has(table)) throw forbidden(`${table} is read-only`);
  if (!payload.filters?.length) throw badRequest('Update requires at least one filter');

  const updates = payload.values ?? {};
  const columns = Object.keys(updates);
  if (columns.length === 0) return { data: [] };

  const values = columns.map((column) => normalizeValue(updates[column]));
  let sql = `UPDATE ${identifier(table)} SET ${columns.map((column) => `${identifier(column)} = ?`).join(', ')}`;
  sql += whereClause(payload, values);
  await pool.execute(sql, values);
  return selectRows(table, payload);
}

export async function deleteRows(table, payload) {
  assertTable(table);
  if (READ_ONLY_TABLES.has(table)) throw forbidden(`${table} is read-only`);
  if (!payload.filters?.length) throw badRequest('Delete requires at least one filter');

  const existing = await selectRows(table, payload);
  const values = [];
  let sql = `DELETE FROM ${identifier(table)}`;
  sql += whereClause(payload, values);
  const [result] = await pool.execute(sql, values);
  return { data: existing.data, count: result.affectedRows };
}

export async function getById(table, id) {
  const result = await selectRows(table, { filters: [{ column: 'id', op: 'eq', value: id }], limit: 1 });
  const row = result.data?.[0] ?? null;
  if (!row) throw notFound();
  return row;
}
