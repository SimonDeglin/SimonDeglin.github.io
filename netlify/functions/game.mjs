import { getDatabase } from '@netlify/database';
import { names, makeDraw } from '../../lib/draw.mjs';

let database;

function respond(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

async function initialize(client) {
  const existing = await client.query('SELECT id FROM christmas_game WHERE id = 1');
  if (existing.rowCount) return;

  await client.query('SELECT pg_advisory_xact_lock($1)', [20661122]);
  const initialized = await client.query('SELECT id FROM christmas_game WHERE id = 1');
  if (initialized.rowCount) return;

  const assignments = makeDraw();
  for (const giver of names) {
    await client.query('INSERT INTO christmas_assignments (giver, recipient) VALUES ($1, $2)', [
      giver, assignments[giver],
    ]);
    await client.query('INSERT INTO christmas_wishes (participant) VALUES ($1)', [giver]);
  }
  await client.query('INSERT INTO christmas_game (id) VALUES (1)');
}

async function play(pool, trial, action, name, body) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(trial
      ? 'SET LOCAL search_path TO christmas_trial'
      : 'SET LOCAL search_path TO public');

    if (action === 'status') {
      await client.query('SELECT id FROM christmas_game LIMIT 0');
      await client.query('SELECT giver, recipient, revealed_at FROM christmas_assignments LIMIT 0');
      await client.query('SELECT participant, body, updated_at FROM christmas_wishes LIMIT 0');
      await client.query('COMMIT');
      return { mode: trial ? 'test' : 'live' };
    }

    await initialize(client);
    if (action === 'save') {
      await client.query('UPDATE christmas_wishes SET body = $2, updated_at = NOW() WHERE participant = $1', [name, body]);
    }
    if (action === 'reveal') {
      await client.query('UPDATE christmas_assignments SET revealed_at = NOW() WHERE giver = $1 AND revealed_at IS NULL', [name]);
    }

    const { rows: [row] } = await client.query(`
      SELECT a.recipient, a.revealed_at, own.body AS own_wishes, recipient.body AS recipient_wishes
      FROM christmas_assignments a
      JOIN christmas_wishes own ON own.participant = a.giver
      JOIN christmas_wishes recipient ON recipient.participant = a.recipient
      WHERE a.giver = $1
    `, [name]);
    if (!row) throw new Error('Tirage incomplet');
    await client.query('COMMIT');

    const state = { name, revealed: Boolean(row.revealed_at), ownWishes: row.own_wishes };
    if (state.revealed) {
      state.recipient = row.recipient;
      state.recipientWishes = row.recipient_wishes;
    }
    return state;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default async function (request, context) {
  const url = new URL(request.url);
  const trial = url.searchParams.get('essai') === '1';
  const familySite = context?.site?.id === 'd14eb2db-27d1-4ea3-8359-b240ddb349f3'
    && context.deploy?.context === 'production'
    && context.deploy?.published === true
    && url.hostname === 'cacahuete-noel-criscenzo.netlify.app';
  if (!trial && !familySite) {
    return respond({ error: 'Le tirage familial n’est pas encore ouvert.' }, 423);
  }

  let action = url.searchParams.get('action') || 'state';
  let name = url.searchParams.get('name');
  let body;
  if (request.method === 'POST') {
    let input;
    try {
      input = await request.json();
    } catch {
      return respond({ error: 'Requête invalide.' }, 400);
    }
    if (!input || typeof input !== 'object') return respond({ error: 'Requête invalide.' }, 400);
    ({ action, name, body } = input);
    if (!['reveal', 'save'].includes(action)) return respond({ error: 'Action inconnue.' }, 400);
  } else if (request.method !== 'GET') {
    return respond({ error: 'Méthode invalide.' }, 405);
  } else if (!['state', 'status'].includes(action)) {
    return respond({ error: 'Action inconnue.' }, 400);
  }

  if (action !== 'status' && !names.includes(name)) return respond({ error: 'Prénom inconnu.' }, 400);
  if (action === 'save' && (typeof body !== 'string' || body.length > 1500)) {
    return respond({ error: 'Liste limitée à 1 500 caractères.' }, 400);
  }

  try {
    if (!database) {
      database = getDatabase();
      database.pool.on('error', (error) => {
        console.error('Connexion PostgreSQL inactive', error.code ?? error.name);
      });
    }
    return respond(await play(database.pool, trial, action, name, body));
  } catch (error) {
    console.error('Service de tirage de Noël', error.code ?? error.name);
    return respond({ error: 'Le serveur ne répond pas. Réessaie dans un instant.' }, 503);
  }
}
