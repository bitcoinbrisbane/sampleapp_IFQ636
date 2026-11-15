// SCRUM-35 / SCRUM-37 / SCRUM-38: tests that the server enforces the per-turn
// time-box. A late submission (past the turn deadline) is rejected, and reading
// an expired in-progress debate advances the turn/round on the deadline.
// Deadlines are set in the past directly so the tests are deterministic (no sleeps).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27018/debateapp_test';
process.env.TURN_MS = process.env.TURN_MS || String(60 * 60 * 1000); // fresh turns get 1h

const { expect } = require('chai');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../server');
const User = require('../models/User');
const Debate = require('../models/Debate');

const PORT = 5113;
let server;
const past = () => new Date(Date.now() - 1000); // 1s ago

function token(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}
async function gql(query, authToken) {
  const res = await fetch(`http://localhost:${PORT}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

describe('SCRUM-35/37/38: per-turn time-box', function () {
  this.timeout(10000);
  let prop, opp, propTok, oppTok;

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    await mongoose.connection.dropDatabase();
    await app.setupGraphQL();
    await new Promise((r) => (server = app.listen(PORT, r)));
    prop = await User.create({ name: 'Prop', email: `p${Date.now()}@t.dev`, password: 'password123', role: 'moderator' });
    opp = await User.create({ name: 'Opp', email: `o${Date.now()}@t.dev`, password: 'password123' });
    propTok = token(prop); oppTok = token(opp);
  });
  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.connection.close();
  });

  // Helper: an in-progress debate whose current turn deadline is already in the past.
  async function expiredTurn() {
    return Debate.create({
      motion: 'Time test', creator: prop._id, proposition: prop._id,
      opposition: opp._id, status: 'in-progress',
      currentRound: 0, currentSide: 'proposition', turnDeadline: past(),
    });
  }

  it('rejects a late submission once the turn deadline has passed', async () => {
    const d = await expiredTurn();
    // Proposition is "on turn" but the deadline has elapsed. The server advances
    // past the stale turn, so the proposition is no longer the current side.
    const out = await gql(
      `mutation { submitArgument(id:"${d._id}", text:"too late") { status } }`, propTok
    );
    expect(out.errors, 'late submission must be rejected').to.not.be.undefined;
    expect(out.errors[0].message).to.match(/not your turn|time-box .*expired/i);
    expect((await Debate.findById(d._id)).arguments).to.have.length(0);
  });

  it('advances the turn to the other side when the deadline is read as expired', async () => {
    const d = await expiredTurn();
    const out = await gql(`{ debate(id:"${d._id}") { currentSide currentRound status } }`);
    expect(out.errors).to.be.undefined;
    // proposition missed its turn -> now the opposition's turn.
    expect(out.data.debate.currentSide).to.equal('opposition');
    expect(out.data.debate.status).to.equal('in-progress');
  });

  it('lets the now-current side submit within a fresh (non-expired) deadline', async () => {
    const d = await expiredTurn();
    // Reading advances to opposition with a fresh TURN_MS deadline.
    await gql(`{ debate(id:"${d._id}") { currentSide } }`);
    const out = await gql(
      `mutation { submitArgument(id:"${d._id}", text:"opp in time") { currentSide } }`, oppTok
    );
    expect(out.errors).to.be.undefined;
    const after = await Debate.findById(d._id);
    expect(after.arguments).to.have.length(1);
    expect(after.arguments[0].side).to.equal('opposition');
  });

  it('closes the debate when every turn deadline lapses (cascade to closed)', async () => {
    // Build an in-progress debate and force every subsequent deadline into the past
    // by repeatedly expiring + reading until it closes.
    const d = await expiredTurn();
    let state;
    for (let i = 0; i < 6; i++) {
      // force current deadline into the past, then read to advance
      await Debate.updateOne({ _id: d._id }, { $set: { turnDeadline: past() } });
      const out = await gql(`{ debate(id:"${d._id}") { status currentRound currentSide } }`);
      state = out.data.debate;
      if (state.status === 'closed') break;
    }
    expect(state.status).to.equal('closed');
  });
});
