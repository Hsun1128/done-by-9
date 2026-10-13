export type Child = Node | string | false | null;

export interface Props {
  readonly className?: string;
  readonly attrs?: Readonly<Record<string, string>>;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
}

/** Minimal typed element builder. Text children are always inserted as text, never as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: readonly Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.className !== undefined) element.className = props.className;
  if (props.attrs !== undefined) {
    for (const [name, value] of Object.entries(props.attrs)) element.setAttribute(name, value);
  }
  if (props.onClick !== undefined) element.addEventListener('click', props.onClick);
  if (props.disabled === true && element instanceof HTMLButtonElement) element.disabled = true;
  for (const child of children) {
    if (child !== false && child !== null) element.append(child);
  }
  return element;
}
