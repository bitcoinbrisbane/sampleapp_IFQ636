// SCRUM-39: happy-path tests for submitArgument (CRUD: Update).
// AC: given it is my turn and the time-box is open, when I submit, the argument is
// persisted against the correct debate/round/side and becomes visible via the read
// query. Also covers input validation (empty text) and the full round progression.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27018/debateapp_test';
process.env.TURN_MS = process.env.TURN_MS || String(60 * 60 * 1000); // long, won't expire mid-test

const { expect } = require('chai');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../server');
const User = require('../models/User');
const Debate = require('../models/Debate');

const PORT = 5114;
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

describe('SCRUM-39: submit an argument (happy path)', function () {
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

  async function inProgress() {
    return Debate.create({
      motion: 'Submit test', creator: prop._id, proposition: prop._id,
      opposition: opp._id, status: 'in-progress',
      currentRound: 0, currentSide: 'proposition',
      turnDeadline: new Date(Date.now() + Number(process.env.TURN_MS)),
    });
  }

  it('persists the argument against the correct round and side', async () => {
    const d = await inProgress();
    const out = await submit(d._id, 'My opening case', propTok);
    expect(out.errors).to.be.undefined;

    const stored = await Debate.findById(d._id);
    expect(stored.arguments).to.have.length(1);
    const a = stored.arguments[0];
    expect(a.text).to.equal('My opening case');
    expect(a.round).to.equal(0);              // opening round
    expect(a.side).to.equal('proposition');   // the submitting side
    expect(String(a.author)).to.equal(String(prop._id));
  });

  it('makes the argument visible via the debate read query', async () => {
    const d = await inProgress();
    await submit(d._id, 'Visible argument', propTok);
    const out = await gql(
      `{ debate(id:"${d._id}") { arguments { text side round author { name } } } }`
    );
    expect(out.errors).to.be.undefined;
    expect(out.data.debate.arguments).to.have.length(1);
    expect(out.data.debate.arguments[0].text).to.equal('Visible argument');
    expect(out.data.debate.arguments[0].author.name).to.equal('Prop');
  });

  it('rejects an empty argument (validation)', async () => {
    const d = await inProgress();
    const out = await submit(d._id, '   ', propTok);
    expect(out.errors[0].message).to.match(/required/i);
    expect((await Debate.findById(d._id)).arguments).to.have.length(0);
  });

  it('records all six turns of a full debate in order', async () => {
    const d = await inProgress();
    const id = d._id;
    const seq = [propTok, oppTok, propTok, oppTok, propTok, oppTok];
    for (let i = 0; i < seq.length; i++) {
      const out = await submit(id, `turn ${i}`, seq[i]);
      expect(out.errors, `turn ${i}`).to.be.undefined;
    }
    const stored = await Debate.findById(id);
    expect(stored.arguments).to.have.length(6);
    // Rounds progress 0,0,1,1,2,2 and sides alternate prop/opp.
    expect(stored.arguments.map((a) => a.round)).to.deep.equal([0, 0, 1, 1, 2, 2]);
    expect(stored.arguments.map((a) => a.side)).to.deep.equal(
      ['proposition', 'opposition', 'proposition', 'opposition', 'proposition', 'opposition']
    );
    expect(stored.status).to.equal('closed');
  });
});
