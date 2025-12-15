import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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
  box: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginBottom: 15,
    borderRadius: 4,
  },
  label: {
    color: '#666',
    marginBottom: 5,
  },
  value: {
    fontWeight: 'bold',
    color: '#000',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 15,
    borderTop: '2 solid #000',
    fontSize: 14,
  },
  totalLabel: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  totalValue: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#7c3aed',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  gridItem: {
    width: '50%',
    marginBottom: 15,
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    color: '#fff',
    padding: '6 12',
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
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const InvoicePDF = ({ invoice, clientName }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.title}>INVOICE</Text>
              <Text style={styles.subtitle}>Invoice #{invoice.invoiceNumber}</Text>
              <Text style={styles.subtitle}>Billing Period: {invoice.period}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={getStatusBadgeStyle(invoice.status)}>
                <Text style={{ color: '#fff', fontSize: 10, textTransform: 'uppercase' }}>
                  {invoice.status}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Client Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billed To</Text>
          <View style={styles.box}>
            <Text style={styles.value}>{clientName || 'Customer'}</Text>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.amount)}</Text>
          </View>
        </View>

        {/* Important Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Important Dates</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Invoice Date:</Text>
              <Text style={styles.value}>{formatDate(invoice.createdAt)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Due Date:</Text>
              <Text style={styles.value}>{formatDate(invoice.dueDate)}</Text>
            </View>
            {invoice.paidAt && (
              <View style={styles.gridItem}>
                <Text style={styles.label}>Paid Date:</Text>
                <Text style={styles.value}>{formatDate(invoice.paidAt)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Payment Status */}
        {invoice.status === 'paid' && invoice.paidAt && (
          <View style={styles.section}>
            <View style={{
              backgroundColor: '#e8f5e9',
              padding: 12,
              borderRadius: 4,
              border: '1 solid #4CAF50',
            }}>
              <Text style={{ color: '#2e7d32', fontSize: 11, fontWeight: 'bold' }}>
                ✓ Payment Received
              </Text>
              <Text style={{ color: '#2e7d32', fontSize: 10, marginTop: 5 }}>
                This invoice has been paid in full on {formatDate(invoice.paidAt)}
              </Text>
            </View>
          </View>
        )}

        {invoice.status === 'pending' && (
          <View style={styles.section}>
            <View style={{
              backgroundColor: '#fff3e0',
              padding: 12,
              borderRadius: 4,
              border: '1 solid #FF9800',
            }}>
              <Text style={{ color: '#e65100', fontSize: 11, fontWeight: 'bold' }}>
                Payment Pending
              </Text>
              <Text style={{ color: '#e65100', fontSize: 10, marginTop: 5 }}>
                Please submit payment by {formatDate(invoice.dueDate)}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is an automatically generated invoice.</Text>
          <Text style={{ marginTop: 5 }}>
            For questions or support, please contact your account administrator.
          </Text>
          <Text style={{ marginTop: 8 }}>
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
