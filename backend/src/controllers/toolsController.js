/**
 * Tools Controller
 *
 * Mock endpoints for direct tool testing without n8n.
 * These routes are for development/testing purposes only.
 * In production, tool execution goes through n8n webhooks via toolExecutionService.
 */

export const getOrderStatus = async (req, res) => {
    const { order_id } = req.body;
    // Mock response for testing
    res.json({
        order_id,
        status: 'pending',
        _mock: true,
        _note: 'This is a mock endpoint. Use n8n webhooks for real tool execution.'
    });
};

export const bookAppointment = async (req, res) => {
    const { name, date } = req.body;
    // Mock response for testing
    res.json({
        success: true,
        appointment: { name, date },
        _mock: true,
        _note: 'This is a mock endpoint. Use n8n webhooks for real tool execution.'
    });
};
