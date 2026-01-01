import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #000',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    color: '#666',
  },
  value: {
    fontWeight: 'bold',
    color: '#000',
  },
  box: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginBottom: 15,
    borderRadius: 4,
  },
  costBreakdown: {
    marginTop: 10,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: '1 solid #eee',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTop: '2 solid #000',
    fontSize: 14,
  },
  totalLabel: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  totalValue: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  gridItem: {
    width: '50%',
    marginBottom: 10,
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    color: '#fff',
    padding: '4 8',
    borderRadius: 4,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  statusBadgePending: {
    backgroundColor: '#FF9800',
  },
  statusBadgeOverdue: {
    backgroundColor: '#F44336',
  },
  statusBadgeCancelled: {
    backgroundColor: '#9E9E9E',
  },
  paymentInfo: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    marginTop: 15,
    borderRadius: 4,
    border: '1 solid #4CAF50',
  },
  notes: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginTop: 15,
    borderRadius: 4,
    fontSize: 10,
    color: '#666',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTop: '1 solid #eee',
    paddingTop: 10,
  },
});

const getStatusBadgeStyle = (status) => {
  switch (status) {
    case 'paid':
      return styles.statusBadge;
    case 'pending':
      return [styles.statusBadge, styles.statusBadgePending];
    case 'overdue':
      return [styles.statusBadge, styles.statusBadgeOverdue];
    case 'cancelled':
      return [styles.statusBadge, styles.statusBadgeCancelled];
    default:
      return styles.statusBadge;
  }
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString();
};

export const InvoicePDF = ({ invoice }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.title}>INVOICE</Text>
              <Text style={styles.subtitle}>Invoice #{invoice.id}</Text>
              <Text style={styles.subtitle}>Billing Period: {invoice.billing_period}</Text>
            </View>
              <View style={{ alignItems: 'flex-end' }}>
              <View style={getStatusBadgeStyle(invoice.status)}>
                <Text style={{ color: '#fff', fontSize: 10, textTransform: 'uppercase' }}>
                  {invoice.status}
                </Text>
              </View>
              <Text style={[styles.subtitle, { marginTop: 5, textTransform: 'capitalize' }]}>
                Plan: {invoice.plan_type || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Client Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Information</Text>
            <View style={styles.box}>
              <View style={{ marginBottom: 5 }}>
                <Text style={styles.label}>Name: <Text style={styles.value}>{invoice.client_name || `Client ${invoice.client_id}`}</Text></Text>
              </View>
              <View>
                <Text style={styles.label}>Client ID: <Text style={styles.value}>{invoice.client_id}</Text></Text>
              </View>
            </View>
        </View>

        {/* Cost Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost Breakdown</Text>
          <View style={styles.costBreakdown}>
            <View style={styles.costRow}>
              <Text style={styles.label}>Base Cost ({invoice.plan_type || 'N/A'}):</Text>
              <Text style={styles.value}>{formatCurrency(invoice.base_cost || 0)}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.label}>Usage Cost:</Text>
              <Text style={styles.value}>{formatCurrency(invoice.usage_cost || 0)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.total_cost)}</Text>
            </View>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Important Dates</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Created:</Text>
              <Text style={styles.value}>{formatDate(invoice.created_at)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Due Date:</Text>
              <Text style={styles.value}>{formatDate(invoice.due_date)}</Text>
            </View>
            {invoice.paid_at && (
              <View style={styles.gridItem}>
                <Text style={styles.label}>Paid At:</Text>
                <Text style={styles.value}>{formatDate(invoice.paid_at)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Payment Information */}
        {invoice.payment_provider && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Information</Text>
              <View style={styles.paymentInfo}>
              <View style={{ marginBottom: 5 }}>
                <Text style={{ color: '#2e7d32', fontSize: 11 }}>
                  Provider: <Text style={{ fontWeight: 'bold', color: '#1b5e20' }}>{invoice.payment_provider}</Text>
                </Text>
              </View>
              {invoice.payment_method && (
                <View style={{ marginBottom: 5 }}>
                  <Text style={{ color: '#2e7d32', fontSize: 11 }}>
                    Method: <Text style={{ fontWeight: 'bold', color: '#1b5e20' }}>{invoice.payment_method}</Text>
                  </Text>
                </View>
              )}
              {invoice.payment_provider_id && (
                <View>
                  <Text style={{ color: '#2e7d32', fontSize: 11 }}>
                    Transaction ID: <Text style={{ fontFamily: 'Courier', fontSize: 9, color: '#1b5e20' }}>
                      {invoice.payment_provider_id}
                    </Text>
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notes}>
              <Text>{invoice.notes}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is an automatically generated invoice. For questions, please contact support.</Text>
          <Text style={{ marginTop: 5 }}>
            Generated on {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

