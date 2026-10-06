/**
 * Nyaa Chat - 1:1 Direct Message (DM) Module (Separated)
 * 
 * Encapsulates 1:1 Direct Message room ID generation, partner parsing,
 * and DM message routing.
 * 
 * By default, 1:1 direct messaging is DISABLED and separated per user policy.
 */

function setupDmModule(io, options = {}) {
  const enabled = Boolean(options.enabled);

  function getDmRoomId(id1, id2) {
    if (!id1 || !id2) return '';
    const sorted = [String(id1), String(id2)].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  }

  function parseDmRoomId(roomId) {
    if (!roomId || !roomId.startsWith('dm_')) return null;
    const raw = roomId.slice(3);
    const parts = raw.split('_');
    if (parts.length >= 2) {
      return {
        isDm: true,
        user1: parts[0],
        user2: parts.slice(1).join('_')
      };
    }
    return { isDm: true, raw };
  }

  return {
    enabled,
    getDmRoomId,
    parseDmRoomId
  };
}

module.exports = {
  setupDmModule
};
