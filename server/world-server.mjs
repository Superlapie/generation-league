import { createServer } from 'node:http';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { openStateStore } from './storage.mjs';

const PORT = Number(process.env.PORT || 8787);
const CAPACITY = 2000;
const PRESENCE_RADIUS_TILES = 20;
const PRESENCE_RADIUS_SQUARED = PRESENCE_RADIUS_TILES * PRESENCE_RADIUS_TILES;
const WORLD_IDS = ['mossmere', 'cinderstep', 'tideglass'];
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 30);
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));
const worlds = new Map(WORLD_IDS.map((id, index) => [id, { id, name: `World ${index + 1}`, clients: new Map() }]));
const profiles = new Map();
const accounts = new Map();
const friends = new Map();
const listings = new Map();
const rateWindows = new Map();
const stateStore = await openStateStore();
let writeQueue = Promise.resolve();

await loadState();

const http = createServer((request, response) => {
  if (request.method === 'OPTIONS') { response.writeHead(204, corsHeaders(request)); return response.end(); }
  if (request.url === '/health') return json(request, response, { ok: true, worlds: directory() });
  if (request.url === '/api/worlds') return json(request, response, { worlds: directory() });
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

const sockets = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });
http.on('upgrade', (request, socket, head) => {
  if (!request.url?.startsWith('/socket')) return socket.destroy();
  if (!originAllowed(request.headers.origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return socket.destroy(); }
  sockets.handleUpgrade(request, socket, head, (client) => sockets.emit('connection', client));
});

sockets.on('connection', (socket) => {
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });
  const session = { accountId: `guest-${randomUUID()}`, displayName: 'Guest', guest: true, token: null, worldId: null, mapId: 'mossmere', x: 7, y: 6, socket, seenIds: new Set(), visibleIds: new Set() };
  send(socket, 'worlds:list', { worlds: directory() });
  socket.on('message', (raw) => void handleMessage(session, raw));
  socket.on('close', () => leaveWorld(session));
});

const heartbeatTimer = setInterval(() => {
  sockets.clients.forEach((socket) => {
    if (socket.isAlive === false) return socket.terminate();
    socket.isAlive = false;
    socket.ping();
  });
}, 30_000);

