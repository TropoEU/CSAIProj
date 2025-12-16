# Payment Provider Integration Guide

This guide explains how to integrate a payment provider (Stripe, PayPal, or others) into the CSAI billing system.

## Current Status

✅ **Payment Provider Abstraction Layer Complete**
- All billing infrastructure is ready
- Provider-agnostic interface implemented
- Webhook handling prepared
- Invoice management functional

⚠️ **Payment Provider Not Connected**
- No active payment provider configured
- Manual payment marking available
- Ready for integration when provider is selected

---

## Supported Payment Providers

### Option 1: Stripe (Recommended for Israel)

**Pros:**
- Supports Israeli businesses (with Stripe Atlas or foreign entity)
- Excellent API and documentation
- Automatic currency conversion
- Strong fraud protection
- Webhook reliability

**Cons:**
- Requires business entity setup
- 2.9% + $0.30 per transaction (standard rate)
- May require Stripe Atlas for Israeli businesses

**Setup Steps:**

1. **Create Stripe Account**
   - Visit https://stripe.com
   - Create business account
   - Complete verification (may take 1-3 days)
   - Get API keys (test and live)

2. **Install Stripe SDK**
   ```bash
   cd backend
   npm install stripe
   ```

3. **Add Environment Variables**
   ```env
   # backend/.env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. **Implement Stripe Integration**

   Update `backend/src/services/billingService.js`:

   ```javascript
   import Stripe from 'stripe';

   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

   // Update createPaymentIntent method
   static async createPaymentIntent(invoiceId, amount, currency = 'USD') {
     const paymentIntent = await stripe.paymentIntents.create({
       amount: Math.round(amount * 100), // Convert to cents
       currency: currency.toLowerCase(),
       metadata: { invoiceId },
       automatic_payment_methods: {
         enabled: true,
       },
     });

     return {
       id: paymentIntent.id,
       clientSecret: paymentIntent.client_secret,
       status: paymentIntent.status,
       amount: paymentIntent.amount / 100,
       currency: paymentIntent.currency,
     };
   }

   // Update processPayment method
   static async processPayment(invoiceId, paymentIntentId, provider = 'stripe') {
     const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

     if (paymentIntent.status !== 'succeeded') {
       throw new Error('Payment not completed');
     }

     const invoice = await Invoice.markAsPaid(invoiceId, {
       payment_provider: 'stripe',
       payment_provider_id: paymentIntentId,
       payment_method: paymentIntent.payment_method_types[0],
     });

     return invoice;
   }

   // Update handleWebhook method
   static async handleWebhook(provider, payload) {
     const sig = payload.headers['stripe-signature'];
     let event;

     try {
       event = stripe.webhooks.constructEvent(
         payload.body,
         sig,
         process.env.STRIPE_WEBHOOK_SECRET
       );
     } catch (err) {
       throw new Error(`Webhook signature verification failed: ${err.message}`);
     }

     switch (event.type) {
       case 'payment_intent.succeeded':
         const paymentIntent = event.data.object;
         const invoiceId = paymentIntent.metadata.invoiceId;
         await this.processPayment(invoiceId, paymentIntent.id, 'stripe');
         break;

       case 'payment_intent.payment_failed':
         // Handle failed payment
         console.error('Payment failed:', event.data.object);
         break;

       default:
         console.log(`Unhandled event type: ${event.type}`);
     }

     return { received: true, processed: true };
   }
   ```

5. **Set Up Webhook Endpoint**

   Configure Stripe webhook in dashboard:
   - URL: `https://yourdomain.com/api/admin/billing/webhook?provider=stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Get webhook secret and add to `.env`

6. **Frontend Payment UI**

   ```bash
   cd frontend/admin
   npm install @stripe/stripe-js @stripe/react-stripe-js
   ```

   Create payment component:
   ```jsx
   import { loadStripe } from '@stripe/stripe-js';
   import { Elements, PaymentElement } from '@stripe/react-stripe-js';

   const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

   function CheckoutForm({ invoiceId, amount }) {
     const handleSubmit = async (event) => {
       event.preventDefault();

       // Create payment intent
       const response = await billing.chargeInvoice(invoiceId);

       // Redirect to Stripe Checkout or use Elements
     };

     return (
       <Elements stripe={stripePromise}>
         <form onSubmit={handleSubmit}>
           <PaymentElement />
           <button type="submit">Pay ${amount}</button>
         </form>
       </Elements>
     );
   }
   ```

