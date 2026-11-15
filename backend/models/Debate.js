const mongoose = require('mongoose');

// A single argument posted by one side in one round.
const argumentSchema = new mongoose.Schema(
  {
    round: { type: Number, required: true }, // 0=opening, 1=rebuttal, 2=closing
    side: { type: String, enum: ['proposition', 'opposition'], required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// One audience vote. A compound unique index (below) enforces one vote per user.
const voteSchema = new mongoose.Schema(
  {
    voter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    side: { type: String, enum: ['proposition', 'opposition'], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const debateSchema = new mongoose.Schema(
  {
    motion: { type: String, required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The creator argues the proposition; the joiner takes the opposition.
    proposition: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    opposition: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'closed'],
      default: 'open',
    },
    // Fixed 3-round format: opening / rebuttal / closing.
    rounds: { type: Number, default: 3 },
    // Whose turn drives progression: index into the turn order.
    currentRound: { type: Number, default: 0 },
    currentSide: {
      type: String,
      enum: ['proposition', 'opposition'],
      default: 'proposition',
    },
    turnDeadline: { type: Date, default: null },
    arguments: [argumentSchema],
    votes: [voteSchema],
    winner: {
      type: String,
      enum: ['proposition', 'opposition', 'draw', null],
      default: null,
    },
  },
  { timestamps: true }
);

// One vote per user per debate.
debateSchema.index({ _id: 1, 'votes.voter': 1 }, { unique: false });

module.exports = mongoose.model('Debate', debateSchema);
