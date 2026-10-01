import type { SVGProps } from 'react';

/**
 * Inline SVG icon set.
 *
 * Hand-rolled rather than pulled from an icon package: the set is small, and
 * inlining keeps the icons crisp, themeable via `currentColor`, and free of an
 * extra runtime dependency.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ChefHatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 13.5A3.5 3.5 0 0 1 6 6.6a4 4 0 0 1 7.6-1.5A4 4 0 0 1 18 6.6a3.5 3.5 0 0 1 0 6.9" />
      <path d="M6 13.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5.5" />
      <path d="M9.5 20v-4.5M14.5 20v-4.5" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Icon>
  );
}

export function BagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 8h13l-1 11.5a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </Icon>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.5a4.4 4.4 0 0 1 7.5 2.9C19.5 15.4 12 20 12 20z" />
    </Icon>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 7h10v9h-10z" />
      <path d="M12.5 10h4l3 3v3h-7z" />
      <circle cx="6.5" cy="18" r="1.8" />
      <circle cx="16.5" cy="18" r="1.8" />
    </Icon>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 19c0-8 5-13 14-13 0 9-5 13-14 13z" />
      <path d="M5 19c2.5-3.5 5.5-6 10-8" />
    </Icon>
  );
}

export function AwardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="9.5" r="5" />
      <path d="m8.5 14-1 6.5 4.5-2.5 4.5 2.5-1-6.5" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 7h15M9 7V5.5h6V7M6.5 7l.8 12.1a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </Icon>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.7 2 2 0 0 1 6 3.5z" />
    </Icon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s6.5-5.7 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.3 12 21 12 21z" />
      <circle cx="12" cy="10.3" r="2.4" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="17" cy="7" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 8.5H17V5.3h-2.8c-2.3 0-3.7 1.5-3.7 3.8v1.6H8.3v3.2h2.2V21h3.3v-7.1h2.6l.5-3.2h-3.1V9.5c0-.7.3-1 .7-1z" />
    </Icon>
  );
}

export function TwitterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4.5h3.6l4.3 5.8 4.7-5.8H20l-6.2 7.4L20.5 20h-3.6l-4.6-6.2L7.2 20H4.3l6.5-7.8z" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </Icon>
  );
}

export function PackageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3 7.5 4v10L12 21l-7.5-4V7z" />
      <path d="M4.5 7 12 11l7.5-4M12 21v-10" />
    </Icon>
  );
}
