import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { useAuth } from '../context/AuthContext';
import {
  GET_DEBATE,
  JOIN_DEBATE,
  SUBMIT_ARGUMENT,
  DELETE_DEBATE,
} from '../graphql/operations';
import StatusBadge from '../components/StatusBadge';

const ROUND_NAMES = ['Opening', 'Rebuttal', 'Closing'];

const DebateView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [text, setText] = useState('');

  const { data, loading, error, refetch } = useQuery(GET_DEBATE, {
    variables: { id },
  });

  const [joinDebate, { loading: joining, error: joinError }] = useMutation(JOIN_DEBATE, {
    onCompleted: () => refetch(),
  });
  const [submitArgument, { loading: submitting, error: submitError }] = useMutation(
    SUBMIT_ARGUMENT,
    { onCompleted: () => { setText(''); refetch(); } }
  );
  const [deleteDebate, { loading: deleting, error: deleteError }] = useMutation(DELETE_DEBATE, {
    onCompleted: () => navigate('/debates'),
  });

  if (loading) return <p className="p-6 text-gray-500">Loading debate…</p>;
  if (error) return <p className="p-6 text-red-600">Failed to load: {error.message}</p>;
  if (!data?.debate) return <p className="p-6 text-gray-600">Debate not found.</p>;

  const d = data.debate;
  const uid = user?.id;
  const isCreator = uid && d.creator?.id === uid;
  const mySide =
    uid && d.proposition?.id === uid
      ? 'proposition'
      : uid && d.opposition?.id === uid
      ? 'opposition'
      : null;
  const isMyTurn = d.status === 'in-progress' && mySide === d.currentSide;
  const canJoin =
    d.status === 'open' && user && !isCreator && !d.opposition;
  const canDelete = isCreator && d.status === 'open' && !d.opposition;

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="flex justify-between items-start mb-4">
        <h1 className="text-2xl font-bold">{d.motion}</h1>
        <StatusBadge status={d.status} />
      </div>

      <div className="text-sm text-gray-600 mb-6">
        <span className="font-semibold">Proposition:</span> {d.proposition?.name}
        {' · '}
        <span className="font-semibold">Opposition:</span>{' '}
        {d.opposition?.name || '—'}
        {d.status === 'in-progress' && (
          <span className="ml-2">
            · {ROUND_NAMES[d.currentRound] || `Round ${d.currentRound + 1}`} ·{' '}
            {d.currentSide}&apos;s turn
          </span>
        )}
        {d.status === 'closed' && d.winner && (
          <span className="ml-2 font-semibold">
            · Winner: {d.winner === 'draw' ? 'Draw' : d.winner}
          </span>
        )}
      </div>

      {/* Join (debater, open debate) */}
      {canJoin && (
        <div className="bg-white p-4 shadow rounded mb-6">
          <p className="mb-2 text-gray-700">This debate needs an opponent.</p>
          <button
            onClick={() => joinDebate({ variables: { id } })}
            disabled={joining}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join as opposition'}
          </button>
          {joinError && <p className="text-red-600 text-sm mt-2">{joinError.message}</p>}
        </div>
      )}

      {d.status === 'open' && !canJoin && (
        <p className="text-gray-500 mb-6">Waiting for an opponent to join…</p>
      )}

      {/* Arguments thread */}
      <div className="space-y-3 mb-6">
        {d.arguments.length === 0 && (
          <p className="text-gray-500">No arguments yet.</p>
        )}
        {d.arguments.map((a) => (
          <div key={a.id} className="bg-white p-4 shadow rounded">
            <div className="text-xs text-gray-500 mb-1">
              {ROUND_NAMES[a.round] || `Round ${a.round + 1}`} · {a.side} ·{' '}
              {a.author?.name}
            </div>
            <p>{a.text}</p>
          </div>
        ))}
      </div>

      {/* Argument form — only on your turn */}
      {mySide && d.status === 'in-progress' && (
        isMyTurn ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) submitArgument({ variables: { id, text: text.trim() } });
            }}
            className="bg-white p-4 shadow rounded"
          >
            <label className="block text-sm text-gray-600 mb-1">
              Your turn ({mySide})
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full p-2 border rounded mb-2"
              placeholder="Make your argument…"
            />
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit argument'}
            </button>
            {submitError && (
              <p className="text-red-600 text-sm mt-2">{submitError.message}</p>
            )}
          </form>
        ) : (
          <p className="text-gray-500">
            Waiting for {d.currentSide} to post this round…
          </p>
        )
      )}

      {/* Delete — creator, open debate */}
      {canDelete && (
        <div className="mt-6">
          <button
            onClick={() => deleteDebate({ variables: { id } })}
            disabled={deleting}
            className="text-red-600 text-sm hover:underline disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete this debate'}
          </button>
          {deleteError && <p className="text-red-600 text-sm mt-1">{deleteError.message}</p>}
        </div>
      )}
    </div>
  );
};

export default DebateView;
