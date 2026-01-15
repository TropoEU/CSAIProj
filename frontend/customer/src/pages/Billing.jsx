import { useState, useEffect } from 'react';
import { billing } from '../services/api';
import { InvoicePDF } from '../components/InvoicePDF';
import { pdf } from '@react-pdf/renderer';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Billing() {
  const { client } = useAuth();
  const { t, isRTL, formatDate, formatCurrency } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await billing.getInvoices();
        setInvoices(response.data.invoices || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch invoices:', err);
        setError(err.response?.data?.message || t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid':
        return t('billing.paid');
      case 'pending':
        return t('billing.pending');
      case 'overdue':
        return t('billing.overdue');
      case 'cancelled':
        return t('billing.cancelled');
      default:
        return status;
    }
  };

  const handleDownloadPDF = async (invoice) => {
    try {
      setDownloading(invoice.id);
      const blob = await pdf(<InvoicePDF invoice={invoice} clientName={client?.name} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${invoice.invoiceNumber}-${invoice.period}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert(t('billing.downloadError'));
    } finally {
      setDownloading(null);
    }
  };

  const handleViewPDF = async (invoice) => {
    try {
      setDownloading(invoice.id);
      const blob = await pdf(<InvoicePDF invoice={invoice} clientName={client?.name} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Failed to view PDF:', err);
      alert(t('billing.downloadError'));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={isRTL ? 'text-right' : ''}>
        <h1 className="text-3xl font-bold text-gray-900">{t('billing.title')}</h1>
        <p className="text-gray-600 mt-1">{t('billing.subtitle')}</p>
      </div>

      {/* Invoices */}
      <div className="card">
        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full" dir={isRTL ? 'rtl' : 'ltr'}>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('billing.invoiceNumber')}
                  </th>
                  <th
                    className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('billing.period')}
                  </th>
                  <th
                    className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('billing.amount')}
                  </th>
                  <th
                    className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('billing.status')}
                  </th>
                  <th
                    className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('billing.dueDate')}
                  </th>
                  <th
                    className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-left' : 'text-right'}`}
                  >
                    {t('billing.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      #{invoice.invoiceNumber}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {invoice.period || 'N/A'}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {formatCurrency(invoice.amount || 0)}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getStatusColor(invoice.status)}`}
                      >
                        {getStatusText(invoice.status)}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {invoice.dueDate ? formatDate(invoice.dueDate) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleViewPDF(invoice)}
                          disabled={downloading === invoice.id}
                          className="text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t('billing.view')}
                        >
                          {downloading === invoice.id ? (
                            <svg
                              className="animate-spin h-4 w-4"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                          ) : (
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(invoice)}
                          disabled={downloading === invoice.id}
                          className="text-gray-600 hover:text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t('billing.download')}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-400"
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
            <p className="text-lg font-medium">{t('billing.noInvoices')}</p>
            <p className="text-sm mt-1">{t('billing.noInvoicesDesc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