---

### Option 2: PayPal

**Pros:**
- Well-known and trusted
- Widely available in Israel
- Easy setup for individuals and businesses
- Lower barriers to entry

**Cons:**
- Higher fees than Stripe in some cases
- Less developer-friendly API
- Fewer advanced features

**Setup Steps:**

1. **Create PayPal Business Account**
   - Visit https://www.paypal.com/il/business
   - Create business account
   - Complete verification

2. **Install PayPal SDK**
   ```bash
   cd backend
   npm install @paypal/checkout-server-sdk
   ```

3. **Add Environment Variables**
   ```env
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   PAYPAL_MODE=sandbox  # or 'live'
   ```

4. **Implement PayPal Integration**

   Similar to Stripe, update `billingService.js` methods to use PayPal SDK.

---

### Option 3: Local Israeli Payment Providers

Consider these Israel-specific options:

**Tranzila**
- Israeli payment gateway
- Supports Israeli credit cards and local payment methods
- Good for local businesses
- https://www.tranzila.com

**Meshulam**
- Israeli payment solution
- Supports multi-currency
- Good local support
- https://www.meshulam.co.il

**Cardcom**
- Israeli payment processor
- Supports various payment methods
- Good for Hebrew-language businesses
- https://www.cardcom.co.il

---

## Testing Payment Integration

### Test Mode Checklist

- [ ] Use test API keys
- [ ] Test successful payment flow
- [ ] Test failed payment flow
- [ ] Test webhook delivery
- [ ] Test invoice status updates
- [ ] Test refund process
- [ ] Test various payment methods
- [ ] Test error handling

### Test Cards (Stripe)

```
Successful payment: 4242 4242 4242 4242
Declined payment:   4000 0000 0000 0002
Auth required:      4000 0025 0000 3155
```

---

## Security Considerations

1. **API Keys**
   - Never commit API keys to git
   - Use environment variables
   - Rotate keys regularly
   - Use separate test/live keys

2. **Webhook Security**
   - Always verify webhook signatures
   - Use HTTPS only
   - Validate payload structure
   - Log all webhook events

3. **PCI Compliance**
   - Never store card details
   - Use payment provider's hosted forms
   - Tokenize payment methods
   - Follow PCI DSS guidelines

4. **Data Protection**
   - Encrypt sensitive data
   - Log payment events (without card details)
   - Implement fraud detection
   - Monitor suspicious activity

---

## Going Live Checklist

- [ ] Complete payment provider verification
- [ ] Switch to live API keys
- [ ] Configure production webhook URLs
- [ ] Test with real payment methods
- [ ] Set up monitoring and alerts
- [ ] Configure invoice auto-generation
- [ ] Set up payment failure notifications
- [ ] Document payment flow for users
- [ ] Train support team
- [ ] Prepare terms of service and refund policy

---

## Support and Resources

### Stripe
- Documentation: https://stripe.com/docs
- Support: https://support.stripe.com
- Status: https://status.stripe.com

### PayPal
- Documentation: https://developer.paypal.com/docs
- Support: https://www.paypal.com/il/smarthelp/contact-us

### General
- PCI Compliance: https://www.pcisecuritystandards.org
- Israeli Payment Regulations: Check with Bank of Israel

---

## Estimated Implementation Time

- **Stripe Integration**: 4-8 hours
- **PayPal Integration**: 6-10 hours
- **Local Provider Integration**: 8-12 hours (varies by provider)
- **Testing**: 2-4 hours
- **Documentation**: 1-2 hours

**Total**: 1-2 days for complete integration and testing

---

## Need Help?

The billing infrastructure is production-ready and waiting for payment provider integration. Choose the provider that best fits your business needs and follow the steps above. All the abstraction layers are in place to make integration straightforward.
