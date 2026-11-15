// SCRUM-25: tests for the debate / debates GraphQL read queries.
// Runs against a MongoDB instance given by MONGO_URI (defaults to the local
// Docker Mongo on host port 27018), using a dedicated test database that is
// dropped before the suite so runs are isolated.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27018/debateapp_test';

const { expect } = require('chai');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../server');
const User = require('../models/User');
const Debate = require('../models/Debate');

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

let server;
const PORT = 5110;

describe('SCRUM-25: debate read queries', function () {
  this.timeout(10000);

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    await mongoose.connection.dropDatabase();
    await app.setupGraphQL();
    await new Promise((r) => (server = app.listen(PORT, r)));
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.connection.close();
  });

  it('debates returns an empty list when there are none', async () => {
    const out = await gql('{ debates { id } }');
    expect(out.errors).to.be.undefined;
    expect(out.data.debates).to.be.an('array').that.is.empty;
  });

  it('debate(id) returns a debate with nested creator and arguments', async () => {
    const mod = await User.create({
      name: 'Mod', email: `mod${Date.now()}@t.dev`, password: 'password123', role: 'moderator',
    });
    const debate = await Debate.create({
      motion: 'Testing reads', creator: mod._id, proposition: mod._id, status: 'open',
    });

    const out = await gql(
      `{ debate(id:"${debate._id}") { motion status creator { name } arguments { text } voteTally { proposition opposition } } }`
    );
    expect(out.errors).to.be.undefined;
    expect(out.data.debate.motion).to.equal('Testing reads');
    expect(out.data.debate.status).to.equal('open');
    expect(out.data.debate.creator.name).to.equal('Mod');
    expect(out.data.debate.arguments).to.be.an('array').that.is.empty;
    expect(out.data.debate.voteTally).to.deep.equal({ proposition: 0, opposition: 0 });
  });

  it('debates(status) filters by status', async () => {
    const mod = await User.create({
      name: 'Mod2', email: `mod2${Date.now()}@t.dev`, password: 'password123', role: 'moderator',
    });
    await Debate.create({ motion: 'Open one', creator: mod._id, proposition: mod._id, status: 'open' });
    await Debate.create({ motion: 'Closed one', creator: mod._id, proposition: mod._id, status: 'closed' });

    const openList = await gql('{ debates(status:"open") { status } }');
    expect(openList.errors).to.be.undefined;
    expect(openList.data.debates.every((d) => d.status === 'open')).to.equal(true);

    const closedList = await gql('{ debates(status:"closed") { status } }');
    expect(closedList.data.debates.every((d) => d.status === 'closed')).to.equal(true);
  });

  it('debate(id) returns null for an unknown id', async () => {
    const out = await gql('{ debate(id:"6af0000000000000000000aa") { id } }');
    expect(out.errors).to.be.undefined;
    expect(out.data.debate).to.equal(null);
  });
});
