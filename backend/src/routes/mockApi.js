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
    return res.json({
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
    return res.json({
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
    return res.json({
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
    return res.json({
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
    // If still invalid, return error
    if (isNaN(actualDate.getTime())) {
      return res.json({
        success: false,
        error: `Invalid date format: "${date}". Please use YYYY-MM-DD format or words like "today", "tomorrow".`,
      });
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

    return res.json({
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
    return res.json({
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
    return res.json({
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
// MENU API
// =====================================================

// Full menu database
const menu = {
  pizzas: [
    {
      id: 'PIZZA-001',
      name: 'Large Pepperoni Pizza',
      description: 'Classic pepperoni with our signature tomato sauce and mozzarella',
      price: 18.99,
      category: 'pizzas',
      popular: true,
    },
    {
      id: 'PIZZA-002',
      name: 'Margherita Pizza',
      description: 'Fresh mozzarella, basil, and our homemade tomato sauce',
      price: 15.0,
      category: 'pizzas',
      popular: true,
    },
    {
      id: 'PIZZA-003',
      name: 'Hawaiian Pizza',
      description: 'Ham, pineapple, and mozzarella on our classic crust',
      price: 17.99,
      category: 'pizzas',
      popular: false,
    },
    {
      id: 'PIZZA-004',
      name: 'Veggie Supreme',
      description: 'Bell peppers, mushrooms, onions, olives, and tomatoes',
      price: 16.99,
      category: 'pizzas',
      popular: false,
    },
    {
      id: 'PIZZA-005',
      name: 'Meat Lovers',
      description: 'Pepperoni, sausage, bacon, and ham',
      price: 21.99,
      category: 'pizzas',
      popular: true,
    },
    {
      id: 'PIZZA-SPECIAL-001',
      name: 'Truffle Mushroom Pizza',
      description: 'Wild mushrooms, truffle oil, and parmesan',
      price: 28.0,
      category: 'pizzas',
      popular: false,
      limited: true,
    },
  ],
  sides: [
    {
      id: 'SIDE-001',
      name: 'Garlic Bread',
      description: 'Freshly baked with garlic butter and herbs',
      price: 4.99,
      category: 'sides',
    },
    {
      id: 'SIDE-002',
      name: 'Mozzarella Sticks',
      description: 'Golden fried mozzarella with marinara sauce',
      price: 6.99,
      category: 'sides',
    },
    {
      id: 'SIDE-003',
      name: 'Caesar Salad',
      description: 'Romaine lettuce, parmesan, croutons, and Caesar dressing',
      price: 7.99,
      category: 'sides',
    },
    {
      id: 'SIDE-004',
      name: 'Buffalo Wings (8pc)',
      description: 'Crispy wings with your choice of sauce',
      price: 9.99,
      category: 'sides',
    },
  ],
  drinks: [
    {
      id: 'DRINK-001',
      name: 'Cola (2L)',
      description: 'Ice-cold refreshment',
      price: 3.49,
      category: 'drinks',
    },
    {
      id: 'DRINK-002',
      name: 'Lemonade (2L)',
      description: 'Fresh-squeezed lemonade',
      price: 4.49,
      category: 'drinks',
    },
    {
      id: 'DRINK-003',
      name: 'Sparkling Water',
      description: 'Italian sparkling water',
      price: 2.99,
      category: 'drinks',
    },
  ],
  specials: [
    {
      id: 'COMBO-001',
      name: 'Family Combo',
      description: '2 Large Pizzas + Garlic Bread + 2L Drink',
      price: 42.0,
      originalPrice: 52.46,
      category: 'specials',
      savings: 10.46,
    },
    {
      id: 'COMBO-002',
      name: 'Date Night Deal',
      description: 'Medium Pizza + Caesar Salad + 2 Drinks',
      price: 24.99,
      originalPrice: 31.96,
      category: 'specials',
      savings: 6.97,
    },
  ],
};

/**
 * GET /mock-api/bobs-pizza/menu
 * Get full menu or filter by category
 */
router.get('/bobs-pizza/menu', (req, res) => {
  console.log("[Mock API] Bob's Pizza - Menu Request:", req.query);

  const { category } = req.query;

  if (category && category !== 'all') {
    const categoryMenu = menu[category];
    if (!categoryMenu) {
      return res.json({
        success: false,
        error: `Category "${category}" not found. Available categories: pizzas, sides, drinks, specials`,
      });
    }
    return res.json({
      success: true,
      category,
      items: categoryMenu,
      message: `Found ${categoryMenu.length} items in ${category}`,
    });
  }

  // Return all categories
  const allItems = [...menu.pizzas, ...menu.sides, ...menu.drinks, ...menu.specials];
  res.json({
    success: true,
    categories: Object.keys(menu),
    menu,
    totalItems: allItems.length,
    message: `Full menu with ${allItems.length} items across ${Object.keys(menu).length} categories`,
  });
});

// =====================================================
// SPECIALS API
// =====================================================

// Daily specials database
const dailySpecials = {
  monday: {
    name: 'Meatless Monday',
    description: '20% off all vegetarian pizzas',
    discount: '20%',
    validItems: ['Margherita Pizza', 'Veggie Supreme'],
  },
  tuesday: {
    name: 'Two-for-Tuesday',
    description: 'Buy any large pizza, get a medium FREE',
    discount: 'Buy 1 Get 1',
    validItems: ['All large pizzas'],
    popular: true,
  },
  wednesday: {
    name: 'Wing Wednesday',
    description: 'Half price wings with any pizza order',
    discount: '50% off wings',
    validItems: ['Buffalo Wings'],
  },
  thursday: {
    name: 'Thirsty Thursday',
    description: 'Free 2L drink with any order over $20',
    discount: 'Free drink',
    minOrder: 20,
  },
  friday: {
    name: 'Family Friday',
    description: '$5 off any combo deal',
    discount: '$5 off',
    validItems: ['Family Combo', 'Date Night Deal'],
  },
  saturday: {
    name: 'Super Saturday',
    description: '15% off orders over $40',
    discount: '15%',
    minOrder: 40,
  },
  sunday: {
    name: 'Sunday Funday',
    description: 'Kids eat free with adult meal purchase',
    discount: 'Free kids meal',
    validItems: ['Kids meals'],
  },
};

/**
 * GET /mock-api/bobs-pizza/specials
 * Get current daily deals and promotions
 */
router.get('/bobs-pizza/specials', (req, res) => {
  console.log("[Mock API] Bob's Pizza - Specials Request");

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  const todaySpecial = dailySpecials[today];

  // Get permanent combo deals from menu
  const comboDeals = menu.specials;

  res.json({
    success: true,
    todaySpecial: {
      day: today.charAt(0).toUpperCase() + today.slice(1),
      ...todaySpecial,
    },
    weeklySpecials: dailySpecials,
    comboDeals,
    message: `Today's special: ${todaySpecial.name} - ${todaySpecial.description}`,
  });
});

// =====================================================
// DELIVERY AREA API
// =====================================================

// Delivery zones database
const deliveryZones = {
  downtown: {
    name: 'Downtown',
    fee: 0,
    freeDeliveryMin: 25,
    estimatedTime: '20-30 min',
    available: true,
  },
  midtown: {
    name: 'Midtown',
    fee: 2.99,
    freeDeliveryMin: 35,
    estimatedTime: '25-35 min',
    available: true,
  },
  uptown: {
    name: 'Uptown',
    fee: 3.99,
    freeDeliveryMin: 40,
    estimatedTime: '30-40 min',
    available: true,
  },
  suburbs: {
    name: 'Suburbs',
    fee: 4.99,
    freeDeliveryMin: 50,
    estimatedTime: '40-50 min',
    available: true,
  },
  outside: {
    name: 'Outside Delivery Area',
    available: false,
    message: 'Sorry, this address is outside our 5-mile delivery radius. Pickup is available!',
  },
};

/**
 * GET /mock-api/bobs-pizza/delivery-areas
 * Check delivery availability for an address
 */
router.get('/bobs-pizza/delivery-areas', (req, res) => {
  console.log("[Mock API] Bob's Pizza - Delivery Area Check:", req.query);

  const { address } = req.query;

  if (!address) {
    // Return all delivery zones
    return res.json({
      success: true,
      zones: deliveryZones,
      radius: '5 miles',
      message: 'Delivery available within 5 miles of downtown. Free delivery on orders over $25 in downtown area.',
    });
  }

  // Simulate address lookup based on keywords
  const addressLower = address.toLowerCase();
  let zone;

  if (addressLower.includes('main st') || addressLower.includes('downtown') || addressLower.includes('center')) {
    zone = deliveryZones.downtown;
  } else if (addressLower.includes('oak') || addressLower.includes('elm') || addressLower.includes('midtown')) {
    zone = deliveryZones.midtown;
  } else if (addressLower.includes('park') || addressLower.includes('hill') || addressLower.includes('uptown')) {
    zone = deliveryZones.uptown;
  } else if (addressLower.includes('lake') || addressLower.includes('forest') || addressLower.includes('suburb')) {
    zone = deliveryZones.suburbs;
  } else if (addressLower.includes('outside') || addressLower.includes('far') || addressLower.includes('rural')) {
    zone = deliveryZones.outside;
  } else {
    // Return error for unrecognized addresses
    return res.json({
      success: false,
      error: `Unable to determine delivery zone for address: "${address}". Please provide a more specific address including street name.`,
      hint: 'Try including neighborhood keywords like: downtown, main st, oak, elm, park, hill, lake, forest',
      availableZones: Object.keys(deliveryZones).filter(z => z !== 'outside'),
    });
  }

  if (!zone.available) {
    return res.json({
      success: false,
      error: zone.message,
      address,
      deliveryAvailable: false,
      pickupAvailable: true,
      pickupAddress: '123 Main Street, Downtown',
    });
  }

  res.json({
    success: true,
    address,
    deliveryAvailable: true,
    zone: zone.name,
    deliveryFee: zone.fee,
    freeDeliveryMinimum: zone.freeDeliveryMin,
    estimatedTime: zone.estimatedTime,
    message: zone.fee === 0
      ? `Great news! You're in our ${zone.name} zone. Free delivery on orders over $${zone.freeDeliveryMin}!`
      : `Delivery to ${zone.name}: $${zone.fee} fee (free on orders over $${zone.freeDeliveryMin}). Estimated: ${zone.estimatedTime}`,
  });
});

// =====================================================
// PLACE ORDER API
// =====================================================

// Order counter for generating order numbers
let orderCounter = 12350;

/**
 * POST /mock-api/bobs-pizza/orders
 * Place a new order for delivery or pickup
 */
router.post('/bobs-pizza/orders', (req, res) => {
  console.log("[Mock API] Bob's Pizza - Place Order:", req.body);

  const { items, customerPhone, deliveryAddress, orderType = 'delivery', notes } = req.body;

  // Validation
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.json({
      success: false,
      error: 'At least one item is required to place an order',
    });
  }

  if (!customerPhone) {
    return res.json({
      success: false,
      error: 'Customer phone number is required for order confirmation',
    });
  }

  if (orderType === 'delivery' && !deliveryAddress) {
    return res.json({
      success: false,
      error: 'Delivery address is required for delivery orders',
    });
  }

  // Calculate order total (simplified - lookup items from menu)
  const allMenuItems = [...menu.pizzas, ...menu.sides, ...menu.drinks, ...menu.specials];
  let subtotal = 0;
  const orderItems = [];

  for (const item of items) {
    const menuItem = allMenuItems.find(
      (m) => m.name.toLowerCase().includes(item.name.toLowerCase()) || m.id === item.name
    );

    if (menuItem) {
      const quantity = item.quantity || 1;
      const itemTotal = menuItem.price * quantity;
      subtotal += itemTotal;
      orderItems.push({
        name: menuItem.name,
        quantity,
        unitPrice: menuItem.price,
        total: itemTotal,
      });
    } else {
      // Return error for unknown menu items
      return res.json({
        success: false,
        error: `Item "${item.name}" not found on our menu.`,
        hint: 'Please check our menu for available items. Use GET /menu to see all options.',
        availableCategories: ['pizzas', 'sides', 'drinks', 'specials'],
      });
    }
  }

  // Calculate fees and tax
  const tax = Math.round(subtotal * 0.08 * 100) / 100; // 8% tax
  const deliveryFee = orderType === 'delivery' ? (subtotal >= 25 ? 0 : 2.99) : 0;
  const total = Math.round((subtotal + tax + deliveryFee) * 100) / 100;

  // Generate order
  const orderNumber = String(++orderCounter);
  const estimatedTime = orderType === 'delivery' ? '30-45 minutes' : '15-20 minutes';

  const order = {
    orderNumber,
    status: 'confirmed',
    statusText: 'Order Confirmed',
    orderType,
    items: orderItems,
    subtotal,
    tax,
    deliveryFee,
    total,
    customerPhone,
    deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
    notes,
    estimatedTime,
    placedAt: new Date().toISOString(),
  };

  // Store order for later status checks
  orders[orderNumber] = order;

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: `Order #${orderNumber} confirmed! ${orderType === 'delivery' ? `Delivery to ${deliveryAddress}` : 'Pickup'} in ${estimatedTime}. Total: $${total.toFixed(2)}`,
    data: order,
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
      'GET /menu',
      'GET /specials',
      'GET /delivery-areas',
      'POST /orders',
      'POST /inventory/check',
      'GET /orders/:orderNumber/status',
      'POST /bookings',
      'GET /bookings/:reservationId',
      'GET /availability?date=YYYY-MM-DD',
    ],
  });
});

export default router;
