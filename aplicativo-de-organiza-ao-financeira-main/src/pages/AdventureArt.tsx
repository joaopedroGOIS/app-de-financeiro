/** Decorative artwork only: financial and progression values come from Dashboard. */
export function AdventureArt({ landscape = false }: { landscape?: boolean }) {
  return landscape ? (
    <svg className="adventure-landscape" viewBox="0 0 440 170" aria-hidden="true" focusable="false">
      <path d="M20 120L115 90L188 115L295 53L425 92L321 144L159 163Z" fill="var(--primary)" opacity=".12" />
      <path d="M20 120L159 163L321 144L425 92L413 122L316 164L162 178L30 142Z" fill="var(--primary)" opacity=".2" />
      <path d="M53 124L137 118L200 131L280 90L366 99" stroke="var(--primary-text)" strokeWidth="3" strokeDasharray="5 6" fill="none" />
      <path d="M270 70L291 30L318 70L295 96Z" fill="var(--primary)" />
      <path d="M291 30L295 96L270 70Z" fill="var(--accent)" />
      <path d="M291 30L318 70L295 66Z" fill="var(--on-primary)" opacity=".45" />
      <path d="M117 92L138 59L160 92L139 115Z" fill="var(--success)" />
      <path d="M138 59L139 115L117 92Z" fill="var(--on-primary)" opacity=".35" />
      <ellipse cx="295" cy="103" rx="36" ry="9" stroke="var(--primary-text)" fill="none" opacity=".5" />
      <circle cx="366" cy="99" r="6" fill="var(--warning)" />
      <circle cx="53" cy="124" r="5" fill="var(--success)" />
      <path d="M344 23V35M338 29H350M205 60V70M200 65H210" stroke="var(--primary-text)" />
    </svg>
  ) : (
    <svg className="adventure-crystal" viewBox="0 0 160 175" aria-hidden="true" focusable="false">
      <path d="M80 12L143 47V123L80 161L17 123V47Z" stroke="var(--primary-text)" fill="none" opacity=".25" />
      <path d="M80 24L130 53V117L80 147L30 117V53Z" stroke="var(--primary-text)" fill="var(--primary)" fillOpacity=".08" />
      <path d="M80 28L108 80L80 145L52 80Z" fill="var(--primary)" />
      <path d="M80 28V91L52 80Z" fill="var(--accent)" />
      <path d="M80 28L108 80L80 91Z" fill="var(--on-primary)" opacity=".3" />
      <path d="M108 80L80 145V91Z" fill="var(--primary-strong)" />
      <path d="M43 62L52 80L56 134L35 103Z M117 61L108 80L105 134L126 103Z" stroke="var(--primary-text)" fill="var(--primary)" fillOpacity=".15" />
    </svg>
  )
}