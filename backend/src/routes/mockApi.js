import express from 'express';
import { HTTP_STATUS } from '../config/constants.js';

const router = express.Router();

/**
 * Mock API Routes for Bob's Pizza Shop
 *
 * These endpoints simulate a real client's backend API.
 * In production, these would be the actual client's systems.
 *
 * Base URL: /mock-api/bobs-pizza
 */

// Root route - list available mock APIs
router.get('/', (req, res) => {
  res.json({
    status: 'Mock API is running',
    available: ['bobs-pizza'],
    documentation: '/mock-api/bobs-pizza/health',
  });
});

// =====================================================
// INVENTORY API
// =====================================================

// Mock inventory database
const inventory = {
  'pepperoni-pizza': {
    id: 'PIZZA-001',
    name: 'Large Pepperoni Pizza',
    sku: 'PIZZA-001',
    inStock: true,
    quantity: 45,
    price: 18.99,
    currency: 'USD',
    category: 'Pizza',
  },
  'PIZZA-001': {
    id: 'PIZZA-001',
    name: 'Large Pepperoni Pizza',
    sku: 'PIZZA-001',
    inStock: true,
    quantity: 45,
    price: 18.99,
    currency: 'USD',
    category: 'Pizza',
  },
  'margherita-pizza': {
    id: 'PIZZA-002',
    name: 'Medium Margherita Pizza',
    sku: 'PIZZA-002',
    inStock: true,
    quantity: 32,
    price: 15.0,
    currency: 'USD',
    category: 'Pizza',
  },
  'margarita-pizza': {
    id: 'PIZZA-002',
    name: 'Medium Margherita Pizza',
    sku: 'PIZZA-002',
    inStock: true,
    quantity: 32,
    price: 15.0,
    currency: 'USD',
    category: 'Pizza',
  },
  'pizza-margarita': {
    id: 'PIZZA-002',
    name: 'Medium Margherita Pizza',
    sku: 'PIZZA-002',
    inStock: true,
    quantity: 32,
    price: 15.0,
    currency: 'USD',
    category: 'Pizza',
  },
  'PIZZA-002': {
    id: 'PIZZA-002',
    name: 'Medium Margherita Pizza',
    sku: 'PIZZA-002',
    inStock: true,
    quantity: 32,
    price: 15.0,
    currency: 'USD',
    category: 'Pizza',
  },
  pepperoni: {
    id: 'TOP-001',
    name: 'Pepperoni Topping',
    sku: 'TOP-001',
    inStock: true,
    quantity: 200,
    price: 2.99,
    currency: 'USD',
    category: 'Toppings',
  },
  'garlic-bread': {
    id: 'SIDE-001',
    name: 'Garlic Bread',
    sku: 'SIDE-001',
    inStock: true,
    quantity: 120,
    price: 4.99,
    currency: 'USD',
    category: 'Sides',
  },
  'SIDE-001': {
    id: 'SIDE-001',
    name: 'Garlic Bread',
    sku: 'SIDE-001',
    inStock: true,
    quantity: 120,
    price: 4.99,
    currency: 'USD',
    category: 'Sides',
  },
  'truffle-pizza': {
    id: 'PIZZA-SPECIAL-001',
    name: 'Truffle Mushroom Pizza',
    sku: 'PIZZA-SPECIAL-001',
    inStock: false,
    quantity: 0,
    price: 28.0,
    currency: 'USD',
    category: 'Specialty',
    nextAvailable: 'Tomorrow at 2pm',
  },
  'PIZZA-SPECIAL-001': {
    id: 'PIZZA-SPECIAL-001',
    name: 'Truffle Mushroom Pizza',
    sku: 'PIZZA-SPECIAL-001',
    inStock: false,
    quantity: 0,
    price: 28.0,
    currency: 'USD',
    category: 'Specialty',
    nextAvailable: 'Tomorrow at 2pm',
  },
  'hawaiian-pizza': {
    id: 'PIZZA-003',
    name: 'Hawaiian Pizza',
    sku: 'PIZZA-003',
    inStock: true,
    quantity: 18,
    price: 17.99,
    currency: 'USD',
    category: 'Pizza',
  },
  'cheese-sticks': {
    id: 'SIDE-002',
    name: 'Mozzarella Cheese Sticks',
    sku: 'SIDE-002',
    inStock: true,
    quantity: 85,
    price: 6.99,
    currency: 'USD',
    category: 'Sides',
  },
  cola: {
    id: 'DRINK-001',
    name: 'Cola (2L)',
    sku: 'DRINK-001',
    inStock: true,
    quantity: 200,
    price: 3.49,
    currency: 'USD',
    category: 'Drinks',
  },
};

