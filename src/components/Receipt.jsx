import React from 'react';

const styles = {
  container: {
    width: '72mm',
    margin: '0 auto',
    padding: '8px 8px 2px',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '12px',
    lineHeight: 1.35,
    color: '#000',
  },
  header: {
    textAlign: 'center',
    marginBottom: '6px',
  },
  storeName: {
    fontWeight: 700,
    fontSize: '14px',
    letterSpacing: '0.2px',
  },
  storeMeta: {
    marginTop: '2px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  divider: {
    borderTop: '1px solid #000',
    margin: '6px 0',
  },
  items: {
    marginTop: '4px',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    fontWeight: 700,
    marginBottom: '4px',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '2px',
  },
  itemName: {
    flex: '1 1 auto',
    minWidth: 0,
    wordBreak: 'break-word',
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
    marginTop: '4px',
  },
  totalLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '2px',
  },
  grandTotal: {
    fontWeight: 700,
    marginTop: '4px',
  },
  footer: {
    textAlign: 'center',
    marginTop: '6px',
    marginBottom: '0',
  },
};

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

const Receipt = ({
  items,
  subtotal,
  tax = 0,
  discount = 0,
  total,
  paidAt,
  storeName = 'VT Store',
  storeAddress = 'NO 19, In front of roundabout, Middle Street, Tissamaharama',
  storePhone = '0777044048',
  footerMessage = 'Thank you for your purchase!',
}) => (
  <div style={styles.container}>
    <div style={styles.header}>
      <div style={styles.storeName}>{storeName}</div>
      {(storeAddress || storePhone) ? (
        <div style={styles.storeMeta}>
          {storeAddress ? <div>Address: {storeAddress}</div> : null}
          {storePhone ? <div>Phone: {storePhone}</div> : null}
        </div>
      ) : null}
      <div style={styles.row}>
        <div>{paidAt ? formatDate(paidAt) : ''}</div>
        <div />
      </div>
    </div>
    <div style={styles.divider} />
    <div style={styles.items}>
      <div style={styles.itemHeader}>
        <div style={styles.itemName}>Item</div>
        <div style={styles.itemQty}>Qty</div>
        <div style={styles.itemPrice}>Amount</div>
      </div>
      {(items || []).map((item, idx) => (
        <div key={`${item.name || 'item'}-${idx}`} style={styles.item}>
          <div style={styles.itemName}>{item.name || 'Item'}</div>
          <div style={styles.itemQty}>{item.qty}</div>
          <div style={styles.itemPrice}>Rs {(item.price * item.qty).toFixed(2)}</div>
        </div>
      ))}
    </div>
    <div style={styles.divider} />
    <div style={styles.totals}>
      <div style={styles.totalLine}>
        <div>Subtotal</div>
        <div>Rs {subtotal.toFixed(2)}</div>
      </div>
      {tax ? (
        <div style={styles.totalLine}>
          <div>Tax</div>
          <div>Rs {tax.toFixed(2)}</div>
        </div>
      ) : null}
      {discount ? (
        <div style={styles.totalLine}>
          <div>Discount</div>
          <div>-Rs {Math.abs(discount).toFixed(2)}</div>
        </div>
      ) : null}
      <div style={{ ...styles.totalLine, ...styles.grandTotal }}>
        <div>Total</div>
        <div>Rs {total.toFixed(2)}</div>
      </div>
    </div>
    <div style={styles.divider} />
    <div style={styles.footer}>{footerMessage}</div>
  </div>
);

export default Receipt;
