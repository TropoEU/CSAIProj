-- UP
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    billing_period VARCHAR(7) NOT NULL,  -- YYYY-MM format
    plan_type VARCHAR(50) NOT NULL,
    base_cost DECIMAL(10, 2) DEFAULT 0,
    usage_cost DECIMAL(10, 2) DEFAULT 0,
    total_cost DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',  -- pending/paid/overdue/cancelled
    payment_provider VARCHAR(50),  -- stripe/paypal/manual/null
    payment_provider_id VARCHAR(255),  -- external payment ID
    payment_method VARCHAR(50),  -- credit_card/bank_transfer/manual
    created_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    due_date DATE,
    notes TEXT
);

CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_billing_period ON invoices(billing_period);
CREATE INDEX idx_invoices_status ON invoices(status);

-- DOWN
-- DROP INDEX IF EXISTS idx_invoices_status;
-- DROP INDEX IF EXISTS idx_invoices_billing_period;
-- DROP INDEX IF EXISTS idx_invoices_client_id;
-- DROP TABLE IF EXISTS invoices;
