import PDFDocument from 'pdfkit';

export const generateSellerOrderInvoice = async (orderData) => {
  const { order, orderItems, shippingDetails, paymentDetails } = orderData;

  const doc = new PDFDocument();
  const buffers = [];

  doc.on('data', (chunk) => buffers.push(chunk));
  
  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    doc.on('error', reject);

    doc.fontSize(20).text('Order Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Order ID: ${order.id}`);
    doc.text(`Status: ${order.status}`);
    doc.text(`Created At: ${new Date(order.created_at).toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(16).text('Items:');
    orderItems.forEach((item, index) => {
      doc.fontSize(12).text(`${index + 1}. Qty: ${item.quantity}, Price: ₹${item.total_price}`);
    });
    doc.moveDown();

    doc.fontSize(16).text('Shipping:');
    doc.fontSize(12).text(`Method: ${shippingDetails.shipping_method}`);
    doc.text(`Cost: ₹${shippingDetails.shipping_cost}`);
    doc.moveDown();

    doc.fontSize(16).text('Payment:');
    doc.fontSize(12).text(`Method: ${paymentDetails.payment_method}`);
    doc.text(`Txn ID: ${paymentDetails.transaction_id}`);
    doc.text(`Status: ${paymentDetails.status}`);
    doc.text(`Paid: ₹${paymentDetails.payment_metadata.amount_paid}`);
    doc.moveDown();

    doc.fontSize(16).text(`Total: ₹${order.total_amount}`, { align: 'right' });

    doc.end();
  });
};
