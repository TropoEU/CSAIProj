import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { conversations, clients } from '../services/api';
import {
  Card,
  CardBody,
  Button,
  Input,
  Select,
  LoadingSpinner,
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../components/common';

export default function Conversations() {
  const [conversationList, setConversationList] = useState([]);
  const [clientList, setClientList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [page, clientFilter]);

  const fetchClients = async () => {
    try {
      const response = await clients.getAll();
      setClientList(response.data);
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  };

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        ...(clientFilter !== 'all' && { clientId: clientFilter }),
      };
      const response = await conversations.getAll(params);
      setConversationList(response.data.conversations || response.data);
      setTotalPages(response.data.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setIsExporting(true);
    try {
      const params = {
        format,
        ...(clientFilter !== 'all' && { clientId: clientFilter }),
      };
      const response = await conversations.export(params);

      // Create blob and download
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversations.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.response?.data?.error || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredConversations = conversationList.filter((conv) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.session_id?.toLowerCase().includes(searchLower) ||
      conv.client_name?.toLowerCase().includes(searchLower)
    );
  });

  const formatDuration = (startTime, endTime) => {
    if (!startTime) return 'N/A';
    if (!endTime) return 'Active';
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'N/A';
    const diff = Math.floor((end - start) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  const formatTokenCount = (tokens) => {
    if (!tokens || tokens === 0) return '0';
    if (tokens < 1000) return tokens.toString();
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
    return `${(tokens / 1000000).toFixed(2)}M`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
          <p className="text-gray-600 mt-1">Monitor and review chat sessions</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => handleExport('csv')}
            loading={isExporting}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('json')}
            loading={isExporting}
          >
            Export JSON
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search by session ID or client..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Select
          value={clientFilter}
          onChange={(e) => {
            setClientFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All Clients' },
            ...clientList.map((c) => ({ value: c.id, label: c.name })),
          ]}
          className="w-full sm:w-48"
        />
      </div>

      {/* Conversations Table */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Session ID</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Messages</TableHeader>
                  <TableHeader>Tool Calls</TableHeader>
                  <TableHeader>Tokens</TableHeader>
                  <TableHeader>Duration</TableHeader>
                  <TableHeader>Started</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredConversations.length > 0 ? (
                  filteredConversations.map((conv) => (
                    <TableRow key={conv.id}>
                      <TableCell className="font-mono text-sm">
                        {conv.session_id?.substring(0, 12)}...
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {conv.client_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{conv.message_count || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={conv.tool_call_count > 0 ? 'info' : 'default'}>
                          {conv.tool_call_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600 font-mono text-sm">
                        {formatTokenCount(conv.tokens_total)}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatDuration(conv.started_at, conv.ended_at)}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {conv.started_at ? new Date(conv.started_at).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/conversations/${conv.id}`}
                          className="text-primary-600 hover:text-primary-700 font-medium"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      No conversations found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