function json(request, response, value) {
  response.writeHead(200, { ...corsHeaders(request), 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  return originAllowed(origin) && origin ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,OPTIONS' } : {};
}

function originAllowed(origin) { return !origin || ALLOWED_ORIGINS.size === 0 || ALLOWED_ORIGINS.has(origin); }

async function loadState() {
  const state = await stateStore.load();
  if (!state) return;
  (state.profiles ?? []).forEach(([id, profile]) => profiles.set(id, profile));
  (state.accounts ?? []).forEach(([id, account]) => accounts.set(id, account));
  (state.friends ?? []).forEach(([id, records]) => friends.set(id, new Map(records)));
  (state.listings ?? []).forEach(([id, listing]) => listings.set(id, listing));
}

function persistState() {
  const state = {
    profiles: [...profiles],
    accounts: [...accounts],
    friends: [...friends].map(([id, records]) => [id, [...records]]),
    listings: [...listings],
  };
  writeQueue = writeQueue.catch((error) => console.error(`Previous state write failed: ${error.message}`)).then(() => stateStore.save(state));
  void writeQueue.catch((error) => console.error(`State write failed: ${error.message}`));
  return writeQueue;
}

function directory() {
  return [...worlds.values()].map((world) => ({ id: world.id, name: world.name, players: world.clients.size, capacity: CAPACITY, pingMs: null, healthy: true }));
}

function envelope(type, payload) { return { version: 1, id: randomUUID(), type, sentAt: Date.now(), payload }; }
function send(socket, type, payload) { if (socket.readyState === 1) socket.send(JSON.stringify(envelope(type, payload))); }
function broadcast(worldId, type, payload, except) {
  worlds.get(worldId)?.clients.forEach((client) => { if (client !== except) send(client.socket, type, payload); });
}
function canSee(observer, player) {
  if (observer.worldId !== player.worldId || observer.mapId !== player.mapId) return false;
  const dx = observer.x - player.x, dy = observer.y - player.y;
  return dx * dx + dy * dy <= PRESENCE_RADIUS_SQUARED;
}
function broadcastPresenceTransition(worldId, previous, current, except) {
  worlds.get(worldId)?.clients.forEach((client) => {
    if (client === except) return;
    const wasVisible = previous && canSee(client, previous);
    const isVisible = current && canSee(client, current);
    if (isVisible) {
      client.visibleIds.add(current.accountId);
      send(client.socket, 'presence:changed', { player: current, online: true });
    } else if (wasVisible) {
      client.visibleIds.delete(previous.accountId);
      send(client.socket, 'presence:changed', { player: previous, online: false });
    }
  });
}
function nearbyPlayers(session) {
  return [...(worlds.get(session.worldId)?.clients.values() ?? [])]
    .filter((client) => client !== session && canSee(session, presence(client)));
}
function refreshPresenceView(session) {
  const nearby = nearbyPlayers(session);
  const nextIds = new Set(nearby.map((player) => player.accountId));
  nearby.forEach((player) => {
    if (!session.visibleIds.has(player.accountId)) send(session.socket, 'presence:changed', { player: presence(player), online: true });
  });
  session.visibleIds.forEach((accountId) => {
    if (nextIds.has(accountId)) return;
    const player = [...(worlds.get(session.worldId)?.clients.values() ?? [])].find((client) => client.accountId === accountId);
    send(session.socket, 'presence:changed', {
      player: player ? presence(player) : { accountId, displayName: '', worldId: session.worldId, x: 0, y: 0, mapId: '', onlineAt: Date.now() },
      online: false,
    });
  });
  session.visibleIds = nextIds;
}
function cleanText(value) { return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[\r\n\t ]+/g, ' ').trim().slice(0, 240); }
function allowed(accountId, bucket, limit = 8) {
  const now = Date.now();
  const key = `${accountId}:${bucket}`;
  const recent = (rateWindows.get(key) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= limit) return false;
  recent.push(now);
  rateWindows.set(key, recent);
  return true;
}
function fail(session, code, message) { send(session.socket, 'error', { code, message }); }

async function handleMessage(session, raw) {
  let message;
  try { message = JSON.parse(String(raw)); } catch { return fail(session, 'bad_json', 'That message was not valid JSON.'); }
  if (message?.version !== 1 || typeof message.id !== 'string' || typeof message.type !== 'string') return fail(session, 'bad_envelope', 'That network message is not supported.');
  if (session.seenIds.has(message.id)) return;
  session.seenIds.add(message.id);
  if (session.seenIds.size > 256) session.seenIds.delete(session.seenIds.values().next().value);
  const payload = message.payload ?? {};
  if (message.type === 'ping') return send(session.socket, 'pong', {});

  if (message.type === 'auth:register') { if (!allowed(session.accountId, 'auth', 6)) return fail(session, 'rate_limited', 'Please wait before trying again.'); return registerAccount(session, payload); }
  if (message.type === 'auth:login') { if (!allowed(session.accountId, 'auth', 6)) return fail(session, 'rate_limited', 'Please wait before trying again.'); return loginAccount(session, payload); }

  if (message.type === 'hello') {
    const accountId = typeof payload.token === 'string' ? verifyToken(payload.token) : null;
    if (accountId && profiles.has(accountId)) {
      session.accountId = accountId;
      session.guest = false;
      session.token = payload.token;
    }
    const worldId = worlds.has(payload.worldId) ? payload.worldId : WORLD_IDS[0];
    session.worldId = worldId;
    session.mapId = cleanText(payload.mapId) || session.mapId;
    session.x = clamp(payload.x, -999, 999);
    session.y = clamp(payload.y, -999, 999);
    session.displayName = profiles.get(session.accountId)?.displayName || cleanText(payload.displayName) || 'Guest';
    const profile = profiles.get(session.accountId) ?? defaultProfile(session);
    const profileChanged = profile.worldId !== worldId || profile.guest !== session.guest;
    profile.worldId = worldId;
    if (profileChanged) profile.updatedAt = Date.now();
    profiles.set(session.accountId, profile);
    if (!session.guest && profileChanged) persistState();
    const world = worlds.get(worldId);
    const previous = world.clients.get(session.accountId);
    if (previous && previous !== session) previous.socket.close(1000, 'replaced');
    world.clients.set(session.accountId, session);
    send(session.socket, 'hello:ack', { accountId: session.accountId, worldId });
    const nearby = nearbyPlayers(session);
    session.visibleIds = new Set(nearby.map((player) => player.accountId));
    send(session.socket, 'presence:list', { players: nearby.map(presence) });
    broadcastPresenceTransition(worldId, null, presence(session), session);
    return broadcastDirectory();
  }

  if (message.type === 'profile:get') {
    const profile = profiles.get(session.accountId);
    if (!profile) return fail(session, 'profile_missing', 'No cloud profile is available for this session.');
    return send(session.socket, 'profile:ack', { profile });
  }
  if (message.type === 'profile:save') {
    if (session.guest) return fail(session, 'account_required', 'Create an account before saving a cloud profile.');
    if (!payload.profile || JSON.stringify(payload.profile).length > 2_000_000) return fail(session, 'profile_invalid', 'That cloud profile is too large or invalid.');
    const profile = { ...payload.profile, accountId: session.accountId, guest: false, updatedAt: Date.now() };
    profiles.set(session.accountId, profile);
    persistState();
    return send(session.socket, 'profile:ack', { profile });
  }

  if (!session.worldId) return fail(session, 'not_ready', 'Join a world before sending actions.');
  if (message.type === 'presence:update') {
    const previous = presence(session);
    session.mapId = cleanText(payload.mapId) || session.mapId;
    session.x = clamp(payload.x, -999, 999);
    session.y = clamp(payload.y, -999, 999);
    broadcastPresenceTransition(session.worldId, previous, presence(session), session);
    refreshPresenceView(session);
    return;
  }
  if (message.type === 'chat:send') {
    if (!allowed(session.accountId, 'chat')) return fail(session, 'rate_limited', 'Please slow down before sending another message.');
    const body = cleanText(payload.body);
    if (!body) return fail(session, 'empty_message', 'Messages cannot be empty.');
    const chat = { id: randomUUID(), channel: ['local', 'world', 'party', 'direct'].includes(payload.channel) ? payload.channel : 'world', from: session.accountId, to: cleanText(payload.to), body, createdAt: Date.now() };
    if (chat.channel === 'direct' && chat.to) return deliverDirect(chat, session);
    broadcast(session.worldId, 'chat:message', chat);
    return;
  }
  if (message.type === 'player:inspect') {
    const profile = profiles.get(cleanText(payload.accountId));
    if (!profile) return fail(session, 'unknown_player', 'That player is no longer available.');
    return send(session.socket, 'player:card', {
      accountId: profile.accountId,
      displayName: cleanText(profile.displayName),
      avatar: profile.avatar === 'b' ? 'b' : 'a',
      crests: Array.isArray(profile.crests) ? profile.crests.slice(0, 32).map((crest) => cleanText(crest)) : [],
      playTimeSeconds: 0,
      caughtCount: Array.isArray(profile.guide?.caught) ? profile.guide.caught.length : 0,
      joinedAt: Number.isFinite(profile.joinedAt) ? profile.joinedAt : Date.now(),
    });
  }
  if (message.type === 'friend:request') return friendRequest(session, cleanText(payload.accountId));
  if (message.type === 'friend:respond') return friendRespond(session, cleanText(payload.accountId), Boolean(payload.accept));
  if (message.type === 'trade:create') return createListing(session, payload);
  if (message.type === 'trade:cancel') return cancelListing(session, cleanText(payload.listingId));
  if (message.type === 'trade:accept') return acceptListing(session, cleanText(payload.listingId), cleanText(payload.creatureUid));
  fail(session, 'unsupported', 'That action is not available yet.');
}

function clamp(value, min, max) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : 0; }
function defaultProfile(session) {
  return { accountId: session.accountId, displayName: session.displayName, guest: session.guest, avatar: 'a', crests: [], party: [], storage: [], inventory: [], money: 0, guide: { seen: [], caught: [] }, storyFlags: [], worldId: session.worldId, joinedAt: Date.now(), updatedAt: Date.now() };
}
function passwordRecord(password) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}
function passwordMatches(password, record) {
  const expected = Buffer.from(record.hash, 'hex');
  const actual = scryptSync(password, record.salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function issueToken(accountId) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const body = `${accountId}.${expiresAt}`;
  const signature = createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}
function verifyToken(token) {
  const [accountId, expiry, signature] = String(token).split('.');
  if (!accountId || !expiry || !signature || Number(expiry) < Date.now()) return null;
  const expected = createHmac('sha256', SESSION_SECRET).update(`${accountId}.${expiry}`).digest('base64url');
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  return accountId;
}
function credentials(payload) {
  const username = cleanText(payload.username).slice(0, 16);
  const password = String(payload.password ?? '');
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return { error: ['invalid_username', 'Use 3-16 letters, numbers, or underscores.'] };
  if (password.length < 8 || password.length > 128) return { error: ['invalid_password', 'Passwords must be 8-128 characters.'] };
  return { username, password };
}
function attachAccount(session, accountId, token, guest = false) {
  if (session.worldId) {
    const world = worlds.get(session.worldId);
    world?.clients.delete(session.accountId);
    world?.clients.set(accountId, session);
  }
  session.accountId = accountId;
  session.token = token;
  session.guest = guest;
  session.displayName = profiles.get(accountId)?.displayName ?? session.displayName;
}
function registerAccount(session, payload) {
  const input = credentials(payload);
  if (input.error) return fail(session, input.error[0], input.error[1]);
  const existing = [...accounts.values()].find((account) => account.username.toLowerCase() === input.username.toLowerCase());
  if (existing) return fail(session, 'username_taken', 'That display name is already registered.');
  const accountId = `acct-${randomUUID()}`;
  const token = issueToken(accountId);
  const record = passwordRecord(input.password);
  accounts.set(accountId, { accountId, username: input.username, ...record });
  const previous = profiles.get(session.accountId) ?? defaultProfile(session);
  profiles.delete(session.accountId);
  profiles.set(accountId, { ...previous, accountId, displayName: input.username, guest: false, updatedAt: Date.now() });
  attachAccount(session, accountId, token, false);
  persistState();
  send(session.socket, 'auth:ack', { accountId, token, guest: false, displayName: input.username });
}
function loginAccount(session, payload) {
  const username = cleanText(payload.username).toLowerCase();
  const account = [...accounts.values()].find((candidate) => candidate.username.toLowerCase() === username);
  if (!account || !passwordMatches(String(payload.password ?? ''), account)) return fail(session, 'invalid_login', 'The username or password is incorrect.');
  const token = issueToken(account.accountId);
  attachAccount(session, account.accountId, token, false);
  send(session.socket, 'auth:ack', { accountId: account.accountId, token, guest: false, displayName: profiles.get(account.accountId)?.displayName ?? account.username });
}
function presence(session) { return { accountId: session.accountId, displayName: session.displayName, worldId: session.worldId, x: session.x, y: session.y, mapId: session.mapId, onlineAt: Date.now() }; }
function leaveWorld(session) {
  if (!session.worldId) return;
  const world = worlds.get(session.worldId);
  if (world?.clients.get(session.accountId) !== session) return;
  const previous = presence(session);
  world?.clients.delete(session.accountId);
  session.visibleIds.clear();
  broadcastPresenceTransition(session.worldId, previous, null, session);
  broadcastDirectory();
}
function broadcastDirectory() { worlds.forEach((world) => world.clients.forEach((client) => send(client.socket, 'worlds:list', { worlds: directory() }))); }
function deliverDirect(chat, sender) {
  const recipient = [...worlds.values()].flatMap((world) => [...world.clients.values()]).find((client) => client.accountId === chat.to);
  send(sender.socket, 'chat:message', chat);
  if (recipient) send(recipient.socket, 'chat:message', chat);
}
function friendRequest(session, accountId) {
  if (!accountId || accountId === session.accountId) return fail(session, 'invalid_friend', 'That player cannot be added.');
  const record = { accountId: session.accountId, displayName: session.displayName, status: 'pending', online: true, updatedAt: Date.now() };
  if (!friends.has(accountId)) friends.set(accountId, new Map());
  friends.get(accountId).set(session.accountId, record);
  persistState();
  const target = [...worlds.values()].flatMap((world) => [...world.clients.values()]).find((client) => client.accountId === accountId);
  if (target) send(target.socket, 'friend:changed', record);
}
function friendRespond(session, accountId, accept) {
  const incoming = friends.get(session.accountId)?.get(accountId);
  if (!incoming) return fail(session, 'unknown_friend_request', 'That friend request is no longer available.');
  incoming.status = accept ? 'accepted' : 'blocked';
  incoming.updatedAt = Date.now();
  persistState();
  send(session.socket, 'friend:changed', incoming);
  if (accept) {
    const reciprocal = { accountId: session.accountId, displayName: session.displayName, status: 'accepted', online: true, updatedAt: Date.now() };
    if (!friends.has(accountId)) friends.set(accountId, new Map());
    friends.get(accountId).set(session.accountId, reciprocal);
    const target = [...worlds.values()].flatMap((world) => [...world.clients.values()]).find((client) => client.accountId === accountId);
    if (target) send(target.socket, 'friend:changed', reciprocal);
    persistState();
  }
}
function createListing(session, payload) {
  if (session.guest) return fail(session, 'account_required', 'Create an account before listing a creature for trade.');
  if (!allowed(session.accountId, 'trade', 4)) return fail(session, 'rate_limited', 'Please wait before creating another listing.');
  const profile = profiles.get(session.accountId);
  const offered = findCreature(profile, cleanText(payload.offeredCreatureUid));
  if (!offered) return fail(session, 'invalid_listing', 'That creature is not in your cloud profile.');
  const listing = { id: randomUUID(), ownerId: session.accountId, offeredCreatureUid: offered.creature.uid, offeredSpeciesId: offered.creature.speciesId, offeredLevel: clamp(offered.creature.level, 1, 100), requestedSpeciesId: cleanText(payload.requestedSpeciesId) || undefined, requestedLevel: clamp(payload.requestedLevel, 0, 100) || undefined, status: 'open', createdAt: Date.now(), expiresAt: Date.now() + 86_400_000 };
  listings.set(listing.id, listing);
  persistState();
  broadcast(session.worldId, 'trade:changed', { listing });
}
function cancelListing(session, listingId) {
  const listing = listings.get(listingId);
  if (!listing || listing.ownerId !== session.accountId) return fail(session, 'invalid_listing', 'That listing is not yours.');
  listing.status = 'cancelled';
  persistState();
  broadcast(session.worldId, 'trade:changed', { listing });
}

function findCreature(profile, uid) {
  if (!profile || !uid) return null;
  for (const pocket of ['party', 'storage']) {
    const index = (profile[pocket] ?? []).findIndex((creature) => creature.uid === uid);
    if (index >= 0) return { pocket, index, creature: profile[pocket][index] };
  }
  return null;
}
function canReceive(profile) { return (profile?.party?.length ?? 0) < 6 || (profile?.storage?.length ?? 0) < 120; }
function receiveCreature(profile, creature) { if (profile.party.length < 6) profile.party.push(creature); else profile.storage.push(creature); }
function acceptListing(session, listingId, requestedUid) {
  if (session.guest) return fail(session, 'account_required', 'Create an account before trading creatures.');
  const listing = listings.get(listingId);
  const owner = listing && profiles.get(listing.ownerId);
  const recipient = profiles.get(session.accountId);
  if (!listing || listing.status !== 'open' || !owner) return fail(session, 'invalid_listing', 'That trade listing is no longer available.');
  if (listing.ownerId === session.accountId) return fail(session, 'invalid_trade', 'You cannot accept your own listing.');
  const offered = findCreature(owner, listing.offeredCreatureUid);
  const requested = findCreature(recipient, requestedUid);
  if (!offered || !requested) return fail(session, 'invalid_trade', 'Both offered creatures must be in cloud storage.');
  if (listing.requestedSpeciesId && requested.creature.speciesId !== listing.requestedSpeciesId) return fail(session, 'wrong_species', 'That creature does not match the listing request.');
  if (!canReceive(owner) || !canReceive(recipient)) return fail(session, 'storage_full', 'Both players need room to receive the trade.');
  owner[offered.pocket].splice(offered.index, 1);
  recipient[requested.pocket].splice(requested.index, 1);
  receiveCreature(owner, requested.creature);
  receiveCreature(recipient, offered.creature);
  listing.status = 'completed';
  const sessionInfo = { id: randomUUID(), leftId: listing.ownerId, rightId: session.accountId, leftCreatureUid: offered.creature.uid, rightCreatureUid: requested.creature.uid, leftConfirmed: true, rightConfirmed: true, status: 'completed' };
  persistState();
  broadcast(session.worldId, 'trade:changed', { listing, session: sessionInfo });
}

http.listen(PORT, '0.0.0.0', () => console.log(`Generation League world server listening on port ${PORT}`));

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down.`);
  clearInterval(heartbeatTimer);
  sockets.clients.forEach((socket) => socket.close(1001, 'Server shutting down'));
  await persistState();
  await stateStore.close();
  http.close(() => process.exit(0));
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
