export const getOrderStatus = async (req, res) => {
    const { order_id } = req.body;
    // TODO: Connect to n8n workflow or client API
    res.json({ order_id, status: 'pending' });
  };
  
  export const bookAppointment = async (req, res) => {
    const { name, date } = req.body;
    // TODO: Connect to n8n workflow
    res.json({ success: true, appointment: { name, date } });
  };
  