/**
 * POST /mock-api/bobs-pizza/inventory/check
 * Check inventory for a product
 */
router.post('/bobs-pizza/inventory/check', (req, res) => {
  console.log("[Mock API] Bob's Pizza - Inventory Check:", req.body);

  const { productName, productSku, quantity = 1 } = req.body;

  if (!productName && !productSku) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Please provide either productName or productSku',
    });
  }

  // Normalize search term
  const searchTerm = (productSku || productName || '').toLowerCase().trim();
  const searchKey = searchTerm.replace(/\s+/g, '-');

  // Try exact key match first
  let product = inventory[searchKey];

  // If not found, try flexible word-based matching
  if (!product) {
    // Extract meaningful words (remove common stop words)
    const stopWords = ['pizza', 'large', 'medium', 'small', 'the', 'a', 'an', 'pizzas'];
    const searchWords = searchTerm
      .split(/[\s-]+/)
      .filter((word) => word.length > 2 && !stopWords.includes(word));

    // Score each product by how many search words match
    let bestMatch = null;
    let bestScore = 0;

    for (const key in inventory) {
      const item = inventory[key];
      const itemName = item.name.toLowerCase();
      const itemKey = key.toLowerCase();
      const itemSku = (item.sku || '').toLowerCase();

      let score = 0;

      // Check each search word
      for (const word of searchWords) {
        // Exact word match in name (higher score)
        if (itemName.includes(word) || itemKey.includes(word) || itemSku.includes(word)) {
          score += 2;
        }
        // Partial match (lower score)
        else if (word.length > 3) {
          if (itemName.includes(word.substring(0, 3)) || itemKey.includes(word.substring(0, 3))) {
            score += 1;
          }
        }
      }

      // Bonus for exact SKU match
      if (productSku && itemSku === productSku.toLowerCase()) {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    // Use best match if score is good enough (at least 1 word matched)
    if (bestMatch && bestScore > 0) {
      product = bestMatch;
    }
  }

  if (!product) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: `Product "${productName || productSku}" not found in our catalog`,
    });
  }

  // Build response
  const response = {
    success: true,
    data: {
      ...product,
      requestedQuantity: quantity,
      available: product.inStock && product.quantity >= quantity,
      availableQuantity: product.quantity,
    },
  };

  // Add appropriate message
  if (!product.inStock) {
    response.message = `${product.name} is currently out of stock.${product.nextAvailable ? ' Expected: ' + product.nextAvailable : ''}`;
  } else if (product.quantity < quantity) {
    response.message = `Only ${product.quantity} units of ${product.name} available (requested: ${quantity})`;
  } else {
    response.message = `${product.name} is in stock! ${product.quantity} units available at $${product.price.toFixed(2)} each.`;
  }

  res.json(response);
});

// =====================================================
// ORDER API
// =====================================================

