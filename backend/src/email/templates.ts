/**
 * Transactional email templates.
 *
 * Written with table-based layout and inline styles because that is what email
 * clients actually render. Colours mirror the storefront design tokens:
 * cream #faf7f1, espresso #2a1a10, gold #a8912f, hairline #e9e0d3.
 */

export interface OrderEmailLine {
  name: string;
  quantity: number;
  unitPriceLabel: string;
  lineTotalLabel: string;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryNotes: string | null;
  subtotalLabel: string;
  deliveryFeeLabel: string;
  totalLabel: string;
  items: OrderEmailLine[];
  placedAtLabel: string;
  supportEmail: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** User-supplied values must never be interpolated raw into HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BRAND = {
  page: '#faf7f1',
  surface: '#ffffff',
  ink: '#2a1a10',
  inkSoft: '#6b5a4e',
  accent: '#a8912f',
  border: '#e9e0d3',
  serif: "'Playfair Display', Georgia, 'Times New Roman', serif",
  sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
} as const;

function itemRows(items: OrderEmailLine[]): string {
  return items
    .map(
      (item) => `
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid ${BRAND.border};font-family:${BRAND.sans};font-size:15px;color:${BRAND.ink};">
                  ${escapeHtml(item.name)}
                  <div style="font-size:13px;color:${BRAND.inkSoft};margin-top:4px;">
                    ${item.quantity} &times; ${escapeHtml(item.unitPriceLabel)}
                  </div>
                </td>
                <td align="right" style="padding:14px 0;border-bottom:1px solid ${BRAND.border};font-family:${BRAND.sans};font-size:15px;color:${BRAND.ink};white-space:nowrap;">
                  ${escapeHtml(item.lineTotalLabel)}
                </td>
              </tr>`,
    )
    .join('');
}

function totalRow(label: string, value: string, emphasis = false): string {
  const size = emphasis ? '17px' : '14px';
  const colour = emphasis ? BRAND.ink : BRAND.inkSoft;
  const weight = emphasis ? 'font-weight:700;' : '';
  return `
              <tr>
                <td style="padding:6px 0;font-family:${BRAND.sans};font-size:${size};color:${colour};${weight}">
                  ${escapeHtml(label)}
                </td>
                <td align="right" style="padding:6px 0;font-family:${BRAND.sans};font-size:${size};color:${colour};${weight}white-space:nowrap;">
                  ${escapeHtml(value)}
                </td>
              </tr>`;
}

export function renderOrderConfirmation(order: OrderEmailData): RenderedEmail {
  const subject = `Order ${order.orderNumber} confirmed — Yuhmyuhm Catering Services`;
  const firstName = order.customerName.split(' ')[0] || order.customerName;

  // Built as an array of sections: keeps each piece readable and diff-friendly.
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(subject)}</title>`,
    '</head>',
    `<body style="margin:0;padding:0;background:${BRAND.page};">`,
    `  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};padding:32px 16px;">`,
    '    <tr><td align="center">',
    `      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:8px;">`,

    // Masthead
    '        <tr>',
    `          <td style="padding:28px 32px 18px;border-bottom:1px solid ${BRAND.border};">`,
    `            <div style="font-family:${BRAND.serif};font-size:24px;letter-spacing:2px;color:${BRAND.ink};text-transform:uppercase;">Yuhmyuhm</div>`,
    `            <div style="font-family:${BRAND.sans};font-size:10px;letter-spacing:4px;color:${BRAND.accent};text-transform:uppercase;margin-top:6px;">Catering Services</div>`,
    '          </td>',
    '        </tr>',

    // Body
    '        <tr>',
    '          <td style="padding:32px;">',
    `            <h1 style="margin:0 0 10px;font-family:${BRAND.serif};font-size:26px;line-height:1.25;color:${BRAND.ink};font-weight:600;">Thank you, ${escapeHtml(firstName)}.</h1>`,
    `            <p style="margin:0 0 24px;font-family:${BRAND.sans};font-size:15px;line-height:1.65;color:${BRAND.inkSoft};">`,
    '              We have received your order and it is now with our kitchen team. A member of the',
    `              team will call you on <strong style="color:${BRAND.ink};">${escapeHtml(order.phone)}</strong>`,
    '              to confirm delivery details and payment.',
    '            </p>',

    // Reference box
    `            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};border:1px solid ${BRAND.border};border-radius:6px;margin-bottom:26px;">`,
    `              <tr><td style="padding:14px 16px 6px;font-family:${BRAND.sans};font-size:13px;color:${BRAND.inkSoft};">Order reference</td>`,
    `                  <td align="right" style="padding:14px 16px 6px;font-family:${BRAND.sans};font-size:14px;font-weight:700;letter-spacing:1px;color:${BRAND.ink};">${escapeHtml(order.orderNumber)}</td></tr>`,
    `              <tr><td style="padding:0 16px 14px;font-family:${BRAND.sans};font-size:13px;color:${BRAND.inkSoft};">Placed</td>`,
    `                  <td align="right" style="padding:0 16px 14px;font-family:${BRAND.sans};font-size:13px;color:${BRAND.inkSoft};">${escapeHtml(order.placedAtLabel)}</td></tr>`,
    '            </table>',

    // Line items
    `            <h2 style="margin:0 0 4px;font-family:${BRAND.sans};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${BRAND.accent};">Your order</h2>`,
    '            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">',
    itemRows(order.items),
    totalRow('Subtotal', order.subtotalLabel),
    totalRow('Delivery', order.deliveryFeeLabel),
    totalRow('Total', order.totalLabel, true),
    '            </table>',

    // Delivery
    `            <h2 style="margin:28px 0 8px;font-family:${BRAND.sans};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${BRAND.accent};">Delivery details</h2>`,
    `            <p style="margin:0;font-family:${BRAND.sans};font-size:15px;line-height:1.65;color:${BRAND.inkSoft};">`,
    `              ${escapeHtml(order.deliveryAddress)}<br />`,
    `              ${escapeHtml(order.deliveryCity)}`,
    order.deliveryNotes
      ? `              <br /><em>Note: ${escapeHtml(order.deliveryNotes)}</em>`
      : '',
    '            </p>',

    `            <p style="margin:28px 0 0;font-family:${BRAND.sans};font-size:14px;line-height:1.65;color:${BRAND.inkSoft};">`,
    `              Questions? Simply reply to this email or write to <a href="mailto:${escapeHtml(order.supportEmail)}" style="color:${BRAND.accent};text-decoration:none;">${escapeHtml(order.supportEmail)}</a>.`,
    '            </p>',
    '          </td>',
    '        </tr>',

    // Footer
    '        <tr>',
    `          <td style="padding:20px 32px;background:${BRAND.page};border-top:1px solid ${BRAND.border};font-family:${BRAND.sans};font-size:12px;color:${BRAND.inkSoft};">`,
    '            Yuhmyuhm Catering Services &middot; Fresh &middot; Delicious &middot; Memorable',
    '          </td>',
    '        </tr>',

    '      </table>',
    '    </td></tr>',
    '  </table>',
    '</body>',
    '</html>',
  ]
    .filter(Boolean)
    .join('\n');

  // Plain-text alternative: every email we send has one, for accessibility and
  // for clients that refuse HTML.
  const text = [
    `Thank you, ${order.customerName}.`,
    '',
    `We have received order ${order.orderNumber} and it is now with our kitchen team.`,
    `We will call you on ${order.phone} to confirm delivery and payment.`,
    '',
    `Placed: ${order.placedAtLabel}`,
    '',
    'YOUR ORDER',
    ...order.items.map((item) => `  ${item.quantity} x ${item.name} — ${item.lineTotalLabel}`),
    '',
    `Subtotal: ${order.subtotalLabel}`,
    `Delivery: ${order.deliveryFeeLabel}`,
    `Total:    ${order.totalLabel}`,
    '',
    'DELIVERY DETAILS',
    `  ${order.deliveryAddress}`,
    `  ${order.deliveryCity}`,
    ...(order.deliveryNotes ? [`  Note: ${order.deliveryNotes}`] : []),
    '',
    `Questions? Reply to this email or write to ${order.supportEmail}.`,
    '',
    'Yuhmyuhm Catering Services — Fresh · Delicious · Memorable',
  ].join('\n');

  return { subject, html, text };
}

/** Plain internal alert so the team sees new orders without opening the DB. */
export function renderInternalOrderNotification(order: OrderEmailData): RenderedEmail {
  const subject = `New order ${order.orderNumber} — ${order.totalLabel}`;
  const text = [
    `New order received: ${order.orderNumber}`,
    `Placed: ${order.placedAtLabel}`,
    '',
    `Customer: ${order.customerName}`,
    `Email:    ${order.email}`,
    `Phone:    ${order.phone}`,
    '',
    'Deliver to:',
    `  ${order.deliveryAddress}`,
    `  ${order.deliveryCity}`,
    ...(order.deliveryNotes ? [`  Note: ${order.deliveryNotes}`] : []),
    '',
    'Items:',
    ...order.items.map((item) => `  ${item.quantity} x ${item.name} — ${item.lineTotalLabel}`),
    '',
    `Subtotal: ${order.subtotalLabel}`,
    `Delivery: ${order.deliveryFeeLabel}`,
    `Total:    ${order.totalLabel}`,
  ].join('\n');

  return {
    subject,
    html: `<pre style="font-family:${BRAND.sans};font-size:14px;line-height:1.6;color:${BRAND.ink};white-space:pre-wrap;">${escapeHtml(text)}</pre>`,
    text,
  };
}
