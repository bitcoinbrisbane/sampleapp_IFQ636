// SCRUM-31 / SCRUM-34: tests that the server enforces whose turn it is.
// Success criterion #3: 100% of out-of-turn submissions are blocked (403) and
// nothing is stored. A long TURN_MS keeps the time-box out of the way so these
// tests isolate turn ORDER (the time-box itself is covered by SCRUM-35).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27018/debateapp_test';
process.env.TURN_MS = process.env.TURN_MS || String(60 * 60 * 1000); // 1h, won't expire mid-test

const { expect } = require('chai');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../server');
const User = require('../models/User');
const Debate = require('../models/Debate');

const PORT = 5112;
let server;

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
const submit = (id, text, tok) =>
  gql(`mutation { submitArgument(id:"${id}", text:"${text}") { currentRound currentSide status } }`, tok);

describe('SCRUM-31/34: turn enforcement', function () {
  this.timeout(10000);
  let prop, opp, outsider, propTok, oppTok, outsiderTok;

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    await mongoose.connection.dropDatabase();
    await app.setupGraphQL();
    await new Promise((r) => (server = app.listen(PORT, r)));
    prop = await User.create({ name: 'Prop', email: `p${Date.now()}@t.dev`, password: 'password123', role: 'moderator' });
    opp = await User.create({ name: 'Opp', email: `o${Date.now()}@t.dev`, password: 'password123' });
    outsider = await User.create({ name: 'Out', email: `x${Date.now()}@t.dev`, password: 'password123' });
    propTok = token(prop); oppTok = token(opp); outsiderTok = token(outsider);
  });
  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.connection.close();
  });

  async function freshInProgress() {
    return Debate.create({
      motion: 'Turn test', creator: prop._id, proposition: prop._id,
      opposition: opp._id, status: 'in-progress',
      currentRound: 0, currentSide: 'proposition',
      turnDeadline: new Date(Date.now() + Number(process.env.TURN_MS)),
    });
  }

  it("rejects the opposition submitting on the proposition's turn (403, nothing stored)", async () => {
    const d = await freshInProgress();
    const out = await submit(d._id, 'out of turn', oppTok);
    expect(out.errors[0].message).to.match(/not your turn/i);
    const after = await Debate.findById(d._id);
    expect(after.arguments).to.have.length(0); // nothing stored
    expect(after.currentSide).to.equal('proposition'); // turn did not advance
  });

  it('rejects a non-participant submitting', async () => {
    const d = await freshInProgress();
    const out = await submit(d._id, 'intruder', outsiderTok);
    expect(out.errors[0].message).to.match(/not a participant/i);
    expect((await Debate.findById(d._id)).arguments).to.have.length(0);
  });

  it('accepts the correct side and advances the turn to the opposition', async () => {
    const d = await freshInProgress();
    const out = await submit(d._id, 'prop opening', propTok);
    expect(out.errors).to.be.undefined;
    expect(out.data.submitArgument.currentSide).to.equal('opposition');
    const after = await Debate.findById(d._id);
    expect(after.arguments).to.have.length(1);
    expect(after.arguments[0].side).to.equal('proposition');
  });

  it('blocks 100% of out-of-turn attempts across a full 3-round debate', async () => {
    const d = await freshInProgress();
    const id = d._id;
    // Correct turn order: prop, opp repeated for 3 rounds = 6 turns.
    const order = [
      { tok: propTok, wrong: oppTok },
      { tok: oppTok, wrong: propTok },
      { tok: propTok, wrong: oppTok },
      { tok: oppTok, wrong: propTok },
      { tok: propTok, wrong: oppTok },
      { tok: oppTok, wrong: propTok },
    ];
    let blocked = 0;
    for (let i = 0; i < order.length; i++) {
      // The wrong side tries first — must always be blocked.
      const bad = await submit(id, `wrong ${i}`, order[i].wrong);
      if (bad.errors && /not your turn/i.test(bad.errors[0].message)) blocked++;
      // The correct side then submits — must succeed.
      const good = await submit(id, `turn ${i}`, order[i].tok);
      expect(good.errors, `turn ${i} should succeed`).to.be.undefined;
    }
    expect(blocked).to.equal(order.length); // 100% of out-of-turn attempts blocked
    const after = await Debate.findById(id);
    expect(after.arguments).to.have.length(6); // only the 6 valid turns stored
    expect(after.status).to.equal('closed'); // debate closed after final turn
  });
});