// Mock orders database
const orders = {
  12345: {
    orderNumber: '12345',
    status: 'out_for_delivery',
    statusText: 'Out for Delivery',
    estimatedDelivery: '30 minutes',
    items: [
      { name: 'Large Pepperoni Pizza', quantity: 1, price: 18.99 },
      { name: 'Garlic Bread', quantity: 1, price: 4.99 },
    ],
    subtotal: 23.98,
    tax: 1.92,
    deliveryFee: 2.99,
    total: 28.89,
    driver: {
      name: 'Mike',
      phone: '555-0123',
      vehicle: 'Red Honda Civic',
    },
    deliveryAddress: '123 Main St, Apt 4B',
    placedAt: '2025-01-15T18:30:00Z',
  },
  12346: {
    orderNumber: '12346',
    status: 'preparing',
    statusText: 'Being Prepared',
    estimatedDelivery: '45 minutes',
    items: [{ name: 'Medium Margherita Pizza', quantity: 1, price: 15.0 }],
    subtotal: 15.0,
    tax: 1.2,
    deliveryFee: 2.99,
    total: 19.19,
    deliveryAddress: '456 Oak Ave',
    placedAt: '2025-01-15T19:00:00Z',
  },
  12347: {
    orderNumber: '12347',
    status: 'delivered',
    statusText: 'Delivered',
    deliveredAt: '2025-01-15T17:45:00Z',
    items: [{ name: 'Family Combo Deal', quantity: 1, price: 42.0 }],
    subtotal: 42.0,
    tax: 3.36,
    deliveryFee: 0,
    total: 45.36,
    deliveryAddress: '789 Pine St',
    placedAt: '2025-01-15T16:30:00Z',
    rating: 5,
    feedback: 'Delicious!',
  },
  12348: {
    orderNumber: '12348',
    status: 'confirmed',
    statusText: 'Order Confirmed',
    estimatedDelivery: '60 minutes',
    items: [
      { name: 'Large Pepperoni Pizza', quantity: 1, price: 18.99 },
      { name: 'Medium Margherita Pizza', quantity: 1, price: 15.0 },
      { name: 'Garlic Bread', quantity: 2, price: 9.98 },
    ],
    subtotal: 43.97,
    tax: 3.52,
    deliveryFee: 2.99,
    total: 50.48,
    deliveryAddress: '321 Elm St',
    placedAt: '2025-01-15T19:15:00Z',
  },
  12349: {
    orderNumber: '12349',
    status: 'cancelled',
    statusText: 'Cancelled',
    cancelledAt: '2025-01-15T18:00:00Z',
    cancelReason: 'Customer request',
    items: [{ name: 'Hawaiian Pizza', quantity: 1, price: 17.99 }],
    refundStatus: 'Refunded',
    refundAmount: 20.98,
  },
};

/**
 * GET /mock-api/bobs-pizza/orders/:orderNumber/status
 * Get order status
 */
router.get('/bobs-pizza/orders/:orderNumber/status', (req, res) => {
  console.log("[Mock API] Bob's Pizza - Order Status:", req.params.orderNumber);

  const { orderNumber } = req.params;
  const order = orders[orderNumber];

  if (!order) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: `Order #${orderNumber} not found. Please check the order number and try again.`,
    });
  }

  // Build status message
  let message = `Order #${order.orderNumber} is currently ${order.statusText}.`;

  if (order.estimatedDelivery) {
    message += ` Estimated delivery: ${order.estimatedDelivery}.`;
  }
  if (order.deliveredAt) {
    const deliveredTime = new Date(order.deliveredAt);
    message += ` Delivered at ${deliveredTime.toLocaleTimeString()}.`;
  }
  if (order.driver) {
    message += ` Your driver ${order.driver.name} is on the way.`;
  }
  if (order.status === 'cancelled') {
    message += ` Reason: ${order.cancelReason}. ${order.refundStatus}.`;
  }

  res.json({
    success: true,
    message,
    data: order,
  });
});

// =====================================================
// BOOKING API
// =====================================================

// Mock reservations (for availability checking)
const bookedSlots = [
  { date: '2025-01-15', time: '19:00' },
  { date: '2025-01-15', time: '19:30' },
  { date: '2025-01-15', time: '20:00' },
  { date: '2025-12-31', time: '19:00' },
  { date: '2025-12-31', time: '19:30' },
  { date: '2025-12-31', time: '20:00' },
  { date: '2025-12-31', time: '20:30' },
];

// Store reservations in memory
const reservations = {};

/**
 * POST /mock-api/bobs-pizza/bookings
 * Create a new reservation
 */
