// Reusable status badge with consistent colour semantics across list + view.
const STYLES = {
  open: 'bg-green-100 text-green-800',
  'in-progress': 'bg-yellow-100 text-yellow-800',
  closed: 'bg-gray-200 text-gray-700',
};

const StatusBadge = ({ status }) => (
  <span
    className={`text-xs font-semibold px-2 py-1 rounded uppercase ${
      STYLES[status] || 'bg-gray-100 text-gray-600'
    }`}
  >
    {status}
  </span>
);

export default StatusBadge;
