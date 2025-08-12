import PDFDocument from 'pdfkit';

export const generateCustomerOrderInvoice = async (orderData) => {
  const {
    order,
    orderItems,
    shippingDetails,
    paymentDetails,
    itemDetails,
    customerDetails,
    sellerEmail,
  } = orderData;

  const doc = new PDFDocument({ margin: 50 });
  const buffers = [];

  doc.on('data', (chunk) => buffers.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Order Invoice', { align: 'center' });
    doc.moveDown(1);

    // Seller and Customer Info
    doc.fontSize(12).font('Helvetica');
    doc.text(`Seller Email: ${sellerEmail}`, { align: 'left' });
    doc.text(`Customer Name: ${customerDetails.full_name}`);
    doc.text(`Customer Email: ${customerDetails.email}`);
    doc.moveDown();

    // Order Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Order Summary');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(12);
    doc.text(`Order ID: ${order.id}`);
    doc.text(`Order Status: ${order.status}`);
    doc.text(`Order Date: ${new Date(order.created_at).toLocaleString()}`);
    doc.text(`Points Earned: ${order.points_earned}`);
    if (order.points_used > 0) {
      doc.text(`Points Used: ${order.points_used}`);
    }
    doc.moveDown();

    // Item Table
    doc.fontSize(14).font('Helvetica-Bold').text('Items Ordered');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(12);

    const item = orderItems[0]; // assuming one item per order
    doc.text(`• ${itemDetails.name}`, { continued: true }).text(` (${itemDetails.breed})`);
    doc.text(`  Description: ${itemDetails.description}`);
    doc.text(`  Quantity: ${item.quantity}`);
    doc.text(`  Unit Price: ₹${item.unit_price}`);
    doc.text(`  Total: ₹${item.total_price}`);
    doc.moveDown();

    // Shipping Info
    doc.fontSize(14).font('Helvetica-Bold').text('Shipping Information');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(12);
    doc.text(`Shipping Method: ${shippingDetails.shipping_method}`);
    doc.text(`Shipping Cost: ₹${shippingDetails.shipping_cost}`);
    if (shippingDetails.carrier) {
      doc.text(`Carrier: ${shippingDetails.carrier}`);
    }
    if (shippingDetails.tracking_number) {
      doc.text(`Tracking Number: ${shippingDetails.tracking_number}`);
    }
    doc.moveDown();

    // Payment Info
    doc.fontSize(14).font('Helvetica-Bold').text('Payment Details');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(12);
    doc.text(`Payment Method: ${paymentDetails.payment_method}`);
    doc.text(`Transaction ID: ${paymentDetails.transaction_id}`);
    doc.text(`Payment Status: ${paymentDetails.status}`);
    doc.text(`Amount Paid: ₹${paymentDetails.payment_metadata.amount_paid}`);
    doc.moveDown();

    // Totals
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text(`Grand Total: ₹${order.total_amount}`, {
      align: 'right',
    });

    // Footer
    doc.moveDown(2);
    doc
      .fontSize(10)
      .font('Helvetica-Oblique')
      .text('Thank you for shopping with Fincarts!', { align: 'center' });

    doc.end();
  });
};
