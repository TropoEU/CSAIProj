import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { billing, clients } from '../services/api';
import { InvoicePDF } from '../components/InvoicePDF';
import { pdf } from '@react-pdf/renderer';
import {
  Card,
  CardBody,
  Button,
  Input,
  Select,
  Modal,
  LoadingSpinner,
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../components/common';

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isMarkPaidModalOpen, setIsMarkPaidModalOpen] = useState(false);
  const [isInvoiceDetailModalOpen, setIsInvoiceDetailModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientList, setClientList] = useState([]);
  const [clientFilter, setClientFilter] = useState('all');

  const {
    register: registerGenerate,
    handleSubmit: handleSubmitGenerate,
    reset: resetGenerate,
    formState: { errors: errorsGenerate, isSubmitting: isSubmittingGenerate },
  } = useForm();

  const {
    register: registerMarkPaid,
    handleSubmit: handleSubmitMarkPaid,
    reset: resetMarkPaid,
    formState: { isSubmitting: isSubmittingMarkPaid },
  } = useForm();

  useEffect(() => {
    fetchData();
  }, [statusFilter, clientFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (clientFilter !== 'all') params.clientId = parseInt(clientFilter);

      const [invoicesRes, revenueRes, clientsRes] = await Promise.all([
        billing.getInvoices(params),
        billing.getRevenue({ months: 12 }),
        clients.getAll(),
      ]);

      setInvoices(invoicesRes.data);
      setRevenue(revenueRes.data);
      setClientList(clientsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const onGenerateInvoice = async (data) => {
    try {
      await billing.generateInvoice({
        clientId: data.clientId === 'all' ? null : data.clientId,
        billingPeriod: data.billingPeriod,
        force: data.force || false,
      });
      setIsGenerateModalOpen(false);
      resetGenerate();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate invoice');
    }
  };

  const onMarkAsPaid = async (data) => {
    try {
      await billing.markAsPaid(selectedInvoice.id, {
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      });
      setIsMarkPaidModalOpen(false);
      setSelectedInvoice(null);
      resetMarkPaid();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark invoice as paid');
    }
  };

  const openMarkPaidModal = (invoice) => {
    setSelectedInvoice(invoice);
    setIsMarkPaidModalOpen(true);
  };

  const cancelInvoice = async (invoiceId) => {
    if (!confirm('Are you sure you want to cancel this invoice?')) return;

    try {
      setError(null);
      await billing.cancelInvoice(invoiceId, {
        notes: 'Cancelled via admin dashboard',
      });
      setSuccessMessage('Invoice cancelled successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel invoice');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'warning',
      paid: 'success',
      overdue: 'danger',
      cancelled: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Get current month in YYYY-MM format for default invoice generation
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
          <p className="text-gray-600 mt-1">Manage invoices and track revenue</p>
        </div>
        <Button onClick={() => setIsGenerateModalOpen(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Generate Invoice
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Revenue Summary Cards */}
      {revenue && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(revenue.summary.paid_revenue || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(revenue.summary.pending_revenue || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(revenue.summary.overdue_revenue || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {revenue.summary.total_invoices || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Invoices Table */}
      <Card>
        <CardBody>
          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <Select
                label="Filter by Client"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Clients' },
                  ...clientList.map((client) => ({
                    value: client.id.toString(),
                    label: client.name,
                  })),
                ]}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Filter by Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
            </div>
          </div>

          {/* Invoices Table */}
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 mx-auto text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
              <p className="text-gray-600">Generate invoices for your clients to see them here.</p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Invoice ID</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Period</TableHeader>
                  <TableHeader>Plan</TableHeader>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Due Date</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>#{invoice.id}</TableCell>
                    <TableCell>
                      <Link
                        to={`/clients/${invoice.client_id}`}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        {invoice.client_name || `Client ${invoice.client_id}`}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.billing_period}</TableCell>
                    <TableCell>
                      <Badge variant="default">{invoice.plan_type}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(invoice.total_cost)}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>{formatDate(invoice.due_date)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setIsInvoiceDetailModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View
                        </button>
                        {invoice.status === 'pending' && (
                          <>
                            <button
                              onClick={() => openMarkPaidModal(invoice)}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              Mark Paid
                            </button>
                            <button
                              onClick={() => cancelInvoice(invoice.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {invoice.status === 'overdue' && (
                          <button
                            onClick={() => openMarkPaidModal(invoice)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            Mark Paid
                          </button>
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

      {/* Generate Invoice Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => {
          setIsGenerateModalOpen(false);
          resetGenerate();
        }}
        title="Generate Invoice"
      >
        <form onSubmit={handleSubmitGenerate(onGenerateInvoice)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client
            </label>
            <Select {...registerGenerate('clientId', { required: 'Client is required' })}>
              <option value="all">All Clients</option>
              {clientList.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
            {errorsGenerate.clientId && (
              <p className="text-red-600 text-sm mt-1">{errorsGenerate.clientId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Billing Period (YYYY-MM)
            </label>
            <Input
              type="text"
              placeholder="2025-12"
              defaultValue={getCurrentMonth()}
              {...registerGenerate('billingPeriod', {
                required: 'Billing period is required',
                pattern: {
                  value: /^\d{4}-\d{2}$/,
                  message: 'Invalid format. Use YYYY-MM',
                },
              })}
            />
            {errorsGenerate.billingPeriod && (
              <p className="text-red-600 text-sm mt-1">{errorsGenerate.billingPeriod.message}</p>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="force"
              {...registerGenerate('force')}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
            />
            <label htmlFor="force" className="ml-2 text-sm text-gray-700">
              Force regenerate (replace existing invoice)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsGenerateModalOpen(false);
                resetGenerate();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmittingGenerate}>
              {isSubmittingGenerate ? 'Generating...' : 'Generate Invoice'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mark as Paid Modal */}
      <Modal
        isOpen={isMarkPaidModalOpen}
        onClose={() => {
          setIsMarkPaidModalOpen(false);
          setSelectedInvoice(null);
          resetMarkPaid();
        }}
        title="Mark Invoice as Paid"
      >
        {selectedInvoice && (
          <form onSubmit={handleSubmitMarkPaid(onMarkAsPaid)} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600">Invoice ID: #{selectedInvoice.id}</p>
              <p className="text-sm text-gray-600">Client: {selectedInvoice.client_name}</p>
              <p className="text-lg font-bold text-gray-900 mt-2">
                Amount: {formatCurrency(selectedInvoice.total_cost)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <Select {...registerMarkPaid('paymentMethod')}>
                <option value="manual">Manual</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_card">Credit Card</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                {...registerMarkPaid('notes')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows="3"
                placeholder="Add any notes about the payment..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsMarkPaidModalOpen(false);
                  setSelectedInvoice(null);
                  resetMarkPaid();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingMarkPaid}>
                {isSubmittingMarkPaid ? 'Processing...' : 'Mark as Paid'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={isInvoiceDetailModalOpen}
        onClose={() => {
          setIsInvoiceDetailModalOpen(false);
          setSelectedInvoice(null);
        }}
        title="Invoice Details"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            {/* Invoice Header */}
            <div className="border-b pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Invoice #{selectedInvoice.id}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Period: {selectedInvoice.billing_period}
                  </p>
                </div>
                <div className="text-right">
                  {getStatusBadge(selectedInvoice.status)}
                  <p className="text-sm text-gray-600 mt-1">
                    Plan: <span className="capitalize font-medium">{selectedInvoice.plan_type}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Client Information</h4>
              <div className="space-y-1 text-sm">
                <p className="text-gray-600">
                  Name: <span className="text-gray-900 font-medium">{selectedInvoice.client_name}</span>
                </p>
                <p className="text-gray-600">
                  Client ID: <span className="text-gray-900">{selectedInvoice.client_id}</span>
                </p>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Cost Breakdown</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base Cost ({selectedInvoice.plan_type}):</span>
                  <span className="text-gray-900 font-medium">
                    {formatCurrency(selectedInvoice.base_cost || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Usage Cost:</span>
                  <span className="text-gray-900 font-medium">
                    {formatCurrency(selectedInvoice.usage_cost || 0)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-gray-900 font-semibold">Total Amount:</span>
                  <span className="text-gray-900 font-bold text-lg">
                    {formatCurrency(selectedInvoice.total_cost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Created:</p>
                <p className="text-sm text-gray-900 font-medium">
                  {formatDate(selectedInvoice.created_at)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Due Date:</p>
                <p className="text-sm text-gray-900 font-medium">
                  {formatDate(selectedInvoice.due_date)}
                </p>
              </div>
              {selectedInvoice.paid_at && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Paid At:</p>
                    <p className="text-sm text-gray-900 font-medium">
                      {formatDate(selectedInvoice.paid_at)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Payment Information */}
            {selectedInvoice.payment_provider && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="text-sm font-semibold text-green-900 mb-2">Payment Information</h4>
                <div className="space-y-1 text-sm">
                  <p className="text-green-800">
                    Provider: <span className="font-medium">{selectedInvoice.payment_provider}</span>
                  </p>
                  {selectedInvoice.payment_method && (
                    <p className="text-green-800">
                      Method: <span className="font-medium">{selectedInvoice.payment_method}</span>
                    </p>
                  )}
                  {selectedInvoice.payment_provider_id && (
                    <p className="text-green-800">
                      Transaction ID: <span className="font-mono text-xs">{selectedInvoice.payment_provider_id}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedInvoice.notes && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  {selectedInvoice.notes}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const blob = await pdf(<InvoicePDF invoice={selectedInvoice} />).toBlob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `Invoice-${selectedInvoice.id}-${selectedInvoice.billing_period}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('Failed to generate PDF:', err);
                    setError('Failed to generate PDF. Please try again.');
                  }
                }}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export PDF
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsInvoiceDetailModalOpen(false);
                  setSelectedInvoice(null);
                }}
              >
                Close
              </Button>
              {selectedInvoice.status === 'pending' && (
                <Button
                  onClick={() => {
                    setIsInvoiceDetailModalOpen(false);
                    openMarkPaidModal(selectedInvoice);
                  }}
                >
                  Mark as Paid
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
