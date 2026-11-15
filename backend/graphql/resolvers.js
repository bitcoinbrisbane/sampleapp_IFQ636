const { GraphQLError } = require('graphql');
const Debate = require('../models/Debate');
const User = require('../models/User');

// Per-turn time-box. 24h in production; overridable for tests/demo via env.
const TURN_MS = Number(process.env.TURN_MS || 24 * 60 * 60 * 1000);

function requireAuth(ctx) {
  if (!ctx.user) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  return ctx.user;
}

function forbidden(message) {
  return new GraphQLError(message, {
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });
}

function badRequest(message) {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', http: { status: 400 } },
  });
}

// Advance a debate's turn/round if the current turn's deadline has elapsed.
// Turn order per round: proposition then opposition. After opposition's closing
// turn in the final round, the debate closes.
function advanceIfExpired(debate) {
  if (debate.status !== 'in-progress' || !debate.turnDeadline) return debate;
  while (debate.status === 'in-progress' && debate.turnDeadline && debate.turnDeadline <= new Date()) {
    stepTurn(debate);
  }
  return debate;
}

function stepTurn(debate) {
  if (debate.currentSide === 'proposition') {
    debate.currentSide = 'opposition';
    debate.turnDeadline = new Date(Date.now() + TURN_MS);
  } else {
    // opposition just finished -> next round
    debate.currentSide = 'proposition';
    debate.currentRound += 1;
    if (debate.currentRound >= debate.rounds) {
      debate.status = 'closed';
      debate.turnDeadline = null;
    } else {
      debate.turnDeadline = new Date(Date.now() + TURN_MS);
    }
  }
}

function sideOf(debate, userId) {
  if (debate.proposition && String(debate.proposition) === String(userId)) return 'proposition';
  if (debate.opposition && String(debate.opposition) === String(userId)) return 'opposition';
  return null;
}

function tally(debate) {
  const t = { proposition: 0, opposition: 0 };
  for (const v of debate.votes) t[v.side] += 1;
  return t;
}

const resolvers = {
  // Resolve ObjectId refs to User docs lazily.
  Debate: {
    id: (d) => d._id.toString(),
    creator: (d) => User.findById(d.creator),
    proposition: (d) => User.findById(d.proposition),
    opposition: (d) => (d.opposition ? User.findById(d.opposition) : null),
    voteTally: (d) => tally(d),
  },
  Argument: {
    id: (a) => a._id.toString(),
    author: (a) => User.findById(a.author),
    createdAt: (a) => a.createdAt?.toISOString?.() ?? String(a.createdAt),
  },
  Vote: {
    id: (v) => v._id.toString(),
    createdAt: (v) => v.createdAt?.toISOString?.() ?? String(v.createdAt),
  },
  User: { id: (u) => u._id.toString() },

  Query: {
    debates: async (_p, { status }) => {
      const filter = status ? { status } : {};
      const list = await Debate.find(filter).sort({ createdAt: -1 });
      // Lazily advance any expired in-progress debates on read.
      for (const d of list) {
        if (advanceIfExpired(d).isModified?.()) await d.save();
      }
      return list;
    },
    debate: async (_p, { id }) => {
      const d = await Debate.findById(id);
      if (!d) return null;
      if (advanceIfExpired(d).isModified?.()) await d.save();
      return d;
    },
  },

  Mutation: {
    // --- CREATE ---
    createDebate: async (_p, { motion }, ctx) => {
      const user = requireAuth(ctx);
      if (!motion || !motion.trim()) throw badRequest('Motion is required');
      const debate = await Debate.create({
        motion: motion.trim(),
        creator: user._id,
        proposition: user._id, // creator argues the proposition
        status: 'open',
      });
      return debate;
    },

    // --- UPDATE: join ---
    joinDebate: async (_p, { id }, ctx) => {
      const user = requireAuth(ctx);
      const debate = await Debate.findById(id);
      if (!debate) throw badRequest('Debate not found');
      if (debate.status !== 'open') throw forbidden('Debate is not open to join');
      if (String(debate.proposition) === String(user._id)) {
        throw forbidden('You created this debate; you cannot also oppose it');
      }
      if (debate.opposition) throw forbidden('Debate already has an opponent');
      debate.opposition = user._id;
      debate.status = 'in-progress';
      debate.currentRound = 0;
      debate.currentSide = 'proposition';
      debate.turnDeadline = new Date(Date.now() + TURN_MS);
      await debate.save();
      return debate;
    },

    // --- UPDATE: submit an argument (turn + time enforced) ---
    submitArgument: async (_p, { id, text }, ctx) => {
      const user = requireAuth(ctx);
      if (!text || !text.trim()) throw badRequest('Argument text is required');
      const debate = await Debate.findById(id);
      if (!debate) throw badRequest('Debate not found');
      advanceIfExpired(debate);
      if (debate.status !== 'in-progress') throw forbidden('Debate is not in progress');

      const mySide = sideOf(debate, user._id);
      if (!mySide) throw forbidden('You are not a participant in this debate');
      if (mySide !== debate.currentSide) throw forbidden('It is not your turn');
      if (debate.turnDeadline && debate.turnDeadline <= new Date()) {
        throw forbidden('The time-box for this turn has expired');
      }

      debate.arguments.push({
        round: debate.currentRound,
        side: mySide,
        author: user._id,
        text: text.trim(),
      });
      stepTurn(debate); // advance to the next turn/round (may close the debate)
      await debate.save();
      return debate;
    },

    // --- UPDATE: moderator/creator closes early (optional officiating action) ---
    closeDebate: async (_p, { id }, ctx) => {
      const user = requireAuth(ctx);
      const debate = await Debate.findById(id);
      if (!debate) throw badRequest('Debate not found');
      if (String(debate.creator) !== String(user._id)) {
        throw forbidden('Only the creator can close this debate');
      }
      debate.status = 'closed';
      debate.turnDeadline = null;
      await debate.save();
      return debate;
    },

    // --- CREATE/UPDATE: cast a vote (one per user) ---
    castVote: async (_p, { id, side }, ctx) => {
      const user = requireAuth(ctx);
      if (!['proposition', 'opposition'].includes(side)) throw badRequest('Invalid side');
      const debate = await Debate.findById(id);
      if (!debate) throw badRequest('Debate not found');
      advanceIfExpired(debate);
      if (debate.status !== 'closed') throw forbidden('Voting opens once the debate is closed');
      if (debate.votes.some((v) => String(v.voter) === String(user._id))) {
        throw forbidden('You have already voted on this debate');
      }
      debate.votes.push({ voter: user._id, side });
      // Recompute winner from the tally.
      const t = tally(debate);
      debate.winner =
        t.proposition === t.opposition
          ? 'draw'
          : t.proposition > t.opposition
          ? 'proposition'
          : 'opposition';
      await debate.save();
      return debate;
    },

    // --- DELETE ---
    deleteDebate: async (_p, { id }, ctx) => {
      const user = requireAuth(ctx);
      const debate = await Debate.findById(id);
      if (!debate) throw badRequest('Debate not found');
      if (String(debate.creator) !== String(user._id)) {
        throw forbidden('Only the creator can delete this debate');
      }
      if (debate.status !== 'open' || debate.opposition) {
        throw forbidden('Only an open debate with no opponent can be deleted');
      }
      await Debate.deleteOne({ _id: id });
      return true;
    },
  },
};

module.exports = resolvers;
