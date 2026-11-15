import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { useAuth } from '../context/AuthContext';
import { GET_DEBATES, CREATE_DEBATE } from '../graphql/operations';
import StatusBadge from '../components/StatusBadge';

const Debates = () => {
  const { user } = useAuth();
  const isModerator = user?.role === 'moderator';
  const [motion, setMotion] = useState('');

  const { data, loading, error, refetch } = useQuery(GET_DEBATES);
  const [createDebate, { loading: creating, error: createError }] = useMutation(CREATE_DEBATE, {
    onCompleted: () => {
      setMotion('');
      refetch();
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!motion.trim()) return;
    createDebate({ variables: { motion: motion.trim() } });
  };

  const debates = data?.debates ?? [];

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-bold mb-6">Debates</h1>

      {/* Create — moderators only */}
      {isModerator && (
        <form onSubmit={handleCreate} className="bg-white p-4 shadow rounded mb-6">
          <label className="block text-sm text-gray-600 mb-1">New motion</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Cats are better than dogs"
              value={motion}
              onChange={(e) => setMotion(e.target.value)}
              className="flex-1 p-2 border rounded"
            />
            <button
              type="submit"
              disabled={creating || !motion.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create debate'}
            </button>
          </div>
          {createError && (
            <p className="text-red-600 text-sm mt-2">{createError.message}</p>
          )}
        </form>
      )}

      {loading && <p className="text-gray-500">Loading debates…</p>}
      {error && <p className="text-red-600">Failed to load debates: {error.message}</p>}

      {/* Empty state */}
      {!loading && !error && debates.length === 0 && (
        <div className="bg-white p-8 shadow rounded text-center text-gray-600">
          <p className="mb-2">No debates yet.</p>
          {isModerator ? (
            <p>Create the first motion above.</p>
          ) : (
            <p>Check back soon, or ask a moderator to start one.</p>
          )}
        </div>
      )}

      {/* List */}
      <ul className="space-y-3">
        {debates.map((d) => (
          <li key={d.id} className="bg-white p-4 shadow rounded flex justify-between items-center">
            <div>
              <Link to={`/debates/${d.id}`} className="text-lg font-semibold hover:underline">
                {d.motion}
              </Link>
              <div className="text-sm text-gray-500 mt-1">
                by {d.creator?.name}
                {d.opposition ? ` vs ${d.opposition.name}` : ' · needs an opponent'}
                {d.status === 'in-progress' && ` · round ${d.currentRound + 1}/3`}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={d.status} />
              <Link
                to={`/debates/${d.id}`}
                className="text-blue-600 text-sm hover:underline"
              >
                {d.status === 'open' && !isModerator ? 'Join' : 'View'}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Debates;
