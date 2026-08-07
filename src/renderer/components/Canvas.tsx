import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { FlowEdge, FlowNode } from '@shared/types'

/**
 * The automations canvas.
 *
 * Nodes are absolutely positioned in graph space; edges are one SVG layer
 * behind them. Panning moves the whole plane rather than scrolling a
 * container, so the two stay in register at any offset — a scrolled div and an
 * SVG overlay drift the moment either has its own padding.
 *
 * Everything here is presentation. It owns no workflow state: it renders the
 * graph it is given and reports intents back up.
 */

export const GRID = 20
export const NODE_W = 240
export const NODE_H = 92

const snap = (value: number): number => Math.round(value / GRID) * GRID

/** A cubic that leaves horizontally and arrives horizontally, like n8n's. */
const edgePath = (from: FlowNode, to: FlowNode): string => {
  const x1 = from.x + NODE_W
  const y1 = from.y + NODE_H / 2
  const x2 = to.x
  const y2 = to.y + NODE_H / 2
  // The handle length grows with the gap, so short hops stay tight and long
  // ones bow instead of cutting a diagonal across the canvas.
  const reach = Math.max(50, Math.min(180, Math.abs(x2 - x1) * 0.5))
  return `M ${x1} ${y1} C ${x1 + reach} ${y1}, ${x2 - reach} ${y2}, ${x2} ${y2}`
}

export interface CanvasProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
  selected: string | null
  /** Node currently executing, so a live run can be watched. */
  running?: string | null
  onSelect: (nodeId: string | null) => void
  onMove: (nodeId: string, x: number, y: number) => void
  onConnect: (from: string, to: string) => void
  onDropEdge: (edgeId: string) => void
  renderNode: (node: FlowNode) => ReactNode
}

interface Drag {
  nodeId: string
  offsetX: number
  offsetY: number
}

interface Wire {
  from: string
  x: number
  y: number
}

export const Canvas = ({
  nodes,
  edges,
  selected,
  running,
  onSelect,
  onMove,
  onConnect,
  onDropEdge,
  renderNode
}: CanvasProps): ReactNode => {
  const surface = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [wire, setWire] = useState<Wire | null>(null)
  const panning = useRef<{ x: number; y: number } | null>(null)

  /** Screen coordinates to graph coordinates. */
  const toGraph = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const box = surface.current?.getBoundingClientRect()
      return {
        x: clientX - (box?.left ?? 0) - pan.x,
        y: clientY - (box?.top ?? 0) - pan.y
      }
    },
    [pan]
  )

  // Pointer move and release are tracked on the window, not the node: a fast
  // drag outruns the element and would otherwise drop it mid-gesture.
  useEffect(() => {
    if (!drag && !wire && !panning.current) return

    const move = (event: globalThis.PointerEvent): void => {
      if (panning.current) {
        setPan({ x: event.clientX - panning.current.x, y: event.clientY - panning.current.y })
        return
      }
      const point = toGraph(event.clientX, event.clientY)
      if (drag) onMove(drag.nodeId, point.x - drag.offsetX, point.y - drag.offsetY)
      else if (wire) setWire({ ...wire, x: point.x, y: point.y })
    }

    const up = (event: globalThis.PointerEvent): void => {
      if (drag) {
        // Snapping happens once, on release. Snapping continuously makes a
        // drag feel like it is fighting you.
        const point = toGraph(event.clientX, event.clientY)
        onMove(drag.nodeId, snap(point.x - drag.offsetX), snap(point.y - drag.offsetY))
      }
      if (wire) {
        const target = (event.target as HTMLElement).closest('[data-node]')
        const targetId = target?.getAttribute('data-node')
        if (targetId && targetId !== wire.from) onConnect(wire.from, targetId)
      }
      setDrag(null)
      setWire(null)
      panning.current = null
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [drag, wire, toGraph, onMove, onConnect])

  const startDrag = (event: PointerEvent, node: FlowNode): void => {
    if ((event.target as HTMLElement).closest('[data-port]')) return
    event.stopPropagation()
    const point = toGraph(event.clientX, event.clientY)
    setDrag({ nodeId: node.id, offsetX: point.x - node.x, offsetY: point.y - node.y })
    onSelect(node.id)
  }

  const startWire = (event: PointerEvent, node: FlowNode): void => {
    event.stopPropagation()
    const point = toGraph(event.clientX, event.clientY)
    setWire({ from: node.id, x: point.x, y: point.y })
  }

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const source = wire ? byId.get(wire.from) : undefined

  return (
    <div
      className="canvas"
      ref={surface}
      onPointerDown={(event) => {
        // Dragging the background pans; clicking it clears the selection.
        panning.current = { x: event.clientX - pan.x, y: event.clientY - pan.y }
        onSelect(null)
        setDrag(null)
      }}
      style={{ backgroundPosition: `${pan.x}px ${pan.y}px` }}
    >
      <div className="plane" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
        <svg className="wires">
          {edges.map((edge) => {
            const from = byId.get(edge.from)
            const to = byId.get(edge.to)
            if (!from || !to) return null
            return (
              <g key={edge.id} className="wire">
                <path className="wire-hit" d={edgePath(from, to)} onClick={() => onDropEdge(edge.id)} />
                <path className="wire-line" d={edgePath(from, to)} />
              </g>
            )
          })}

          {source && wire ? (
            <path
              className="wire-draft"
              d={`M ${source.x + NODE_W} ${source.y + NODE_H / 2} C ${source.x + NODE_W + 80} ${
                source.y + NODE_H / 2
              }, ${wire.x - 80} ${wire.y}, ${wire.x} ${wire.y}`}
            />
          ) : null}
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            className="node"
            data-node={node.id}
            data-kind={node.kind}
            data-on={selected === node.id}
            data-running={running === node.id}
            style={{ left: node.x, top: node.y, width: NODE_W }}
            onPointerDown={(event) => startDrag(event, node)}
          >
            {node.kind !== 'trigger' ? <span className="port in" data-port="in" /> : null}
            {renderNode(node)}
            <span
              className="port out"
              data-port="out"
              onPointerDown={(event) => startWire(event, node)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
