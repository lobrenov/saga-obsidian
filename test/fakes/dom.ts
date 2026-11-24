/** Obsidian's DOM helpers (`detach`, `empty`, `instanceOf`, `createEl`, `createDiv`, `createSpan`, `createSvg`, `setCssStyles`, `setCssProps`, `activeDocument`) for browser tests, covering the `cls`, `text` and `attr` options. */
type Info = { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean | null> }

function fill<T extends Element>(el: T, o?: Info | string): T {
  const info = typeof o === 'string' ? { cls: o } : (o ?? {})
  if (info.cls) el.classList.add(...(Array.isArray(info.cls) ? info.cls : info.cls.split(' ')).filter(Boolean))
  if (info.text !== undefined) el.textContent = info.text
  for (const [name, value] of Object.entries(info.attr ?? {})) if (value !== null && value !== false) el.setAttribute(name, String(value))
  return el
}

const docOf = (node: Node): Document => node.ownerDocument ?? (node as Document)

Object.assign(Node.prototype, {
  detach(this: ChildNode) {
    this.remove()
  },
  empty(this: Node) {
    while (this.firstChild) this.removeChild(this.firstChild)
  },
  instanceOf(this: Node, type: new () => unknown) {
    return this instanceof type
  },
  createEl(this: Node, tag: string, o?: Info | string) {
    return this.appendChild(fill(docOf(this).createElement(tag), o))
  },
  createDiv(this: Node, o?: Info | string) {
    return this.appendChild(fill(docOf(this).createElement('div'), o))
  },
  createSpan(this: Node, o?: Info | string) {
    return this.appendChild(fill(docOf(this).createElement('span'), o))
  },
  createSvg(this: Node, tag: string, o?: Info | string) {
    return this.appendChild(fill(docOf(this).createElementNS('http://www.w3.org/2000/svg', tag), o))
  }
})

Object.assign(HTMLElement.prototype, {
  setCssStyles(this: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
    Object.assign(this.style, styles)
  },
  setCssProps(this: HTMLElement, props: Record<string, string>) {
    for (const [name, value] of Object.entries(props)) this.style.setProperty(name, value)
  }
})

Object.assign(globalThis, {
  activeDocument: document,
  createEl: (tag: string, o?: Info | string) => fill(document.createElement(tag), o),
  createDiv: (o?: Info | string) => fill(document.createElement('div'), o),
  createSpan: (o?: Info | string) => fill(document.createElement('span'), o),
  createSvg: (tag: string, o?: Info | string) => fill(document.createElementNS('http://www.w3.org/2000/svg', tag), o)
})
