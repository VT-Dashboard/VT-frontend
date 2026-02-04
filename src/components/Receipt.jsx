import React from 'react';

const styles = {
  container: {
    width: '72mm',
    margin: '0 auto',
    padding: '8px 8px 4px',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '11px',
    lineHeight: 1.3,
    color: '#000',
  },
  header: {
    textAlign: 'center',
    marginBottom: '6px',
  },
  storeName: {
    fontWeight: 800,
    fontSize: '15px',
    letterSpacing: '0.3px',
  },
  storeMeta: {
    marginTop: '2px',
    fontSize: '10px',
    color: '#222',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  divider: {
    borderTop: '1px dashed #444',
    margin: '6px 0',
  },
  items: {
    marginTop: '4px',
  },
  itemHeader: {
    display: 'flex',
    gap: '8px',
    fontWeight: 700,
    marginBottom: '6px',
    fontSize: '10px',
  },
  item: {
    display: 'flex',
    gap: '8px',
    marginBottom: '4px',
    fontSize: '10.5px',
  },
  itemName: {
    flex: '1 1 auto',
    minWidth: 0,
    wordBreak: 'break-word',
  },
  itemUnit: {
    width: '48px',
    textAlign: 'right',
  },
  itemQty: {
    width: '30px',
    textAlign: 'right',
  },
  itemPrice: {
    width: '60px',
    textAlign: 'right',
  },
  totals: {
    marginTop: '6px',
    fontSize: '11px',
  },
  totalLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '3px',
  },
  grandTotal: {
    fontWeight: 800,
    marginTop: '6px',
    fontSize: '13px',
  },
  metaSmall: {
    fontSize: '10px',
    color: '#333',
  },
  footer: {
    textAlign: 'center',
    marginTop: '8px',
    marginBottom: '0',
    fontSize: '10px',
    color: '#333',
  },
};

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function formatCurrency(v) {
  const n = Number(v || 0);
  if (Number.isNaN(n)) return 'Rs 0.00';
  return `Rs ${n.toFixed(2)}`;
}

const Receipt = ({
  items,
  subtotal,
  tax = 0,
  discount = 0,
  total,
  paidAt,
  orderNumber = '',
  paymentMethod = '',
  cashier = '',
  storeName = 'VIJAYA TEX',
  storeAddress = 'NO 19, In front of roundabout, Middle Street, Tissamaharama',
  storePhone = '0777044048 / 0761694048',
  footerMessage = 'Thank you for your purchase!',
}) => (
  <div style={styles.container}>
    <div style={styles.header}>
      <div style={styles.storeName}>{storeName}</div>
      {(storeAddress || storePhone) ? (
        <div style={styles.storeMeta}>
          {storeAddress ? <div>{storeAddress}</div> : null}
          {storePhone ? <div>Tel: {storePhone}</div> : null}
        </div>
      ) : null}
      <div style={{ ...styles.row, marginTop: 6 }}>
        <div style={styles.metaSmall}>{paidAt ? formatDate(paidAt) : ''}</div>
        <div style={styles.metaSmall}>{orderNumber ? `Order: ${orderNumber}` : ''}</div>
      </div>
    </div>

    <div style={styles.divider} />

    <div style={styles.items}>
      <div style={styles.itemHeader}>
        <div style={styles.itemName}>Item</div>
        <div style={styles.itemUnit}>Unit</div>
        <div style={styles.itemQty}>Qty</div>
        <div style={styles.itemPrice}>Amount</div>
      </div>
      {(items || []).map((item, idx) => {
        const name = item.name || 'Item';
        const qty = Number(item.qty || item.quantity || 1);
        const unit = Number(item.price || item.unitPrice || 0);
        const amount = qty * unit;
        return (
          <div key={`${name}-${idx}`} style={styles.item}>
            <div style={styles.itemName}>{name}</div>
            <div style={styles.itemUnit}>{formatCurrency(unit)}</div>
            <div style={styles.itemQty}>{qty}</div>
            <div style={styles.itemPrice}>{formatCurrency(amount)}</div>
          </div>
        );
      })}
    </div>

    <div style={styles.divider} />

    <div style={styles.totals}>
      <div style={styles.totalLine}>
        <div style={styles.metaSmall}>Subtotal</div>
        <div style={styles.metaSmall}>{formatCurrency(subtotal)}</div>
      </div>
      {tax ? (
        <div style={styles.totalLine}>
          <div style={styles.metaSmall}>Tax</div>
          <div style={styles.metaSmall}>{formatCurrency(tax)}</div>
        </div>
      ) : null}
      {discount ? (
        <div style={styles.totalLine}>
          <div style={styles.metaSmall}>Discount</div>
          <div style={styles.metaSmall}>-{formatCurrency(Math.abs(discount))}</div>
        </div>
      ) : null}
      <div style={{ ...styles.totalLine, ...styles.grandTotal }}>
        <div>Total</div>
        <div>{formatCurrency(total)}</div>
      </div>

      {(paymentMethod || cashier) ? (
        <div style={{ marginTop: 6 }}>
          {paymentMethod ? <div style={styles.totalLine}><div style={styles.metaSmall}>Paid By</div><div style={styles.metaSmall}>{paymentMethod}</div></div> : null}
          {cashier ? <div style={styles.totalLine}><div style={styles.metaSmall}>Cashier</div><div style={styles.metaSmall}>{cashier}</div></div> : null}
        </div>
      ) : null}
    </div>

    <div style={styles.divider} />
    <div style={styles.footer}>
      <div>{footerMessage}</div>
      <div style={{ fontSize: '9px', marginTop: 6, color: '#666' }}>No returns after 3 days.</div>
    </div>
  </div>
);

export default Receipt;
