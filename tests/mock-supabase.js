// Faux client Supabase : base en mémoire + notifications realtime simulées.
// Servi à la place de supabase.js par tests/sync-test.js.
(function () {
  const DB = {
    players: [
      { id: "p1", name: "AliceSync", emoji: "🗡️", color: "#4DC3FF" },
      { id: "p2", name: "BobSync", emoji: "🛡️", color: "#8B7BFF" },
    ],
    tasks: [
      { id: "seed-1", name: "Tâche Sync A", icon: "🧪", prio: "normale", created_at: 1 },
      { id: "seed-2", name: "Tâche Sync B", icon: "🧫", prio: "haute", created_at: 2 },
    ],
    rewards: [{ id: "seed-r1", name: "Récompense Sync", icon: "🎁" }],
    objectives: [{ id: "seed-o1", name: "Objectif Sync", type: "xp", target: 100, reward_id: "seed-r1", created_at: 1, claimed: false }],
    log: [],
    won: [],
    bets: [],
  };
  window.__DB = DB;
  window.__rtCallbacks = [];
  window.__notify = () => window.__rtCallbacks.forEach(cb => cb({}));

  // comme PostgREST : 1000 lignes max par requête, pagination par .range()
  function thenableSelect(table) {
    let from = 0, to = 999;
    const obj = {
      order() { return obj; },
      range(a, b) { from = a; to = Math.min(b, a + 999); return obj; },
      then(resolve) { resolve({ data: JSON.parse(JSON.stringify(DB[table].slice(from, to + 1))), error: null }); },
    };
    return obj;
  }

  window.supabase = {
    createClient() {
      return {
        from(table) {
          return {
            select() { return thenableSelect(table); },
            async upsert(row) {
              // window.__reject = nom de table : le serveur refuse l'écriture (comme une règle RLS)
              if (window.__reject === table) return { error: { code: "42501", message: "refusé" } };
              const i = DB[table].findIndex(x => x.id === row.id);
              if (i >= 0) DB[table][i] = row; else DB[table].push(row);
              setTimeout(window.__notify, 10);
              return { error: null };
            },
            delete() {
              return {
                async eq(col, v) {
                  DB[table] = DB[table].filter(x => x[col] !== v);
                  setTimeout(window.__notify, 10);
                  return { error: null };
                },
                async neq(col, v) {
                  DB[table] = DB[table].filter(x => x[col] === v);
                  setTimeout(window.__notify, 10);
                  return { error: null };
                },
              };
            },
          };
        },
        channel() {
          const ch = {
            on(ev, filt, cb) { window.__rtCallbacks.push(cb); return ch; },
            subscribe() { return ch; },
          };
          return ch;
        },
      };
    },
  };
})();
