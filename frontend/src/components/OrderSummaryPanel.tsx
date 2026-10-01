import type { ReactNode } from 'react';

/**
 * Order summary card.
 *
 * Deliberately format-agnostic: it takes pre-rendered labels from the API
 * rather than computing anything, so the same panel can show a live cart, a
 * checkout in progress or a historical order without risking a different total.
 */

export interface OrderSummaryLine {
  key: string;
  name: string;
  quantity: number;
  lineTotalLabel: string;
}

export interface OrderSummaryPanelProps {
  lines: OrderSummaryLine[];
  itemCount: number;
  subtotalLabel: string;
  deliveryFeeLabel: string;
  totalLabel: string;
  deliveryIsFree: boolean;
  title?: string;
  note?: string;
  children?: ReactNode;
}

export function OrderSummaryPanel({
  lines,
  itemCount,
  subtotalLabel,
  deliveryFeeLabel,
  totalLabel,
  deliveryIsFree,
  title = 'Order summary',
  note,
  children,
}: OrderSummaryPanelProps) {
  return (
    <aside className="summary" aria-label={title}>
      <h2 className="summary__title">{title}</h2>

      <ul className="summary__lines">
        {lines.map((line) => (
          <li className="summary__line" key={line.key}>
            <span>
              {line.name}
              <span className="summary__qty"> × {line.quantity}</span>
            </span>
            <span className="nowrap">{line.lineTotalLabel}</span>
          </li>
        ))}
      </ul>

      <dl>
        <div className="summary__row">
          <dt>Subtotal ({itemCount} items)</dt>
          <dd>{subtotalLabel}</dd>
        </div>
        <div className={deliveryIsFree ? 'summary__row summary__row--free' : 'summary__row'}>
          <dt>Delivery</dt>
          <dd>{deliveryIsFree ? 'Free' : deliveryFeeLabel}</dd>
        </div>
        <div className="summary__row summary__row--total">
          <dt>Total</dt>
          <dd>{totalLabel}</dd>
        </div>
      </dl>

      {note ? <p className="summary__note">{note}</p> : null}
      {children ? <div className="summary__cta">{children}</div> : null}
    </aside>
  );
}
