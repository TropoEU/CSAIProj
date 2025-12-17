import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { escalations as escalationsApi } from '../services/api';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  LoadingSpinner,
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  Select,
  Modal,
} from '../components/common';

export default function Escalations() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    loadEscalations();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadEscalations, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const loadEscalations = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await escalationsApi.getAll(params);
      setEscalations(response.data);
    } catch (err) {
      console.error('Error loading escalations:', err);
      setError(err.response?.data?.error || 'Failed to load escalations');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    try {
      setIsResolving(true);
      await escalationsApi.resolve(selectedEscalation.id, resolveNotes);
      setIsResolveModalOpen(false);
      setSelectedEscalation(null);
      setResolveNotes('');
      await loadEscalations();
    } catch (err) {
      console.error('Error resolving escalation:', err);
      alert('Failed to resolve escalation');
    } finally {
      setIsResolving(false);
    }
  };

  const handleAcknowledge = async (escalationId) => {
    try {
      await escalationsApi.updateStatus(escalationId, 'acknowledged');
      await loadEscalations();
    } catch (err) {
      console.error('Error acknowledging escalation:', err);
      alert('Failed to acknowledge escalation');
    }
  };

  const handleCancel = async (escalationId) => {
    if (!confirm('Are you sure you want to cancel this escalation?')) {
      return;
    }

    try {
      await escalationsApi.cancel(escalationId);
      await loadEscalations();
    } catch (err) {
      console.error('Error cancelling escalation:', err);
      alert('Failed to cancel escalation');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'warning',
      acknowledged: 'info',
      resolved: 'success',
      cancelled: 'secondary',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const getReasonLabel = (reason) => {
    const labels = {
      user_requested: 'User Requested',
      ai_stuck: 'AI Stuck',
      low_confidence: 'Low Confidence',
      explicit_trigger: 'Explicit Trigger',
    };
    return labels[reason] || reason;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading && escalations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escalations</h1>
          <p className="text-gray-600 mt-1">
            Conversations that need human attention
          </p>
        </div>
        <Button onClick={loadEscalations} variant="secondary">
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              All Escalations ({escalations.length})
            </h2>
            <div className="flex items-center space-x-4">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {escalations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No escalations found</p>
              {statusFilter !== 'all' && (
                <p className="text-sm mt-2">
                  Try changing the filter to see more results
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Reason</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Escalated At</TableHeader>
                  <TableHeader>Conversation</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {escalations.map((escalation) => (
                  <TableRow key={escalation.id}>
                    <TableCell>{escalation.client_name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {getReasonLabel(escalation.reason)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(escalation.status)}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(escalation.escalated_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/conversations/${escalation.conversation_id}`}
                        className="text-indigo-600 hover:text-indigo-800 text-sm"
                      >
                        View Conversation
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {escalation.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAcknowledge(escalation.id)}
                            >
                              Acknowledge
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedEscalation(escalation);
                                setIsResolveModalOpen(true);
                              }}
                            >
                              Resolve
                            </Button>
                          </>
                        )}
                        {escalation.status === 'acknowledged' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedEscalation(escalation);
                              setIsResolveModalOpen(true);
                            }}
                          >
                            Resolve
                          </Button>
                        )}
                        {(escalation.status === 'pending' ||
                          escalation.status === 'acknowledged') && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleCancel(escalation.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Resolve Modal */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => {
          setIsResolveModalOpen(false);
          setSelectedEscalation(null);
          setResolveNotes('');
        }}
        title="Resolve Escalation"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Add notes about how this escalation was resolved (optional):
          </p>
          <textarea
            value={resolveNotes}
            onChange={(e) => setResolveNotes(e.target.value)}
            rows={4}
            placeholder="e.g., Contacted customer directly and resolved their issue..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsResolveModalOpen(false);
                setSelectedEscalation(null);
                setResolveNotes('');
              }}
              disabled={isResolving}
            >
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={isResolving}>
              {isResolving ? 'Resolving...' : 'Mark as Resolved'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
