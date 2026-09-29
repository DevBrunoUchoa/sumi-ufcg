import { axisIconFor } from './axis-icons.js';

export function AxisIcon({ planType, axis, className = '' }) {
  const icon = axisIconFor(planType, axis);
  if (!icon) return <span className={`axis-icon-marker ${className}`} style={{ '--axis-color': axis.color }} aria-hidden="true" />;
  return <span className={`axis-icon ${className}`} style={{ '--axis-color': axis.color, '--axis-icon': `url("${icon}")` }} aria-hidden="true" />;
}
