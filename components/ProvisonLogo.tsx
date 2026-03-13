interface ProvisonLogoProps {
  className?: string;
}

export function ProvisonLogo({ className = "w-12 h-12" }: ProvisonLogoProps) {
  return (
    <svg className={className} viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g fill="white">
        {/* Center hub */}
        <circle cx="200" cy="200" r="15" />
        
        {/* Top node */}
        <circle cx="200" cy="120" r="12" />
        <rect x="198" y="132" width="4" height="53" />
        
        {/* Top-right node */}
        <circle cx="256" cy="144" r="12" />
        <rect x="214" y="187" width="38" height="4" transform="rotate(-30 214 187)" />
        
        {/* Right node */}
        <circle cx="280" cy="200" r="12" />
        <rect x="215" y="198" width="53" height="4" />
        
        {/* Bottom-right node */}
        <circle cx="256" cy="256" r="12" />
        <rect x="214" y="213" width="38" height="4" transform="rotate(30 214 213)" />
        
        {/* Bottom node */}
        <circle cx="200" cy="280" r="12" />
        <rect x="198" y="215" width="4" height="53" />
        
        {/* Bottom-left node */}
        <circle cx="144" cy="256" r="12" />
        <rect x="148" y="213" width="38" height="4" transform="rotate(-30 148 213)" />
        
        {/* Left node */}
        <circle cx="120" cy="200" r="12" />
        <rect x="132" y="198" width="53" height="4" />
        
        {/* Top-left node */}
        <circle cx="144" cy="144" r="12" />
        <rect x="148" y="187" width="38" height="4" transform="rotate(30 148 187)" />
      </g>
    </svg>
  );
}