router.post('/bobs-pizza/bookings', (req, res) => {
  console.log("[Mock API] Bob's Pizza - New Booking:", req.body);

  const {
    date,
    time,
    serviceType = 'Table Reservation',
    customerName = 'Guest',
    customerEmail,
    customerPhone,
    partySize = 2,
    notes,
  } = req.body;

  // Validation
  if (!date || !time) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Date and time are required for booking',
    });
  }

  // Normalize date: handle relative dates like "today", "tomorrow", etc.
  const normalizedDate = date.toLowerCase().trim();
  let actualDate;

  if (normalizedDate === 'today') {
    actualDate = new Date();
  } else if (normalizedDate === 'tomorrow') {
    actualDate = new Date();
    actualDate.setDate(actualDate.getDate() + 1);
  } else if (normalizedDate === 'yesterday') {
    actualDate = new Date();
    actualDate.setDate(actualDate.getDate() - 1);
  } else {
    // Try to parse as ISO date or other formats
    actualDate = new Date(date);
    // If invalid, try adding time component
    if (isNaN(actualDate.getTime())) {
      actualDate = new Date(date + 'T12:00:00');
    }
    // If still invalid, default to today
    if (isNaN(actualDate.getTime())) {
      actualDate = new Date();
    }
  }

  // Format as YYYY-MM-DD for storage and comparison
  const dateStr = actualDate.toISOString().split('T')[0];

  // Format date nicely for display
  let formattedDate;
  try {
    formattedDate = actualDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    formattedDate = dateStr;
  }

  // Check availability
  const isBooked = bookedSlots.some((slot) => slot.date === dateStr && slot.time === time);

  if (isBooked) {
    // Find available alternatives
    const availableTimes = ['17:00', '17:30', '18:00', '18:30', '21:00', '21:30'].filter(
      (t) => !bookedSlots.some((slot) => slot.date === dateStr && slot.time === t)
    );

    return res.status(HTTP_STATUS.CONFLICT).json({
      success: false,
      error: `Sorry, ${time} on ${formattedDate} is fully booked.`,
      availableTimes,
      message: `Alternative times available: ${availableTimes.join(', ')}`,
    });
  }

  // Create reservation
  const reservationId = 'RES-' + Math.random().toString(36).substr(2, 9).toUpperCase();

  const reservation = {
    reservationId,
    date: dateStr, // Use normalized date
    formattedDate,
    time,
    serviceType,
    customerName,
    customerEmail,
    customerPhone,
    partySize,
    notes,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    tableNumber: Math.floor(Math.random() * 20) + 1,
  };

  // Store it
  reservations[reservationId] = reservation;

  // Add to booked slots
  bookedSlots.push({ date: dateStr, time });

  // Build confirmation message
  let message = `Reservation confirmed! Your table for ${partySize} is booked for ${formattedDate} at ${time}.`;
  message += ` Confirmation: ${reservationId}.`;
  if (customerEmail) {
    message += ` Confirmation sent to ${customerEmail}.`;
  }

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message,
    data: reservation,
  });
});

/**
 * GET /mock-api/bobs-pizza/bookings/:reservationId
 * Get reservation details
 */
router.get('/bobs-pizza/bookings/:reservationId', (req, res) => {
  const { reservationId } = req.params;
  const reservation = reservations[reservationId];

  if (!reservation) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: `Reservation ${reservationId} not found`,
    });
  }

  res.json({
    success: true,
    data: reservation,
  });
});

/**
 * GET /mock-api/bobs-pizza/availability
 * Check available time slots for a date
 */
router.get('/bobs-pizza/availability', (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Date parameter is required',
    });
  }

  const allTimes = [
    '17:00',
    '17:30',
    '18:00',
    '18:30',
    '19:00',
    '19:30',
    '20:00',
    '20:30',
    '21:00',
    '21:30',
  ];
  const bookedTimes = bookedSlots.filter((slot) => slot.date === date).map((slot) => slot.time);

  const available = allTimes.filter((t) => !bookedTimes.includes(t));

  res.json({
    success: true,
    date,
    availableTimes: available,
    bookedTimes,
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

router.get('/bobs-pizza/health', (req, res) => {
  res.json({
    status: 'ok',
    service: "Bob's Pizza API",
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /inventory/check',
      'GET /orders/:orderNumber/status',
      'POST /bookings',
      'GET /bookings/:reservationId',
      'GET /availability?date=YYYY-MM-DD',
    ],
  });
});

export default router;
